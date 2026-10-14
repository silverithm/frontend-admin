/**
 * 한국 날짜 도우미 테스트 — `node --test src/lib/lab/labDate.test.ts`
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { daysInMonth, formatYmd, isValidMonth, parseYmd, seoulDateString } from './labDate.ts';

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
