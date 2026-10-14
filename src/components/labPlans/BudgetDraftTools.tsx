'use client';

/**
 * 예산 초안 도구 — ① 전년 실적으로 초안(규칙: 전년 장부 합 × 증가율, 천 원 올림) ② AI 초안(계정과 전년 실적, 메모 → 금액 제안).
 * 둘 다 제안 표로만 보여 주고, 직원이 골라 반영한다. 반영한 뒤 저장은 직원이 직접 한다.
 */
import { useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { AiChip, ErrorBanner, SupportText } from '@/components/lab/LabUi';
import { errorText } from '@/components/lab/labFormat';
import { useAlive } from '@/components/labRecords/recordsFormat';
import { draftAccounts, draftFromActuals, roundUpToThousand } from '@/lib/lab/budgetRules';
import { aiDraftBudget } from '@/lib/lab/labApi';
import { isAccountCode } from '@/lib/lab/ledgerRules';
import type { LedgerEntry, LedgerDirection } from '@/lib/lab/labTypes';
import BudgetProposals from './BudgetProposals';
import type { Proposal } from './BudgetProposals';
import type { LineDraft } from './BudgetDraft';

interface Props {
  year: number;
  lines: LineDraft[];
  /** 전년 장부. 불러오는 중이거나 실패하면 null */
  prevEntries: LedgerEntry[] | null;
  prevLoading: boolean;
  prevError: string | null;
  onReloadPrev: () => void;
  isLocked: boolean;
  onApply: (picked: Array<{ direction: LedgerDirection; accountCode: string; amount: number }>) => void;
}

/** 증가율 입력 글자 정리 — 숫자·소수점·앞의 마이너스만 남긴다 */
function cleanGrowth(text: string): string {
  const neg = text.trim().startsWith('-');
  const body = text.replace(/,/g, '.').replace(/[^0-9.]/g, '');
  const dot = body.indexOf('.');
  const clean = dot === -1 ? body.slice(0, 4) : `${body.slice(0, dot).slice(0, 4)}.${body.slice(dot + 1).replace(/\./g, '').slice(0, 2)}`;
  return `${neg ? '-' : ''}${clean}`;
}

export default function BudgetDraftTools({ year, lines, prevEntries, prevLoading, prevError, onReloadPrev, isLocked, onApply }: Props) {
  const alive = useAlive();
  const [growth, setGrowth] = useState('0');
  const [notes, setNotes] = useState('');
  const [proposals, setProposals] = useState<{ id: number; ai: boolean; list: Proposal[] } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const busy = useRef(false);
  const seq = useRef(0);

  const growthValue = Number(growth === '' || growth === '-' || growth === '.' ? '0' : growth);
  const growthOk = Number.isFinite(growthValue) && growthValue > -100;

  const fromActuals = () => {
    if (prevEntries === null) return;
    const list = draftFromActuals(prevEntries, year - 1, growthValue);
    seq.current += 1;
    setAiError(null);
    setProposals({
      id: seq.current,
      ai: false,
      list: list.map((p) => ({ ...p, reason: `${year - 1}년 실적에 ${growthValue}%를 더해 천 원 단위로 올림` })),
    });
  };

  const runAi = async () => {
    if (busy.current) return;
    busy.current = true;
    setAiLoading(true);
    setAiError(null);
    try {
      const accounts = draftAccounts(prevEntries ?? [], year - 1).slice(0, 300);
      const result = await aiDraftBudget({ year, accounts, notes: notes.trim() === '' ? undefined : notes.trim() });
      if (!alive.current) return;
      const list: Proposal[] = result.lines
        .filter((l) => isAccountCode(l.direction, l.accountCode))
        .map((l) => ({ direction: l.direction, accountCode: l.accountCode, amount: roundUpToThousand(l.amount), reason: l.reason }))
        .filter((l) => l.amount > 0);
      seq.current += 1;
      setProposals({ id: seq.current, ai: true, list });
    } catch (err) {
      if (alive.current) setAiError(errorText(err, 'AI가 예산 초안을 만들지 못했습니다. 잠시 뒤 다시 시도해 주세요'));
    } finally {
      busy.current = false;
      if (alive.current) setAiLoading(false);
    }
  };

  return (
    <Card padding={4}>
      <VStack gap={3}>
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Text type="label">예산 초안 도구</Text>
          <AiChip label="AI 초안은 제안" />
        </HStack>
        {isLocked && <SupportText tone="warn">확정된 예산입니다. 초안을 반영하려면 먼저 확정을 풀어 주세요.</SupportText>}
        {prevError && <ErrorBanner message={prevError} onRetry={onReloadPrev} />}

        <VStack gap={2}>
          <Text type="label">전년 실적으로 초안</Text>
          <HStack gap={3} vAlign="end" wrap="wrap">
            <TextInput label="증가율 (%)" description="마이너스(-)도 됩니다" value={growth} onChange={(v) => setGrowth(cleanGrowth(v))} />
            <Button label="전년 실적으로 초안" variant="secondary" isLoading={prevLoading} isDisabled={isLocked || prevLoading || prevEntries === null || !growthOk} onClick={fromActuals} />
          </HStack>
          <SupportText>{year - 1}년 회계 장부의 계정별 합계에 증가율을 곱해 천 원 단위로 올립니다. 전년 실적이 없는 계정은 나오지 않습니다.</SupportText>
        </VStack>

        <VStack gap={2}>
          <Text type="label">AI 초안</Text>
          <TextArea
            label="올해 계획 메모 (선택)"
            description="예: 인건비는 최저임금 인상분 반영, 프로그램 비용은 늘릴 계획"
            value={notes}
            onChange={setNotes}
            rows={2}
            maxLength={1000}
            isDisabled={aiLoading}
          />
          <HStack gap={3} vAlign="center" wrap="wrap">
            <Button label="AI 초안" variant="secondary" isLoading={aiLoading} isDisabled={isLocked || aiLoading} onClick={() => void runAi()} />
            <Text type="supporting" color="secondary">
              계정과 전년 실적, 메모만 AI로 보냅니다. 이름·연락처는 메모에 적지 마세요.
            </Text>
          </HStack>
          {prevEntries === null && !prevLoading && <SupportText tone="warn">전년 장부를 불러오지 못해 전년 실적 없이 초안을 만듭니다.</SupportText>}
          {aiError && <ErrorBanner message={aiError} />}
        </VStack>

        {proposals !== null && (
          <BudgetProposals
            key={proposals.id}
            proposals={proposals.list}
            lines={lines}
            isAi={proposals.ai}
            onApply={(picked) => {
              onApply(picked);
              setProposals(null);
            }}
            onDismiss={() => setProposals(null)}
          />
        )}
      </VStack>
    </Card>
  );
}
