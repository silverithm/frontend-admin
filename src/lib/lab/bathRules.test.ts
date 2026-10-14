/**
 * 목욕 규칙 테스트 — `node --test src/lib/lab/bathRules.test.ts`
 * 왜: 목욕 가산은 청구액이다. 주(월~일)와 달 경계를 한 칸만 어긋나게 세도 3,000원 단위로 틀린다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { BATH_BONUS_PER_WEEK, BATH_METHODS, MAX_BATH_MINUTES, bathBonus, bathBonusTotal, bathMethodLabel, bathMinutes, isBathMethod, weekCrossesMonth, weeklyBath } from './bathRules.ts';

const log = (elderlyId: number, bathDate: string) => ({ elderlyId, bathDate });

test('bathMinutes — 정상 소요시간, 180분은 허용·181분은 null', () => {
  assert.equal(bathMinutes('10:00', '10:40'), 40);
  assert.equal(bathMinutes('09:00', '12:00'), MAX_BATH_MINUTES);
  assert.equal(bathMinutes('09:00', '12:01'), null);
  assert.equal(bathMinutes('23:00', '23:59'), 59);
});

test('bathMinutes — 끝 ≤ 시작, 형식·범위 오류는 null', () => {
  assert.equal(bathMinutes('10:00', '10:00'), null);
  assert.equal(bathMinutes('10:30', '10:00'), null);
  assert.equal(bathMinutes('9:00', '10:00'), null);
  assert.equal(bathMinutes('10:00', '24:00'), null);
  assert.equal(bathMinutes('10:60', '11:00'), null);
  assert.equal(bathMinutes('', ''), null);
  assert.equal(bathMinutes(undefined as unknown as string, '10:00'), null);
});

test('목욕 방법 라벨 — 전신입욕·목욕의자·침상', () => {
  assert.deepEqual(BATH_METHODS.map((m) => m.label), ['전신입욕', '목욕의자', '침상']);
  assert.equal(bathMethodLabel('BED'), '침상');
  assert.equal(bathMethodLabel('SHOWER'), 'SHOWER');
  assert.equal(isBathMethod('FULL_BATH'), true);
  assert.equal(isBathMethod('SHOWER'), false);
});

test('weeklyBath — 월~일 경계(월요일 00시·일요일 포함, 다음 월요일 제외)', () => {
  const logs = [log(1, '2026-10-11'), log(1, '2026-10-12'), log(1, '2026-10-18'), log(1, '2026-10-19')];
  const [row] = weeklyBath(logs, [1], '2026-10-12');
  assert.deepEqual([row.count, row.dates], [2, ['2026-10-12', '2026-10-18']]);
});

test('weeklyBath — 같은 날 두 번은 한 번, elderIds 순서대로, 기록 없으면 0', () => {
  const rows = weeklyBath([log(2, '2026-10-13'), log(2, '2026-10-13'), log(3, '2026-10-14')], [2, 1, 3], '2026-10-12');
  assert.deepEqual(rows.map((r) => [r.elderlyId, r.count]), [[2, 1], [1, 0], [3, 1]]);
});

test('weeklyBath — 월요일이 아닌 날을 줘도 그 주로 보고, 잘못된 날짜는 모두 0', () => {
  assert.equal(weeklyBath([log(1, '2026-10-13')], [1], '2026-10-15')[0].count, 1);
  assert.equal(weeklyBath([log(1, '2026-10-13')], [1], '2026-10-32')[0].count, 0);
});

test('bathBonus — 계약 예: 한 주에 두 번은 한 번, 달 밖 날짜는 주를 정하지 않는다', () => {
  const rows = bathBonus([log(1, '2026-10-13'), log(1, '2026-10-16'), log(1, '2026-10-28'), log(1, '2026-09-30'), log(2, '2026-10-01')], '2026-10');
  assert.deepEqual(rows.map((b) => [b.elderlyId, b.weeks, b.amount]), [[1, ['2026-10-12', '2026-10-26'], 6000], [2, ['2026-09-28'], 3000]]);
});

test('bathBonus — 달에 걸친 주는 splitWeek로 표시(10/1이 목요일인 주), 온전히 달 안인 주는 아님', () => {
  const [a, b] = bathBonus([log(1, '2026-10-01'), log(2, '2026-10-14')], '2026-10');
  assert.equal(a.splitWeek, true);
  assert.equal(b.splitWeek, false);
  assert.equal(weekCrossesMonth('2026-09-28'), true);
  assert.equal(weekCrossesMonth('2026-10-12'), false);
  assert.equal(weekCrossesMonth('2026-10-26'), true); // 10/26~11/1
});

test('bathBonus — 연말·연초와 윤년 2월 경계', () => {
  const dec = bathBonus([log(1, '2026-12-31'), log(1, '2026-12-29')], '2026-12');
  assert.deepEqual(dec[0].weeks, ['2026-12-28']); // 12/31(목)과 12/29(화)는 같은 주
  const jan = bathBonus([log(1, '2027-01-01')], '2027-01');
  assert.deepEqual(jan[0].weeks, ['2026-12-28']);
  const feb = bathBonus([log(1, '2028-02-29'), log(1, '2028-02-28')], '2028-02');
  assert.deepEqual(feb[0].weeks, ['2028-02-28']); // 2/28(월)·2/29(화)
  assert.equal(feb[0].amount, 3000);
});

test('bathBonus — 어르신 번호 순, 기록 없는 달·잘못된 달은 빈 결과, 금액은 정수', () => {
  assert.deepEqual(bathBonus([], '2026-10'), []);
  assert.deepEqual(bathBonus([log(1, '2026-10-13')], '2026-13'), []);
  const rows = bathBonus([log(9, '2026-10-13'), log(3, '2026-10-13'), log(3, '2026-10-20'), log(3, '2026-10-27')], '2026-10');
  assert.deepEqual(rows.map((r) => r.elderlyId), [3, 9]);
  assert.equal(rows[0].amount, 3 * BATH_BONUS_PER_WEEK);
  assert.equal(bathBonusTotal(rows), 4 * BATH_BONUS_PER_WEEK);
  assert.deepEqual(bathBonus([log(1, 'bad')], '2026-10'), []);
});
