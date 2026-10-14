/**
 * 회계 장부 규칙 — 계정(관·항·목) 목록, 연간 요약, 현금출납부, 후원금 사용 현황.
 *
 * 계정 출처: 「사회복지법인 및 사회복지시설 재무ㆍ회계 규칙」(법제처 국가법령정보센터, 시행 2023-01-01본)
 *  - 세출: [별표 10] 노인장기요양기관의 세출예산과목 구분 (제10조제3항제3호 관련, <개정 2022. 12. 28.>)
 *  - 세입: [별표 9] 노인장기요양기관의 세입예산과목 구분 (<신설 2018. 3. 30.>)
 *  https://www.law.go.kr/법령/사회복지법인및사회복지시설재무ㆍ회계규칙
 * 대조 필요: 이 규칙이 2023-01-01 이후 바뀌었는지, 기관이 시설회계 별표(법인 소속 일반 시설)를 따라야 하는지는 사용 시점에 확인한다.
 *
 * 서버 장부는 계정 코드를 세 자리 숫자(CHAR(3))로만 저장한다. 별표의 네 자리 목(세출 1011·1012, 세입 1011~1014·1111·1112)은
 * 저장할 수 없으므로 그 항(세 자리, '101')의 코드를 대신 쓴다 — 이 항목은 `approximate: true`로 표시하고 화면이 "대조 필요"를 붙인다.
 * 세입과 세출은 코드가 같아도 다른 계정이다(예: 세입 111 적립금 / 세출 111 급여). 반드시 방향과 함께 찾는다.
 */
import type { Donation, LedgerDirection, LedgerEntry } from './labTypes.ts';

export interface LedgerAccount {
  /** 세 자리 코드(목). 네 자리 목을 항 코드로 대신하는 계정은 approximate */
  code: string;
  name: string;
  /** 관 이름 */
  group: string;
  /** 항 이름 */
  section: string;
  groupCode: string;
  sectionCode: string;
  /** 별표의 네 자리 목을 세 자리 항 코드로 대신한 계정 — 대조 필요 */
  approximate?: boolean;
}

function account(groupCode: string, group: string, sectionCode: string, section: string, code: string, name: string, approximate?: boolean): LedgerAccount {
  return approximate ? { code, name, group, section, groupCode, sectionCode, approximate } : { code, name, group, section, groupCode, sectionCode };
}

/** 세출 — 노인장기요양기관 세출예산과목 구분(별표 10)의 관·항·목. 별표에 없는 번호(114·134·313)는 넣지 않았다. */
export const EXPENSE_ACCOUNTS: ReadonlyArray<LedgerAccount> = [
  account('01', '사무비', '11', '인건비', '111', '급여'),
  account('01', '사무비', '11', '인건비', '112', '각종 수당'),
  account('01', '사무비', '11', '인건비', '113', '일용잡급'),
  account('01', '사무비', '11', '인건비', '115', '퇴직금 및 퇴직적립금'),
  account('01', '사무비', '11', '인건비', '116', '사회보험 부담금'),
  account('01', '사무비', '12', '업무추진비', '121', '기관운영비'),
  account('01', '사무비', '12', '업무추진비', '122', '직책보조비'),
  account('01', '사무비', '12', '업무추진비', '123', '회의비'),
  account('01', '사무비', '13', '운영비', '131', '여비'),
  account('01', '사무비', '13', '운영비', '132', '수용비 및 수수료'),
  account('01', '사무비', '13', '운영비', '133', '공공요금 및 각종 세금공과금'),
  account('01', '사무비', '13', '운영비', '135', '차량비'),
  account('01', '사무비', '13', '운영비', '136', '임차료'),
  account('01', '사무비', '13', '운영비', '137', '기타운영비'),
  account('02', '재산조성비', '21', '시설비', '211', '시설비'),
  account('02', '재산조성비', '21', '시설비', '212', '자산취득비'),
  account('02', '재산조성비', '21', '시설비', '213', '시설장비 유지비'),
  account('03', '사업비', '31', '운영비', '311', '생계비'),
  account('03', '사업비', '31', '운영비', '312', '수용기관경비'),
  account('03', '사업비', '31', '운영비', '314', '의료비'),
  account('03', '사업비', '31', '운영비', '315', '장의비'),
  account('03', '사업비', '33', '○○사업비', '331', '프로그램사업비'),
  account('03', '사업비', '34', '복지용구취득비', '341', '대여용구 취득비'),
  account('03', '사업비', '34', '복지용구취득비', '342', '판매용구 취득비'),
  account('04', '전출금', '41', '전출금', '411', '법인회계 전출금'),
  account('04', '전출금', '41', '전출금', '412', '기타전출금'),
  account('05', '과년도지출', '51', '과년도지출', '511', '과년도지출'),
  account('06', '상환금', '61', '부채상환금', '611', '원금상환금'),
  account('06', '상환금', '61', '부채상환금', '612', '이자지불금'),
  account('07', '잡지출', '71', '잡지출', '711', '잡지출'),
  account('08', '예비비 및 기타', '81', '예비비 및 기타', '811', '예비비'),
  account('08', '예비비 및 기타', '81', '예비비 및 기타', '812', '반환금'),
  account('09', '적립금 및 준비금', '91', '운영충당 적립금 및 환경개선준비금', '911', '운영충당 적립금'),
  account('09', '적립금 및 준비금', '91', '운영충당 적립금 및 환경개선준비금', '912', '시설환경개선준비금'),
  account('10', '적립금 및 준비금 지출(특별회계)', '101', '운영충당 적립금 지출 및 환경개선준비금 지출', '101', '적립금·준비금 지출(별표 목 1011 운영충당적립금 지출 · 1012 시설환경개선준비금 지출)', true),
];

