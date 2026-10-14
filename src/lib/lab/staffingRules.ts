/**
 * 주야간보호 인력배치기준 점검 규칙(순수 함수).
 *
 * 근거(research-8.md 1절)
 *  - 노인복지법 시행규칙 별표 9 제4호 — 직종별 인력 숫자 (장기요양법 시행규칙에는 숫자가 없다)
 *  - 장기요양급여 제공기준 고시 제47조(입소자 수 = 월 일자별 입소자 합 ÷ 급여제공일수, 반올림), 제48조(배치기준 반올림·0.5 미만은 1명),
 *    제49조(월 기준 근무시간 = 공휴일·근로자의 날·토요일을 뺀 근무가능일수 × 8시간), 제51조(근무인원 합산·소수 처리·운전사 50%),
 *    제55~56조(추가배치 가산), 제66조(인력배치기준 위반 감액)
 *
 * 소수 처리는 모두 정수(0.1 단위)로 셈한다 — 3 − 2.9가 0.10000000000000009가 되는 부동소수 오차로 감산점수가 틀어지지 않게 한다.
 *  - 감액용(forPenalty): 소수 둘째 자리 버림 → 첫째 자리가 4 이하면 첫째 자리도 버림 (제51조③)
 *  - 가산용(forBonus): 소수점 이하 버림
 *  - 배치 기준(requiredStaff): 반올림, 0.5 미만은 1명 (제48조①)
 *
 * 대조 필요
 *  - 감산점수표·감산유형점수·가산 1인당 입소자 기준(6.4명·19.0명)은 법제처 이미지 표를 눈으로 읽은 값이다. 원문 재대조 권장.
 *  - 결원 0.6~0.9명 구간은 표에 없다. 감액용 근무인원 규칙상 생기지 않으며, 직접 넣어도 0.3~0.5명 구간(1점)으로 본다.
 *  - 감산 대상 직종 9개(제66조①2)에 사무원은 없다 — 사무원은 배치기준만 보여 주고 감산점수는 0으로 둔다.
 *  - 영양사·위생원, 치매전담실(실별 구분)·치매전문요양보호사 0.5명 산정, 감액 특례(제67조)는 계산하지 않는다.
 *  - 2개월 연속 위반 배수에 곱한 점수는 소수 둘째 자리 이하를 버린다(제66조③).
 *  - 근무시간 인정 사유(연차유급휴가 등, 제51조④)는 직접 시간을 넣어 반영한다.
 */
import type { StaffJobType, StaffingStaff } from './labTypes.ts';
import { daysInMonth, formatYmd, isValidMonth, parseYmd } from './labDate.ts';

export type StaffGroup = 'DIRECTOR' | 'SOCIAL_WORKER' | 'NURSING' | 'CAREGIVER' | 'OFFICE' | 'COOK' | 'DRIVER';

export const STAFF_GROUPS: ReadonlyArray<{ group: StaffGroup; label: string; jobTypes: readonly StaffJobType[] }> = [
  { group: 'DIRECTOR', label: '시설장', jobTypes: ['DIRECTOR'] },
  { group: 'SOCIAL_WORKER', label: '사회복지사', jobTypes: ['SOCIAL_WORKER'] },
  { group: 'NURSING', label: '간호(조무)사·물리(작업)치료사', jobTypes: ['NURSE', 'NURSE_AIDE', 'THERAPIST'] },
  { group: 'CAREGIVER', label: '요양보호사', jobTypes: ['CAREGIVER'] },
  { group: 'OFFICE', label: '사무원', jobTypes: ['OFFICE'] },
  { group: 'COOK', label: '조리원', jobTypes: ['COOK'] },
  { group: 'DRIVER', label: '보조원(운전사)', jobTypes: ['DRIVER'] },
];

export const STAFF_JOB_TYPES: ReadonlyArray<{ value: StaffJobType; label: string }> = [
  { value: 'DIRECTOR', label: '시설장' },
  { value: 'SOCIAL_WORKER', label: '사회복지사' },
  { value: 'NURSE', label: '간호사' },
  { value: 'NURSE_AIDE', label: '간호조무사' },
  { value: 'THERAPIST', label: '물리·작업치료사' },
  { value: 'CAREGIVER', label: '요양보호사' },
  { value: 'OFFICE', label: '사무원' },
  { value: 'COOK', label: '조리원' },
  { value: 'DRIVER', label: '보조원(운전사)' },
  { value: 'OTHER', label: '기타(배치 기준에 세지 않음)' },
];

