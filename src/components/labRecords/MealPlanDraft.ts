/**
 * 주간 식단표 작성 상태 — 서버의 식단표를 화면 칸으로 옮기고, 저장 본문으로 되돌린다.
 * 칸은 월~토 6일 고정이다. 서버가 6일보다 적게 주어도 빈 날로 채워 표 모양이 흔들리지 않게 한다.
 */
import type { MealDay, MealPlan, MealPlanInput } from '@/lib/lab/labTypes';
import { MEAL_NOTES_LIMIT, MEAL_SLOTS, MEAL_TEXT_LIMIT, emptyDay, emptyWeek, getSlot, hasAnyMenu, withSlot } from '@/lib/lab/mealRules';
import type { MealSlotId } from '@/lib/lab/mealRules';
import { mergeAiSuggestions } from './recordsFormat';

export interface MealDraft {
  days: MealDay[];
  notes: string;
  writer: string;
  /** AI가 채운 칸 — 키는 `${날짜}|${칸}`. 사람이 고치면 빠진다. */
  ai: Record<string, true>;
  aiUsed: boolean;
}

export const aiKey = (date: string, slot: MealSlotId) => `${date}|${slot}`;

/** 서버 식단을 그 주 6일 칸에 맞춘다(날짜가 같은 날을 찾아 넣고, 없으면 빈 날) */
export function daysForWeek(weekStart: string, source: ReadonlyArray<MealDay> | null | undefined): MealDay[] {
  const base = emptyWeek(weekStart);
  const byDate = new Map((source ?? []).map((d) => [String(d.date).slice(0, 10), d]));
  return base.map((blank) => {
    const found = byDate.get(blank.date);
    if (!found) return blank;
    let day = emptyDay(blank.date);
    for (const slot of MEAL_SLOTS) day = withSlot(day, slot.id, getSlot({ ...blank, ...found, lunch: { ...blank.lunch, ...found.lunch } }, slot.id));
    return day;
  });
}

export function draftFromPlan(weekStart: string, plan: MealPlan | null, writer: string): MealDraft {
  return { days: daysForWeek(weekStart, plan?.days), notes: plan?.notes ?? '', writer: plan?.writerName ?? writer, ai: {}, aiUsed: plan?.aiAssisted ?? false };
}

/** 저장 전후를 비교하는 글자 — 작성자·AI 표시는 뺀다 */
export function snapshotOf(draft: MealDraft): string {
  return JSON.stringify([draft.days, draft.notes.trim()]);
}

export function toInput(weekStart: string, draft: MealDraft): MealPlanInput {
  return {
    weekStart,
    days: draft.days,
    notes: draft.notes.trim() === '' ? null : draft.notes.trim().slice(0, MEAL_NOTES_LIMIT),
    writerName: draft.writer.trim() === '' ? null : draft.writer.trim().slice(0, 50),
    aiAssisted: draft.aiUsed,
  };
}

export function validate(draft: MealDraft): string | null {
  if (!hasAnyMenu(draft.days)) return '한 칸도 채우지 않았습니다. 메뉴를 적은 뒤 저장해 주세요';
  return null;
}

/** 한 칸을 고친다. 사람이 손댄 칸은 더 이상 AI 제안이 아니다. */
export function setCell(draft: MealDraft, dayIndex: number, slot: MealSlotId, text: string): MealDraft {
  const day = draft.days[dayIndex];
  if (!day) return draft;
  const days = draft.days.map((d, i) => (i === dayIndex ? withSlot(d, slot, text) : d));
  const ai = { ...draft.ai };
  delete ai[aiKey(day.date, slot)];
  return { ...draft, days, ai };
}

const SLOT_LIMITS = Object.fromEntries(MEAL_SLOTS.map((s) => [s.id, MEAL_TEXT_LIMIT])) as Record<MealSlotId, number>;

export interface WeekMerge {
  days: MealDay[];
  ai: Record<string, true>;
  /** 직접 쓴 칸이라 제안으로 바꾸지 않은 칸 수 */
  kept: number;
  /** 새로 채운 칸 수 */
  filled: number;
}

/** AI 6일 제안을 빈 칸(또는 이전 AI 칸)에만 합친다. 날짜가 아니라 순서로 맞춘다(6일 고정). */
export function mergeAiWeek(current: MealDraft, suggested: ReadonlyArray<MealDay>): WeekMerge {
  let kept = 0;
  let filled = 0;
  const ai = { ...current.ai };
  const days = current.days.map((day, i) => {
    const sug = suggested[i];
    if (!sug) return day;
    const fields = {} as Record<MealSlotId, string>;
    const marks: Partial<Record<MealSlotId, true>> = {};
    const suggestions: Partial<Record<MealSlotId, string>> = {};
    for (const s of MEAL_SLOTS) {
      fields[s.id] = getSlot(day, s.id);
      if (ai[aiKey(day.date, s.id)]) marks[s.id] = true;
      suggestions[s.id] = getSlot(sug, s.id);
    }
    const merged = mergeAiSuggestions(fields, marks, suggestions, SLOT_LIMITS);
    kept += merged.kept;
    let next = day;
    for (const s of MEAL_SLOTS) {
      if (merged.fields[s.id] !== fields[s.id]) {
        next = withSlot(next, s.id, merged.fields[s.id]);
        filled += 1;
      }
      if (merged.ai[s.id]) ai[aiKey(day.date, s.id)] = true;
    }
    return next;
  });
  return { days, ai, kept, filled };
}
