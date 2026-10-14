/**
 * 퇴직금 추계 테스트 — `node --test src/lib/lab/severanceRules.test.ts`
 * 왜: 퇴직금은 한 번 틀리면 퇴직자에게 모자라게 주는 체불이 된다. 평균임금·통상임금 비교, 1년·15시간 경계, 월 경계를 손으로 셈한 값과 맞춘다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { averageWageMonths, ordinaryDailyWageOf, severanceEstimate, severanceLiability } from './severanceRules.ts';

const prof = { memberId: 1, hireDate: '2024-03-02', weeklyHours: 40, payType: 'MONTHLY' as const, baseAmount: 2508000 };
const L = (payMonth: string, grossPay: number, memberId = 1) => ({ memberId, payMonth, grossPay });
const lines = [L('2026-07', 2800000), L('2026-08', 2900000), L('2026-09', 2700000), L('2026-06', 9999999)];

test('직전 3개월 — 퇴직일이 속한 달은 빼고, 연초는 전년으로 넘어간다', () => {
  assert.deepEqual(averageWageMonths('2026-10-20'), ['2026-07', '2026-08', '2026-09']);
  assert.deepEqual(averageWageMonths('2026-01-15'), ['2025-10', '2025-11', '2025-12']);
  assert.deepEqual(averageWageMonths('2026-03-01'), ['2025-12', '2026-01', '2026-02']);
  assert.deepEqual(averageWageMonths('2026-13-01'), []);
});

test('통상임금 1일 — 월급제 12,000원×8시간, 시급제, 단시간(주 17.5시간)', () => {
  assert.equal(ordinaryDailyWageOf(prof), 96000);
  assert.equal(ordinaryDailyWageOf({ payType: 'HOURLY', baseAmount: 10320, weeklyHours: 40 }), 82560);
  // 시급 10,320 × 3.5시간 = 36,120
  assert.equal(ordinaryDailyWageOf({ payType: 'HOURLY', baseAmount: 10320, weeklyHours: 17.5 }), 36120);
  assert.equal(ordinaryDailyWageOf({ payType: 'HOURLY', baseAmount: 10320, weeklyHours: 0 }), 0);
});

test('퇴직금 — 통상임금이 평균임금보다 크면 통상임금(상여 120만 원)', () => {
  const e = severanceEstimate(prof, lines, '2026-10-20', 1200000);
  assert.deepEqual([e.eligible, e.serviceDays, e.avgDailyWage, e.ordinaryDailyWage, e.dailyWageUsed, e.amount], [true, 962, 94565, 96000, 96000, 7590575]);
  assert.equal(e.reason, null);
});

test('퇴직금 — 평균임금이 더 크면 평균임금(상여 600만 원)', () => {
  const e = severanceEstimate(prof, lines, '2026-10-20', 6000000);
  assert.deepEqual([e.avgDailyWage, e.dailyWageUsed, e.amount], [107608, 107608, 8508402]);
});

test('퇴직금 — 계속근로 365일이 대상 경계(364일은 아님, 365일은 대상)', () => {
  const at = (hire: string) => severanceEstimate({ ...prof, hireDate: hire }, lines, '2026-10-20', 0);
  assert.equal(at('2025-10-20').serviceDays, 365);
  assert.equal(at('2025-10-20').eligible, true);
  assert.equal(at('2025-10-21').serviceDays, 364);
  assert.equal(at('2025-10-21').eligible, false);
  assert.match(at('2025-10-21').reason ?? '', /1년 미만/);
  // 365일이면 1년분 30일 평균임금
  assert.equal(at('2025-10-20').amount, 96000 * 30);
});

test('퇴직금 — 1년 미만은 대상 아님, 금액 0이지만 계산 내역은 채운다', () => {
  const e = severanceEstimate({ ...prof, hireDate: '2026-01-01' }, lines, '2026-10-20', 0);
  assert.deepEqual([e.eligible, e.serviceDays, e.amount], [false, 292, 0]);
  assert.equal(e.dailyWageUsed, 96000);
});

test('퇴직금 — 윤년을 끼면 재직일수가 하루 더 많다(2024-02-29 입사)', () => {
  const e = severanceEstimate({ ...prof, hireDate: '2024-02-29' }, lines, '2026-10-20', 0);
  assert.equal(e.serviceDays, 964);
});

test('퇴직금 — 주 15시간이 경계(14.9시간은 대상 아님, 15시간은 대상)', () => {
  assert.equal(severanceEstimate({ ...prof, weeklyHours: 14.9 }, lines, '2026-10-20', 0).eligible, false);
  assert.match(severanceEstimate({ ...prof, weeklyHours: 14 }, lines, '2026-10-20', 0).reason ?? '', /15시간 미만/);
  assert.equal(severanceEstimate({ ...prof, weeklyHours: 15 }, lines, '2026-10-20', 0).eligible, true);
});

test('퇴직금 — 1년 미만이면서 15시간 미만이면 이유가 둘 다 적힌다', () => {
  const e = severanceEstimate({ ...prof, hireDate: '2026-05-01', weeklyHours: 10 }, lines, '2026-10-20', 0);
  assert.equal(e.eligible, false);
  assert.match(e.reason ?? '', /1년 미만/);
  assert.match(e.reason ?? '', /15시간 미만/);
});

test('퇴직금 — 급여대장이 한 달 빠지면 있는 달만(일수도 있는 달만), 이유를 적는다', () => {
  const e = severanceEstimate(prof, [L('2026-08', 2900000), L('2026-09', 2700000)], '2026-10-20', 0);
  // (2,900,000 + 2,700,000) ÷ (31 + 30)일
  assert.equal(e.avgDailyWage, 91803);
  assert.match(e.reason ?? '', /2026-07/);
  assert.equal(e.eligible, true);
});

test('퇴직금 — 빠진 달이 있으면 상여 가산도 있는 달 수만큼(2/12)', () => {
  const e = severanceEstimate(prof, [L('2026-08', 2900000), L('2026-09', 2700000)], '2026-10-20', 1200000);
  // (5,600,000 + 1,200,000 × 2/12) ÷ 61 = 5,800,000 ÷ 61 = 95081.9
  assert.equal(e.avgDailyWage, 95081);
});

test('퇴직금 — 급여대장이 하나도 없으면 통상임금으로 계산하고 알린다', () => {
  const e = severanceEstimate(prof, [], '2026-10-20', 0);
  assert.equal(e.avgDailyWage, 0);
  assert.equal(e.dailyWageUsed, 96000);
  assert.equal(e.amount, 7590575);
  assert.match(e.reason ?? '', /급여대장이 없어/);
});

test('퇴직금 — 다른 직원의 급여 줄은 쓰지 않는다', () => {
  const mixed = [...lines, L('2026-09', 99999999, 2)];
  assert.equal(severanceEstimate(prof, mixed, '2026-10-20', 1200000).avgDailyWage, 94565);
});

test('퇴직금 — 퇴직일이 1월이면 직전 해 10~12월을 본다(92일), 2월 퇴직은 11~1월', () => {
  const winter = [L('2025-10', 3100000), L('2025-11', 3000000), L('2025-12', 3100000)];
  const e = severanceEstimate({ ...prof, hireDate: '2020-01-01' }, winter, '2026-01-10', 0);
  assert.equal(e.avgDailyWage, Math.floor(9200000 / 92));
  // 2028-03 퇴직(윤년): 12·1·2월 = 31+31+29 = 91일
  const leap = [L('2027-12', 3000000), L('2028-01', 3000000), L('2028-02', 3000000)];
  assert.equal(severanceEstimate({ ...prof, hireDate: '2020-01-01' }, leap, '2028-03-05', 0).avgDailyWage, Math.floor(9000000 / 91));
});

test('퇴직금 — 시급제 단시간 근로자(주 20시간, 시급 12,000) 정수 계산', () => {
  const p = { memberId: 3, hireDate: '2023-01-01', weeklyHours: 20, payType: 'HOURLY' as const, baseAmount: 12000 };
  const ls = [L('2026-07', 1000000, 3), L('2026-08', 1000000, 3), L('2026-09', 1000000, 3)];
  const e = severanceEstimate(p, ls, '2026-10-20', 0);
  assert.equal(e.ordinaryDailyWage, 48000);
  assert.equal(e.avgDailyWage, Math.floor(3000000 / 92));
  assert.equal(e.dailyWageUsed, 48000);
  // 재직 1388일: 48,000 × 30 × 1388 ÷ 365 = 5,479,... 절사
  assert.equal(e.serviceDays, 1388);
  assert.equal(e.amount, Math.floor((48000 * 30 * 1388) / 365));
});

test('퇴직금 — 입사일·퇴직일이 틀리면 대상 아님, 퇴직일이 입사일보다 앞서면 재직일수 0', () => {
  const bad = severanceEstimate({ ...prof, hireDate: '2024-13-01' }, lines, '2026-10-20', 0);
  assert.equal(bad.eligible, false);
  assert.equal(bad.serviceDays, 0);
  assert.match(bad.reason ?? '', /올바르지 않습니다/);
  const early = severanceEstimate(prof, lines, '2023-01-01', 0);
  assert.deepEqual([early.eligible, early.serviceDays, early.amount], [false, 0, 0]);
});

test('퇴직금 — 큰 금액도 부동소수 없이 정수로(일급 1,000,000 × 30 × 10,000일)', () => {
  const p = { memberId: 1, hireDate: '1998-06-01', weeklyHours: 40, payType: 'HOURLY' as const, baseAmount: 125000 };
  const e = severanceEstimate(p, [], '2026-10-20', 0);
  assert.equal(e.ordinaryDailyWage, 1_000_000);
  assert.equal(e.amount, Math.floor((1_000_000 * 30 * e.serviceDays) / 365));
  assert.ok(Number.isInteger(e.amount));
});

test('퇴직금 추계 합 — 대상 아닌 직원은 0, 급여대장이 없는 직원도 계산', () => {
  const liab = severanceLiability([prof, { ...prof, memberId: 2, hireDate: '2026-05-01' }], { 1: lines, 2: [] }, '2026-10-20');
  assert.deepEqual([liab.total, liab.members.map((m) => [m.memberId, m.eligible, m.amount])], [7590575, [[1, true, 7590575], [2, false, 0]]]);
  const none = severanceLiability([], {}, '2026-10-20');
  assert.deepEqual(none, { members: [], total: 0 });
  // 급여대장 항목이 없는 직원: 통상임금만으로 계산
  assert.equal(severanceLiability([prof], {}, '2026-10-20').total, 7590575);
});