export function staffJobTypeLabel(jobType: string): string {
  return STAFF_JOB_TYPES.find((j) => j.value === jobType)?.label ?? jobType;
}

export function staffGroupLabel(group: StaffGroup): string {
  return STAFF_GROUPS.find((g) => g.group === group)?.label ?? group;
}

/** 직종이 속한 배치 묶음. OTHER·알 수 없는 값은 null(세지 않음) */
export function staffGroupOf(jobType: string): StaffGroup | null {
  return STAFF_GROUPS.find((g) => (g.jobTypes as readonly string[]).includes(jobType))?.group ?? null;
}

/** 감산 대상 직종(고시 제66조①2). 사무원은 목록에 없다 */
export const PENALIZED_GROUPS: readonly StaffGroup[] = ['DIRECTOR', 'SOCIAL_WORKER', 'NURSING', 'CAREGIVER', 'COOK', 'DRIVER'];

/**
 * 2026년 공휴일·대체공휴일(토·일에 걸린 날도 포함). 근로자의 날(5/1)은 따로 뺀다.
 * ⚠ 대조 필요: 인사혁신처 월력요항·관보로 확정 여부를 확인하고, 화면에서 기관이 고칠 수 있게 한다.
 *  - 설 연휴 2/16~18, 삼일절 대체 3/2(3/1 일요일), 부처님오신날 5/24 → 대체 5/25, 제9회 지방선거 6/3, 현충일 6/6,
 *    광복절 대체 8/17(8/15 토요일), 추석 연휴 9/24~26, 개천절 대체 10/5(10/3 토요일), 한글날 10/9, 성탄절 12/25
 */
export const KR_HOLIDAYS_2026: readonly string[] = [
  '2026-01-01',
  '2026-02-16',
  '2026-02-17',
  '2026-02-18',
  '2026-03-01',
  '2026-03-02',
  '2026-05-05',
  '2026-05-24',
  '2026-05-25',
  '2026-06-03',
  '2026-06-06',
  '2026-08-15',
  '2026-08-17',
  '2026-09-24',
  '2026-09-25',
  '2026-09-26',
  '2026-10-03',
  '2026-10-05',
  '2026-10-09',
  '2026-12-25',
];

/** 그 달에 해당하는 기본 공휴일(2026년만 목록이 있다 — 다른 해는 빈 목록) */
export function defaultHolidays(month: string): string[] {
  return KR_HOLIDAYS_2026.filter((d) => d.startsWith(`${month}-`));
}

/** 'YYYY-MM'의 바로 앞 달. 형식이 틀리면 null */
export function previousMonth(month: string): string | null {
  if (!isValidMonth(month)) return null;
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  return m === 1 ? `${String(y - 1).padStart(4, '0')}-12` : `${String(y).padStart(4, '0')}-${String(m - 1).padStart(2, '0')}`;
}

/** 그 달의 월~금 날짜 수 */
export function weekdaysInMonth(month: string): number {
  return workingDays(month, []);
}

/** 월~금 중 holidays와 근로자의 날(5/1)을 뺀 날 수. 월 밖·주말·중복 날짜는 영향 없다 */
function workingDays(month: string, holidays: readonly string[]): number {
  if (!isValidMonth(month)) return 0;
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const off = new Set(holidays);
  let count = 0;
  for (let d = 1; d <= daysInMonth(y, m); d += 1) {
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    if (dow === 0 || dow === 6) continue;
    if (m === 5 && d === 1) continue;
    if (off.has(formatYmd(y, m, d))) continue;
    count += 1;
  }
  return count;
}

/** 월 기준 근무시간 = (월~금 − 공휴일 − 근로자의 날) × 8시간 (고시 제49조①) */
export function standardMonthlyHours(month: string, holidays: readonly string[]): number {
  return workingDays(month, holidays) * 8;
}

