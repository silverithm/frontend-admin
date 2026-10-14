/**
 * 예산(본예산·추경)·결산 규칙 — 최신 예산, 합계, 예산 대비 집행, 전년 실적 초안, 제출 기한, 결산.
 *
 * 근거(research-5.md, 장기요양기관 재무ㆍ회계 규칙)
 *  - 예산은 회계연도 개시 5일 전까지(제4조) 관할 시·군·구청장에게 제출한다. 추경은 편성한 날부터 7일 이내(제6조).
 *    결산은 다음 연도 3월 31일까지(제10조).
 *  - 세입 총액 = 세출 총액 균형을 요구하는 조항은 확인하지 못했다(대조 필요). 그래서 균형은 경고로만 보여 주고 서버는 막지 않는다.
 *  - 예비비 한도는 규칙 본문에 없다(대조 필요).
 *
 * 금액 계산은 모두 정수로 한다. 500,000 × 1.1을 천 원 올림하면 550,000이어야 하는데 부동소수로 곱하면 550,000.0000000001이 되어 551,000이 된다.
 */
import type { Budget, BudgetDraftAccount, BudgetInput, BudgetLine, LedgerDirection } from './labTypes.ts';
import { MAX_LEDGER_AMOUNT, accountsFor, isAccountCode, type LedgerLike } from './ledgerRules.ts';

/** 예산 줄 금액 상한(서버 0~10,000,000,000) */
export const MAX_BUDGET_AMOUNT = MAX_LEDGER_AMOUNT;
export const MAX_BUDGET_LINES = 300;
export const MAX_BUDGET_LINE_NOTE = 200;
export const MAX_BUDGET_NOTE = 500;

export type BudgetLike = Partial<Pick<Budget, 'fiscalYear' | 'revision'>> & { lines: ReadonlyArray<Pick<BudgetLine, 'direction' | 'accountCode' | 'amount'>> };

function amountOf(value: number): number {
  return Number.isFinite(value) ? Math.trunc(value) : 0;
}

/** 그 해 revision이 가장 큰 예산(없으면 null) */
export function latestBudget<T extends Pick<Budget, 'fiscalYear' | 'revision'>>(budgets: ReadonlyArray<T>, year: number): T | null {
  let best: T | null = null;
  for (const b of budgets) if (b.fiscalYear === year && (best === null || b.revision > best.revision)) best = b;
  return best;
}

export interface BudgetTotals {
  income: number;
  expense: number;
  /** 수입 − 지출 */
  diff: number;
  balanced: boolean;
}

export function budgetTotals(budget: BudgetLike): BudgetTotals {
  let income = 0;
  let expense = 0;
  for (const l of budget.lines) {
    if (l.direction === 'INCOME') income += amountOf(l.amount);
    else if (l.direction === 'EXPENSE') expense += amountOf(l.amount);
  }
  return { income, expense, diff: income - expense, balanced: income === expense };
}

/** 코드를 숫자로 비교한다 — 문자열로 비교하면 '1011'이 '911'보다 앞서 관 순서가 뒤집힌다 */
function compareRows(a: { direction: LedgerDirection; accountCode: string }, b: { direction: LedgerDirection; accountCode: string }): number {
  if (a.direction !== b.direction) return a.direction === 'INCOME' ? -1 : 1;
  return Number(a.accountCode) - Number(b.accountCode) || (a.accountCode < b.accountCode ? -1 : a.accountCode > b.accountCode ? 1 : 0);
}

export interface BudgetActualRow {
  direction: LedgerDirection;
  accountCode: string;
  budget: number;
  actual: number;
  /** budget − actual */
  remaining: number;
  /** 집행률(%, 소수 첫째 자리 반올림). 예산이 0이면 null */
  rate: number | null;
  /** 실적이 예산을 넘었다(예산에 없는 계정의 실적 포함). 지출은 초과가 주의 대상, 수입은 초과 달성이다. */
  over: boolean;
}

export interface BudgetVsActual {
  rows: BudgetActualRow[];
  totals: { income: { budget: number; actual: number }; expense: { budget: number; actual: number } };
}

function validThroughMonth(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 12 ? value : null;
}

