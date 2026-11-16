/**
 * 2026년 월 기준 근무시간 — `node --test src/lib/ltcStandardHours.test.ts`
 *
 * 기대값은 원문 규칙을 달력에 손으로 적용한 값이다(코드에서 베끼지 않는다).
 * - 고시 제49조제1항: (공휴일·근로자의 날·토요일 뺀 근무가능일수) × 8시간. 일요일은 규정 제2조제1호의 공휴일.
 * - 2026년 1월 1일은 목요일(한국천문연구원 음양력: 2월 1일 일요일 → 1월 31일 토요일에서 거꾸로 셈), 1년 365일 = 52주 + 목요일 하루 → 평일 261일.
 * - 평일에 걸린 공휴일: 1/1, 2/16·17·18(설), 3/2(3·1절 대체), 5/1(노동절), 5/5, 5/25(부처님 오신 날 대체), 6/3(지방선거),
 *   7/17(제헌절), 8/17(광복절 대체), 9/24·25(추석), 10/5(개천절 대체), 10/9, 12/25 — 16일.
 * - 주말에 걸려 영향 없는 날: 3/1(일), 5/24(일), 6/6(토, 현충일은 대체공휴일 대상 아님), 8/15(토), 9/26(토, 추석은 일요일만 대체), 10/3(토).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { HOLIDAYS_2026, dayOfWeek, formatMonthDay, partTimeHeadcount, standardHours2026 } from './ltcStandardHours.ts';

const rows = standardHours2026();

test('월별 평일(월~금) 날수 — 1월 1일 목요일에서 손으로 센 값', () => {
  // 1월: 1(목)·2(금) + 5~30일 네 주 20일 = 22 / 2월: 1일 일요일, 네 주 20 / 3월: 1일 일요일, 2~27일 20 + 30·31일 = 22
  // 4월: 1일 수요일, 1~3일 3 + 6~24일 15 + 27~30일 4 = 22 / 5월: 1일 금요일, 1 + 4~29일 20 = 21 / 6월: 1일 월요일, 20 + 29·30일 = 22
  // 7월: 1일 수요일, 3 + 6~31일 20 = 23 / 8월: 1일 토요일, 3~28일 20 + 31일 = 21 / 9월: 1일 화요일, 4 + 15 + 28~30일 3 = 22
  // 10월: 1일 목요일, 2 + 5~30일 20 = 22 / 11월: 1일 일요일, 20 + 30일 = 21 / 12월: 1일 화요일, 4 + 15 + 28~31일 4 = 23
  assert.deepEqual(
    rows.map((r) => r.weekdays),
    [22, 20, 22, 22, 21, 22, 23, 21, 22, 22, 21, 23],
  );
  assert.equal(rows.reduce((sum, r) => sum + r.weekdays, 0), 261);
});

test('월별 근무가능일수와 월 기준 근무시간', () => {
  assert.deepEqual(
    rows.map((r) => r.workableDays),
    [21, 17, 21, 22, 18, 21, 22, 20, 20, 20, 21, 22],
  );
  assert.deepEqual(
    rows.map((r) => r.hours),
    [168, 136, 168, 176, 144, 168, 176, 160, 160, 160, 168, 176],
  );
  assert.equal(rows.reduce((sum, r) => sum + r.workableDays, 0), 245);
  assert.equal(rows.reduce((sum, r) => sum + r.hours, 0), 1960);
});

test('빼는 날 — 평일에 걸린 공휴일만, 주말에 걸린 날은 빼지 않는다', () => {
  const off = (month: number) => rows[month - 1].offWeekdays.map((h) => h.date);
  assert.deepEqual(off(1), ['2026-01-01']);
  assert.deepEqual(off(2), ['2026-02-16', '2026-02-17', '2026-02-18']);
  assert.deepEqual(off(3), ['2026-03-02']);
  assert.deepEqual(off(4), []);
  assert.deepEqual(off(5), ['2026-05-01', '2026-05-05', '2026-05-25']);
  assert.deepEqual(off(6), ['2026-06-03']);
  assert.deepEqual(off(7), ['2026-07-17']);
  assert.deepEqual(off(8), ['2026-08-17']);
  assert.deepEqual(off(9), ['2026-09-24', '2026-09-25']);
  assert.deepEqual(off(10), ['2026-10-05', '2026-10-09']);
  assert.deepEqual(off(11), []);
  assert.deepEqual(off(12), ['2026-12-25']);
  assert.equal(rows.reduce((sum, r) => sum + r.offWeekdays.length, 0), 16);
});

test('요일 — 원문(천문연 음양력·선관위 일정)에 적힌 요일과 같다', () => {
  // 천문연 음양력: 2/16 월, 2/17 화, 2/18 수, 5/24 일, 5/25 월, 9/24 목, 9/25 금, 9/26 토
  assert.equal(formatMonthDay('2026-02-16'), '2월 16일(월)');
  assert.equal(formatMonthDay('2026-02-18'), '2월 18일(수)');
  assert.equal(formatMonthDay('2026-05-24'), '5월 24일(일)');
  assert.equal(formatMonthDay('2026-09-26'), '9월 26일(토)');
  // 선관위: 제9회 전국동시지방선거 6/3 — 수요일
  assert.equal(formatMonthDay('2026-06-03'), '6월 3일(수)');
  // 제헌절 7/17 금요일, 노동절 5/1 금요일 — 2026년엔 대체공휴일이 생기지 않는다
  assert.equal(formatMonthDay('2026-07-17'), '7월 17일(금)');
  assert.equal(formatMonthDay('2026-05-01'), '5월 1일(금)');
  // 대체공휴일은 모두 월요일
  for (const h of HOLIDAYS_2026.filter((x) => x.name.endsWith('대체공휴일'))) assert.equal(dayOfWeek(h.date), 1, h.date);
});

test('목록 — 2026년 날짜만, 겹치지 않고 날짜순', () => {
  const dates = HOLIDAYS_2026.map((h) => h.date);
  assert.equal(new Set(dates).size, dates.length);
  assert.deepEqual([...dates].sort(), dates);
  for (const d of dates) assert.match(d, /^2026-\d{2}-\d{2}$/);
});

test('시간제 합산 — 제51조제3항 (가산은 버림, 감액은 둘째자리 버리고 첫째자리 4 이하 버림)', () => {
  // 7월 176시간: 270 ÷ 176 = 1.534… → 가산 1명, 감액 1.5 → 첫째자리 5라 남는다 → 1.5명
  assert.deepEqual(partTimeHeadcount(270, 176), { forBonus: 1, forPenalty: 1.5 });
  // 250 ÷ 176 = 1.420… → 가산 1명, 감액 1.4 → 첫째자리 4라 버린다 → 1명
  assert.deepEqual(partTimeHeadcount(250, 176), { forBonus: 1, forPenalty: 1 });
  // 352 ÷ 176 = 2 → 2명, 2명
  assert.deepEqual(partTimeHeadcount(352, 176), { forBonus: 2, forPenalty: 2 });
  // 2월 136시간: 100 ÷ 136 = 0.735… → 가산 0명, 감액 0.7명
  assert.deepEqual(partTimeHeadcount(100, 136), { forBonus: 0, forPenalty: 0.7 });
  assert.throws(() => partTimeHeadcount(10.5, 176), RangeError);
  assert.throws(() => partTimeHeadcount(100, 0), RangeError);
});
