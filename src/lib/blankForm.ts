/**
 * 빈 서식 인쇄 — 온라인 양식을 종이에 손으로 채울 수 있게 칸마다 쓸 자리를 정한다.
 *
 * 2026-11-11 버그제보방(숲속 사무직) "결재 서식을 인쇄하여 쓸 수 있게 해주세요".
 * 제출한 문서의 인쇄는 이미 있었지만, 빈 양식을 찍으면 칸마다 '-'가 나오고
 * 고르는 칸은 보기 없이 '-'만 남아 종이 서식으로 쓸 수 없었다.
 *
 * 여기서는 칸 종류 → 종이에 그릴 모양만 정한다. 그리는 건 BlankFormDocument.
 */
import type { FormFieldSchema, FormSchema } from '@/types/formSchema';

export type BlankCell =
  /** 한 줄 쓸 자리 (글·숫자·첨부) */
  | { kind: 'line' }
  /** 여러 줄 쓸 자리 (긴 글·사진) */
  | { kind: 'box'; lines: number }
  /** '　　년　　월　　일' */
  | { kind: 'date' }
  /** '　　년　　월　　일 ~ 　　년　　월　　일' */
  | { kind: 'dateRange' }
  /** □ 보기 목록 — 하나만 고르는 칸도 종이에서는 표시해서 고른다 */
  | { kind: 'choices'; options: string[] }
  /** 빈칸 뒤에 단위 (자동 합계 등) */
  | { kind: 'unit'; unit: string }
  /** 반복 항목 — 열 머리와 빈 줄 */
  | { kind: 'table'; columns: string[]; rows: number };

/** 긴 글 칸 줄 수 — 넷이면 손글씨로 두세 문장이 들어간다 */
export const BLANK_TEXTAREA_LINES = 4;
/** 반쪽 이하 폭의 긴 글 칸 — 어르신마다 한 칸씩 둔 보고서(84칸)가 종이를 너무 먹지 않게 한 줄 줄인다 */
export const BLANK_NARROW_TEXTAREA_LINES = 3;
/** 사진 칸 줄 수 — 명함판 사진을 붙일 만한 높이 */
export const BLANK_IMAGE_LINES = 6;
/** 반복 항목 기본 빈 줄 수 */
export const BLANK_REPEATER_ROWS = 5;

/** 반복 항목에 그릴 빈 줄 수 — 기본 다섯 줄, 양식이 정한 최소·최대가 있으면 그 안에서 */
export function blankRepeaterRows(field: FormFieldSchema): number {
  const min = field.repeater?.minRows ?? 0;
  const max = field.repeater?.maxRows;
  let rows = Math.max(BLANK_REPEATER_ROWS, min);
  if (typeof max === 'number' && max > 0) rows = Math.min(rows, max);
  return Math.max(rows, 1);
}

function optionLabels(field: FormFieldSchema): string[] {
  return (field.options ?? [])
    .map((option) => String(option?.label ?? option?.value ?? '').trim())
    .filter((label) => label.length > 0);
}

export function blankCellFor(field: FormFieldSchema): BlankCell {
  switch (field.type) {
    case 'textarea':
      return {
        kind: 'box',
        lines: !field.width || field.width === 'full' || field.width === 'twoThirds'
          ? BLANK_TEXTAREA_LINES
          : BLANK_NARROW_TEXTAREA_LINES,
      };
    case 'image':
      return { kind: 'box', lines: BLANK_IMAGE_LINES };
    case 'date':
      return { kind: 'date' };
    case 'dateRange':
      return { kind: 'dateRange' };
    case 'select':
    case 'radio':
    case 'checkbox': {
      const options = optionLabels(field);
      return options.length > 0 ? { kind: 'choices', options } : { kind: 'line' };
    }
    case 'computed': {
      const unit = field.computed?.unit?.trim();
      return unit ? { kind: 'unit', unit } : { kind: 'line' };
    }
    case 'repeater': {
      const columns = (field.repeater?.fields ?? [])
        .filter((col): col is FormFieldSchema => Boolean(col))
        .map((col) => String(col.label ?? ''));
      return columns.length > 0
        ? { kind: 'table', columns, rows: blankRepeaterRows(field) }
        : { kind: 'box', lines: BLANK_TEXTAREA_LINES };
    }
    default:
      return { kind: 'line' };
  }
}

/** 백엔드는 formSchema를 JSON 문자열로 줄 때가 있다 — 칸이 하나라도 있는 스키마만 돌려준다 */
export function parseFormSchema(raw: unknown): FormSchema | undefined {
  if (!raw) return undefined;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const rawFields = (parsed as { fields?: unknown })?.fields;
    if (!Array.isArray(rawFields)) return undefined;
    // 깨진 칸(null 등)이 섞여 있어도 그리다 멈추지 않게 걸러 낸다
    const fields = rawFields.filter(
      (field): field is FormFieldSchema => Boolean(field) && typeof (field as FormFieldSchema).type === 'string',
    );
    return fields.some((field) => field.type !== 'section')
      ? { ...(parsed as FormSchema), fields }
      : undefined;
  } catch {
    return undefined;
  }
}

/** 빈 서식을 찍을 수 있는 양식인지 — 화면에서 채우는 칸이 있는 온라인·혼합 양식 */
export function canPrintBlankForm(template: { templateType?: string | null; formSchema?: unknown }): boolean {
  if (template.templateType !== 'form' && template.templateType !== 'hybrid') return false;
  return parseFormSchema(template.formSchema) !== undefined;
}

/**
 * 결재란 머리 — 첫 칸은 기안, 기본 결재선이 있으면 그 단계 수만큼(마지막이 결재, 그 앞은 검토).
 * 기본 결재선이 없는 양식은 흔히 쓰는 기안·검토·결재 세 칸으로 둔다.
 */
export function blankApprovalHeaders(stepCount: number): string[] {
  if (stepCount <= 0) return ['기안', '검토', '결재'];
  return ['기안', ...Array.from({ length: stepCount }, (_, index) => (index === stepCount - 1 ? '결재' : '검토'))];
}
