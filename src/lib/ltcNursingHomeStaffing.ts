/**
 * 요양원(노인요양시설·노인요양공동생활가정) 인력배치기준 — /ltc/nursing-home-staffing-standard 페이지의 원장.
 *
 * 숫자 하나가 틀리면 페이지 전체의 신뢰가 무너진다. 값을 고칠 때는 반드시 아래 원문을 다시 열어 대조한다.
 * - 직종별 인원: 「노인복지법 시행규칙」 별표 4(노인의료복지시설의 시설기준 및 직원배치기준) 제6호 표
 *   (별표 개정 2024.12.31. 보건복지부령 제1082호, 2025.1.1. 시행. 시행규칙 현행 2025.12.29. 시행 보건복지부령 제1143호).
 *   PDF(flSeq 164709233) 표는 글자 추출로는 칸이 섞여 2026-11-22에 300dpi 그림으로 바꿔 칸을 직접 읽었다.
 *   직전 별표(개정 2022.8.31., flSeq 145160893)와 글자 비교 — 노인요양시설 요양보호사 '2.3명당'→'2.1명당' 두 칸만 다르다.
 * - 경과조치: 보건복지부령 제1082호 부칙 제2조 — 시행 당시 설치·운영 중인 노인요양시설은 2026.12.31.까지 개정 제6호 충족.
 * - 시설급여 기관의 인력 = 별표 4: 「노인장기요양보험법 시행규칙」 제23조제2항제2호
 * - 계산(반올림·기본 1명): 「장기요양급여 제공기준 및 급여비용 산정방법 등에 관한 고시」 제44조제1항·제48조제1항
 * - 급여비용 1호·2호와 2.3명당 감액 기준: 같은 고시 제44조제1항, 제66조제4항
 * - 입소자 수 세는 법: 제47조(외박 제45조), 근무인원 세는 법: 제49조·제51조(치매전담형 제70조·제72조),
 *   위반 시: 제64조·제66조·제67조 (현행 보건복지부고시 제2026-189호, 2026.10.1. 시행)
 */

/** 원문을 마지막으로 대조한 날. 페이지의 "원문 대조"와 구조화 데이터 dateModified로 쓴다. */
export const NURSING_HOME_VERIFIED_AT = '2026-11-22';

/** 개정 별표 4 제6호 시행일과, 그 전부터 운영하던 노인요양시설이 개정 기준을 갖춰야 하는 기한(부칙 제2조). */
export const RATIO_CHANGE_EFFECTIVE = '2025-01-01';
export const RATIO_CHANGE_DEADLINE = '2026-12-31';

/**
 * 직원 1명이 맡는 입소자 수 — 0.1명 단위 정수로 둔다(2.1 → 21). 부동소수 오차 없이 반올림하려고.
 * - nursingHome: 노인요양시설 요양보호사 2.1명당 1명 (별표 4 제6호, 2025.1.1. 시행)
 * - nursingHomeBefore2025: 개정 전 2.3명당 1명 — 고시 제66조제4항(제44조제1항제2호 급여비용 산정 시 감액 기준)
 * - dementiaUnit: 노인요양시설 치매전담실 2명당 1명
 * - groupHome: 노인요양공동생활가정 3명당 1명, groupHomeDementia: 치매전담형 2.5명당 1명
 * - perTwentyFive: 입소자 30명 이상 노인요양시설의 간호사 또는 간호조무사·조리원 25명당 1명
 */
export const RATIO_TENTHS = {
  nursingHome: 21,
  nursingHomeBefore2025: 23,
  dementiaUnit: 20,
  groupHome: 30,
  groupHomeDementia: 25,
  perTwentyFive: 250,
} as const;

export type RatioKey = keyof typeof RATIO_TENTHS;

/** 치매전담실 1실당 정원 상한 — 별표 4 제1호가목(1) 단서. */
export const DEMENTIA_UNIT_MAX_RESIDENTS = 16;

/** 입소정원 — 별표 4 제1호가목: 노인요양시설 10명 이상, 노인요양공동생활가정 5명 이상 9명 이하. */
export const NURSING_HOME_MIN_RESIDENTS = 10;
export const GROUP_HOME_RESIDENTS = { from: 5, to: 9 } as const;

