'use client';

/** 연간 프로그램 계획서 인쇄본 — 신체기능·인지기능·사회적응 세 분야를 A4 세로 한 부로. 작성 전인 분야는 빈칸으로 둔다. */
import type { ProgramPlan } from '@/lib/lab/labTypes';
import { PLAN_CATEGORIES, REQUIRED_FREQUENCY } from '@/lib/lab/programPlanRules';
import { companyNameStored, dotDate, todayString } from '@/components/lab/labFormat';
import RecordsPrintPortal from './RecordsPrint';
import styles from './labRecords.module.css';
import own from './ProgramPlan.module.css';

export interface AnnualSheetData {
  year: number;
  plans: ProgramPlan[];
}

export default function ProgramPlanAnnualSheet({ data }: { data: AnnualSheetData }) {
  const company = companyNameStored();
  return (
    <RecordsPrintPortal>
      <h1 className={styles.printTitle}>{data.year}년 프로그램 연간 계획</h1>
      <div className={styles.printMeta}>{company && <span>기관: {company}</span>}</div>
      {PLAN_CATEGORIES.map(({ value, label }) => {
        const plan = data.plans.find((p) => p.category === value && p.planYear === data.year);
        return (
          <div key={value} className={own.printPlanBlock}>
            <div className={styles.printSection}>
              {label} 프로그램 (기준 {REQUIRED_FREQUENCY[value]})
            </div>
            <table className={styles.sheetTable}>
              <tbody>
                <tr>
                  <th scope="row" className={styles.sheetLabel}>목표</th>
                  <td>{plan?.goal ?? ''}</td>
                </tr>
                <tr>
                  <th scope="row">세부 프로그램·방법</th>
                  <td>{plan?.content ?? ''}</td>
                </tr>
                <tr>
                  <th scope="row">실시 횟수</th>
                  <td>{plan?.frequency ?? ''}</td>
                </tr>
                <tr>
                  <th scope="row">대상</th>
                  <td>{plan?.target ?? ''}</td>
                </tr>
                <tr>
                  <th scope="row">예산</th>
                  <td>{plan?.budget != null ? `${plan.budget.toLocaleString('ko-KR')}원` : ''}</td>
                </tr>
                <tr>
                  <th scope="row">작성일·작성자</th>
                  <td>{plan ? `${dotDate(plan.writtenOn)} · ${plan.writerName}` : ''}</td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      })}
      <div className={styles.printSign}>
        <span>작성자 (서명): ____________</span>
        <span>시설장 (서명): ____________</span>
      </div>
      <p className={styles.printNote}>참고용 출력본입니다. 출력일 {dotDate(todayString())}</p>
    </RecordsPrintPortal>
  );
}