/**
 * 세입 — 노인장기요양기관 세입예산과목 구분(별표 9)의 관·항·목. 화면이 AI 제안·입력 선택에 쓰는 참고 목록이며 "대조 필요" 표시를 붙인다.
 * 별표에 없는 번호(111)는 넣지 않았다. 별표 9의 111은 세입 11관 적립금의 항 코드다.
 */
export const INCOME_ACCOUNTS: ReadonlyArray<LedgerAccount> = [
  account('01', '입소자(이용자)부담금수입', '11', '입소(이용)비용수입', '112', '본인부담금수입'),
  account('01', '입소자(이용자)부담금수입', '11', '입소(이용)비용수입', '113', '식재료비수입'),
  account('01', '입소자(이용자)부담금수입', '11', '입소(이용)비용수입', '114', '상급침실이용료'),
  account('01', '입소자(이용자)부담금수입', '11', '입소(이용)비용수입', '115', '이미용비'),
  account('01', '입소자(이용자)부담금수입', '11', '입소(이용)비용수입', '116', '기타비급여수입'),
  account('02', '사업수입', '21', '사업수입', '211', '○○사업수입'),
  account('03', '과년도수입', '31', '과년도수입', '311', '과년도수입'),
  account('04', '보조금수입', '41', '보조금수입', '411', '국고보조금'),
  account('04', '보조금수입', '41', '보조금수입', '412', '시·도 보조금'),
  account('04', '보조금수입', '41', '보조금수입', '413', '시·군·구 보조금'),
  account('04', '보조금수입', '41', '보조금수입', '414', '기타 보조금'),
  account('05', '후원금수입', '51', '후원금수입', '511', '지정후원금'),
  account('05', '후원금수입', '51', '후원금수입', '512', '비지정후원금'),
  account('06', '요양급여수입', '61', '요양급여수입', '611', '장기요양급여수입'),
  account('06', '요양급여수입', '61', '요양급여수입', '612', '가산금 수입'),
  account('07', '차입금', '71', '차입금', '711', '금융기관 차입금'),
  account('07', '차입금', '71', '차입금', '712', '기타차입금'),
  account('08', '전입금', '81', '전입금', '811', '법인전입금'),
  account('08', '전입금', '81', '전입금', '812', '법인전입금(후원금)'),
  account('08', '전입금', '81', '전입금', '813', '기타전입금'),
  account('08', '전입금', '81', '전입금', '814', '기타전입금(후원금)'),
  account('09', '이월금', '91', '이월금', '911', '전년도이월금'),
  account('09', '이월금', '91', '이월금', '912', '전년도이월금(후원금)'),
  account('09', '이월금', '91', '이월금', '913', '전년도이월금(식재료비)'),
  account('09', '이월금', '91', '이월금', '914', '○○ 이월사업비'),
  account('10', '잡수입', '101', '잡수입', '101', '잡수입(별표 목 1011 불용품매각대 · 1012 기타예금이자수입 · 1013 직원식재료비수입 · 1014 기타잡수입)', true),
];

