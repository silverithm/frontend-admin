/** 프로그램 계획 화면의 입력 초안(연간계획·계획표 칸·의견수렴)과 점검. 화면 코드는 이 파일의 값만 만진다. */
import type { FeedbackMethod, PlanCategory, ProgramFeedback, ProgramFeedbackInput, ProgramPlan, ProgramPlanInput, ScheduleCategory, ScheduleItem } from '@/lib/lab/labTypes';
import {
  MAX_PLAN_CONTENT,
  MAX_PLAN_FREQUENCY,
  MAX_PLAN_GOAL,
  MAX_SCHEDULE_INSTRUCTOR,
  MAX_SCHEDULE_ITEMS,
  MAX_SCHEDULE_TITLE,
  halfOfDate,
} from '@/lib/lab/programPlanRules';
import { TIME_PATTERN, orNull } from './recordsFormat';

export const MAX_PLAN_TARGET = 100;
export const MAX_PLAN_BUDGET = 1_000_000_000;
export const MAX_WRITER = 50;
export const MAX_FEEDBACK_TEXT = 2000;
export const MAX_FEEDBACK_PEOPLE = 500;
export const MAX_SCHEDULE_NOTES = 500;

/** 분야별 기본 횟수 문구 — 평가 기준(신체·인지 주 3회, 사회적응 월 1회)에 맞춘 출발점 */
export const DEFAULT_FREQUENCY: Readonly<Record<PlanCategory, string>> = {
  PHYSICAL: '주 3회',
  COGNITIVE: '주 3회',
  SOCIAL: '월 1회',
};

// ---------- 연간계획 ----------

export interface PlanDraft {
  category: PlanCategory;
  goal: string;
  content: string;
  frequency: string;
  target: string;
  budget: number | null;
  writtenOn: string;
  writerName: string;
}

export function newPlanDraft(category: PlanCategory, today: string, writer: string): PlanDraft {
  return { category, goal: '', content: '', frequency: DEFAULT_FREQUENCY[category], target: '', budget: null, writtenOn: today, writerName: writer };
}

export function planDraftOf(plan: ProgramPlan): PlanDraft {
  return {
    category: plan.category,
    goal: plan.goal,
    content: plan.content,
    frequency: plan.frequency,
    target: plan.target ?? '',
    budget: plan.budget,
    writtenOn: plan.writtenOn.slice(0, 10),
    writerName: plan.writerName,
  };
}

export function planSnapshot(d: PlanDraft): string {
  return JSON.stringify(d);
}

export function validatePlan(d: PlanDraft): string | null {
  if (d.goal.trim() === '') return '목표를 적어 주세요';
  if (d.content.trim() === '') return '세부 프로그램·방법을 적어 주세요';
  if (d.frequency.trim() === '') return '실시 횟수를 적어 주세요 (예: 주 3회)';
  if (d.writtenOn === '') return '작성일을 골라 주세요';
  if (d.writerName.trim() === '') return '작성자를 적어 주세요';
  if (d.budget !== null && (d.budget < 0 || d.budget > MAX_PLAN_BUDGET)) return '예산은 0원에서 10억 원 사이로 적어 주세요';
  return null;
}

export function planInputOf(d: PlanDraft, year: number, aiAssisted: boolean): ProgramPlanInput {
  return {
    planYear: year,
    category: d.category,
    goal: d.goal.trim(),
    content: d.content.trim(),
    frequency: d.frequency.trim(),
    target: orNull(d.target),
    budget: d.budget,
    writtenOn: d.writtenOn,
    writerName: d.writerName.trim(),
    aiAssisted,
  };
}

export const PLAN_LIMITS = { goal: MAX_PLAN_GOAL, content: MAX_PLAN_CONTENT, frequency: MAX_PLAN_FREQUENCY, target: MAX_PLAN_TARGET } as const;

// ---------- 월간 계획표 칸 ----------

export interface ItemDraft {
  date: string;
  time: string;
  category: ScheduleCategory;
  title: string;
  instructor: string;
}

export function newItemDraft(date: string): ItemDraft {
  return { date, time: '', category: 'COGNITIVE', title: '', instructor: '' };
}

export function itemDraftOf(item: ScheduleItem): ItemDraft {
  return { date: item.date.slice(0, 10), time: item.startTime ?? '', category: item.category, title: item.title, instructor: item.instructor ?? '' };
}

export function validateItem(d: ItemDraft, month: string, count: number, isNew: boolean): string | null {
  if (d.title.trim() === '') return '프로그램 제목을 적어 주세요';
  if (!d.date.startsWith(`${month}-`)) return '이 달 안의 날짜를 골라 주세요';
  if (d.time.trim() !== '' && !TIME_PATTERN.test(d.time)) return '시각은 14:30처럼 24시간제로 적어 주세요';
  if (isNew && count >= MAX_SCHEDULE_ITEMS) return `한 달 계획표에는 ${MAX_SCHEDULE_ITEMS}개까지 넣을 수 있습니다`;
  return null;
}

export function itemOf(d: ItemDraft): ScheduleItem {
  return { date: d.date, startTime: d.time.trim() === '' ? null : d.time, category: d.category, title: d.title.trim().slice(0, MAX_SCHEDULE_TITLE), instructor: orNull(d.instructor.slice(0, MAX_SCHEDULE_INSTRUCTOR)) };
}

/** 날짜 → 시각(없는 칸은 그날의 끝) → 제목 순. 서버도 날짜·시각 순으로 저장한다. */
export function sortItems(items: ReadonlyArray<ScheduleItem>): ScheduleItem[] {
  return [...items].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    const at = a.startTime ?? '99:99';
    const bt = b.startTime ?? '99:99';
    if (at !== bt) return at < bt ? -1 : 1;
    return a.title.localeCompare(b.title, 'ko');
  });
}

