/**
 * 통장 대사 규칙 — 통장 거래(붙여넣기) 읽기·장부와 짝짓기·월말 잔액 대사·후원금 전용계좌 점검. 전부 브라우저 안에서 도는 순수 함수다.
 * 통장 거래 글(적요·금액·잔액)은 AI에도 서버에도 보내지 않는다 — 이 화면 안에서만 쓴다(본인부담금 입금 매칭과 같은 원칙).
 *
 * 근거(research-9 §5): 장기요양기관 재무·회계 규칙 제15조(회계별 통장)·제17조(후원금 전용계좌).
 * 규칙에는 월말 통장 잔액 대사 조항이 없다 — 기관 관리 기준이다(대조 필요).
 * 금액은 정수 원으로만 계산한다(소수·부동소수 없음). 입금은 +, 출금은 −.
 */
import { daysBetween, formatYmd, parseYmd } from './labDate.ts';
import type { DonationKind, LedgerDirection } from './labTypes.ts';

export interface StatementLine {
  /** 'YYYY-MM-DD' */
  date: string;
  description: string;
  /** 입금 +, 출금 − (0원 거래는 읽지 않는다) */
  amount: number;
  /** 거래 후 잔액. 없으면 null */
  balance: number | null;
  raw: string;
}

/** 한 번에 읽을 최대 줄 수·줄 길이 — 잘못 붙여 넣은 큰 글에 브라우저가 멈추지 않게 한다. */
const MAX_LINES = 5000;
const MAX_LINE_LENGTH = 500;

const AMOUNT_RE = /^([+-]?)(\d{1,3}(?:,\d{3})+|\d+)(?:\.0+)?$/;
const TIME_RE = /^\d{1,2}:\d{2}(?::\d{2})?$/;

/** 금액 낱말('1,234'·'-70,000'·'263,760원'·'₩5,000')을 부호와 정수로. 금액이 아니면 null. */
function parseAmountToken(token: string): { value: number; negative: boolean } | null {
  const t = token.replace(/[₩\s]/g, '').replace(/원$/, '');
  const m = AMOUNT_RE.exec(t);
  if (!m) return null;
  const value = Number(m[2].replace(/,/g, ''));
  // 계좌번호·전화번호 같은 긴 숫자는 금액이 아니다(한도: 100억, 통장 시작 잔액 한도와 같음)
  if (!Number.isSafeInteger(value) || value > 10_000_000_000) return null;
  return { value, negative: m[1] === '-' };
}

/** 줄 맨 앞 날짜를 떼어 낸다. 연도가 없으면 year. 날짜가 아니거나 없는 날짜면 null. */
function takeLeadingDate(line: string, year: number): { date: string; rest: string } | null {
  let m = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})(?=$|[\s\t])/.exec(line);
  let y: number;
  let mo: number;
  let d: number;
  if (m) {
    y = Number(m[1]);
    mo = Number(m[2]);
    d = Number(m[3]);
  } else {
    m = /^(\d{1,2})[-./](\d{1,2})(?=$|[\s\t])/.exec(line);
    if (!m) return null;
    y = year;
    mo = Number(m[1]);
    d = Number(m[2]);
  }
  const date = formatYmd(y, mo, d);
  if (!parseYmd(date)) return null;
  return { date, rest: line.slice(m[0].length) };
}

/** 탭으로 나뉜 다섯 칸(날짜·적요·입금·출금·잔액). 칸이 비어 있으면 그 자리가 비어 있는 것이다. 읽지 못하면 null. */
function parseTabbed(rest: string, date: string, raw: string): StatementLine | null {
  let cells = rest.split('\t').map((c) => c.trim());
  // 날짜 바로 뒤가 탭이라 맨 앞에 빈 칸이 하나 생긴다
  if (cells[0] === '') cells = cells.slice(1);
  // 날짜와 시각이 칸이 따로인 은행: 시각 칸은 버린다
  if (cells.length > 0 && TIME_RE.test(cells[0])) cells = cells.slice(1);
  if (cells.length < 2) return null;
  const description = cells[0];
  const dep = cells[1] ?? '';
  const wd = cells[2] ?? '';
  const bal = cells[3] ?? '';
  const depAmt = dep === '' ? null : parseAmountToken(dep);
  const wdAmt = wd === '' ? null : parseAmountToken(wd);
  const balAmt = bal === '' ? null : parseAmountToken(bal);
  // 입금·출금 칸에 금액이 아닌 글이 있으면 다섯 칸 모양이 아니다
  if ((dep !== '' && !depAmt) || (wd !== '' && !wdAmt)) return null;
  const dv = depAmt ? depAmt.value : 0;
  const wv = wdAmt ? wdAmt.value : 0;
  // 입금·출금이 둘 다 있으면 어느 쪽인지 알 수 없다 — 읽지 않는다(틀린 부호로 장부에 넣는 것이 더 위험하다)
  if ((dv > 0 && wv > 0) || (dv === 0 && wv === 0)) return null;
  const amount = dv > 0 ? dv : -wv;
  const balance = balAmt ? (balAmt.negative ? -balAmt.value : balAmt.value) : null;
  return { date, description, amount, balance, raw };
}