/** 월별 입소자 수 = round(일자별 입소자 합 ÷ 급여제공일수) (고시 제47조②). 정수 연산이라 .5는 항상 올린다 */
export function monthlyUsers(usersSum: number, serviceDays: number): number {
  if (!Number.isFinite(usersSum) || !Number.isFinite(serviceDays) || serviceDays <= 0 || usersSum <= 0) return 0;
  const sum = Math.round(usersSum);
  const days = Math.round(serviceDays);
  if (days <= 0) return 0;
  return Math.floor((2 * sum + days) / (2 * days));
}

/** r(x) — 반올림, 0.5 미만이면 1 (고시 제48조①). x = n ÷ d 를 정수로 */
function roundAtLeastOne(n: number, d: number): number {
  const rounded = Math.floor((2 * n + d) / (2 * d));
  return rounded < 1 ? 1 : rounded;
}

/** 입소자 수에 따른 직종별 배치 기준(별표 9 제4호 가목, 주·야간보호). 입소자 0명이면 모두 0 */
export function requiredStaff(users: number): Record<StaffGroup, number> {
  const n = Number.isFinite(users) ? Math.max(0, Math.round(users)) : 0;
  if (n === 0) return { DIRECTOR: 0, SOCIAL_WORKER: 0, NURSING: 0, CAREGIVER: 0, OFFICE: 0, COOK: 0, DRIVER: 0 };
  const caregiver = roundAtLeastOne(n, 7);
  if (n >= 10) {
    return { DIRECTOR: 1, SOCIAL_WORKER: 1, NURSING: 1, CAREGIVER: caregiver, OFFICE: n >= 25 ? 1 : 0, COOK: 1, DRIVER: 1 };
  }
  return { DIRECTOR: 1, SOCIAL_WORKER: 0, NURSING: 1, CAREGIVER: caregiver, OFFICE: 0, COOK: 1, DRIVER: 0 };
}

export interface GroupFte {
  /** 월 기준 시간 이상 근무한 사람 수 */
  full: number;
  /** 못 미친 사람들의 근무시간 합 */
  partialHours: number;
  /** 소수 처리 전 근무인원 = full + partialHours ÷ 기준 시간 (운전사는 시간 합이 기준의 50% 이상이면 최소 1) */
  raw: number;
  /** 감액용: 둘째 자리 버림 → 첫째 자리가 4 이하면 버림 */
  forPenalty: number;
  /** 가산용: 소수점 이하 버림 */
  forBonus: number;
}

/** 시간(소수 첫째 자리까지)을 0.1시간 단위 정수로 */
function tenths(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.round(value * 10) : 0;
}

/** 근무인원 total/100(소수 둘째 자리 버린 값, 정수 hundredths)을 감액용으로 — 첫째 자리가 4 이하면 버린다. 돌려주는 값은 0.1 단위 정수 */
function penaltyTenths(hundredths: number): number {
  const whole = Math.floor(hundredths / 100);
  const firstDecimal = Math.floor(hundredths / 10) % 10;
  return whole * 10 + (firstDecimal > 4 ? firstDecimal : 0);
}

function fteOf(hoursTenths: readonly number[], standardTenths: number, isDriver: boolean): GroupFte {
  let full = 0;
  let partial = 0;
  let all = 0;
  for (const h of hoursTenths) {
    all += h;
    if (standardTenths > 0 && h >= standardTenths) full += 1;
    else partial += h;
  }
  // 기준 시간이 0이면(그 달 근무가능일이 없음) 나눌 수 없어 근무인원 0으로 본다
  const hundredths = standardTenths > 0 ? full * 100 + Math.floor((partial * 100) / standardTenths) : 0;
  let raw = standardTenths > 0 ? full + partial / standardTenths : 0;
  let forBonus = standardTenths > 0 ? full + Math.floor(partial / standardTenths) : 0;
  let hundredthsUsed = hundredths;
  if (isDriver && standardTenths > 0 && all * 2 >= standardTenths && raw < 1) {
    // 보조원(운전사)은 근무시간 합이 월 기준 시간의 100분의 50 이상이면 1명 (고시 제51조⑤)
    raw = 1;
    forBonus = 1;
    hundredthsUsed = 100;
  }
  return { full, partialHours: partial / 10, raw, forPenalty: penaltyTenths(hundredthsUsed) / 10, forBonus };
}

