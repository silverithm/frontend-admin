/**
 * 실험실 날짜 도우미 — 모든 "오늘"은 한국 달력(Asia/Seoul) 기준이다.
 *
 * 왜 따로 두나: 서버리스(UTC)나 해외 PC에서 `new Date().getMonth()`를 쓰면 6/30 밤·7/1 새벽에
 * 반기 경계가 하루 어긋난다. 반기 점검은 "7월 1일부터 하반기"가 법적 경계라 이 하루가 곧 오판정이다.
 */

export interface Ymd {
  year: number;
  month: number;
  day: number;
}

/** 시각을 한국 달력의 'YYYY-MM-DD'로 바꾼다. */
export function seoulDateString(date: Date = new Date()): string {
  // en-CA 로케일이 ISO 모양(YYYY-MM-DD)으로 내려준다.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 'YYYY-MM-DD'(뒤에 시각이 붙어 있어도 앞 10자만 본다)를 검사해 쪼갠다. 실제 존재하는 날짜만 통과. */
export function parseYmd(value: string | null | undefined): Ymd | null {
  if (typeof value !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/.exec(value.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

export function formatYmd(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** 'YYYY-MM' 형식과 월 범위 검사. */
export function isValidMonth(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const m = /^(\d{4})-(\d{2})$/.exec(value);
  return !!m && Number(m[2]) >= 1 && Number(m[2]) <= 12;
}

const DAY_MS = 86_400_000;

function utcDayOf(ymd: string): number | null {
  const p = parseYmd(ymd);
  return p ? Date.UTC(p.year, p.month - 1, p.day) : null;
}

/** 'YYYY-MM-DD'에 일수를 더한다(음수 가능, 윤년·월말 처리). 날짜가 올바르지 않으면 null. */
export function addDays(ymd: string, days: number): string | null {
  const t = utcDayOf(ymd);
  if (t === null || !Number.isInteger(days)) return null;
  const d = new Date(t + days * DAY_MS);
  return formatYmd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** to − from(일). 둘 중 하나라도 올바른 날짜가 아니면 null. */
export function daysBetween(from: string, to: string): number | null {
  const a = utcDayOf(from);
  const b = utcDayOf(to);
  return a === null || b === null ? null : Math.round((b - a) / DAY_MS);
}

/** 올바른 'YYYY-MM-DD'만 true(뒤에 시각이 붙은 값도 앞 10자만 본다). */
export function isValidYmd(value: unknown): value is string {
  return typeof value === 'string' && parseYmd(value) !== null;
}

/** 'HH:MM'(00:00~23:59)을 분으로. 형식이 틀리면 null. */
export function timeToMinutes(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const m = /^(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h <= 23 && min <= 59 ? h * 60 + min : null;
}

/** 달 단위 이동: (year, month 1~12)에 delta개월을 더한 (year, month). 해가 넘어가도 맞는다. */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + (month - 1) + delta;
  return { year: Math.floor(total / 12), month: (((total % 12) + 12) % 12) + 1 };
}

/** (year, month)의 말일 'YYYY-MM-DD'. month가 1~12 밖이어도 달력대로 넘겨 계산한다. */
export function monthEndYmd(year: number, month: number): string {
  const m = shiftMonth(year, month, 0);
  return formatYmd(m.year, m.month, daysInMonth(m.year, m.month));
}

/** 'YYYY-MM-DD'에 해를 더한다. 2/29가 없는 해는 2/28로 둔다(윤일 기념일은 앞당긴다). 날짜가 올바르지 않으면 null. */
export function addYears(ymd: string, years: number): string | null {
  const p = parseYmd(ymd);
  if (!p || !Number.isInteger(years)) return null;
  const year = p.year + years;
  return formatYmd(year, p.month, Math.min(p.day, daysInMonth(year, p.month)));
}
