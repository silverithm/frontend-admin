/**
 * 프로그램 연간계획·월간 계획표·의견수렴 규칙.
 *
 * 근거(research-7.md 1절, 2026 주야간보호 평가 24 신체기능·25 인지기능·26 사회적응)
 *  - 기준① 연간계획 수립(작성일자는 그 해 안이어야 하나 직전 해 12월에 다음 해 계획을 쓰는 것은 예외로 인정)
 *  - 기준② 실시: 신체·인지 주 3회 이상, 사회적응 월 1회 이상(실내·실외 모두 가능)
 *  - 기준③ 수급자(보호자) 의견을 반기별 1회 이상 수렴하고 그 내용을 연 1회 이상 프로그램에 반영
 *  - 월간 프로그램 계획표는 프로그램 지표가 아니라 17 소통노력 기준③(월 1회 보호자 제공)의 증빙이다. 두 지표의 증빙은 따로 둔다.
 *
 * 대조 필요: 사회적응은 SOCIAL만 세고 LEISURE(여가·취미)는 세지 않는다(실내·실외 프로그램 중 어떤 일지 분류를 인정하는지 매뉴얼 원문 대조).
 * 한 주는 월요일~일요일, 날짜는 한국 달력이다. 같은 프로그램을 두 번 입력해도 횟수가 부풀지 않게 (날짜, 제목)이 같은 것은 하나로 센다.
 */
import type { PlanCategory, ProgramFeedback, ProgramPlan, ProgramCategory, ScheduleCategory, ScheduleItem } from './labTypes.ts';
import { addDays, daysInMonth, formatYmd, isValidMonth, parseYmd } from './labDate.ts';
import { mondayOf, weeksOverlapping } from './careEventRules.ts';

export const PLAN_CATEGORIES: ReadonlyArray<{ value: PlanCategory; label: string }> = [
  { value: 'PHYSICAL', label: '신체기능' },
  { value: 'COGNITIVE', label: '인지기능' },
  { value: 'SOCIAL', label: '사회적응' },
];

/** 평가가 요구하는 최소 실시 횟수 문구 */
export const REQUIRED_FREQUENCY: Readonly<Record<PlanCategory, string>> = {
  PHYSICAL: '주 3회 이상',
  COGNITIVE: '주 3회 이상',
  SOCIAL: '월 1회 이상',
};

/** 신체·인지는 한 주에 이만큼 이상 실시해야 한다 */
export const WEEKLY_TARGET = 3;

export const MAX_PLAN_GOAL = 500;
export const MAX_PLAN_CONTENT = 3000;
export const MAX_PLAN_FREQUENCY = 40;
export const MAX_SCHEDULE_ITEMS = 200;
export const MAX_SCHEDULE_TITLE = 40;
export const MAX_SCHEDULE_INSTRUCTOR = 30;

export const SCHEDULE_CATEGORIES: ReadonlyArray<{ value: ScheduleCategory; label: string }> = [
  { value: 'COGNITIVE', label: '인지기능' },
  { value: 'PHYSICAL', label: '신체기능' },
  { value: 'LEISURE', label: '여가·취미' },
  { value: 'SOCIAL', label: '사회적응' },
  { value: 'OTHER', label: '기타' },
];

export const SHARED_METHODS: ReadonlyArray<{ value: 'PRINT' | 'SMS' | 'KAKAO' | 'BOARD' | 'OTHER'; label: string }> = [
  { value: 'PRINT', label: '인쇄물 전달' },
  { value: 'SMS', label: '문자' },
  { value: 'KAKAO', label: '카카오톡' },
  { value: 'BOARD', label: '게시판' },
  { value: 'OTHER', label: '기타' },
];

export const FEEDBACK_METHODS: ReadonlyArray<{ value: 'SURVEY' | 'INTERVIEW' | 'MEETING' | 'OTHER'; label: string }> = [
  { value: 'SURVEY', label: '설문' },
  { value: 'INTERVIEW', label: '면담' },
  { value: 'MEETING', label: '회의' },
  { value: 'OTHER', label: '기타' },
];

export function planCategoryLabel(category: string): string {
  return PLAN_CATEGORIES.find((c) => c.value === category)?.label ?? category;
}

export function isPlanCategory(value: unknown): value is PlanCategory {
  return PLAN_CATEGORIES.some((c) => c.value === value);
}

export function isScheduleCategory(value: unknown): value is ScheduleCategory {
  return SCHEDULE_CATEGORIES.some((c) => c.value === value);
}

// ---------- 연간계획 ----------

export type AnnualPlanLike = Pick<ProgramPlan, 'planYear' | 'category' | 'writtenOn'>;

export interface AnnualPlanStatus<T extends AnnualPlanLike = AnnualPlanLike> {
  category: PlanCategory;
  plan: T | null;
  ok: boolean;
  issue: null | 'MISSING' | 'WRITTEN_OUTSIDE_YEAR';
}

