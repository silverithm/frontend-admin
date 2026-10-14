/** 상태변화·사고 기록 입력 초안 — 칸 모양, 서버 입력으로 바꾸기, 검사 */
import type { CareEvent, CareEventInput, CareEventKind, CareEventSeverity, GuardianContactMethod } from '@/lib/lab/labTypes';
import { dateLabel, todayString } from '@/components/lab/labFormat';
import { orNull } from './recordsFormat';

export type EventTextKey = 'description' | 'immediateAction' | 'guardianResponse' | 'followUp' | 'prevention';
export const EVENT_TEXT_MAX: Record<EventTextKey, number> = { description: 2000, immediateAction: 2000, guardianResponse: 1000, followUp: 2000, prevention: 2000 };
export const EVENT_TEXT_LABEL: Record<EventTextKey, string> = {
  description: '상황',
  immediateAction: '즉시 조치',
  guardianResponse: '보호자 반응',
  followUp: '후속 조치',
  prevention: '재발 방지',
};

export const GUARDIAN_METHODS: ReadonlyArray<{ value: GuardianContactMethod; label: string }> = [
  { value: 'PHONE', label: '전화' },
  { value: 'SMS', label: '문자' },
  { value: 'VISIT', label: '방문·대면' },
  { value: 'OTHER', label: '기타' },
];

export interface CareEventDraft {
  elderId: number | null;
  date: string;
  time: string;
  kind: CareEventKind;
  severity: CareEventSeverity;
  /** 직원이 직접 고른 값은 AI 제안으로 바꾸지 않는다 */
  kindTouched: boolean;
  severityTouched: boolean;
  place: string;
  fields: Record<EventTextKey, string>;
  ai: Partial<Record<EventTextKey, true>>;
  guardianDate: string;
  guardianTime: string;
  guardianMethod: GuardianContactMethod | '';
  hospital: string;
  reporter: string;
  memo: string;
  aiUsed: boolean;
  aiKept: number;
  /** AI가 만든 보호자 연락 문장(이름 자리는 '[어르신]') */
  aiMessage: string;
}

/** 지금 서울 시각 'HH:MM' */
export function nowTimeSeoul(): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return `${get('hour')}:${get('minute')}`;
}

export function newDraft(reporter: string, elderId: number | null = null): CareEventDraft {
  return {
    elderId,
    date: todayString(),
    time: nowTimeSeoul(),
    kind: 'CONDITION_CHANGE',
    severity: 'MODERATE',
    kindTouched: false,
    severityTouched: false,
    place: '',
    fields: { description: '', immediateAction: '', guardianResponse: '', followUp: '', prevention: '' },
    ai: {},
    guardianDate: '',
    guardianTime: '',
    guardianMethod: '',
    hospital: '',
    reporter,
    memo: '',
    aiUsed: false,
    aiKept: 0,
    aiMessage: '',
  };
}

const splitAt = (value: string | null): { date: string; time: string } => (value && value.length >= 16 ? { date: value.slice(0, 10), time: value.slice(11, 16) } : { date: '', time: '' });

export function draftFromEvent(e: CareEvent): CareEventDraft {
  const at = splitAt(e.occurredAt);
  const g = splitAt(e.guardianNotifiedAt);
  return {
    elderId: e.elderlyId,
    date: at.date,
    time: at.time,
    kind: e.kind,
    severity: e.severity,
    kindTouched: true,
    severityTouched: true,
    place: e.place ?? '',
    fields: {
      description: e.description ?? '',
      immediateAction: e.immediateAction ?? '',
      guardianResponse: e.guardianResponse ?? '',
      followUp: e.followUp ?? '',
      prevention: e.prevention ?? '',
    },
    ai: {},
    guardianDate: g.date,
    guardianTime: g.time,
    guardianMethod: e.guardianMethod ?? '',
    hospital: e.hospitalName ?? '',
    reporter: e.reporterName ?? '',
    memo: '',
    aiUsed: false,
    aiKept: 0,
    aiMessage: '',
  };
}

