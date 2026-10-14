/**
 * 한국 날짜 도우미 테스트 — `node --test src/lib/lab/labDate.test.ts`
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { addDays, daysBetween, daysInMonth, formatYmd, isValidMonth, isValidYmd, parseYmd, seoulDateString, timeToMinutes } from './labDate.ts';

test('seoulDateString — UTC 15시 이후는 한국 날짜로 하루 뒤', () => {
  assert.equal(seoulDateString(new Date('2026-06-30T14:59:59Z')), '2026-06-30');
  assert.equal(seoulDateString(new Date('2026-06-30T15:00:00Z')), '2026-07-01');
  assert.equal(seoulDateString(new Date('2026-12-31T15:30:00Z')), '2027-01-01');
});

test('parseYmd — 실제 있는 날짜만, 시각이 붙어도 앞 10자', () => {
  assert.deepEqual(parseYmd('2026-10-14'), { year: 2026, month: 10, day: 14 });
  assert.deepEqual(parseYmd('2026-10-14T09:00:00+09:00'), { year: 2026, month: 10, day: 14 });
  assert.equal(parseYmd('2026-02-29'), null);
  assert.deepEqual(parseYmd('2028-02-29'), { year: 2028, month: 2, day: 29 });
  assert.equal(parseYmd('2026-13-01'), null);
  assert.equal(parseYmd('2026-00-10'), null);
  assert.equal(parseYmd('20261014'), null);
  assert.equal(parseYmd('2026-10-145'), null);
  assert.equal(parseYmd(null), null);
  assert.equal(parseYmd(undefined), null);
});

test('daysInMonth·formatYmd·isValidMonth', () => {
  assert.equal(daysInMonth(2026, 2), 28);
  assert.equal(daysInMonth(2028, 2), 29);
  assert.equal(daysInMonth(2026, 12), 31);
  assert.equal(formatYmd(2026, 3, 4), '2026-03-04');
  assert.equal(isValidMonth('2026-10'), true);
  assert.equal(isValidMonth('2026-13'), false);
  assert.equal(isValidMonth('2026-1'), false);
  assert.equal(isValidMonth(202610), false);
});

test('addDays — 월말·연말·윤년을 넘겨 더하고 빼며, 잘못된 값은 null', () => {
  assert.equal(addDays('2026-10-15', 30), '2026-11-14');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addDays('2026-02-28', 1), '2026-03-01');
  assert.equal(addDays('2026-12-31', -90), '2026-10-02');
  assert.equal(addDays('2026-10-15', 0), '2026-10-15');
  assert.equal(addDays('2026-02-30', 1), null);
  assert.equal(addDays('2026-10-15', 1.5), null);
});

test('daysBetween·isValidYmd·timeToMinutes', () => {
  assert.equal(daysBetween('2026-10-01', '2026-10-15'), 14);
  assert.equal(daysBetween('2028-02-28', '2028-03-01'), 2);
  assert.equal(daysBetween('2026-10-15', '2026-10-01'), -14);
  assert.equal(daysBetween('x', '2026-10-01'), null);
  assert.equal(isValidYmd('2026-10-15'), true);
  assert.equal(isValidYmd('2026-10-15T09:00'), true);
  assert.equal(isValidYmd('2026-2-5'), false);
  assert.equal(isValidYmd(null), false);
  assert.equal(timeToMinutes('00:00'), 0);
  assert.equal(timeToMinutes('23:59'), 1439);
  assert.equal(timeToMinutes('24:00'), null);
  assert.equal(timeToMinutes('9:00'), null);
});
