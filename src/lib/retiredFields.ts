import type { FormFieldSchema, FormSchema } from '@/types/formSchema';

/**
 * 양식에서 지운 항목과, 지난 문서에 그 항목으로 써 둔 내용(2026-11-16).
 *
 * 업무일지 양식에서 '행정 업무'를 복제한 뒤 원래 항목을 지우자 지난 업무일지 228건의 본문이
 * 화면에서 사라졌다. 내용은 문서(formData)에 그대로 있었다 — 문서 화면이 지금 양식의 항목만
 * 그려서, 지운 항목 id로 저장된 값을 건너뛴 것이다. 결재 문서는 기록이라 쓴 것은 다 보여야 한다.
 *
 * - 양식을 고쳐 저장할 때 지운 항목의 이름·종류를 `retiredFields`에 남긴다([withRetiredFields]).
 *   `fields`가 아닌 따로 된 칸이라 작성 화면·빈 서식·옛 앱은 이것을 모르고 지나간다.
 * - 문서를 볼 때 지금 양식에 없는 값은 맨 아래 '이전 양식 항목'으로 그린다([orphanEntries]).
 *   이름은 retiredFields → (그 전에 지운 것은) 기본 양식 사전 → 그것도 없으면 '이전 항목'.
 */

/** 양식 빌더 genId()가 만든 항목 id(시각+난수 36진수) — 사람이 읽을 이름이 아니다 */
const GENERATED_ID = /^[0-9a-z]{16,}$/;

export function isGeneratedFieldId(key: string): boolean {
  return GENERATED_ID.test(key);
}

/** 비었는지 — 빈 글자, 빈 목록, 빈 줄만 있는 반복 항목, 값이 다 빈 객체 */
export function isEmptyFormValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.every(isEmptyFormValue);
  if (typeof value === 'object') return Object.values(value as Record<string, unknown>).every(isEmptyFormValue);
  return false;
}

/** 항목 하나가 formData에 쓰는 키 — 기간은 `{id}_start`·`{id}_end`로 펴서 저장된다 */
function storageKeys(field: Pick<FormFieldSchema, 'id' | 'type'>): string[] {
  return field.type === 'dateRange' ? [field.id, `${field.id}_start`, `${field.id}_end`] : [field.id];
}

/** 지운 항목을 남길 때는 값을 읽는 데 필요한 것만 */
function compact(field: FormFieldSchema): FormFieldSchema {
  const kept: FormFieldSchema = { id: field.id, type: field.type, label: field.label, required: false };
  if (field.options?.length) kept.options = field.options.map((o) => ({ label: o.label, value: o.value }));
  if (field.repeater) kept.repeater = { fields: field.repeater.fields.map(compact) };
  if (field.computed?.unit) kept.computed = { operation: field.computed.operation, unit: field.computed.unit };
  return kept;
}

/**
 * 고친 양식([next])에 지운 항목을 남긴다 — [previous]는 고치기 전 저장돼 있던 양식.
 * 다시 넣은 항목(같은 id)은 빼고, 구역 제목은 값이 없으니 남기지 않는다.
 */
export function withRetiredFields(next: FormSchema, previous?: FormSchema | null): FormSchema {
  const live = new Set(next.fields.map((f) => f.id));
  const retired = new Map<string, FormFieldSchema>();
  const keep = (field: FormFieldSchema | undefined) => {
    if (!field?.id || field.type === 'section' || live.has(field.id) || retired.has(field.id)) return;
    retired.set(field.id, compact(field));
  };
  (previous?.retiredFields ?? []).forEach(keep);
  (next.retiredFields ?? []).forEach(keep);
  (previous?.fields ?? []).forEach(keep);

  const rest = withoutRetiredFields(next);
  return retired.size > 0 ? { ...rest, retiredFields: [...retired.values()] } : rest;
}

/** 새 양식으로 만들 때 — 다른 양식에서 불러온 '지운 항목'은 이 양식 문서와 상관없다 */
export function withoutRetiredFields(schema: FormSchema): FormSchema {
  const rest = { ...schema };
  delete rest.retiredFields;
  return rest;
}

export interface OrphanEntry {
  /** formData 키(기간은 `_start`·`_end`를 뗀 항목 id) */
  key: string;
  /** 지운 항목 정보 — 있으면 이 이름·종류로 그린다. 없으면 이름을 사전에서 찾는다 */
  field?: FormFieldSchema;
}

/**
 * 지금 양식에 없는 항목에 써 둔 값 — 값이 있는 것만, 지운 항목 순서 → 저장된 순서.
 */
export function orphanEntries(schema: FormSchema, formData: Record<string, unknown> | null | undefined): OrphanEntry[] {
  if (!formData) return [];
  const used = new Set(schema.fields.flatMap(storageKeys));
  const entries: OrphanEntry[] = [];

  for (const field of schema.retiredFields ?? []) {
    if (used.has(field.id)) continue;
    const keys = storageKeys(field);
    keys.forEach((k) => used.add(k));
    if (keys.every((k) => isEmptyFormValue(formData[k]))) continue;
    entries.push({ key: field.id, field });
  }

  for (const [key, value] of Object.entries(formData)) {
    if (used.has(key)) continue;
    // 이름 모르는 기간 — 시작·끝이 둘 다 있으면 한 줄로 묶는다
    const range = /^(.+)_(start|end)$/.exec(key);
    if (range && `${range[1]}_start` in formData && `${range[1]}_end` in formData) {
      const id = range[1];
      const keys = [`${id}_start`, `${id}_end`];
      keys.forEach((k) => used.add(k));
      if (keys.every((k) => isEmptyFormValue(formData[k]))) continue;
      entries.push({ key: id, field: { id, type: 'dateRange', label: '', required: false } });
      continue;
    }
    used.add(key);
    if (isEmptyFormValue(value)) continue;
    entries.push({ key });
  }
  return entries;
}

/** '이전 기안 불러오기'처럼 다른 문서 내용을 새 문서로 옮길 때 — 지금 양식에 있는 항목 값만 */
export function pickLiveFormData(
  schema: FormSchema | null | undefined,
  formData: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!formData || !schema) return formData;
  const live = new Set(schema.fields.flatMap(storageKeys));
  return Object.fromEntries(Object.entries(formData).filter(([key]) => live.has(key)));
}
