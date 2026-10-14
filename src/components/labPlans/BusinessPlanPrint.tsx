'use client';

/** 사업계획서 인쇄본(A4 세로) — 기관운영·서비스 제공·직원관리 세 분야 표와 기관 예산(총수입·총지출). 화면에서는 보이지 않는다. */
import { companyNameStored, dotDate, todayString } from '@/components/lab/labFormat';
import { num } from '@/components/labRecords/FinanceFormat';
import { SECTIONS, sectionBudget } from '@/lib/lab/businessPlanRules';
import { plainOf } from './BusinessPlanDraft';
import type { PlanDraft } from './BusinessPlanDraft';
import PlansPrintPortal from './PlansPrintPortal';
import styles from './labPlans.module.css';

interface Props {
  draft: PlanDraft;
  printKey: number;
  onReady: () => void;
}

export default function BusinessPlanPrint({ draft, printKey, onReady }: Props) {
  const company = companyNameStored();
  const sums = sectionBudget(plainOf(draft));
  return (
    <PlansPrintPortal printKey={printKey} onReady={onReady}>
      <h1 className={styles.printTitle}>{draft.year}년 사업계획서</h1>
      <div className={styles.printMeta}>
        <span>기관명: {company || '____________'}</span>
        <span>작성일: {draft.writtenOn ? dotDate(draft.writtenOn) : '____________'}</span>
        <span>작성자: {draft.writerName || '____________'}</span>
      </div>
      {SECTIONS.map(({ value, label }, n) => (
        <div key={value}>
          <p className={styles.printSection}>
            {n + 1}. {label} (예산 합 {num(sums[value])}원)
          </p>
          <table className={styles.sheetTable}>
            <thead>
              <tr>
                <th>세부사업명</th>
                <th>사업목표</th>
                <th>사업내용</th>
                <th>사업대상</th>
                <th>사업예산(원)</th>
                <th>추진일정</th>
              </tr>
            </thead>
            <tbody>
              {draft.sections[value].length === 0 ? (
                <tr>
                  <td colSpan={6}>(작성한 사업 없음)</td>
                </tr>
              ) : (
                draft.sections[value].map((it) => (
                  <tr key={it.key}>
                    <td>{it.name}</td>
                    <td>{it.goal}</td>
                    <td>{it.content}</td>
                    <td>{it.target}</td>
                    <td>{it.budget === null ? '' : num(it.budget)}</td>
                    <td>{it.schedule}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ))}
      <p className={styles.printSection}>4. 기관 예산 수립 내역</p>
      <table className={styles.sheetTable}>
        <tbody>
          <tr>
            <th scope="row">총수입</th>
            <td>{draft.totalIncome === null ? '' : `${num(draft.totalIncome)}원`}</td>
            <th scope="row">총지출</th>
            <td>{draft.totalExpense === null ? '' : `${num(draft.totalExpense)}원`}</td>
          </tr>
        </tbody>
      </table>
      <div className={styles.printSign}>
        <span>출력일: {dotDate(todayString())}</span>
        <span>시설장: ____________ (서명 또는 인)</span>
      </div>
    </PlansPrintPortal>
  );
}