/** 직종 묶음별 근무인원. OTHER 직종과 근무시간이 0 이하인 줄은 세지 않는다 */
export function staffingFte(staff: ReadonlyArray<Pick<StaffingStaff, 'jobType' | 'hours'>>, standardHours: number): Record<StaffGroup, GroupFte> {
  const standardTenths = tenths(standardHours);
  const out = {} as Record<StaffGroup, GroupFte>;
  for (const g of STAFF_GROUPS) {
    const hours = staff.filter((s) => staffGroupOf(s.jobType) === g.group).map((s) => tenths(s.hours)).filter((h) => h > 0);
    out[g.group] = fteOf(hours, standardTenths, g.group === 'DRIVER');
  }
  return out;
}

/** 결원 수(0.1 단위 정수)의 감산점수(0.1점 단위 정수) — 1명당 3점, 0.1~0.2명 0.3점, 0.3~0.5명 1점 (고시 제66조①3) */
function penaltyTenthsOf(shortfallTenths: number): number {
  const whole = Math.floor(shortfallTenths / 10);
  const rest = shortfallTenths % 10;
  const restScore = rest === 0 ? 0 : rest <= 2 ? 3 : 10;
  return whole * 30 + restScore;
}

/** 결원 수에 따른 감산점수. 1명 3점, 그 밖에는 소수 부분(0.1~0.2명 0.3점, 0.3~0.5명 1점)을 더한다 */
export function penaltyScoreOf(shortfall: number): number {
  if (!Number.isFinite(shortfall) || shortfall <= 0) return 0;
  return penaltyTenthsOf(Math.round(shortfall * 10)) / 10;
}

export interface StaffingRow {
  group: StaffGroup;
  required: number;
  /** 감액용 근무인원 */
  fte: number;
  /** 결원(≥ 0), 소수 첫째 자리 */
  shortfall: number;
  penaltyScore: number;
  /** 감산 대상 직종이 아니면 false(사무원) */
  penalized: boolean;
}

export interface StaffingCheck {
  rows: StaffingRow[];
  penaltyScoreSum: number;
  /** 연속 위반 배수를 곱한 점수(소수 둘째 자리 이하 버림) */
  adjustedScoreSum: number;
  typeScore: number;
  multiplier: number;
  /** 감액률(%) = 감산점수 합 × 배수 ÷ 입소자 수 × 감산유형점수 × 100, 소수 첫째 자리 반올림 */
  penaltyRate: number;
  violated: boolean;
  /** 요양보호사 1인당 입소자 수(소수 셋째 자리 버림). 가산용 근무인원이 0이면 null */
  caregiverPerHead: number | null;
  nursePerHead: number | null;
  bonusHints: string[];
}

export interface StaffingCheckInput {
  users: number;
  staff: ReadonlyArray<Pick<StaffingStaff, 'jobType' | 'hours'>>;
  standardHours: number;
  /** 바로 앞 달도 위반이었는가 — 2개월 이상 연속 위반이면 감산점수에 배수를 곱한다(고시 제66조③) */
  previousViolated?: boolean;
}

function typeScoreTenths(users: number): number {
  if (users < 10) return 12;
  if (users < 50) return 15;
  return 20;
}

/** 입소자 ÷ 근무인원, 소수 셋째 자리 버림 */
function perHead(users: number, headcount: number): number | null {
  if (headcount <= 0) return null;
  return Math.floor((users * 1000) / headcount) / 1000;
}

export const CAREGIVER_BONUS_BELOW = 6.4;
export const NURSING_BONUS_BELOW = 19;

