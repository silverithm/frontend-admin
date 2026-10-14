/** 진료 동행 기록 편집 칸 모양과 변환·점검 — 화면과 따로 두어 규칙을 한눈에 본다. */
import { addDays, timeToMinutes } from '@/lib/lab/labDate';
import type { MedicalVisit, MedicalVisitInput } from '@/lib/lab/labTypes';
import {
  MAX_VISIT_DEPARTMENT,
  MAX_VISIT_ESCORT,
  MAX_VISIT_GUARDIAN_NOTE,
  MAX_VISIT_HOSPITAL,
  MAX_VISIT_PRESCRIPTION,
  MAX_VISIT_REASON,
  MAX_VISIT_RESULT,
} from '@/lib/lab/medicalVisitRules';
import { orNull } from './recordsFormat';

export const AI_FIELD_LIMITS = { department: MAX_VISIT_DEPARTMENT, reason: 500, result: 1000, prescription: 500 } as const;
export type AiField = keyof typeof AI_FIELD_LIMITS;
export const AI_FIELD_LABEL: Record<AiField, string> = { department: '진료과', reason: '진료 사유', result: '진료 내용', prescription: '처방' };

export const VISIT_LIMITS = {
  hospital: MAX_VISIT_HOSPITAL,
  department: MAX_VISIT_DEPARTMENT,
  reason: MAX_VISIT_REASON,
  result: MAX_VISIT_RESULT,
  prescription: MAX_VISIT_PRESCRIPTION,
  escort: MAX_VISIT_ESCORT,
  guardianNote: MAX_VISIT_GUARDIAN_NOTE,
  memo: 3000,
} as const;

/** 진료일은 오늘부터 400일 뒤까지만 받는다(서버 규칙) */
export const FUTURE_DAYS = 400;

export interface VisitDraft {
  elderId: number | null;
  visitDate: string;
  startTime: string;
  endTime: string;
  hospital: string;
  department: string;
  reason: string;
  result: string;
  prescription: string;
  escort: string;
  guardianNotified: boolean;
  guardianNote: string;
  followUpOn: string;
  followUpDone: boolean;
  /** AI에 보낼 진료 메모(저장하지 않는다) */
  memo: string;
  aiUsed: boolean;
  /** AI가 채우고 아직 직원이 고치지 않은 칸 */
  aiMarks: Partial<Record<AiField, true>>;
  /** 마지막 AI 정리에서 직접 쓴 칸이라 바꾸지 않은 칸 수 */
  aiKept: number;
}

export function newVisitDraft(today: string): VisitDraft {
  return {
    elderId: null,
    visitDate: today,
    startTime: '',
    endTime: '',
    hospital: '',
    department: '',
    reason: '',
    result: '',
    prescription: '',
    escort: '',
    guardianNotified: false,
    guardianNote: '',
    followUpOn: '',
    followUpDone: false,
    memo: '',
    aiUsed: false,
    aiMarks: {},
    aiKept: 0,
  };
}

export function draftFromVisit(v: MedicalVisit): VisitDraft {
  return {
    elderId: v.elderlyId,
    visitDate: v.visitDate,
    startTime: v.startTime ?? '',
    endTime: v.endTime ?? '',
    hospital: v.hospital,
    department: v.department ?? '',
    reason: v.reason ?? '',
    result: v.result,
    prescription: v.prescription ?? '',
    escort: v.escortName,
    guardianNotified: v.guardianNotified,
    guardianNote: v.guardianNote ?? '',
    followUpOn: v.followUpOn ?? '',
    followUpDone: v.followUpDone,
    memo: '',
    aiUsed: v.aiAssisted,
    aiMarks: {},
    aiKept: 0,
  };
}

/** 저장할 입력. 후속 날짜가 없으면 완료 표시도 끈다 */
export function visitInput(d: VisitDraft): MedicalVisitInput {
  const hasFollowUp = d.followUpOn !== '';
  return {
    elderlyId: d.elderId ?? 0,
    visitDate: d.visitDate,
    startTime: orNull(d.startTime),
    endTime: orNull(d.endTime),
    hospital: d.hospital.trim(),
    department: orNull(d.department),
    reason: orNull(d.reason),
    result: d.result.trim(),
    prescription: orNull(d.prescription),
    escortName: d.escort.trim(),
    guardianNotified: d.guardianNotified,
    guardianNote: d.guardianNotified ? orNull(d.guardianNote) : null,
    followUpOn: hasFollowUp ? d.followUpOn : null,
    followUpDone: hasFollowUp ? d.followUpDone : false,
    aiAssisted: d.aiUsed,
  };
}

/** 목록에서 바로 바꿀 때(후속 확인 완료) 기록 그대로에 일부만 바꾼 입력 */
export function visitInputOf(v: MedicalVisit, patch: Partial<MedicalVisitInput>): MedicalVisitInput {
  return {
    elderlyId: v.elderlyId,
    visitDate: v.visitDate,
    startTime: v.startTime,
    endTime: v.endTime,
    hospital: v.hospital,
    department: v.department,
    reason: v.reason,
    result: v.result,
    prescription: v.prescription,
    escortName: v.escortName,
    guardianNotified: v.guardianNotified,
    guardianNote: v.guardianNote,
    followUpOn: v.followUpOn,
    followUpDone: v.followUpDone,
    aiAssisted: v.aiAssisted,
    ...patch,
  };
}

/** 저장 전에 고쳐야 할 점(한글). 비면 저장할 수 있다 */
export function visitProblems(d: VisitDraft, today: string): string[] {
  const out: string[] = [];
  if (d.elderId === null) out.push('어르신을 골라 주세요');
  if (d.visitDate === '') out.push('진료 날짜를 골라 주세요');
  else {
    const latest = addDays(today, FUTURE_DAYS);
    if (latest && d.visitDate > latest) out.push('진료 날짜는 오늘부터 400일 안으로만 적을 수 있습니다');
  }
  const start = d.startTime === '' ? null : timeToMinutes(d.startTime);
  const end = d.endTime === '' ? null : timeToMinutes(d.endTime);
  if (d.startTime !== '' && start === null) out.push('시작 시각을 14:30처럼 적어 주세요');
  if (d.endTime !== '' && end === null) out.push('끝 시각을 14:30처럼 적어 주세요');
  if (start !== null && end !== null && end <= start) out.push('끝 시각은 시작 시각보다 뒤여야 합니다');
  if (d.hospital.trim() === '') out.push('병원 이름을 적어 주세요');
  if (d.result.trim() === '') out.push('진료 내용을 적어 주세요');
  if (d.escort.trim() === '') out.push('동행한 직원을 적어 주세요');
  if (d.followUpOn !== '' && d.visitDate !== '' && d.followUpOn < d.visitDate) out.push('후속 확인 날짜는 진료 날짜보다 앞설 수 없습니다');
  return out;
}

/** 저장되는 값만 비교한다(메모는 제외) */
export function visitSnapshot(d: VisitDraft): string {
  return JSON.stringify({ ...d, memo: '' });
}
