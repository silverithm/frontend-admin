/**
 * 급여 만족도 문항·요약·식사 만족도 반기 현황.
 *
 * 근거(research-7.md 2절)
 *  - 2026판 평가에는 공단 유선 '서비스 만족도 조사'(2025판 47)가 삭제되고, 평가일 수급자 면담으로 식사·프로그램·이동서비스 만족을 묻는
 *    '36 급여 만족도'(기준 ① 식사: 양·맛·식사시간, ② 프로그램: 강사·시간·내용, ③ 이동서비스: 소요시간·승하차 시간 변경 안내·편안함)가 신설됐다.
 *  - 기관 자체 만족도 조사 주기·문항 서식은 공단이 제시하지 않는다(대조 필요). 아래 문항은 우리가 만든 문장이고 5점 척도(1 매우 불만 ~ 5 매우 만족)다.
 *  - 식사 33 기준②: 모든 수급자 대상 식사 만족도를 반기별 1회 이상 파악한다.
 *
 * 평균은 정수 연산으로 소수 첫째 자리에서 반올림한다(부동소수 오차 방지).
 */
import type { SatisfactionKind, SatisfactionResponse } from './labTypes.ts';
import { halfOfDate } from './programPlanRules.ts';

export const SURVEY_SOURCE_NOTE = '공단이 제시한 문항은 없습니다. 아래 문항은 2026 평가 36(급여 만족도 면담)의 확인 내용을 바탕으로 우리가 만든 문장이며 5점 척도입니다.';

export const SATISFACTION_KINDS: ReadonlyArray<{ value: SatisfactionKind; label: string }> = [
  { value: 'MEAL', label: '식사' },
  { value: 'PROGRAM', label: '프로그램' },
  { value: 'TRANSPORT', label: '이동서비스' },
  { value: 'GENERAL', label: '전반' },
];

export const SCORE_LABELS: Readonly<Record<number, string>> = { 1: '매우 불만', 2: '불만', 3: '보통', 4: '만족', 5: '매우 만족' };
export const MAX_SCORES = 20;
export const MAX_SATISFACTION_COMMENT = 1000;
export const LOW_SCORE_LIMIT = 3;

export function satisfactionKindLabel(kind: string): string {
  return SATISFACTION_KINDS.find((k) => k.value === kind)?.label ?? kind;
}

export interface SurveyQuestion {
  /** ^[A-Z0-9_]{2,30}$ — 전체에서 유일 */
  code: string;
  text: string;
}

export const SURVEY_QUESTIONS: Record<SatisfactionKind, SurveyQuestion[]> = {
  MEAL: [
    { code: 'MEAL_AMOUNT', text: '식사의 양은 알맞았나요?' },
    { code: 'MEAL_TASTE', text: '음식의 맛과 간은 입에 맞았나요?' },
    { code: 'MEAL_TIME', text: '식사 시간은 적당했나요?' },
    { code: 'MEAL_FORM', text: '식사 형태(밥·죽, 반찬 크기)는 드시기에 알맞았나요?' },
    { code: 'MEAL_HELP', text: '식사할 때 도움이 필요하면 바로 받으셨나요?' },
  ],
  PROGRAM: [
    { code: 'PROGRAM_CONTENT', text: '프로그램 내용은 재미있고 도움이 되었나요?' },
    { code: 'PROGRAM_INSTRUCTOR', text: '프로그램을 진행하는 선생님(강사)은 만족스러웠나요?' },
    { code: 'PROGRAM_TIME', text: '프로그램 시간(길이·시각)은 알맞았나요?' },
    { code: 'PROGRAM_JOIN', text: '하고 싶은 프로그램에 참여할 수 있었나요?' },
  ],
  TRANSPORT: [
    { code: 'TRANSPORT_DURATION', text: '차량을 타고 오가는 데 걸리는 시간은 적당했나요?' },
    { code: 'TRANSPORT_NOTICE', text: '승·하차 시간이 바뀔 때 미리 안내를 받으셨나요?' },
    { code: 'TRANSPORT_COMFORT', text: '차량 이용은 편안했나요?' },
    { code: 'TRANSPORT_HELP', text: '타고 내릴 때 직원의 도움은 충분했나요?' },
  ],
  GENERAL: [
    { code: 'GENERAL_STAFF', text: '직원들은 친절하고 존중해 주었나요?' },
    { code: 'GENERAL_ENV', text: '센터 환경(청결·온도·쉴 공간)은 만족스러웠나요?' },
    { code: 'GENERAL_SAFETY', text: '센터에서 안전하다고 느끼셨나요?' },
    { code: 'GENERAL_OVERALL', text: '센터 이용에 전반적으로 만족하시나요?' },
  ],
};

