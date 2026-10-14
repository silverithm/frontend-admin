'use client';

/** 기관 예산 총수입·총지출 칸, 예산·결산(5차)에서 가져오기, 사업계획 총지출과 예산 세출 합의 차이. */
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { ErrorBanner, NumField, SupportText } from '@/components/lab/LabUi';
import { num } from '@/components/labRecords/FinanceFormat';
import { MAX_PLAN_TOTAL } from '@/lib/lab/businessPlanRules';
import type { BudgetGap, SectionBudget } from '@/lib/lab/businessPlanRules';
import { revisionLabel } from './BudgetDraft';
import styles from './labPlans.module.css';

interface Props {
  totalIncome: number | null;
  totalExpense: number | null;
  onIncome: (v: number | null) => void;
  onExpense: (v: number | null) => void;
  sums: SectionBudget;
  gap: BudgetGap | null;
  /** 가져온 예산 차수(없으면 null) */
  importedRevision: number | null;
  noBudget: boolean;
  importing: boolean;
  importError: string | null;
  disabled: boolean;
  onImport: () => void;
}

export default function BusinessPlanTotals({ totalIncome, totalExpense, onIncome, onExpense, sums, gap, importedRevision, noBudget, importing, importError, disabled, onImport }: Props) {
  return (
    <Card padding={4}>
      <VStack gap={3}>
        <HStack gap={2} vAlign="center" hAlign="between" wrap="wrap">
          <Text type="label">기관 예산 (총수입·총지출)</Text>
          <Button label="예산·결산에서 가져오기" size="sm" variant="secondary" isLoading={importing} isDisabled={disabled || importing} onClick={onImport} />
        </HStack>
        <div className={styles.fieldGrid}>
          <NumField label="총수입 (원)" value={totalIncome} onChange={onIncome} max={MAX_PLAN_TOTAL} isDisabled={disabled} placeholder="예: 350,000,000" />
          <NumField label="총지출 (원)" value={totalExpense} onChange={onExpense} max={MAX_PLAN_TOTAL} isDisabled={disabled} placeholder="예: 350,000,000" />
        </div>
        {importError && <ErrorBanner message={importError} />}
        {noBudget && <SupportText tone="warn">이 연도의 예산·결산(예산)이 없습니다. 먼저 ‘예산·결산’에서 예산을 만들거나 총수입·총지출을 직접 적어 주세요.</SupportText>}
        {importedRevision !== null && <SupportText>{revisionLabel(importedRevision)}의 세입 합계·세출 합계를 가져왔습니다. 고쳐도 됩니다.</SupportText>}

        <div className={styles.toolbar}>
          {(
            [
              ['기관운영 사업예산', sums.operation],
              ['서비스 제공 사업예산', sums.service],
              ['직원관리 사업예산', sums.staff],
              ['사업예산 합계', sums.total],
            ] as const
          ).map(([name, value]) => (
            <div key={name} className={styles.statBox}>
              <Text type="supporting" color="secondary">
                {name}
              </Text>
              <Text type="label" hasTabularNumbers>
                {num(value)}원
              </Text>
            </div>
          ))}
        </div>

        {gap ? (
          <SupportText tone={gap.diff === 0 ? undefined : 'warn'}>
            {gap.diff === 0
              ? `사업계획 총지출이 예산의 세출 합계(${num(gap.budgetExpense)}원)와 같습니다.`
              : `사업계획 총지출 ${num(gap.planExpense)}원은 예산의 세출 합계 ${num(gap.budgetExpense)}원보다 ${num(Math.abs(gap.diff))}원 ${gap.diff > 0 ? '많습니다' : '적습니다'}. 예산이 바뀌었다면 맞춰 주세요.`}
          </SupportText>
        ) : (
          <SupportText>예산·결산에서 가져오면 사업계획 총지출과 예산 세출 합계의 차이를 보여 줍니다.</SupportText>
        )}
        <SupportText>사업예산 합계와 총지출이 꼭 같아야 하는 것은 아닙니다(예산이 없는 사업도 있고, 인건비·운영비는 사업이 아닐 수 있습니다). 차이가 큰 이유를 직원이 확인해 주세요.</SupportText>
      </VStack>
    </Card>
  );
}
