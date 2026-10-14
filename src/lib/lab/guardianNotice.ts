/**
 * 보호자 월간 안내 규칙 — 이름 자리표시자, 사실 묶음(AI 초안의 유일한 근거), 문자 길이, 발송 현황.
 *
 * 근거(research-5.md): 2026 평가 '결과평가' 기준③ — 장기요양급여제공기록지를 월 1회 이상 수급자(보호자)에게 제공하고 제공대장(일자·방법·수령자)으로
 * 확인한다. '소통노력' 기준③ — 월간 프로그램 계획표·식단표·기관 소식을 월 1회 이상 제공. 이 안내는 일방향이라 '소통노력'의 보호자 상담
 * (분기 1회, 양방향)을 대신하지 못한다. 서식 문구와 제공대장 항목은 대조 필요.
 *
 * 사실 묶음에는 사람 이름이 없다: 이 모듈은 이름을 받지 않고, 사고는 날짜·종류·심각도만 담는다. 자유서술(특이사항)은 AI 호출 직전
 * labApi가 redactDeep로 한 번 더 지운다.
 */
import type { CareEvent, CareRecord, CopayBill, GuardianNotice, NoticeFacts, NursingLog, Program, RehabSession } from './labTypes.ts';
import { findVaguePhrases } from './careRecordQuality.ts';
import { eventKindLabel, eventSeverityLabel } from './careEventRules.ts';
import { REHAB_KINDS } from './rehabRules.ts';

/** AI가 이름 자리에 쓰는 자리표시자 */
export const NAME_TOKEN = '[어르신]';

/** 자리표시자를 모두 이름으로 바꾼다 */
export function fillName(text: string, name: string): string {
  return text.split(NAME_TOKEN).join(name);
}

/** 문자 길이 근사(EUC-KR): 한글·한자 등 비ASCII는 2바이트, ASCII는 1바이트 */
export function smsBytes(text: string): number {
  let bytes = 0;
  for (const ch of text) bytes += (ch.codePointAt(0) ?? 0) < 128 ? 1 : 2;
  return bytes;
}

export const SMS_LIMIT = 90;
export const LMS_LIMIT = 2000;

export type SmsKind = 'SMS' | 'LMS' | 'TOO_LONG';

export function smsKind(text: string): SmsKind {
  const bytes = smsBytes(text);
  return bytes <= SMS_LIMIT ? 'SMS' : bytes <= LMS_LIMIT ? 'LMS' : 'TOO_LONG';
}

// ---------- 사실 묶음 ----------

const MAX_SPECIAL_NOTES = 5;
const MAX_SPECIAL_NOTE_LENGTH = 200;

function inMonth(date: string | null | undefined, month: string): date is string {
  return typeof date === 'string' && date.slice(0, 7) === month;
}

