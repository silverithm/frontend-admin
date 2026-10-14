'use client';

/** 급여 만족도 결과 인쇄본(A4 세로) — 기간·종류·문항별 평균·전체 평균·식사 반기 현황·의견 주제(AI로 묶은 경우)·의견 원문. 어르신 이름은 넣지 않는다. */
import type { SatisfactionKind, SurveySummaryAiResult } from '@/lib/lab/labTypes';
import type { MealSurveyHalfStatus, SurveySummary } from '@/lib/lab/satisfactionRules';
import { SATISFACTION_KINDS, SURVEY_QUESTIONS, SURVEY_SOURCE_NOTE } from '@/lib/lab/satisfactionRules';
import { companyNameStored, dotDate, todayString } from '@/components/lab/labFormat';
import RecordsPrintPortal from './RecordsPrint';
import styles from './labRecords.module.css';
import own from './Satisfaction.module.css';

export interface SatisfactionSheetData {
  kind: SatisfactionKind;
  from: string;
  to: string;
  summary: SurveySummary;
  comments: string[];
  meal: { year: number; status: MealSurveyHalfStatus };
  themes: SurveySummaryAiResult | null;
}

export default function SatisfactionSheet({ data }: { data: SatisfactionSheetData }) {
  const company = companyNameStored();
  const kindLabel = SATISFACTION_KINDS.find((k) => k.value === data.kind)?.label ?? '';
  return (
    <RecordsPrintPortal>
      <h1 className={styles.printTitle}>급여 만족도 조사 결과 — {kindLabel}</h1>
      <div className={styles.printMeta}>
        {company && <span>기관: {company}</span>}
        <span>
          조사 기간: {dotDate(data.from)} ~ {dotDate(data.to)}
        </span>
        <span>응답 {data.summary.count}건</span>
        <span>전체 평균 {data.summary.overall === null ? '-' : `${data.summary.overall.toFixed(1)}점`}</span>
      </div>
      <table className={own.printTable}>
        <thead>
          <tr>
            <th scope="col">문항</th>
            <th scope="col">응답 수</th>
            <th scope="col">평균(5점)</th>
          </tr>
        </thead>
        <tbody>
          {data.summary.byQuestion.map((row) => (
            <tr key={row.code}>
              <td>
                {SURVEY_QUESTIONS[data.kind].find((q) => q.code === row.code)?.text ?? row.code}
                {data.summary.lowQuestions.includes(row.code) ? ' (낮음)' : ''}
              </td>
              <td className={own.printNum}>{row.n}</td>
              <td className={own.printNum}>{row.avg === null ? '-' : row.avg.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className={styles.printSection}>{data.meal.year}년 식사 만족도 반기 조사</div>
      <p>
        상반기 {data.meal.status.h1}건 · 하반기 {data.meal.status.h2}건
      </p>
      {data.themes && data.themes.themes.length > 0 && (
        <>
          <div className={styles.printSection}>의견 주제 (AI로 묶은 초안)</div>
          <ul>
            {data.themes.themes.map((t) => (
              <li key={t.theme}>
                {t.theme} ({t.count}건){t.example ? ` — 예: ${t.example}` : ''}
              </li>
            ))}
          </ul>
        </>
      )}
      {data.comments.length > 0 && (
        <>
          <div className={styles.printSection}>의견 ({data.comments.length}건)</div>
          <ol>
            {data.comments.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ol>
        </>
      )}
      <div className={styles.printSign}>
        <span>담당자 (서명): ____________</span>
        <span>시설장 (서명): ____________</span>
      </div>
      <p className={styles.printNote}>
        {SURVEY_SOURCE_NOTE} 출력일 {dotDate(todayString())}
      </p>
    </RecordsPrintPortal>
  );
}
