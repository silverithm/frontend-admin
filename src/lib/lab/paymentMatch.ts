/**
 * 은행 입금 내역(붙여넣기) 파싱과 청구서 매칭 — 전부 브라우저 안에서 돈다. 계좌·입금자 정보는 AI에도 서버에도 보내지 않는다.
 *
 * 은행마다 엑셀 모양이 다르다. 입금/출금/잔액 열이 따로 있는 것(국민·신한·우리·농협), 구분+거래금액 열인 것(카카오뱅크),
 * 한 줄에 "10/06 입금 김영희 98000원"처럼 줄글로 오는 것까지 읽는다. 원칙은 하나다: **입금만** 센다.
 * 출금·잔액을 입금으로 읽는 것이 가장 위험한 오류이므로, 확신이 없으면 입금으로 보지 않는다.
 *   1) 머리글이 있으면 머리글의 열 이름으로 입금/출금/잔액을 가른다.
 *   2) 머리글이 없는 탭 표는 "끝에서부터 [출금, 입금, 잔액]" 관례를 쓴다(대부분 은행의 순서).
 *      이 관례와 반대 순서인 은행은 머리글을 같이 붙여 넣어야 정확하다.
 *   3) 줄글은 '출금' 낱말·'-' 부호·0원 열로 출금을 걸러낸다.
 */
import { MAX_MONEY } from './copayBill.ts';
import { formatYmd, parseYmd, seoulDateString } from './labDate.ts';
import type { CopayStatus } from './labTypes.ts';

export interface Deposit {
  /** 'YYYY-MM-DD'. 날짜를 못 읽으면 null */
  date: string | null;
  name: string;
  amount: number;
  raw: string;
}

export interface MatchableBill {
  id: number;
  elderlyName: string;
  payerName: string | null;
  totalDue: number;
  paidAmount: number;
  status: CopayStatus;
}

export type MatchConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface Match {
  depositIndex: number;
  billId: number;
  confidence: MatchConfidence;
  reason: string;
}

// ---------- 낱말 단위 읽기 ----------

/** 한 번에 읽을 최대 줄 수·줄 길이 — 은행 한 달 거래내역으로 충분하고, 잘못 붙여 넣은 큰 글에 브라우저가 멈추지 않게 한다. */
const MAX_LINES = 5000;
const MAX_LINE_LENGTH = 500;

const TIME_RE = /^\d{1,2}:\d{2}(?::\d{2})?$/;

function parseAmountToken(token: string): { value: number; sign: '+' | '-' | '' } | null {
  const t = token.replace(/[₩\s]/g, '').replace(/원$/, '');
  const m = /^([+-]?)(\d{1,3}(?:,\d{3})+|\d+)$/.exec(t);
  if (!m) return null;
  const value = Number(m[2].replace(/,/g, ''));
  // 계좌번호·전화번호 같은 긴 숫자는 금액이 아니다(서버 한도 1억).
  if (!Number.isSafeInteger(value) || value > MAX_MONEY) return null;
  return { value, sign: m[1] as '+' | '-' | '' };
}

function resolveYear(month: number, day: number, ref: string): string | null {
  const today = parseYmd(ref);
  if (!today) return null;
  let year = today.year;
  const candidate = Date.UTC(year, month - 1, day);
  const now = Date.UTC(today.year, today.month - 1, today.day);
  // 1월에 12/28 입금을 붙여 넣으면 작년 것이다. 오늘보다 일주일 넘게 앞선 날짜는 전년으로 본다.
  if (candidate - now > 7 * 86_400_000) year -= 1;
  return parseYmd(formatYmd(year, month, day)) ? formatYmd(year, month, day) : null;
}

