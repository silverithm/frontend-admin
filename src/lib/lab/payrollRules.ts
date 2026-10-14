/**
 * 직원 급여 계산 규칙 — 4대보험·간이세액(소득세·지방소득세)·시급 환산·가산수당·장기근속장려금·최저임금·급여대장 한 줄.
 *
 * 원칙
 *  - 금액은 전부 정수 원이다. 비율은 분자/분모 정수로 곱하고 내림(절사)해서 부동소수점 오차가 끼지 않게 한다.
 *  - 확인된 값(1차 출처)과 대조가 필요한 값(2차 출처)을 상수 이름 옆 주석에 구분해 둔다. 화면은 "대조 필요" 값에 표시를 붙인다.
 *  - 이 모듈은 계산 보조 도구다. 신고·납부 전에는 급여 담당자·세무사가 확인한다.
 */
import { parseYmd, daysInMonth, isValidMonth } from './labDate.ts';
import { withholdingBaseTax } from './withholdingTable.ts';
import type {
  LongServiceFacility,
  PayrollExtras,
  PayrollHours,
  PayrollJobType,
  PayrollLineInput,
  PayrollPayType,
  PayrollProfile,
  WithholdingRate,
} from './labTypes.ts';

/**
 * 화면이 "대조 필요"로 표시해야 하는 값·규칙. 확인된 값(1차 출처)은 여기 없다.
 * 확인됨: 국민연금 상·하한과 4.75%, 건보 3.595%, 장기요양 13.14%, 고용 근로자 0.9%, 간이세액표(법제처 별표 2, 2026-03-01 적용본), 자녀 공제 금액(별표 2 비고 3).
 */
export const PAYROLL_VERIFY_NOTES: readonly string[] = [
  '간이세액표는 2026-03-01 이후 적용본입니다. 2026-02 이전 달은 같은 표에 옛 자녀공제 금액을 쓴 근사값이며, 법제처 현행본이 그 뒤 바뀌었는지 대조가 필요합니다',
  '국민연금 근로자 몫·건강보험·고용보험·지방소득세의 끝전(10원 미만 절사)은 정보연계센터 예시 기준입니다. 대조 필요',
  '고용보험 사업주 1.15%(실업급여 0.9 + 고용안정·직업능력개발 0.25, 150인 미만)는 대조 필요',
  '건강보험 보수월액 상·하한과 국민연금 가입 제외 대상(소득 8만 원 미만·60세 이상 등)은 계산에 넣지 않았습니다. 가입 여부는 직원별로 직접 고릅니다',
  '비과세 식대 월 20만 원, 2026 최저임금 시급 10,320원, 선임 요양보호사 수당 월 15만 원은 2차 근거라 대조 필요',
  '장기근속장려금: 주야간보호가 재가·방문형과 입소형 중 어느 쪽 금액인지 확인되지 않아 기본은 재가·방문형입니다. 대조 필요',
  '월 소정근로시간은 (주 시간 + 주 시간/5) × 365 ÷ 7 ÷ 12 반올림 식입니다. 주 15시간 미만(주휴 없음)·40시간 초과(주휴 8시간 상한)는 대조 필요',
  '통상시급은 원 미만 반올림, 가산수당은 원 미만 절사입니다. 5인 미만 사업장은 가산수당 규정이 달라질 수 있습니다. 대조 필요',
  '월급제는 월급 전액을 기본급으로 둡니다(중도 입퇴사 일할 계산·결근 공제는 기타 공제로 직접 넣습니다)',
] as const;

// ---------- 정수 도우미 ----------

/** a ÷ b의 몫(내림). a, b는 0 이상의 안전한 정수. */
function floorDiv(a: number, b: number): number {
  return (a - (a % b)) / b;
}

/** 10원 미만 절사 */
function floorTo10(won: number): number {
  return won - (won % 10);
}

