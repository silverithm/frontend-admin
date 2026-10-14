/**
 * 본인부담금 청구서 입력 만들기 — 금액 계산은 ltc2026.ts(고시 수가표)가 하고, 이 파일은 그 결과를 서버 계약 모양으로 옮긴다.
 * 서버는 비급여 합계와 청구 합계를 스스로 다시 계산하므로(권위 있는 쪽), 여기서는 같은 규칙을 거울로 두고 입력 검증만 한다.
 */
import { MAX_DAYS_IN_MONTH, calcDaycareCopay, formatWon } from '../ltc2026.ts';
import type { CopayBill, CopayBillInput, CopayClass, CopayStatus, DaycareUnit, HourBand, LtcCareGrade, NonCoveredItem } from './labTypes.ts';
import { isValidMonth } from './labDate.ts';

/** 서버와 같은 한도 */
export const MAX_NON_COVERED_ITEMS = 20;
export const MAX_NON_COVERED_LABEL = 40;
export const MAX_MONEY = 100_000_000;

const LTC_GRADE_BY_ELDER: Record<string, LtcCareGrade> = {
  GRADE_1: '1',
  GRADE_2: '2',
  GRADE_3: '3',
  GRADE_4: '4',
  GRADE_5: '5',
  COGNITIVE_SUPPORT: 'cognitive',
};

/**
 * 어르신 프로필의 등급(types/elderly.ts CareGrade)을 수가표 등급으로 바꾼다.
 * 등급 없음(NONE)이나 비어 있는 값은 null — 청구를 만들 수 없는 상태라는 뜻이다.
 */
export function elderGradeToLtc(careGrade: string | null | undefined): LtcCareGrade | null {
  if (typeof careGrade !== 'string') return null;
  return Object.hasOwn(LTC_GRADE_BY_ELDER, careGrade) ? LTC_GRADE_BY_ELDER[careGrade] : null;
}

export interface BuildCopayParams {
  elderlyId: number;
  billMonth: string;
  careGrade: LtcCareGrade;
  copayClass: CopayClass;
  daycareUnit: DaycareUnit;
  hourBand: HourBand;
  days: number;
  nonCoveredItems: ReadonlyArray<{ label: string; amount: number }>;
  previousUnpaid: number;
}

export type BuildCopayResult = CopayBillInput | { error: string };

export function isBuildError(result: BuildCopayResult): result is { error: string } {
  return 'error' in result;
}

function isMoney(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_MONEY;
}

/**
 * 비급여 항목 정리 — 이름도 금액도 비어 있는 줄(화면의 빈 입력줄)은 버리고,
 * 금액만 있고 이름이 없거나 이름만 있고 금액이 음수/소수인 줄은 오류로 돌려준다.
 */
export function cleanNonCoveredItems(
  items: ReadonlyArray<{ label: string; amount: number }>,
): { items: NonCoveredItem[] } | { error: string } {
  const out: NonCoveredItem[] = [];
  for (const raw of items) {
    const label = typeof raw?.label === 'string' ? raw.label.trim() : '';
    const amount = raw?.amount;
    if (label === '' && (amount === 0 || amount === undefined || amount === null || Number.isNaN(amount))) continue;
    if (label === '') return { error: '비급여 항목 이름을 적어 주세요' };
    if (label.length > MAX_NON_COVERED_LABEL) return { error: `비급여 항목 이름은 ${MAX_NON_COVERED_LABEL}자까지 적을 수 있습니다` };
    if (!isMoney(amount)) return { error: `'${label}' 금액은 0원 이상의 정수여야 합니다` };
    out.push({ label, amount });
  }
  if (out.length > MAX_NON_COVERED_ITEMS) return { error: `비급여 항목은 ${MAX_NON_COVERED_ITEMS}개까지 넣을 수 있습니다` };
  return { items: out };
}

/** 서버가 다시 계산하는 합계와 같은 식 — 화면 미리보기용. */
export function billTotals(input: Pick<CopayBillInput, 'copayAmount' | 'overLimitAmount' | 'nonCoveredItems' | 'previousUnpaid'>) {
  const nonCoveredAmount = input.nonCoveredItems.reduce((sum, i) => sum + i.amount, 0);
  const totalDue = input.copayAmount + input.overLimitAmount + nonCoveredAmount + input.previousUnpaid;
  return { nonCoveredAmount, totalDue };
}

/** 납부 상태 — 서버 규칙: 청구액 0원이거나 낸 돈이 청구액 이상이면 PAID, 일부만 냈으면 PARTIAL. */
export function billStatus(totalDue: number, paidAmount: number): CopayStatus {
  if (totalDue === 0 || paidAmount >= totalDue) return 'PAID';
  return paidAmount > 0 ? 'PARTIAL' : 'UNPAID';
}