/** 화면이 "대조 필요"로 표시해야 하는 장부 규칙 */
export const LEDGER_VERIFY_NOTES: readonly string[] = [
  '계정 과목은 재무ㆍ회계 규칙 별표 9·10(노인장기요양기관, 시행 2023-01-01본)입니다. 이후 개정 여부와 기관이 시설회계 별표를 따라야 하는지 대조 필요',
  '네 자리 목(세입 1011~1014·1111·1112, 세출 1011·1012)은 장부가 세 자리 코드만 저장해 항 코드 101로 대신합니다. 대조 필요',
  '세입 계정은 참고용입니다. 결산서(세입결산서·세출결산서) 제출 전에 과목을 대조해 주세요',
] as const;

export function accountsFor(direction: LedgerDirection): ReadonlyArray<LedgerAccount> {
  return direction === 'INCOME' ? INCOME_ACCOUNTS : EXPENSE_ACCOUNTS;
}

export function findAccount(direction: LedgerDirection, code: string): LedgerAccount | null {
  return accountsFor(direction).find((a) => a.code === code) ?? null;
}

export function isAccountCode(direction: LedgerDirection, code: unknown): code is string {
  return typeof code === 'string' && findAccount(direction, code) !== null;
}

/** 화면 표시용 이름: "133 공공요금 및 각종 세금공과금". 목록에 없는 코드는 "(목록에 없음)"을 붙인다. */
export function accountLabel(direction: LedgerDirection, code: string): string {
  const found = findAccount(direction, code);
  return found ? `${found.code} ${found.name}` : `${code} (목록에 없음)`;
}

// ---------- 입력 검증 ----------

export const MAX_LEDGER_AMOUNT = 10_000_000_000;
export const MAX_LEDGER_DESCRIPTION = 200;
export const MAX_COUNTERPARTY = 100;

/** 장부 한 줄의 오류 문장 목록(비어 있으면 통과). 서버 한도와 같다. */
export function ledgerEntryIssues(entry: Pick<LedgerEntry, 'entryDate' | 'direction' | 'accountCode' | 'description' | 'amount' | 'counterparty'>): string[] {
  const issues: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.entryDate)) issues.push('날짜를 적어 주세요');
  if (entry.direction !== 'INCOME' && entry.direction !== 'EXPENSE') issues.push('수입과 지출 중 하나를 골라 주세요');
  else if (!isAccountCode(entry.direction, entry.accountCode)) issues.push('계정을 목록에서 골라 주세요');
  if (entry.description.trim() === '') issues.push('내용을 적어 주세요');
  if (Array.from(entry.description).length > MAX_LEDGER_DESCRIPTION) issues.push(`내용은 ${MAX_LEDGER_DESCRIPTION}자까지 적을 수 있습니다`);
  if (!Number.isInteger(entry.amount) || entry.amount < 1 || entry.amount > MAX_LEDGER_AMOUNT) issues.push('금액은 1원 이상 100억 원 이하의 정수여야 합니다');
  if (entry.counterparty && Array.from(entry.counterparty).length > MAX_COUNTERPARTY) issues.push(`거래처는 ${MAX_COUNTERPARTY}자까지 적을 수 있습니다`);
  return issues;
}

// ---------- 공통 도우미 ----------

export type LedgerLike = Pick<LedgerEntry, 'entryDate' | 'direction' | 'accountCode' | 'amount'> & Partial<Pick<LedgerEntry, 'id' | 'description' | 'donationId'>>;

function amountOf(entry: { amount: number }): number {
  return Number.isFinite(entry.amount) ? Math.trunc(entry.amount) : 0;
}

