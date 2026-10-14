'use client';

/** 퇴직금 추계표 인쇄본(A4 세로) — 기준일, 직원별 추계, 기관 합계, 장부 세출 115 비교, 대조 필요 안내. 화면에서는 보이지 않는다. */
import { companyNameStored, dotDate, todayString } from '@/components/lab/labFormat';
import { num } from '@/components/labRecords/FinanceFormat';
import { SEVERANCE_VERIFY_NOTES } from '@/lib/lab/severanceRules';
import { shortReason } from './SeveranceFormat';
import type { SeveranceRow } from './SeveranceFormat';
import PlansPrintPortal from './PlansPrintPortal';
import styles from './labPlans.module.css';

interface Props {
  rows: SeveranceRow[];
  total: number;
  asOf: string;
  year: number;
  ledgerTotal: number | null;
  printKey: number;
  onReady: () => void;
}

export default function SeverancePrint({ rows, total, asOf, year, ledgerTotal, printKey, onReady }: Props) {
  const company = companyNameStored();
  return (
    <PlansPrintPortal printKey={printKey} onReady={onReady}>
      <h1 className={styles.printTitle}>퇴직금 추계표</h1>
      <div className={styles.printMeta}>
        <span>기관명: {company || '____________'}</span>
        <span>기준일(퇴직일 가정): {dotDate(asOf)}</span>
      </div>
      <table className={styles.sheetTable}>
        <thead>
          <tr>
            <th>직원</th>
            <th>입사일</th>
            <th>대상</th>
            <th>근속일</th>
            <th>평균임금(1일)</th>
            <th>통상임금(1일)</th>
            <th>적용 1일 임금</th>
            <th>추계액(원)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.profile.memberId}>
              <td>{r.name}</td>
              <td>{dotDate(r.profile.hireDate)}</td>
              <td>{r.estimate.eligible ? '대상' : `아님${shortReason(r.estimate, r.profile.weeklyHours) ? ` (${shortReason(r.estimate, r.profile.weeklyHours)})` : ''}`}</td>
              <td>{num(r.estimate.serviceDays)}</td>
              <td>{r.estimate.avgDailyWage > 0 ? num(r.estimate.avgDailyWage) : '-'}</td>
              <td>{num(r.estimate.ordinaryDailyWage)}</td>
              <td>{num(r.estimate.dailyWageUsed)}</td>
              <td>{num(r.estimate.eligible ? r.estimate.amount : 0)}</td>
            </tr>
          ))}
          <tr>
            <th colSpan={7}>기관 추계 합계</th>
            <th>{num(total)}</th>
          </tr>
        </tbody>
      </table>
      <p className={styles.printSection}>회계 장부 세출 115 (퇴직금 및 퇴직적립금) {year}년 실적</p>
      <p>{ledgerTotal === null ? '장부를 읽지 못해 비교하지 못했습니다.' : `${num(ledgerTotal)}원 (추계 합계와의 차이 ${ledgerTotal - total >= 0 ? '+' : '-'}${num(Math.abs(ledgerTotal - total))}원)`}</p>
      <p className={styles.printNote}>{SEVERANCE_VERIFY_NOTES.join(' / ')}</p>
      <div className={styles.printSign}>
        <span>출력일: {dotDate(todayString())}</span>
        <span>시설장: ____________ (서명 또는 인)</span>
      </div>
    </PlansPrintPortal>
  );
}
