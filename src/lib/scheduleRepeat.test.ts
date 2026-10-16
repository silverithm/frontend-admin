import test from 'node:test';
import assert from 'node:assert/strict';
import { expandRepeatDates, shiftDate, MAX_REPEAT_COUNT } from './scheduleRepeat.ts';

test('반복 없음은 시작일 하나', () => {
  assert.deepEqual(expandRepeatDates('2026-10-16', { kind: 'NONE', weekdays: [], until: '2026-12-31' }), ['2026-10-16']);
});

test('종료일이 시작일보다 빠르면 시작일 하나', () => {
  assert.deepEqual(expandRepeatDates('2026-10-16', { kind: 'WEEKLY', weekdays: [1], until: '2026-10-01' }), ['2026-10-16']);
});

test('매주 월·수 — 시작일(금) 이후부터 2주', () => {
  assert.deepEqual(expandRepeatDates('2026-10-16', { kind: 'WEEKLY', weekdays: [1, 3], until: '2026-10-30' }), ['2026-10-19', '2026-10-21', '2026-10-26', '2026-10-28']);
});

test('요일을 안 고르면 시작일의 요일로 매주', () => {
  assert.deepEqual(expandRepeatDates('2026-10-16', { kind: 'WEEKLY', weekdays: [], until: '2026-11-06' }), ['2026-10-16', '2026-10-23', '2026-10-30', '2026-11-06']);
});

test('매월 같은 날짜, 없는 날은 건너뛴다', () => {
  assert.deepEqual(expandRepeatDates('2026-01-31', { kind: 'MONTHLY', weekdays: [], until: '2026-05-31' }), ['2026-01-31', '2026-03-31', '2026-05-31']);
  assert.deepEqual(expandRepeatDates('2026-10-05', { kind: 'MONTHLY', weekdays: [], until: '2027-01-04' }), ['2026-10-05', '2026-11-05', '2026-12-05']);
});

test('최대 건수를 넘기지 않는다', () => {
  assert.equal(expandRepeatDates('2026-01-01', { kind: 'WEEKLY', weekdays: [0, 1, 2, 3, 4, 5, 6], until: '2030-12-31' }).length, MAX_REPEAT_COUNT);
});

test('여러 날 일정의 종료일을 같은 간격으로 옮긴다', () => {
  assert.equal(shiftDate('2026-10-18', '2026-10-16', '2026-10-23'), '2026-10-25');
});