/** 날짜순(같은 날은 id 순, 그다음은 들어온 순서)으로 정렬한 사본 */
function sortedByDate<T extends LedgerLike>(entries: ReadonlyArray<T>): T[] {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => (a.entry.entryDate < b.entry.entryDate ? -1 : a.entry.entryDate > b.entry.entryDate ? 1 : (a.entry.id ?? 0) - (b.entry.id ?? 0) || a.index - b.index))
    .map((x) => x.entry);
}

// ---------- 연간 요약 (관·항·목별 월별 합) ----------

export interface SummaryAccountRow {
  code: string;
  name: string;
  /** 1~12월(인덱스 0 = 1월) 합계 */
  months: number[];
  total: number;
  /** 목록에 없는 계정 코드 */
  unknown: boolean;
}

export interface SummarySectionRow {
  code: string;
  name: string;
  months: number[];
  total: number;
  accounts: SummaryAccountRow[];
}

export interface SummaryGroupRow {
  code: string;
  name: string;
  months: number[];
  total: number;
  sections: SummarySectionRow[];
}

export interface DirectionSummary {
  months: number[];
  total: number;
  groups: SummaryGroupRow[];
}

export interface LedgerSummary {
  year: number;
  income: DirectionSummary;
  expense: DirectionSummary;
  /** 월별 수입 − 지출(인덱스 0 = 1월) */
  netByMonth: number[];
  /** 그 해 수입 − 지출 */
  net: number;
}

function zeros(): number[] {
  return Array.from({ length: 12 }, () => 0);
}

function addTo(rows: Array<{ months: number[]; total: number }>, month: number, amount: number): void {
  for (const row of rows) {
    row.months[month] += amount;
    row.total += amount;
  }
}

function summarize(direction: LedgerDirection, entries: ReadonlyArray<LedgerLike>, year: number): DirectionSummary {
  const prefix = `${String(year).padStart(4, '0')}-`;
  const groups: SummaryGroupRow[] = [];
  // 계정 코드 → 그 계정이 속한 행들(목·항·관). 합계가 0인 계정도 목록 순서대로 뼈대를 만들어 연간 서식이 흔들리지 않게 한다.
  const parents = new Map<string, Array<{ months: number[]; total: number }>>();
  for (const a of accountsFor(direction)) {
    let g = groups.find((x) => x.code === a.groupCode);
    if (!g) {
      g = { code: a.groupCode, name: a.group, months: zeros(), total: 0, sections: [] };
      groups.push(g);
    }
    let s = g.sections.find((x) => x.code === a.sectionCode);
    if (!s) {
      s = { code: a.sectionCode, name: a.section, months: zeros(), total: 0, accounts: [] };
      g.sections.push(s);
    }
    const row: SummaryAccountRow = { code: a.code, name: a.name, months: zeros(), total: 0, unknown: false };
    s.accounts.push(row);
    parents.set(a.code, [row, s, g]);
  }
  const unknownRows = new Map<string, SummaryAccountRow>();
  const total = { months: zeros(), total: 0 };
  for (const entry of entries) {
    if (entry.direction !== direction || !entry.entryDate.startsWith(prefix)) continue;
    const month = Number(entry.entryDate.slice(5, 7)) - 1;
    if (!(month >= 0 && month < 12)) continue;
    const amount = amountOf(entry);
    let rows = parents.get(entry.accountCode);
    if (!rows) {
      let row = unknownRows.get(entry.accountCode);
      if (!row) {
        row = { code: entry.accountCode, name: '(목록에 없는 계정)', months: zeros(), total: 0, unknown: true };
        unknownRows.set(entry.accountCode, row);
      }
      rows = [row];
    }
    addTo([...rows, total], month, amount);
  }
  if (unknownRows.size > 0) {
    const accounts = [...unknownRows.values()].sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
    const months = accounts.reduce((acc, r) => acc.map((v, i) => v + r.months[i]), zeros());
    const sum = accounts.reduce((acc, r) => acc + r.total, 0);
    groups.push({ code: '??', name: '미분류', months, total: sum, sections: [{ code: '???', name: '목록에 없는 계정', months: [...months], total: sum, accounts }] });
  }
  return { months: total.months, total: total.total, groups };
}

