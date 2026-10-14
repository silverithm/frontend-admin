/**
 * 퇴직금 추계 — 근로자퇴직급여 보장법·근로기준법.
 *
 * 근거(research-7.md 5절)
 *  - 대상: 계속근로기간 1년 이상, 4주 평균 주 소정근로시간 15시간 이상(법 제4조제1항).
 *  - 퇴직금 = 1일 평균임금 × 30일 × (재직일수 ÷ 365)(법 제8조, 생활법령).
 *  - 평균임금 = 산정 사유 발생일(퇴직일) 이전 3개월 동안 지급된 임금 총액 ÷ 그 기간의 총일수. 퇴직일 당일은 총일수에 넣지 않는다.
 *    그래서 퇴직일이 속한 달의 직전 3개월(2026-10-20 퇴직 → 7·8·9월)을 본다.
 *  - 평균임금이 통상임금보다 적으면 통상임금을 평균임금으로 한다(근로기준법 제2조제2항) → 둘 중 큰 값.
 *  - 지급 기한 14일, 퇴직연금 가입자는 IRP 이전이 원칙이다(법 제9조). 이 모듈은 금액 추계만 한다.
 *
 * 대조 필요(SEVERANCE_VERIFY_NOTES): 상여금·연차수당을 평균임금에 넣는 방식(연간 상여 × 3/12). 생활법령에서는 "12개월 상여금 전액을 근로개월 수로 나눠 반영"만 확인했다.
 * 계산 기준 단순화: 급여대장의 grossPay 전체(비과세 식대 포함)를 임금 총액으로 본다. 휴직·수습 등 산정 제외 기간(근로기준법 시행령 제2조)은 반영하지 않는다.
 *
 * 금액은 전부 정수 원 — 원 미만은 절사한다. 나눗셈은 곱한 뒤 한 번만 내림한다.
 */
import type { PayrollLine, PayrollProfile } from './labTypes.ts';
import { daysBetween, daysInMonth, isValidYmd } from './labDate.ts';
import { hourlyWageOf } from './payrollRules.ts';

export const SEVERANCE_VERIFY_NOTES: readonly string[] = [
  '상여금·연차수당 가산 방식(연간 상여금 × 3/12)은 고용노동부 질의회시 원문 대조가 필요합니다',
  '휴직·수습 등 평균임금 산정에서 빼는 기간(근로기준법 시행령 제2조)은 반영하지 않았습니다',
  '급여대장의 지급 총액(grossPay)을 임금 총액으로 봅니다. 임시로 지급된 수당은 직접 확인해 주세요',
  '퇴직금은 퇴직일부터 14일 안에 지급하고, 근로자가 지정한 IRP 계정으로 이전하는 것이 원칙입니다(예외는 시행령 제3조의2)',
];

/** 대상이 되려면 계속근로 이만큼(일) 이상 */
export const MIN_SERVICE_DAYS = 365;
/** 대상이 되려면 주 소정근로시간 이만큼(시간) 이상 */
export const MIN_WEEKLY_HOURS = 15;

export interface SeveranceProfile {
  hireDate: string;
  weeklyHours: number;
  payType: PayrollProfile['payType'];
  baseAmount: number;
  memberId?: number;
}

export type SeveranceLine = Pick<PayrollLine, 'payMonth' | 'grossPay'> & { memberId?: number };

export interface SeveranceEstimate {
  eligible: boolean;
  /** 대상이 아닌 이유, 또는 계산상 주의(급여대장이 빠진 달 등). 없으면 null */
  reason: string | null;
  serviceDays: number;
  /** 평균임금 1일(원, 절사). 급여대장이 한 달도 없으면 0 */
  avgDailyWage: number;
  /** 통상임금 1일(원, 절사) */
  ordinaryDailyWage: number;
  /** max(평균임금, 통상임금) */
  dailyWageUsed: number;
  /** 추계 퇴직금(원, 절사). 대상이 아니면 0 */
  amount: number;
}