/** 그 해(throughMonth가 있으면 그 달까지) 장부의 방향·계정 코드별 합 */
function actualsByKey(entries: ReadonlyArray<LedgerLike>, year: number, throughMonth: number | null): Map<string, number> {
  const out = new Map<string, number>();
  const prefix = `${String(year).padStart(4, '0')}-`;
  for (const e of entries) {
    if (typeof e.entryDate !== 'string' || !e.entryDate.startsWith(prefix)) continue;
    if (throughMonth !== null && Number(e.entryDate.slice(5, 7)) > throughMonth) continue;
    const key = `${e.direction}:${e.accountCode}`;
    out.set(key, (out.get(key) ?? 0) + amountOf(e.amount));
  }
  return out;
}

/**
 * 예산 대비 집행. 실적 = 같은 방향·같은 계정 코드(정확히 같음)의 장부 합. 예산에 없는 계정의 실적은 예산 0 줄로 넣는다.
 * 줄 순서: 수입 먼저, 코드 오름차순.
 */
export function budgetVsActual(budget: BudgetLike | null, entries: ReadonlyArray<LedgerLike>, year: number, throughMonth?: number): BudgetVsActual {
  const actuals = actualsByKey(entries, year, validThroughMonth(throughMonth));
  const planned = new Map<string, number>();
  for (const l of budget?.lines ?? []) {
    const key = `${l.direction}:${l.accountCode}`;
    planned.set(key, (planned.get(key) ?? 0) + amountOf(l.amount));
  }
  const rows: BudgetActualRow[] = [];
  for (const key of new Set([...planned.keys(), ...actuals.keys()])) {
    const [direction, accountCode] = key.split(':') as [LedgerDirection, string];
    const b = planned.get(key) ?? 0;
    const a = actuals.get(key) ?? 0;
    rows.push({ direction, accountCode, budget: b, actual: a, remaining: b - a, rate: b === 0 ? null : Math.round((a * 1000) / b) / 10, over: a > b });
  }
  rows.sort(compareRows);
  const totals = { income: { budget: 0, actual: 0 }, expense: { budget: 0, actual: 0 } };
  for (const r of rows) {
    const t = r.direction === 'INCOME' ? totals.income : totals.expense;
    t.budget += r.budget;
    t.actual += r.actual;
  }
  return { rows, totals };
}

/**
 * ceil(sum × factor / 10,000,000)을 정수 연산으로 구한다(천 원 단위 몫). 부동소수 나눗셈은 몫이 정수에 아주 가까울 때
 * 오차로 올림이 어긋날 수 있어 몫과 나머지를 직접 센다. 곱이 안전한 정수 범위를 넘으면 상한(100억)을 넘는 금액이므로 null.
 */
function ceilThousands(sum: number, factor: number): number | null {
  const product = sum * factor;
  if (!Number.isSafeInteger(product)) return null;
  let quotient = Math.floor(product / 10_000_000);
  let rest = product - quotient * 10_000_000;
  if (rest < 0) {
    quotient -= 1;
    rest += 10_000_000;
  } else if (rest >= 10_000_000) {
    quotient += 1;
    rest -= 10_000_000;
  }
  return rest > 0 ? quotient + 1 : quotient;
}

/**
 * 기준 연도 실적 합 × (1 + growthPct/100)을 천 원 단위로 올림한 초안. 실적이 0인 계정, 결과가 0 이하인 계정은 넣지 않는다.
 * growthPct는 소수 둘째 자리까지 읽는다(만분율 정수 계산). 금액은 서버 상한(100억)을 넘지 않게 자른다.
 */
export function draftFromActuals(entries: ReadonlyArray<LedgerLike>, baseYear: number, growthPct: number): Array<{ direction: LedgerDirection; accountCode: string; amount: number }> {
  const factor = 10_000 + Math.round((Number.isFinite(growthPct) ? growthPct : 0) * 100);
  const out: Array<{ direction: LedgerDirection; accountCode: string; amount: number }> = [];
  for (const [key, sum] of actualsByKey(entries, baseYear, null)) {
    if (sum <= 0) continue;
    if (factor <= 0) continue;
    // sum × factor / 10,000 을 천 원 단위로 올림 = ceil(sum × factor / 10,000,000) × 1,000
    const thousands = ceilThousands(sum, factor);
    const amount = thousands === null ? MAX_BUDGET_AMOUNT : Math.min(thousands * 1000, MAX_BUDGET_AMOUNT);
    if (amount <= 0) continue;
    const [direction, accountCode] = key.split(':') as [LedgerDirection, string];
    out.push({ direction, accountCode, amount });
  }
  return out.sort(compareRows);
}