/** 문항 코드로 문항 찾기(없으면 undefined) */
export function questionByCode(code: string): (SurveyQuestion & { kind: SatisfactionKind }) | undefined {
  for (const kind of Object.keys(SURVEY_QUESTIONS) as SatisfactionKind[]) {
    const q = SURVEY_QUESTIONS[kind].find((x) => x.code === code);
    if (q) return { ...q, kind };
  }
  return undefined;
}

export type SatisfactionLike = Pick<SatisfactionResponse, 'kind' | 'surveyDate' | 'scores'> & Partial<Pick<SatisfactionResponse, 'elderlyId'>>;

function validScore(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5;
}

/** sum/n을 소수 첫째 자리에서 반올림(정수 연산) */
function averageOf(sum: number, n: number): number | null {
  if (n === 0) return null;
  return Math.floor((20 * sum + n) / (2 * n)) / 10;
}

export interface QuestionSummary {
  code: string;
  avg: number | null;
  n: number;
}

export interface SurveySummary {
  count: number;
  byQuestion: QuestionSummary[];
  overall: number | null;
  /** 평균이 3.0 미만인 문항 코드 — 반올림 전 값으로 가른다(2.96은 낮은 문항) */
  lowQuestions: string[];
}

/** 한 종류의 응답 요약. 그 종류 문항에 없는 코드·1~5가 아닌 점수는 세지 않는다. */
export function surveySummary(responses: ReadonlyArray<SatisfactionLike>, kind: SatisfactionKind): SurveySummary {
  const mine = responses.filter((r) => r?.kind === kind);
  const questions = SURVEY_QUESTIONS[kind] ?? [];
  let allSum = 0;
  let allN = 0;
  const lowQuestions: string[] = [];
  const byQuestion: QuestionSummary[] = questions.map((q) => {
    let sum = 0;
    let n = 0;
    for (const r of mine) {
      const score = r.scores?.[q.code];
      if (validScore(score)) {
        sum += score;
        n += 1;
      }
    }
    allSum += sum;
    allN += n;
    if (n > 0 && sum < LOW_SCORE_LIMIT * n) lowQuestions.push(q.code);
    return { code: q.code, avg: averageOf(sum, n), n };
  });
  return { count: mine.length, byQuestion, overall: averageOf(allSum, allN), lowQuestions };
}

export interface MealSurveyHalfStatus {
  h1: number;
  h2: number;
  met: { h1: boolean; h2: boolean };
}

/** 그 해 식사(MEAL) 응답 수를 반기별로 센다. 반기마다 1건 이상이면 충족(전체 수급자를 다 했는지는 mealSurveyCoverage). */
export function mealSurveyHalfStatus(responses: ReadonlyArray<Pick<SatisfactionResponse, 'kind' | 'surveyDate'>>, year: number): MealSurveyHalfStatus {
  const y = String(year).padStart(4, '0');
  let h1 = 0;
  let h2 = 0;
  for (const r of responses) {
    if (r?.kind !== 'MEAL') continue;
    const half = halfOfDate(r.surveyDate);
    if (half === `${y}-H1`) h1 += 1;
    else if (half === `${y}-H2`) h2 += 1;
  }
  return { h1, h2, met: { h1: h1 > 0, h2: h2 > 0 } };
}

export interface MealSurveyCoverage {
  h1: { done: number; total: number; missing: number[] };
  h2: { done: number; total: number; missing: number[] };
}

/**
 * 식사 33 기준②는 모든 수급자를 반기마다 파악하라고 한다. elderIds(조사 대상 어르신) 중 그 반기에 식사 응답이 있는 사람 수와 빠진 사람.
 * 익명 응답(elderlyId 없음)은 누구의 것인지 알 수 없어 세지 않는다.
 */
export function mealSurveyCoverage(responses: ReadonlyArray<Pick<SatisfactionResponse, 'kind' | 'surveyDate'> & Partial<Pick<SatisfactionResponse, 'elderlyId'>>>, year: number, elderIds: ReadonlyArray<number>): MealSurveyCoverage {
  const y = String(year).padStart(4, '0');
  const seen: Record<'H1' | 'H2', Set<number>> = { H1: new Set(), H2: new Set() };
  for (const r of responses) {
    if (r?.kind !== 'MEAL' || typeof r.elderlyId !== 'number') continue;
    const half = halfOfDate(r.surveyDate);
    if (half === `${y}-H1`) seen.H1.add(r.elderlyId);
    else if (half === `${y}-H2`) seen.H2.add(r.elderlyId);
  }
  const ids = [...new Set(elderIds)];
  const build = (key: 'H1' | 'H2') => {
    const missing = ids.filter((id) => !seen[key].has(id));
    return { done: ids.length - missing.length, total: ids.length, missing };
  };
  return { h1: build('H1'), h2: build('H2') };
}
