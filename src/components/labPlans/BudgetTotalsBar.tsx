'use client';

/** 세입·세출 합계와 차이 — 차이가 있어도 막지 않고, 균형 요구 조항은 대조가 필요하다고 알린다. */
import { Banner } from '@astryxdesign/core/Banner';
import { VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { num } from '@/components/labRecords/FinanceFormat';
import type { BudgetTotals } from '@/lib/lab/budgetRules';
import { signedWon } from './BudgetFormat';
import styles from './labPlans.module.css';

export default function BudgetTotalsBar({ totals, hasLines }: { totals: BudgetTotals; hasLines: boolean }) {
  return (
    <VStack gap={2}>
      <div className={styles.toolbar}>
        <div className={styles.statBox}>
          <Text type="supporting" color="secondary">
            세입 합계
          </Text>
          <Text type="label" hasTabularNumbers>
            {num(totals.income)}원
          </Text>
        </div>
        <div className={styles.statBox}>
          <Text type="supporting" color="secondary">
            세출 합계
          </Text>
          <Text type="label" hasTabularNumbers>
            {num(totals.expense)}원
          </Text>
        </div>
        <div className={styles.statBox}>
          <Text type="supporting" color="secondary">
            차이 (세입 − 세출)
          </Text>
          <span className={hasLines && !totals.balanced ? styles.warnText : undefined}>
            <Text type="label" color="inherit" hasTabularNumbers>
              {signedWon(totals.diff)}
            </Text>
          </span>
        </div>
      </div>
      {hasLines && !totals.balanced && (
        <Banner
          status="warning"
          title="세입과 세출이 같지 않습니다"
          description="세입·세출 균형을 요구하는 조항은 대조 필요합니다(확인하지 못했습니다). 저장은 그대로 할 수 있으니, 관할 기관 기준과 맞는지 확인해 주세요."
        />
      )}
    </VStack>
  );
}
