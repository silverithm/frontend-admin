/**
 * 급여제공기록 편집기의 법정 서식 칸(별지 제15호) 초안 — 칸 고치기, AI·프로그램 일지 제안 표시, 사유 칸, 점검 칩 계산.
 * 규칙은 lib/lab의 careRecordFormRules·cognitiveProgramRules를 그대로 쓰고, 여기는 화면 상태를 다루는 일만 한다.
 */
import { applyAiForm, emptyCareForm, reasonsMissing, reasonsRequired, validateCareForm, writersMissing } from '@/lib/lab/careRecordFormRules';
import type { AiFormKey, CareReasonContext, CareRecordTexts } from '@/lib/lab/careRecordFormRules';
import { cognitiveCoverage, cognitiveSessionsFor, isCognitiveRequiredGrade } from '@/lib/lab/cognitiveProgramRules';
import type { CareFormReasonKind, CareNoteForm, CareRecordForm, CareRecordFormView, Program } from '@/lib/lab/labTypes';

/** 화면 상태로 들고 다니는 서식 한 벌 */
export interface FormDraft {
  form: CareRecordFormView;
  /** AI가 채웠고 아직 사람이 손대지 않은 칸 */
  aiKeys: ReadonlyArray<AiFormKey>;
  /** 프로그램 일지에서 가져온 제안이 들어가 있는가 — 들어가기 전 값은 cogBase에 둔다 */
  cogSuggested: boolean;
  cogBase: { rehabCogActivity: boolean; programNames: string | null };
  /** '미이용일 기록'을 켰는가(월 15일 이상 계약 수급자가 본인 사정으로 쉰 날) */
  unusedDay: boolean;
}

export function formDraftFrom(form: CareRecordFormView | null): FormDraft {
  const base = form ?? emptyCareForm();
  return {
    form: { ...base, writers: { ...base.writers }, reasons: [...base.reasons] },
    aiKeys: [],
    cogSuggested: false,
    cogBase: { rehabCogActivity: false, programNames: null },
    unusedDay: (form?.reasons ?? []).some((r) => r.kind === 'UNUSED_DAY'),
  };
}

/** 'HH:mm:ss'로 내려와도 'HH:mm'으로 보여 준다 */
export const timeText = (value: string | null): string => (value ? value.slice(0, 5) : '');

/** 저장 전 변경 여부를 가를 때 쓰는 모양 — 프로그램 일지 제안은 사람이 한 변경이 아니므로 제안 전 값으로 되돌려 센다 */
export function formSnapshot(d: FormDraft): unknown {
  const form = d.cogSuggested ? { ...d.form, rehabCogActivity: d.cogBase.rehabCogActivity, programNames: d.cogBase.programNames } : d.form;
  return [form, d.unusedDay];
}

const trimNames = (names: string[]): string | null => (names.length === 0 ? null : names.join(', ').slice(0, 200));

/** 그날 이 어르신이 참여한 인지활동형 프로그램(프로그램 일지)에서 낸 제안 */
export function cogSuggestionOf(date: string, elderId: number, programs: readonly Program[]): { rehabCogActivity: true; programNames: string | null; count: number } | null {
  const sessions = cognitiveSessionsFor(date, elderId, programs);
  if (sessions.length === 0) return null;
  return { rehabCogActivity: true, programNames: trimNames(sessions.map((s) => s.title.trim()).filter(Boolean)), count: sessions.length };
}

/** 빈 칸에만 프로그램 일지 제안을 넣는다. 이미 사람이 쓴 칸이 있으면 그 칸은 건드리지 않는다. */
export function withCogSuggestion(d: FormDraft, suggestion: { rehabCogActivity: true; programNames: string | null }): FormDraft {
  const names = d.form.programNames;
  const fillNames = names === null || names.trim() === '';
  if (d.form.rehabCogActivity && !fillNames) return d;
  return {
    ...d,
    cogSuggested: true,
    cogBase: { rehabCogActivity: d.form.rehabCogActivity, programNames: names },
    form: { ...d.form, rehabCogActivity: true, programNames: fillNames ? suggestion.programNames : names },
  };
}

/** 프로그램 일지 제안을 빼고 제안 전 값으로 되돌린다 */
export function withoutCogSuggestion(d: FormDraft): FormDraft {
  if (!d.cogSuggested) return d;
  return { ...d, cogSuggested: false, form: { ...d.form, rehabCogActivity: d.cogBase.rehabCogActivity, programNames: d.cogBase.programNames } };
}

/** 칸을 고친다. 고친 칸은 더 이상 AI·프로그램 일지 제안이 아니다. */
export function patchForm(d: FormDraft, patch: Partial<CareRecordFormView>): FormDraft {
  const touched = new Set(Object.keys(patch));
  const cogTouched = touched.has('rehabCogActivity') || touched.has('programNames');
  return {
    ...d,
    form: { ...d.form, ...patch },
    aiKeys: d.aiKeys.filter((k) => !touched.has(k)),
    cogSuggested: cogTouched ? false : d.cogSuggested,
  };
}

/** AI 정리 결과의 서식 칸을 빈 칸에만 넣는다 */
export function withAiForm(d: FormDraft, ai: CareNoteForm): { draft: FormDraft; filled: number } {
  const { form, filled } = applyAiForm(d.form, ai);
  const keys = [...new Set([...d.aiKeys, ...filled])];
  return { draft: { ...d, form, aiKeys: keys }, filled: filled.length };
}

/** 사유 글을 넣거나(빈 글이면 그 사유를 뺀다) 고친다 */
export function setReasonText(d: FormDraft, kind: CareFormReasonKind, text: string): FormDraft {
  const others = d.form.reasons.filter((r) => r.kind !== kind);
  const reasons = text === '' ? others : [...others, { kind, text: text.slice(0, 300) }];
  return { ...d, form: { ...d.form, reasons } };
}

export interface FormContextInput {
  careGrade: string | null;
  date: string;
  elderId: number;
  /** 그날 결석으로 찍힌 어르신이면 true — 결석한 날은 인지활동형 점검 대상이 아니다 */
  absent: boolean;
  /** 그 달 프로그램 일지. 불러오지 못했거나 아직이면 null */
  programs: readonly Program[] | null;
}

/** reasonsRequired가 보는 ctx — 프로그램 일지를 못 읽었으면 "채웠는지 모름"이라 인지활동형 사유를 요구하지 않는다 */
export function reasonContext(d: FormDraft, input: FormContextInput): CareReasonContext {
  const required = isCognitiveRequiredGrade(input.careGrade) && !input.absent && input.programs !== null;
  const state = required ? cognitiveCoverage(input.date, [{ elderlyId: input.elderId, careGrade: input.careGrade }], input.programs ?? [])[0]?.state : 'OK';
  return { unusedDay: d.unusedDay, cognitiveRequired: required, cognitiveCovered: state === 'OK' };
}

export interface FormChecks {
  problems: ReturnType<typeof validateCareForm>;
  writers: ReturnType<typeof writersMissing>;
  required: CareFormReasonKind[];
  reasons: CareFormReasonKind[];
}

export function formChecks(form: CareRecordForm, texts: CareRecordTexts, ctx: CareReasonContext): FormChecks {
  return { problems: validateCareForm(form), writers: writersMissing(form, texts), required: reasonsRequired(form, ctx), reasons: reasonsMissing(form, ctx) };
}
