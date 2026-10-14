/** 기능회복훈련 입력 초안 — 훈련 항목 글자 읽기, 한 번에 기록·한 건 고치기 입력, 검사 */
import type { RehabKind, RehabSession, RehabSessionInput } from '@/lib/lab/labTypes';
import { MAX_REHAB_ITEMS, MAX_REHAB_ITEM_LENGTH, MAX_REHAB_MINUTES } from '@/lib/lab/rehabRules';
import { todayString } from '@/components/lab/labFormat';
import { orNull } from './recordsFormat';

export const REHAB_TEXT_MAX = { content: 2000, reaction: 1000 } as const;

/** "평행봉 걷기, 계단 오르기" → ['평행봉 걷기', '계단 오르기'] (쉼표·줄바꿈 구분, 빈 항목·중복 제거) */
export function parseItems(text: string): { items: string[]; error: string | null } {
  const items: string[] = [];
  for (const raw of text.split(/[,，、\n]/)) {
    const item = raw.trim();
    if (item !== '' && !items.includes(item)) items.push(item);
  }
  if (items.length > MAX_REHAB_ITEMS) return { items, error: `훈련 항목은 ${MAX_REHAB_ITEMS}개까지 적을 수 있습니다` };
  if (items.some((i) => Array.from(i).length > MAX_REHAB_ITEM_LENGTH)) return { items, error: `훈련 항목 하나는 ${MAX_REHAB_ITEM_LENGTH}자까지 적을 수 있습니다` };
  return { items, error: null };
}

export const itemsText = (items: ReadonlyArray<string>): string => items.join(', ');

export interface RehabFormDraft {
  date: string;
  kind: RehabKind;
  kindTouched: boolean;
  minutes: number | null;
  itemsText: string;
  content: string;
  contentAi: boolean;
  therapist: string;
  memo: string;
  aiUsed: boolean;
  /** AI가 제안한 반응 — 어르신마다 달라 한 번에 기록에는 넣지 않고, 저장한 뒤 어르신별로 고르게 한다 */
  aiReaction: string;
}

export function newFormDraft(date: string, therapist: string): RehabFormDraft {
  return { date, kind: 'PHYSICAL_FUNCTION', kindTouched: false, minutes: null, itemsText: '', content: '', contentAi: false, therapist, memo: '', aiUsed: false, aiReaction: '' };
}

export function validateForm(d: RehabFormDraft): string | null {
  if (d.date === '') return '날짜를 골라 주세요';
  if (d.date > todayString()) return '오늘 이후 날짜는 기록할 수 없습니다';
  if (d.minutes === null || d.minutes < 1 || d.minutes > MAX_REHAB_MINUTES) return `훈련 시간(분)을 1~${MAX_REHAB_MINUTES} 사이로 적어 주세요`;
  const parsed = parseItems(d.itemsText);
  if (parsed.error) return parsed.error;
  if (d.therapist.trim() === '') return '담당자 이름을 적어 주세요';
  return null;
}

/** 한 건 고치기 입력(반응 포함) */
export interface RehabSessionDraft {
  date: string;
  kind: RehabKind;
  minutes: number | null;
  itemsText: string;
  content: string;
  reaction: string;
  therapist: string;
}

export function draftFromSession(s: RehabSession): RehabSessionDraft {
  return { date: s.sessionDate.slice(0, 10), kind: s.kind, minutes: s.minutes, itemsText: itemsText(s.items ?? []), content: s.content ?? '', reaction: s.reaction ?? '', therapist: s.therapistName ?? '' };
}

export function validateSession(d: RehabSessionDraft): string | null {
  return validateForm({ ...newFormDraft(d.date, d.therapist), minutes: d.minutes, itemsText: d.itemsText });
}

export function sessionInput(elderlyId: number, d: RehabSessionDraft, aiAssisted: boolean): RehabSessionInput {
  return {
    elderlyId,
    sessionDate: d.date,
    kind: d.kind,
    minutes: d.minutes as number,
    items: parseItems(d.itemsText).items,
    content: orNull(d.content),
    reaction: orNull(d.reaction),
    therapistName: d.therapist.trim(),
    aiAssisted,
  };
}

/** 저장된 세션에서 반응만 바꾼 입력 */
export function inputWithReaction(s: RehabSession, reaction: string): RehabSessionInput {
  return {
    elderlyId: s.elderlyId,
    sessionDate: s.sessionDate.slice(0, 10),
    kind: s.kind,
    minutes: s.minutes,
    items: s.items ?? [],
    content: s.content,
    reaction: orNull(reaction),
    therapistName: s.therapistName,
    aiAssisted: s.aiAssisted,
  };
}