export const occurredAtOf = (d: CareEventDraft): string => (d.date && d.time ? `${d.date}T${d.time}` : '');
export const guardianAtOf = (d: CareEventDraft): string | null => (d.guardianDate ? `${d.guardianDate}T${d.guardianTime || '00:00'}` : null);

/** 규칙 함수(체크리스트·닫기)가 읽는 모양 */
export function eventLikeOf(d: CareEventDraft) {
  return {
    occurredAt: occurredAtOf(d),
    kind: d.kind,
    severity: d.severity,
    immediateAction: d.fields.immediateAction,
    guardianNotifiedAt: guardianAtOf(d),
    guardianMethod: d.guardianMethod === '' ? null : d.guardianMethod,
    followUp: d.fields.followUp,
    prevention: d.fields.prevention,
  };
}

export function toInput(d: CareEventDraft, status: 'OPEN' | 'CLOSED', closedOn: string | null, aiAssisted: boolean): CareEventInput {
  return {
    elderlyId: d.elderId as number,
    occurredAt: occurredAtOf(d),
    kind: d.kind,
    severity: d.severity,
    place: orNull(d.place),
    description: d.fields.description.trim(),
    immediateAction: orNull(d.fields.immediateAction),
    guardianNotifiedAt: guardianAtOf(d),
    guardianMethod: d.guardianMethod === '' ? null : d.guardianMethod,
    guardianResponse: orNull(d.fields.guardianResponse),
    hospitalName: orNull(d.hospital),
    followUp: orNull(d.fields.followUp),
    prevention: orNull(d.fields.prevention),
    status,
    closedOn: status === 'CLOSED' ? closedOn ?? todayString() : null,
    reporterName: d.reporter.trim(),
    aiAssisted,
  };
}

export type EventErrors = Partial<Record<'elder' | 'occurred' | 'description' | 'guardian' | 'reporter' | 'place' | 'hospital', string>>;

export function validate(d: CareEventDraft): EventErrors {
  const errors: EventErrors = {};
  if (d.elderId === null) errors.elder = '어르신을 골라 주세요';
  if (!d.date || !d.time) errors.occurred = '일어난 날짜와 시각을 적어 주세요';
  else if (d.date > todayString()) errors.occurred = '오늘 이후 날짜는 기록할 수 없습니다';
  if (d.fields.description.trim() === '') errors.description = '무슨 일이 있었는지 적어 주세요';
  const hasDate = d.guardianDate !== '';
  if (hasDate !== (d.guardianMethod !== '')) errors.guardian = '보호자에게 알린 날짜·시각과 방법을 함께 적어 주세요';
  else if (hasDate && d.guardianTime === '') errors.guardian = '보호자에게 알린 시각을 적어 주세요';
  else if (hasDate && d.date && d.time && guardianAtOf(d) !== null && (guardianAtOf(d) as string) < occurredAtOf(d)) errors.guardian = '보호자 연락 시각이 사고 시각보다 앞섭니다';
  if (d.reporter.trim() === '') errors.reporter = '보고자 이름을 적어 주세요';
  if (d.place.length > 100) errors.place = '장소는 100자까지 적을 수 있습니다';
  if (d.hospital.length > 100) errors.hospital = '병원 이름은 100자까지 적을 수 있습니다';
  return errors;
}

export const snapshotOf = (d: CareEventDraft): string =>
  JSON.stringify([d.elderId, d.date, d.time, d.kind, d.severity, d.place, d.fields, d.guardianDate, d.guardianTime, d.guardianMethod, d.hospital, d.reporter]);

/** '10월 14일 (수) 14:30' */
export function eventTimeLabel(occurredAt: string): string {
  return `${dateLabel(occurredAt.slice(0, 10))} ${occurredAt.slice(11, 16)}`;
}
