/**
 * 카드·통장 내역 붙여넣기 해석 — 한 줄에서 날짜·금액·수입/지출·적요를 뽑는다. AI를 쓰지 않는 순수 함수다(계정 제안만 AI가 한다).
 * 은행·카드사마다 모양이 달라 완벽할 수 없으므로, 화면은 해석 결과를 모두 고칠 수 있게 보여 준다.
 *  - 날짜: 2026-10-03 · 2026.10.03 · 2026/10/3 · 10/03 · 10.03 · 10월 3일 (연도가 없으면 defaultYear)
 *  - 금액: 쉼표 숫자나 "원"이 붙은 숫자를 먼저, 없으면 3자리 이상 숫자. 금액이 둘 이상이면 첫 번째가 거래 금액이고 마지막은 잔액으로 본다.
 *  - 방향: "입금·수입·환불·+"는 수입, 그 밖은 지출.
 */
import { MAX_LEDGER_AMOUNT, MAX_LEDGER_DESCRIPTION } from '@/lib/lab/ledgerRules';
import { parseYmd } from '@/lib/lab/labDate';
import type { LedgerDirection } from '@/lib/lab/labTypes';

export const MAX_PASTE_LINES = 200;

export interface ParsedLine {
  date: string;
  direction: LedgerDirection;
  amount: number;
  description: string;
  /** 붙여 넣은 원래 줄 */
  raw: string;
}

export interface ParseResult {
  lines: ParsedLine[];
  /** 금액을 찾지 못해 건너뛴 줄 수 */
  skipped: number;
  /** 줄 수 한도를 넘어 잘린 줄 수 */
  truncated: number;
}

const pad = (n: number) => String(n).padStart(2, '0');

const DATE_FULL = /(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*일?/;
const DATE_SHORT = /(^|[^\d,])(\d{1,2})\s*[./월-]\s*(\d{1,2})\s*일?(?![\d,]|\s*원)/;
const TIME = /\b\d{1,2}:\d{2}(?::\d{2})?\b/g;
const AMOUNT_STRONG = /[+-]?\d{1,3}(?:,\d{3})+(?:\s*원)?|[+-]?\d+\s*원/g;
const AMOUNT_PLAIN = /(^|[^\d*])([+-]?\d{3,11})(?![\d*])/g;
const INCOME_WORDS = /입금|수입|환불|취소입금|이자/;
const EXPENSE_WORDS = /출금|지출|승인|결제|이체|인출/;
const NOISE_WORDS = /입금|잔액|출금|지출|수입|승인|결제|인출|취소|환불/g;

function toAmount(token: string): number {
  return Number(token.replace(/[^0-9]/g, ''));
}

function findDate(line: string, defaultYear: number, fallback: string): { date: string; rest: string } {
  const full = DATE_FULL.exec(line);
  if (full) {
    const date = `${full[1]}-${pad(Number(full[2]))}-${pad(Number(full[3]))}`;
    if (parseYmd(date)) return { date, rest: line.replace(full[0], ' ') };
  }
  const short = DATE_SHORT.exec(line);
  if (short) {
    const date = `${String(defaultYear).padStart(4, '0')}-${pad(Number(short[2]))}-${pad(Number(short[3]))}`;
    if (parseYmd(date)) return { date, rest: line.replace(short[0], `${short[1]} `) };
  }
  return { date: fallback, rest: line };
}

export function parseLedgerPaste(text: string, defaultYear: number, fallbackDate: string): ParseResult {
  const lines: ParsedLine[] = [];
  let skipped = 0;
  let truncated = 0;
  for (const rawLine of text.split(/\r?\n/)) {
    const raw = rawLine.trim();
    if (raw === '') continue;
    if (lines.length >= MAX_PASTE_LINES) {
      truncated += 1;
      continue;
    }
    const { date, rest: afterDate } = findDate(raw.replace(/\t/g, '  '), defaultYear, fallbackDate);
    const rest = afterDate.replace(TIME, ' ');
    const strong = rest.match(AMOUNT_STRONG);
    const found = strong && strong.length > 0 ? strong : [...rest.matchAll(AMOUNT_PLAIN)].map((m) => m[2]);
    if (found.length === 0) {
      skipped += 1;
      continue;
    }
    const first = found[0];
    const amount = toAmount(first);
    if (!Number.isInteger(amount) || amount < 1 || amount > MAX_LEDGER_AMOUNT) {
      skipped += 1;
      continue;
    }
    let direction: LedgerDirection = 'EXPENSE';
    if (first.trim().startsWith('+') || (INCOME_WORDS.test(raw) && !EXPENSE_WORDS.test(raw))) direction = 'INCOME';
    let description = rest;
    for (const token of found) description = description.replace(token, ' ');
    description = description.replace(NOISE_WORDS, ' ').replace(/[|,;]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_LEDGER_DESCRIPTION);
    lines.push({ date, direction, amount, description, raw });
  }
  return { lines, skipped, truncated };
}
