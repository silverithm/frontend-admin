/**
 * 폼 필드 id·옵션 값을 한글 라벨로 되돌리는 사전.
 *
 * 문서를 볼 때는 보통 저장된 스키마로 라벨을 그린다. 그런데 양식이 삭제됐거나
 * 스키마 없이 저장된 문서는 폴백 화면이 뜨는데, 여기서 'leave-type', 'half-am'
 * 같은 내부 키가 그대로 보였다. 기본 제공 양식(프리셋)에 이미 한글 라벨이
 * 정의돼 있으므로 그것을 역으로 참조해 최대한 사람이 읽을 수 있게 바꾼다.
 *
 * 프리셋에 없는 사용자 정의 필드는 하이픈·언더스코어만 공백으로 풀어 보여준다.
 */

import { formPresets } from './formTemplatePresets';
import type { FormFieldSchema } from '@/types/formSchema';

const fieldLabels = new Map<string, string>();
/** `${fieldId}:${optionValue}` → 옵션 라벨 */
const optionLabels = new Map<string, string>();
/** 필드 id를 모르는 상태에서 값만으로 찾을 때 쓰는 보조 사전 */
const valueLabels = new Map<string, string>();
/** 양식에 정의된 순서 — 저장 순서대로 나오면 뒤죽박죽이라 원래 순서로 되돌린다 */
const fieldOrder = new Map<string, number>();

function collect(fields: FormFieldSchema[]) {
  for (const field of fields) {
    if (field.id && field.label && !fieldLabels.has(field.id)) {
      fieldLabels.set(field.id, field.label);
    }
    if (field.id && !fieldOrder.has(field.id)) {
      fieldOrder.set(field.id, fieldOrder.size);
    }
    for (const option of field.options ?? []) {
      const key = `${field.id}:${option.value}`;
      if (!optionLabels.has(key)) optionLabels.set(key, option.label);
      if (!valueLabels.has(option.value)) valueLabels.set(option.value, option.label);
    }
    if (field.repeater?.fields?.length) {
      collect(field.repeater.fields);
    }
  }
}

for (const preset of formPresets) {
  collect(preset.schema.fields);
}

/**
 * 저장된 formData를 양식에 정의된 순서로 정렬한다.
 * 저장 순서 그대로 두면 '사유 → 종료일 → 휴가 유형' 처럼 뒤섞여 보인다.
 * 양식에 없는 키는 뒤로 밀고 원래 순서를 유지한다.
 */
export function sortFormEntries(formData: Record<string, unknown>): [string, unknown][] {
  const entries = Object.entries(formData);
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      const oa = fieldOrder.get(a.entry[0]) ?? Number.MAX_SAFE_INTEGER;
      const ob = fieldOrder.get(b.entry[0]) ?? Number.MAX_SAFE_INTEGER;
      return oa !== ob ? oa - ob : a.index - b.index;
    })
    .map(({ entry }) => entry);
}

/** 필드 키를 한글 라벨로. 모르는 키는 하이픈·언더스코어를 공백으로 푼다. */
export function getFieldLabel(key: string): string {
  const known = fieldLabels.get(key);
  if (known) return known;
  return key.replace(/[-_]/g, ' ').trim() || key;
}

/**
 * 저장된 값을 한글로. select/radio의 옵션 값(`half-am` → `반차(오전)`)을 되돌리고,
 * 배열(체크박스·다중선택)은 쉼표로 잇는다. 그 밖의 값은 문자열로 그대로 둔다.
 */
export function getValueLabel(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';

  if (Array.isArray(value)) {
    const labels = value.map((v) => getValueLabel(key, v)).filter((v) => v !== '-');
    return labels.length > 0 ? labels.join(', ') : '-';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  const raw = String(value);
  return optionLabels.get(`${key}:${raw}`) ?? valueLabels.get(raw) ?? raw;
}
