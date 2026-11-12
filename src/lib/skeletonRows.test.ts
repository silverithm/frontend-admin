/**
 * 목록 뼈대 줄 수 — `node --test src/lib/skeletonRows.test.ts`
 *
 * 여기서 못 박는 것:
 * - 숫자 높이는 floor(높이 / 48)이고 최소 2, 최대 8 — 영역 밖으로 줄을 그리지 않는다
 * - 문자열 높이('100%'·'60vh')나 높이 없음은 6
 * - 제목 막대는 60% 안팎에서 줄마다 다르고, 메타 막대는 30%
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  skeletonRowCount,
  skeletonTitleWidth,
  SKELETON_META_WIDTH,
  SKELETON_ROW_HEIGHT,
} from './skeletonRows.ts';

test('숫자 높이는 줄 높이로 나눈 몫', () => {
  assert.equal(SKELETON_ROW_HEIGHT, 48);
  assert.equal(skeletonRowCount(240), 5); // Loading section
  assert.equal(skeletonRowCount(160), 3);
  assert.equal(skeletonRowCount(191), 3); // 넘치지 않게 내림
  assert.equal(skeletonRowCount(192), 4);
});

test('최소 2줄 — 낮은 자리에서도 목록처럼 보인다', () => {
  assert.equal(skeletonRowCount(96), 2); // Loading inline
  assert.equal(skeletonRowCount(72), 2);
  assert.equal(skeletonRowCount(0), 2);
  assert.equal(skeletonRowCount(-40), 2);
});

test('최대 8줄', () => {
  assert.equal(skeletonRowCount(384), 8);
  assert.equal(skeletonRowCount(1200), 8);
});

test('문자열 높이나 높이 없음은 6줄', () => {
  assert.equal(skeletonRowCount('100%'), 6);
  assert.equal(skeletonRowCount('60vh'), 6);
  assert.equal(skeletonRowCount(undefined), 6);
  assert.equal(skeletonRowCount(Number.NaN), 6);
  assert.equal(skeletonRowCount(Number.POSITIVE_INFINITY), 6);
});

test('줄 높이를 따로 주면 그 값으로 나눈다', () => {
  assert.equal(skeletonRowCount(200, 40), 5);
  assert.equal(skeletonRowCount(200, 0), 6); // 0으로 나누지 않는다
});

test('제목 막대 폭은 60% 안팎에서 줄마다 다르다', () => {
  const widths = Array.from({ length: 8 }, (_, i) => skeletonTitleWidth(i));
  assert.equal(new Set(widths).size, 8);
  for (const w of widths) {
    const n = Number.parseInt(w, 10);
    assert.ok(w.endsWith('%'));
    assert.ok(n >= 50 && n <= 70, `${w}는 60% 안팎이어야 한다`);
  }
  assert.equal(skeletonTitleWidth(8), skeletonTitleWidth(0)); // 9번째 줄부터 다시 돈다
  assert.equal(skeletonTitleWidth(-1), skeletonTitleWidth(1));
  assert.equal(SKELETON_META_WIDTH, '30%');
});
