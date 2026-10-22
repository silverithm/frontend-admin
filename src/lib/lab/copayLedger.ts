/**
 * 월 본인부담금 청구대장·수납대장 — 케어포 본인부담금 메뉴의 "청구대장 리포트"·"수납대장 리포트"에 해당한다.
 * 그 달 청구서 목록에서 어르신별 한 줄과 합계를 만든다. 새로 입력하는 값은 없고 저장된 청구서로만 계산한다.
 *
 * 한 줄의 청구 합계(totalDue)는 서버 규칙 그대로 "본인부담(한도 안) + 한도 초과 + 비급여 + 이전 미납"이다.
 * 금액은 모두 원 단위 정수이고 합계도 정수 덧셈이라 소수 오차가 없다.
 */
import type { CopayBill } from './labTypes.ts';

export interface LedgerRow {
  billId: number;
  elderlyName: string;
  days: number;
  /** 급여비용 총액 = 한도 안(공단+본인) + 한도 초과 */
  totalFee: number;
  /** 공단 부담 = 한도 안 급여비용 − 본인부담(한도 안) */
  insurerShare: number;
  /** 본인부담금(한도 안) */
  copay: number;
  /** 월 한도 초과로 본인이 전부 내는 금액 */
  overLimit: number;
  nonCovered: number;
  previousUnpaid: number;
  /** 청구 합계 */
  totalDue: number;
  paid: number;
  lastPaidOn: string | null;
  payerName: string | null;
  /** 아직 받지 못한 금액 */
  remaining: number;
  status: CopayBill['status'];
}

export interface LedgerTotals {
  count: number;
  days: number;
  totalFee: number;
  insurerShare: number;
  copay: number;
  overLimit: number;
  nonCovered: number;
  previousUnpaid: number;
  totalDue: number;
  paid: number;
  remaining: number;
  /** 완납이 아닌 청구서 수 */
  unpaidCount: number;
}

export interface Ledger {
  rows: LedgerRow[];
  totals: LedgerTotals;
}

export function copayLedger(bills: ReadonlyArray<CopayBill>): Ledger {
  const rows: LedgerRow[] = [...bills]
    .sort((a, b) => a.elderlyName.localeCompare(b.elderlyName, 'ko') || a.id - b.id)
    .map((b) => ({
      billId: b.id,
      elderlyName: b.elderlyName,
      days: b.days,
      totalFee: b.coveredTotal + b.overLimitAmount,
      insurerShare: b.coveredTotal - b.copayAmount,
      copay: b.copayAmount,
      overLimit: b.overLimitAmount,
      nonCovered: b.nonCoveredAmount,
      previousUnpaid: b.previousUnpaid,
      totalDue: b.totalDue,
      paid: b.paidAmount,
      lastPaidOn: b.lastPaidOn,
      payerName: b.payerName,
      remaining: Math.max(0, b.totalDue - b.paidAmount),
      status: b.status,
    }));
  const sum = (pick: (r: LedgerRow) => number) => rows.reduce((s, r) => s + pick(r), 0);
  return {
    rows,
    totals: {
      count: rows.length,
      days: sum((r) => r.days),
      totalFee: sum((r) => r.totalFee),
      insurerShare: sum((r) => r.insurerShare),
      copay: sum((r) => r.copay),
      overLimit: sum((r) => r.overLimit),
      nonCovered: sum((r) => r.nonCovered),
      previousUnpaid: sum((r) => r.previousUnpaid),
      totalDue: sum((r) => r.totalDue),
      paid: sum((r) => r.paid),
      remaining: sum((r) => r.remaining),
      unpaidCount: rows.filter((r) => r.status !== 'PAID').length,
    },
  };
}

/** 수납대장 — 돈을 받은 청구서만(수납액이 0보다 큰 것), 마지막 수납일 순 */
export function receiptLedger(bills: ReadonlyArray<CopayBill>): { rows: LedgerRow[]; total: number } {
  const rows = copayLedger(bills).rows
    .filter((r) => r.paid > 0)
    .sort((a, b) => (a.lastPaidOn ?? '').localeCompare(b.lastPaidOn ?? '') || a.elderlyName.localeCompare(b.elderlyName, 'ko'));
  return { rows, total: rows.reduce((s, r) => s + r.paid, 0) };
}

/** 청구 합계가 "본인부담 + 한도 초과 + 비급여 + 이전 미납"과 다른 줄 — 대장을 믿기 전에 확인할 줄(옛 기록·직접 수정 대비) */
export function inconsistentRows(rows: ReadonlyArray<LedgerRow>): LedgerRow[] {
  return rows.filter((r) => r.copay + r.overLimit + r.nonCovered + r.previousUnpaid !== r.totalDue);
}