/** 입소자 수·직원 근무시간·월 기준 시간으로 인력배치 점검 결과를 낸다(배치 기준·결원·감산·감액률·가산 안내) */
export function staffingCheck(input: StaffingCheckInput): StaffingCheck {
  const users = Number.isFinite(input.users) ? Math.max(0, Math.round(input.users)) : 0;
  const required = requiredStaff(users);
  const fte = staffingFte(input.staff, input.standardHours);
  const rows: StaffingRow[] = [];
  let scoreTenths = 0;
  for (const g of STAFF_GROUPS) {
    const have = fteCoreTenths(fte[g.group]);
    const shortTenths = Math.max(0, required[g.group] * 10 - have);
    const penalized = PENALIZED_GROUPS.includes(g.group);
    const score = penalized ? penaltyTenthsOf(shortTenths) : 0;
    scoreTenths += score;
    rows.push({ group: g.group, required: required[g.group], fte: have / 10, shortfall: shortTenths / 10, penaltyScore: score / 10, penalized });
  }
  const typeTenths = typeScoreTenths(users);
  const multiplierTenths = input.previousViolated ? (users < 30 ? 12 : 15) : 10;
  // 배수를 곱한 점수는 소수 둘째 자리 이하를 버린다 (3.0 × 1.2 = 3.6, 0.3 × 1.2 = 0.3)
  const adjustedTenths = Math.floor((scoreTenths * multiplierTenths) / 10);
  // 감액률(%) = 점수 × 유형점수 ÷ 입소자 × 100. 두 점수가 0.1 단위 정수이므로 (정수 × 정수 × 10 ÷ 입소자)가 0.1% 단위 — 정수 연산 후 반올림
  const rateTenths = users === 0 ? 0 : Math.floor((2 * adjustedTenths * typeTenths * 10 + users) / (2 * users));
  const caregiverBonus = fte.CAREGIVER.forBonus;
  const nursingBonus = fte.NURSING.forBonus;
  const caregiverPerHead = perHead(users, caregiverBonus);
  const nursePerHead = perHead(users, nursingBonus);
  const bonusHints: string[] = [];
  const row = (g: StaffGroup) => rows.find((r) => r.group === g)!;
  if (users >= 1) {
    if (caregiverPerHead !== null && caregiverPerHead < CAREGIVER_BONUS_BELOW && caregiverBonus > required.CAREGIVER && row('CAREGIVER').shortfall === 0) {
      bonusHints.push(`요양보호사 1인당 입소자 ${caregiverPerHead}명 — ${CAREGIVER_BONUS_BELOW}명 미만이라 인력 추가배치 가산 요건에 해당할 수 있습니다(고시 제55조, 배치기준 충족이 전제, 대조 필요)`);
    }
    if (nursePerHead !== null && nursePerHead < NURSING_BONUS_BELOW && nursingBonus > required.NURSING && row('NURSING').shortfall === 0) {
      bonusHints.push(`간호(조무)사·치료사 1인당 입소자 ${nursePerHead}명 — ${NURSING_BONUS_BELOW.toFixed(1)}명 미만이라 인력 추가배치 가산 요건에 해당할 수 있습니다(고시 제55조, 대조 필요)`);
    }
  }
  return {
    rows,
    penaltyScoreSum: scoreTenths / 10,
    adjustedScoreSum: adjustedTenths / 10,
    typeScore: typeTenths / 10,
    multiplier: multiplierTenths / 10,
    penaltyRate: rateTenths / 10,
    violated: scoreTenths > 0,
    caregiverPerHead,
    nursePerHead,
    bonusHints,
  };
}

/** 감액용 근무인원(소수 첫째 자리)을 0.1 단위 정수로 */
function fteCoreTenths(fte: GroupFte): number {
  return Math.round(fte.forPenalty * 10);
}

/** 근무시간 채우기 = round(월 기준 시간 × min(주 소정시간, 40) ÷ 40, 소수 첫째 자리) */
export function prefillHours(weeklyHours: number, standardHours: number): number {
  if (!Number.isFinite(weeklyHours) || !Number.isFinite(standardHours) || weeklyHours <= 0 || standardHours <= 0) return 0;
  const week = Math.min(weeklyHours, 40);
  return Math.floor((standardHours * week * 10 * 2 + 40) / 80) / 10;
}

/** 월별 날짜 검사 — holidays 입력에서 그 달 날짜만 남긴다 */
export function holidaysOfMonth(month: string, dates: readonly string[]): string[] {
  const out: string[] = [];
  for (const d of dates) {
    const p = parseYmd(d);
    if (p && formatYmd(p.year, p.month, p.day).startsWith(`${month}-`) && !out.includes(d)) out.push(d);
  }
  return out.sort();
}
