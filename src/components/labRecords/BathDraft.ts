/** 목욕 일지 입력 초안 — 칸 모양, 소요시간 안내, 저장 전 검사 */
import type { BathLog, BathLogInput, BathMethod } from '@/lib/lab/labTypes';
import { MAX_BATH_MINUTES, MAX_BATH_PRE_CHECK, MAX_BATH_TEXT, bathMinutes } from '@/lib/lab/bathRules';
import { timeToMinutes } from '@/lib/lab/labDate';
import { defaultPersonName, todayString } from '@/components/lab/labFormat';
import { orNull } from './recordsFormat';

export const BATH_TEXT_MAX = { preCheck: MAX_BATH_PRE_CHECK, skinNote: MAX_BATH_TEXT, note: MAX_BATH_TEXT } as const;
export type BathTextKey = keyof typeof BATH_TEXT_MAX;

export interface BathDraft {
  elderId: number | null;
  date: string;
  start: string;
  end: string;
  method: BathMethod;
  methodTouched: boolean;
  provider: string;
  preCheck: string;
  skinNote: string;
  note: string;
  /** AI가 채운 칸 — 직원이 고치면 표시가 사라진다 */
  ai: Partial<Record<BathTextKey, true>>;
  memo: string;
  aiUsed: boolean;
  aiKept: number;
}

export function newBathDraft(elderId: number | null, date: string): BathDraft {
  return {
    elderId,
    date,
    start: '',
    end: '',
    method: 'FULL_BATH',
    methodTouched: false,
    provider: defaultPersonName(),
    preCheck: '',
    skinNote: '',
    note: '',
    ai: {},
    memo: '',
    aiUsed: false,
    aiKept: 0,
  };
}

export function draftFromBath(log: BathLog): BathDraft {
  return {
    elderId: log.elderlyId,
    date: log.bathDate.slice(0, 10),
    start: log.startTime,
    end: log.endTime,
    method: log.method,
    methodTouched: true,
    provider: log.providerName,
    preCheck: log.preCheck ?? '',
    skinNote: log.skinNote ?? '',
    note: log.note ?? '',
    ai: {},
    memo: '',
    aiUsed: false,
    aiKept: 0,
  };
}

/** 시작·끝 시각으로 소요시간 안내. 시각이 둘 다 있을 때만 판단한다. */
export function minutesHint(start: string, end: string): { minutes: number | null; problem: string | null } {
  if (start === '' || end === '') return { minutes: null, problem: null };
  const minutes = bathMinutes(start, end);
  if (minutes !== null) return { minutes, problem: null };
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  if (s === null || e === null) return { minutes: null, problem: '시각을 14:30처럼 24시간제로 적어 주세요' };
  if (e <= s) return { minutes: null, problem: '끝나는 시각이 시작 시각보다 늦어야 합니다' };
  return { minutes: null, problem: `목욕 시간이 ${MAX_BATH_MINUTES}분(3시간)을 넘습니다. 시각을 다시 확인해 주세요` };
}

export function bathProblems(d: BathDraft): string[] {
  const out: string[] = [];
  if (d.elderId === null) out.push('어르신을 골라 주세요');
  if (d.date === '') out.push('목욕한 날을 골라 주세요');
  else if (d.date > todayString()) out.push('오늘 이후 날짜는 기록할 수 없습니다');
  if (d.start === '') out.push('시작 시각을 적어 주세요');
  if (d.end === '') out.push('끝나는 시각을 적어 주세요');
  const hint = minutesHint(d.start, d.end);
  if (hint.problem) out.push(hint.problem);
  if (d.provider.trim() === '') out.push('목욕을 도운 요양보호사 이름을 적어 주세요');
  return out;
}

export function bathInput(d: BathDraft): BathLogInput {
  return {
    elderlyId: d.elderId as number,
    bathDate: d.date,
    startTime: d.start,
    endTime: d.end,
    method: d.method,
    providerName: d.provider.trim(),
    preCheck: orNull(d.preCheck),
    skinNote: orNull(d.skinNote),
    note: orNull(d.note),
  };
}

/** 'YYYY-MM-DD' → '10/5' */
export const shortDate = (date: string): string => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
