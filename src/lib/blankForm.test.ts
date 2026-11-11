/**
 * 빈 서식 인쇄 — `node --test src/lib/blankForm.test.ts`
 *
 * 여기서 못 박는 것:
 * - 고르는 칸(선택·라디오·체크)은 보기를 모두 □로 늘어놓는다 — 예전 인쇄는 '-'만 찍혔다
 * - 긴 글·사진은 여러 줄(반쪽 이하 긴 글은 한 줄 덜), 날짜는 '년 월 일' 자리, 반복 항목은 열 머리와 빈 줄
 * - 반복 항목 빈 줄은 기본 다섯, 양식의 최소·최대를 넘지 않는다
 * - 칸 없는 스키마·파일 양식은 빈 서식 인쇄 대상이 아니다
 * - 결재란은 기안 + 기본 결재선 단계 수(마지막이 결재), 결재선이 없으면 기안·검토·결재
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  blankApprovalHeaders,
  blankCellFor,
  blankRepeaterRows,
  canPrintBlankForm,
  parseFormSchema,
  BLANK_TEXTAREA_LINES,
  BLANK_NARROW_TEXTAREA_LINES,
  BLANK_IMAGE_LINES,
} from './blankForm.ts';

type Field = Parameters<typeof blankCellFor>[0];
const field = (partial: Partial<Field>): Field => ({ id: 'f', type: 'text', label: '칸', required: false, ...partial }) as Field;

test('고르는 칸은 보기를 모두 늘어놓는다', () => {
  const options = [
    { label: '사무팀', value: 'a' },
    { label: '간호팀', value: 'b' },
    { label: ' ', value: '' },
  ];
  for (const type of ['select', 'radio', 'checkbox'] as const) {
    assert.deepEqual(blankCellFor(field({ type, options })), { kind: 'choices', options: ['사무팀', '간호팀'] });
  }
  // 보기가 없는 고르기 칸은 한 줄 쓸 자리로
  assert.deepEqual(blankCellFor(field({ type: 'checkbox', options: [] })), { kind: 'line' });
});

test('글·날짜·사진·합계 칸', () => {
  assert.deepEqual(blankCellFor(field({ type: 'text' })), { kind: 'line' });
  assert.deepEqual(blankCellFor(field({ type: 'number' })), { kind: 'line' });
  assert.deepEqual(blankCellFor(field({ type: 'file' })), { kind: 'line' });
  assert.deepEqual(blankCellFor(field({ type: 'textarea' })), { kind: 'box', lines: BLANK_TEXTAREA_LINES });
  assert.deepEqual(blankCellFor(field({ type: 'textarea', width: 'full' })), { kind: 'box', lines: BLANK_TEXTAREA_LINES });
  // 반쪽 칸에 어르신 한 분씩 — 한 줄 덜 쓴다
  assert.deepEqual(blankCellFor(field({ type: 'textarea', width: 'half' })), { kind: 'box', lines: BLANK_NARROW_TEXTAREA_LINES });
  assert.deepEqual(blankCellFor(field({ type: 'image' })), { kind: 'box', lines: BLANK_IMAGE_LINES });
  assert.deepEqual(blankCellFor(field({ type: 'date' })), { kind: 'date' });
  assert.deepEqual(blankCellFor(field({ type: 'dateRange' })), { kind: 'dateRange' });
  assert.deepEqual(
    blankCellFor(field({ type: 'computed', computed: { operation: 'sum', unit: '일' } })),
    { kind: 'unit', unit: '일' },
  );
  assert.deepEqual(blankCellFor(field({ type: 'computed', computed: { operation: 'sum' } })), { kind: 'line' });
});

test('반복 항목은 열 머리와 빈 줄', () => {
  const repeater = field({
    type: 'repeater',
    repeater: {
      fields: [
        field({ id: 'd', type: 'date', label: '사용 예정일' }),
        field({ id: 'n', type: 'number', label: '일수' }),
      ],
      minRows: 1,
    },
  });
  assert.deepEqual(blankCellFor(repeater), { kind: 'table', columns: ['사용 예정일', '일수'], rows: 5 });
  assert.equal(blankRepeaterRows(field({ type: 'repeater', repeater: { fields: [], minRows: 8 } })), 8);
  assert.equal(blankRepeaterRows(field({ type: 'repeater', repeater: { fields: [], maxRows: 3 } })), 3);
  // 열이 없는 반복 항목은 긴 글 자리로
  assert.deepEqual(blankCellFor(field({ type: 'repeater', repeater: { fields: [] } })), { kind: 'box', lines: BLANK_TEXTAREA_LINES });
});

test('빈 서식 인쇄 대상 — 칸이 있는 온라인·혼합 양식만', () => {
  const schema = JSON.stringify({ version: 1, fields: [{ id: 'a', type: 'text', label: '성명', required: true }] });
  assert.equal(canPrintBlankForm({ templateType: 'form', formSchema: schema }), true);
  assert.equal(canPrintBlankForm({ templateType: 'hybrid', formSchema: JSON.parse(schema) }), true);
  assert.equal(canPrintBlankForm({ templateType: 'file', formSchema: schema }), false);
  assert.equal(canPrintBlankForm({ templateType: 'form', formSchema: '{"fields":[]}' }), false);
  assert.equal(
    canPrintBlankForm({ templateType: 'form', formSchema: '{"fields":[{"id":"s","type":"section","label":"1층"}]}' }),
    false,
  );
  assert.equal(canPrintBlankForm({ templateType: 'form', formSchema: '{깨진' }), false);
  // 깨진 칸이 섞여 있으면 걸러 내고 나머지로 찍는다
  const mixed = parseFormSchema('{"fields":[null,{"id":"a","type":"text","label":"성명"},{"label":"종류 없음"}]}');
  assert.deepEqual(mixed?.fields.map((f) => f.id), ['a']);
  // 보기 이름이 글자가 아니어도
  assert.deepEqual(
    blankCellFor(field({ type: 'radio', options: [{ label: 3 as unknown as string, value: '3' }] })),
    { kind: 'choices', options: ['3'] },
  );
  assert.equal(parseFormSchema(undefined), undefined);
});

test('결재란 머리', () => {
  assert.deepEqual(blankApprovalHeaders(0), ['기안', '검토', '결재']);
  assert.deepEqual(blankApprovalHeaders(1), ['기안', '결재']);
  assert.deepEqual(blankApprovalHeaders(3), ['기안', '검토', '검토', '결재']);
});
