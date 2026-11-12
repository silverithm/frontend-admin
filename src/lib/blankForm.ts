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

/** 남는 종이에 줄을 더 그릴 때 표 한 개의 줄 수 상한 — 스무 줄이면 번호 칸이 두 자리로 끝난다 */
export const BLANK_REPEATER_ROWS_LIMIT = 20;

/**
 * 반복 항목에 그릴 빈 줄 수 — 기본 다섯 줄, 양식이 정한 최소·최대가 있으면 그 안에서.
 * extraLines: 종이가 남을 때 더 그릴 줄 수(blankExtraTableLines가 정한다). 양식의 최대 줄 수는 넘지 않는다.
 */
export function blankRepeaterRows(field: FormFieldSchema, extraLines = 0): number {
  const min = field.repeater?.minRows ?? 0;
  const max = field.repeater?.maxRows;
  let rows = Math.max(BLANK_REPEATER_ROWS, min);
  if (extraLines > 0) rows = Math.max(rows, Math.min(rows + extraLines, BLANK_REPEATER_ROWS_LIMIT));
  if (typeof max === 'number' && max > 0) rows = Math.min(rows, max);
  return Math.max(rows, 1);
}

function optionLabels(field: FormFieldSchema): string[] {
  return (field.options ?? [])
    .map((option) => String(option?.label ?? option?.value ?? '').trim())
    .filter((label) => label.length > 0);
}

export function blankCellFor(field: FormFieldSchema, extraTableLines = 0): BlankCell {
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
        ? { kind: 'table', columns, rows: blankRepeaterRows(field, extraTableLines) }
        : { kind: 'box', lines: BLANK_TEXTAREA_LINES };
    }
    default:
      return { kind: 'line' };
  }
}

/**
 * 한 장에 들어가는 서식은 종이 아래가 비지 않게 쓰는 칸을 늘린다 (2026-11-12 "쓰는 공간이 너무 적다").
 * 아래 값은 줄마다 '여기까지는 늘어나도 된다'는 높이(px, 96dpi) — 남는 종이는 한 줄 칸이 먼저
 * 이만큼 받고, 그러고도 남는 것은 긴 글 칸이 줄 수 비율로 나눠 갖는다.
 */
/** 한 줄 칸 — 약 15mm. 손글씨 한 줄이 편하게 들어간다 (기본 36px ≈ 9.5mm) */
export const BLANK_LINE_ROW_MAX = 56;
/** 사진 칸 — 약 7cm. 사진 한 장을 붙일 만한 높이 */
export const BLANK_IMAGE_ROW_MAX = 264;
/** 반복 항목 표의 한 줄 — 약 11.5mm (기본 28px) */
export const BLANK_TABLE_LINE_MAX = 44;
/** 반복 항목 표에서 빈 줄 말고 드는 높이 — 열 머리 24 + 칸 안쪽 여백·표 바깥 여백 20 */
const BLANK_TABLE_CHROME = 44;

/** 서식 한 줄이 받을 수 있는 높이 — 긴 글 칸이 있으면 남는 종이를 줄 수 비율로(flexLines), 없으면 maxPx까지 */
function blankRowStretch(row: FormFieldSchema[], extraTableLines = 0): { flexLines: number; maxPx: number } {
  let flexLines = 0;
  let maxPx = BLANK_LINE_ROW_MAX;
  for (const field of row) {
    const cell = blankCellFor(field, extraTableLines);
    if (cell.kind === 'table') {
      maxPx = Math.max(maxPx, BLANK_TABLE_CHROME + cell.rows * BLANK_TABLE_LINE_MAX);
    } else if (cell.kind === 'box') {
      if (field.type === 'image') maxPx = Math.max(maxPx, BLANK_IMAGE_ROW_MAX);
      else flexLines = Math.max(flexLines, cell.lines);
    }
  }
  return { flexLines, maxPx };
}

function isSectionRow(row: FormFieldSchema[]): boolean {
  return row.length === 1 && row[0].type === 'section';
}

/**
 * 서식 한 줄이 종이에서 늘어날 수 있는 범위 — grid-template-rows의 트랙 한 개.
 * 내용이 상한보다 길면(보기가 여러 줄로 넘어간 칸 등) 내용 높이가 이긴다 — 그래서 아래 한계가 auto가 아니라
 * min-content다. minmax(auto, 56px)에서는 auto가 상한(56px)에 눌려 줄이 내용보다 낮아지고 글자가 아래 줄을 덮는다.
 */
