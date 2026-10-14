/** 직원 교육·회의 입력 초안 */
import type { LabStaff, StaffTraining, StaffTrainingCategory, StaffTrainingInput, StaffTrainingKind } from '@/lib/lab/labTypes';
import { LEGAL_TRAINING_CATEGORIES, categoriesForKind, isCategoryForKind, trainingCategoryLabel } from '@/lib/lab/trainingRules';
import { orNull } from './recordsFormat';

export type TrainingTextKey = 'topic' | 'content';
export const TRAINING_TEXT_MAX: Record<TrainingTextKey, number> = { topic: 100, content: 3000 };
export const MAX_ATTENDEES = 200;

export interface TrainingDraft {
  kind: StaffTrainingKind;
  date: string;
  category: StaffTrainingCategory;
  fields: Record<TrainingTextKey, string>;
  ai: Partial<Record<TrainingTextKey, true>>;
  instructor: string;
  attendeeIds: number[];
  memo: string;
  aiUsed: boolean;
  aiKept: number;
}

export interface TrainingPreset {
  date: string;
  kind?: StaffTrainingKind;
  category?: StaffTrainingCategory;
  attendeeIds?: number[];
}

export function newDraft(preset: TrainingPreset): TrainingDraft {
  const kind = preset.kind ?? 'TRAINING';
  const category = preset.category && isCategoryForKind(kind, preset.category) ? preset.category : kind === 'TRAINING' ? 'ELDER_ABUSE' : 'STAFF';
  return {
    kind,
    date: preset.date,
    category,
    fields: { topic: '', content: '' },
    ai: {},
    instructor: '',
    attendeeIds: preset.attendeeIds ?? [],
    memo: '',
    aiUsed: false,
    aiKept: 0,
  };
}

export function draftFromTraining(t: StaffTraining): TrainingDraft {
  return {
    kind: t.kind,
    date: t.heldOn.slice(0, 10),
    category: t.category,
    fields: { topic: t.topic, content: t.content ?? '' },
    ai: {},
    instructor: t.instructor ?? '',
    attendeeIds: [...t.attendeeIds],
    memo: '',
    aiUsed: false,
    aiKept: 0,
  };
}

export function snapshotOf(d: TrainingDraft): string {
  return JSON.stringify([d.kind, d.date, d.category, d.fields, d.instructor, [...d.attendeeIds].sort((a, b) => a - b), d.memo]);
}

export function validate(d: TrainingDraft): string | null {
  if (!d.date) return '진행한 날짜를 골라 주세요';
  if (!isCategoryForKind(d.kind, d.category)) return '구분에 맞는 범주를 골라 주세요';
  if (d.fields.topic.trim() === '') return '주제를 적어 주세요';
  if (d.attendeeIds.length === 0) return '참석자를 한 명 이상 골라 주세요';
  if (d.attendeeIds.length > MAX_ATTENDEES) return `참석자는 ${MAX_ATTENDEES}명까지 고를 수 있습니다`;
  return null;
}

export function toInput(d: TrainingDraft, aiAssisted: boolean): StaffTrainingInput {
  return {
    kind: d.kind,
    heldOn: d.date,
    category: d.category,
    topic: d.fields.topic.trim(),
    instructor: orNull(d.instructor),
    attendeeIds: d.attendeeIds,
    content: orNull(d.fields.content),
    aiAssisted,
  };
}

/** 범주 선택 목록 — 교육의 법정 다섯 가지에는 표시를 단다 */
export function categoryOptions(kind: StaffTrainingKind): Array<{ value: string; label: string }> {
  return categoriesForKind(kind).map((c) => ({
    value: c,
    label: kind === 'TRAINING' && (LEGAL_TRAINING_CATEGORIES as readonly string[]).includes(c) ? `${trainingCategoryLabel(c)} · 법정` : trainingCategoryLabel(c),
  }));
}

export const isLegal = (c: string): boolean => (LEGAL_TRAINING_CATEGORIES as readonly string[]).includes(c);

export function staffHint(s: Pick<LabStaff, 'position' | 'role'>): string | null {
  const text = [s.position, s.role].filter((v): v is string => !!v && v.trim() !== '').join(' · ');
  return text === '' ? null : text;
}
