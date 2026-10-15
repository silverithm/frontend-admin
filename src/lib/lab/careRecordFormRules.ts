/**
 * 급여제공기록지 법정 서식 칸 규칙 — 시행규칙 별지 제15호서식(주·야간보호)의 칸 검증, 영역별 채움·서명 점검,
 * 고시가 기록지에 적으라고 정한 사유(제30조④⑧·제32조③⑩⑪), 서식 인쇄 장 나누기. 전부 브라우저 안에서 도는 순수 함수다.
 *
 * 근거(research-12 §A): 서식은 이용일 3칸이 한 장이고 영역(신체활동지원·인지관리 및 의사소통·건강 및 간호관리·기능회복훈련)마다
 * 특이사항과 작성자 서명이 있다. 유의사항 7: 항목별 서비스를 제공한 종사자가 작성자란에 서명.
 * 확인 못 한 것: 이용 시각 형식 검증은 'HH:MM' 24시간제만 본다(24:00 표기는 틀린 형식으로 본다).
 */
import { parseYmd, timeToMinutes } from './labDate.ts';
import type { CareFormReasonKind, CareFormSectionKey, CareRecordForm } from './labTypes.ts';

export interface LabelOption<K extends string = string> {
  key: K;
  label: string;
}

export const CARE_FORM_SECTIONS: ReadonlyArray<LabelOption<CareFormSectionKey>> = [
  { key: 'PHYSICAL', label: '신체활동지원' },
  { key: 'COGNITIVE', label: '인지관리 및 의사소통' },
  { key: 'HEALTH', label: '건강 및 간호관리' },
  { key: 'REHAB', label: '기능회복훈련' },
];

export const BATH_METHODS: ReadonlyArray<LabelOption<'FULL' | 'SHOWER'>> = [
  { key: 'FULL', label: '전신입욕' },
  { key: 'SHOWER', label: '샤워식' },
];

export const MEAL_KINDS: ReadonlyArray<LabelOption<'NORMAL' | 'PORRIDGE' | 'LIQUID'>> = [
  { key: 'NORMAL', label: '일반식' },
  { key: 'PORRIDGE', label: '죽' },
  { key: 'LIQUID', label: '유동식(미음)' },
];

export const MEAL_INTAKES: ReadonlyArray<LabelOption<'FULL' | 'HALF_OR_MORE' | 'LESS_THAN_HALF'>> = [
  { key: 'FULL', label: '1' },
  { key: 'HALF_OR_MORE', label: '1/2 이상' },
  { key: 'LESS_THAN_HALF', label: '1/2 미만' },
];

/** 사유 종류별 이름과 근거 — 화면 칩·인쇄에 쓴다 */
export const CARE_FORM_REASONS: ReadonlyArray<LabelOption<CareFormReasonKind> & { basis: string }> = [
  { key: 'AFTER_MIDNIGHT', label: '24시 이후 연속 보호 사유', basis: '고시 제30조④' },
  { key: 'OVER_13H', label: '13시간 초과 제공의 동의 내용·요청 사유', basis: '고시 제30조⑧' },
  { key: 'UNUSED_DAY', label: '미이용일 사유', basis: '고시 제32조③' },
  { key: 'COG_PROGRAM_MISSED', label: '인지활동형 프로그램 미제공 사유', basis: '고시 제32조⑩⑪' },
];

/** 모든 칸이 null·false인 빈 서식. writers는 네 영역 모두 null, reasons는 빈 배열. */
export function emptyCareForm(): CareRecordForm {
  return {
    startTime: null,
    endTime: null,
    transport: false,
    vehicleNo: null,
    washHelp: false,
    bathMinutes: null,
    bathMethod: null,
    mealKind: null,
    mealIntake: null,
    toiletCount: null,
    mobilityHelp: false,
    cogSupport: false,
    commHelp: false,
    bpSystolic: null,
    bpDiastolic: null,
    temperature: null,
    healthCareMinutes: null,
    nursingCareMinutes: null,
    emergency: false,
    programNames: null,
    rehabPhysical: false,
    rehabCogActivity: false,
    rehabCogTraining: false,
    rehabPtOt: false,
    writers: { PHYSICAL: null, COGNITIVE: null, HEALTH: null, REHAB: null },
    reasons: [],
  };
}

const present = (value: string | null | undefined): boolean => typeof value === 'string' && value.trim() !== '';
const positive = (value: number | null | undefined): boolean => typeof value === 'number' && value > 0;

/** 'HH:mm:ss'로 내려와도 'HH:mm'으로 본다(서버 시간 칸 모양이 바뀌어도 계산이 조용히 null이 되지 않게). */
function hm(value: string | null | undefined): string | null | undefined {
  return typeof value === 'string' && /^\d{2}:\d{2}:\d{2}$/.test(value) ? value.slice(0, 5) : value;
}

export interface CareMinutes {
  minutes: number;
  crossesMidnight: boolean;
  /** 780분(13시간)을 넘을 때만 true — 정확히 780분은 아니다 */
  over13h: boolean;
}