/**
 * 입소자 수에 따른 의무 배치 인원 — 고시 제44조제1항·제48조제1항.
 * "입소자 수를 2.1으로 나누어 계산한 결과 소수점 이하는 반올림한 값 … 계산한 결과가 0.5 미만인 경우에는 기본 1명"
 */
export function requiredStaff(residents: number, ratio: RatioKey): number {
  if (!Number.isInteger(residents) || residents < 1) {
    throw new RangeError(`입소자 수는 1 이상의 정수여야 한다: ${residents}`);
  }
  const tenths = RATIO_TENTHS[ratio];
  // round(residents / (tenths / 10)) = round(10 * residents / tenths) = floor((20 * residents + tenths) / (2 * tenths))
  const rounded = Math.floor((20 * residents + tenths) / (2 * tenths));
  return Math.max(1, rounded);
}

export interface StaffBand {
  from: number;
  to: number;
  staff: number;
}

/** 필요 인원이 같은 입소자 수 구간 — 표로 보여 주려고 묶는다. */
export function staffBands(ratio: RatioKey, fromResidents: number, toResidents: number): StaffBand[] {
  const bands: StaffBand[] = [];
  for (let residents = fromResidents; residents <= toResidents; residents += 1) {
    const staff = requiredStaff(residents, ratio);
    const last = bands[bands.length - 1];
    if (last && last.staff === staff) {
      last.to = residents;
    } else {
      bands.push({ from: residents, to: residents, staff });
    }
  }
  return bands;
}

export function bandLabel(band: StaffBand): string {
  return band.from === band.to ? `${band.from}명` : `${band.from}~${band.to}명`;
}

/**
 * 별표 4 제6호 표의 한 칸. 원문 표에서 여러 칸이 하나로 합쳐진 곳은 맨 위 행에 rowSpan을 두고,
 * 아래 행은 covered로 비운다(행·열을 바꿔 직종을 행으로 놓았으므로 원문의 가로 합침이 세로 합침이 된다).
 */
export interface RoleCell {
  text: string;
  rowSpan?: number;
  covered?: boolean;
}

export interface NursingHomeRoleRow {
  role: string;
  over30: RoleCell;
  under30: RoleCell;
  groupHome: RoleCell;
}

const EMPTY: RoleCell = { text: '—' };
const COVERED: RoleCell = { text: '', covered: true };

/** 별표 4 제6호 직원의 배치기준 — 원문 열 순서(시설의 장 … 관리인)를 행으로 옮겼다. 괄호 안 글자는 원문 그대로. */
export const NURSING_HOME_ROLE_ROWS: ReadonlyArray<NursingHomeRoleRow> = [
  { role: '시설의 장', over30: { text: '1명' }, under30: { text: '1명' }, groupHome: { text: '1명', rowSpan: 3 } },
  {
    role: '사무국장',
    over30: { text: '1명 (입소자 50명 이상인 경우로 한정함)' },
    under30: { text: '1명', rowSpan: 2 },
    groupHome: COVERED,
  },
  { role: '사회복지사', over30: { text: '1명 (입소자 100명 초과할 때마다 1명 추가)' }, under30: COVERED, groupHome: COVERED },
  { role: '의사 또는 계약의사', over30: { text: '1명 이상' }, under30: { text: '1명' }, groupHome: EMPTY },
  { role: '간호사 또는 간호조무사', over30: { text: '입소자 25명당 1명' }, under30: { text: '1명' }, groupHome: { text: '1명', rowSpan: 2 } },
  { role: '물리치료사 또는 작업치료사', over30: { text: '1명 (입소자 100명 초과할 때마다 1명 추가)' }, under30: EMPTY, groupHome: COVERED },
  {
    role: '요양보호사',
    over30: { text: '입소자 2.1명당 1명 (치매전담실은 2명당 1명)' },
    under30: { text: '입소자 2.1명당 1명 (치매전담실은 2명당 1명)' },
    groupHome: { text: '입소자 3명당 1명 (치매전담형은 2.5명당 1명)' },
  },
  { role: '사무원', over30: { text: '1명 (입소자 50명 이상인 경우로 한정함)' }, under30: EMPTY, groupHome: EMPTY },
  { role: '영양사', over30: { text: '1명 (1회 급식인원이 50명 이상인 경우로 한정함)' }, under30: EMPTY, groupHome: EMPTY },
  { role: '조리원', over30: { text: '입소자 25명당 1명' }, under30: { text: '1명' }, groupHome: EMPTY },
  { role: '위생원', over30: { text: '1명 (입소자 100명 초과할 때마다 1명 추가)' }, under30: EMPTY, groupHome: EMPTY },
  { role: '관리인', over30: { text: '1명 (입소자 50명 이상인 경우로 한정함)' }, under30: EMPTY, groupHome: EMPTY },
];

