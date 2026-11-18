/**
 * 2026년 방문요양 급여비용(수가) — /ltc/home-care-fee-2026 페이지의 원장.
 *
 * 금액 하나가 틀리면 상담·청구를 잘못 안내하게 된다. 값을 고칠 때는 반드시 아래 원문을 다시 열어 대조한다.
 * - 「장기요양급여 제공기준 및 급여비용 산정방법 등에 관한 고시」(보건복지부고시 제2026-189호, 2026.10.1. 시행)
 *   제18조(방문요양 급여비용)의 표는 국가법령정보센터 본문에 그림(GIF, flSeq=169768523)으로만 실려 있다.
 *   2026-11-18에 그림을 내려받아 확대해 칸마다 읽고, 국민건강보험공단 건강Law에 올라 있는 제2025-247호
 *   (2025.12.30. 발령, 2026.1.1. 시행) 개정전문 PDF의 같은 표(글자)와 여덟 칸 모두 일치함을 확인했다.
 * - 산정 규칙: 제17조(제공기준·5등급 제한), 제19조(1일 3회·2시간 간격·가-7/가-8), 제19조의2(1·2등급 중증 가산),
 *   제20조(심야·일요일·유급휴일 가산), 제23조(가족인 요양보호사), 제36조의2·제36조의3(종일 방문요양), 제2조제3항(인지지원등급).
 * - 월 한도액: 같은 고시 제13조제1항(그림 flSeq=169768521, 개정전문 PDF와 일치) — ltc2026.MONTHLY_LIMIT_2026.
 *   월 한도액에 들어가지 않는 비용: 제13조제2항(원거리교통비용, 중증 수급자 가산 등). 초과분 전액 본인 부담: 제13조제6항.
 * - 본인부담률: 노인장기요양보험법 시행령 제15조의8제1호(재가급여 100분의 15).
 *
 * 금액은 원 단위 정수로 셈한다. 비율은 정수 퍼센트로 들고 있다가 /100 한다(0.15를 곱하면 부동소수 오차가 난다).
 */

import { MONTHLY_LIMIT_2026, type CareGrade } from './ltc2026.ts';

/** 원문을 마지막으로 대조한 날. 페이지의 "원문 대조"와 구조화 데이터 dateModified로 쓴다. */
export const HOME_CARE_VERIFIED_AT = '2026-11-18';

export type HomeCareCode = '가-1' | '가-2' | '가-3' | '가-4' | '가-5' | '가-6' | '가-7' | '가-8';

export interface HomeCareFeeRow {
  code: HomeCareCode;
  /** 표의 '분류' — "N분 이상" */
  minutes: number;
  /** 1회 방문당 금액(원) */
  fee: number;
}

/** 방문요양 1회 방문당 급여비용 — 고시 제18조 표 (분류번호 가-1~가-8). 원문 순서 그대로. */
export const HOME_CARE_FEES_2026: ReadonlyArray<HomeCareFeeRow> = [
  { code: '가-1', minutes: 30, fee: 17450 },
  { code: '가-2', minutes: 60, fee: 25320 },
  { code: '가-3', minutes: 90, fee: 34120 },
  { code: '가-4', minutes: 120, fee: 43430 },
  { code: '가-5', minutes: 150, fee: 50640 },
  { code: '가-6', minutes: 180, fee: 57020 },
  { code: '가-7', minutes: 210, fee: 63530 },
  { code: '가-8', minutes: 240, fee: 70080 },
];

export function homeCareFee(code: HomeCareCode): number {
  const row = HOME_CARE_FEES_2026.find((r) => r.code === code);
  if (!row) throw new RangeError(`없는 분류번호: ${code}`);
  return row.fee;
}

/**
 * 1회 급여제공시간(분)이 들어가는 표의 행 — "N분 이상" 중 가장 큰 N. 30분 미만은 표에 없어 null.
 * 등급별 제한(가-7·가-8은 1·2등급, 제19조②)과 270분 이상 분할 산정(제19조⑤)은 여기서 따지지 않는다.
 */