function wholeWon(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

/** 퇴직일이 속한 달의 직전 3개월('YYYY-MM', 오래된 달 먼저). 퇴직일이 틀리면 빈 배열. */
export function averageWageMonths(retireDate: string): string[] {
  if (!isValidYmd(retireDate)) return [];
  let year = Number(retireDate.slice(0, 4));
  let month = Number(retireDate.slice(5, 7));
  const out: string[] = [];
  for (let i = 0; i < 3; i += 1) {
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
    out.unshift(`${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`);
  }
  return out;
}

/** 통상임금 1일(원) = 통상시급 × 1일 소정근로시간(주 소정근로시간 ÷ 5). 통상시급은 payrollRules.hourlyWageOf를 쓴다. */
export function ordinaryDailyWageOf(profile: Pick<SeveranceProfile, 'payType' | 'baseAmount' | 'weeklyHours'>): number {
  const hourly = hourlyWageOf(profile);
  const tenthsOfHours = typeof profile.weeklyHours === 'number' && Number.isFinite(profile.weeklyHours) ? Math.max(0, Math.round(profile.weeklyHours * 10)) : 0;
  // 통상시급 × (주 시간 ÷ 5) = 통상시급 × (주 시간×10) ÷ 50
  return Math.floor((hourly * tenthsOfHours) / 50);
}

/**
 * 한 직원의 퇴직금 추계. lines는 그 직원의 급여대장 줄(여러 달), annualBonus는 연간 상여·연차수당(원, 기본 0).
 * 평균임금 = floor((임금 합 + annualBonus × 있는 달 수 ÷ 12) ÷ 있는 달들의 달력 일수 합). 급여대장이 없는 달은 건너뛰고 reason에 적는다.
 */
export function severanceEstimate(profile: SeveranceProfile, lines: ReadonlyArray<SeveranceLine>, retireDate: string, annualBonus = 0): SeveranceEstimate {
  const ordinaryDailyWage = ordinaryDailyWageOf(profile);
  const days = isValidYmd(profile.hireDate) && isValidYmd(retireDate) ? daysBetween(profile.hireDate, retireDate) : null;
  const serviceDays = days === null ? 0 : Math.max(0, days);
  const notes: string[] = [];

  if (days === null) notes.push('입사일·퇴직일이 올바르지 않습니다');
  else if (days < 0) notes.push('퇴직일이 입사일보다 앞섭니다');
  let eligible = days !== null && serviceDays >= MIN_SERVICE_DAYS;
  if (days !== null && days >= 0 && serviceDays < MIN_SERVICE_DAYS) notes.push(`계속근로기간이 1년 미만입니다 (${serviceDays}일)`);
  if (!(profile.weeklyHours >= MIN_WEEKLY_HOURS)) {
    eligible = false;
    notes.push(`주 소정근로시간이 ${MIN_WEEKLY_HOURS}시간 미만입니다`);
  }

  // 평균임금
  const byMonth = new Map<string, number>();
  for (const l of lines) {
    if (typeof profile.memberId === 'number' && typeof l.memberId === 'number' && l.memberId !== profile.memberId) continue;
    byMonth.set(l.payMonth, wholeWon(l.grossPay));
  }
  const months = averageWageMonths(retireDate);
  const present = months.filter((m) => byMonth.has(m));
  const missing = months.filter((m) => !byMonth.has(m));
  let wageSum = 0;
  let dayCount = 0;
  for (const m of present) {
    wageSum += byMonth.get(m) ?? 0;
    dayCount += daysInMonth(Number(m.slice(0, 4)), Number(m.slice(5, 7)));
  }
  let avgDailyWage = 0;
  if (dayCount > 0) {
    // 임금 합 + 상여 × n/12 = (12 × 합 + 상여 × n) ÷ 12
    avgDailyWage = Math.floor((12 * wageSum + wholeWon(annualBonus) * present.length) / (12 * dayCount));
  }
  if (months.length > 0 && present.length === 0) notes.push(`직전 3개월(${months.join('·')}) 급여대장이 없어 평균임금을 계산하지 못했습니다. 통상임금으로 계산합니다`);
  else if (missing.length > 0) notes.push(`급여대장이 없는 달(${missing.join('·')})은 빼고, 있는 달만으로 평균임금을 계산했습니다`);

  const dailyWageUsed = Math.max(avgDailyWage, ordinaryDailyWage);
  const amount = eligible ? Math.floor((dailyWageUsed * 30 * serviceDays) / MIN_SERVICE_DAYS) : 0;
  return { eligible, reason: notes.length > 0 ? notes.join(' / ') : null, serviceDays, avgDailyWage, ordinaryDailyWage, dailyWageUsed, amount };
}

export interface SeveranceLiability {
  members: Array<{ memberId: number; eligible: boolean; amount: number }>;
  total: number;
}

/** asOf를 퇴직일로 가정했을 때 직원 전체 추계 합. linesByMember는 직원 번호별 급여대장 줄. */
export function severanceLiability(
  profiles: ReadonlyArray<SeveranceProfile & { memberId: number }>,
  linesByMember: Readonly<Record<number, ReadonlyArray<SeveranceLine>>>,
  asOf: string,
): SeveranceLiability {
  const members = profiles.map((p) => {
    const e = severanceEstimate(p, linesByMember[p.memberId] ?? [], asOf, 0);
    return { memberId: p.memberId, eligible: e.eligible, amount: e.amount };
  });
  return { members, total: members.reduce((sum, m) => sum + m.amount, 0) };
}