/** 입소자 수별 예시 표의 한 줄 — 직종과 칸 값. */
export interface ExampleRow {
  role: string;
  values: string[];
}

const count = (n: number) => (n === 0 ? '—' : `${n}명`);

/**
 * 노인요양시설(치매전담실 없음) 입소자 수별 직종 인원 — 별표 4 제6호 + 고시 제48조제1항 반올림.
 * '100명 초과할 때마다 1명 추가'를 따로 풀지 않으려고 100명까지만 계산한다.
 */
export function nursingHomeExample(residentsList: ReadonlyArray<number>): ExampleRow[] {
  for (const residents of residentsList) {
    if (!Number.isInteger(residents) || residents < NURSING_HOME_MIN_RESIDENTS || residents > 100) {
      throw new RangeError(`예시는 입소자 10~100명만 계산한다: ${residents}`);
    }
  }
  const col = (fn: (residents: number, large: boolean) => string) =>
    residentsList.map((residents) => fn(residents, residents >= 30));
  return [
    { role: '시설의 장', values: col(() => '1명') },
    { role: '사무국장', values: col((r, large) => (large ? count(r >= 50 ? 1 : 0) : '1명 (사회복지사 칸과 합침)')) },
    { role: '사회복지사', values: col((_, large) => (large ? '1명' : '사무국장 칸과 합침')) },
    { role: '의사 또는 계약의사', values: col((_, large) => (large ? '1명 이상' : '1명')) },
    { role: '간호사 또는 간호조무사', values: col((r, large) => (large ? count(requiredStaff(r, 'perTwentyFive')) : '1명')) },
    { role: '물리치료사 또는 작업치료사', values: col((_, large) => count(large ? 1 : 0)) },
    { role: '요양보호사', values: col((r) => count(requiredStaff(r, 'nursingHome'))) },
    { role: '사무원', values: col((r, large) => count(large && r >= 50 ? 1 : 0)) },
    { role: '영양사', values: col((_, large) => (large ? '1회 급식인원 50명 이상이면 1명' : '—')) },
    { role: '조리원', values: col((r, large) => (large ? count(requiredStaff(r, 'perTwentyFive')) : '1명')) },
    { role: '위생원', values: col((_, large) => count(large ? 1 : 0)) },
    { role: '관리인', values: col((r, large) => count(large && r >= 50 ? 1 : 0)) },
  ];
}

export interface StaffingSource {
  name: string;
  url: string;
}

export const NURSING_HOME_SOURCES: ReadonlyArray<StaffingSource> = [
  {
    name: '노인복지법 시행규칙 [별표 4] 노인의료복지시설의 시설기준 및 직원배치기준 (제22조제1항 관련, 개정 2024.12.31.)',
    url: 'https://www.law.go.kr/법령/노인복지법시행규칙',
  },
  {
    name: '노인복지법 시행규칙 부칙 <보건복지부령 제1082호, 2024.12.31.> 제1조(시행일 2025.1.1.)·제2조(노인요양시설의 직원배치기준에 관한 경과조치)',
    url: 'https://www.law.go.kr/법령/노인복지법시행규칙/(20250101,1082,20241231)',
  },
  {
    name: '노인장기요양보험법 시행규칙 제23조(장기요양기관 지정기준 등) — 시설급여 기관의 시설·인력은 노인복지법 시행규칙 별표 4',
    url: 'https://www.law.go.kr/법령/노인장기요양보험법시행규칙/제23조',
  },
  {
    name: '장기요양급여 제공기준 및 급여비용 산정방법 등에 관한 고시 (보건복지부고시 제2026-189호, 2026.10.1. 시행) 제44조, 제45조, 제47조~제51조, 제64조, 제66조, 제67조, 제70조, 제72조',
    url: 'https://www.law.go.kr/행정규칙/장기요양급여제공기준및급여비용산정방법등에관한고시',
  },
];
