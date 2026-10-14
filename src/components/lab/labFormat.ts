/**
 * 실험실 화면 공용 계산 — 날짜·월·금액 입력·오류 문구.
 * 모든 "오늘"은 labDate의 한국 달력(Asia/Seoul)을 쓴다. 브라우저 시간대에 기대면 해외 PC나 새벽에 월이 어긋난다.
 */
import type { CareRecordFields } from '@/lib/lab/careRecordQuality';
import type { CareRecord } from '@/lib/lab/labTypes';
import { daysInMonth, formatYmd, isValidMonth, parseYmd, seoulDateString } from '@/lib/lab/labDate';

export function todayString(): string {
  return seoulDateString();
}

export function currentMonth(): string {
  return todayString().slice(0, 7);
}

/** 'YYYY-MM'을 delta개월 옮긴다. 잘못된 값이면 이번 달. */
export function shiftMonth(month: string, delta: number): string {
  const base = isValidMonth(month) ? month : currentMonth();
  const year = Number(base.slice(0, 4));
  const m = Number(base.slice(5, 7));
  const index = year * 12 + (m - 1) + delta;
  const ny = Math.floor(index / 12);
  const nm = (index % 12) + 1;
  return `${String(ny).padStart(4, '0')}-${String(nm).padStart(2, '0')}`;
}

/** '2026-10' → '2026년 10월' */
export function monthLabel(month: string): string {
  if (!isValidMonth(month)) return month;
  return `${month.slice(0, 4)}년 ${Number(month.slice(5, 7))}월`;
}

/** 그 달의 첫날·마지막 날 */
export function monthRange(month: string): { start: string; end: string } {
  const year = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  return { start: formatYmd(year, m, 1), end: formatYmd(year, m, daysInMonth(year, m)) };
}

/** 그 달의 모든 날짜('YYYY-MM-DD') */
export function monthDates(month: string): string[] {
  const year = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const last = daysInMonth(year, m);
  return Array.from({ length: last }, (_, i) => formatYmd(year, m, i + 1));
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** 0=일요일. 시간대와 무관하게 날짜 문자열만으로 요일을 구한다. */
export function weekdayIndex(date: string): number {
  const ymd = parseYmd(date);
  if (!ymd) return 0;
  return new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day)).getUTCDay();
}

export function weekdayKo(date: string): string {
  return WEEKDAYS[weekdayIndex(date)];
}

/** '2026-10-14' → '10월 14일 (수)' */
export function dateLabel(date: string): string {
  const ymd = parseYmd(date);
  if (!ymd) return date;
  return `${ymd.month}월 ${ymd.day}일 (${weekdayKo(date)})`;
}

/** '2026-10-14' → '2026.10.14' */
export function dotDate(date: string | null | undefined): string {
  const ymd = parseYmd(date ?? null);
  return ymd ? `${ymd.year}.${String(ymd.month).padStart(2, '0')}.${String(ymd.day).padStart(2, '0')}` : '-';
}

/** 오늘을 포함해 최근 n일의 날짜(오래된 순) */
export function recentDates(n: number, today: string = todayString()): string[] {
  const ymd = parseYmd(today);
  if (!ymd) return [];
  const base = Date.UTC(ymd.year, ymd.month - 1, ymd.day);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(base - i * 86_400_000);
    out.push(formatYmd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()));
  }
  return out;
}

/** 서버·네트워크 오류를 화면 문구로. 서버 메시지가 있으면 그대로, 없으면 기본 문구. */
export function errorText(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim() !== '') return error.message;
  return fallback;
}

/** 숫자만 남겨 정수로 읽는다("1,234원" → 1234). 비었으면 null. 큰 값은 max로 자른다. */
export function parseDigits(text: string, max: number): number | null {
  const digits = text.replace(/[^0-9]/g, '');
  if (digits === '') return null;
  const value = Number(digits.slice(0, 12));
  return Math.min(value, max);
}

export function groupDigits(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('ko-KR') : '';
}

/** 브라우저에 저장된 값 읽기·쓰기 — 비공개 창 등에서 던지므로 항상 감싼다. */
export function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* 저장이 안 되어도 화면은 그대로 동작한다 */
  }
}

export const PROVIDER_KEY = 'carev.lab.provider';

/** 기록자 이름 기본값: 직전에 쓴 이름 → 로그인한 이름 */
export function defaultPersonName(): string {
  return readStored(PROVIDER_KEY) ?? readStored('userName') ?? '';
}

export function companyNameStored(): string {
  return readStored('companyName') ?? readStored('organizationName') ?? '';
}

/** 기록에서 문구 점검에 쓰는 칸만 골라 낸다(메모 원문은 점검하지 않는다). */
export function careFieldsOf(r: CareRecord): CareRecordFields {
  return {
    physical: r.physical,
    cognitive: r.cognitive,
    meal: r.meal,
    toilet: r.toilet,
    bath: r.bath,
    nursing: r.nursing,
    training: r.training,
    specialNote: r.specialNote,
  };
}
