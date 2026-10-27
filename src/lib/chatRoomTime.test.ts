import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatRoomTime } from './chatRoomTime.ts';

const NOW = new Date('2026-09-14T09:00:00+09:00').getTime();

test('최근 활동은 한국어 상대 시간 — 영어("minutes ago")·"약"이 나오지 않는다', () => {
  assert.equal(formatRoomTime('2026-09-14T08:59:40+09:00', NOW), '방금');
  assert.equal(formatRoomTime('2026-09-14T08:30:00+09:00', NOW), '30분 전');
  assert.equal(formatRoomTime('2026-09-13T17:42:00+09:00', NOW), '15시간 전');
  assert.doesNotMatch(formatRoomTime('2026-09-12T09:00:00+09:00', NOW), /[A-Za-z약]/);
});

test('하루~이틀은 어제, 일주일 안은 N일 전', () => {
  assert.equal(formatRoomTime('2026-09-13T08:00:00+09:00', NOW), '어제');
  assert.equal(formatRoomTime('2026-09-11T09:00:00+09:00', NOW), '3일 전');
});

test('일주일이 넘으면 M/D', () => {
  const out = formatRoomTime('2026-09-01T09:00:00+09:00', NOW);
  assert.match(out, /^\d{1,2}\/\d{1,2}$/);
});
