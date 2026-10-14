/** 회계 장부 CSV — 월 현금출납부와 연간 관·항·목 요약. 엑셀이 한글을 바로 읽도록 toCsv가 BOM을 붙인다. */
import { toCsv } from '@/lib/lab/copayBill';
import type { CsvHeader } from '@/lib/lab/copayBill';
import { accountLabel } from '@/lib/lab/ledgerRules';
import type { CashBookRow, CashBookTotals, LedgerSummary } from '@/lib/lab/ledgerRules';
import type { LedgerEntry } from '@/lib/lab/labTypes';
import { DIRECTION_LABEL, EVIDENCE_LABEL } from './LedgerDraft';

interface BookCsvRow {
  date: string;
  kind: string;
  account: string;
  description: string;
  income: number | null;
  expense: number | null;
  balance: number;
  counterparty: string;
  evidence: string;
}

const BOOK_HEADERS: ReadonlyArray<CsvHeader<BookCsvRow>> = [
  { key: 'date', label: '날짜' },
  { key: 'kind', label: '구분' },
  { key: 'account', label: '계정' },
  { key: 'description', label: '적요' },
  { key: 'income', label: '수입(원)' },
  { key: 'expense', label: '지출(원)' },
  { key: 'balance', label: '잔액(원)' },
  { key: 'counterparty', label: '거래처' },
  { key: 'evidence', label: '증빙' },
];

export function cashBookCsv(rows: ReadonlyArray<CashBookRow>, totals: CashBookTotals, entryById: ReadonlyMap<number, LedgerEntry>): string {
  const out: BookCsvRow[] = [{ date: '', kind: '', account: '', description: '전월 이월', income: null, expense: null, balance: totals.opening, counterparty: '', evidence: '' }];
  for (const r of rows) {
    const entry = r.id === null ? undefined : entryById.get(r.id);
    out.push({
      date: r.entryDate,
      kind: DIRECTION_LABEL[r.direction],
      account: accountLabel(r.direction, r.accountCode),
      description: r.description,
      income: r.income > 0 ? r.income : null,
      expense: r.expense > 0 ? r.expense : null,
      balance: r.balance,
      counterparty: entry?.counterparty ?? '',
      evidence: entry?.evidenceType ? EVIDENCE_LABEL[entry.evidenceType] : '',
    });
  }
  out.push({ date: '', kind: '', account: '', description: '달 합계', income: totals.income, expense: totals.expense, balance: totals.closing, counterparty: '', evidence: '' });
  return toCsv(out, BOOK_HEADERS);
}

type SummaryCsvRow = Record<string, string | number> & { division: string; level: string; code: string; name: string; total: number };

/** 연간 요약 — 구분(세입·세출)·단계(관·항·목)·코드·이름·1~12월·합계. 합계가 0인 줄은 뺀다. */
export function summaryCsv(summary: LedgerSummary): string {
  const rows: SummaryCsvRow[] = [];
  const push = (division: string, level: string, code: string, name: string, months: number[], total: number) => {
    if (total === 0) return;
    const row: SummaryCsvRow = { division, level, code, name, total };
    months.forEach((v, i) => {
      row[`m${i + 1}`] = v;
    });
    rows.push(row);
  };
  for (const [division, side] of [
    ['세입', summary.income],
    ['세출', summary.expense],
  ] as const) {
    for (const g of side.groups) {
      push(division, '관', g.code, g.name, g.months, g.total);
      for (const s of g.sections) {
        push(division, '항', s.code, s.name, s.months, s.total);
        for (const a of s.accounts) push(division, '목', a.code, a.name, a.months, a.total);
      }
    }
    push(division, '합계', '', `${division} 합계`, side.months, side.total);
  }
  push('차액', '합계', '', '수입 − 지출', summary.netByMonth, summary.net);
  const headers: Array<CsvHeader<SummaryCsvRow>> = [
    { key: 'division', label: '구분' },
    { key: 'level', label: '단계' },
    { key: 'code', label: '코드' },
    { key: 'name', label: '과목' },
    ...Array.from({ length: 12 }, (_, i) => ({ key: `m${i + 1}`, label: `${i + 1}월` })),
    { key: 'total', label: '합계(원)' },
  ];
  return toCsv(rows, headers);
}
