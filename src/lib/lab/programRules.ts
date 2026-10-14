/**
 * 인지기능 프로그램 "주 3회" 점검.
 *
 * 2026 주야간보호 평가는 인지기능 향상 프로그램을 주 3회 이상 운영하고 일지로 증명하게 한다.
 * 한 주는 월요일~일요일(한국 날짜)이다. 같은 프로그램을 두 직원이 각자 입력하거나 한 번 더 저장해 중복이 생겨도
 * "운영한 횟수"가 부풀려지면 안 되므로, 횟수는 (날짜, 제목)이 같은 것을 하나로 묶어 센다.
 * 같은 날 제목이 다른 인지 프로그램이 둘이면 둘로 센다(오전 회상 + 오후 퍼즐).
 */
import type { Program } from './labTypes.ts';
import { formatYmd, parseYmd } from './labDate.ts';

/** 점검에 필요한 칸만. 제목이 없는 입력은 날짜만으로 묶는다. */
export type ProgramLike = Pick<Program, 'programDate' | 'category' | 'participantIds'> & { title?: string | null };

export const COGNITIVE_WEEKLY_TARGET = 3;

export const PROGRAM_CATEGORY_LABEL: Readonly<Record<Program['category'], string>> = {
  COGNITIVE: '인지기능',
  PHYSICAL: '신체·운동',
  LEISURE: '여가·취미',
  SOCIAL: '사회적응',
  OTHER: '기타',
};

export interface CognitiveWeeklyStatus {
  /** 이번 주 인지 프로그램 횟수(날짜·제목 기준, 중복 제외) */
  count: number;
  met: boolean;
  /** 어르신별 참여 횟수 — 참여한 적 있는 어르신만 키가 있다 */
  perElder: Record<number, number>;
  /** 프로그램을 운영한 서로 다른 날 수 */
  days: number;
}

function toUtcMs(ymd: string): number | null {
  const p = parseYmd(ymd);
  return p ? Date.UTC(p.year, p.month - 1, p.day) : null;
}

function fromUtcMs(ms: number): string {
  const d = new Date(ms);
  return formatYmd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** 날짜에 일수를 더한다. 잘못된 날짜면 null. */
export function addDays(ymd: string, days: number): string | null {
  const ms = toUtcMs(ymd);
  return ms === null ? null : fromUtcMs(ms + days * 86_400_000);
}

/** 그 날이 속한 주의 월요일. 잘못된 날짜면 null. */
export function mondayOf(ymd: string): string | null {
  const ms = toUtcMs(ymd);
  if (ms === null) return null;
  const dow = new Date(ms).getUTCDay(); // 일 0 ~ 토 6
  return fromUtcMs(ms - ((dow + 6) % 7) * 86_400_000);
}

function titleKey(title: string | null | undefined): string {
  return typeof title === 'string' ? title.replace(/\s+/g, ' ').trim().toLowerCase() : '';
}

/**
 * weekStart부터 7일(일요일까지) 안의 인지기능(COGNITIVE) 프로그램을 센다.
 * weekStart가 월요일이 아니어도 그 날부터 7일을 본다(호출하는 쪽이 mondayOf로 맞춘다). 날짜 형식이 틀리면 0회·미충족.
 */
export function cognitiveWeeklyStatus(programs: ReadonlyArray<ProgramLike>, weekStart: string): CognitiveWeeklyStatus {
  const start = parseYmd(weekStart) ? weekStart.slice(0, 10) : null;
  const end = start ? addDays(start, 6) : null;
  const empty: CognitiveWeeklyStatus = { count: 0, met: false, perElder: {}, days: 0 };
  if (!start || !end) return empty;

  // (날짜, 제목)별로 묶으며 참여자를 합친다 — 같은 프로그램을 나눠 입력해도 한 번으로 세고, 어르신은 한 번만 센다.
  const sessions = new Map<string, Set<number>>();
  const days = new Set<string>();
  for (const p of programs) {
    if (p?.category !== 'COGNITIVE') continue;
    const parsed = parseYmd(p.programDate);
    if (!parsed) continue;
    const date = formatYmd(parsed.year, parsed.month, parsed.day);
    if (date < start || date > end) continue;
    const key = `${date}|${titleKey(p.title)}`;
    let ids = sessions.get(key);
    if (!ids) {
      ids = new Set<number>();
      sessions.set(key, ids);
    }
    days.add(date);
    for (const id of Array.isArray(p.participantIds) ? p.participantIds : []) if (Number.isInteger(id)) ids.add(id);
  }

  const perElder: Record<number, number> = {};
  for (const ids of sessions.values()) for (const id of ids) perElder[id] = (perElder[id] ?? 0) + 1;
  return { count: sessions.size, met: sessions.size >= COGNITIVE_WEEKLY_TARGET, perElder, days: days.size };
}

export interface WeekStatus extends CognitiveWeeklyStatus {
  weekStart: string;
  weekEnd: string;
}

/**
 * 최근 N주의 주별 충족 현황(오래된 주부터). 기본은 "끝난 주"만 본다 — 이번 주는 아직 진행 중이라 화요일에 보면
 * 어느 기관이나 미충족으로 나온다. 이번 주까지 보려면 includeCurrent. today가 일요일이면 그 주는 끝난 것으로 본다.
 */
export function recentWeeklyStatuses(
  programs: ReadonlyArray<ProgramLike>,
  today: string,
  weeks = 4,
  includeCurrent = false,
): WeekStatus[] {
  const monday = mondayOf(today);
  const count = Math.max(0, Math.floor(weeks));
  if (!monday || count === 0) return [];
  const todayMs = toUtcMs(today) as number;
  const mondayMs = toUtcMs(monday) as number;
  const isSunday = todayMs - mondayMs === 6 * 86_400_000;
  const lastWeekStart = includeCurrent || isSunday ? monday : (addDays(monday, -7) as string);
  const out: WeekStatus[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const weekStart = addDays(lastWeekStart, -7 * i) as string;
    out.push({ weekStart, weekEnd: addDays(weekStart, 6) as string, ...cognitiveWeeklyStatus(programs, weekStart) });
  }
  return out;
}

/** 충족한 주 수와 전체 주 수 */
export function weeksMet(statuses: ReadonlyArray<Pick<WeekStatus, 'met'>>): { met: number; total: number } {
  return { met: statuses.filter((s) => s.met).length, total: statuses.length };
}

/**
 * 그 주에 인지 프로그램 참여가 minimum회 미만인 어르신. 센터가 주 3회를 운영해도
 * 출석이 적은 어르신은 3회를 못 받는다 — "누구를 챙길까"를 보여 주는 용도(평가 기준 자체는 기관 운영 횟수).
 * elderIds는 그 주에 이용한 어르신으로 넘기는 것이 맞다.
 */
export function underParticipated(
  perElder: Readonly<Record<number, number>>,
  elderIds: ReadonlyArray<number>,
  minimum = COGNITIVE_WEEKLY_TARGET,
): number[] {
  return elderIds.filter((id) => (perElder[id] ?? 0) < minimum);
}