/** 공백으로 이어진 줄: 마지막으로 이어진 금액 묶음의 첫째가 거래액('-'나 '출금'이 있으면 음수), 둘째가 잔액. */
function parseFree(rest: string, date: string, raw: string): StatementLine | null {
  const tokens = rest.split(/\s+/).filter(Boolean);
  const amounts = tokens.map((t) => (TIME_RE.test(t) ? null : parseAmountToken(t)));
  let end = amounts.length - 1;
  while (end >= 0 && amounts[end] === null) end -= 1;
  if (end < 0) return null;
  let begin = end;
  while (begin - 1 >= 0 && amounts[begin - 1] !== null) begin -= 1;
  const first = amounts[begin]!;
  if (first.value === 0) return null;
  const secondTok = begin + 1 <= end ? amounts[begin + 1] : null;
  const description = tokens.filter((_, i) => i < begin || i > end).join(' ');
  const negative = first.negative || /출금/.test(description);
  const balance = secondTok ? (secondTok.negative ? -secondTok.value : secondTok.value) : null;
  return { date, description, amount: negative ? -first.value : first.value, balance, raw };
}

/**
 * 통장 거래내역 붙여넣기 글을 거래 목록으로 읽는다. 날짜가 맨 앞인 줄만 읽고 머리글·합계·읽을 수 없는 줄은 건너뛴다.
 * 날짜: YYYY-MM-DD·YYYY.MM.DD·MM/DD·MM-DD(연도 없으면 year). 탭 다섯 칸이면 칸 자리로, 아니면 줄글 규칙.
 */
export function parseStatementText(text: string, year: number): StatementLine[] {
  const normalized = String(text ?? '')
    .replace(/^﻿/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ 　]/g, ' ')
    .replace(/"/g, '');
  const out: StatementLine[] = [];
  const lines = normalized.split('\n');
  for (const rawLine of lines.length > MAX_LINES ? lines.slice(0, MAX_LINES) : lines) {
    const line = rawLine.replace(/^ +/, '').replace(/\s+$/, '');
    if (!line || line.length > MAX_LINE_LENGTH) continue;
    const head = takeLeadingDate(line, year);
    if (!head) continue;
    const tabbed = head.rest.includes('\t');
    let row = tabbed ? parseTabbed(head.rest, head.date, line) : null;
    // 칸이 4개 이상인 탭 표는 칸 자리가 곧 뜻이다 — 못 읽은 줄을 줄글로 다시 읽으면 입금·출금 부호가 틀릴 수 있다
    if (!row && !(tabbed && head.rest.split('\t').length >= 4)) row = parseFree(head.rest.replace(/\t/g, ' '), head.date, line);
    if (row) out.push(row);
  }
  return out;
}

export interface BookEntry {
  id: number;
  entryDate: string;
  direction: LedgerDirection;
  amount: number;
  donationId?: number | null;
}

export interface StatementMatch {
  lineIndex: number;
  entryId: number;
}

export interface StatementMatchResult {
  matched: StatementMatch[];
  unmatchedLines: number[];
  unmatchedEntries: number[];
}

function signedAmount(e: Pick<BookEntry, 'direction' | 'amount'>): number {
  return e.direction === 'INCOME' ? e.amount : -e.amount;
}

/**
 * 통장 거래와 장부 기록을 짝짓는다. 금액(장부는 INCOME +, EXPENSE −)이 같고 날짜 차이가 toleranceDays 안인 것만, 하나씩만.
 * 날짜가 가까운 짝부터 정하고 같으면 위쪽 줄·앞 기록부터다. 짝이 안 된 통장 줄 번호와 장부 기록 id를 돌려준다.
 */
