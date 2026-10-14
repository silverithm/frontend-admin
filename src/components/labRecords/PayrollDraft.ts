/**
 * 급여대장 화면의 입력 상태와 계산 — 직원별 급여 기준 초안, 월 급여 한 줄 초안, 줄 상태 판정.
 * 계산은 전부 payrollRules의 buildPayrollLine이 한다. 여기서는 입력 글자를 숫자로 바꾸고, 저장된 줄과 다른지만 가린다.
 */
import { buildPayrollLine, hourlyWageOf, lineIssues, lineTotalsConsistent, minimumWageIssue, monthlyHoursOf, profileIssues } from '@/lib/lab/payrollRules';
import type { PayrollLineAmounts, PayrollProfileCalc } from '@/lib/lab/payrollRules';
import type { LongServiceFacility, PayrollExtras, PayrollHours, PayrollJobType, PayrollLine, PayrollPayType, PayrollProfile, PayrollProfileInput, WithholdingRate } from '@/lib/lab/labTypes';
import { numberText, parseDecimal } from './recordsFormat';

export const JOB_OPTIONS: ReadonlyArray<{ value: PayrollJobType; label: string }> = [
  { value: 'CAREGIVER', label: '요양보호사' },
  { value: 'SOCIAL_WORKER', label: '사회복지사' },
  { value: 'NURSE', label: '간호사' },
  { value: 'NURSE_AIDE', label: '간호조무사' },
  { value: 'THERAPIST', label: '물리·작업치료사' },
  { value: 'COOK', label: '조리원' },
  { value: 'NUTRITIONIST', label: '영양사' },
  { value: 'DRIVER', label: '운전원' },
  { value: 'SANITATION', label: '위생원' },
  { value: 'OFFICE', label: '사무원' },
  { value: 'DIRECTOR', label: '시설장' },
  { value: 'OTHER', label: '기타' },
];

export function jobLabel(job: PayrollJobType): string {
  return JOB_OPTIONS.find((o) => o.value === job)?.label ?? job;
}

export const PAY_TYPE_LABEL: Record<PayrollPayType, string> = { MONTHLY: '월급제', HOURLY: '시급제' };
export const FACILITY_LABEL: Record<LongServiceFacility, string> = { HOME: '재가·방문형', RESIDENTIAL: '입소형' };

// ---------- 직원별 급여 기준 ----------

export interface ProfileDraft {
  jobType: PayrollJobType;
  payType: PayrollPayType;
  baseAmount: number | null;
  weeklyHours: string;
  dependents: number | null;
  children: number | null;
  withholdingRate: WithholdingRate;
  mealAllowance: number | null;
  hireDate: string;
  seniorCaregiver: boolean;
  npsEnrolled: boolean;
  healthEnrolled: boolean;
  employmentEnrolled: boolean;
}

export function emptyProfileDraft(): ProfileDraft {
  return {
    jobType: 'CAREGIVER',
    payType: 'HOURLY',
    baseAmount: null,
    weeklyHours: '40',
    dependents: 1,
    children: 0,
    withholdingRate: 100,
    mealAllowance: 0,
    hireDate: '',
    seniorCaregiver: false,
    npsEnrolled: true,
    healthEnrolled: true,
    employmentEnrolled: true,
  };
}

export function profileDraftOf(p: PayrollProfile): ProfileDraft {
  return {
    jobType: p.jobType,
    payType: p.payType,
    baseAmount: p.baseAmount,
    weeklyHours: numberText(p.weeklyHours),
    dependents: p.dependents,
    children: p.children,
    withholdingRate: p.withholdingRate,
    mealAllowance: p.mealAllowance,
    hireDate: p.hireDate,
    seniorCaregiver: p.seniorCaregiver,
    npsEnrolled: p.npsEnrolled,
    healthEnrolled: p.healthEnrolled,
    employmentEnrolled: p.employmentEnrolled,
  };
}

/** 계산·검증에 쓰는 모양(저장 본문에서 memberId만 뺀 것) */
export function calcProfileOf(d: ProfileDraft): PayrollProfileCalc {
  return {
    jobType: d.jobType,
    payType: d.payType,
    baseAmount: d.baseAmount ?? 0,
    weeklyHours: parseDecimal(d.weeklyHours) ?? 0,
    dependents: d.dependents ?? 0,
    children: d.children ?? 0,
    withholdingRate: d.withholdingRate,
    mealAllowance: d.mealAllowance ?? 0,
    hireDate: d.hireDate,
    // 선임 요양보호사 수당은 요양보호사만 받는다
    seniorCaregiver: d.jobType === 'CAREGIVER' && d.seniorCaregiver,
    npsEnrolled: d.npsEnrolled,
    healthEnrolled: d.healthEnrolled,
    employmentEnrolled: d.employmentEnrolled,
  };
}

export function profileInputOf(memberId: number, d: ProfileDraft): PayrollProfileInput {
  return { memberId, ...calcProfileOf(d) };
}

