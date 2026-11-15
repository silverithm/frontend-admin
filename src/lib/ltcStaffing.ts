/**
 * 주·야간보호(주간보호센터) 인력배치기준 — /ltc/daycare-staffing-standard 페이지의 원장.
 *
 * 숫자 하나가 틀리면 페이지 전체의 신뢰가 무너진다. 값을 고칠 때는 반드시 아래 원문을 다시 열어 대조한다.
 * - 직종별 인원: 「노인복지법 시행규칙」 별표 9(재가노인복지시설의 시설기준 및 직원배치기준) 제4호 가목 표
 *   (별표 마지막 개정 2021.6.30., 시행규칙 현행 2025.12.29. 시행 보건복지부령 제1143호). 「노인장기요양보험법 시행규칙」
 *   제23조제2항제1호가 재가급여 기관의 시설·인력을 이 별표로 정한다.
 * - 계산(반올림·기본 1명): 「장기요양급여 제공기준 및 급여비용 산정방법 등에 관한 고시」 제48조제1항
 * - 이용자 수 세는 법: 같은 고시 제47조, 근무인원 세는 법: 제49조·제51조, 위반 시: 제66조·제67조
 *   (현행 보건복지부고시 제2026-189호, 2026.10.1. 시행)
 */

/** 원문을 마지막으로 대조한 날. 페이지의 "원문 대조"와 구조화 데이터 dateModified로 쓴다. */
export const STAFFING_VERIFIED_AT = '2026-11-15';

/** 요양보호사 1명이 맡는 이용자 수 — 별표 9 제4호 가목 표. */
export const CAREGIVER_RATIO = {
  general: 7,
  dementia: 4,
} as const;

export type CareUnit = keyof typeof CAREGIVER_RATIO;

/** 치매전담실 1실당 이용정원 상한 — 별표 9 제1호 나목 단서. */
export const DEMENTIA_UNIT_MAX_USERS = 25;

/**
 * 이용자 수에 따른 요양보호사 의무 배치 인원 — 고시 제48조제1항.
 * "계산한 결과 소수점 이하는 반올림 한다. 다만, 계산한 결과가 0.5 미만인 경우에는 기본 1명을 배치하여야 한다."
 */
export function requiredCaregivers(users: number, unit: CareUnit): number {
  if (!Number.isInteger(users) || users < 1) {
    throw new RangeError(`이용자 수는 1 이상의 정수여야 한다: ${users}`);
  }
  const ratio = CAREGIVER_RATIO[unit];
  // 정수 비교로 반올림한다 — 6/4 = 1.5 같은 경계에서 부동소수 오차가 끼지 않게.
  // round(users / ratio) = floor((2 * users + ratio) / (2 * ratio))
  const rounded = Math.floor((2 * users + ratio) / (2 * ratio));
  return Math.max(1, rounded);
}

export interface CaregiverBand {
  from: number;
  to: number;
  caregivers: number;
}

/** 필요 인원이 같은 이용자 수 구간 — 표로 보여 주려고 묶는다. */
export function caregiverBands(unit: CareUnit, maxUsers: number): CaregiverBand[] {
  const bands: CaregiverBand[] = [];
  for (let users = 1; users <= maxUsers; users += 1) {
    const caregivers = requiredCaregivers(users, unit);
    const last = bands[bands.length - 1];
    if (last && last.caregivers === caregivers) {
      last.to = users;
    } else {
      bands.push({ from: users, to: users, caregivers });
    }
  }
  return bands;
}

/**
 * 근무인원 1인당 월 기준 근무시간 — 고시 제49조제1항.
 * [해당 월에 공휴일, 근로자의 날 및 토요일을 제외한 근무가능일수 × 8시간]
 * 공휴일(일요일 포함)은 호출하는 쪽이 넘긴다 — 임시공휴일까지 이 파일이 알 수는 없다.
 */
export function monthlyStandardHours(year: number, month: number, holidays: ReadonlyArray<number>): number {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  let workable = 0;
  for (let day = 1; day <= lastDay; day += 1) {
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    if (weekday === 0 || weekday === 6) continue; // 일요일(공휴일)·토요일
    if (holidays.includes(day)) continue;
    workable += 1;
  }
  return workable * 8;
}

/** 직종별 배치 기준 한 줄 — 별표 9 제4호 가목 표의 주·야간보호 두 행을 그대로 옮긴다. */
export interface StaffRoleRow {
  role: string;
  tenOrMore: string;
  underTen: string;
}

export const DAYCARE_STAFF_ROWS: ReadonlyArray<StaffRoleRow> = [
  { role: '시설장', tenOrMore: '1명', underTen: '1명' },
  { role: '사회복지사', tenOrMore: '1명 이상', underTen: '—' },
  { role: '간호(조무)사·물리(작업)치료사 중', tenOrMore: '1명 이상', underTen: '1명 이상' },
  { role: '요양보호사', tenOrMore: '이용자 7명당 1명 이상', underTen: '이용자 7명당 1명 이상' },
  { role: '요양보호사(치매전담실)', tenOrMore: '이용자 4명당 1명 이상', underTen: '이용자 4명당 1명 이상' },
  { role: '사무원', tenOrMore: '1명 (이용자 25명 이상)', underTen: '—' },
  { role: '조리원', tenOrMore: '1명', underTen: '1명' },
  { role: '보조원(운전사)', tenOrMore: '1명', underTen: '—' },
];

export interface StaffingSource {
  name: string;
  url: string;
}

export const STAFFING_SOURCES: ReadonlyArray<StaffingSource> = [
  {
    name: '노인복지법 시행규칙 [별표 9] 재가노인복지시설의 시설기준 및 직원배치기준 (제29조제1항 관련)',
    url: 'https://www.law.go.kr/법령/노인복지법시행규칙',
  },
  {
    name: '노인장기요양보험법 시행규칙 제23조(장기요양기관의 지정) — 재가급여 기관의 시설·인력은 노인복지법 시행규칙 별표 9',
    url: 'https://www.law.go.kr/법령/노인장기요양보험법시행규칙/제23조',
  },
  {
    name: '장기요양급여 제공기준 및 급여비용 산정방법 등에 관한 고시 (보건복지부고시 제2026-189호, 2026.10.1. 시행) 제47조~제51조, 제66조, 제67조',
    url: 'https://www.law.go.kr/행정규칙/장기요양급여제공기준및급여비용산정방법등에관한고시',
  },
];
