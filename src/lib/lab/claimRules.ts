/**
 * 공단 청구 대조 규칙 — 청구내역 붙여넣기 읽기, 시간 구간, 이름 매칭, 출석·본인부담금 청구서와 대조, 월 한도 사용률.
 *
 * 근거(research-6.md 6절): 청구명세서에는 급여 제공일자·제공시간이 들어가고 총 급여일수는 급여를 제공한 일수의 합이다. 급여비용은 등급과
 * 1일 급여제공시간 구간으로 정해지며(고시 제31조) 하루 제공시간은 요양보호사가 가정에 도착한 때부터 다시 가정에 도착한 때까지(송영 이동시간 포함, 제16조)다.
 * 3시간 미만은 라-1(3~6시간) 금액의 80%(제32조). 월 한도액은 2026-01-01 시행 고시 표 기준이며 2026-10-01 개정본과 대조 필요.
 *
 * 이름은 이 모듈 안에서만 쓰고 AI로 보내지 않는다. 붙여 넣은 글은 직원 PC 화면에서만 읽는다.
 * 금액·비율 계산은 정수 연산으로 해서 부동소수 오차가 없다.
 */
import type { ClaimBand, CopayBill, HourBand, LtcCareGrade } from './labTypes.ts';
import { MONTHLY_LIMIT_2026 } from '../ltc2026.ts';
import { isValidMonth, isValidYmd } from './labDate.ts';

/** 월 한도액 표의 기준 — 화면이 "대조 필요"로 보여 준다 */
export const MONTHLY_LIMIT_NOTE = '월 한도액은 2026-01-01 시행 고시 표 기준입니다. 2026-10-01 개정본 표와 대조가 필요합니다.';

export const CLAIM_BANDS: ReadonlyArray<{ value: ClaimBand; label: string }> = [
  { value: 'under3', label: '3시간 미만(3~6시간 금액의 80%)' },
  { value: 'h3to6', label: '3시간 이상 6시간 미만' },
  { value: 'h6to8', label: '6시간 이상 8시간 미만' },
  { value: 'h8to10', label: '8시간 이상 10시간 미만' },
  { value: 'h10to13', label: '10시간 이상 13시간 이하' },
  { value: 'over13', label: '13시간 초과' },
];

export function claimBandLabel(band: string | null | undefined): string {
  return CLAIM_BANDS.find((b) => b.value === band)?.label ?? '';
}

export function isClaimBand(value: unknown): value is ClaimBand {
  return typeof value === 'string' && CLAIM_BANDS.some((b) => b.value === value);
}

/** 하루 제공시간(분)이 속한 청구 구간 — 고시 제16조·제31조. 180분 미만 under3, 780분(13시간)까지 h10to13, 그보다 길면 over13. 시간이 올바르지 않으면 null. */
export function bandOfMinutes(minutes: number): ClaimBand | null {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes < 0) return null;
  if (minutes < 180) return 'under3';
  if (minutes < 360) return 'h3to6';
  if (minutes < 480) return 'h6to8';
  if (minutes < 600) return 'h8to10';
  if (minutes <= 780) return 'h10to13';
  return 'over13';
}

// ---------- 붙여넣기 읽기 ----------

export interface ClaimRow {
  name: string;
  /** 청구(제공) 일수 0~31 */
  days: number;
  band: ClaimBand | null;
  /** 읽은 줄 원문(화면에서 확인용) */
  raw: string;
}

const TOTAL_NAMES = new Set(['합계', '소계', '계', '총계', '총합계']);
/** 구간 글: "8시간 이상~10시간 미만"·"8~10"·"3~6시간"·"10시간 이상 13시간 이하" 같은 범위(앞뒤가 날짜·숫자에 붙은 것은 제외) */
const RANGE = /(?<![\d.\-/])(\d{1,2})\s*(?:시간)?\s*(?:이상\s*)?[~∼～–-]\s*(\d{1,2})\s*(?:시간)?\s*(?:미만|이하)?(?![\d])/;
const RANGE_WORDS = /(?<![\d.\-/])(\d{1,2})\s*시간\s*이상\s*(\d{1,2})\s*시간\s*(?:미만|이하)/;
const OVER13 = /(?<![\d])13\s*시간\s*(?:초과|이상)/;
const UNDER3 = /(?<![\d])3\s*시간\s*미만/;
const RANGE_BAND: Record<string, HourBand> = { '3-6': 'h3to6', '6-8': 'h6to8', '8-10': 'h8to10', '10-13': 'h10to13' };

