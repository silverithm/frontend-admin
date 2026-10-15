'use client';

/**
 * 원문 붙여넣고 AI로 항목 점검 — 항목별 있음/없음 제안과 원문 근거 구절(quote)을 보여 준다.
 * 사람이 ‘제안대로 체크’를 눌러야 체크에 들어가고, 문서를 저장해야 남는다. 원문은 이 요청에만 쓰고 저장하지 않는다.
 */
import { useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { AiChip, Chip, ErrorBanner, SupportText } from '@/components/lab/LabUi';
import { errorText } from '@/components/lab/labFormat';
import { useAlive } from '@/components/labRecords/recordsFormat';
import { aiPolicyCheck } from '@/lib/lab/labApi';
import type { PolicyCheckAiResult } from '@/lib/lab/labTypes';
import { aiKindOf, itemsOf } from '@/lib/lab/policyDocRules';
import type { PolicyDraft } from './PolicyDocDraft';
import styles from './labPlans10.module.css';

const MAX_TEXT = 20000;

interface Props {
  draft: PolicyDraft;
  isDisabled: boolean;
  /** 있음으로 제안된 항목 키를 체크에 넣는다 */
  onApply: (keys: string[]) => void;
}

export default function PolicyDocAi({ draft, isDisabled, onApply }: Props) {
  const alive = useAlive();
  const kind = aiKindOf(draft.kind, draft.guideNo);
  const items = itemsOf(draft.kind, draft.guideNo);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PolicyCheckAiResult | null>(null);
  const [applied, setApplied] = useState(false);
  const busy = useRef(false);

  if (kind === null) {
    return (
      <Card padding={3}>
        <Text type="supporting" color="secondary">이 종류는 AI로 점검할 항목이 없습니다. 급여제공지침은 ⑩ 개인정보보호지침만 항목 점검을 지원합니다.</Text>
      </Card>
    );
  }

  const run = async () => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setError(null);
    setResult(null);
    setApplied(false);
    try {
      const r = await aiPolicyCheck({ kind, text: text.trim() });
      if (!alive.current) return;
      setResult(r);
    } catch (err) {
      if (alive.current) setError(errorText(err, 'AI가 규정 항목을 점검하지 못했습니다. 잠시 뒤 다시 시도해 주세요'));
    } finally {
      busy.current = false;
      if (alive.current) setLoading(false);
    }
  };

  const present = (result?.items ?? []).filter((i) => i.present && items.some((x) => x.key === i.key)).map((i) => i.key);
  const byKey = new Map((result?.items ?? []).map((i) => [i.key, i]));

  return (
    <Card padding={4}>
      <VStack gap={3}>
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Text type="label">원문 붙여넣고 AI로 항목 점검</Text>
          <AiChip label="제안만" />
        </HStack>
        <SupportText>규정 원문을 붙여 넣으면 위 항목이 들어 있는지 AI가 살펴 근거 구절과 함께 제안합니다. 원문은 이번 점검에만 쓰고 저장하지 않습니다. 이름·연락처는 AI로 보내기 전에 지워집니다.</SupportText>
        <TextArea label="규정 원문" placeholder="규정이나 지침의 글을 그대로 붙여 넣으세요" value={text} onChange={(v) => setText(v.slice(0, MAX_TEXT))} rows={8} maxLength={MAX_TEXT} isDisabled={isDisabled || loading} />
        <HStack gap={2} wrap="wrap">
          <Button label="AI로 항목 점검" variant="secondary" isLoading={loading} isDisabled={isDisabled || loading || text.trim() === ''} onClick={() => void run()} />
          <Button label="원문 지우기" variant="ghost" isDisabled={loading || text === ''} onClick={() => setText('')} />
        </HStack>
        {error && <ErrorBanner message={error} />}
        {result && (
          <div className={styles.checkBox}>
            <HStack gap={2} vAlign="center" wrap="wrap">
              <AiChip />
              <Text type="supporting" color="secondary">아래는 제안입니다. 근거 구절을 읽고 맞는지 확인한 뒤 체크에 넣어 주세요.</Text>
            </HStack>
            <div className={styles.tableScroll}>
              <table className={styles.proposalTable}>
                <thead>
                  <tr>
                    <th>항목</th>
                    <th>AI 제안</th>
                    <th>근거 구절</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => {
                    const r = byKey.get(i.key);
                    return (
                      <tr key={i.key}>
                        <td>{i.label}</td>
                        <td>
                          <Chip tone={r?.present ? 'ok' : 'warn'} label={r?.present ? '있음' : '없음'} />
                        </td>
                        <td>{r?.quote ? <blockquote className={styles.quote}>{r.quote}</blockquote> : <Text type="supporting" color="secondary">찾은 구절 없음</Text>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {result.advice.trim() !== '' && (
              <VStack gap={1}>
                <Text type="label">빠진 항목을 채우는 방법 (AI 제안)</Text>
                <div className={styles.printBlock}>
                  <Text type="supporting">{result.advice}</Text>
                </div>
              </VStack>
            )}
            <HStack gap={2} vAlign="center" wrap="wrap">
              <Button
                label={applied ? '체크에 넣었습니다' : '제안대로 체크'}
                variant="primary"
                isDisabled={isDisabled || applied || present.length === 0}
                onClick={() => {
                  onApply(present);
                  setApplied(true);
                }}
              />
              <Text type="supporting" color="secondary">‘있음’으로 제안된 항목만 체크합니다. 이미 체크한 항목은 그대로 두고, 저장해야 남습니다.</Text>
            </HStack>
          </div>
        )}
      </VStack>
    </Card>
  );
}
