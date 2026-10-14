'use client';

/** 예산 대비 집행 — 그 해 장부와 예산을 계정별로 견준다. 월까지 고를 수 있고, 지출이 예산을 넘으면 붉게, 예산에 없는 계정의 실적도 보여 준다. */
import { Card } from '@astryxdesign/core/Card';
import { Selector } from '@astryxdesign/core/Selector';
import { VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Chip, SupportText } from '@/components/lab/LabUi';
import { num } from '@/components/labRecords/FinanceFormat';
import type { BudgetVsActual as Result } from '@/lib/lab/budgetRules';
import { accountText, rateText } from './BudgetFormat';
import styles from './labPlans.module.css';

const MONTH_OPTIONS = [{ value: '0', label: '연말까지(전체)' }, ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}월까지` }))];

interface Props {
  result: Result;
  /** 0이면 연말까지 */
  throughMonth: number;
  onThroughMonth: (month: number) => void;
  loading: boolean;
  ledgerError: string | null;
  hasBudget: boolean;
}

export default function BudgetVsActual({ result, throughMonth, onThroughMonth, loading, ledgerError, hasBudget }: Props) {
  const { rows, totals } = result;
  return (
    <Card padding={4}>
      <VStack gap={3}>
        <div className={styles.toolbar}>
          <Text type="label">예산 대비 집행</Text>
          <span className={styles.spacer} />
          <div style={{ minWidth: 160 }}>
            <Selector placeholder="고르기" label="집행 기준" options={MONTH_OPTIONS} value={String(throughMonth)} onChange={(v) => onThroughMonth(Number(v ?? '0'))} />
          </div>
        </div>
        {ledgerError && <SupportText tone="warn">{ledgerError}</SupportText>}
        {loading ? (
          <Text type="supporting" color="secondary">
            회계 장부를 불러오는 중...
          </Text>
        ) : rows.length === 0 ? (
          <Text type="supporting" color="secondary">
            {hasBudget ? '예산 줄도 장부 실적도 아직 없습니다.' : '예산도 이 해 장부도 없습니다. 예산 줄을 적거나 회계 장부에 기록하면 여기에 나타납니다.'}
          </Text>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">구분</th>
                  <th scope="col">계정</th>
                  <th scope="col" className={styles.num}>
                    예산
                  </th>
                  <th scope="col" className={styles.num}>
                    집행(실적)
                  </th>
                  <th scope="col" className={styles.num}>
                    남은 금액
                  </th>
                  <th scope="col" className={styles.num}>
                    집행률
                  </th>
                  <th scope="col">상태</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const expenseOver = r.over && r.direction === 'EXPENSE';
                  return (
                    <tr key={`${r.direction}:${r.accountCode}`} data-tone={expenseOver ? 'danger' : undefined}>
                      <td>{r.direction === 'INCOME' ? '세입' : '세출'}</td>
                      <td className={styles.wrap}>{accountText(r.direction, r.accountCode)}</td>
                      <td className={styles.num}>{num(r.budget)}</td>
                      <td className={styles.num}>{num(r.actual)}</td>
                      <td className={styles.num}>{num(r.remaining)}</td>
                      <td className={styles.num}>
                        {rateText(r.rate)}
                        {r.rate !== null && (
                          <div className={styles.meter}>
                            <div className={styles.meterFill} data-over={expenseOver} style={{ width: `${Math.min(r.rate, 100)}%` }} />
                          </div>
                        )}
                      </td>
                      <td>
                        {r.budget === 0 && r.actual > 0 ? (
                          <Chip tone="warn" label="예산에 없는 계정" />
                        ) : expenseOver ? (
                          <Chip tone="danger" label="예산 초과" />
                        ) : r.over ? (
                          <Chip tone="ok" label="목표 초과 달성" />
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
                <tr>
                  <th scope="row" colSpan={2}>
                    세입 합계
                  </th>
                  <td className={styles.num}>{num(totals.income.budget)}</td>
                  <td className={styles.num}>{num(totals.income.actual)}</td>
                  <td className={styles.num}>{num(totals.income.budget - totals.income.actual)}</td>
                  <td colSpan={2} />
                </tr>
                <tr>
                  <th scope="row" colSpan={2}>
                    세출 합계
                  </th>
                  <td className={styles.num}>{num(totals.expense.budget)}</td>
                  <td className={styles.num}>{num(totals.expense.actual)}</td>
                  <td className={styles.num}>{num(totals.expense.budget - totals.expense.actual)}</td>
                  <td colSpan={2} />
                </tr>
              </tbody>
            </table>
          </div>
        )}
        <SupportText>집행은 회계 장부의 같은 방향·같은 계정 코드 합계입니다. 예산에 없는 계정에 쓴 돈도 ‘예산에 없는 계정’으로 보여 줍니다.</SupportText>
      </VStack>
    </Card>
  );
}