function parseDateToken(token: string, ref: string): string | null {
  const t = token.replace(/[.,]$/, '');
  let m = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})(?:[T\s].*)?$/.exec(t);
  if (m) {
    const s = formatYmd(Number(m[1]), Number(m[2]), Number(m[3]));
    return parseYmd(s) ? s : null;
  }
  m = /^(\d{2})[-./](\d{1,2})[-./](\d{1,2})$/.exec(t);
  if (m) {
    const s = formatYmd(2000 + Number(m[1]), Number(m[2]), Number(m[3]));
    return parseYmd(s) ? s : null;
  }
  m = /^(\d{1,2})[/.-](\d{1,2})$/.exec(t);
  if (m) return resolveYear(Number(m[1]), Number(m[2]), ref);
  return null;
}

/** 쉼표는 구분자지만 천 단위 쉼표(45,500)는 숫자의 일부다: 앞이 숫자이고 뒤가 정확히 숫자 3자리일 때만 숫자 안의 쉼표. */
function splitTokens(line: string): string[] {
  return line
    .split(/(?<!\d),|,(?!\d{3}(?!\d))|\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// 이름이 아닌 은행 거래 문구. 칸 전체가 이 말이면 이름에서 뺀다.
const NOISE_WORDS = new Set(
  ['입금', '출금', '이체', '입금이체', '이체입금', '전자금융', '타행', '타행이체', '자행', '모바일', '인터넷', '스마트뱅킹', '폰뱅킹', '오픈뱅킹',
    '펌뱅킹', '무통장', '계좌이체', '송금', '지로', '현금', '입금액', '금액', '원', '및', 'ATM', 'CD', 'CMS', '체크카드', '입금확인'],
);

const SKIP_LINE_RE = /합계|소계|총계|누계|계좌번호|조회기간|조회결과|조회일|예금주|총\s*\d+\s*건/;

const HEADER_WORDS = ['거래일', '일자', '일시', '날짜', '적요', '입금', '출금', '잔액', '내용', '보낸', '기재', '구분', '금액', '거래점', '메모', '송금'];

function isNoise(token: string): boolean {
  return NOISE_WORDS.has(token.replace(/[^0-9A-Za-z가-힣]/g, ''));
}

/** 이름 후보 낱말: 숫자·계좌 모양·시간·날짜·잡음 문구를 뺀다. */
function nameFrom(tokens: string[], ref: string): string {
  const kept = tokens.filter((t) => {
    if (!t || isNoise(t) || TIME_RE.test(t)) return false;
    if (parseDateToken(t, ref)) return false;
    if (/^[\d*\-,.\s원₩+]+$/.test(t)) return false;
    return true;
  });
  return kept.join(' ').replace(/\s+/g, ' ').trim().slice(0, 40);
}

// ---------- 머리글 ----------

interface HeaderModel {
  cellCount: number;
  tabbed: boolean;
  deposit: number;
  withdraw: number;
  amount: number;
  types: number[];
  balance: number;
  names: number[];
  /** 머리글에서 입금 열이 출금 열보다 앞에 있는가 */
  depositFirst: boolean;
}

function splitHeaderCells(line: string): { cells: string[]; tabbed: boolean } {
  if (line.includes('\t')) return { cells: line.split('\t').map((s) => s.trim()), tabbed: true };
  return { cells: line.split(/\s{2,}|\s+/).map((s) => s.trim()).filter(Boolean), tabbed: false };
}

function parseHeader(line: string): HeaderModel | null {
  if (/\d/.test(line)) return null;
  const hits = HEADER_WORDS.filter((w) => line.includes(w)).length;
  if (hits < 2) return null;
  const { cells, tabbed } = splitHeaderCells(line);
  const model: HeaderModel = { cellCount: cells.length, tabbed, deposit: -1, withdraw: -1, amount: -1, types: [], balance: -1, names: [], depositFirst: false };
  // 이름 열은 입금자 > 보낸분 > 기재내용 > 내용 > 적요 순으로 우선한다.
  const nameRank = (c: string): number => {
    if (/입금자|송금인|의뢰인|보낸/.test(c)) return 0;
    if (/기재/.test(c)) return 1;
    if (/거래내용|내용/.test(c)) return 2;
    if (/적요|메모|예금주/.test(c)) return 3;
    return -1;
  };
  const ranked: Array<{ idx: number; rank: number }> = [];
  cells.forEach((c, idx) => {
    if (!c) return;
    const rank = nameRank(c);
    if (rank >= 0) ranked.push({ idx, rank });
    else if (/입금|맡기신|받으신/.test(c)) model.deposit = idx;
    else if (/출금|찾으신|지급/.test(c)) model.withdraw = idx;
    else if (/잔액/.test(c)) model.balance = idx;
    else if (/거래금액|이체금액|^금액|금액\(/.test(c)) model.amount = idx;
    else if (/구분|유형|입출/.test(c)) model.types.push(idx);
  });
  model.names = ranked.sort((a, b) => a.rank - b.rank || a.idx - b.idx).map((r) => r.idx);
  model.depositFirst = model.deposit >= 0 && model.withdraw >= 0 && model.deposit < model.withdraw;
  if (model.deposit < 0 && model.amount < 0) return null; // 금액 열을 못 찾으면 머리글로 쓰지 않는다
  return model;
}

// ---------- 줄 읽기 ----------

type Row = { amount: number; name: string; date: string | null } | null;

/** 입금·출금 두 칸과 잔액이 이어진 숫자 묶음에서 입금액을 고른다. 모르면 null. */
function pickDepositFromNumbers(nums: Array<number | null>, depositFirst: boolean): number | null {
  // null은 비어 있는 칸(탭 표). 값은 있지만 부호로 출금이 드러나는 경우는 호출 전에 걸렀다.
  if (nums.length === 1) return nums[0];
  if (nums.length === 2) {
    const [a, b] = nums;
    if (a === null) return b;
    if (b === null) return a;
    // 한쪽이 0이면 [출금, 입금] 칸, 둘 다 값이면 [금액, 잔액]
    if (a === 0 || b === 0) return depositFirst ? a : b;
    return a;
  }
  // 3칸 이상: 맨 끝은 잔액. 그 앞 두 칸이 [출금, 입금](입금이 먼저인 은행은 반대)
  const depositIdx = depositFirst ? nums.length - 3 : nums.length - 2;
  return nums[depositIdx];
}

function parseWithHeader(cells: string[], h: HeaderModel, ref: string): Row {
  const at = (i: number) => (i >= 0 && i < cells.length ? cells[i] : '');
  let amount: number | null = null;
  if (h.deposit >= 0) {
    const p = parseAmountToken(at(h.deposit));
    amount = p && p.sign !== '-' ? p.value : null;
  } else if (h.amount >= 0) {
    const p = parseAmountToken(at(h.amount));
    const typeText = h.types.length > 0 ? h.types.map(at).join(' ') : cells.join(' ');
    const isWithdraw = /출금|지급|체크카드|결제/.test(typeText) && !/입금/.test(typeText);
    amount = p && p.sign !== '-' && !isWithdraw ? p.value : null;
  }
  if (!amount || amount < 1) return null;
  let name = '';
  for (const idx of h.names) {
    name = nameFrom(at(idx).split(/\s+/), ref);
    if (name) break;
  }
  if (!name) {
    const taken = new Set([h.deposit, h.withdraw, h.amount, h.balance, ...h.types]);
    name = nameFrom(cells.filter((_, i) => !taken.has(i)).flatMap((c) => c.split(/\s+/)), ref);
  }
  let date: string | null = null;
  for (const c of cells) {
    const first = c.split(/\s+/)[0] ?? '';
    const d = parseDateToken(first, ref);
    if (d) {
      date = d;
      break;
    }
  }
  return { amount, name, date };
}

/** 머리글 없는 탭 표 */
function parseTabbedRow(cells: string[], depositFirst: boolean, ref: string): Row {
  const parsed = cells.map((c) => (c === '' ? null : parseAmountToken(c)));
  const isDateCell = (c: string) => !!parseDateToken(c.split(/\s+/)[0] ?? '', ref);
  let last = -1;
  for (let i = cells.length - 1; i >= 0; i--) {
    if (parsed[i] && !isDateCell(cells[i])) {
      last = i;
      break;
    }
  }
  if (last < 0) return null;
  let start = last;
  while (start - 1 >= 0 && (cells[start - 1] === '' || (parsed[start - 1] && !isDateCell(cells[start - 1]))) && last - start < 2) start -= 1;
  const tail = parsed.slice(start, last + 1);
  if (tail.some((p) => p && p.sign === '-')) {
    // 부호 있는 열(−)이 하나라도 있으면 그 줄은 출금 줄로 본다. 단 잔액이 음수인 경우는 드물어 무시한다.
    return null;
  }
  const picked = pickDepositFromNumbers(tail.map((p) => (p ? p.value : null)), depositFirst);
  const rowText = cells.join(' ');
  // 칸이 1~2개뿐이면 열 구조가 없어 낱말로 출금을 거른다
  if (tail.length <= 2 && /출금/.test(rowText) && !/입금/.test(rowText)) return null;
  if (!picked || picked < 1) return null;

  const before = cells.slice(0, start).flatMap((c) => c.split(/\s+/));
  const after = cells.slice(last + 1).flatMap((c) => c.split(/\s+/));
  const name = nameFrom(before, ref) || nameFrom(after, ref);
  let date: string | null = null;
  for (const c of cells) {
    const d = parseDateToken(c.split(/\s+/)[0] ?? '', ref);
    if (d) {
      date = d;
      break;
    }
  }
  return { amount: picked, name, date };
}

/** 공백·쉼표로 이어진 줄글 */
function parseFreeLine(line: string, depositFirst: boolean, bothColumns: boolean, ref: string): Row {
  const tokens = splitTokens(line);
  let date: string | null = null;
  const kinds: Array<'amount' | 'other'> = [];
  const amounts: Array<{ value: number; sign: string }> = [];
  const texts: string[] = [];
  let hasDepositWord = false;
  let hasWithdrawWord = false;
  tokens.forEach((tok) => {
    if (TIME_RE.test(tok)) {
      kinds.push('other');
      return;
    }
    const d = parseDateToken(tok, ref);
    if (d) {
      if (!date) date = d;
      kinds.push('other');
      return;
    }
    const a = parseAmountToken(tok);
    if (a) {
      kinds.push('amount');
      amounts.push(a);
      return;
    }
    kinds.push('other');
    if (/입금/.test(tok)) hasDepositWord = true;
    if (/출금/.test(tok)) hasWithdrawWord = true;
    texts.push(tok);
  });
  if (amounts.length === 0) return null;

  // 마지막으로 이어진 숫자 묶음이 금액 열이다. 앞쪽의 순번·번호 숫자에 속지 않는다.
  let end = kinds.length - 1;
  while (end >= 0 && kinds[end] !== 'amount') end -= 1;
  let begin = end;
  while (begin - 1 >= 0 && kinds[begin - 1] === 'amount') begin -= 1;
  const block: Array<{ value: number; sign: string }> = [];
  let ai = 0;
  kinds.forEach((k, i) => {
    if (k === 'amount') {
      if (i >= begin && i <= end) block.push(amounts[ai]);
      ai += 1;
    }
  });

  if (hasWithdrawWord && !hasDepositWord) return null;
  if (block.some((b) => b.sign === '-')) return null;
  // 머리글에 입금·출금 열이 둘 다 있는데 줄글이라 빈 칸이 사라졌다면, 숫자 둘(금액+잔액)이 입금인지 출금인지 알 수 없다.
  // '입금'이라는 낱말이 없으면 입금으로 읽지 않는다.
  if (bothColumns && !hasDepositWord && block.length === 2 && block[0].value !== 0 && block[1].value !== 0) return null;
  const picked = pickDepositFromNumbers(block.map((b) => b.value), depositFirst);
  if (!picked || picked < 1) return null;
  return { amount: picked, name: nameFrom(texts, ref), date };
}

/**
 * 은행 거래내역 붙여넣기 글을 입금 목록으로 바꾼다. 읽지 못한 줄·출금 줄·합계 줄은 건너뛴다.
 * today는 "MM/DD"처럼 연도가 없는 날짜의 연도를 정할 때만 쓴다.
 */
export function parseBankText(text: string, today: Date = new Date()): Deposit[] {
  const ref = seoulDateString(today);
  const normalized = String(text ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u00A0\u3000]/g, ' ')
    .replace(/"/g, '')
    .replace(/(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/g, '$1-$2-$3')
    .replace(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/g, '$1/$2');

  const out: Deposit[] = [];
  let header: HeaderModel | null = null;
  const lines = normalized.split('\n');
  for (const rawLine of lines.length > MAX_LINES ? lines.slice(0, MAX_LINES) : lines) {
    const line = rawLine.trim();
    // 비정상적으로 긴 줄은 거래 내역이 아니다(문서 통째로 붙여 넣은 경우 등)
    if (!line || line.length > MAX_LINE_LENGTH) continue;
    const newHeader = parseHeader(line);
    if (newHeader) {
      header = newHeader;
      continue;
    }
    if (!/\d/.test(line) || SKIP_LINE_RE.test(line)) continue;

    let row: Row;
    if (line.includes('\t')) {
      // 줄 앞쪽의 빈 칸(탭)은 열 위치를 뜻하므로 보존하고, 공백 글자만 걷어낸다.
      const cells = rawLine.replace(/^ +/, '').split('\t').map((c) => c.trim());
      if (header && header.tabbed) {
        // 머리글이 있으면 열 위치로 읽는다. 끝쪽 빈 칸이 잘려 나온 줄은 빈 칸으로 채운다.
        while (cells.length < header.cellCount) cells.push('');
        row = parseWithHeader(cells, header, ref);
      } else {
        row = parseTabbedRow(cells, header?.depositFirst ?? false, ref);
      }
    } else {
      row = parseFreeLine(line, header?.depositFirst ?? false, !!header && header.deposit >= 0 && header.withdraw >= 0, ref);
    }
    if (row) out.push({ date: row.date, name: row.name, amount: row.amount, raw: line });
  }
  return out;
}

// ---------- 이름 비슷함 ----------

/** 괄호 안 설명(은행 약칭 등)과 숫자·기호를 떼고 글자만 남긴다. */
export function normalizePersonName(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/\([^)]*\)|\[[^\]]*\]/g, '')
    .replace(/[^A-Za-z가-힣]/g, '')
    .toLowerCase();
}

function editDistanceOne(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i] && ++diff > 1) return false;
  return diff === 1;
}

