/**
 * 본인부담금 한 줄(어르신 한 명)의 입력 초안과 계산 연결.
 * 계산식은 lib/lab/copayBill의 buildCopayBillInput 하나뿐이다 — 여기서는 입력값을 그 함수가 받는 모양으로 옮기기만 한다.
 */
import { buildCopayBillInput, elderGradeToLtc, isBuildError, remainingDue } from '@/lib/lab/copayBill';
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

export { isBuildError, remainingDue };

/** 청구서 상태 → 칩 */
export function statusChip(status: CopayBill['status']): { tone: 'danger' | 'warn' | 'ok'; label: string } {
  if (status === 'PAID') return { tone: 'ok', label: '완납' };
  if (status === 'PARTIAL') return { tone: 'warn', label: '일부 납부' };
  return { tone: 'danger', label: '미납' };
}
