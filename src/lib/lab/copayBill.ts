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
