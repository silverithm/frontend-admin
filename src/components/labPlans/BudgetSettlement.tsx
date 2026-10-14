'use client';

/** 결산 보기 — 그 해 수입·지출 실적과 차액, 예산과의 차이. 인쇄(A4)와 CSV 내려받기. */
import { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { SupportText } from '@/components/lab/LabUi';
import { companyNameStored, dotDate, todayString } from '@/components/lab/labFormat';
import { downloadCsv, num } from '@/components/labRecords/FinanceFormat';
import { budgetDeadlines } from '@/lib/lab/budgetRules';
import type { Settlement } from '@/lib/lab/budgetRules';
import { settlementCsv } from './BudgetCsv';
import { accountText, rateText, signedWon } from './BudgetFormat';
import { revisionLabel } from './BudgetDraft';
import PlansPrintPortal from './PlansPrintPortal';
import styles from './labPlans.module.css';

interface Props {
  year: number;
  revision: number | null;
  settlement: Settlement;
  disabled: boolean;
}

export default function BudgetSettlement({ year, revision, settlement, disabled }: Props) {
  const [printKey, setPrintKey] = useState(0);
  const deadlines = budgetDeadlines(year);
  const company = companyNameStored();
  const empty = settlement.rows.length === 0;
  const section = (direction: 'INCOME' | 'EXPENSE', title: string) => {
    const rows = settlement.rows.filter((r) => r.direction === direction);
    return (
      <>
        <p className={styles.printSection}>{title}</p>
        <table className={styles.sheetTable}>
          <thead>
            <tr>
              <th scope="col">계정</th>
              <th scope="col">예산(원)</th>
              <th scope="col">결산 실적(원)</th>
              <th scope="col">예산 − 실적(원)</th>
              <th scope="col">집행률</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5}>없음</td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.accountCode}>
                <td>{accountText(r.direction, r.accountCode)}</td>
                <td>{num(r.budget)}</td>
                <td>{num(r.actual)}</td>
                <td>{num(r.remaining)}</td>
                <td>{rateText(r.rate)}</td>
              </tr>
            ))}
            <tr>
              <th scope="row">합계</th>
              <td>{num(rows.reduce((s, r) => s + r.budget, 0))}</td>
              <td>
                <strong>{num(direction === 'INCOME' ? settlement.incomeActual : settlement.expenseActual)}</strong>
              </td>
              <td colSpan={2} />
            </tr>
          </tbody>
        </table>
      </>
    );
  };

  return (
    <Card padding={4}>
      <VStack gap={3}>
        <div className={styles.toolbar}>
          <Text type="label">{year}년 결산</Text>
          <span className={styles.spacer} />
          <Button label="결산 CSV 내려받기" variant="secondary" isDisabled={disabled || empty} onClick={() => downloadCsv(`결산_${year}.csv`, settlementCsv(settlement))} />
          <Button label="결산 인쇄" variant="primary" isDisabled={disabled || empty} onClick={() => setPrintKey((k) => k + 1)} />
        </div>
        <div className={styles.toolbar}>
          <div className={styles.statBox}>
            <Text type="supporting" color="secondary">
              수입 실적
            </Text>
            <Text type="label" hasTabularNumbers>
              {num(settlement.incomeActual)}원
            </Text>
          </div>
          <div className={styles.statBox}>
            <Text type="supporting" color="secondary">
              지출 실적
            </Text>
            <Text type="label" hasTabularNumbers>
              {num(settlement.expenseActual)}원
            </Text>
          </div>
          <div className={styles.statBox}>
            <Text type="supporting" color="secondary">
              차액 (수입 − 지출)
            </Text>
            <Text type="label" hasTabularNumbers>
              {signedWon(settlement.surplus)}
            </Text>
          </div>
        </div>
        <SupportText>결산은 그 해 회계 장부 전체(연말까지)로 계산합니다. 결산서는 {dotDate(deadlines.settlementDue)}까지 {deadlines.submitTo}에게 제출합니다. 세입결산서·세출결산서 서식과 과목은 대조 필요합니다.</SupportText>
        <HStack gap={2} wrap="wrap">
          <Text type="supporting" color="secondary">
            {empty ? '예산도 장부도 없어 결산할 내용이 없습니다.' : `비교한 예산: ${revision === null ? '없음' : revisionLabel(revision)}`}
          </Text>
        </HStack>
      </VStack>

      <PlansPrintPortal printKey={printKey} onReady={() => window.print()}>
        <h1 className={styles.printTitle}>{year}년 결산</h1>
        <div className={styles.printMeta}>
          {company && <span>기관: {company}</span>}
          <span>비교 예산: {revision === null ? '없음' : revisionLabel(revision)}</span>
          <span>제출처: {deadlines.submitTo}</span>
          <span>제출 기한: {dotDate(deadlines.settlementDue)}</span>
          <span>출력일: {dotDate(todayString())}</span>
        </div>
        <table className={styles.sheetTable}>
          <thead>
            <tr>
              <th scope="col">수입 실적</th>
              <th scope="col">지출 실적</th>
              <th scope="col">차액 (수입 − 지출)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{num(settlement.incomeActual)}원</td>
              <td>{num(settlement.expenseActual)}원</td>
              <td>
                <strong>{signedWon(settlement.surplus)}</strong>
              </td>
            </tr>
          </tbody>
        </table>
        {section('INCOME', '세입')}
        {section('EXPENSE', '세출')}
        <p className={styles.printNote}>이 결산은 케어브이 실험실 회계 장부와 예산으로 만든 참고 자료입니다. 결산서 서식·과목과 제출 기한은 관할 기관 기준을 확인해 맞춰 주세요(대조 필요).</p>
        <div className={styles.printSign}>
          <span>작성자: ____________</span>
          <span>확인(시설장): ____________ (서명)</span>
        </div>
      </PlansPrintPortal>
    </Card>
  );
}
