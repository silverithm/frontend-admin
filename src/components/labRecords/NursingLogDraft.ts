/** 간호일지 입력 초안 — 칸마다 글자로 들고 있다가, 판정·저장할 때만 숫자로 바꾼다. */
import type { MedStatus, NursingLog, NursingLogInput } from '@/lib/lab/labTypes';
import type { VitalReading } from '@/lib/lab/labTypes';
import { numberText, orNull, parseDecimal } from './recordsFormat';

export type VitalKey = 'systolic' | 'diastolic' | 'pulse' | 'temperature' | 'bloodSugar' | 'weight';

export interface VitalSpec {
  key: VitalKey;
  label: string;
  unit: string;
  /** 소수 자릿수(0이면 정수) */
  decimals: number;
  /** 서버가 받는 범위 — 밖의 값은 저장도 판정도 하지 않는다 */
  min: number;
  max: number;
  placeholder: string;
}

export const VITAL_SPECS: readonly VitalSpec[] = [
  { key: 'systolic', label: '수축기 혈압', unit: 'mmHg', decimals: 0, min: 50, max: 260, placeholder: '120' },
  { key: 'diastolic', label: '이완기 혈압', unit: 'mmHg', decimals: 0, min: 30, max: 160, placeholder: '80' },
  { key: 'pulse', label: '맥박', unit: '회/분', decimals: 0, min: 30, max: 200, placeholder: '72' },
  { key: 'temperature', label: '체온', unit: '℃', decimals: 1, min: 34, max: 42, placeholder: '36.5' },
  { key: 'bloodSugar', label: '혈당', unit: 'mg/dL', decimals: 0, min: 20, max: 600, placeholder: '110' },
  { key: 'weight', label: '체중', unit: 'kg', decimals: 1, min: 20, max: 200, placeholder: '52.3' },
];

export const MED_SLOTS = [
  { key: 'medMorning', label: '아침 약' },
  { key: 'medLunch', label: '점심 약' },
  { key: 'medEvening', label: '저녁 약' },
] as const;
export type MedKey = (typeof MED_SLOTS)[number]['key'];

export const MED_OPTIONS: ReadonlyArray<{ value: MedStatus; label: string }> = [
  { value: 'GIVEN', label: '드림' },
  { value: 'SKIPPED', label: '안 드림' },
  { value: 'NA', label: '해당 없음' },
];

export interface NursingDraft {
  vitals: Record<VitalKey, string>;
  meds: Record<MedKey, MedStatus | null>;
  treatment: string;
  note: string;
  recorder: string;
}

export const TEXT_MAX = 2000;

export function draftFromLog(log: NursingLog | null, recorder: string): NursingDraft {
  return {
    vitals: {
      systolic: numberText(log?.systolic),
      diastolic: numberText(log?.diastolic),
      pulse: numberText(log?.pulse),
      temperature: numberText(log?.temperature),
      bloodSugar: numberText(log?.bloodSugar),
      weight: numberText(log?.weight),
    },
    meds: { medMorning: log?.medMorning ?? null, medLunch: log?.medLunch ?? null, medEvening: log?.medEvening ?? null },
    treatment: log?.treatment ?? '',
    note: log?.note ?? '',
    recorder: log?.recorderName ?? recorder,
  };
}

export function snapshotOf(draft: NursingDraft): string {
  return JSON.stringify([draft.vitals, draft.meds, draft.treatment, draft.note, draft.recorder]);
}

/** 서버 범위 안의 값만 숫자로. 범위 밖·빈 칸은 null */
export function readVital(draft: NursingDraft, spec: VitalSpec): number | null {
  const value = parseDecimal(draft.vitals[spec.key]);
  return value !== null && value >= spec.min && value <= spec.max ? value : null;
}

/** 판정에 쓰는 측정값 — 범위 안의 값만 넣는다 */
export function readingOf(draft: NursingDraft): VitalReading {
  const reading: VitalReading = {};
  for (const spec of VITAL_SPECS) {
    const v = readVital(draft, spec);
    if (v !== null) reading[spec.key] = v;
  }
  return reading;
}

export function hasAnyVital(draft: NursingDraft): boolean {
  return VITAL_SPECS.some((s) => readVital(draft, s) !== null);
}

/** 칸별 오류 문구(없으면 키가 없다). 비어 있는 칸은 오류가 아니다. */
export function fieldErrors(draft: NursingDraft): Partial<Record<VitalKey, string>> {
  const errors: Partial<Record<VitalKey, string>> = {};
  for (const spec of VITAL_SPECS) {
    const text = draft.vitals[spec.key].trim();
    if (text === '') continue;
    const value = parseDecimal(text);
    if (value === null || value < spec.min || value > spec.max) {
      errors[spec.key] = `${spec.min}~${spec.max}${spec.unit} 사이로 적어 주세요`;
    }
  }
  const sys = parseDecimal(draft.vitals.systolic);
  const dia = parseDecimal(draft.vitals.diastolic);
  if (!errors.systolic && !errors.diastolic && sys !== null && dia !== null && sys < dia) {
    errors.systolic = '수축기 혈압은 이완기보다 높아야 합니다';
  }
  return errors;
}

export function hasContent(draft: NursingDraft): boolean {
  return hasAnyVital(draft) || Object.values(draft.meds).some((m) => m !== null) || draft.treatment.trim() !== '' || draft.note.trim() !== '';
}

export function toInput(draft: NursingDraft, elderlyId: number, logDate: string, aiAssisted: boolean): NursingLogInput {
  const num = (key: VitalKey): number | null => readVital(draft, VITAL_SPECS.find((s) => s.key === key) as VitalSpec);
  return {
    elderlyId,
    logDate,
    systolic: num('systolic'),
    diastolic: num('diastolic'),
    pulse: num('pulse'),
    temperature: num('temperature'),
    bloodSugar: num('bloodSugar'),
    weight: num('weight'),
    medMorning: draft.meds.medMorning,
    medLunch: draft.meds.medLunch,
    medEvening: draft.meds.medEvening,
    treatment: orNull(draft.treatment),
    note: orNull(draft.note),
    recorderName: orNull(draft.recorder),
    aiAssisted,
  };
}

/** 기록 한 줄을 목록용 판정 입력(체중 비교 없이)으로 */
export function readingFromLog(log: Pick<NursingLog, 'systolic' | 'diastolic' | 'pulse' | 'temperature' | 'bloodSugar' | 'weight'>): VitalReading {
  return { systolic: log.systolic, diastolic: log.diastolic, pulse: log.pulse, temperature: log.temperature, bloodSugar: log.bloodSugar, weight: log.weight };
}
