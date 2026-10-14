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
