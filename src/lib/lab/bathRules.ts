/**
 * 목욕 제공 규칙 — 소요시간, 주간 목욕 현황, 목욕 가산(주 1회 3,000원).
 *
 * 근거(research-6.md 5절): 고시 제35조 — 주야간보호가 목욕서비스를 제공하면 수급자당 주 1회에 한해 3,000원을 가산하고 수급자 부담은 없다
 * (월 한도액에 들지 않는다). 몸 씻기는 반드시 요양보호사가 하고 제공일지를 작성·비치한다. 제공일지(세부사항 별지 제23호): 제공일·시작/종료 시간·
 * 소요시간(분)·제공방법(전신입욕/목욕의자/침상)·제공자·특이사항.
 *
 * 주는 월요일부터 일요일이다. 주 경계가 달 경계와 겹치는 주(예: 9/28~10/4)를 어느 달에 청구하는지는 고시에서 확인하지 못했다 — 이 모듈은
 * "그 주의 목욕 날짜가 그 달에 있으면 그 달에 센다"로 계산하고, 달에 걸친 주는 splitWeek로 표시해 화면이 "대조 필요"를 띄우게 한다.
 * 그 결과 같은 주가 두 달에 모두 잡힐 수 있으므로 청구 전에 확인해야 한다.
 */
import type { BathLog, BathMethod } from './labTypes.ts';
import { addDays, isValidYmd, isValidMonth, timeToMinutes } from './labDate.ts';
import { mondayOf } from './careEventRules.ts';

export const BATH_METHODS: ReadonlyArray<{ value: BathMethod; label: string }> = [
  { value: 'FULL_BATH', label: '전신입욕' },
  { value: 'BATH_CHAIR', label: '목욕의자' },
  { value: 'BED', label: '침상' },
];

export function bathMethodLabel(method: string): string {
  return BATH_METHODS.find((m) => m.value === method)?.label ?? method;
}

export function isBathMethod(value: unknown): value is BathMethod {
  return typeof value === 'string' && BATH_METHODS.some((m) => m.value === value);
}

/** 서버와 같은 한도 */
export const MAX_BATH_MINUTES = 180;
export const MAX_BATH_PRE_CHECK = 100;
export const MAX_BATH_TEXT = 500;
/** 수급자당 주 1회 가산액(원) — 고시 제35조 */
export const BATH_BONUS_PER_WEEK = 3000;

/** 시작·종료('HH:MM')로 소요시간(분). 형식 오류·끝이 시작보다 늦지 않음·180분 초과면 null(서버도 400). */
export function bathMinutes(start: string, end: string): number | null {
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  if (s === null || e === null || e <= s) return null;
  const minutes = e - s;
  return minutes > MAX_BATH_MINUTES ? null : minutes;
}

type LogDate = Pick<BathLog, 'elderlyId' | 'bathDate'>;

function dayOf(value: string): string | null {
  return isValidYmd(value) ? value.slice(0, 10) : null;
}

export interface WeeklyBathRow {
  elderlyId: number;
  /** 그 주에 목욕한 서로 다른 날 수 */
  count: number;
  /** 목욕한 날짜(오름차순) */
  dates: string[];
}

/** 월요일부터 일요일까지 한 주의 어르신별 목욕. elderIds 순서대로, 목욕이 없으면 count 0. weekStart가 월요일이 아니면 그 주의 월요일로 본다. */
export function weeklyBath(logs: ReadonlyArray<LogDate>, elderIds: ReadonlyArray<number>, weekStart: string): WeeklyBathRow[] {
  const start = dayOf(weekStart);
  const monday = start === null ? null : mondayOf(start);
  const sunday = monday === null ? null : addDays(monday, 6);
  return elderIds.map((elderlyId) => {
    const dates = new Set<string>();
    if (monday !== null && sunday !== null) {
      for (const log of logs) {
        const day = log.elderlyId === elderlyId ? dayOf(log.bathDate) : null;
        if (day !== null && day >= monday && day <= sunday) dates.add(day);
      }
    }
    const sorted = [...dates].sort();
    return { elderlyId, count: sorted.length, dates: sorted };
  });
}

export interface BathBonusRow {
  elderlyId: number;
  /** 가산을 셀 주의 월요일(오름차순) */
  weeks: string[];
  /** 주 수 × 3,000원 */
  amount: number;
  /** 달 경계에 걸친 주가 있다(그 주가 이웃 달에도 잡힐 수 있어 청구 전에 대조 필요) */
  splitWeek: boolean;
}

/** 그 주의 월요일과 일요일이 서로 다른 달이면 true */
export function weekCrossesMonth(monday: string): boolean {
  const sunday = addDays(monday, 6);
  return sunday !== null && monday.slice(0, 7) !== sunday.slice(0, 7);
}

/**
 * 'YYYY-MM' 달의 목욕 가산. 어르신마다 "목욕한 날이 그 달에 있는" 주를 세고 주 수 × 3,000원. 같은 주에 여러 번 해도 한 번(주 1회 한도).
 * logs에는 그 달 앞뒤로 걸친 주의 기록이 섞여 있어도 되지만, 달 밖 날짜의 기록은 주를 정하는 데 쓰지 않는다.
 * 어르신 번호 오름차순, 목욕이 없는 어르신은 넣지 않는다.
 */
export function bathBonus(logs: ReadonlyArray<LogDate>, month: string): BathBonusRow[] {
  if (!isValidMonth(month)) return [];
  const byElder = new Map<number, Set<string>>();
  for (const log of logs) {
    const day = dayOf(log.bathDate);
    if (day === null || day.slice(0, 7) !== month) continue;
    const weeks = byElder.get(log.elderlyId) ?? new Set<string>();
    weeks.add(mondayOf(day));
    byElder.set(log.elderlyId, weeks);
  }
  return [...byElder.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([elderlyId, set]) => {
      const weeks = [...set].sort();
      return { elderlyId, weeks, amount: weeks.length * BATH_BONUS_PER_WEEK, splitWeek: weeks.some(weekCrossesMonth) };
    });
}

/** 가산 합계(원) */
export function bathBonusTotal(rows: ReadonlyArray<Pick<BathBonusRow, 'amount'>>): number {
  return rows.reduce((sum, r) => sum + r.amount, 0);
}
