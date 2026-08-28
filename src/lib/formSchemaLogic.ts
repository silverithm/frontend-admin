// 전자결재 폼의 순수 로직.
// 렌더러/미리보기/제출문서 뷰어가 같은 규칙을 쓰도록 한곳에 모은다.

import {
  FormSchema,
  FormFieldSchema,
  FieldWidth,
  FIELD_WIDTH_SPAN,
  VisibilityRule,
  ComputedConfig,
} from '@/types/formSchema';

/** 폼 값 저장 구조
 *  - 일반 필드      : values[fieldId] = value
 *  - dateRange     : values[`${id}_start`], values[`${id}_end`]
 *  - repeater      : values[fieldId] = [{ subFieldId: value, ... }, ...]
 *  - computed      : 계산 결과를 제출 시점에 스냅샷으로 저장
 */
export type FormValues = Record<string, any>;

export function getFieldSpan(width?: FieldWidth): number {
  return FIELD_WIDTH_SPAN[width ?? 'full'] ?? 12;
}

function toNumber(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** 조건 하나를 평가한다 */
function evaluateCondition(
  condition: { fieldId: string; operator: string; value?: string },
  values: FormValues
): boolean {
  const raw = values[condition.fieldId];
  const asArray = Array.isArray(raw) ? raw : null;
  const isEmpty =
    raw === '' || raw === null || raw === undefined || (asArray !== null && asArray.length === 0);

  switch (condition.operator) {
    case 'isEmpty':
      return isEmpty;
    case 'isNotEmpty':
      return !isEmpty;
    case 'equals':
      return asArray ? asArray.includes(condition.value) : String(raw ?? '') === String(condition.value ?? '');
    case 'notEquals':
      return asArray
        ? !asArray.includes(condition.value)
        : String(raw ?? '') !== String(condition.value ?? '');
    case 'contains':
      return asArray
        ? asArray.some((v) => String(v).includes(String(condition.value ?? '')))
        : String(raw ?? '').includes(String(condition.value ?? ''));
    default:
      return true;
  }
}

/** 조건부 표시 규칙에 따라 이 필드를 지금 보여줘야 하는지 */
export function isFieldVisible(field: FormFieldSchema, values: FormValues): boolean {
  const rule: VisibilityRule | undefined = field.visibleWhen;
  if (!rule || !rule.conditions || rule.conditions.length === 0) return true;

  const results = rule.conditions.map((c) => evaluateCondition(c, values));
  return rule.match === 'any' ? results.some(Boolean) : results.every(Boolean);
}

/** 계산 필드의 현재 값 */
export function computeFieldValue(
  config: ComputedConfig | undefined,
  values: FormValues
): number | null {
  if (!config) return null;

  const numbers: number[] = [];

  // 1) 일반 숫자 필드 집계
  (config.sourceFieldIds ?? []).forEach((id) => {
    const n = toNumber(values[id]);
    if (n !== null) numbers.push(n);
  });

  // 2) 반복 그룹의 특정 컬럼을 행 전체에 대해 집계
  if (config.sourceRepeaterId && config.sourceRepeaterFieldId) {
    const rows = values[config.sourceRepeaterId];
    if (Array.isArray(rows)) {
      rows.forEach((row) => {
        const n = toNumber(row?.[config.sourceRepeaterFieldId as string]);
        if (n !== null) numbers.push(n);
      });
    }
  }

  if (config.operation === 'count') {
    return numbers.length;
  }
  if (numbers.length === 0) return null;

  const total = numbers.reduce((acc, n) => acc + n, 0);
  if (config.operation === 'average') {
    return Math.round((total / numbers.length) * 100) / 100;
  }
  return total;
}

/** 계산 필드 값을 values에 반영한 새 객체를 돌려준다 (제출 스냅샷용) */
export function withComputedValues(schema: FormSchema, values: FormValues): FormValues {
  const next = { ...values };
  schema.fields.forEach((field) => {
    if (field.type !== 'computed') return;
    next[field.id] = computeFieldValue(field.computed, values);
  });
  return next;
}

/** 반복 그룹의 빈 행 하나 */
export function createEmptyRow(field: FormFieldSchema): Record<string, any> {
  const row: Record<string, any> = {};
  (field.repeater?.fields ?? []).forEach((sub) => {
    row[sub.id] = sub.type === 'checkbox' ? (sub.defaultValue ?? []) : (sub.defaultValue ?? '');
  });
  return row;
}

function isValueEmpty(value: unknown, type: string): boolean {
  if (type === 'file' || type === 'image') return !value;
  if (Array.isArray(value)) return value.length === 0;
  return value === '' || value === null || value === undefined;
}

function validateSingleField(
  field: FormFieldSchema,
  value: unknown,
  errors: Record<string, string>,
  keyPrefix = ''
) {
  const key = `${keyPrefix}${field.id}`;

  if (field.required && isValueEmpty(value, field.type)) {
    errors[key] = `${field.label}을(를) 입력해주세요.`;
    return;
  }

  if (field.type === 'number' && !isValueEmpty(value, field.type)) {
    const num = Number(value);
    if (field.validation?.min !== undefined && num < field.validation.min) {
      errors[key] = `최솟값은 ${field.validation.min}입니다.`;
    } else if (field.validation?.max !== undefined && num > field.validation.max) {
      errors[key] = `최댓값은 ${field.validation.max}입니다.`;
    }
  }

  if ((field.type === 'text' || field.type === 'textarea') && typeof value === 'string' && value.length > 0) {
    if (field.validation?.minLength !== undefined && value.length < field.validation.minLength) {
      errors[key] = `최소 ${field.validation.minLength}자 이상 입력해주세요.`;
    } else if (field.validation?.maxLength !== undefined && value.length > field.validation.maxLength) {
      errors[key] = `최대 ${field.validation.maxLength}자까지 입력 가능합니다.`;
    }
  }
}

/**
 * 폼 전체 검증.
 * 조건부로 숨겨진 필드는 검증하지 않는다 (보이지도 않는 항목 때문에 제출이 막히면 안 된다).
 */
export function validateForm(schema: FormSchema, values: FormValues): Record<string, string> {
  const errors: Record<string, string> = {};

  schema.fields.forEach((field) => {
    if (field.type === 'section' || field.type === 'computed') return;
    if (!isFieldVisible(field, values)) return;

    if (field.type === 'dateRange') {
      const startKey = `${field.id}_start`;
      const endKey = `${field.id}_end`;
      const start = values[startKey];
      const end = values[endKey];

      if (field.required) {
        if (!start) errors[startKey] = '시작일을 선택해주세요.';
        if (!end) errors[endKey] = '종료일을 선택해주세요.';
      }
      // 시작일이 종료일보다 뒤면 잘못된 입력이다
      if (start && end && String(start) > String(end)) {
        errors[endKey] = '종료일은 시작일보다 빠를 수 없습니다.';
      }
      return;
    }

    if (field.type === 'repeater') {
      const rows: any[] = Array.isArray(values[field.id]) ? values[field.id] : [];
      const minRows = field.repeater?.minRows ?? (field.required ? 1 : 0);

      if (rows.length < minRows) {
        errors[field.id] = `${field.label}을(를) 최소 ${minRows}개 입력해주세요.`;
        return;
      }

      rows.forEach((row, index) => {
        (field.repeater?.fields ?? []).forEach((sub) => {
          validateSingleField(sub, row?.[sub.id], errors, `${field.id}.${index}.`);
        });
      });
      return;
    }

    validateSingleField(field, values[field.id], errors);
  });

  return errors;
}

/** 계산 필드가 참조할 수 있는 숫자 필드 후보 */
export function getNumericFieldCandidates(
  schema: FormSchema,
  excludeId?: string
): { value: string; label: string }[] {
  return schema.fields
    .filter((f) => f.type === 'number' && f.id !== excludeId)
    .map((f) => ({ value: f.id, label: f.label || f.id }));
}

/** 조건부 표시가 참조할 수 있는 필드 후보 (선택형·입력형) */
export function getConditionFieldCandidates(
  schema: FormSchema,
  excludeId?: string
): { value: string; label: string }[] {
  return schema.fields
    .filter(
      (f) =>
        f.id !== excludeId &&
        f.type !== 'section' &&
        f.type !== 'computed' &&
        f.type !== 'repeater' &&
        f.type !== 'dateRange'
    )
    .map((f) => ({ value: f.id, label: f.label || f.id }));
}

/** 반복 그룹 후보 (계산 필드에서 참조) */
export function getRepeaterCandidates(schema: FormSchema): FormFieldSchema[] {
  return schema.fields.filter((f) => f.type === 'repeater');
}