/**
 * 이용 시작·종료 시각('HH:mm')으로 총 이용 분. 종료가 시작보다 빠르면 다음 날로 본다.
 * 한쪽이 없거나 형식이 틀리거나 같은 시각이면 null(0분도 24시간도 아닌 "알 수 없음").
 */
export function careRecordMinutes(startHm: string | null | undefined, endHm: string | null | undefined): CareMinutes | null {
  const start = timeToMinutes(hm(startHm));
  const end = timeToMinutes(hm(endHm));
  if (start === null || end === null || start === end) return null;
  const crossesMidnight = end < start;
  const minutes = crossesMidnight ? end + 1440 - start : end - start;
  return { minutes, crossesMidnight, over13h: minutes > 780 };
}

export type CareFormProblem =
  | 'TIME_PAIR_MISSING'
  | 'VEHICLE_MISSING'
  | 'BATH_METHOD_MISSING'
  | 'BATH_MINUTES_MISSING'
  | 'MEAL_INTAKE_MISSING'
  | 'MEAL_KIND_MISSING'
  | 'BP_PAIR_MISSING';

export const CARE_FORM_PROBLEM_LABEL: Readonly<Record<CareFormProblem, string>> = {
  TIME_PAIR_MISSING: '이용 시작·종료 시각 중 하나만 적혀 있습니다',
  VEHICLE_MISSING: '송영을 이용했는데 차량번호가 비어 있습니다',
  BATH_METHOD_MISSING: '목욕 시간은 있는데 목욕 방법(전신입욕·샤워식)이 없습니다',
  BATH_MINUTES_MISSING: '목욕 방법은 있는데 목욕 시간(분)이 없습니다',
  MEAL_INTAKE_MISSING: '식사 종류는 있는데 섭취량이 없습니다',
  MEAL_KIND_MISSING: '식사 섭취량은 있는데 식사 종류가 없습니다',
  BP_PAIR_MISSING: '혈압은 수축기·이완기를 함께 적어야 합니다',
};

/** 서식 칸 사이의 짝 점검. 문제 코드를 정해진 순서로 돌려준다(없으면 빈 배열). */
export function validateCareForm(form: CareRecordForm): CareFormProblem[] {
  const out: CareFormProblem[] = [];
  if (present(form.startTime) !== present(form.endTime)) out.push('TIME_PAIR_MISSING');
  if (form.transport && !present(form.vehicleNo)) out.push('VEHICLE_MISSING');
  if (positive(form.bathMinutes) && !form.bathMethod) out.push('BATH_METHOD_MISSING');
  if (form.bathMethod && !positive(form.bathMinutes)) out.push('BATH_MINUTES_MISSING');
  if (form.mealKind && !form.mealIntake) out.push('MEAL_INTAKE_MISSING');
  if (form.mealIntake && !form.mealKind) out.push('MEAL_KIND_MISSING');
  if ((form.bpSystolic == null) !== (form.bpDiastolic == null)) out.push('BP_PAIR_MISSING');
  return out;
}

/** 영역 채움 판단에 쓰는 서술 칸 — CareRecord의 일부만 있으면 된다. */
export interface CareRecordTexts {
  physical?: string | null;
  cognitive?: string | null;
  meal?: string | null;
  toilet?: string | null;
  bath?: string | null;
  nursing?: string | null;
  training?: string | null;
}

/** 그 영역에 체크·분·선택지 또는 서술 중 하나라도 채워졌는가(공백만 있는 서술은 빈 것). */
export function sectionFilled(form: CareRecordForm, record: CareRecordTexts | null | undefined, section: CareFormSectionKey): boolean {
  const text = (key: keyof CareRecordTexts) => present(record?.[key]);
  switch (section) {
    case 'PHYSICAL':
      return (
        form.washHelp ||
        form.mobilityHelp ||
        positive(form.bathMinutes) ||
        !!form.bathMethod ||
        !!form.mealKind ||
        !!form.mealIntake ||
        form.toiletCount != null ||
        text('physical') ||
        text('meal') ||
        text('toilet') ||
        text('bath')
      );
    case 'COGNITIVE':
      return form.cogSupport || form.commHelp || text('cognitive');
    case 'HEALTH':
      return (
        form.bpSystolic != null ||
        form.bpDiastolic != null ||
        form.temperature != null ||
        positive(form.healthCareMinutes) ||
        positive(form.nursingCareMinutes) ||
        form.emergency ||
        text('nursing')
      );
    case 'REHAB':
      return present(form.programNames) || form.rehabPhysical || form.rehabCogActivity || form.rehabCogTraining || form.rehabPtOt || text('training');
  }
}

/** 채워진 영역인데 제공 직원(작성자)이 비어 있는 영역 — 유의사항 7(영역마다 제공한 종사자가 서명). CARE_FORM_SECTIONS 순서. */
export function writersMissing(form: CareRecordForm, record: CareRecordTexts | null | undefined): CareFormSectionKey[] {
  return CARE_FORM_SECTIONS.map((s) => s.key).filter((key) => sectionFilled(form, record, key) && form.writers?.[key] == null);
}