/** 그 해 관·항·목별 월별 합. 합계가 0인 계정도 목록 순서대로 들어 있다. 목록에 없는 코드는 '미분류' 관에 따로 모은다. */
export function ledgerSummary(entries: ReadonlyArray<LedgerLike>, year: number): LedgerSummary {
  const income = summarize('INCOME', entries, year);
  const expense = summarize('EXPENSE', entries, year);
  return { year, income, expense, netByMonth: income.months.map((v, i) => v - expense.months[i]), net: income.total - expense.total };
}

// ---------- 현금출납부 ----------

export interface CashBookRow {
  entryDate: string;
  direction: LedgerDirection;
  accountCode: string;
  description: string;
  /** 수입액(수입 줄이면 금액, 아니면 0) */
  income: number;
  /** 지출액 */
  expense: number;
  /** 이 줄까지 반영한 잔액 */
  balance: number;
  id: number | null;
}

/** 그 달 시작 전까지의 이월 잔액 = opening(전기이월, 가장 이른 기록 이전 잔액) + 그 달 1일 전의 수입 − 지출 */
export function carryForward(entries: ReadonlyArray<LedgerLike>, month: string, opening: number): number {
  const start = `${month}-01`;
  return entries.reduce((balance, e) => (e.entryDate < start ? balance + (e.direction === 'INCOME' ? amountOf(e) : -amountOf(e)) : balance), Math.trunc(opening));
}

/**
 * 그 달(month 'YYYY-MM') 현금출납부 — 날짜순으로 줄마다 잔액을 계산한다. opening은 그 달 1일의 이월 잔액이다.
 * 이전 달 기록이 있으면 carryForward로 이월 잔액을 구해 넘긴다.
 */
export function cashBook(entries: ReadonlyArray<LedgerLike>, month: string, opening: number): CashBookRow[] {
  let balance = Math.trunc(opening);
  return sortedByDate(entries.filter((e) => e.entryDate.startsWith(`${month}-`))).map((e) => {
    const amount = amountOf(e);
    const income = e.direction === 'INCOME' ? amount : 0;
    const expense = e.direction === 'EXPENSE' ? amount : 0;
    balance += income - expense;
    return { entryDate: e.entryDate, direction: e.direction, accountCode: e.accountCode, description: e.description ?? '', income, expense, balance, id: e.id ?? null };
  });
}

export interface CashBookTotals {
  opening: number;
  income: number;
  expense: number;
  closing: number;
}

export function cashBookTotals(rows: ReadonlyArray<CashBookRow>, opening: number): CashBookTotals {
  const income = rows.reduce((sum, r) => sum + r.income, 0);
  const expense = rows.reduce((sum, r) => sum + r.expense, 0);
  return { opening: Math.trunc(opening), income, expense, closing: Math.trunc(opening) + income - expense };
}

// ---------- 후원금 ----------

export interface DonationUsage<T> {
  /** 연결된 지출의 합 */
  used: number;
  /** 후원금 − 사용액. 음수이면 후원금보다 더 쓴 것이다 */
  remaining: number;
  overspent: boolean;
  /** 이 후원금에 연결된 지출 줄(날짜순) */
  entries: T[];
}

/** 이 후원금에 연결된 지출(donationId가 같은 지출 줄)과 사용액·잔액. 수입 줄은 연결해도 사용액에 넣지 않는다. */
export function donationUsage<T extends Pick<LedgerEntry, 'donationId' | 'direction' | 'amount'> & Partial<Pick<LedgerEntry, 'entryDate'>>>(donation: Pick<Donation, 'id' | 'amount'>, entries: ReadonlyArray<T>): DonationUsage<T> {
  const linked = entries
    .filter((e) => e.donationId === donation.id && e.direction === 'EXPENSE')
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => ((a.entry.entryDate ?? '') < (b.entry.entryDate ?? '') ? -1 : (a.entry.entryDate ?? '') > (b.entry.entryDate ?? '') ? 1 : a.index - b.index))
    .map((x) => x.entry);
  const used = linked.reduce((sum, e) => sum + amountOf(e), 0);
  const remaining = Math.trunc(donation.amount) - used;
  return { used, remaining, overspent: remaining < 0, entries: linked };
}
