/** 급여제공계획 변경 이력 입력 초안 — 칸 모양, 서버 입력으로 바꾸기, 검사 */
import type { CareEvent, CarePlanChange, CarePlanChangeInput, CarePlanChangeItem, CarePlanChangeReason } from '@/lib/lab/labTypes';
import { isValidYmd } from '@/lib/lab/labDate';
import { eventKindLabel, eventSeverityLabel } from '@/lib/lab/careEventRules';
import { dotDate } from '@/components/lab/labFormat';

export const REASON_NOTE_MAX = 300;
export const DETAIL_MAX = 1000;

export const CHANGE_REASONS: ReadonlyArray<{ value: CarePlanChangeReason; label: string }> = [
  { value: 'FUNCTION_CHANGE', label: '기능상태 변화' },
  { value: 'ELDER_WISH', label: '수급자 욕구' },
  { value: 'GUARDIAN_REQUEST', label: '보호자 요구' },
  { value: 'GRADE_CHANGE', label: '등급 변경' },
  { value: 'OTHER', label: '기타' },
];

export const CHANGE_ITEMS: ReadonlyArray<{ value: CarePlanChangeItem; label: string }> = [
  { value: 'CONTENT', label: '급여내용' },
  { value: 'TIME', label: '시간' },
  { value: 'FREQUENCY', label: '횟수' },
];

export const reasonLabel = (r: string): string => CHANGE_REASONS.find((x) => x.value === r)?.label ?? r;
export const itemLabel = (i: string): string => CHANGE_ITEMS.find((x) => x.value === i)?.label ?? i;

/** 상태변화 한 줄 이름 — 'YYYY.MM.DD 낙상 · 심각' */
export function eventOptionLabel(e: Pick<CareEvent, 'occurredAt' | 'kind' | 'severity'>): string {
  return `${dotDate(e.occurredAt.slice(0, 10))} ${eventKindLabel(e.kind)} · ${eventSeverityLabel(e.severity)}`;
}

export interface ChangeDraft {
  changedOn: string;
  reason: CarePlanChangeReason | '';
  reasonNote: string;
  items: CarePlanChangeItem[];
  detail: string;
  eventId: number | null;
  explainedOn: string;
  signedOn: string;
  notifiedOn: string;
}

export interface ChangePreset {
  date: string;
  eventId?: number | null;
  reason?: CarePlanChangeReason;
}

export function newChangeDraft(preset: ChangePreset): ChangeDraft {
  return {
    changedOn: preset.date,
    reason: preset.reason ?? '',
    reasonNote: '',
    items: [],
    detail: '',
    eventId: preset.eventId ?? null,
    explainedOn: '',
    signedOn: '',
    notifiedOn: '',
  };
}

export function draftFromChange(c: CarePlanChange): ChangeDraft {
  return {
    changedOn: c.changedOn.slice(0, 10),
    reason: c.reason,
    reasonNote: c.reasonNote ?? '',
    items: [...c.changeItems],
    detail: c.changeDetail ?? '',
    eventId: c.eventId,
    explainedOn: c.guardianExplainedOn?.slice(0, 10) ?? '',
    signedOn: c.guardianSignedOn?.slice(0, 10) ?? '',
    notifiedOn: c.notifiedOn?.slice(0, 10) ?? '',
  };
}

export const changeSnapshot = (d: ChangeDraft): string => JSON.stringify([d.changedOn, d.reason, d.reasonNote, d.items, d.detail, d.eventId, d.explainedOn, d.signedOn, d.notifiedOn]);

/** 저장 막는 문제(없으면 null) — 서버 규칙과 같다: 필수 칸, 미래 날짜 불가, 설명·서명·통보일은 변경일 이후 */
export function changeProblem(d: ChangeDraft, today: string): string | null {
  if (!isValidYmd(d.changedOn)) return '변경한 날짜를 골라 주세요';
  if (d.changedOn > today) return '변경일은 오늘 이후로 적을 수 없습니다';
  if (d.reason === '') return '변경 사유를 골라 주세요';
  if (d.reasonNote.trim() === '') return '사유를 서술해 주세요';
  if (d.items.length === 0) return '변경 항목(급여내용·시간·횟수)을 한 가지 이상 골라 주세요';
  if (d.detail.trim() === '') return '변경 내용을 적어 주세요';
  const dates: Array<[string, string]> = [
    ['보호자 설명일', d.explainedOn],
    ['확인서명일', d.signedOn],
    ['공단 통보일', d.notifiedOn],
  ];
  for (const [name, v] of dates) {
    if (v === '') continue;
    if (v > today) return `${name}은 오늘 이후로 적을 수 없습니다`;
    if (v < d.changedOn) return `${name}은 변경일과 같거나 이후여야 합니다`;
  }
  return null;
}

export function changeInput(d: ChangeDraft, elderlyId: number): CarePlanChangeInput {
  const orNullDate = (v: string): string | null => (v === '' ? null : v);
  return {
    elderlyId,
    changedOn: d.changedOn,
    reason: d.reason as CarePlanChangeReason,
    reasonNote: d.reasonNote.trim(),
    changeItems: CHANGE_ITEMS.map((i) => i.value).filter((v) => d.items.includes(v)),
    changeDetail: d.detail.trim(),
    eventId: d.eventId,
    guardianExplainedOn: orNullDate(d.explainedOn),
    guardianSignedOn: orNullDate(d.signedOn),
    notifiedOn: orNullDate(d.notifiedOn),
  };
}
