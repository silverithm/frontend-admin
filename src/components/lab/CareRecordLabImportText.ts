/**
 * 다른 기록(간호일지·프로그램 일지)에서 급여제공기록 칸에 넣을 문장을 만든다.
 * 칸에 바로 쓰지 않고 "제안"으로만 보여 주므로, 사람이 읽어 보고 넣는다.
 * 값이 없는 항목은 문장에 넣지 않는다(없는 수치를 지어내지 않는다).
 */
import { eventKindLabel, eventSeverityLabel } from '@/lib/lab/careEventRules';
import { visitCareRecordText } from '@/lib/lab/medicalVisitRules';
import { PROGRAM_CATEGORY_LABEL } from '@/lib/lab/programRules';
import type { CareEvent, CareRecordTextField, MedStatus, MedicalVisit, NursingLog, Program, ProgramCategory } from '@/lib/lab/labTypes';

const MED_TEXT: Record<Exclude<MedStatus, 'NA'>, string> = { GIVEN: '투약함', SKIPPED: '건너뜀' };

const num = (value: number | null | undefined): number | null => {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/** 간호일지 한 건 → 간호·처치 칸에 넣을 문장(없으면 null) */
export function nursingSentence(log: NursingLog | null | undefined): string | null {
  if (!log) return null;
  const parts: string[] = [];
  const sys = num(log.systolic);
  const dia = num(log.diastolic);
  if (sys !== null && dia !== null) parts.push(`혈압 ${sys}/${dia}mmHg`);
  const pulse = num(log.pulse);
  if (pulse !== null) parts.push(`맥박 ${pulse}회/분`);
  const temp = num(log.temperature);
  if (temp !== null) parts.push(`체온 ${temp.toFixed(1)}℃`);
  const sugar = num(log.bloodSugar);
  if (sugar !== null) parts.push(`혈당 ${sugar}mg/dL`);
  const weight = num(log.weight);
  if (weight !== null) parts.push(`체중 ${weight.toFixed(1)}kg`);

  const lines: string[] = [];
  if (parts.length > 0) lines.push(`${parts.join(', ')}을(를) 측정함.`);

  const meds: string[] = [];
  const medSlots: ReadonlyArray<[string, MedStatus | null]> = [
    ['아침', log.medMorning],
    ['점심', log.medLunch],
    ['저녁', log.medEvening],
  ];
  for (const [slot, status] of medSlots) if (status === 'GIVEN' || status === 'SKIPPED') meds.push(`${slot} ${MED_TEXT[status]}`);
  if (meds.length > 0) lines.push(`투약: ${meds.join(', ')}.`);

  const treatment = log.treatment?.trim();
  if (treatment) lines.push(`처치: ${treatment}`);
  return lines.length > 0 ? lines.join('\n') : null;
}

export interface ProgramSuggestion {
  field: Extract<CareRecordTextField, 'cognitive' | 'training'>;
  text: string;
}

/** 프로그램 → 칸. 신체 프로그램은 기능회복훈련, 인지·사회·여가는 인지 지원. 기타는 칸을 정하기 어려워 넣지 않는다. */
const FIELD_OF: Record<ProgramCategory, ProgramSuggestion['field'] | null> = {
  COGNITIVE: 'cognitive',
  SOCIAL: 'cognitive',
  LEISURE: 'cognitive',
  PHYSICAL: 'training',
  OTHER: null,
};

export const PROGRAM_FIELD_LABEL: Record<ProgramSuggestion['field'], string> = { cognitive: '인지 지원', training: '기능회복훈련' };

/**
 * 그날 이 어르신이 참여한 프로그램 → 칸별 문장. 시간순.
 * 프로그램의 "반응" 칸은 참여자 전체에 대한 글이라 다른 어르신 정보가 섞일 수 있어 가져오지 않는다.
 */
export function programSuggestions(
  programs: ReadonlyArray<Program>,
  elderId: number,
  date: string,
): { items: ProgramSuggestion[]; skipped: number } {
  const mine = programs
    .filter((p) => p.programDate.slice(0, 10) === date && p.participantIds.includes(elderId))
    .sort((a, b) => (a.startTime ?? '99:99').localeCompare(b.startTime ?? '99:99'));
  const items: ProgramSuggestion[] = [];
  let skipped = 0;
  for (const p of mine) {
    const field = FIELD_OF[p.category];
    if (!field) {
      skipped += 1;
      continue;
    }
    const when = p.startTime ? `${p.startTime} ` : '';
    const goal = p.goal?.trim() ? ` (목표: ${p.goal.trim()})` : '';
    items.push({ field, text: `${when}${PROGRAM_CATEGORY_LABEL[p.category]} 프로그램 「${p.title}」에 참여함${goal}.` });
  }
  return { items, skipped };
}

/**
 * 그날 이 어르신의 상태변화·사고 기록 → 특이사항 칸에 넣을 문장(없으면 null). 시간순, 한 건이 한 줄.
 * 사고 기록의 설명·즉시 조치는 그대로 옮기고, 보호자 연락 내용·병원 이름 같은 곁가지는 가져오지 않는다.
 */
export function eventSentence(events: ReadonlyArray<CareEvent>, elderId: number, date: string): string | null {
  const mine = events
    .filter((e) => e.elderlyId === elderId && e.occurredAt.slice(0, 10) === date)
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  if (mine.length === 0) return null;
  const lines = mine.map((e) => {
    const action = e.immediateAction?.trim() ? ` 즉시 조치: ${e.immediateAction.trim()}` : '';
    return `${e.occurredAt.slice(11, 16)} ${eventKindLabel(e.kind)}(${eventSeverityLabel(e.severity)}): ${e.description.trim()}${action}`;
  });
  return lines.join('\n');
}

/**
 * 그날 이 어르신의 진료 동행 → 특이사항 칸에 넣을 문장(없으면 null). 시작 시각 순, 한 건이 한 줄.
 * 문장은 lib/lab의 visitCareRecordText가 만든다(진료 내용은 앞 60자만, 처방·보호자 메모는 싣지 않음).
 */
export function visitSentence(visits: ReadonlyArray<MedicalVisit>, elderId: number, date: string): string | null {
  const mine = visits
    .filter((v) => v.elderlyId === elderId && v.visitDate.slice(0, 10) === date)
    .sort((a, b) => (a.startTime ?? '99:99').localeCompare(b.startTime ?? '99:99'));
  if (mine.length === 0) return null;
  return mine.map((v) => visitCareRecordText(v)).join('\n');
}
