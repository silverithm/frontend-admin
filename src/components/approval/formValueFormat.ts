import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { FormFieldSchema } from '@/types/formSchema';
import { getFieldSpan } from '@/lib/formSchemaLogic';

/**
 * 폼 필드 값을 순수 문자열로 포맷한다 (공문 본문 표 등 텍스트 렌더링용).
 * FormDataViewer의 JSX 포맷과 동일한 규칙을 따르되 Badge/Link 없이 문자열만 반환한다.
 */
export function formatFieldValueText(
  field: FormFieldSchema,
  formData: Record<string, any>
): string {
  const value = resolveFieldValue(field, formData);

  if (value === null || value === undefined || value === '') {
    return '-';
  }

  switch (field.type) {
    case 'number': {
      const num = Number(value);
      if (isNaN(num)) return String(value);
      return new Intl.NumberFormat('ko-KR').format(num);
    }

    case 'date': {
      try {
        return format(new Date(value), 'yyyy년 MM월 dd일', { locale: ko });
      } catch {
        return String(value);
      }
    }

    case 'dateRange': {
      const start = value?.start || value?.startDate || '';
      const end = value?.end || value?.endDate || '';
      try {
        const startStr = start ? format(new Date(start), 'yyyy년 MM월 dd일', { locale: ko }) : '-';
        const endStr = end ? format(new Date(end), 'yyyy년 MM월 dd일', { locale: ko }) : '-';
        return `${startStr} ~ ${endStr}`;
      } catch {
        return `${start} ~ ${end}`;
      }
    }

    case 'select':
    case 'radio': {
      if (field.options) {
        const option = field.options.find((o) => o.value === value);
        if (option) return option.label;
      }
      return String(value);
    }

    case 'checkbox': {
      const selected: string[] = Array.isArray(value) ? value : [];
      if (selected.length === 0) return '-';
      return selected
        .map((v) => field.options?.find((o) => o.value === v)?.label ?? v)
        .join(', ');
    }

    case 'file': {
      return value?.fileName || value?.name || String(value);
    }

    case 'computed': {
      const num = Number(value);
      if (isNaN(num)) return String(value);
      const formatted = new Intl.NumberFormat('ko-KR').format(num);
      return field.computed?.unit ? `${formatted} ${field.computed.unit}` : formatted;
    }

    case 'repeater': {
      const rows: any[] = Array.isArray(value) ? value : [];
      if (rows.length === 0) return '-';
      const cols = field.repeater?.fields ?? [];
      return rows
        .map((row, i) => {
          const cells = cols
            .map((col) => `${col.label}: ${formatFieldValueText(col, row ?? {})}`)
            .join(', ');
          return `${i + 1}) ${cells}`;
        })
        .join('\n');
    }

    default:
      return String(value);
  }
}

/**
 * 필드 값 조회. FormRenderer는 dateRange를 `{id}_start`/`{id}_end`로 평탄화해 저장하므로
 * 객체 형태가 없으면 평탄화 키에서 복원한다.
 */
export function resolveFieldValue(field: FormFieldSchema, formData: Record<string, any>) {
  const direct = formData[field.id];
  if (field.type === 'dateRange' && (direct === null || direct === undefined)) {
    const start = formData[`${field.id}_start`];
    const end = formData[`${field.id}_end`];
    if (start || end) {
      return { start, end };
    }
  }
  return direct;
}

/**
 * half/full 폭을 고려해 필드를 행 단위로 그룹핑한다.
 * (FormDataViewer의 renderFields 로직을 공용화 — 동작 동일)
 */
export function groupFieldsIntoRows(fields: FormFieldSchema[]): FormFieldSchema[][] {
  const rows: FormFieldSchema[][] = [];
  let currentRow: FormFieldSchema[] = [];
  let usedSpan = 0;

  const flush = () => {
    if (currentRow.length > 0) {
      rows.push([...currentRow]);
      currentRow = [];
      usedSpan = 0;
    }
  };

  for (const field of fields) {
    // 구분선과 반복 항목은 항상 한 줄을 통째로 쓴다
    if (field.type === 'section' || field.type === 'repeater') {
      flush();
      rows.push([field]);
      continue;
    }

    const span = getFieldSpan(field.width);
    if (span >= 12) {
      flush();
      rows.push([field]);
      continue;
    }

    if (usedSpan + span > 12) {
      flush();
    }
    currentRow.push(field);
    usedSpan += span;
    if (usedSpan >= 12) {
      flush();
    }
  }

  flush();
  return rows;
}