export function itemKey(i: ScheduleItem): string {
  return `${i.date}|${i.startTime ?? ''}|${i.category}|${i.title.trim()}`;
}

/** 이미 있는 칸과 (날짜·제목)이 같은 것은 빼고 더한다. 더한 개수와 건너뛴 개수를 함께 돌려준다. */
export function mergeItems(current: ReadonlyArray<ScheduleItem>, extra: ReadonlyArray<ScheduleItem>): { items: ScheduleItem[]; added: number; skipped: number } {
  const seen = new Set(current.map((i) => `${i.date}|${i.title.trim()}`));
  const items = [...current];
  let skipped = 0;
  for (const it of extra) {
    const key = `${it.date}|${it.title.trim()}`;
    if (seen.has(key) || items.length >= MAX_SCHEDULE_ITEMS) {
      skipped += 1;
      continue;
    }
    seen.add(key);
    items.push(it);
  }
  return { items: sortItems(items), added: items.length - current.length, skipped };
}

// ---------- 의견수렴 ----------

export interface FeedbackDraft {
  collectedOn: string;
  method: FeedbackMethod;
  participants: number | null;
  summary: string;
  reflection: string;
  reflectedOn: string;
  writerName: string;
}

export function newFeedbackDraft(today: string, writer: string): FeedbackDraft {
  return { collectedOn: today, method: 'SURVEY', participants: null, summary: '', reflection: '', reflectedOn: '', writerName: writer };
}

export function feedbackDraftOf(f: ProgramFeedback): FeedbackDraft {
  return {
    collectedOn: f.collectedOn.slice(0, 10),
    method: f.method,
    participants: f.participants,
    summary: f.summary,
    reflection: f.reflection ?? '',
    reflectedOn: f.reflectedOn ? f.reflectedOn.slice(0, 10) : '',
    writerName: f.writerName,
  };
}

export function feedbackSnapshot(d: FeedbackDraft): string {
  return JSON.stringify(d);
}

export function validateFeedback(d: FeedbackDraft, year: number): string | null {
  if (d.collectedOn === '') return '의견을 모은 날을 골라 주세요';
  if (!d.collectedOn.startsWith(`${year}-`)) return `${year}년 안의 날짜를 골라 주세요`;
  if (d.participants === null) return '참여한 인원을 적어 주세요 (모르면 0)';
  if (d.participants > MAX_FEEDBACK_PEOPLE) return `참여 인원은 ${MAX_FEEDBACK_PEOPLE}명까지 적을 수 있습니다`;
  if (d.summary.trim() === '') return '의견 요약을 적어 주세요';
  const hasText = d.reflection.trim() !== '';
  const hasDate = d.reflectedOn !== '';
  if (hasText !== hasDate) return '반영 내용과 반영일은 함께 적거나 함께 비워 주세요';
  if (hasDate && d.reflectedOn < d.collectedOn) return '반영일은 의견을 모은 날과 같거나 그 뒤여야 합니다';
  if (d.writerName.trim() === '') return '작성자를 적어 주세요';
  return null;
}

export function feedbackInputOf(d: FeedbackDraft, aiAssisted: boolean): ProgramFeedbackInput {
  return {
    half: halfOfDate(d.collectedOn) ?? '',
    collectedOn: d.collectedOn,
    method: d.method,
    participants: d.participants ?? 0,
    summary: d.summary.trim(),
    reflection: orNull(d.reflection),
    reflectedOn: d.reflectedOn === '' ? null : d.reflectedOn,
    writerName: d.writerName.trim(),
    aiAssisted,
  };
}

// ---------- 달 옮기기·복사 ----------

function dayNumber(ymd: string): number {
  return Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10))) / 86_400_000;
}

/** 'YYYY-MM-DD'가 그 달 첫날의 요일 칸(월요일 0)에서 몇 번째 날인지 */
function mondayIndexOf(ymd: string): number {
  return (new Date(Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)))).getUTCDay() + 6) % 7;
}

/**
 * 지난달 칸을 이 달로 옮긴다. 두 달의 첫 주 월요일을 맞춰 같은 주·같은 요일로 옮기므로 "첫째 주 월요일 프로그램"이 이 달 첫째 주 월요일로 간다.
 * 이 달 밖으로 나가는 날짜는 버린다.
 */
export function shiftItemsToMonth(items: ReadonlyArray<ScheduleItem>, fromMonth: string, toMonth: string): { items: ScheduleItem[]; dropped: number } {
  const fromFirst = `${fromMonth}-01`;
  const toFirst = `${toMonth}-01`;
  const fromMonday = dayNumber(fromFirst) - mondayIndexOf(fromFirst);
  const toMonday = dayNumber(toFirst) - mondayIndexOf(toFirst);
  const offset = toMonday - fromMonday;
  const out: ScheduleItem[] = [];
  let dropped = 0;
  for (const it of items) {
    const moved = new Date((dayNumber(it.date.slice(0, 10)) + offset) * 86_400_000);
    const date = `${moved.getUTCFullYear()}-${String(moved.getUTCMonth() + 1).padStart(2, '0')}-${String(moved.getUTCDate()).padStart(2, '0')}`;
    if (!date.startsWith(`${toMonth}-`)) {
      dropped += 1;
      continue;
    }
    out.push({ ...it, date });
  }
  return { items: sortItems(out), dropped };
}

export function previousMonthOf(month: string): string {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  return m === 1 ? `${String(y - 1).padStart(4, '0')}-12` : `${String(y).padStart(4, '0')}-${String(m - 1).padStart(2, '0')}`;
}