type NameRelation = 'exact' | 'contains' | 'close' | null;

export function nameRelation(depositName: string, billName: string | null | undefined): NameRelation {
  const a = normalizePersonName(depositName);
  const b = normalizePersonName(billName);
  if (a.length < 2 || b.length < 2) return null;
  if (a === b) return 'exact';
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  // 두 글자 이름은 "김수"가 "김수현"에 들어 있다고 같은 사람이 아니다. 3글자 이상일 때만 포함을 인정한다.
  if (short.length >= 3 && long.includes(short)) return 'contains';
  if (a.length >= 3 && editDistanceOne(a, b)) return 'close';
  return null;
}

// ---------- 매칭 ----------

const RANK: Record<MatchConfidence, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };

interface Candidate {
  depositIndex: number;
  billIndex: number;
  billId: number;
  confidence: MatchConfidence;
  score: number;
  reason: string;
}

function won(n: number): string {
  return `${n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}원`;
}

/**
 * 입금 하나당 청구서 하나를 "제안"한다. 절대 자동 반영하지 않는다 — 직원이 확인 후 수납 처리한다.
 * - HIGH: 남은 금액과 같고 입금자명이 납부자/어르신 이름과 같다.
 * - MEDIUM: 남은 금액이 같은 청구서가 하나뿐이거나, 이름이 한 글자 다르다.
 * - LOW: 같은 금액 청구서가 여러 건이라 고를 수 없거나, 이름만 같고 금액이 다르다(분할·초과 납부 후보).
 * 한 청구서는 한 번만 짝이 된다 — 같은 입금을 두 번 붙여 넣어도 같은 청구서에 이중 수납을 제안하지 않는다.
 */