export interface CareReasonContext {
  /** 그날이 미이용일(월 15일 이상 계약 수급자가 본인 사정으로 쉰 날)로 급여비용을 산정하는가 */
  unusedDay: boolean;
  /** 5등급·인지지원이라 그날 인지활동형 프로그램이 필요한가 */
  cognitiveRequired: boolean;
  /** 그날 인지활동형 프로그램(60분 이상·허용 제공자)을 받았는가 */
  cognitiveCovered: boolean;
}

/** 지금 상태에서 기록지에 사유를 적어야 하는 종류. 자정 넘김 → 13시간 초과 → 미이용일 → 인지활동형 누락 순서. */
export function reasonsRequired(form: CareRecordForm, ctx: CareReasonContext): CareFormReasonKind[] {
  const span = careRecordMinutes(form.startTime, form.endTime);
  const out: CareFormReasonKind[] = [];
  if (span?.crossesMidnight) out.push('AFTER_MIDNIGHT');
  if (span?.over13h) out.push('OVER_13H');
  if (ctx.unusedDay) out.push('UNUSED_DAY');
  if (ctx.cognitiveRequired && !ctx.cognitiveCovered) out.push('COG_PROGRAM_MISSED');
  return out;
}

/** 요구되는 사유 중 글이 적히지 않은 것(빈칸·공백은 없는 것으로 본다). */
export function reasonsMissing(form: CareRecordForm, ctx: CareReasonContext): CareFormReasonKind[] {
  const written = new Set((form.reasons ?? []).filter((r) => present(r.text)).map((r) => r.kind));
  return reasonsRequired(form, ctx).filter((kind) => !written.has(kind));
}

/** 인쇄 장 나누기: 날짜 오름차순으로 정렬해 3개씩 묶는다(서식 한 장 = 이용일 3칸). 같은 날짜는 한 번만, 입력 배열은 바꾸지 않는다. */
export function printSheets(dates: readonly string[]): string[][] {
  const sorted = Array.from(new Set(dates.filter((d) => parseYmd(d) !== null))).sort();
  const sheets: string[][] = [];
  for (let i = 0; i < sorted.length; i += 3) sheets.push(sorted.slice(i, i + 3));
  return sheets;
}

/** 서식 칸이 하나도 채워지지 않았는가 — 저장할 때 빈 서식은 null로 보내 "서식 없음"과 구분하기 위해 쓴다. */
export function isCareFormEmpty(form: CareRecordForm): boolean {
  const base = emptyCareForm();
  const { writers, reasons, ...rest } = form;
  const { writers: _w, reasons: _r, ...baseRest } = base;
  void _w;
  void _r;
  const scalarsEmpty = (Object.keys(baseRest) as Array<keyof typeof baseRest>).every((k) => {
    const v = rest[k];
    return v == null || v === false || (typeof v === 'string' && v.trim() === '');
  });
  const noWriters = Object.values(writers ?? {}).every((v) => v == null);
  return scalarsEmpty && noWriters && (reasons ?? []).length === 0;
}

/** care-record AI가 제안하는 서식 칸 키 열두 개 */
export const AI_FORM_KEYS = ['washHelp', 'bathMinutes', 'bathMethod', 'mealKind', 'mealIntake', 'toiletCount', 'mobilityHelp', 'cogSupport', 'commHelp', 'bpSystolic', 'bpDiastolic', 'temperature'] as const;
export type AiFormKey = (typeof AI_FORM_KEYS)[number];

/**
 * AI 제안을 현재 서식의 빈 칸에만 넣는다. 이미 사람이 채운(null·false가 아닌) 칸은 덮지 않는다.
 * 혈압은 짝이라 한 칸이라도 채워져 있으면 둘 다 건드리지 않는다. 넣은 칸 이름을 filled로 돌려줘 화면이 'AI 제안' 표시를 붙인다.
 */
export function applyAiForm(form: CareRecordForm, ai: Pick<CareRecordForm, AiFormKey> | null | undefined): { form: CareRecordForm; filled: AiFormKey[] } {
  const next: CareRecordForm = { ...form, writers: { ...form.writers }, reasons: [...form.reasons] };
  const filled: AiFormKey[] = [];
  if (!ai) return { form: next, filled };
  const isEmpty = (v: unknown) => v == null || v === false;
  const set = <K extends AiFormKey>(key: K) => {
    const value = ai[key];
    if (isEmpty(value) || !isEmpty(next[key])) return;
    (next as unknown as Record<string, unknown>)[key] = value;
    filled.push(key);
  };
  for (const key of AI_FORM_KEYS) {
    if (key === 'bpSystolic' || key === 'bpDiastolic') continue;
    set(key);
  }
  if (ai.bpSystolic != null && ai.bpDiastolic != null && next.bpSystolic == null && next.bpDiastolic == null) {
    next.bpSystolic = ai.bpSystolic;
    next.bpDiastolic = ai.bpDiastolic;
    filled.push('bpSystolic', 'bpDiastolic');
  }
  return { form: next, filled };
}
