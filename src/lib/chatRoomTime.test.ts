import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatRoomTime } from './chatRoomTime.ts';

const NOW = new Date('2026-09-14T09:00:00+09:00').getTime();

test('최근 활동은 한국어 상대 시간 — 영어("minutes ago")가 나오지 않는다', () => {
  assert.equal(formatRoomTime('2026-09-14T08:30:00+09:00', NOW), '30분 전');
  assert.equal(formatRoomTime('2026-09-13T17:42:00+09:00', NOW), '약 15시간 전');
  assert.doesNotMatch(formatRoomTime('2026-09-12T09:00:00+09:00', NOW), /[A-Za-z]/);
});

test('일주일이 넘으면 날짜로', () => {
  assert.equal(formatRoomTime('2026-09-01T09:00:00+09:00', NOW), '2026.09.01');
});
