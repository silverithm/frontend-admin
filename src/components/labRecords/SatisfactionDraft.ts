/** 급여 만족도 응답 입력 초안과 점검. */
import type { SatisfactionKind, SatisfactionRespondent, SatisfactionResponseInput } from '@/lib/lab/labTypes';
import { MAX_SATISFACTION_COMMENT, SURVEY_QUESTIONS } from '@/lib/lab/satisfactionRules';
import { addDays } from '@/lib/lab/labDate';
import { orNull } from './recordsFormat';

export const MAX_INTERVIEWER = 50;
export { MAX_SATISFACTION_COMMENT };

export interface SatisfactionDraft {
  date: string;
  elderId: number | null;
  anonymous: boolean;
  respondent: SatisfactionRespondent | null;
  scores: Record<string, number>;
  comment: string;
  interviewer: string;
}

export function newSatisfactionDraft(today: string, interviewer: string): SatisfactionDraft {
  return { date: today, elderId: null, anonymous: false, respondent: null, scores: {}, comment: '', interviewer };
}

export function validateSatisfaction(d: SatisfactionDraft, kind: SatisfactionKind, today: string): string | null {
  if (d.date === '') return '조사일을 골라 주세요';
  if (d.date > today) return '조사일은 오늘 이후로 적을 수 없습니다';
  if (!d.anonymous && d.elderId === null) return '어르신을 고르거나 ‘익명으로 받기’를 켜 주세요';
  if (d.respondent === null) return '응답한 분(본인·보호자)을 골라 주세요';
  const answered = SURVEY_QUESTIONS[kind].filter((q) => d.scores[q.code] !== undefined).length;
  if (answered === 0) return '문항에 점수를 하나 이상 골라 주세요';
  if (d.interviewer.trim() === '') return '면담자를 적어 주세요';
  return null;
}

export function satisfactionInputOf(d: SatisfactionDraft, kind: SatisfactionKind): SatisfactionResponseInput {
  const scores: Record<string, number> = {};
  for (const q of SURVEY_QUESTIONS[kind]) if (d.scores[q.code] !== undefined) scores[q.code] = d.scores[q.code];
  return {
    surveyDate: d.date,
    kind,
    elderlyId: d.anonymous ? null : d.elderId,
    respondent: d.respondent ?? 'SELF',
    scores,
    comment: orNull(d.comment),
    interviewerName: d.interviewer.trim(),
  };
}

/** 조사 기간 점검 — 서버는 최대 1년까지만 받는다. 문제가 없으면 null. */
export function validatePeriod(from: string, to: string): string | null {
  if (from === '' || to === '') return '조사 기간의 시작과 끝을 모두 골라 주세요';
  if (from > to) return '시작일이 끝나는 날보다 늦습니다';
  const limit = addDays(from, 365);
  if (limit !== null && to > limit) return '조사 기간은 최대 1년까지 볼 수 있습니다';
  return null;
}