export function remainingDue(bill: Pick<CopayBill, 'totalDue' | 'paidAmount'>): number {
  return Math.max(0, bill.totalDue - bill.paidAmount);
}

export function buildCopayBillInput(params: BuildCopayParams): BuildCopayResult {
  if (!Number.isInteger(params.elderlyId) || params.elderlyId <= 0) return { error: '어르신을 선택해 주세요' };
  if (!isValidMonth(params.billMonth)) return { error: '청구 월 형식이 올바르지 않습니다 (예: 2026-10)' };
  if (typeof params.days !== 'number' || !Number.isInteger(params.days) || params.days < 0 || params.days > MAX_DAYS_IN_MONTH) {
    return { error: `이용일수는 0~${MAX_DAYS_IN_MONTH}일 사이의 정수여야 합니다` };
  }
  if (!isMoney(params.previousUnpaid)) return { error: '이전 미납금은 0원 이상의 정수여야 합니다' };

  const cleaned = cleanNonCoveredItems(params.nonCoveredItems ?? []);
  if ('error' in cleaned) return cleaned;

  const calc = calcDaycareCopay({
    grade: params.careGrade,
    unit: params.daycareUnit,
    band: params.hourBand,
    days: params.days,
    copayClass: params.copayClass,
  });
  // 치매전담실 1등급처럼 수가표에 없는 조합, 또는 알 수 없는 코드
  if (!calc) return { error: '선택한 등급·시설 구분·이용 시간의 수가를 찾을 수 없습니다' };

  return {
    elderlyId: params.elderlyId,
    billMonth: params.billMonth,
    careGrade: params.careGrade,
    copayClass: params.copayClass,
    daycareUnit: params.daycareUnit,
    hourBand: params.hourBand,
    days: params.days,
    dailyFee: calc.dailyFee,
    coveredTotal: calc.coveredFee,
    copayAmount: calc.copayWithinLimit,
    overLimitAmount: calc.overLimit,
    nonCoveredItems: cleaned.items,
    previousUnpaid: params.previousUnpaid,
  };
}

function monthLabel(billMonth: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(billMonth);
  return m ? `${m[1]}년 ${Number(m[2])}월` : billMonth;
}

/**
 * 보호자에게 보낼 안내 문자 초안. 계좌는 기관마다 달라 '[계좌]' 자리만 두고 직원이 채운다.
 * 어르신 이름은 보호자에게 가는 글이라 넣는다(AI에는 절대 보내지 않는 경로).
 */
export function copayNoticeText(bill: CopayBill, companyName: string): string {
  const center = companyName?.trim() || '센터';
  const month = monthLabel(bill.billMonth);
  const remaining = remainingDue(bill);
  const lines: string[] = [`[${center}] ${month} 장기요양 본인부담금 안내`, ''];
  lines.push(`${bill.elderlyName} 어르신의 ${month} 이용 내역입니다.`);
  lines.push(`- 이용일수: ${bill.days}일`);
  lines.push(`- 본인부담금: ${formatWon(bill.copayAmount)}`);
  if (bill.overLimitAmount > 0) lines.push(`- 월 한도 초과분: ${formatWon(bill.overLimitAmount)}`);
  for (const item of bill.nonCoveredItems) lines.push(`- ${item.label}(비급여): ${formatWon(item.amount)}`);
  if (bill.previousUnpaid > 0) lines.push(`- 이전 미납금: ${formatWon(bill.previousUnpaid)}`);
  lines.push('');
  lines.push(`청구 합계: ${formatWon(bill.totalDue)}`);
  if (bill.paidAmount > 0) lines.push(`이미 낸 금액: ${formatWon(bill.paidAmount)}`);
  if (remaining > 0) {
    lines.push(`납부하실 금액: ${formatWon(remaining)}`);
    lines.push('납부 계좌: [계좌]');
  } else {
    lines.push('납부가 모두 확인되었습니다. 감사합니다.');
  }
  lines.push('');
  lines.push('문의는 센터로 연락해 주세요.');
  return lines.join('\n');
}

// ---------- 식재료비 ----------

export const MEAL_COST_LABEL = '식재료비';

/**
 * 식재료비 비급여 항목 — 이용일수 × 하루 단가. 주야간보호는 점심·간식 식재료비를 비급여로 받는다.
 * 단가가 0이거나 이용일이 없으면 만들지 않는다(null) — 0원짜리 항목이 청구서에 찍히면 보호자가 오해한다.
 * 정수가 아닌 값·음수, 한도(1억원) 초과도 null: 잘못된 입력으로 청구액이 생기지 않게 한다.
 */
export function mealCostItem(days: number, unitPrice: number): NonCoveredItem | null {
  if (!Number.isInteger(days) || !Number.isInteger(unitPrice) || days <= 0 || unitPrice <= 0) return null;
  const amount = days * unitPrice;
  return amount > MAX_MONEY ? null : { label: MEAL_COST_LABEL, amount };
}