export function blankRowTrack(row: FormFieldSchema[], extraTableLines = 0): string {
  // 구역 제목은 늘리지 않는다
  if (isSectionRow(row)) return 'auto';
  const { flexLines, maxPx } = blankRowStretch(row, extraTableLines);
  return flexLines > 0 ? `minmax(min-content, ${flexLines}fr)` : `minmax(min-content, ${maxPx}px)`;
}

/** 서식 전체의 줄 트랙 — BlankFormDocument가 칸 묶음에 그대로 건다 */
export function blankRowTracks(rows: FormFieldSchema[][], extraTableLines = 0): string {
  return rows.map((row) => blankRowTrack(row, extraTableLines)).join(' ');
}

/**
 * 인쇄 용지에서 서식이 차지할 수 있는 높이(px) — A4 297mm − 위아래 여백 30mm − 반올림 여유 1mm.
 * globals.css의 `.carev-doc-page { min-height: 266mm }`(인쇄)와 같은 값이어야 한다.
 */
export const BLANK_PAGE_CONTENT_HEIGHT = (266 * 96) / 25.4;
/** 인쇄 용지의 서식 폭(px) — A4 210mm − 좌우 여백 30mm. 화면 밖에서 잴 때 이 폭으로 그려야 줄바꿈이 같다 */
export const BLANK_PAGE_CONTENT_WIDTH = (180 * 96) / 25.4;

/**
 * 서식이 한 장에 들어가는지 — 들어갈 때만 칸을 늘린다.
 * 여러 장짜리는 지금처럼 위에서부터 차례로 흘려 보낸다(늘리면 줄이 장 사이에서 갈릴 수 있다).
 * 글꼴·반올림 차이로 한두 줄이 넘어가는 일을 피하려고 여유를 둔다.
 */
export function blankFormFitsOnePage(naturalHeight: number): boolean {
  return naturalHeight > 0 && naturalHeight <= BLANK_PAGE_CONTENT_HEIGHT - 16;
}

/**
 * 남는 종이에 반복 항목 표의 줄을 몇 개 더 그릴지 (표 한 개당).
 *
 * 긴 글 칸이 있는 서식은 그 칸이 남는 종이를 다 받는다. 긴 글 칸이 없으면 줄마다 상한(한 줄 칸 15mm 등)까지만
 * 늘어나 아래가 다시 빈다 — 지출결의서·연차 사용 계획서처럼 표가 본문인 서식은 그 자리에 줄을 더 그린다.
 * 한 줄 칸만 있는 서식은 더 그릴 것이 없어 0 (칸을 15mm보다 키우면 오히려 어색하다).
 *
 * rowHeights: 늘리기 전 배치에서 잰 줄별 높이(px), naturalHeight: 그때의 서식 전체 높이.
 * 줄마다 상한까지 늘어난 뒤에도 남는 높이를 표 줄 높이(상한 기준)로 나눈다 — 그래서 더 그려도 한 장을 넘지 않는다.
 */
export function blankExtraTableLines(
  rows: FormFieldSchema[][],
  rowHeights: number[],
  naturalHeight: number,
): number {
  if (!blankFormFitsOnePage(naturalHeight)) return 0;

  let stretch = 0;
  let growableTables = 0;
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (isSectionRow(row)) continue;
    const { flexLines, maxPx } = blankRowStretch(row);
    if (flexLines > 0) return 0;
    const height = rowHeights[index];
    // 줄 높이를 못 쟀으면 어림하지 않는다 — 넘치는 것보다 비는 편이 낫다
    if (!Number.isFinite(height) || height <= 0) return 0;
    stretch += Math.max(0, maxPx - height);
    // 줄을 더 받을 수 있는 표 — 양식이 정한 최대 줄 수에 이미 닿은 표는 뺀다
    const canGrow = row.some(
      (field) => blankCellFor(field).kind === 'table' && blankRepeaterRows(field, 1) > blankRepeaterRows(field),
    );
    if (canGrow) growableTables += 1;
  }
  if (growableTables === 0) return 0;

  const spare = BLANK_PAGE_CONTENT_HEIGHT - 16 - naturalHeight - stretch;
  const extra = Math.floor(spare / (growableTables * BLANK_TABLE_LINE_MAX));
  return Math.max(0, Math.min(extra, BLANK_REPEATER_ROWS_LIMIT));
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