function wholeWon(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

/** 시간(소수 한 자리)을 10배 정수로. 0.1시간 단위로 반올림한다. */
function tenths(hours: unknown): number {
  return typeof hours === 'number' && Number.isFinite(hours) ? Math.max(0, Math.round(hours * 10)) : 0;
}

function won(value: number): string {
  return `${String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}원`;
}

// ---------- 상수 ----------

/**
 * 국민연금 기준소득월액 상·하한. 2025-07~2026-06 400,000~6,370,000, 2026-07~2027-06 410,000~6,590,000(국민연금공단, 확인됨).
 * 2025-07 이전 달에는 이 표의 첫 값을 그대로 쓰므로 근사값이다(대조 필요).
 */
export const NPS_LIMITS = [
  { from: '2026-07', min: 410_000, max: 6_590_000 },
  { from: '0000-00', min: 400_000, max: 6_370_000 },
] as const;

/** 국민연금 요율 9.5%의 근로자 몫 4.75%(확인됨) — 분자/분모. 끝전 10원 미만 절사는 대조 필요. */
const NPS_RATE = { num: 475, den: 10_000 } as const;
/** 건강보험 요율 7.19%의 근로자 몫 3.595%(확인됨). 10원 미만 절사(정보연계센터 예시). */
const HEALTH_RATE = { num: 3595, den: 100_000 } as const;
/** 장기요양 = 건강보험료 × 13.14%(확인됨), 10원 미만 절사. */
const LTC_RATE = { num: 1314, den: 10_000 } as const;
/** 고용보험 근로자 0.9%(확인됨). */
const EMPLOYMENT_WORKER_RATE = { num: 9, den: 1000 } as const;
/** 고용보험 사업주 1.15% = 실업급여 0.9 + 고용안정·직업능력개발 0.25(150인 미만 기준) — 대조 필요. */
const EMPLOYMENT_EMPLOYER_RATE = { num: 115, den: 10_000 } as const;

/** 자녀(8~20세) 세액공제 월 금액. 2026-03 이후 20,830 / 45,830 / 45,830+33,330×(n−2) (별표 2 비고 3, 확인됨). 그 전은 옛 금액(대조 필요). */
export const CHILD_CREDIT_FROM_2026_03 = { one: 20_830, two: 45_830, extra: 33_330 } as const;
export const CHILD_CREDIT_BEFORE_2026_03 = { one: 12_500, two: 29_160, extra: 25_000 } as const;
export const CHILD_CREDIT_CHANGE_MONTH = '2026-03';

/** 비과세 식대 월 한도 20만 원(2차 근거, 대조 필요). 초과분은 과세. */
export const MEAL_TAX_FREE_LIMIT = 200_000;

/** 2026 최저임금 시급(2차 근거, 대조 필요). 월 환산 2,156,880원(209시간). */
export const MIN_WAGE_2026 = 10_320;

/** 선임 요양보호사 수당 월 15만 원(복지부 보도자료, 대조 필요: 주야간보호 확대 범위). */
export const SENIOR_CAREGIVER_ALLOWANCE = 150_000;

/** 가산율: 연장 1.5배, 야간 가산분 0.5배, 휴일(8시간 이내) 1.5배, 휴일 8시간 초과 2.0배(근로기준법 제56조). 5인 미만 사업장은 적용되지 않을 수 있다(대조 필요). */
const OVERTIME_PERCENT = 150;
const NIGHT_EXTRA_PERCENT = 50;
const HOLIDAY_PERCENT = 150;
const HOLIDAY_OVER8_PERCENT = 200;

export const MAX_OTHER_LINES = 10;
/** 한 달 근로시간 입력 상한(31일 × 24시간) */
export const MAX_MONTH_HOURS = 744;

// ---------- 4대보험 ----------

export interface InsuranceEnrolled {
  nps: boolean;
  health: boolean;
  employment: boolean;
}

export interface InsurancePremiums {
  nps: number;
  health: number;
  ltc: number;
  employment: number;
  employerNps: number;
  employerHealth: number;
  employerLtc: number;
  employerEmployment: number;
}

export function npsLimitsFor(payMonth: string): { min: number; max: number } {
  const row = NPS_LIMITS.find((r) => payMonth >= r.from) ?? NPS_LIMITS[NPS_LIMITS.length - 1];
  return { min: row.min, max: row.max };
}

/**
 * 국민연금 근로자 몫. 기준소득월액 = 과세 급여를 천 원 미만 절사한 뒤 상·하한을 적용한다.
 * 급여가 0이면 보험료도 0이다(하한을 적용하지 않는다).
 */
export function npsPremium(taxablePay: number, payMonth: string): number {
  const pay = wholeWon(taxablePay);
  if (pay === 0) return 0;
  const { min, max } = npsLimitsFor(payMonth);
  const standard = Math.min(max, Math.max(min, pay - (pay % 1000)));
  return floorTo10(floorDiv(standard * NPS_RATE.num, NPS_RATE.den));
}

/** 건강보험 근로자 몫. 보수월액 상·하한은 적용하지 않는다(대조 필요). */
export function healthPremium(taxablePay: number): number {
  return floorTo10(floorDiv(wholeWon(taxablePay) * HEALTH_RATE.num, HEALTH_RATE.den));
}

export function ltcPremium(healthPremiumWon: number): number {
  return floorTo10(floorDiv(wholeWon(healthPremiumWon) * LTC_RATE.num, LTC_RATE.den));
}

export function insurancePremiums(params: { taxablePay: number; payMonth: string; enrolled: InsuranceEnrolled }): InsurancePremiums {
  const { taxablePay, payMonth, enrolled } = params;
  const pay = wholeWon(taxablePay);
  const nps = enrolled.nps ? npsPremium(pay, payMonth) : 0;
  const health = enrolled.health ? healthPremium(pay) : 0;
  const ltc = enrolled.health ? ltcPremium(health) : 0;
  const employment = enrolled.employment ? floorTo10(floorDiv(pay * EMPLOYMENT_WORKER_RATE.num, EMPLOYMENT_WORKER_RATE.den)) : 0;
  const employerEmployment = enrolled.employment ? floorTo10(floorDiv(pay * EMPLOYMENT_EMPLOYER_RATE.num, EMPLOYMENT_EMPLOYER_RATE.den)) : 0;
  // 국민연금·건강보험·장기요양은 사업주도 근로자와 같은 금액을 부담한다.
  return { nps, health, ltc, employment, employerNps: nps, employerHealth: health, employerLtc: ltc, employerEmployment };
}

// ---------- 소득세·지방소득세 ----------

export function childCredit(children: number, payMonth: string): number {
  const n = Math.max(0, Math.floor(Number.isFinite(children) ? children : 0));
  if (n === 0) return 0;
  const table = payMonth >= CHILD_CREDIT_CHANGE_MONTH ? CHILD_CREDIT_FROM_2026_03 : CHILD_CREDIT_BEFORE_2026_03;
  if (n === 1) return table.one;
  return table.two + table.extra * (n - 2);
}

export function isWithholdingRate(value: unknown): value is WithholdingRate {
  return value === 80 || value === 100 || value === 120;
}

/**
 * 간이세액표 소득세 = (표 세액 − 자녀 공제, 음수면 0) × 선택 비율(80·100·120%), 10원 미만 절사.
 * 지방소득세 = 소득세 × 10%, 10원 미만 절사(끝전 규칙은 대조 필요).
 * taxablePay는 비과세·학자금을 뺀 월급여다. 선택 비율이 80·100·120이 아니면 100으로 본다(저장 전 검증이 거른다).
 */
export function withholdingTax(params: { taxablePay: number; dependents: number; children: number; rate: number; payMonth: string }): { incomeTax: number; localTax: number } {
  const base = withholdingBaseTax(wholeWon(params.taxablePay), params.dependents);
  const afterCredit = Math.max(0, base - childCredit(params.children, params.payMonth));
  const rate = isWithholdingRate(params.rate) ? params.rate : 100;
  const incomeTax = floorTo10(floorDiv(afterCredit * rate, 100));
  const localTax = floorTo10(floorDiv(incomeTax, 10));
  return { incomeTax, localTax };
}

// ---------- 시급·가산수당 ----------

/** 월 소정근로시간. 주 40시간이면 209, 그 밖은 round((주 시간 + 주 시간/5) × 365 ÷ 7 ÷ 12)(계약 식 — 주 15시간 미만·40시간 초과 보정은 대조 필요). */
export function monthlyHoursOf(weeklyHours: number): number {
  const w10 = tenths(weeklyHours);
  if (w10 === 400) return 209;
  // (w + w/5) × 365/84 = w × 438/84 = w × 73/14, w = w10/10 → w10 × 73 / 140, 반올림
  return floorDiv(2 * w10 * 73 + 140, 280);
}

type HourlyBasis = Pick<PayrollProfile, 'payType' | 'baseAmount' | 'weeklyHours'>;

/** 통상시급(원, 원 미만 반올림). 시급제는 기준 금액, 월급제는 월급 ÷ 월 소정근로시간. 반올림 방식은 대조 필요. */
export function hourlyWageOf(profile: HourlyBasis): number {
  const base = wholeWon(profile.baseAmount);
  if (profile.payType === 'HOURLY') return base;
  const hours = monthlyHoursOf(profile.weeklyHours);
  if (hours === 0) return 0;
  return floorDiv(2 * base + hours, 2 * hours);
}

export interface ExtraHours {
  overtime: number;
  night: number;
  holiday: number;
  holidayOver8: number;
}

export interface ExtraPay {
  overtimePay: number;
  nightPay: number;
  holidayPay: number;
  /** 휴일근로 8시간 초과분 수당(×2.0). 급여대장 한 줄에서는 holidayPay에 합쳐 저장한다. */
  holidayOver8: number;
}

function premiumPay(hourly: number, hours: number, percent: number): number {
  return floorDiv(wholeWon(hourly) * tenths(hours) * percent, 1000);
}

/**
 * 가산수당 — 각각 원 미만 절사. 연장 ×1.5, 야간은 가산분 ×0.5만(야간에 한 시간의 기본급은 소정·연장 시간에 이미 들어 있다),
 * 휴일 8시간 이내 ×1.5, 휴일 8시간 초과분 ×2.0. 시간은 0.1시간 단위.
 */
export function extraPay(hourly: number, hours: ExtraHours): ExtraPay {
  return {
    overtimePay: premiumPay(hourly, hours.overtime, OVERTIME_PERCENT),
    nightPay: premiumPay(hourly, hours.night, NIGHT_EXTRA_PERCENT),
    holidayPay: premiumPay(hourly, hours.holiday, HOLIDAY_PERCENT),
    holidayOver8: premiumPay(hourly, hours.holidayOver8, HOLIDAY_OVER8_PERCENT),
  };
}

// ---------- 장기근속장려금·선임수당 ----------

/** 장기근속장려금 대상 직종: 요양보호사·사회복지사·간호사·간호조무사·물리/작업치료사·조리원·영양사·위생원 */
export const LONG_SERVICE_JOB_TYPES: readonly PayrollJobType[] = ['CAREGIVER', 'SOCIAL_WORKER', 'NURSE', 'NURSE_AIDE', 'THERAPIST', 'COOK', 'NUTRITIONIST', 'SANITATION'];

/**
 * 근속 단계별 월 금액(원). 1~3년 50,000, 3·5·7년 이상 재가 110,000·130,000·150,000, 입소형 140,000·160,000·180,000.
 * 주야간보호가 어느 쪽인지는 확인되지 않았다(대조 필요) — 기본은 재가·방문형(HOME)이다.
 */
export const LONG_SERVICE_AMOUNTS = {
  HOME: { y1: 50_000, y3: 110_000, y5: 130_000, y7: 150_000 },
  RESIDENTIAL: { y1: 50_000, y3: 140_000, y5: 160_000, y7: 180_000 },
} as const;

/** 입사일부터 그 달 말일까지 만 N년을 채웠는가. 윤일(2/29) 입사는 평년에는 2/28을 기념일로 본다. */
function hasServedYears(hireDate: string, payMonth: string, years: number): boolean {
  const hire = parseYmd(hireDate);
  if (!hire || !isValidMonth(payMonth)) return false;
  const endYear = Number(payMonth.slice(0, 4));
  const endMonth = Number(payMonth.slice(5, 7));
  const endKey = endYear * 10_000 + endMonth * 100 + daysInMonth(endYear, endMonth);
  const targetYear = hire.year + years;
  const targetDay = Math.min(hire.day, daysInMonth(targetYear, hire.month));
  return targetYear * 10_000 + hire.month * 100 + targetDay <= endKey;
}

/** 근속 개월 수가 아니라 "그 달 말일 기준 만 근속 연수"(0이면 1년 미만, 입사 전이어도 0). */
export function serviceYears(hireDate: string, payMonth: string): number {
  let years = 0;
  while (years < 60 && hasServedYears(hireDate, payMonth, years + 1)) years += 1;
  return years;
}

export function longServiceAward(profile: Pick<PayrollProfile, 'hireDate' | 'jobType'>, payMonth: string, facility: LongServiceFacility = 'HOME'): number {
  if (!LONG_SERVICE_JOB_TYPES.includes(profile.jobType)) return 0;
  const years = serviceYears(profile.hireDate, payMonth);
  const table = LONG_SERVICE_AMOUNTS[facility === 'RESIDENTIAL' ? 'RESIDENTIAL' : 'HOME'];
  if (years >= 7) return table.y7;
  if (years >= 5) return table.y5;
  if (years >= 3) return table.y3;
  if (years >= 1) return table.y1;
  return 0;
}

export function seniorAllowanceOf(profile: Pick<PayrollProfile, 'jobType' | 'seniorCaregiver'>): number {
  return profile.jobType === 'CAREGIVER' && profile.seniorCaregiver ? SENIOR_CAREGIVER_ALLOWANCE : 0;
}

// ---------- 최저임금 ----------

/**
 * 시급 환산이 2026 최저임금에 못 미치면 경고 문장, 아니면 null.
 * 월급제는 시급으로 나눠 반올림하지 않고 "월급 < 최저시급 × 월 소정근로시간"으로 정수 비교한다.
 */
export function minimumWageIssue(profile: HourlyBasis): string | null {
  const base = wholeWon(profile.baseAmount);
  if (profile.payType === 'HOURLY') {
    return base < MIN_WAGE_2026 ? `시급 ${won(base)}은 2026년 최저임금 ${won(MIN_WAGE_2026)}보다 낮습니다 (대조 필요)` : null;
  }
  const hours = monthlyHoursOf(profile.weeklyHours);
  if (hours === 0) return null;
  const minMonthly = MIN_WAGE_2026 * hours;
  if (base >= minMonthly) return null;
  return `월급 ${won(base)}은 시급으로 바꾸면 약 ${won(hourlyWageOf(profile))}으로, 2026년 최저임금 ${won(MIN_WAGE_2026)}(월 ${hours}시간 기준 월 ${won(minMonthly)})보다 낮습니다 (대조 필요)`;
}

// ---------- 급여대장 한 줄 ----------

export type PayrollProfileCalc = Pick<
  PayrollProfile,
  'payType' | 'baseAmount' | 'weeklyHours' | 'dependents' | 'children' | 'withholdingRate' | 'mealAllowance' | 'hireDate' | 'jobType' | 'seniorCaregiver' | 'npsEnrolled' | 'healthEnrolled' | 'employmentEnrolled'
>;

/** buildPayrollLine이 돌려주는 금액 전부 — 직원 번호(memberId)만 빠진 저장 본문이다. */
export type PayrollLineAmounts = Omit<PayrollLineInput, 'memberId'>;

export interface BuildPayrollOptions {
  /** 장기근속장려금 기준(기본 재가·방문형) */
  facility?: LongServiceFacility;
}

function cleanAllowances(list: PayrollExtras['otherAllowances'] | undefined): PayrollExtras['otherAllowances'] {
  return (list ?? []).slice(0, MAX_OTHER_LINES).map((a) => ({ label: String(a?.label ?? '').trim(), amount: wholeWon(a?.amount), taxable: a?.taxable !== false }));
}

function cleanDeductions(list: PayrollExtras['otherDeductions'] | undefined): PayrollExtras['otherDeductions'] {
  return (list ?? []).slice(0, MAX_OTHER_LINES).map((d) => ({ label: String(d?.label ?? '').trim(), amount: wholeWon(d?.amount) }));
}

/**
 * 한 직원의 한 달 급여를 계산한다. 서버 검증 규칙과 같은 합이다.
 *  - 총지급 = 기본급 + 연장 + 야간 + 휴일 + 장기근속장려금 + 선임수당 + 기타수당 합 + 비과세 식대
 *  - 과세 = 총지급 − 비과세 식대(한도 20만 원, 초과분은 과세) − 비과세로 표시한 기타수당
 *  - 실지급 = 총지급 − (국민연금 + 건강보험 + 장기요양 + 고용보험 + 소득세 + 지방소득세 + 기타 공제 합)
 * 월급제는 월급 전액을 기본급으로 둔다(결근·지각 공제는 기타 공제 줄로 넣는다). 시급제는 시급 × 소정근로시간이며,
 * 주휴수당은 소정근로시간에 주휴시간을 더해 입력하는 방식이다(자동 가산 없음 — 대조 필요).
 */
export function buildPayrollLine(profile: PayrollProfileCalc, hours: PayrollHours, extras: PayrollExtras, payMonth: string, options: BuildPayrollOptions = {}): PayrollLineAmounts {
  const hourly = hourlyWageOf(profile);
  const regularH10 = tenths(hours.regularHours);
  const basePay = profile.payType === 'HOURLY' ? floorDiv(wholeWon(profile.baseAmount) * regularH10, 10) : wholeWon(profile.baseAmount);
  const extra = extraPay(hourly, { overtime: hours.overtimeHours, night: hours.nightHours, holiday: hours.holidayHours, holidayOver8: hours.holidayOver8Hours });
  const holidayPay = extra.holidayPay + extra.holidayOver8;
  const award = longServiceAward(profile, payMonth, options.facility ?? 'HOME');
  const senior = seniorAllowanceOf(profile);
  const otherAllowances = cleanAllowances(extras.otherAllowances);
  const otherDeductions = cleanDeductions(extras.otherDeductions);
  const meal = wholeWon(profile.mealAllowance);

  const otherAllowanceSum = otherAllowances.reduce((sum, a) => sum + a.amount, 0);
  const nonTaxableOthers = otherAllowances.reduce((sum, a) => sum + (a.taxable ? 0 : a.amount), 0);
  const grossPay = basePay + extra.overtimePay + extra.nightPay + holidayPay + award + senior + otherAllowanceSum + meal;
  const taxablePay = grossPay - Math.min(meal, MEAL_TAX_FREE_LIMIT) - nonTaxableOthers;

  const premiums = insurancePremiums({ taxablePay, payMonth, enrolled: { nps: profile.npsEnrolled, health: profile.healthEnrolled, employment: profile.employmentEnrolled } });
  const tax = withholdingTax({ taxablePay, dependents: profile.dependents, children: profile.children, rate: profile.withholdingRate, payMonth });
  const deductionSum = premiums.nps + premiums.health + premiums.ltc + premiums.employment + tax.incomeTax + tax.localTax + otherDeductions.reduce((sum, d) => sum + d.amount, 0);

  return {
    payMonth,
    regularHours: regularH10 / 10,
    overtimeHours: tenths(hours.overtimeHours) / 10,
    nightHours: tenths(hours.nightHours) / 10,
    holidayHours: tenths(hours.holidayHours) / 10,
    holidayOver8Hours: tenths(hours.holidayOver8Hours) / 10,
    basePay,
    overtimePay: extra.overtimePay,
    nightPay: extra.nightPay,
    holidayPay,
    longServiceAward: award,
    seniorAllowance: senior,
    otherAllowances,
    mealAllowance: meal,
    grossPay,
    taxablePay,
    nps: premiums.nps,
    health: premiums.health,
    ltc: premiums.ltc,
    employment: premiums.employment,
    incomeTax: tax.incomeTax,
    localTax: tax.localTax,
    otherDeductions,
    netPay: grossPay - deductionSum,
    employerNps: premiums.employerNps,
    employerHealth: premiums.employerHealth,
    employerLtc: premiums.employerLtc,
    employerEmployment: premiums.employerEmployment,
  };
}

// ---------- 입력 검증 (저장 전에 화면이 쓴다. 서버도 같은 한도로 다시 검사한다) ----------

const JOB_TYPES: readonly PayrollJobType[] = ['CAREGIVER', 'SOCIAL_WORKER', 'NURSE', 'NURSE_AIDE', 'THERAPIST', 'COOK', 'NUTRITIONIST', 'DRIVER', 'SANITATION', 'OFFICE', 'DIRECTOR', 'OTHER'];
const PAY_TYPES: readonly PayrollPayType[] = ['MONTHLY', 'HOURLY'];

export function isPayrollJobType(value: unknown): value is PayrollJobType {
  return typeof value === 'string' && (JOB_TYPES as readonly string[]).includes(value);
}

/** 직원 급여 기준의 오류 문장 목록(비어 있으면 통과). 서버 한도와 같다. */
export function profileIssues(p: PayrollProfileCalc): string[] {
  const issues: string[] = [];
  const int = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
  if (!isPayrollJobType(p.jobType)) issues.push('직종을 골라 주세요');
  if (!(PAY_TYPES as readonly string[]).includes(p.payType)) issues.push('급여 방식을 골라 주세요');
  if (!int(p.baseAmount, 1, 20_000_000)) issues.push('월급·시급은 1원 이상 20,000,000원 이하 정수여야 합니다');
  if (!(typeof p.weeklyHours === 'number' && Number.isFinite(p.weeklyHours) && p.weeklyHours >= 1 && p.weeklyHours <= 52 && Math.round(p.weeklyHours * 10) === p.weeklyHours * 10)) issues.push('주 소정근로시간은 1~52시간(소수 한 자리)이어야 합니다');
  if (!int(p.dependents, 1, 11)) issues.push('공제대상가족은 본인 포함 1~11명이어야 합니다');
  if (!int(p.children, 0, 10)) issues.push('8~20세 자녀는 0~10명이어야 합니다');
  if (int(p.children, 0, 10) && int(p.dependents, 1, 11) && p.children > p.dependents - 1) issues.push('자녀 수는 공제대상가족(본인 제외)보다 많을 수 없습니다');
  if (!isWithholdingRate(p.withholdingRate)) issues.push('원천징수 비율은 80·100·120% 중 하나여야 합니다');
  if (!int(p.mealAllowance, 0, 200_000)) issues.push('식대는 0~200,000원이어야 합니다');
  if (!parseYmd(p.hireDate)) issues.push('입사일을 날짜로 적어 주세요');
  return issues;
}

/** 한 달 입력의 오류 문장 목록(비어 있으면 통과) */
export function lineIssues(hours: PayrollHours, extras: PayrollExtras, line?: Pick<PayrollLineAmounts, 'netPay'>): string[] {
  const issues: string[] = [];
  const hourFields: Array<[number, string]> = [
    [hours.regularHours, '소정근로시간'],
    [hours.overtimeHours, '연장근로시간'],
    [hours.nightHours, '야간근로시간'],
    [hours.holidayHours, '휴일근로시간'],
    [hours.holidayOver8Hours, '휴일 8시간 초과 시간'],
  ];
  for (const [value, label] of hourFields) {
    if (!(typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= MAX_MONTH_HOURS && Math.round(value * 10) === value * 10)) issues.push(`${label}은 0 이상 ${MAX_MONTH_HOURS}시간 이하, 소수 한 자리여야 합니다`);
  }
  if (extras.otherAllowances.length > MAX_OTHER_LINES) issues.push(`기타 수당은 ${MAX_OTHER_LINES}줄까지 넣을 수 있습니다`);
  if (extras.otherDeductions.length > MAX_OTHER_LINES) issues.push(`기타 공제는 ${MAX_OTHER_LINES}줄까지 넣을 수 있습니다`);
  for (const a of extras.otherAllowances) if (!Number.isInteger(a.amount) || a.amount < 0) issues.push('기타 수당 금액은 0 이상의 정수여야 합니다');
  for (const d of extras.otherDeductions) if (!Number.isInteger(d.amount) || d.amount < 0) issues.push('기타 공제 금액은 0 이상의 정수여야 합니다');
  if (line && line.netPay < 0) issues.push('공제 합이 총지급보다 커서 실지급이 음수입니다');
  return issues;
}

/** 서버가 확인하는 합 규칙(총지급·실지급)이 맞는지 — 화면이 저장 직전에 한 번 더 본다. */
export function lineTotalsConsistent(line: PayrollLineAmounts): boolean {
  const gross = line.basePay + line.overtimePay + line.nightPay + line.holidayPay + line.longServiceAward + line.seniorAllowance + line.mealAllowance + line.otherAllowances.reduce((s, a) => s + a.amount, 0);
  const deductions = line.nps + line.health + line.ltc + line.employment + line.incomeTax + line.localTax + line.otherDeductions.reduce((s, d) => s + d.amount, 0);
  return line.grossPay === gross && line.netPay === gross - deductions;
}