/**
 * 비급여 항목 목록에 식재료비를 반영한다 — 이미 식재료비 줄이 있으면 그 줄만 새 금액으로 바꾸고(직원이 손으로 고친 다른 줄은 그대로),
 * 없으면 맨 앞에 넣는다. 단가가 0이면 식재료비 줄을 뺀다.
 */
export function withMealCost(items: ReadonlyArray<NonCoveredItem>, days: number, unitPrice: number): NonCoveredItem[] {
  const meal = mealCostItem(days, unitPrice);
  const rest = items.filter((i) => i.label.trim() !== MEAL_COST_LABEL);
  if (!meal) return rest;
  const index = items.findIndex((i) => i.label.trim() === MEAL_COST_LABEL);
  if (index < 0) return [meal, ...rest];
  // 첫 식재료비 줄이 있던 자리에 새 금액을 둔다(그 앞은 모두 식재료비가 아닌 줄이다).
  return [...rest.slice(0, index), meal, ...rest.slice(index)];
}

// ---------- 연간 납부 내역 (의료비 공제 증빙) ----------

export interface AnnualPaymentRow {
  billId: number;
  elderlyName: string;
  billMonth: string;
  paidAmount: number;
  lastPaidOn: string | null;
}

/**
 * 그 해(billMonth 기준)에 수납이 있는 청구서를 어르신·월 순으로 뽑는다.
 * 기준을 납부일이 아니라 청구 월로 둔 이유: 12월분을 1월에 내면 보호자는 "작년 이용분"으로 인식하고,
 * 기관의 월별 청구·미수 관리도 청구 월 단위이기 때문이다. (연말정산 증빙은 세무 기준과 대조해 쓴다.)
 * 낸 돈이 0원이거나 음수인 청구서는 뺀다.
 */
export function annualPaymentRows(
  bills: ReadonlyArray<Pick<CopayBill, 'id' | 'elderlyName' | 'billMonth' | 'paidAmount' | 'lastPaidOn'>>,
  year: number,
): AnnualPaymentRow[] {
  const prefix = `${String(year).padStart(4, '0')}-`;
  return bills
    .filter((b) => typeof b.billMonth === 'string' && b.billMonth.startsWith(prefix) && isValidMonth(b.billMonth) && b.paidAmount > 0)
    .map((b) => ({ billId: b.id, elderlyName: b.elderlyName, billMonth: b.billMonth, paidAmount: b.paidAmount, lastPaidOn: b.lastPaidOn ?? null }))
    .sort((a, b) => a.elderlyName.localeCompare(b.elderlyName, 'ko') || a.billMonth.localeCompare(b.billMonth));
}

/** 어르신별 연간 납부 합계(어르신 이름순) — 어르신별 납부확인서 머리말용 */
export function annualPaymentTotals(rows: ReadonlyArray<Pick<AnnualPaymentRow, 'elderlyName' | 'paidAmount'>>): Array<{ elderlyName: string; paidAmount: number }> {
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.elderlyName, (map.get(r.elderlyName) ?? 0) + r.paidAmount);
  return [...map.entries()].map(([elderlyName, paidAmount]) => ({ elderlyName, paidAmount })).sort((a, b) => a.elderlyName.localeCompare(b.elderlyName, 'ko'));
}

// ---------- CSV ----------

export interface CsvHeader<T> {
  key: keyof T & string;
  label: string;
}

/**
 * 셀 하나를 CSV 규칙으로 감싼다. 쉼표·큰따옴표·줄바꿈이 있으면 큰따옴표로 감싸고 안의 큰따옴표는 두 개로 쓴다.
 * 숫자는 그대로(따옴표·콤마 없이) 써야 엑셀이 숫자로 읽는다. 값이 없으면 빈 칸.
 * 문자열이 = + - @ 로 시작하면 엑셀이 수식으로 실행할 수 있어 앞에 작은따옴표를 붙인다(이름 칸에 누가 "=…"를 적어도 안전).
 */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * 표를 CSV 문자열로 만든다. 맨 앞에 BOM(﻿)을 붙여야 엑셀이 UTF-8 한글을 깨뜨리지 않고 연다.
 * 줄 구분은 CRLF(RFC 4180). 첫 줄은 headers의 label, 이후는 key 순서대로.
 */
export function toCsv<T extends object>(rows: ReadonlyArray<T>, headers: ReadonlyArray<CsvHeader<T>>): string {
  const lines = [headers.map((h) => csvCell(h.label)).join(',')];
  for (const row of rows) lines.push(headers.map((h) => csvCell((row as Record<string, unknown>)[h.key])).join(','));
  return `﻿${lines.join('\r\n')}`;
}
