/**
 * 본인부담금 한 줄(어르신 한 명)의 입력 초안과 계산 연결.
 * 계산식은 lib/lab/copayBill의 buildCopayBillInput 하나뿐이다 — 여기서는 입력값을 그 함수가 받는 모양으로 옮기기만 한다.
 */
import { MEAL_COST_LABEL, buildCopayBillInput, elderGradeToLtc, isBuildError, mealCostItem, remainingDue } from '@/lib/lab/copayBill';
import type { BuildCopayResult } from '@/lib/lab/copayBill';
import type { CopayBill, CopayClass, DaycareUnit, HourBand, LtcCareGrade } from '@/lib/lab/labTypes';
import type { LabElder } from './useLabElders';

export interface ItemDraft {
  /** 화면에서 줄을 구분하는 키 */
  key: number;
  label: string;
  amount: number | null;
}

export interface CopayDraft {
  grade: LtcCareGrade | '';
  copayClass: CopayClass;
  unit: DaycareUnit;
  band: HourBand;
  days: number | null;
  items: ItemDraft[];
  previousUnpaid: number | null;
}

let itemSeq = 0;
export const newItem = (label = '', amount: number | null = null): ItemDraft => ({ key: ++itemSeq, label, amount });

export function draftFromBill(bill: CopayBill): CopayDraft {
  return {
    grade: bill.careGrade,
    copayClass: bill.copayClass,
    unit: bill.daycareUnit,
    band: bill.hourBand,
    days: bill.days,
    items: bill.nonCoveredItems.map((i) => newItem(i.label, i.amount)),
    previousUnpaid: bill.previousUnpaid,
  };
}

/** 저장된 청구서가 없는 어르신의 첫 초안: 프로필 등급, 출석 일수, 지난달 미납액으로 미리 채운다. */
export function defaultDraft(elder: LabElder, presentDays: number | null, previousUnpaid: number): CopayDraft {
  return {
    grade: elderGradeToLtc(elder.careGrade) ?? '',
    copayClass: 'standard',
    unit: 'general',
    band: 'h8to10',
    days: presentDays,
    items: [],
    previousUnpaid: previousUnpaid > 0 ? previousUnpaid : null,
  };
}

/** 초안이 바뀌었는지 비교하는 키(줄 키·빈 비급여 줄은 제외) */
export function draftKey(d: CopayDraft): string {
  return JSON.stringify([
    d.grade,
    d.copayClass,
    d.unit,
    d.band,
    d.days,
    d.items.filter((i) => i.label.trim() !== '' || (i.amount ?? 0) !== 0).map((i) => [i.label.trim(), i.amount ?? 0]),
    d.previousUnpaid ?? 0,
  ]);
}

export function buildFromDraft(elderId: number, month: string, d: CopayDraft): BuildCopayResult {
  if (d.grade === '') return { error: '등급을 골라 주세요 (어르신 프로필에 등급이 없습니다)' };
  if (d.days === null) return { error: '이용일수를 입력해 주세요' };
  return buildCopayBillInput({
    elderlyId: elderId,
    billMonth: month,
    careGrade: d.grade,
    copayClass: d.copayClass,
    daycareUnit: d.unit,
    hourBand: d.band,
    days: d.days,
    nonCoveredItems: d.items.map((i) => ({ label: i.label, amount: i.amount ?? 0 })),
    previousUnpaid: d.previousUnpaid ?? 0,
  });
}

/**
 * 식재료비 일 단가가 있으면 식재료비 줄을 "이용일수 × 단가"로 맞춘다(mealCostItem).
 * 이미 식재료비 줄이 있으면 그 줄의 금액만 바꾸고 다른 줄은 건드리지 않는다. 이용일수가 없으면 식재료비 줄을 뺀다.
 * 단가가 비어 있으면 아무것도 바꾸지 않는다 — 직원이 손으로 적은 식재료비 줄을 지우지 않기 위해서다.
 */
export function applyMealCost(draft: CopayDraft, unitPrice: number | null): CopayDraft {
  if (unitPrice === null || unitPrice <= 0) return draft;
  const meal = mealCostItem(draft.days ?? 0, unitPrice);
  const first = draft.items.findIndex((i) => i.label.trim() === MEAL_COST_LABEL);
  const others = draft.items.filter((i) => i.label.trim() !== MEAL_COST_LABEL);
  if (!meal) return first < 0 ? draft : { ...draft, items: others };
  if (first < 0) return { ...draft, items: [newItem(meal.label, meal.amount), ...others] };
  const kept = draft.items[first];
  const rest = draft.items.filter((i, k) => k !== first && i.label.trim() !== MEAL_COST_LABEL);
  const items = [...rest.slice(0, first), { ...kept, label: MEAL_COST_LABEL, amount: meal.amount }, ...rest.slice(first)];
  return { ...draft, items };
}

/** 식재료비 줄을 모두 뺀다 — 단가를 지웠을 때, 자동으로 넣었던 줄을 치우는 데 쓴다. */
export function withoutMealCost(draft: CopayDraft): CopayDraft {
  const items = draft.items.filter((i) => i.label.trim() !== MEAL_COST_LABEL);
  return items.length === draft.items.length ? draft : { ...draft, items };
}

export { isBuildError, remainingDue };

/** 청구서 상태 → 칩 */
export function statusChip(status: CopayBill['status']): { tone: 'danger' | 'warn' | 'ok'; label: string } {
  if (status === 'PAID') return { tone: 'ok', label: '완납' };
  if (status === 'PARTIAL') return { tone: 'warn', label: '일부 납부' };
  return { tone: 'danger', label: '미납' };
}
