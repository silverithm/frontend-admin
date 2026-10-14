/**
 * 인력배치 규칙 테스트 — `node --test src/lib/lab/staffingRules.test.ts`
 * 왜: 월 기준 시간·결원·소수 처리가 한 칸만 틀려도 감산 위험 안내가 달라진다. 3 − 2.9 같은 부동소수 오차도 막는다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import type { StaffJobType } from './labTypes.ts';
import {
  KR_HOLIDAYS_2026,
  STAFF_GROUPS,
  defaultHolidays,
  monthlyUsers,
  penaltyScoreOf,
  prefillHours,
  previousMonth,
  requiredStaff,
  staffGroupOf,
  staffingCheck,
  staffingFte,
  standardMonthlyHours,
  weekdaysInMonth,
} from './staffingRules.ts';

const S = (jobType: StaffJobType, hours: number) => ({ memberId: null, name: `${jobType}${hours}`, jobType, hours });
const cg = (hours: number[], std = 160) => staffingFte(hours.map((h) => S('CAREGIVER', h)), std).CAREGIVER;
const BASE = [S('DIRECTOR', 160), S('SOCIAL_WORKER', 160), S('NURSE_AIDE', 160), S('COOK', 160), S('DRIVER', 80)];

test('직종 묶음 — 간호·조무·치료사는 한 묶음, 기타는 세지 않는다', () => {
  assert.equal(STAFF_GROUPS.length, 7);
  assert.equal(staffGroupOf('NURSE'), 'NURSING');
  assert.equal(staffGroupOf('NURSE_AIDE'), 'NURSING');
  assert.equal(staffGroupOf('THERAPIST'), 'NURSING');
  assert.equal(staffGroupOf('OTHER'), null);
  assert.equal(staffGroupOf('???'), null);
});

test('2026 공휴일 — 대체공휴일·추석·한글날이 들어 있고 모두 올바른 날짜 모양이다', () => {
  for (const d of ['2026-02-16', '2026-02-17', '2026-02-18', '2026-03-02', '2026-05-25', '2026-08-17', '2026-09-24', '2026-09-26', '2026-10-05', '2026-10-09', '2026-12-25', '2026-01-01']) {
    assert.ok(KR_HOLIDAYS_2026.includes(d), d);
  }
  assert.ok(!KR_HOLIDAYS_2026.includes('2026-05-01'), '근로자의 날은 공휴일 목록이 아니라 따로 뺀다');
  assert.equal(new Set(KR_HOLIDAYS_2026).size, KR_HOLIDAYS_2026.length);
  for (const d of KR_HOLIDAYS_2026) assert.match(d, /^2026-\d{2}-\d{2}$/);
  assert.deepEqual(defaultHolidays('2026-10'), ['2026-10-03', '2026-10-05', '2026-10-09']);
  assert.deepEqual(defaultHolidays('2027-10'), []);
});

test('월 기준 근무시간 — 10월(대체공휴일·한글날) 160, 5월(근로자의 날·어린이날·대체) 144', () => {
  assert.equal(standardMonthlyHours('2026-10', ['2026-10-03', '2026-10-05', '2026-10-09']), 160);
  assert.equal(standardMonthlyHours('2026-05', ['2026-05-05', '2026-05-25']), 144);
});

test('월 기준 근무시간 — 근로자의 날은 공휴일을 안 넣어도 빠지고, 토·일·다른 달·중복 날짜는 영향 없다', () => {
  // 5월 1일은 금요일: 21일 − 근로자의 날 = 20일
  assert.equal(standardMonthlyHours('2026-05', []), 160);
  assert.equal(standardMonthlyHours('2026-10', ['2026-10-03', '2026-10-03', '2026-09-24', '2026-11-02']), 176);
  assert.equal(standardMonthlyHours('2026-10', ['2026-10-05', '2026-10-05']), 168);
});

test('월 기준 근무시간 — 윤년 2월(2028-02: 29일, 화요일 시작)과 평년 2월', () => {
  assert.equal(weekdaysInMonth('2028-02'), 21);
  assert.equal(standardMonthlyHours('2028-02', []), 168);
  assert.equal(weekdaysInMonth('2026-02'), 20);
  assert.equal(standardMonthlyHours('2026-02', ['2026-02-16', '2026-02-17', '2026-02-18']), 136);
});

test('월 기준 근무시간 — 잘못된 달은 0', () => {
  assert.equal(standardMonthlyHours('2026-13', []), 0);
  assert.equal(standardMonthlyHours('abc', []), 0);
});

test('이전 달 — 1월은 전년 12월', () => {
  assert.equal(previousMonth('2026-10'), '2026-09');
  assert.equal(previousMonth('2026-01'), '2025-12');
  assert.equal(previousMonth('2026-1'), null);
});

test('월별 입소자 수 — 반올림(436÷22=19.8→20, 429÷22=19.5→20), 경계 .5는 올림', () => {
  assert.equal(monthlyUsers(436, 22), 20);
  assert.equal(monthlyUsers(429, 22), 20);
  assert.equal(monthlyUsers(428, 22), 19);
  assert.equal(monthlyUsers(5, 2), 3);
  assert.equal(monthlyUsers(0, 22), 0);
  assert.equal(monthlyUsers(100, 0), 0);
});

test('배치 기준 — 10명 이상: 20명, 25명(사무원 1명), 9명 이하', () => {
  assert.deepEqual(requiredStaff(20), { DIRECTOR: 1, SOCIAL_WORKER: 1, NURSING: 1, CAREGIVER: 3, OFFICE: 0, COOK: 1, DRIVER: 1 });
  assert.deepEqual([requiredStaff(25).CAREGIVER, requiredStaff(25).OFFICE], [4, 1]);
  assert.equal(requiredStaff(24).OFFICE, 0);
  assert.deepEqual(requiredStaff(8), { DIRECTOR: 1, SOCIAL_WORKER: 0, NURSING: 1, CAREGIVER: 1, OFFICE: 0, COOK: 1, DRIVER: 0 });
  assert.equal(requiredStaff(10).SOCIAL_WORKER, 1);
  assert.equal(requiredStaff(9).SOCIAL_WORKER, 0);
});

test('배치 기준 — 요양보호사는 7명당 반올림, 0.5 미만(1~3명)은 기본 1명', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 10, 11, 17, 18, 21, 24].map((n) => requiredStaff(n).CAREGIVER), [1, 1, 1, 1, 1, 1, 2, 2, 3, 3, 3]);
});

test('배치 기준 — 0명이면 모두 0, 음수·소수 입력도 안전하게', () => {
  assert.ok(Object.values(requiredStaff(0)).every((v) => v === 0));
  assert.ok(Object.values(requiredStaff(-3)).every((v) => v === 0));
  assert.ok(Object.values(requiredStaff(Number.NaN)).every((v) => v === 0));
  assert.equal(requiredStaff(20.4).CAREGIVER, 3);
});

test('근무인원 — 2.95는 감액용 2.9, 가산용 2', () => {
  const r = cg([160, 168, 80, 72]);
  assert.deepEqual([r.full, r.partialHours, r.forPenalty, r.forBonus], [2, 152, 2.9, 2]);
  assert.ok(Math.abs(r.raw - 2.95) < 1e-9);
});

test('근무인원 — 2.75는 2.7, 2.375는 첫째 자리 3이라 2.0, 2.45는 2.0, 2.5는 2.5', () => {
  assert.equal(cg([160, 168, 80, 40]).forPenalty, 2.7);
  assert.equal(cg([160, 168, 60]).forPenalty, 2);
  assert.equal(cg([160, 168, 72]).forPenalty, 2);
  assert.equal(cg([160, 168, 80]).forPenalty, 2.5);
  assert.equal(cg([160, 168, 144]).forPenalty, 2.9);
  assert.equal(cg([160, 168, 79.9]).forPenalty, 2.0);
});

test('근무인원 — 못 미친 사람들의 시간을 합쳐 1명 이상이 되면 가산용도 올라간다(60+60+60+60 = 1.5명)', () => {
  const r = cg([60, 60, 60, 60]);
  assert.deepEqual([r.full, r.partialHours, r.forPenalty, r.forBonus], [0, 240, 1.5, 1]);
});

test('근무인원 — 기준 시간을 정확히 채우면 1명, 1시간 모자라면 0.99라 0.9', () => {
  assert.equal(cg([160]).forPenalty, 1);
  assert.equal(cg([159]).forPenalty, 0.9);
  assert.equal(cg([159.9]).forPenalty, 0.9);
});

test('근무인원 — 시간 0·음수·NaN은 세지 않고, 기준 시간 0이면 모두 0', () => {
  assert.equal(cg([0, -5, Number.NaN]).forPenalty, 0);
  assert.equal(cg([160, 160], 0).forPenalty, 0);
});

test('근무인원 — 운전사는 시간 합이 기준의 50% 이상이면 1명, 49.9%는 규칙 밖(0.4)', () => {
  assert.equal(staffingFte([S('DRIVER', 80)], 160).DRIVER.raw, 1);
  assert.equal(staffingFte([S('DRIVER', 40), S('DRIVER', 40)], 160).DRIVER.forPenalty, 1);
  const low = staffingFte([S('DRIVER', 79.9)], 160).DRIVER;
  assert.equal(low.forPenalty, 0);
  assert.equal(low.forBonus, 0);
});

test('근무인원 — 간호사·간호조무사·치료사는 합산, 기타 직종은 세지 않는다', () => {
  assert.equal(staffingFte([S('NURSE', 80), S('THERAPIST', 80)], 160).NURSING.forPenalty, 1);
  assert.equal(staffingFte([S('NURSE', 160), S('NURSE_AIDE', 160), S('THERAPIST', 160)], 160).NURSING.full, 3);
  assert.equal(staffingFte([S('OTHER', 400)], 160).CAREGIVER.forPenalty, 0);
});

test('감산점수 — 결원 0.1~0.2명 0.3점, 0.3~0.5명 1점, 1명 3점, 1.5명 4점, 2명 6점', () => {
  assert.deepEqual([0, 0.1, 0.2, 0.3, 0.5, 1, 1.5, 2].map(penaltyScoreOf), [0, 0.3, 0.3, 1, 1, 3, 4, 6]);
  assert.equal(penaltyScoreOf(1.1), 3.3);
  assert.equal(penaltyScoreOf(2.3), 7);
});

test('감산점수 — 3 − 2.9의 부동소수 오차가 0.3점 구간을 벗어나지 않는다', () => {
  assert.notEqual(3 - 2.9, 0.1, '부동소수 오차가 실제로 있는 값');
  assert.equal(penaltyScoreOf(3 - 2.9), 0.3);
  assert.equal(penaltyScoreOf(3 - 2.7), 1);
  assert.equal(penaltyScoreOf(-1), 0);
  assert.equal(penaltyScoreOf(Number.NaN), 0);
});

test('인력 점검 — 요양보호사 1명 결원이면 3점·감액률 22.5%·위반', () => {
  const c = staffingCheck({ users: 20, standardHours: 160, staff: [...BASE, S('CAREGIVER', 160), S('CAREGIVER', 168), S('CAREGIVER', 60)] });
  const row = c.rows.find((r) => r.group === 'CAREGIVER')!;
  assert.deepEqual([row.required, row.fte, row.shortfall, row.penaltyScore], [3, 2, 1, 3]);
  assert.deepEqual([c.penaltyScoreSum, c.typeScore, c.multiplier, c.penaltyRate, c.violated], [3, 1.5, 1, 22.5, true]);
  assert.deepEqual([c.caregiverPerHead, c.nursePerHead], [10, 20]);
});

test('인력 점검 — 직전 달도 위반이면 1.2배(30명 미만)·1.5배(30명 이상)', () => {
  const staff = [...BASE, S('CAREGIVER', 160), S('CAREGIVER', 168), S('CAREGIVER', 60)];
  assert.equal(staffingCheck({ users: 20, standardHours: 160, staff, previousViolated: true }).penaltyRate, 27);
  const c = staffingCheck({ users: 20, standardHours: 160, staff, previousViolated: true });
  assert.deepEqual([c.multiplier, c.adjustedScoreSum], [1.2, 3.6]);
  const big = staffingCheck({ users: 30, standardHours: 160, staff: [], previousViolated: true });
  assert.equal(big.multiplier, 1.5);
});

test('인력 점검 — 배수를 곱한 점수는 소수 둘째 자리 이하를 버린다(0.3 × 1.2 = 0.36 → 0.3)', () => {
  // 요양보호사 2.9명(결원 0.1) — 다른 직종은 충족
  const staff = [...BASE, S('CAREGIVER', 160), S('CAREGIVER', 168), S('CAREGIVER', 144)];
  const c = staffingCheck({ users: 20, standardHours: 160, staff, previousViolated: true });
  assert.deepEqual([c.penaltyScoreSum, c.adjustedScoreSum], [0.3, 0.3]);
});

test('인력 점검 — 기준을 채우면 위반 아님·감액률 0, 요양보호사 1인당 5명이라 6.4명 미만 가산 안내', () => {
  const c = staffingCheck({ users: 20, standardHours: 160, staff: [...BASE, ...[1, 2, 3, 4].map(() => S('CAREGIVER', 160))] });
  assert.deepEqual([c.violated, c.penaltyRate, c.caregiverPerHead], [false, 0, 5]);
  assert.ok(c.bonusHints.some((h) => /6\.4/.test(h)));
});

test('인력 점검 — 기준에 딱 맞게만 두면 가산 안내가 없다(요양보호사 3명이면 1인당 6.666명)', () => {
  const c = staffingCheck({ users: 20, standardHours: 160, staff: [...BASE, ...[1, 2, 3].map(() => S('CAREGIVER', 160))] });
  assert.equal(c.violated, false);
  assert.equal(c.caregiverPerHead, 6.666);
  assert.deepEqual(c.bonusHints, []);
});

test('인력 점검 — 간호(조무)사를 2명 두면 1인당 10명이라 19.0명 미만 안내', () => {
  const c = staffingCheck({ users: 20, standardHours: 160, staff: [...BASE, S('NURSE', 160), ...[1, 2, 3].map(() => S('CAREGIVER', 160))] });
  assert.equal(c.nursePerHead, 10);
  assert.ok(c.bonusHints.some((h) => /19\.0/.test(h)));
});

test('인력 점검 — 결원이 있는 직종은 가산 안내를 하지 않는다', () => {
  const c = staffingCheck({ users: 20, standardHours: 160, staff: [...BASE, ...[1, 2, 3, 4].map(() => S('CAREGIVER', 160))].filter((s) => s.jobType !== 'DIRECTOR') });
  assert.equal(c.violated, true);
  assert.ok(c.bonusHints.some((h) => /요양보호사/.test(h)), '요양보호사 자체는 결원이 없으니 안내');
});

test('인력 점검 — 직종마다 결원이 있으면 직종별로 계산해 합산(시설장·조리원 결원 = 6점)', () => {
  const staff = [S('SOCIAL_WORKER', 160), S('NURSE', 160), S('DRIVER', 160), ...[1, 2, 3].map(() => S('CAREGIVER', 160))];
  const c = staffingCheck({ users: 20, standardHours: 160, staff });
  assert.deepEqual(c.rows.filter((r) => r.penaltyScore > 0).map((r) => r.group), ['DIRECTOR', 'COOK']);
  assert.equal(c.penaltyScoreSum, 6);
  // 6 × 1.5 ÷ 20 × 100 = 45%
  assert.equal(c.penaltyRate, 45);
});

test('인력 점검 — 입소자 10명 미만 유형점수 1.2, 50명 이상 2', () => {
  assert.equal(staffingCheck({ users: 9, standardHours: 160, staff: [] }).typeScore, 1.2);
  assert.equal(staffingCheck({ users: 10, standardHours: 160, staff: [] }).typeScore, 1.5);
  assert.equal(staffingCheck({ users: 49, standardHours: 160, staff: [] }).typeScore, 1.5);
  assert.equal(staffingCheck({ users: 50, standardHours: 160, staff: [] }).typeScore, 2);
});

test('인력 점검 — 사무원은 배치 기준에는 있으나 감산 대상 직종이 아니다(25명)', () => {
  const c = staffingCheck({ users: 25, standardHours: 160, staff: [] });
  const office = c.rows.find((r) => r.group === 'OFFICE')!;
  assert.deepEqual([office.required, office.shortfall, office.penaltyScore, office.penalized], [1, 1, 0, false]);
});

test('인력 점검 — 입소자 0명이면 기준·결원·감액률 모두 0이고 1인당 입소자는 근무인원 없으면 null', () => {
  const c = staffingCheck({ users: 0, standardHours: 160, staff: [S('CAREGIVER', 160)] });
  assert.equal(c.violated, false);
  assert.equal(c.penaltyRate, 0);
  assert.ok(c.rows.every((r) => r.required === 0 && r.shortfall === 0));
  assert.deepEqual(c.bonusHints, []);
  assert.equal(staffingCheck({ users: 20, standardHours: 160, staff: [] }).caregiverPerHead, null);
});

test('인력 점검 — 감액률은 소수 첫째 자리 반올림(3점, 입소자 7명, 유형 1.2 → 51.428… → 51.4)', () => {
  // 7명: 요양보호사 1명 필요·0명 = 3점, 시설장 1·간호 1·조리원 1은 채움
  const staff = [S('DIRECTOR', 160), S('NURSE', 160), S('COOK', 160)];
  const c = staffingCheck({ users: 7, standardHours: 160, staff });
  assert.deepEqual([c.penaltyScoreSum, c.typeScore], [3, 1.2]);
  // 3 × 1.2 ÷ 7 × 100 = 51.428… → 51.4
  assert.equal(c.penaltyRate, 51.4);
});

test('근무시간 채우기 — 주 40시간 이상은 기준 시간 전부, 20시간은 절반, 소수 첫째 자리 반올림', () => {
  assert.deepEqual([prefillHours(40, 160), prefillHours(20, 160), prefillHours(45, 160)], [160, 80, 160]);
  assert.equal(prefillHours(15, 144), 54);
  assert.equal(prefillHours(30, 152), 114);
  assert.equal(prefillHours(0, 160), 0);
  assert.equal(prefillHours(40, 0), 0);
  assert.equal(prefillHours(13, 168), 54.6);
});
