/**
 * 기존 기록으로 세는 평가 근거 — 개인정보 동의·투약 기록 완결도·바이탈 완결률·사건 후속·등급 변화. 전부 브라우저 안에서 도는 순수 함수다.
 *
 * 근거(research-10 §C): 개인정보 동의는 법정 의무 근거(평가 점수와 별개), 투약·바이탈·사건 후속은 제품 기준(평가 문구가 아님),
 * 등급 변화는 공단 전산 산정 지표의 기관 자체 관리용. 확인 못 한 것(대조 필요): 등급 호전 방향과 인지지원등급 비교.
 */
import { daysBetween, isValidYmd } from './labDate.ts';
import { percentOneDecimal } from './percentRound.ts';
import type { CareEventKind, CareEventStatus, ElderDocType, MedStatus } from './labTypes.ts';

const blank = (value: string | null | undefined): boolean => typeof value !== 'string' || value.trim() === '';

export interface PrivacyConsentRate {
  total: number;
  withConsent: number;
  rate: number | null;
}

/** 진행 중 어르신 중 개인정보 수집·이용 동의 서류에 발급일이 적힌 어르신의 비율. 진행 중이 아닌 어르신의 서류는 세지 않는다 */
export function privacyConsentRate(activeElderIds: readonly number[], documents: ReadonlyArray<{ elderlyId: number; docType: ElderDocType; issuedOn: string | null }>): PrivacyConsentRate {
  const ids = [...new Set(activeElderIds)];
  const consented = new Set<number>();
  for (const d of documents) if (d.docType === 'PRIVACY_CONSENT' && d.issuedOn && isValidYmd(d.issuedOn)) consented.add(d.elderlyId);
  const withConsent = ids.filter((id) => consented.has(id)).length;
  return { total: ids.length, withConsent, rate: percentOneDecimal(withConsent, ids.length) };
}

export interface MedicationRecordCompleteness {
  /** 투약 칸 중 하나라도 값이 있는 기록 수('해당 없음'도 값이다) */
  days: number;
  /** 그중 기록자가 빈 것 */
  noRecorder: number;
  /** 건너뜀(SKIPPED)이 있는데 비고·처치가 둘 다 빈 것 */
  skippedNoNote: number;
}

export interface MedicationLogShape {
  logDate: string;
  medMorning: MedStatus | null;
  medLunch: MedStatus | null;
  medEvening: MedStatus | null;
  recorderName: string | null;
  note: string | null;
  treatment: string | null;
}

/** from~to(양 끝 포함) 간호일지의 투약 기록 완결도 */
export function medicationRecordCompleteness(logs: readonly MedicationLogShape[], from: string, to: string): MedicationRecordCompleteness {
  let days = 0;
  let noRecorder = 0;
  let skippedNoNote = 0;
  for (const l of logs) {
    if (!isValidYmd(l.logDate)) continue;
    const d = l.logDate.slice(0, 10);
    if (d < from.slice(0, 10) || d > to.slice(0, 10)) continue;
    const slots = [l.medMorning, l.medLunch, l.medEvening];
    if (slots.every((s) => s === null || s === undefined)) continue;
    days += 1;
    if (blank(l.recorderName)) noRecorder += 1;
    if (slots.includes('SKIPPED') && blank(l.note) && blank(l.treatment)) skippedNoNote += 1;
  }
  return { days, noRecorder, skippedNoNote };
}

export interface VitalsCompleteness {
  total: number;
  complete: number;
  rate: number | null;
}

export interface VitalsLogShape {
  elderlyId: number;
  logDate: string;
  systolic: number | null;
  diastolic: number | null;
  temperature: number | null;
}

const hasNumber = (v: number | null | undefined): boolean => typeof v === 'number' && Number.isFinite(v);

/** 이용일(careDays의 (어르신, 날짜) 쌍) 중 같은 날 간호일지에 수축기·이완기·체온이 모두 있는 비율 — 제품 기준이며 평가 문구가 아니다 */
export function vitalsCompleteness(careDays: ReadonlyArray<{ elderlyId: number; date: string }>, logs: readonly VitalsLogShape[]): VitalsCompleteness {
  const full = new Set<string>();
  for (const l of logs) if (hasNumber(l.systolic) && hasNumber(l.diastolic) && hasNumber(l.temperature)) full.add(`${l.elderlyId}|${l.logDate.slice(0, 10)}`);
  const pairs = new Set<string>();
  for (const c of careDays) pairs.add(`${c.elderlyId}|${c.date.slice(0, 10)}`);
  let complete = 0;
  for (const p of pairs) if (full.has(p)) complete += 1;
  return { total: pairs.size, complete, rate: percentOneDecimal(complete, pairs.size) };
}

export interface EventFollowUpRates {
  total: number;
  notified: number;
  closed: number;
  closedWithFollowUp: number;
}

export interface EventShape {
  kind: CareEventKind;
  occurredAt: string;
  guardianNotifiedAt: string | null;
  followUp: string | null;
  status: CareEventStatus;
}

const FOLLOW_KINDS: readonly CareEventKind[] = ['FALL', 'INJURY', 'EMERGENCY', 'HOSPITAL'];

/** asOf 기준 최근 days일(오늘 포함, days일 전 당일까지)의 낙상·부상·응급·병원 사건의 보호자 연락·종결·종결 후속 */
export function eventFollowUpRates(events: readonly EventShape[], asOf: string, days = 90): EventFollowUpRates {
  const day = asOf.slice(0, 10);
  let total = 0;
  let notified = 0;
  let closed = 0;
  let closedWithFollowUp = 0;
  for (const e of events) {
    if (!FOLLOW_KINDS.includes(e.kind) || !isValidYmd(e.occurredAt)) continue;
    const ago = daysBetween(e.occurredAt.slice(0, 10), day);
    if (ago === null || ago < 0 || ago > days) continue;
    total += 1;
    if (!blank(e.guardianNotifiedAt)) notified += 1;
    if (e.status === 'CLOSED') {
      closed += 1;
      if (!blank(e.followUp)) closedWithFollowUp += 1;
    }
  }
  return { total, notified, closed, closedWithFollowUp };
}

/** 중증 → 경증 순서. 인지지원은 가장 경증으로 둔다(대조 필요) */
const GRADE_ORDER = ['1', '2', '3', '4', '5', 'cognitive'] as const;

export type GradeChange = 'KEEP' | 'BETTER' | 'WORSE';

/** 갱신 전·후 등급 비교. 숫자가 커지면(경증 쪽) 호전. 둘 중 하나라도 없거나 모르는 값이면 null */
export function gradeChange(prev: string | null | undefined, next: string | null | undefined): GradeChange | null {
  const a = GRADE_ORDER.indexOf(prev as (typeof GRADE_ORDER)[number]);
  const b = GRADE_ORDER.indexOf(next as (typeof GRADE_ORDER)[number]);
  if (a < 0 || b < 0) return null;
  return b === a ? 'KEEP' : b > a ? 'BETTER' : 'WORSE';
}
