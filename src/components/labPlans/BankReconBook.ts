/**
 * 통장 대사에 쓰는 장부 쪽 계산 — 장부에는 통장 구분이 없으므로 "쓰는 통장 전부의 시작 잔액 합 + 그 이후 장부 수입 − 지출"을
 * 월말 장부 잔액으로 보고 통장 월말 잔액의 합과 견준다(규칙은 bankRules.reconcileMonth).
 */
import { carryForward } from '@/lib/lab/ledgerRules';
import { reconcileMonth } from '@/lib/lab/bankRules';
import type { ReconcileResult } from '@/lib/lab/bankRules';
import type { BankAccount, BankStatement, LedgerEntry } from '@/lib/lab/labTypes';

/** 그 달에 대사할 통장 — 쓰는 중이고 시작일이 그 달 안이거나 그 전인 통장 */
export function accountsOfMonth(accounts: ReadonlyArray<BankAccount>, month: string): BankAccount[] {
  return accounts.filter((a) => a.active && a.openingDate.slice(0, 7) <= month);
}

export interface ReconView {
  included: BankAccount[];
  /** 월말 잔액이 아직 없는 통장 */
  missing: BankAccount[];
  /** 통장 시작 잔액 합 */
  openingSum: number;
  /** 대사 계산 시작일(가장 이른 통장 시작일) */
  startDate: string | null;
  /** 그 달 1일 직전의 장부 잔액 */
  monthOpening: number;
  /** 모든 통장의 월말 잔액이 있을 때만 */
  result: ReconcileResult | null;
}

export function reconView(accounts: ReadonlyArray<BankAccount>, statements: ReadonlyArray<BankStatement>, entries: ReadonlyArray<LedgerEntry>, month: string): ReconView {
  const included = accountsOfMonth(accounts, month);
  const closingOf = new Map(statements.filter((s) => s.statementMonth === month).map((s) => [s.accountId, s.closingBalance]));
  const missing = included.filter((a) => !closingOf.has(a.id));
  if (included.length === 0) return { included, missing, openingSum: 0, startDate: null, monthOpening: 0, result: null };
  const openingSum = included.reduce((s, a) => s + Math.trunc(a.openingBalance), 0);
  const startDate = included.reduce((min, a) => (a.openingDate < min ? a.openingDate : min), included[0].openingDate);
  // 시작일 이전 장부 기록은 이 통장들과 무관하다
  const usable = entries.filter((e) => e.entryDate >= startDate);
  const monthOpening = carryForward(usable, month, openingSum);
  if (missing.length > 0) return { included, missing, openingSum, startDate, monthOpening, result: null };
  const bankClosing = included.reduce((s, a) => s + Math.trunc(closingOf.get(a.id) ?? 0), 0);
  return { included, missing, openingSum, startDate, monthOpening, result: reconcileMonth({ openingBalance: monthOpening, entries: usable, month, bankClosing }) };
}

/** 장부를 읽어야 하는 연도 — 가장 이른 통장 시작 연도부터 그 달의 연도까지(최대 10년) */
export function yearsToLoad(accounts: ReadonlyArray<BankAccount>, month: string): number[] {
  const year = Number(month.slice(0, 4));
  const starts = accountsOfMonth(accounts, month).map((a) => Number(a.openingDate.slice(0, 4)));
  const first = Math.max(year - 9, starts.length > 0 ? Math.min(...starts) : year);
  const out: number[] = [];
  for (let y = first; y <= year; y += 1) out.push(y);
  return out;
}