/** 줄에서 구간 표기를 찾아 (구간, 구간을 뺀 나머지 글)로 */
function takeBand(line: string): { band: ClaimBand | null; rest: string } {
  for (const re of [RANGE_WORDS, RANGE]) {
    const m = re.exec(line);
    const band = m ? RANGE_BAND[`${m[1]}-${m[2]}`] : undefined;
    if (m && band) return { band, rest: `${line.slice(0, m.index)} ${line.slice(m.index + m[0].length)}` };
  }
  for (const [re, band] of [[OVER13, 'over13'], [UNDER3, 'under3']] as const) {
    const m = re.exec(line);
    if (m) return { band, rest: `${line.slice(0, m.index)} ${line.slice(m.index + m[0].length)}` };
  }
  return { band: null, rest: line };
}

function splitFields(original: string, rest: string): string[] {
  const separator = original.includes('\t') ? /\t/ : original.includes(',') ? /,/ : /\s+/;
  return rest.split(separator).map((f) => f.trim()).filter((f) => f !== '');
}

/**
 * 공단 청구내역·급여제공 내역을 붙여 넣은 글을 줄마다 읽는다. 구분은 탭·쉼표·공백 어느 것이든 된다.
 *  - 일수: "20일"·"20" (0~31). "일"이 붙은 칸을 먼저 보고, 없으면 처음 나오는 0~31의 정수 칸.
 *  - 구간: "8시간 이상~10시간 미만"·"8~10"·"13시간 초과"·"3시간 미만" 등. 없으면 null.
 *  - 일수 숫자가 없는 줄(머리글)과 이름이 합계·소계·계인 줄은 건너뛴다. 줄 맨 앞의 순번은 무시한다.
 */
export function parseClaimText(text: string): ClaimRow[] {
  const rows: ClaimRow[] = [];
  for (const line of String(text ?? '').split(/\r\n|\r|\n/)) {
    const raw = line.trim();
    if (raw === '') continue;
    const { band, rest } = takeBand(raw);
    let fields = splitFields(raw, rest);
    // 줄 맨 앞 순번("1", "2.")은 이름이 아니다
    if (fields.length > 1 && /^\d{1,4}[.)]?$/.test(fields[0]) && /^[A-Za-z가-힣]/.test(fields[1])) fields = fields.slice(1);
    const nameIndex = fields.findIndex((f) => /^[A-Za-z가-힣][A-Za-z가-힣\s·.]*$/.test(f));
    if (nameIndex < 0) continue;
    const name = fields[nameIndex].replace(/\s+/g, ' ').trim();
    if (TOTAL_NAMES.has(name.replace(/\s/g, ''))) continue;
    const others = fields.filter((_, i) => i !== nameIndex);
    const withUnit = others.find((f) => /^\d{1,2}\s*일$/.test(f));
    const plain = others.find((f) => /^\d{1,2}$/.test(f));
    const token = withUnit ?? plain;
    if (token === undefined) continue;
    const days = Number.parseInt(token, 10);
    if (days > 31) continue;
    rows.push({ name, days, band, raw });
  }
  return rows;
}

// ---------- 이름 매칭 ----------

export interface ClaimMatch<R extends Pick<ClaimRow, 'name'> = ClaimRow> {
  row: R;
  /** 확정된 어르신(이름이 정확히 같고 한 명뿐일 때). 아니면 null */
  elderlyId: number | null;
  /** 확정이 아닐 때 고를 후보 — 성(첫 글자)과 글자 수가 같은 어르신, 동명이인이면 이름이 같은 모두 */
  candidates: number[];
}

function squash(name: string): string {
  return name.replace(/\s+/g, '');
}

/**
 * 청구 줄을 어르신에 잇는다. 이름의 공백을 지운 뒤 정확히 같은 어르신이 한 명이면 확정, 동명이인이면 후보로 돌린다.
 * 정확히 같은 이가 없으면 성(첫 글자)과 글자 수가 같은 어르신만 후보로 준다(글자 하나 다른 오타 정도). 다른 줄에서 이미 확정된 어르신은 후보에서 뺀다.
 * 이름은 이 함수 안에서만 비교하고 밖으로 내보내지 않는다.
 */
export function matchClaimRows<R extends Pick<ClaimRow, 'name'>>(rows: ReadonlyArray<R>, elders: ReadonlyArray<{ id: number; name: string }>): Array<ClaimMatch<R>> {
  const exactOf = (name: string) => elders.filter((e) => squash(e.name) === squash(name));
  const confirmed = new Set<number>();
  for (const row of rows) {
    const exact = exactOf(row.name);
    if (exact.length === 1) confirmed.add(exact[0].id);
  }
  return rows.map((row) => {
    const name = squash(row.name);
    const exact = exactOf(row.name);
    if (exact.length === 1) return { row, elderlyId: exact[0].id, candidates: [] };
    if (exact.length > 1) return { row, elderlyId: null, candidates: exact.map((e) => e.id) };
    const chars = Array.from(name);
    const similar = elders
      .filter((e) => {
        const other = Array.from(squash(e.name));
        return chars.length >= 2 && other.length === chars.length && other[0] === chars[0] && !confirmed.has(e.id);
      })
      .map((e) => e.id);
    return { row, elderlyId: null, candidates: similar };
  });
}

