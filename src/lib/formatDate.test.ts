import test from 'node:test';
import assert from 'node:assert/strict';
import { formatListDate, formatListDateTime } from './formatDate.ts';

const now = new Date(2026, 9, 27, 12, 0);

test('올해는 연도를 생략한다', () => {
  assert.equal(formatListDateTime(new Date(2026, 8, 1, 9, 0), now), '09.01 09:00');
  assert.equal(formatListDate(new Date(2026, 0, 5), now), '01.05');
});
test('다른 해는 연도를 붙인다', () => {
  assert.equal(formatListDateTime(new Date(2025, 11, 31, 23, 5), now), '2025.12.31 23:05');
  assert.equal(formatListDate(new Date(2025, 11, 31), now), '2025.12.31');
});
test('빈 값·잘못된 값은 빈 문자열', () => {
  assert.equal(formatListDateTime(null, now), '');
  assert.equal(formatListDateTime('nope', now), '');
});
