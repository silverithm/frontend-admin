'use client';

/** 만족도 응답 입력 — 조사일·어르신(또는 익명)·응답한 분·문항별 점수·의견·면담자. 저장하면 어르신·점수·의견만 비우고 조사일·면담자는 남겨 연달아 받기 쉽게 한다. */
import { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { Selector } from '@astryxdesign/core/Selector';
import { VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { createSatisfaction } from '@/lib/lab/labApi';
import type { SatisfactionKind, SatisfactionRespondent, SatisfactionResponse } from '@/lib/lab/labTypes';
import { SATISFACTION_KINDS, SURVEY_QUESTIONS, SURVEY_SOURCE_NOTE } from '@/lib/lab/satisfactionRules';
import { Chip, ErrorBanner, LabDateInput, SupportText } from '@/components/lab/LabUi';
import { PROVIDER_KEY, defaultPersonName, errorText, todayString, writeStored } from '@/components/lab/labFormat';
import type { LabElder } from '@/components/lab/useLabElders';
import { MAX_INTERVIEWER, MAX_SATISFACTION_COMMENT, newSatisfactionDraft, satisfactionInputOf, validateSatisfaction } from './SatisfactionDraft';
import type { SatisfactionDraft } from './SatisfactionDraft';
import SatisfactionScoreButtons from './SatisfactionScoreButtons';
import { useAlive } from './recordsFormat';
import styles from './labRecords.module.css';

interface Props {
  kind: SatisfactionKind;
  elders: LabElder[];
  eldersLoading: boolean;
  onSaved: (saved: SatisfactionResponse) => void;
}

export default function SatisfactionForm({ kind, elders, eldersLoading, onSaved }: Props) {
  const alive = useAlive();
  const [draft, setDraft] = useState<SatisfactionDraft>(() => newSatisfactionDraft(todayString(), defaultPersonName()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastKind, setLastKind] = useState(kind);
  // 종류를 바꾸면 앞 종류의 점수는 비운다 — 렌더 중 이전 값과 비교하는 React 권장 방식
  if (lastKind !== kind) {
    setLastKind(kind);
    setDraft((d) => ({ ...d, scores: {} }));
    setError(null);
  }

  const kindLabel = SATISFACTION_KINDS.find((k) => k.value === kind)?.label ?? '';
  const questions = SURVEY_QUESTIONS[kind];
  const answered = questions.filter((q) => draft.scores[q.code] !== undefined).length;
  const set = <K extends keyof SatisfactionDraft>(key: K, value: SatisfactionDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const save = async () => {
    if (saving) return;
    const problem = validateSatisfaction(draft, kind, todayString());
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await createSatisfaction(satisfactionInputOf(draft, kind));
      if (draft.interviewer.trim() !== '') writeStored(PROVIDER_KEY, draft.interviewer.trim());
      if (!alive.current) return;
      setDraft((d) => ({ ...d, elderId: null, scores: {}, comment: '' }));
      onSaved(saved);
    } catch (e) {
      if (alive.current) setError(errorText(e, '만족도 응답을 저장하지 못했습니다'));
    } finally {
      if (alive.current) setSaving(false);
    }
  };

  return (
    <Card padding={4}>
      <VStack gap={3}>
        <Text type="large" weight="semibold">
          {kindLabel} 만족도 응답 받기
        </Text>
        <SupportText>{SURVEY_SOURCE_NOTE}</SupportText>
        <div className={styles.fieldGrid}>
          <LabDateInput label="조사일" value={draft.date} onChange={(v) => set('date', v)} max={todayString()} />
          <Selector
            label="어르신"
            placeholder={draft.anonymous ? '익명 응답' : '어르신 고르기'}
            hasSearch={elders.length > 8}
            searchPlaceholder="찾기"
            isDisabled={draft.anonymous || eldersLoading}
            options={elders.map((e) => ({ value: String(e.id), label: e.name }))}
            value={draft.elderId === null ? '' : String(draft.elderId)}
            onChange={(v) => set('elderId', v ? Number(v) : null)}
          />
          <Selector
            label="응답한 분"
            placeholder="본인·보호자 고르기"
            options={[
              { value: 'SELF', label: '본인' },
              { value: 'GUARDIAN', label: '보호자' },
            ]}
            value={draft.respondent ?? ''}
            onChange={(v) => set('respondent', v ? (v as SatisfactionRespondent) : null)}
          />
          <TextInput label="면담자" value={draft.interviewer} onChange={(v) => set('interviewer', v.slice(0, MAX_INTERVIEWER))} />
        </div>
        <CheckboxInput
          label="익명으로 받기"
          description="누구의 응답인지 남기지 않습니다. 식사 반기 현황에서 어르신별 확인에는 세지 않습니다"
          value={draft.anonymous}
          onChange={(checked) => setDraft((d) => ({ ...d, anonymous: checked, elderId: checked ? null : d.elderId }))}
        />

        <div>
          <div className={styles.toolbar}>
            <Text type="label">문항 (1 매우 불만 ~ 5 매우 만족)</Text>
            <Chip tone={answered === questions.length ? 'ok' : 'neutral'} label={`${answered}/${questions.length}개 답함`} />
          </div>
          {questions.map((q) => (
            <SatisfactionScoreButtons key={q.code} text={q.text} value={draft.scores[q.code]} onChange={(v) => setDraft((d) => {
              const scores = { ...d.scores };
              if (v === undefined) delete scores[q.code];
              else scores[q.code] = v;
              return { ...d, scores };
            })} />
          ))}
        </div>

        <TextArea label="의견 (선택)" description="하신 말씀을 그대로 적어 주세요" placeholder="예: 반찬이 조금 짰어요. 노래 시간이 더 길었으면 좋겠어요" value={draft.comment} onChange={(v) => set('comment', v)} rows={3} maxLength={MAX_SATISFACTION_COMMENT} />

        {error && <ErrorBanner message={error} />}
        <div>
          <Button label="응답 저장" variant="primary" isLoading={saving} isDisabled={saving} onClick={() => void save()} />
        </div>
      </VStack>
    </Card>
  );
}