export function profileDraftIssues(d: ProfileDraft): string[] {
  return profileIssues(calcProfileOf(d));
}

/** 변경 비교용 글자 */
export function profileSnapshot(d: ProfileDraft): string {
  return JSON.stringify(calcProfileOf(d));
}

/** 급여 기준 한 줄 요약: "요양보호사 · 시급 10,320원 · 주 40시간" */
export function profileSummary(p: Pick<PayrollProfile, 'jobType' | 'payType' | 'baseAmount' | 'weeklyHours'>): string {
  const base = `${p.baseAmount.toLocaleString('ko-KR')}원`;
  return `${jobLabel(p.jobType)} · ${p.payType === 'HOURLY' ? '시급' : '월급'} ${base} · 주 ${p.weeklyHours}시간`;
}

// ---------- 월 급여 한 줄 ----------

export interface AllowDraft {
  label: string;
  amount: number | null;
  taxable: boolean;
}

export interface DeductDraft {
  label: string;
  amount: number | null;
}

export interface RowDraft {
  regular: string;
  overtime: string;
  night: string;
  holiday: string;
  holiday8: string;
  allowances: AllowDraft[];
  deductions: DeductDraft[];
}

export const HOUR_FIELDS = [
  { key: 'regular', label: '정규' },
  { key: 'overtime', label: '연장' },
  { key: 'night', label: '야간' },
  { key: 'holiday', label: '휴일' },
  { key: 'holiday8', label: '휴일 8시간 초과' },
] as const;

export type HourKey = (typeof HOUR_FIELDS)[number]['key'];

const hoursText = (v: number): string => (v === 0 ? '' : numberText(v));

/** 저장된 줄에서 시간·기타 수당·공제를 가져온다(정규 시간 포함) */
export function draftFromLine(line: PayrollLine): RowDraft {
  return {
    regular: numberText(line.regularHours),
    overtime: hoursText(line.overtimeHours),
    night: hoursText(line.nightHours),
    holiday: hoursText(line.holidayHours),
    holiday8: hoursText(line.holidayOver8Hours),
    allowances: line.otherAllowances.map((a) => ({ label: a.label, amount: a.amount, taxable: a.taxable })),
    deductions: line.otherDeductions.map((d) => ({ label: d.label, amount: d.amount })),
  };
}

/** 저장된 줄이 있으면 그 값, 없으면 정규 시간만 월 소정근로시간으로 채운 새 초안 */
export function baseDraft(profile: PayrollProfileCalc, line: PayrollLine | null): RowDraft {
  if (line) return draftFromLine(line);
  return { regular: numberText(monthlyHoursOf(profile.weeklyHours)), overtime: '', night: '', holiday: '', holiday8: '', allowances: [], deductions: [] };
}

export function draftHours(d: RowDraft): PayrollHours {
  const h = (t: string) => parseDecimal(t) ?? 0;
  return { regularHours: h(d.regular), overtimeHours: h(d.overtime), nightHours: h(d.night), holidayHours: h(d.holiday), holidayOver8Hours: h(d.holiday8) };
}

/** 이름도 금액도 비어 있는 줄은 버린다 */
export function draftExtras(d: RowDraft): PayrollExtras {
  return {
    otherAllowances: d.allowances.filter((a) => a.label.trim() !== '' || (a.amount ?? 0) > 0).map((a) => ({ label: a.label.trim(), amount: a.amount ?? 0, taxable: a.taxable })),
    otherDeductions: d.deductions.filter((x) => x.label.trim() !== '' || (x.amount ?? 0) > 0).map((x) => ({ label: x.label.trim(), amount: x.amount ?? 0 })),
  };
}

export function draftSnapshot(d: RowDraft): string {
  return JSON.stringify([d.regular.trim(), d.overtime.trim(), d.night.trim(), d.holiday.trim(), d.holiday8.trim(), draftExtras(d)]);
}

export interface RowCalc {
  amounts: PayrollLineAmounts;
  issues: string[];
}

/** 입력 초안을 급여 한 줄로 즉시 계산하고 오류 문장을 모은다 */
export function calcRow(profile: PayrollProfileCalc, d: RowDraft, month: string, facility: LongServiceFacility): RowCalc {
  const hours = draftHours(d);
  const extras = draftExtras(d);
  const amounts = buildPayrollLine(profile, hours, extras, month, { facility });
  const issues = lineIssues(hours, extras, amounts);
  for (const a of extras.otherAllowances) if (a.label === '') issues.push('기타 수당 항목 이름을 적어 주세요');
  for (const x of extras.otherDeductions) if (x.label === '') issues.push('기타 공제 항목 이름을 적어 주세요');
  if (!lineTotalsConsistent(amounts)) issues.push('계산 합이 맞지 않습니다. 입력을 다시 확인해 주세요');
  return { amounts, issues: [...new Set(issues)] };
}

