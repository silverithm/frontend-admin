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

/**
 * 문서 표의 한 행을 그릴 수 있는 단위로 쪼갠다.
 *
 * 예전에는 <table>이라 한 행에 최대 2필드(라벨+값 4셀)만 담을 수 있어 여기서 2개씩 잘랐고,
 * 그래서 1/3 세 개를 한 줄에 놓은 양식이 "둘 + 하나"로 밀려 내려갔다.
 * 지금은 행마다 독립된 grid로 그리므로 12칼럼에 들어가는 만큼 그대로 한 줄에 둔다.
 */
export function chunkRowForDocTable(row: FormFieldSchema[]): FormFieldSchema[][] {
  return [row];
}

/**
 * 한 행의 칸 폭(%)을 12칼럼 기준으로 계산한다.
 *
 * 라벨은 읽히는 최소 폭을 지켜야 해서 개수에 따라 줄이고(2개면 18%씩 — 예전과 같음),
 * 남는 자리를 각 필드의 span 비율대로 나눈다. 그래서 1/3은 1/2보다 실제로 좁게 나온다.
 * (예전에는 그 줄 안에서의 상대 비율로만 계산해 1/3+1/3과 1/2+1/2이 똑같이 보였다)
 */
export function docRowColumnTemplate(row: FormFieldSchema[]): string {
  const count = Math.max(row.length, 1);
  const labelPercent = Math.min(18, 44 / count);
  const valueTotal = 100 - labelPercent * count;
  const spans = row.map((field) => getFieldSpan(field.width));
  const spanTotal = spans.reduce((sum, span) => sum + span, 0) || 1;

  return row
    .map((_, index) => {
      const valuePercent = (valueTotal * spans[index]) / spanTotal;
      return `${labelPercent.toFixed(2)}% ${valuePercent.toFixed(2)}%`;
    })
    .join(' ');
}
