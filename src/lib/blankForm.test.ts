/**
 * 빈 서식 인쇄 — `node --test src/lib/blankForm.test.ts`
 *
 * 여기서 못 박는 것:
 * - 고르는 칸(선택·라디오·체크)은 보기를 모두 □로 늘어놓는다 — 예전 인쇄는 '-'만 찍혔다
 * - 긴 글·사진은 여러 줄(반쪽 이하 긴 글은 한 줄 덜), 날짜는 '년 월 일' 자리, 반복 항목은 열 머리와 빈 줄
 * - 반복 항목 빈 줄은 기본 다섯, 양식의 최소·최대를 넘지 않는다
 * - 칸 없는 스키마·파일 양식은 빈 서식 인쇄 대상이 아니다
 * - 결재란은 기안 + 기본 결재선 단계 수(마지막이 결재), 결재선이 없으면 기안·검토·결재
 * - 한 장짜리 서식의 남는 종이: 한 줄 칸은 상한까지만, 긴 글 칸이 나머지를 줄 수 비율로, 구역 제목은 그대로
 * - 긴 글 칸 없이 표가 본문인 서식은 남는 종이에 표 줄을 더 그린다 — 한 장을 넘지 않고, 양식의 최대 줄 수도 넘지 않는다
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  blankApprovalHeaders,
  blankCellFor,
  blankExtraTableLines,
  blankFormFitsOnePage,
  blankRepeaterRows,
  blankRowTrack,
  blankRowTracks,
  canPrintBlankForm,
  parseFormSchema,
  BLANK_TEXTAREA_LINES,
  BLANK_NARROW_TEXTAREA_LINES,
  BLANK_IMAGE_LINES,
  BLANK_PAGE_CONTENT_HEIGHT,
  BLANK_REPEATER_ROWS_LIMIT,
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

test('줄이 늘어나는 범위 — 한 줄 칸은 상한까지, 긴 글 칸이 남는 종이를 갖는다', () => {
  // 구역 제목은 늘리지 않는다
  assert.equal(blankRowTrack([field({ type: 'section' })]), 'auto');
  // 한 줄 칸·날짜·고르는 칸은 15mm쯤까지만
  assert.equal(blankRowTrack([field({ type: 'text' }), field({ type: 'date' })]), 'minmax(min-content, 56px)');
  assert.equal(
    blankRowTrack([field({ type: 'radio', options: [{ label: '예', value: 'y' }] })]),
    'minmax(min-content, 56px)',
  );
  // 긴 글은 남는 종이를 줄 수 비율로 — 한 줄에 섞여 있으면 긴 글이 그 줄을 정한다
  assert.equal(blankRowTrack([field({ type: 'textarea', width: 'full' })]), `minmax(min-content, ${BLANK_TEXTAREA_LINES}fr)`);
  assert.equal(
    blankRowTrack([field({ type: 'text', width: 'half' }), field({ type: 'textarea', width: 'half' })]),
    `minmax(min-content, ${BLANK_NARROW_TEXTAREA_LINES}fr)`,
  );
  // 사진은 사진 한 장 높이까지만 — 종이 절반을 사진 칸이 먹지 않게
  assert.equal(blankRowTrack([field({ type: 'image' })]), 'minmax(min-content, 264px)');
  // 반복 항목 표는 줄마다 44px까지 (열 머리·여백 44 + 다섯 줄 × 44)
  const repeater = field({
    type: 'repeater',
    repeater: { fields: [field({ label: '품목' })] },
  });
  assert.equal(blankRowTrack([repeater]), 'minmax(min-content, 264px)');
  assert.equal(
    blankRowTracks([[field({ type: 'section' })], [field({ type: 'text' })], [field({ type: 'textarea' })]]),
    'auto minmax(min-content, 56px) minmax(min-content, 4fr)',
  );
});

test('한 장에 들어갈 때만 칸을 늘린다', () => {
  // 인쇄 용지에서 쓸 수 있는 높이는 266mm ≈ 1005px
  assert.equal(blankFormFitsOnePage(600), true);
  assert.equal(blankFormFitsOnePage(985), true);
  assert.equal(blankFormFitsOnePage(1000), false); // 넘칠 듯 말 듯하면 늘리지 않는다
  assert.equal(blankFormFitsOnePage(2400), false);
  assert.equal(blankFormFitsOnePage(0), false); // 못 쟀으면 지금처럼
});

test('표가 본문인 서식은 남는 종이에 표 줄을 더 그린다', () => {
  const columns = { fields: [field({ label: '내역' }), field({ label: '금액' })] };
  const line = [field({ type: 'text' })];
  const table = [field({ type: 'repeater', repeater: columns })];
  const usable = BLANK_PAGE_CONTENT_HEIGHT - 16;

  // 한 줄 칸 37 → 56(+19), 표 184 → 44 + 5×44 = 264(+80). 남는 높이에서 그만큼 빼고 44로 나눈다
  const natural = 500;
  const extra = blankExtraTableLines([line, table], [37, 184], natural);
  assert.equal(extra, Math.floor((usable - natural - 19 - 80) / 44));
  assert.ok(extra > 0);
  // 더 그린 뒤 줄마다 상한까지 늘어나도 한 장 안이다
  assert.ok(natural + 19 + 80 + extra * 44 <= usable);
  assert.deepEqual(blankCellFor(table[0], extra), { kind: 'table', columns: ['내역', '금액'], rows: 5 + extra });
  assert.equal(blankRowTrack(table, extra), `minmax(min-content, ${44 + (5 + extra) * 44}px)`);

  // 긴 글 칸이 있으면 그 칸이 남는 종이를 받는다
  assert.equal(blankExtraTableLines([line, table, [field({ type: 'textarea' })]], [37, 184, 106], natural), 0);
  // 표가 없으면 더 그릴 것이 없다
  assert.equal(blankExtraTableLines([line, line], [37, 37], 300), 0);
  // 한 장을 넘는 서식, 줄 높이를 못 잰 서식은 그대로
  assert.equal(blankExtraTableLines([line, table], [37, 184], usable + 1), 0);
  assert.equal(blankExtraTableLines([line, table], [37], natural), 0);
  assert.equal(blankExtraTableLines([line, table], [37, 0], natural), 0);
  // 거의 찬 서식 — 남는 자리가 표 한 줄이 안 되면 0 (음수가 되지 않는다)
  assert.equal(blankExtraTableLines([line, table], [37, 184], usable - 120), 0);

  // 양식이 정한 최대 줄 수에 닿은 표는 줄을 더 받지 않는다
  const capped = [field({ type: 'repeater', repeater: { ...columns, maxRows: 5 } })];
  assert.equal(blankExtraTableLines([line, capped], [37, 184], natural), 0);
  assert.equal(blankRepeaterRows(field({ type: 'repeater', repeater: { ...columns, maxRows: 8 } }), 10), 8);
  // 표가 둘이면 남는 자리를 나눠 갖는다
  const two = blankExtraTableLines([table, table], [184, 184], natural);
  assert.equal(two, Math.floor((usable - natural - 160) / 88));
  // 아무리 남아도 표 한 개는 상한 줄 수까지
  assert.equal(blankRepeaterRows(table[0], 99), BLANK_REPEATER_ROWS_LIMIT);
  assert.equal(blankRepeaterRows(table[0]), 5);
});
