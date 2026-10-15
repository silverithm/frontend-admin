/** 프로그램 일지 입력 초안 */
import type { CognitiveProviderKind, Program, ProgramCategory, ProgramInput } from '@/lib/lab/labTypes';
import { PROGRAM_CATEGORY_LABEL } from '@/lib/lab/programRules';
import { TIME_PATTERN, orNull } from './recordsFormat';

export const PROGRAM_CATEGORIES: readonly ProgramCategory[] = ['COGNITIVE', 'PHYSICAL', 'LEISURE', 'SOCIAL', 'OTHER'];
export const categoryLabel = (c: ProgramCategory): string => PROGRAM_CATEGORY_LABEL[c];

export type ProgramTextKey = 'title' | 'goal' | 'content' | 'reaction';
export const PROGRAM_TEXT_MAX: Record<ProgramTextKey, number> = { title: 100, goal: 1000, content: 2000, reaction: 2000 };
export const MAX_PARTICIPANTS = 100;
export const MIN_DURATION = 10;
export const MAX_DURATION = 480;

export interface ProgramDraft {
  date: string;
  time: string;
  /** 진행 시간(분). 비어 있으면 null */
  minutes: number | null;
  /** 인지활동형 프로그램 여부(5등급·인지지원 급여비용 산정 조건) */
  cognitive: boolean;
  /** 제공자 유형 — 인지활동형이면 필수 */
  providerKind: CognitiveProviderKind | '';
  category: ProgramCategory;
  fields: Record<ProgramTextKey, string>;
  ai: Partial<Record<ProgramTextKey, true>>;
  instructor: string;
  participantIds: number[];
  memo: string;
  aiUsed: boolean;
  aiKept: number;
}

export interface ProgramPreset {
  date: string;
  category?: ProgramCategory;
  /** 복사해서 새로 쓸 때 채울 칸(참여자는 가져오지 않는다) */
  from?: Program;
}

export function newDraft(preset: ProgramPreset, instructor: string): ProgramDraft {
  const src = preset.from;
  return {
    date: preset.date,
    time: src?.startTime ?? '',
    minutes: src?.durationMinutes ?? null,
    cognitive: src?.cognitiveActivity ?? false,
    providerKind: src?.providerKind ?? '',
    category: src?.category ?? preset.category ?? 'COGNITIVE',
    fields: { title: src?.title ?? '', goal: src?.goal ?? '', content: src?.content ?? '', reaction: '' },
    ai: {},
    instructor: src?.instructorName ?? instructor,
    participantIds: [],
    memo: '',
    aiUsed: false,
    aiKept: 0,
  };
}

export function draftFromProgram(p: Program): ProgramDraft {
  return {
    date: p.programDate.slice(0, 10),
    time: p.startTime ?? '',
    minutes: p.durationMinutes ?? null,
    cognitive: p.cognitiveActivity,
    providerKind: p.providerKind ?? '',
    category: p.category,
    fields: { title: p.title, goal: p.goal ?? '', content: p.content ?? '', reaction: p.reaction ?? '' },
    ai: {},
    instructor: p.instructorName ?? '',
    participantIds: [...p.participantIds],
    memo: '',
    aiUsed: false,
    aiKept: 0,
  };
}

export function snapshotOf(d: ProgramDraft): string {
  return JSON.stringify([d.date, d.time, d.minutes, d.cognitive, d.providerKind, d.category, d.fields, d.instructor, [...d.participantIds].sort((a, b) => a - b), d.memo]);
}

/** 저장 전 점검. 문제가 없으면 null */
export function validate(d: ProgramDraft): string | null {
  if (!d.date) return '프로그램을 진행한 날짜를 골라 주세요';
  if (d.fields.title.trim() === '') return '프로그램 제목을 적어 주세요';
  if (d.time !== '' && !TIME_PATTERN.test(d.time)) return '시작 시각은 09:30 같은 형식으로 적어 주세요';
  if (d.minutes !== null && (d.minutes < MIN_DURATION || d.minutes > MAX_DURATION)) return `진행 시간은 ${MIN_DURATION}분부터 ${MAX_DURATION}분 사이로 적어 주세요`;
  if (d.cognitive && d.providerKind === '') return '인지활동형 프로그램은 제공자 유형(프로그램관리자·치매전문요양보호사·외부강사·기타)을 골라 주세요';
  if (d.participantIds.length > MAX_PARTICIPANTS) return `참여 어르신은 ${MAX_PARTICIPANTS}명까지 고를 수 있습니다`;
  return null;
}

export function toInput(d: ProgramDraft, aiAssisted: boolean): ProgramInput {
  return {
    programDate: d.date,
    startTime: d.time === '' ? null : d.time,
    durationMinutes: d.minutes,
    cognitiveActivity: d.cognitive,
    providerKind: d.providerKind === '' ? null : d.providerKind,
    category: d.category,
    title: d.fields.title.trim(),
    goal: orNull(d.fields.goal),
    content: orNull(d.fields.content),
    reaction: orNull(d.fields.reaction),
    instructorName: orNull(d.instructor),
    participantIds: d.participantIds,
    aiAssisted,
  };
}