export function rowForMinutes(minutes: number): HomeCareFeeRow | null {
  let found: HomeCareFeeRow | null = null;
  for (const row of HOME_CARE_FEES_2026) {
    if (minutes >= row.minutes) found = row;
  }
  return found;
}

/** 제19조제1항 — 식사도움·외출 동행 등이 필요하면 가-1~가-6을 1일 3회까지, 방문 간격 2시간 이상. */
export const MAX_VISITS_PER_DAY = 3;
export const MIN_VISIT_GAP_HOURS = 2;

/** 제19조의2제1항 — 1·2등급 중증 수급자 가산(원). 1회 급여제공시간 구간별. */
export const SEVERE_ADD_ON_BANDS: ReadonlyArray<{ fromMinutes: number; toMinutes: number | null; won: number }> = [
  { fromMinutes: 60, toMinutes: 120, won: 2000 },
  { fromMinutes: 120, toMinutes: 180, won: 4000 },
  { fromMinutes: 180, toMinutes: null, won: 6000 },
];

/** 제19조의2제1항 후단 — 가산 비용은 수급자 1인당 1일 6,000원을 넘을 수 없다. */
export const SEVERE_ADD_ON_DAILY_CAP = 6000;

/** 1회 방문의 중증 가산(원). 60분 미만은 0. 1·2등급만 해당한다(호출하는 쪽에서 등급을 거른다). */
export function severeAddOnPerVisit(minutes: number): number {
  for (const band of SEVERE_ADD_ON_BANDS) {
    if (minutes >= band.fromMinutes && (band.toMinutes === null || minutes < band.toMinutes)) return band.won;
  }
  return 0;
}

/** 하루 방문들의 중증 가산 합(원) — 1일 6,000원 상한 적용. */
export function severeAddOnPerDay(visitMinutes: ReadonlyArray<number>): number {
  const sum = visitMinutes.reduce((acc, m) => acc + severeAddOnPerVisit(m), 0);
  return Math.min(SEVERE_ADD_ON_DAILY_CAP, sum);
}

/** 제20조제1항 — 시간·날짜 가산(제18조 표 금액 기준 %). 동시에 해당해도 중복하지 않는다. 제1호는 삭제. */
export const TIME_SURCHARGES: ReadonlyArray<{ when: string; percent: number; basis: string; note?: string }> = [
  { when: '22시 이후 06시 이전', percent: 30, basis: '제20조제1항제2호', note: '인지활동형 방문요양은 가산하지 않음' },
  { when: '일요일', percent: 30, basis: '제20조제1항제3호' },
  {
    when: '유급휴일(근로기준법 제55조제2항 본문)·근로자의 날',
    percent: 50,
    basis: '제20조제1항제4호',
    note: '일요일과 겹치면 50%',
  },
];

/** 제23조 — 가족인 요양보호사. */
export const FAMILY_CAREGIVER = {
  /** ④ 1일 60분 이상 제공해도 가-2 */
  code: '가-2' as HomeCareCode,
  /** ⑤ 1일 1회, 매월 20일 범위 */
  daysPerMonth: 20,
  /** ⑥ 65세 이상 배우자, 문제행동이 있는 치매 수급자 — 가-3, 월 20일 초과 가능 */
  exceptionCode: '가-3' as HomeCareCode,
  /** ③ 다른 직장 근무시간 합이 월 160시간 이상이면 산정하지 않음 */
  otherJobHours: 160,
} as const;

/** 제36조의2·제36조의3 — 종일 방문요양(장기요양 가족휴가제). */
export const ALL_DAY_HOME_CARE = {
  /** 연간 12일 이내, 월 한도액과 관계없이 */
  daysPerYear: 12,
  /** 1회당 12시간, 2회 이용 = 1일 */
  hoursPerVisit: 12,
  /** 제36조의3제2항제1호 — 1회당 기본 급여비용 */
  baseWon: 98860,
  /** 제2호 — 1회 제공당 가산금, 수급자 부담 없음 */
  extraWon: 78820,
  /** 제3호 — 같은 가정의 수급자 2명을 요양보호사 1명이 돌보면 각 80% */
  twoRecipientsPercent: 80,
} as const;

/** 재가급여 본인부담률(%) — 시행령 제15조의8제1호 */
export const HOME_CARE_COPAY_PERCENT = 15;