/** 작성일이 그 해(1/1~12/31)이거나 직전 해 12월이면 true — 평가 예외 */
export function writtenInPlanWindow(writtenOn: string, year: number): boolean {
  const p = parseYmd(writtenOn);
  if (!p) return false;
  return p.year === year || (p.year === year - 1 && p.month === 12);
}

/** 신체·인지·사회적응 세 분야의 연간계획 상태(분야 순서 고정). 연간계획이 없거나 작성일이 인정 범위 밖이면 ok가 false. */
export function annualPlanStatus<T extends AnnualPlanLike>(plans: ReadonlyArray<T>, year: number): Array<AnnualPlanStatus<T>> {
  return PLAN_CATEGORIES.map(({ value: category }) => {
    const plan = plans.find((p) => p.planYear === year && p.category === category) ?? null;
    if (!plan) return { category, plan: null, ok: false, issue: 'MISSING' as const };
    const ok = writtenInPlanWindow(plan.writtenOn, year);
    return { category, plan, ok, issue: ok ? null : ('WRITTEN_OUTSIDE_YEAR' as const) };
  });
}

// ---------- 실시 기록(프로그램 일지) ----------

export interface ProgramRecordLike {
  programDate: string;
  category: ProgramCategory;
  title?: string | null;
}

function titleKey(title: string | null | undefined): string {
  return typeof title === 'string' ? title.replace(/\s+/g, ' ').trim().toLowerCase() : '';
}

/** 날짜 범위 안의 category 프로그램을 (날짜, 제목) 기준 중복 없이 센다 */
function countSessions(programs: ReadonlyArray<ProgramRecordLike>, category: ProgramCategory, inRange: (ymd: string) => boolean): number {
  const seen = new Set<string>();
  for (const p of programs) {
    if (p?.category !== category) continue;
    const parsed = parseYmd(p.programDate);
    if (!parsed) continue;
    const date = formatYmd(parsed.year, parsed.month, parsed.day);
    if (!inRange(date)) continue;
    seen.add(`${date}|${titleKey(p.title)}`);
  }
  return seen.size;
}

export interface CountStatus {
  count: number;
  met: boolean;
}

/** 그 주(월~일; weekStart가 월요일이 아니면 그 주의 월요일로 본다) category 프로그램 수. 3회 이상이면 충족. 날짜가 틀리면 0회·미충족. */
export function weeklyCategoryStatus(programs: ReadonlyArray<ProgramRecordLike>, weekStart: string, category: ProgramCategory | PlanCategory): CountStatus {
  if (!parseYmd(weekStart)) return { count: 0, met: false };
  const monday = mondayOf(weekStart.slice(0, 10));
  const sunday = addDays(monday, 6) as string;
  const count = countSessions(programs, category, (d) => d >= monday && d <= sunday);
  return { count, met: count >= WEEKLY_TARGET };
}

/** 그 달 사회적응(SOCIAL) 프로그램 수. 1회 이상이면 충족 — 여가·취미(LEISURE)는 세지 않는다(대조 필요). */
export function socialMonthlyStatus(programs: ReadonlyArray<ProgramRecordLike>, month: string): CountStatus {
  if (!isValidMonth(month)) return { count: 0, met: false };
  const count = countSessions(programs, 'SOCIAL', (d) => d.startsWith(`${month}-`));
  return { count, met: count >= 1 };
}

// ---------- 월간 계획표 ----------

export interface ScheduleWeek {
  weekStart: string;
  physical: number;
  cognitive: number;
  social: number;
  /** 여가·취미와 기타 */
  other: number;
}

type ItemLike = Pick<ScheduleItem, 'date' | 'category'> & Partial<Pick<ScheduleItem, 'startTime' | 'title'>>;

