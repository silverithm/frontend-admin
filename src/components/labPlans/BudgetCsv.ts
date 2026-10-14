/** 결산 CSV — 엑셀이 한글을 바로 읽도록 toCsv가 BOM을 붙인다. */
import { toCsv } from '@/lib/lab/copayBill';
import type { CsvHeader } from '@/lib/lab/copayBill';
import type { Settlement } from '@/lib/lab/budgetRules';
import { accountText } from './BudgetFormat';

interface SettlementCsvRow {
  kind: string;
  account: string;
  budget: number;
  actual: number;
  remaining: number;
  rate: string;
}

const HEADERS: ReadonlyArray<CsvHeader<SettlementCsvRow>> = [
  { key: 'kind', label: '구분' },
  { key: 'account', label: '계정' },
  { key: 'budget', label: '예산(원)' },
  { key: 'actual', label: '결산 실적(원)' },
  { key: 'remaining', label: '예산 − 실적(원)' },
  { key: 'rate', label: '집행률(%)' },
];

export function settlementCsv(s: Settlement): string {
  const rows: SettlementCsvRow[] = s.rows.map((r) => ({
    kind: r.direction === 'INCOME' ? '세입(수입)' : '세출(지출)',
    account: accountText(r.direction, r.accountCode),
    budget: r.budget,
    actual: r.actual,
    remaining: r.remaining,
    rate: r.rate === null ? '' : String(r.rate),
  }));
  const budgetOf = (d: 'INCOME' | 'EXPENSE') => s.rows.filter((r) => r.direction === d).reduce((n, r) => n + r.budget, 0);
  rows.push({ kind: '합계', account: '수입 실적', budget: budgetOf('INCOME'), actual: s.incomeActual, remaining: budgetOf('INCOME') - s.incomeActual, rate: '' });
  rows.push({ kind: '합계', account: '지출 실적', budget: budgetOf('EXPENSE'), actual: s.expenseActual, remaining: budgetOf('EXPENSE') - s.expenseActual, rate: '' });
  rows.push({ kind: '합계', account: '차액(수입 − 지출)', budget: 0, actual: s.surplus, remaining: 0, rate: '' });
  return toCsv(rows, HEADERS);
}