/** 방문요양 표가 쓰이는 등급(1~4). 5등급·인지지원등급은 원칙적으로 일반 방문요양을 받지 못한다(제17조⑦, 제2조③). */
export const HOME_CARE_GRADES: ReadonlyArray<Extract<CareGrade, '1' | '2' | '3' | '4'>> = ['1', '2', '3', '4'];

/** 가-7·가-8은 1·2등급만 산정한다(제19조②). 3·4등급의 예외(제19조④⑤ 월 4일)는 표에서 따로 적는다. */
export function codeAllowedForGrade(code: HomeCareCode, grade: CareGrade): boolean {
  if (code === '가-7' || code === '가-8') return grade === '1' || grade === '2';
  return grade === '1' || grade === '2' || grade === '3' || grade === '4';
}

/**
 * 월 한도액을 1회 금액으로 나눈 횟수(소수점 버림) — 가산·다른 재가급여·추가 산정 없이 같은 시간으로만 받을 때.
 * 1일 산정 횟수 제한(가-1~가-6 1일 3회, 가-7·가-8 1일 1회)과 그 달 날수는 따지지 않으므로 페이지에서 함께 밝힌다.
 */
export function visitsWithinLimit(grade: CareGrade, code: HomeCareCode): number | null {
  if (!codeAllowedForGrade(code, grade)) return null;
  return Math.floor(MONTHLY_LIMIT_2026[grade] / homeCareFee(code));
}

export interface HomeCareMonth {
  totalFee: number;
  limit: number;
  /** 월 한도액 안 금액 */
  coveredFee: number;
  /** 한도를 넘어 수급자가 전부 내는 금액(제13조제6항) */
  overLimit: number;
  /** 한도 안 금액의 15%(원 미만 버림) */
  copayWithinLimit: number;
  insurerShare: number;
  totalCopay: number;
}

/** 같은 분류로 한 달 n회 받을 때의 급여비용·본인부담금. 가산·추가 산정·다른 재가급여는 넣지 않는다. */
export function homeCareMonth(grade: CareGrade, code: HomeCareCode, visits: number): HomeCareMonth {
  if (!Number.isInteger(visits) || visits < 0) throw new RangeError(`횟수는 0 이상의 정수여야 한다: ${visits}`);
  const totalFee = homeCareFee(code) * visits;
  const limit = MONTHLY_LIMIT_2026[grade];
  const coveredFee = Math.min(totalFee, limit);
  const overLimit = totalFee - coveredFee;
  const copayWithinLimit = Math.floor((coveredFee * HOME_CARE_COPAY_PERCENT) / 100);
  return {
    totalFee,
    limit,
    coveredFee,
    overLimit,
    copayWithinLimit,
    insurerShare: coveredFee - copayWithinLimit,
    totalCopay: copayWithinLimit + overLimit,
  };
}

/** 원문 출처. 페이지 하단 출처 목록과 구조화 데이터 isBasedOn이 같은 값을 쓴다. */
export const HOME_CARE_SOURCES: ReadonlyArray<{ name: string; url: string }> = [
  {
    name: '장기요양급여 제공기준 및 급여비용 산정방법 등에 관한 고시 (보건복지부고시 제2026-189호, 2026.10.1. 시행) 제2조·제13조~제23조·제36조의2·제36조의3',
    url: 'https://www.law.go.kr/행정규칙/장기요양급여제공기준및급여비용산정방법등에관한고시',
  },
  {
    name: '국민건강보험공단 건강Law — 같은 고시 제2025-247호(2026.1.1. 시행) 개정전문(제18조 표 대조)',
    url: 'https://www.nhis.or.kr/lm/lmxsrv/law/lawDetail.do?SEQ=1637',
  },
  {
    name: '노인장기요양보험법 시행령 제15조의8(본인부담금)',
    url: 'https://www.law.go.kr/법령/노인장기요양보험법시행령/제15조의8',
  },
  {
    name: '노인장기요양보험법 제40조(본인부담금)',
    url: 'https://www.law.go.kr/법령/노인장기요양보험법/제40조',
  },
];