/** 완전히 같은 칸(날짜·시각·분류·제목)이 두 번 들어간 것은 하나로 본다 */
function uniqueItems<T extends ItemLike>(items: ReadonlyArray<T>, month: string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of items) {
    const p = parseYmd(it?.date);
    if (!p) continue;
    const date = formatYmd(p.year, p.month, p.day);
    if (!date.startsWith(`${month}-`)) continue;
    const key = `${date}|${it.startTime ?? ''}|${it.category}|${titleKey(it.title)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

/** 그 달과 겹치는 월~일 주마다 분류별 횟수. 그 달 날짜만 센다(달 밖 날짜·형식 오류는 무시). */
export function scheduleWeekly(items: ReadonlyArray<ItemLike>, month: string): ScheduleWeek[] {
  if (!isValidMonth(month)) return [];
  const inMonth = uniqueItems(items, month);
  return weeksOverlapping(month).map((weekStart) => {
    const end = addDays(weekStart, 6) as string;
    const week: ScheduleWeek = { weekStart, physical: 0, cognitive: 0, social: 0, other: 0 };
    for (const it of inMonth) {
      const date = it.date.slice(0, 10);
      if (date < weekStart || date > end) continue;
      if (it.category === 'PHYSICAL') week.physical += 1;
      else if (it.category === 'COGNITIVE') week.cognitive += 1;
      else if (it.category === 'SOCIAL') week.social += 1;
      else week.other += 1;
    }
    return week;
  });
}

/** 그 달의 월~금 날짜 — 운영일을 따로 모를 때의 기본값 */
export function defaultOperatingDays(month: string): string[] {
  if (!isValidMonth(month)) return [];
  const year = Number(month.slice(0, 4));
  const mon = Number(month.slice(5, 7));
  const out: string[] = [];
  for (let d = 1; d <= daysInMonth(year, mon); d += 1) {
    const ymd = formatYmd(year, mon, d);
    const dow = new Date(Date.UTC(year, mon - 1, d)).getUTCDay();
    if (dow >= 1 && dow <= 5) out.push(ymd);
  }
  return out;
}

function shortDate(ymd: string): string {
  return `${Number(ymd.slice(5, 7))}월 ${Number(ymd.slice(8, 10))}일`;
}

/**
 * 계획표 점검 문장. 주마다 인지 3회 미만·신체 3회 미만(그 주 그 달 운영일이 3일 미만이면 그 주는 건너뜀), 그 달 사회적응 0회,
 * 같은 날 같은 시각에 두 개 이상 겹침. 운영일을 모르면 그 달 월~금으로 본다(operatingDays는 그 달 밖 날짜가 섞여 있어도 된다).
 */
export function scheduleIssues(items: ReadonlyArray<ItemLike>, month: string, operatingDays?: ReadonlyArray<string>): string[] {
  if (!isValidMonth(month)) return [];
  const days = (operatingDays ?? defaultOperatingDays(month)).map((d) => d.slice(0, 10)).filter((d) => d.startsWith(`${month}-`) && parseYmd(d) !== null);
  const issues: string[] = [];

  for (const week of scheduleWeekly(items, month)) {
    const end = addDays(week.weekStart, 6) as string;
    const operating = days.filter((d) => d >= week.weekStart && d <= end).length;
    if (operating < WEEKLY_TARGET) continue;
    const label = `${shortDate(week.weekStart)} 시작 주`;
    if (week.cognitive < WEEKLY_TARGET) issues.push(`${label}: 인지기능 프로그램이 ${week.cognitive}회입니다 (주 ${WEEKLY_TARGET}회 이상 필요, 이 달 운영일 ${operating}일)`);
    if (week.physical < WEEKLY_TARGET) issues.push(`${label}: 신체기능 프로그램이 ${week.physical}회입니다 (주 ${WEEKLY_TARGET}회 이상 필요, 이 달 운영일 ${operating}일)`);
  }

  const unique = uniqueItems(items, month);
  if (days.length > 0 && !unique.some((i) => i.category === 'SOCIAL')) issues.push('이 달에 사회적응 프로그램이 없습니다 (월 1회 이상 필요)');

  const bySlot = new Map<string, number>();
  for (const it of unique) {
    if (!it.startTime) continue;
    const key = `${it.date.slice(0, 10)}|${it.startTime}`;
    bySlot.set(key, (bySlot.get(key) ?? 0) + 1);
  }
  for (const [key, n] of [...bySlot.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (n < 2) continue;
    const [date, time] = key.split('|');
    issues.push(`${shortDate(date)} ${time}에 프로그램이 ${n}개 겹칩니다`);
  }
  return issues;
}

// ---------- 의견수렴 ----------

export function halfLabel(half: string): string {
  const m = /^(\d{4})-H([12])$/.exec(half);
  return m ? `${m[1]}년 ${m[2] === '1' ? '상반기' : '하반기'}` : half;
}

/** 날짜가 속한 반기 'YYYY-H1'(1~6월)·'YYYY-H2'(7~12월). 날짜가 틀리면 null. */
export function halfOfDate(ymd: string): string | null {
  const p = parseYmd(ymd);
  return p ? `${p.year}-H${p.month <= 6 ? 1 : 2}` : null;
}

export interface FeedbackStatus {
  h1: boolean;
  h2: boolean;
  /** 그 해 반기의 의견수렴 중 반영일이 있는 것이 하나 이상 */
  reflected: boolean;
}

export function feedbackStatus(feedbacks: ReadonlyArray<Pick<ProgramFeedback, 'half' | 'reflectedOn'>>, year: number): FeedbackStatus {
  const y = String(year).padStart(4, '0');
  let h1 = false;
  let h2 = false;
  let reflected = false;
  for (const f of feedbacks) {
    if (f.half === `${y}-H1`) h1 = true;
    else if (f.half === `${y}-H2`) h2 = true;
    else continue;
    if (f.reflectedOn) reflected = true;
  }
  return { h1, h2, reflected };
}