/** 천 원 단위 올림(비정상·음수는 0, 서버 상한 이내). AI 초안 정규화에도 쓴다. */
export function roundUpToThousand(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  // 1,000으로 나눈 몫이 정수로 떨어지는 경우(550,000 등)는 부동소수 오차 없이 그대로 유지된다.
  return Math.min(Math.ceil(amount / 1000) * 1000, MAX_BUDGET_AMOUNT);
}

export interface BudgetDeadlines {
  /** 회계연도 개시 5일 전 */
  budgetDue: string;
  /** 추경은 편성한 날부터 이 일수 안에 제출 */
  supplementaryDays: number;
  settlementDue: string;
  submitTo: string;
}

export function budgetDeadlines(year: number): BudgetDeadlines {
  return { budgetDue: `${year - 1}-12-27`, supplementaryDays: 7, settlementDue: `${year + 1}-03-31`, submitTo: '시·군·구청장' };
}

export interface Settlement {
  incomeActual: number;
  expenseActual: number;
  /** 수입 실적 − 지출 실적 */
  surplus: number;
  rows: BudgetActualRow[];
}

export function settlement(budget: BudgetLike | null, entries: ReadonlyArray<LedgerLike>, year: number): Settlement {
  const { rows, totals } = budgetVsActual(budget, entries, year);
  return { incomeActual: totals.income.actual, expenseActual: totals.expense.actual, surplus: totals.income.actual - totals.expense.actual, rows };
}

/**
 * 화면용: AI 초안에 보낼 계정 목록 — 쓸 수 있는 계정 전부(ledgerRules의 세입·세출 목록)에 전년 실적을 붙인다. 실적이 없으면 0.
 */
export function draftAccounts(entries: ReadonlyArray<LedgerLike>, baseYear: number): BudgetDraftAccount[] {
  const actuals = actualsByKey(entries, baseYear, null);
  const out: BudgetDraftAccount[] = [];
  for (const direction of ['INCOME', 'EXPENSE'] as const) {
    for (const a of accountsFor(direction)) out.push({ direction, accountCode: a.code, accountName: a.name, lastYear: Math.max(0, actuals.get(`${direction}:${a.code}`) ?? 0) });
  }
  return out;
}

/** 저장 전 점검(서버 규칙과 같은 한도). 문제가 없으면 빈 배열. */
export function budgetInputIssues(input: Pick<BudgetInput, 'fiscalYear' | 'revision' | 'note'> & { lines: ReadonlyArray<BudgetLine> }): string[] {
  const issues: string[] = [];
  if (!Number.isInteger(input.fiscalYear) || input.fiscalYear < 2020 || input.fiscalYear > 2100) issues.push('회계연도는 2020~2100년이어야 합니다');
  if (!Number.isInteger(input.revision) || input.revision < 0 || input.revision > 9) issues.push('차수는 0(본예산)~9(추경 9차)이어야 합니다');
  if (typeof input.note === 'string' && Array.from(input.note).length > MAX_BUDGET_NOTE) issues.push(`비고는 ${MAX_BUDGET_NOTE}자까지 쓸 수 있습니다`);
  if (input.lines.length > MAX_BUDGET_LINES) issues.push(`예산 줄은 ${MAX_BUDGET_LINES}개까지 둘 수 있습니다`);
  const seen = new Set<string>();
  input.lines.forEach((l, i) => {
    const at = `${i + 1}번째 줄`;
    if (l.direction !== 'INCOME' && l.direction !== 'EXPENSE') {
      issues.push(`${at}: 세입·세출 구분이 올바르지 않습니다`);
      return;
    }
    if (!isAccountCode(l.direction, l.accountCode)) issues.push(`${at}: 계정 과목이 목록에 없습니다`);
    if (!Number.isInteger(l.amount) || l.amount < 0 || l.amount > MAX_BUDGET_AMOUNT) issues.push(`${at}: 금액은 0원 이상 100억 원 이하의 정수여야 합니다`);
    if (typeof l.note === 'string' && Array.from(l.note).length > MAX_BUDGET_LINE_NOTE) issues.push(`${at}: 비고는 ${MAX_BUDGET_LINE_NOTE}자까지 쓸 수 있습니다`);
    const key = `${l.direction}:${l.accountCode}`;
    if (seen.has(key)) issues.push(`${at}: 같은 계정이 두 번 있습니다`);
    seen.add(key);
  });
  return issues;
}
