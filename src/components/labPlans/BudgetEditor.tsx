'use client';

/** 예산 한 건 편집 카드 — 결정일·비고, 세입·세출 줄, 합계와 균형 경고, 저장 전 점검, 저장·확정·확정 풀기·삭제. */
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Chip, ErrorBanner, LabDateInput, SupportText } from '@/components/lab/LabUi';
import { budgetTotals } from '@/lib/lab/budgetRules';
import { MAX_BUDGET_NOTE, draftIssues, fingerprint, plainLines, revisionLabel } from './BudgetDraft';
import type { BudgetDraft } from './BudgetDraft';
import BudgetLinesEditor from './BudgetLinesEditor';
import BudgetTotalsBar from './BudgetTotalsBar';
import styles from './labPlans.module.css';

interface Props {
  draft: BudgetDraft;
  baseline: string;
  onChange: (next: BudgetDraft) => void;
  saving: boolean;
  /** 확정·풀기·삭제 중 */
  working: boolean;
  error: string | null;
  onSave: () => void;
  onConfirm: () => void;
  onUnconfirm: () => void;
  onDelete: () => void;
}

export default function BudgetEditor({ draft, baseline, onChange, saving, working, error, onSave, onConfirm, onUnconfirm, onDelete }: Props) {
  const locked = draft.status === 'CONFIRMED';
  const busy = saving || working;
  const dirty = fingerprint(draft) !== baseline;
  const issues = draftIssues(draft);
  const totals = budgetTotals({ lines: plainLines(draft) });
  const income = draft.lines.filter((l) => l.direction === 'INCOME');
  const expense = draft.lines.filter((l) => l.direction === 'EXPENSE');
  const setLines = (lines: BudgetDraft['lines']) => onChange({ ...draft, lines });

  return (
    <Card padding={4}>
      <VStack gap={3}>
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Text type="label">
            {draft.fiscalYear}년 {revisionLabel(draft.revision)}
          </Text>
          {draft.status === 'CONFIRMED' && <Chip tone="ok" label="확정" />}
          {draft.status === 'DRAFT' && <Chip tone="neutral" label="작성 중" />}
          {draft.id === null && <Chip tone="warn" label="저장 전" />}
          {dirty && draft.id !== null && <Chip tone="warn" label="저장하지 않은 변경" />}
        </HStack>

        <div className={styles.fieldGrid}>
          <LabDateInput label={draft.revision === 0 ? '의결일 (선택)' : '추경 편성일 (선택)'} value={draft.decidedOn} onChange={(v) => onChange({ ...draft, decidedOn: v })} />
          <TextInput label="비고 (선택)" value={draft.note} onChange={(v) => onChange({ ...draft, note: v.slice(0, MAX_BUDGET_NOTE) })} isDisabled={locked || busy} description={`${Array.from(draft.note).length}/${MAX_BUDGET_NOTE}자`} />
        </div>

        <BudgetLinesEditor direction="INCOME" lines={income} allLines={draft.lines} onChange={setLines} isLocked={locked} isBusy={busy} />
        <BudgetLinesEditor direction="EXPENSE" lines={expense} allLines={draft.lines} onChange={setLines} isLocked={locked} isBusy={busy} />
        <BudgetTotalsBar totals={totals} hasLines={draft.lines.length > 0} />

        {!locked && issues.length > 0 && (
          <VStack gap={1}>
            <Text type="label">저장하기 전에 고쳐 주세요</Text>
            {issues.map((m) => (
              <SupportText key={m} tone="warn">
                {m}
              </SupportText>
            ))}
          </VStack>
        )}
        {error && <ErrorBanner message={error} />}

        <HStack gap={2} hAlign="end" wrap="wrap">
          {draft.id !== null && !locked && <Button label="이 예산 삭제" variant="ghost" isDisabled={busy} onClick={onDelete} />}
          {locked ? (
            <Button label="확정 풀기" variant="secondary" isLoading={working} isDisabled={busy} onClick={onUnconfirm} />
          ) : (
            <>
              <Button label="확정" variant="secondary" isLoading={working} isDisabled={busy || draft.id === null || dirty || issues.length > 0} onClick={onConfirm} />
              <Button label="예산 저장" variant="primary" isLoading={saving} isDisabled={busy || issues.length > 0 || (draft.id !== null && !dirty)} onClick={onSave} />
            </>
          )}
        </HStack>
        {!locked && (draft.id === null || dirty) && <SupportText>저장한 뒤에 확정할 수 있습니다. 확정하면 예산이 잠기고, 고치려면 ‘확정 풀기’를 누릅니다.</SupportText>}
      </VStack>
    </Card>
  );
}