/** 저장된 줄과 계산값이 같은지 비교하는 글자(프로필이 바뀌어 금액이 달라진 줄도 잡아낸다) */
export function amountsKey(a: PayrollLineAmounts): string {
  return JSON.stringify([
    a.payMonth, a.regularHours, a.overtimeHours, a.nightHours, a.holidayHours, a.holidayOver8Hours,
    a.basePay, a.overtimePay, a.nightPay, a.holidayPay, a.longServiceAward, a.seniorAllowance, a.otherAllowances, a.mealAllowance,
    a.grossPay, a.taxablePay, a.nps, a.health, a.ltc, a.employment, a.incomeTax, a.localTax, a.otherDeductions, a.netPay,
    a.employerNps, a.employerHealth, a.employerLtc, a.employerEmployment,
  ]);
}

/**
 * 줄 상태
 *  - locked: 확정된 줄(고칠 수 없다)
 *  - orphan: 급여 기준이 지워진 직원의 저장된 줄(보기만)
 *  - invalid: 입력에 오류가 있어 저장할 수 없다
 *  - new: 아직 저장 안 함
 *  - edited: 저장된 값과 계산값이 다름
 *  - saved: 저장된 값과 같음
 */
export type RowStatus = 'locked' | 'orphan' | 'invalid' | 'new' | 'edited' | 'saved';

export interface MonthRow {
  memberId: number;
  name: string;
  profile: PayrollProfile | null;
  saved: PayrollLine | null;
  draft: RowDraft;
  calc: RowCalc | null;
  /** 화면·합계·명세서에 쓰는 금액(확정·기준 없음은 저장본, 나머지는 계산값) */
  amounts: PayrollLineAmounts;
  status: RowStatus;
  wageIssue: string | null;
}

export function buildRows(
  profiles: ReadonlyArray<PayrollProfile>,
  lines: ReadonlyArray<PayrollLine>,
  edits: Readonly<Record<number, RowDraft | undefined>>,
  month: string,
  facility: LongServiceFacility,
): MonthRow[] {
  const savedBy = new Map(lines.map((l) => [l.memberId, l]));
  const rows: MonthRow[] = [];
  for (const profile of profiles) {
    const saved = savedBy.get(profile.memberId) ?? null;
    const draft = edits[profile.memberId] ?? baseDraft(profile, saved);
    const calc = calcRow(profile, draft, month, facility);
    let status: RowStatus;
    if (saved?.status === 'CONFIRMED') status = 'locked';
    else if (calc.issues.length > 0) status = 'invalid';
    else if (!saved) status = 'new';
    else status = amountsKey(calc.amounts) === amountsKey(saved) ? 'saved' : 'edited';
    rows.push({
      memberId: profile.memberId,
      name: profile.memberName ?? `직원 ${profile.memberId}`,
      profile,
      saved,
      draft,
      calc,
      amounts: status === 'locked' && saved ? saved : calc.amounts,
      status,
      wageIssue: minimumWageIssue(profile),
    });
  }
  const known = new Set(profiles.map((p) => p.memberId));
  for (const line of lines) {
    if (known.has(line.memberId)) continue;
    rows.push({ memberId: line.memberId, name: line.memberName ?? `직원 ${line.memberId}`, profile: null, saved: line, draft: draftFromLine(line), calc: null, amounts: line, status: 'orphan', wageIssue: null });
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}

export interface MonthTotals {
  headcount: number;
  gross: number;
  deductions: number;
  net: number;
  employer: number;
  employerNps: number;
  employerHealth: number;
  employerLtc: number;
  employerEmployment: number;
}

export function monthTotals(rows: ReadonlyArray<MonthRow>): MonthTotals {
  const t: MonthTotals = { headcount: rows.length, gross: 0, deductions: 0, net: 0, employer: 0, employerNps: 0, employerHealth: 0, employerLtc: 0, employerEmployment: 0 };
  for (const r of rows) {
    const a = r.amounts;
    t.gross += a.grossPay;
    t.net += a.netPay;
    t.employerNps += a.employerNps;
    t.employerHealth += a.employerHealth;
    t.employerLtc += a.employerLtc;
    t.employerEmployment += a.employerEmployment;
  }
  t.deductions = t.gross - t.net;
  t.employer = t.employerNps + t.employerHealth + t.employerLtc + t.employerEmployment;
  return t;
}

/** 근로자 공제 합 = 총지급 − 실지급 */
export const deductionTotal = (a: Pick<PayrollLineAmounts, 'grossPay' | 'netPay'>): number => a.grossPay - a.netPay;

/** 통상시급·월 소정근로시간 — 명세서 산출 근거에 쓴다 */
export function wageBasis(profile: PayrollProfileCalc): { hourly: number; monthlyHours: number } {
  return { hourly: hourlyWageOf(profile), monthlyHours: monthlyHoursOf(profile.weeklyHours) };
}

export const MAX_EXTRA_LINES = 10;