export function matchStatement(
  lines: ReadonlyArray<Pick<StatementLine, 'date' | 'amount'>>,
  entries: ReadonlyArray<Pick<BookEntry, 'id' | 'entryDate' | 'direction' | 'amount'>>,
  toleranceDays = 2,
): StatementMatchResult {
  const tol = Number.isFinite(toleranceDays) && toleranceDays >= 0 ? Math.floor(toleranceDays) : 0;
  const pairs: Array<{ lineIndex: number; entryIndex: number; gap: number }> = [];
  lines.forEach((line, lineIndex) => {
    entries.forEach((entry, entryIndex) => {
      if (line.amount !== signedAmount(entry)) return;
      const between = daysBetween(line.date, entry.entryDate);
      if (between === null || Math.abs(between) > tol) return;
      pairs.push({ lineIndex, entryIndex, gap: Math.abs(between) });
    });
  });
  pairs.sort((a, b) => a.gap - b.gap || a.lineIndex - b.lineIndex || a.entryIndex - b.entryIndex);
  const usedLines = new Set<number>();
  const usedEntries = new Set<number>();
  const matched: StatementMatch[] = [];
  for (const p of pairs) {
    if (usedLines.has(p.lineIndex) || usedEntries.has(p.entryIndex)) continue;
    usedLines.add(p.lineIndex);
    usedEntries.add(p.entryIndex);
    matched.push({ lineIndex: p.lineIndex, entryId: entries[p.entryIndex].id });
  }
  matched.sort((a, b) => a.lineIndex - b.lineIndex);
  return {
    matched,
    unmatchedLines: lines.map((_, i) => i).filter((i) => !usedLines.has(i)),
    unmatchedEntries: entries.filter((_, i) => !usedEntries.has(i)).map((e) => e.id),
  };
}

export interface ReconcileResult {
  bookClosing: number;
  bankClosing: number;
  /** 통장 − 장부 */
  diff: number;
  matched: boolean;
}

/**
 * 월말 대사. 장부 월말 잔액 = 시작 잔액 + 그 달 입금 − 그 달 출금. openingBalance는 그 달 1일 직전(전월 말) 잔액이어야 한다 —
 * 통장을 처음 등록한 달이면 통장의 시작 잔액이고, 그 뒤 달은 앞 달까지의 장부 잔액이다.
 */
export function reconcileMonth(input: { openingBalance: number; entries: ReadonlyArray<Pick<BookEntry, 'entryDate' | 'direction' | 'amount'>>; month: string; bankClosing: number }): ReconcileResult {
  let book = input.openingBalance;
  for (const e of input.entries) {
    if (typeof e.entryDate !== 'string' || e.entryDate.slice(0, 7) !== input.month) continue;
    book += signedAmount(e);
  }
  const diff = input.bankClosing - book;
  return { bookClosing: book, bankClosing: input.bankClosing, diff, matched: diff === 0 };
}

export interface DonationAccountCheck {
  /** 그 해 현금 후원금 합(물품 제외 — 제17조는 물품 형태를 전용계좌에서 뺀다) */
  received: number;
  /** 그 해 후원금과 연결된 지출 합 */
  used: number;
  /** received − used. 전년도에서 넘어온 잔액은 들어 있지 않다 */
  expected: number;
  /** 통장 잔액 − expected. 잔액을 모르면 null */
  diff: number | null;
}

/** 후원금 전용계좌 점검: 그 해 받은 현금 후원금에서 쓴 만큼을 뺀 값이 통장 잔액과 맞는지(전년 이월분이 있으면 차이로 나타난다). */
export function donationAccountCheck(
  donations: ReadonlyArray<{ receivedOn: string; kind: DonationKind; amount: number }>,
  entries: ReadonlyArray<Pick<BookEntry, 'entryDate' | 'direction' | 'amount' | 'donationId'>>,
  year: number,
  balance: number | null,
): DonationAccountCheck {
  const prefix = `${String(year).padStart(4, '0')}-`;
  let received = 0;
  for (const d of donations) if (d.kind === 'CASH' && typeof d.receivedOn === 'string' && d.receivedOn.startsWith(prefix)) received += d.amount;
  let used = 0;
  for (const e of entries) {
    if (e.direction === 'EXPENSE' && e.donationId != null && typeof e.entryDate === 'string' && e.entryDate.startsWith(prefix)) used += e.amount;
  }
  const expected = received - used;
  return { received, used, expected, diff: balance === null || balance === undefined ? null : balance - expected };
}
