/** 예방접종 입력 초안 — 이름표, 입력 검사, 저장 입력 만들기 */
import type { Vaccination, VaccinationInput, VaccinationStatus, VaccineKind, VaccineVerifiedBy } from '@/lib/lab/labTypes';
import type { Tone } from '@/components/lab/LabUi';
import { todayString } from '@/components/lab/labFormat';
import { orNull } from './recordsFormat';

export const STATUS_LABEL: Record<VaccinationStatus, string> = { DONE: '접종', REFUSED: '거부', EXCLUDED: '제외', UNKNOWN: '미확인' };
export const STATUS_TONE: Record<VaccinationStatus, Tone> = { DONE: 'ok', REFUSED: 'warn', EXCLUDED: 'info', UNKNOWN: 'neutral' };
export const STATUS_OPTIONS: ReadonlyArray<{ value: VaccinationStatus; label: string }> = [
  { value: 'DONE', label: '접종함' },
  { value: 'REFUSED', label: '거부' },
  { value: 'EXCLUDED', label: '제외 (건강 상태 등)' },
  { value: 'UNKNOWN', label: '미확인 (확인 중)' },
];

export const VERIFIED_LABEL: Record<VaccineVerifiedBy, string> = { CERT: '접종확인서', GUARDIAN: '보호자 확인', NIP: '예방접종도우미 조회', OTHER: '기타' };
export const VERIFIED_OPTIONS = (Object.keys(VERIFIED_LABEL) as VaccineVerifiedBy[]).map((value) => ({ value, label: VERIFIED_LABEL[value] }));

export const VACCINE_LABEL: Record<VaccineKind, string> = { INFLUENZA: '인플루엔자', PNEUMOCOCCAL: '폐렴구균', COVID19: '코로나19' };
export const VACCINE_OPTIONS = (Object.keys(VACCINE_LABEL) as VaccineKind[]).map((value) => ({ value, label: value === 'INFLUENZA' ? '인플루엔자 (평가 항목)' : `${VACCINE_LABEL[value]} (참고)` }));

export const REASON_MAX = 200;
export const INSTITUTION_MAX = 100;
export const NOTE_MAX = 200;

export interface VaccineFormDraft {
  vaccine: VaccineKind;
  status: VaccinationStatus;
  givenOn: string;
  institution: string;
  verifiedBy: VaccineVerifiedBy | '';
  reason: string;
  note: string;
}

/** 올해를 보고 있으면 접종일 기본값은 오늘, 지난 해를 보고 있으면 비워 둔다 */
export function newVaccineDraft(year: number): VaccineFormDraft {
  const today = todayString();
  return { vaccine: 'INFLUENZA', status: 'DONE', givenOn: Number(today.slice(0, 4)) === year ? today : '', institution: '', verifiedBy: '', reason: '', note: '' };
}

export function draftFromRecord(v: Vaccination): VaccineFormDraft {
  return {
    vaccine: v.vaccine,
    status: v.status,
    givenOn: v.givenOn ? v.givenOn.slice(0, 10) : '',
    institution: v.institution ?? '',
    verifiedBy: v.verifiedBy ?? '',
    reason: v.reason ?? '',
    note: v.note ?? '',
  };
}

/** 저장 전에 한글로 알려 줄 문제. 없으면 null */
export function validateVaccine(d: VaccineFormDraft, year: number): string | null {
  if (d.status === 'DONE') {
    if (d.givenOn === '') return '접종일을 골라 주세요';
    if (d.givenOn > todayString()) return '오늘 이후 날짜는 기록할 수 없습니다';
    if (Number(d.givenOn.slice(0, 4)) !== year) return `접종일은 ${year}년 안이어야 합니다. 연도를 바꿔 기록해 주세요`;
    if (d.verifiedBy === '') return '접종을 어떻게 확인했는지 골라 주세요';
  }
  if ((d.status === 'REFUSED' || d.status === 'EXCLUDED') && d.reason.trim() === '') {
    return `${STATUS_LABEL[d.status]} 사유를 적어 주세요`;
  }
  return null;
}

export function vaccinationInput(elderlyId: number, year: number, d: VaccineFormDraft): VaccinationInput {
  const done = d.status === 'DONE';
  const reasoned = d.status === 'REFUSED' || d.status === 'EXCLUDED';
  return {
    elderlyId,
    seasonYear: year,
    vaccine: d.vaccine,
    status: d.status,
    givenOn: done ? d.givenOn : null,
    institution: done ? orNull(d.institution) : null,
    verifiedBy: done && d.verifiedBy !== '' ? d.verifiedBy : null,
    reason: reasoned ? d.reason.trim() : null,
    note: orNull(d.note),
  };
}

export interface ActiveElder {
  id: number;
  name: string;
}