export function matchDeposits(deposits: ReadonlyArray<Pick<Deposit, 'name' | 'amount'>>, bills: ReadonlyArray<MatchableBill>): Match[] {
  const open = bills
    .map((bill, billIndex) => ({ bill, billIndex, remaining: bill.totalDue - bill.paidAmount }))
    .filter((b) => b.bill.status !== 'PAID' && b.remaining > 0);

  const candidates: Candidate[] = [];
  deposits.forEach((dep, depositIndex) => {
    if (!Number.isInteger(dep.amount) || dep.amount <= 0) return;
    const sameAmount = open.filter((b) => b.remaining === dep.amount);
    for (const { bill, billIndex, remaining } of open) {
      const rels = [nameRelation(dep.name, bill.payerName), nameRelation(dep.name, bill.elderlyName)];
      const strong = rels.some((r) => r === 'exact' || r === 'contains');
      const exact = rels.some((r) => r === 'exact');
      const close = rels.some((r) => r === 'close');
      const target = bill.payerName && nameRelation(dep.name, bill.payerName) ? `납부자 ${bill.payerName}` : `${bill.elderlyName} 어르신`;

      if (remaining === dep.amount) {
        if (strong) {
          candidates.push({
            depositIndex, billIndex, billId: bill.id, confidence: 'HIGH', score: exact ? 101 : 100,
            reason: `남은 금액 ${won(remaining)}과 같고 입금자명이 ${target}과(와) 일치합니다`,
          });
        } else if (close) {
          candidates.push({
            depositIndex, billIndex, billId: bill.id, confidence: 'MEDIUM', score: 70,
            reason: `남은 금액 ${won(remaining)}과 같고 입금자명이 ${target}과(와) 한 글자 다릅니다`,
          });
        } else if (sameAmount.length === 1) {
          candidates.push({
            depositIndex, billIndex, billId: bill.id, confidence: 'MEDIUM', score: 60,
            reason: `남은 금액 ${won(remaining)}과 같은 청구서가 이 한 건뿐입니다 (입금자명은 일치하지 않음)`,
          });
        } else {
          candidates.push({
            depositIndex, billIndex, billId: bill.id, confidence: 'LOW', score: 30,
            reason: `남은 금액 ${won(remaining)}이 같은 청구서가 ${sameAmount.length}건이라 이름으로 구분되지 않습니다`,
          });
        }
      } else if (strong) {
        candidates.push({
          depositIndex, billIndex, billId: bill.id, confidence: 'LOW', score: 20,
          reason: dep.amount < remaining
            ? `입금자명이 ${target}과(와) 같지만 남은 금액 ${won(remaining)}보다 적습니다 (일부 납부일 수 있음)`
            : `입금자명이 ${target}과(와) 같지만 남은 금액 ${won(remaining)}보다 많습니다`,
        });
      }
    }
  });

  candidates.sort((a, b) => b.score - a.score || a.depositIndex - b.depositIndex || a.billIndex - b.billIndex);
  const usedDeposits = new Set<number>();
  const usedBills = new Set<number>();
  const result: Match[] = [];
  for (const c of candidates) {
    if (usedDeposits.has(c.depositIndex) || usedBills.has(c.billIndex)) continue;
    usedDeposits.add(c.depositIndex);
    usedBills.add(c.billIndex);
    result.push({ depositIndex: c.depositIndex, billId: c.billId, confidence: c.confidence, reason: c.reason });
  }
  return result.sort((a, b) => a.depositIndex - b.depositIndex);
}

/** 화면 정렬용: 신뢰도 높은 순 */
export function confidenceRank(c: MatchConfidence): number {
  return RANK[c];
}
