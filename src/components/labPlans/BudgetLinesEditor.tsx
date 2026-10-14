'use client';

/** 세입·세출 줄 편집 — 계정은 계정표에서 고르고, 금액은 쉼표가 붙는다. 확정된 예산은 잠긴다. */
import { Button } from '@astryxdesign/core/Button';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Chip } from '@/components/lab/LabUi';
import { accountOptions } from '@/components/labRecords/FinanceFormat';
import FinanceMoneyField from '@/components/labRecords/FinanceMoneyField';
import { num } from '@/components/labRecords/FinanceFormat';
import { MAX_BUDGET_AMOUNT, MAX_BUDGET_LINE_NOTE } from '@/lib/lab/budgetRules';
import type { LedgerDirection } from '@/lib/lab/labTypes';
import { DIRECTION_NAME, newLine } from './BudgetDraft';
import type { LineDraft } from './BudgetDraft';
import styles from './labPlans.module.css';

interface Props {
  direction: LedgerDirection;
  lines: LineDraft[];
  /** 전체 줄 중 이 방향의 줄이 아닌 것까지 포함한 전체 목록을 바꾼다 */
  onChange: (lines: LineDraft[]) => void;
  allLines: LineDraft[];
  isLocked: boolean;
  isBusy: boolean;
}

export default function BudgetLinesEditor({ direction, lines, onChange, allLines, isLocked, isBusy }: Props) {
  const name = DIRECTION_NAME[direction];
  const options = accountOptions(direction);
  const disabled = isLocked || isBusy;
  const total = lines.reduce((s, l) => s + (l.amount ?? 0), 0);

  const patch = (key: number, p: Partial<LineDraft>) => onChange(allLines.map((l) => (l.key === key ? { ...l, ...p } : l)));
  const remove = (key: number) => onChange(allLines.filter((l) => l.key !== key));

  return (
    <VStack gap={2}>
      <HStack gap={2} vAlign="center" hAlign="between" wrap="wrap">
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Text type="label">{name} ({lines.length}줄)</Text>
          <Text type="supporting" color="secondary" hasTabularNumbers>
            합계 {num(total)}원
          </Text>
          {isLocked && <Chip tone="ok" label="확정됨 — 잠김" />}
        </HStack>
        <Button label={`${name} 줄 추가`} size="sm" variant="secondary" isDisabled={disabled} onClick={() => onChange([...allLines, newLine(direction)])} />
      </HStack>
      {lines.length === 0 ? (
        <Text type="supporting" color="secondary">
          {name} 줄이 없습니다. ‘{name} 줄 추가’를 누르거나 아래 초안 도구로 채워 보세요.
        </Text>
      ) : (
        <div className={styles.tableScroll}>
          <table className={styles.lineTable}>
            <thead>
              <tr>
                <th scope="col">계정 (관·항·목)</th>
                <th scope="col">금액 (원)</th>
                <th scope="col">비고 (선택)</th>
                <th scope="col">삭제</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.key}>
                  <td className={styles.colAccount}>
                    <Selector
                      label={`${name} 계정`}
                      isLabelHidden
                      placeholder="계정 고르기"
                      hasSearch
                      searchPlaceholder="코드나 이름으로 찾기"
                      options={options}
                      value={l.accountCode === '' ? undefined : l.accountCode}
                      onChange={(v) => patch(l.key, { accountCode: v })}
                      isDisabled={disabled}
                    />
                    {l.accountCode !== '' && lines.filter((x) => x.accountCode === l.accountCode).length > 1 ? (
                      <Text type="supporting" color="secondary">
                        같은 계정이 두 번 있습니다
                      </Text>
                    ) : null}
                  </td>
                  <td className={styles.colAmount}>
                    <FinanceMoneyField label={`${name} 금액`} isLabelHidden value={l.amount} onChange={(v) => patch(l.key, { amount: v })} max={MAX_BUDGET_AMOUNT} placeholder="0" isDisabled={disabled} />
                  </td>
                  <td className={styles.colNote}>
                    <TextInput label={`${name} 비고`} isLabelHidden value={l.note} onChange={(v) => patch(l.key, { note: v.slice(0, MAX_BUDGET_LINE_NOTE) })} isDisabled={disabled} />
                  </td>
                  <td className={styles.colAction}>
                    <Button label="줄 삭제" size="sm" variant="ghost" isDisabled={disabled} onClick={() => remove(l.key)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </VStack>
  );
}
