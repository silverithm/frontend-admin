'use client';

/**
 * 초안 제안 표 — 전년 실적 초안과 AI 초안이 같이 쓴다. 직원이 줄을 고르고 금액을 고친 뒤 "선택한 줄 반영"을 눌러야 예산 줄에 들어간다.
 * 이미 있는 계정이면 현재 금액을 보여 주고 덮어쓴다는 것을 알린다. 반영해도 저장은 아니다.
 */
import { useMemo, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Chip, SupportText } from '@/components/lab/LabUi';
import FinanceMoneyField from '@/components/labRecords/FinanceMoneyField';
import { num } from '@/components/labRecords/FinanceFormat';
import { MAX_BUDGET_AMOUNT } from '@/lib/lab/budgetRules';
import type { LedgerDirection } from '@/lib/lab/labTypes';
import { accountText } from './BudgetFormat';
import type { LineDraft } from './BudgetDraft';
import styles from './labPlans.module.css';

export interface Proposal {
  direction: LedgerDirection;
  accountCode: string;
  amount: number;
  /** 제안 이유(AI) 또는 전년 실적 같은 설명 */
  reason: string;
}

interface Props {
  proposals: Proposal[];
  lines: LineDraft[];
  isAi: boolean;
  /** 고른 제안(금액을 고친 뒤)을 예산 줄에 반영한다 */
  onApply: (picked: Array<{ direction: LedgerDirection; accountCode: string; amount: number }>) => void;
  onDismiss: () => void;
}

const keyOf = (p: { direction: LedgerDirection; accountCode: string }) => `${p.direction}:${p.accountCode}`;

export default function BudgetProposals({ proposals, lines, isAi, onApply, onDismiss }: Props) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(proposals.map(keyOf)));
  const [amounts, setAmounts] = useState<Record<string, number | null>>(() => Object.fromEntries(proposals.map((p) => [keyOf(p), p.amount])));
  const current = useMemo(() => new Map(lines.map((l) => [keyOf(l), l.amount])), [lines]);

  const toggle = (k: string, on: boolean) =>
    setPicked((cur) => {
      const next = new Set(cur);
      if (on) next.add(k);
      else next.delete(k);
      return next;
    });
  const chosen = proposals.filter((p) => picked.has(keyOf(p)));

  return (
    <div className={styles.suggestBox}>
      <VStack gap={2}>
        <HStack gap={2} vAlign="center" wrap="wrap">
          {isAi && <Chip tone="info" label="AI 제안" />}
          <Text type="supporting" color="secondary">
            제안일 뿐 저장되지 않습니다. 반영할 줄을 고르고 금액을 고친 뒤 ‘선택한 줄 반영’을 누르세요. 반영한 뒤에도 ‘예산 저장’을 눌러야 저장됩니다.
          </Text>
        </HStack>
        {proposals.length === 0 ? (
          <Text type="supporting" color="secondary">
            제안할 줄이 없습니다.
          </Text>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">반영</th>
                  <th scope="col">구분·계정</th>
                  <th scope="col">제안 금액 (원)</th>
                  <th scope="col">현재 예산</th>
                  <th scope="col">{isAi ? '이유' : '근거'}</th>
                </tr>
              </thead>
              <tbody>
                {proposals.map((p) => {
                  const k = keyOf(p);
                  const now = current.get(k);
                  return (
                    <tr key={k}>
                      <td>
                        <CheckboxInput label={`${accountText(p.direction, p.accountCode)} 반영`} isLabelHidden value={picked.has(k)} onChange={(on) => toggle(k, on)} />
                      </td>
                      <td className={styles.wrap}>
                        {p.direction === 'INCOME' ? '세입' : '세출'} · {accountText(p.direction, p.accountCode)}
                      </td>
                      <td className={styles.colAmount}>
                        <FinanceMoneyField label="제안 금액" isLabelHidden value={amounts[k] ?? null} onChange={(v) => setAmounts((cur) => ({ ...cur, [k]: v }))} max={MAX_BUDGET_AMOUNT} />
                      </td>
                      <td>{now === undefined ? '없음' : <span className={styles.warnText}>{num(now ?? 0)}원 (덮어씀)</span>}</td>
                      <td className={styles.wrap}>{p.reason}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {isAi && <SupportText>AI가 만든 금액은 근거 없는 추정일 수 있습니다. 전년 실적과 올해 계획에 맞게 직접 확인해 주세요.</SupportText>}
        <HStack gap={2} hAlign="end" wrap="wrap">
          <Button label="제안 닫기" variant="ghost" onClick={onDismiss} />
          <Button
            label={`선택한 줄 반영 (${chosen.length})`}
            variant="primary"
            isDisabled={chosen.length === 0}
            onClick={() => onApply(chosen.map((p) => ({ direction: p.direction, accountCode: p.accountCode, amount: amounts[keyOf(p)] ?? 0 })))}
          />
        </HStack>
      </VStack>
    </div>
  );
}
