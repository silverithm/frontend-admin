/** 상담일지 입력 초안 */
import type { ConsultCounterpart, ConsultMethod, Consultation, ConsultationInput } from '@/lib/lab/labTypes';
import { orNull } from './recordsFormat';

export const COUNTERPART_OPTIONS: ReadonlyArray<{ value: ConsultCounterpart; label: string }> = [
  { value: 'GUARDIAN', label: '보호자' },
  { value: 'SELF', label: '본인(어르신)' },
  { value: 'FAMILY', label: '가족' },
  { value: 'OTHER', label: '기타' },
];
export const METHOD_OPTIONS: ReadonlyArray<{ value: ConsultMethod; label: string }> = [
  { value: 'PHONE', label: '전화' },
  { value: 'VISIT', label: '방문' },
  { value: 'ONLINE', label: '온라인' },
  { value: 'OTHER', label: '기타' },
];
export const counterpartLabel = (v: ConsultCounterpart): string => COUNTERPART_OPTIONS.find((o) => o.value === v)?.label ?? v;
export const methodLabel = (v: ConsultMethod): string => METHOD_OPTIONS.find((o) => o.value === v)?.label ?? v;

export type ConsultTextKey = 'content' | 'followUp';
export const CONSULT_TEXT_MAX: Record<ConsultTextKey, number> = { content: 2000, followUp: 800 };

export interface ConsultDraft {
  date: string;
  counterpart: ConsultCounterpart;
  counterpartName: string;
  method: ConsultMethod;
  fields: Record<ConsultTextKey, string>;
  ai: Partial<Record<ConsultTextKey, true>>;
  consultant: string;
  memo: string;
  aiUsed: boolean;
  aiKept: number;
  /** AI가 짚은 욕구 신호(저장하지 않는다 — 욕구사정을 쓸 때 참고) */
  needSignals: string[];
}

export function newDraft(date: string, consultant: string): ConsultDraft {
  return {
    date,
    counterpart: 'GUARDIAN',
    counterpartName: '',
    method: 'PHONE',
    fields: { content: '', followUp: '' },
    ai: {},
    consultant,
    memo: '',
    aiUsed: false,
    aiKept: 0,
    needSignals: [],
  };
}

export function draftFromConsultation(c: Consultation): ConsultDraft {
  return {
    date: c.consultedOn.slice(0, 10),
    counterpart: c.counterpart,
    counterpartName: c.counterpartName ?? '',
    method: c.method,
    fields: { content: c.content ?? '', followUp: c.followUp ?? '' },
    ai: {},
    consultant: c.consultantName ?? '',
    memo: '',
    aiUsed: false,
    aiKept: 0,
    needSignals: [],
  };
}

export function snapshotOf(d: ConsultDraft): string {
  return JSON.stringify([d.date, d.counterpart, d.counterpartName, d.method, d.fields, d.consultant, d.memo]);
}

export function validate(d: ConsultDraft): string | null {
  if (!d.date) return '상담한 날짜를 골라 주세요';
  if (d.fields.content.trim() === '') return '상담 내용을 적어 주세요';
  if (d.consultant.trim() === '') return '상담자 이름을 적어 주세요';
  return null;
}

export function toInput(d: ConsultDraft, elderlyId: number, aiAssisted: boolean): ConsultationInput {
  return {
    elderlyId,
    consultedOn: d.date,
    counterpart: d.counterpart,
    counterpartName: orNull(d.counterpartName),
    method: d.method,
    content: orNull(d.fields.content),
    followUp: orNull(d.fields.followUp),
    consultantName: orNull(d.consultant),
    aiAssisted,
  };
}