function mean(values: number[]): number {
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export interface NoticeFactsInput {
  elderlyId: number;
  /** 'YYYY-MM' */
  month: string;
  attendanceDays: number;
  careRecords: ReadonlyArray<Pick<CareRecord, 'elderlyId' | 'recordDate' | 'specialNote'>>;
  nursingLogs: ReadonlyArray<Pick<NursingLog, 'elderlyId' | 'logDate' | 'systolic' | 'diastolic' | 'bloodSugar' | 'weight'>>;
  programs: ReadonlyArray<Pick<Program, 'programDate' | 'category' | 'participantIds'>>;
  rehabSessions: ReadonlyArray<Pick<RehabSession, 'elderlyId' | 'sessionDate' | 'kind' | 'minutes'>>;
  events: ReadonlyArray<Pick<CareEvent, 'elderlyId' | 'occurredAt' | 'kind' | 'severity'>>;
  copayBill: Pick<CopayBill, 'elderlyId' | 'billMonth' | 'totalDue' | 'status'> | null;
}

/**
 * 한 어르신의 그 달 사실 묶음. 그 어르신 기록만, 날짜가 그 달 밖이면 뺀다.
 *  - 평균은 반올림 정수(체중은 소수 첫째 자리). 혈압은 수축기·이완기가 둘 다 있는 측정만 센다.
 *  - 체중은 두 번 이상 잰 달만 변화를 말할 수 있어 한 번뿐이면 null(한 번 재고 "변화 없음"이라 쓰는 것을 막는다).
 *  - 특이사항은 형식적 문구가 아닌 것만 날짜순 최대 5개, 각 200자까지.
 */
export function buildNoticeFacts(input: NoticeFactsInput): NoticeFacts {
  const { elderlyId, month } = input;

  const logs = input.nursingLogs.filter((l) => l.elderlyId === elderlyId && inMonth(l.logDate, month)).sort((a, b) => (a.logDate < b.logDate ? -1 : a.logDate > b.logDate ? 1 : 0));
  const bp = logs.filter((l) => typeof l.systolic === 'number' && typeof l.diastolic === 'number');
  const sugar = logs.filter((l) => typeof l.bloodSugar === 'number').map((l) => l.bloodSugar as number);
  const weights = logs.filter((l) => typeof l.weight === 'number').map((l) => l.weight as number);

  const programs = input.programs.filter((p) => inMonth(p.programDate, month) && p.participantIds.includes(elderlyId));
  const byCategory: Record<string, number> = {};
  for (const p of programs) byCategory[p.category] = (byCategory[p.category] ?? 0) + 1;

  const rehab = input.rehabSessions.filter((s) => s.elderlyId === elderlyId && inMonth(s.sessionDate, month));
  const rehabKinds = REHAB_KINDS.filter((k) => rehab.some((s) => s.kind === k.value)).map((k) => k.label);

  const events = input.events
    .filter((e) => e.elderlyId === elderlyId && inMonth(e.occurredAt, month))
    .sort((a, b) => (a.occurredAt < b.occurredAt ? -1 : a.occurredAt > b.occurredAt ? 1 : 0))
    .map((e) => ({ date: e.occurredAt.slice(0, 10), kindLabel: eventKindLabel(e.kind), severityLabel: eventSeverityLabel(e.severity) }));

  const specialNotes = input.careRecords
    .filter((r) => r.elderlyId === elderlyId && inMonth(r.recordDate, month) && typeof r.specialNote === 'string' && r.specialNote.trim() !== '')
    .sort((a, b) => (a.recordDate < b.recordDate ? -1 : a.recordDate > b.recordDate ? 1 : 0))
    .map((r) => (r.specialNote as string).trim())
    .filter((note) => findVaguePhrases({ specialNote: note }).length === 0)
    .slice(0, MAX_SPECIAL_NOTES)
    .map((note) => Array.from(note).slice(0, MAX_SPECIAL_NOTE_LENGTH).join(''));

  const bill = input.copayBill;
  return {
    month,
    attendanceDays: input.attendanceDays,
    vitals: {
      bp: bp.length === 0 ? null : { avgSys: mean(bp.map((l) => l.systolic as number)), avgDia: mean(bp.map((l) => l.diastolic as number)), count: bp.length },
      bloodSugar: sugar.length === 0 ? null : { avg: mean(sugar), min: Math.min(...sugar), max: Math.max(...sugar), count: sugar.length },
      weight: weights.length < 2 ? null : { first: round1(weights[0]), last: round1(weights[weights.length - 1]), change: round1(weights[weights.length - 1] - weights[0]) },
    },
    programs: { total: programs.length, byCategory },
    rehab: { sessions: rehab.length, minutes: rehab.reduce((n, s) => n + (Number.isFinite(s.minutes) && s.minutes > 0 ? Math.trunc(s.minutes) : 0), 0), kinds: rehabKinds },
    events,
    specialNotes,
    copay: bill && bill.elderlyId === elderlyId && bill.billMonth === month ? { totalDue: bill.totalDue, status: bill.status } : null,
  };
}

/**
 * 안내 글에 있는 숫자 중 사실 묶음에 없는 것(AI가 지어냈을 수 있는 수치). 화면이 경고를 띄우는 데 쓴다.
 * 월·일처럼 사실 묶음 날짜에 든 숫자와 이름 자리표시자는 걸러지고, 천 단위 쉼표는 하나로 읽는다.
 */
export function numbersNotInFacts(text: string, facts: NoticeFacts): string[] {
  const read = (s: string) => (s.replace(/(\d),(?=\d{3})/g, '$1').match(/\d+(?:\.\d+)?/g) ?? []).map((n) => String(Number(n)));
  const allowed = new Set(read(JSON.stringify(facts)));
  return [...new Set(read(text))].filter((n) => !allowed.has(n));
}

// ---------- 발송 현황 ----------

export interface NoticeCoverage {
  sent: number;
  draft: number;
  missing: number;
  missingElderIds: number[];
}

/** 그 달 어르신 중 안내를 보냈는지·초안만 있는지·아직 없는지. 같은 어르신의 안내가 둘이면 보낸 쪽을 본다. */
export function noticeCoverage(notices: ReadonlyArray<Pick<GuardianNotice, 'elderlyId' | 'noticeMonth' | 'status'>>, elders: ReadonlyArray<{ id: number }>, month: string): NoticeCoverage {
  const status = new Map<number, 'SENT' | 'DRAFT'>();
  for (const n of notices) {
    if (n.noticeMonth !== month) continue;
    if (n.status === 'SENT') status.set(n.elderlyId, 'SENT');
    else if (!status.has(n.elderlyId)) status.set(n.elderlyId, 'DRAFT');
  }
  let sent = 0;
  let draft = 0;
  const missingElderIds: number[] = [];
  for (const e of elders) {
    const s = status.get(e.id);
    if (s === 'SENT') sent += 1;
    else if (s === 'DRAFT') draft += 1;
    else missingElderIds.push(e.id);
  }
  return { sent, draft, missing: missingElderIds.length, missingElderIds };
}
