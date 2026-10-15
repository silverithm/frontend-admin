/**
 * 송영 규칙 테스트 — `node --test src/lib/lab/transportRules.test.ts`
 * 왜: 차량 보험 만기를 하루 잘못 세면 무보험 운행을 놓치고, 수칙 제공 범위를 잘못 세면 평가에서 미제공으로 지적된다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { TRANSPORT_RULE_ITEMS, insuranceStatus, recentMonths, ridersBetween, ruleDeliveryCoverage, timetableMonths, transportLogCoverage, type DeliveryShape, type InsuranceVehicle, type LogShape } from './transportRules.ts';

const VH = (o: Partial<InsuranceVehicle> = {}): InsuranceVehicle => ({ insuranceFrom: '2026-01-01', insuranceTo: '2026-11-14', comprehensive: true, ...o });
const AS = '2026-10-15';
const D = (elderlyId: number, kind: DeliveryShape['kind'], deliveredOn: string): DeliveryShape => ({ elderlyId, kind, deliveredOn });
const L = (runDate: string, riders: Array<[number, boolean]>, driverMemberId: number | null = 10): LogShape => ({ runDate, driverMemberId, riders: riders.map(([elderlyId, boarded]) => ({ elderlyId, boarded })) });

test('수칙 네 가지 항목 키와 라벨', () => {
  assert.deepEqual(TRANSPORT_RULE_ITEMS.map((i) => i.key), ['driverQualification', 'escortRole', 'vehicleSafety', 'accidentResponse']);
  assert.deepEqual(TRANSPORT_RULE_ITEMS.map((i) => i.label), ['운전자 자격요건', '동승자의 역할', '차량안전수칙', '사고 시 조치사항']);
});

test('보험: 만기까지 30일은 EXPIRING, 31일은 OK (10/15 → 11/14·11/15)', () => {
  assert.equal(insuranceStatus(VH({ insuranceTo: '2026-11-14' }), AS), 'EXPIRING');
  assert.equal(insuranceStatus(VH({ insuranceTo: '2026-11-15' }), AS), 'OK');
});

test('보험: 만기 당일은 아직 유효(EXPIRING), 하루 지나면 EXPIRED', () => {
  assert.equal(insuranceStatus(VH({ insuranceTo: '2026-10-15' }), AS), 'EXPIRING');
  assert.equal(insuranceStatus(VH({ insuranceTo: '2026-10-14' }), AS), 'EXPIRED');
});

test('보험: 시작일 당일부터 유효, 시작 전날은 NOT_STARTED', () => {
  assert.equal(insuranceStatus(VH({ insuranceFrom: '2026-10-15', insuranceTo: '2027-10-14' }), AS), 'OK');
  assert.equal(insuranceStatus(VH({ insuranceFrom: '2026-10-16', insuranceTo: '2027-10-15' }), AS), 'NOT_STARTED');
});

test('보험: 판정 순서 — 기록 없음이 종합보험 아님보다 먼저, 종합보험 아님이 만료보다 먼저', () => {
  assert.equal(insuranceStatus(VH({ insuranceFrom: null, comprehensive: false }), AS), 'MISSING');
  assert.equal(insuranceStatus(VH({ insuranceTo: null }), AS), 'MISSING');
  assert.equal(insuranceStatus(VH({ comprehensive: false, insuranceTo: '2026-01-31' }), AS), 'NOT_COMPREHENSIVE');
});

test('보험: 만기가 연말을 건너도 일수를 바르게 센다(12/2 → 다음 해 1/1은 30일)', () => {
  assert.equal(insuranceStatus(VH({ insuranceFrom: '2026-01-01', insuranceTo: '2027-01-01' }), '2026-12-02'), 'EXPIRING');
  assert.equal(insuranceStatus(VH({ insuranceFrom: '2026-01-01', insuranceTo: '2027-01-02' }), '2026-12-02'), 'OK');
});

test('수칙 제공: 개정일 당일 제공은 인정, 개정 전 제공은 다시 제공해야 한다', () => {
  const dels = [D(1, 'TRANSPORT_RULES', '2026-03-01'), D(2, 'TRANSPORT_RULES', '2025-12-01'), D(3, 'TIMETABLE', '2026-05-01'), D(4, 'TRANSPORT_RULES', '2026-02-01')];
  const r = ruleDeliveryCoverage([1, 2, 3, 4], dels, '2026-02-01');
  assert.deepEqual([r.total, r.delivered, r.missing], [4, 2, [2, 3]]);
});

test('수칙 제공: 개정일이 없으면 아무 때 제공이든 인정, 운행표 제공은 수칙 제공이 아니다', () => {
  const dels = [D(1, 'TRANSPORT_RULES', '2024-03-01'), D(3, 'TIMETABLE', '2026-05-01')];
  assert.deepEqual(ruleDeliveryCoverage([1, 3], dels, null).missing, [3]);
});

test('수칙 제공: 탑승 어르신이 없으면 total 0, 중복 id는 한 명', () => {
  assert.deepEqual(ruleDeliveryCoverage([], [], null), { total: 0, delivered: 0, missing: [] });
  assert.equal(ruleDeliveryCoverage([5, 5], [], null).total, 1);
});

test('운행표 제공 달: 달마다 건수와 제공된 달 수, 수칙 제공은 세지 않는다', () => {
  const t = timetableMonths([D(1, 'TIMETABLE', '2026-08-03'), D(2, 'TIMETABLE', '2026-08-31'), D(1, 'TIMETABLE', '2026-09-01'), D(1, 'TRANSPORT_RULES', '2026-10-01')], ['2026-08', '2026-09', '2026-10']);
  assert.deepEqual(t.byMonth, [{ month: '2026-08', count: 2 }, { month: '2026-09', count: 1 }, { month: '2026-10', count: 0 }]);
  assert.equal(t.covered, 2);
});

test('최근 달 목록: 연초에는 지난해 달로 이어진다', () => {
  assert.deepEqual(recentMonths('2026-02-10', 3), ['2025-12', '2026-01', '2026-02']);
  assert.deepEqual(recentMonths('2026-10-15', 3), ['2026-08', '2026-09', '2026-10']);
});

test('운행일지 작성률: 출석 3일 중 2일 작성, 그중 1일만 운전원·탑승 갖춤 → 66.7%', () => {
  const logs = [L('2026-09-01', [[1, true], [3, true]]), L('2026-09-01', [[1, true]]), L('2026-09-02', [[1, false]]), L('2026-08-31', [[5, true]])];
  const r = transportLogCoverage(logs, ['2026-09-01', '2026-09-02', '2026-09-03', '2026-08-31'], '2026-09');
  assert.deepEqual([r.days, r.logged, r.complete, r.rate], [3, 2, 1, 66.7]);
});

test('운행일지 작성률: 같은 날 일지가 둘인데 하나라도 운전원이 없으면 그날은 완결이 아니다', () => {
  const logs = [L('2026-09-01', [[1, true]], 10), L('2026-09-01', [[2, true]], null)];
  assert.equal(transportLogCoverage(logs, ['2026-09-01'], '2026-09').complete, 0);
});

test('운행일지 작성률: 출석 날이 없으면 rate는 null, 같은 출석 날짜가 겹쳐도 하루', () => {
  assert.deepEqual(transportLogCoverage([], [], '2026-09'), { days: 0, logged: 0, complete: 0, rate: null });
  assert.equal(transportLogCoverage([], ['2026-09-01', '2026-09-01'], '2026-09').days, 1);
});

test('운행일지 작성률: 출석이 없던 날의 일지는 작성 건수에 세지 않는다, 달 첫날·마지막 날 포함', () => {
  const logs = [L('2026-09-15', [[1, true]]), L('2026-09-01', [[1, true]]), L('2026-09-30', [[1, true]])];
  const r = transportLogCoverage(logs, ['2026-09-01', '2026-09-30'], '2026-09');
  assert.deepEqual([r.days, r.logged, r.rate], [2, 2, 100]);
});

test('기간 탑승 어르신: 양 끝 포함, 탑승(boarded=true)만, 중복 없이 오름차순', () => {
  const logs = [L('2026-09-01', [[3, true], [1, true]]), L('2026-09-30', [[2, true]]), L('2026-09-02', [[9, false]]), L('2026-08-31', [[5, true]]), L('2026-10-01', [[6, true]]), L('2026-09-05', [[1, true]])];
  assert.deepEqual(ridersBetween(logs, '2026-09-01', '2026-09-30'), [1, 2, 3]);
});