// ---------- 대조 ----------

export interface ReconcileRow {
  elderlyId: number;
  claimedDays: number;
  /** 그 달 출석한 서로 다른 날 수 */
  attendedDays: number;
  /** 같은 달 본인부담금 청구서의 일수. 청구서가 없으면 null */
  billedDays: number | null;
  claimedBand: ClaimBand | null;
  /** 같은 달 본인부담금 청구서의 시간 구간. 청구서가 없으면 null */
  billBand: HourBand | null;
  status: 'MATCH' | 'MISMATCH';
  reasons: string[];
}

export interface ReconcileInput {
  /** 'YYYY-MM' */
  month: string;
  rows: ReadonlyArray<{ elderlyId: number; days: number; band: ClaimBand | null }>;
  /** 어르신별 출석 날짜 'YYYY-MM-DD' (달 밖 날짜는 세지 않는다) */
  attendance: Readonly<Record<number, ReadonlyArray<string>>>;
  bills: ReadonlyArray<Pick<CopayBill, 'elderlyId' | 'billMonth' | 'days' | 'hourBand'>>;
}

/**
 * 청구 일수·구간을 출석과 본인부담금 청구서에 맞춰 본다. 차이가 하나라도 있으면 MISMATCH이고 사유(reasons)를 문장으로 준다.
 *  - 청구 일수 ≠ 출석 일수, 청구 일수 ≠ 청구서 일수(청구서가 있을 때), 청구 구간 ≠ 청구서 구간(둘 다 있을 때)
 *  - 청구서가 없으면 그 칸은 비교하지 않는다(사유 없음). 서버가 저장할 때 정하는 status는 일수만 보므로 구간 차이는 화면이 사유를 적어 확인한다.
 */
export function reconcile(input: ReconcileInput): ReconcileRow[] {
  const month = isValidMonth(input.month) ? input.month : '';
  return input.rows.map((row) => {
    const dates = new Set((input.attendance[row.elderlyId] ?? []).filter((d) => isValidYmd(d) && d.slice(0, 7) === month).map((d) => d.slice(0, 10)));
    const attendedDays = dates.size;
    const bill = input.bills.find((b) => b.elderlyId === row.elderlyId && b.billMonth === month) ?? null;
    const billedDays = bill ? bill.days : null;
    const billBand = bill ? bill.hourBand : null;
    const reasons: string[] = [];
    if (row.days > attendedDays) reasons.push(`청구 일수가 출석보다 ${row.days - attendedDays}일 많음`);
    else if (row.days < attendedDays) reasons.push(`청구 일수가 출석보다 ${attendedDays - row.days}일 적음`);
    if (billedDays !== null && billedDays !== row.days) reasons.push(`본인부담금 청구서 일수와 다름(청구서 ${billedDays}일)`);
    if (row.band !== null && billBand !== null && row.band !== billBand) reasons.push('시간 구간이 본인부담금 청구서와 다름');
    return {
      elderlyId: row.elderlyId,
      claimedDays: row.days,
      attendedDays,
      billedDays,
      claimedBand: row.band,
      billBand,
      status: reasons.length === 0 ? 'MATCH' : 'MISMATCH',
      reasons,
    };
  });
}

// ---------- 월 한도 ----------

export interface MonthlyLimitUse {
  /** 그 등급의 월 한도액(원) */
  limit: number;
  /** 한도에 드는 급여비용 합(원) */
  used: number;
  /** 사용률(%) — 소수 첫째 자리까지 반올림 */
  rate: number;
  /** 사용액이 한도를 넘었는가(넘은 부분은 수급자 전액 부담) */
  over: boolean;
}

/**
 * 월 한도 사용률. rate는 used ÷ limit × 100을 정수로만 계산해(소수 둘째 자리에서 반올림) 부동소수 오차가 없다.
 * 이동서비스비용·목욕 가산은 한도에 들지 않으므로 coveredTotal에 넣지 않는다. 알 수 없는 등급이면 null.
 */
export function monthlyLimitUse(grade: LtcCareGrade, coveredTotal: number): MonthlyLimitUse | null {
  const limit = MONTHLY_LIMIT_2026[grade];
  if (typeof limit !== 'number') return null;
  const used = Number.isFinite(coveredTotal) && coveredTotal > 0 ? Math.round(coveredTotal) : 0;
  // 사용률(%) × 10 = round(used × 1000 / limit) — 정수 몫으로 반올림(0.5는 올림)
  const numerator = used * 2000 + limit;
  const denominator = 2 * limit;
  const tenths = (numerator - (numerator % denominator)) / denominator;
  return { limit, used, rate: tenths / 10, over: used > limit };
}
