/**
 * 감염병 대응 기록 규칙 테스트 — `node --test src/lib/lab/outbreakRules.test.ts`
 * 왜: 보건소 신고·지자체·공단 보고가 비었는지와 진행 일수를 잘못 세면 오늘 확인할 것과 평가 근거가 틀어진다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { OUTBREAK_ACTIONS, OUTBREAK_GAP_LABEL, outbreakCheck, outbreakSummary } from './outbreakRules.ts';

type O = Parameters<typeof outbreakCheck>[0];
const OB = (over: Partial<O> = {}): O => ({ kind: 'CASE', startedOn: '2026-09-01', endedOn: null, guardianNotifiedOn: null, healthCenterReportedOn: null, authorityReportedOn: null, actions: [], ...over });

test('조치는 열한 가지, 정해진 순서', () => {
  assert.equal(OUTBREAK_ACTIONS.length, 11);
  assert.equal(OUTBREAK_ACTIONS[0].key, 'VISIT_LIMIT');
  assert.equal(OUTBREAK_ACTIONS[10].key, 'ACTIVITY_STOP');
  assert.equal(new Set(OUTBREAK_ACTIONS.map((a) => a.key)).size, 11);
});

test('outbreakCheck — 빠진 신고는 보호자·보건소·지자체·공단 순서', () => {
  assert.deepEqual(outbreakCheck(OB(), '2026-09-10').missing, ['GUARDIAN', 'HEALTH_CENTER', 'AUTHORITY']);
  assert.deepEqual(outbreakCheck(OB({ guardianNotifiedOn: '2026-09-01' }), '2026-09-10').missing, ['HEALTH_CENTER', 'AUTHORITY']);
  assert.deepEqual(outbreakCheck(OB({ guardianNotifiedOn: '2026-09-01', healthCenterReportedOn: '2026-09-01' }), '2026-09-10').missing, ['AUTHORITY']);
  assert.deepEqual(outbreakCheck(OB({ guardianNotifiedOn: '2026-09-01', healthCenterReportedOn: '2026-09-01', authorityReportedOn: '2026-09-02' }), '2026-09-10').missing, []);
  assert.equal(OUTBREAK_GAP_LABEL.HEALTH_CENTER, '보건소 신고일');
});

test('outbreakCheck — 날짜가 올바르지 않거나 빈 글이면 비어 있는 것', () => {
  const r = outbreakCheck(OB({ guardianNotifiedOn: '', healthCenterReportedOn: '2026-02-30', authorityReportedOn: '2026-09-02' }), '2026-09-10');
  assert.deepEqual(r.missing, ['GUARDIAN', 'HEALTH_CENTER']);
});

test('outbreakCheck — 국가 위기 경보는 신고 칸을 요구하지 않는다', () => {
  assert.deepEqual(outbreakCheck(OB({ kind: 'NATIONAL' }), '2026-09-10').missing, []);
});

test('outbreakCheck — 진행 중이면 asOf까지 일수, 종료됐으면 종료일까지 일수', () => {
  assert.deepEqual([outbreakCheck(OB(), '2026-09-10').open, outbreakCheck(OB(), '2026-09-10').daysOpen], [true, 9]);
  const ended = outbreakCheck(OB({ endedOn: '2026-09-20' }), '2026-12-31');
  assert.deepEqual([ended.open, ended.daysOpen], [false, 19]);
});

test('outbreakCheck — 시작 당일은 0일, 종료일이 시작일과 같아도 0일', () => {
  assert.equal(outbreakCheck(OB(), '2026-09-01').daysOpen, 0);
  assert.equal(outbreakCheck(OB({ endedOn: '2026-09-01' }), '2026-09-30').daysOpen, 0);
});

test('outbreakCheck — asOf가 시작보다 앞서도 음수가 나오지 않는다', () => {
  assert.equal(outbreakCheck(OB(), '2026-08-01').daysOpen, 0);
});

test('outbreakCheck — 해를 넘기는 진행 일수(국가 위기 221일)', () => {
  assert.equal(outbreakCheck(OB({ kind: 'NATIONAL', startedOn: '2026-02-01' }), '2026-09-10').daysOpen, 221);
  assert.equal(outbreakCheck(OB({ startedOn: '2025-12-30' }), '2026-01-02').daysOpen, 3);
});

test('outbreakCheck — 종료일이 올바르지 않은 날짜면 진행 중으로 본다', () => {
  assert.equal(outbreakCheck(OB({ endedOn: '2026-13-40' }), '2026-09-10').open, true);
});

test('outbreakSummary — 시작일이 범위 안인 기록만(양 끝 날짜 포함)', () => {
  const list = [OB({ startedOn: '2026-01-01' }), OB({ startedOn: '2026-12-31' }), OB({ startedOn: '2025-12-31' }), OB({ startedOn: '2027-01-01' })];
  assert.equal(outbreakSummary(list, '2026-01-01', '2026-12-31', '2026-09-10').total, 2);
});

test('outbreakSummary — 진행 중·완비·조치 있음을 센다', () => {
  const done = { guardianNotifiedOn: '2026-09-01', healthCenterReportedOn: '2026-09-01', authorityReportedOn: '2026-09-02' };
  const list = [OB({ ...done, actions: ['VISIT_LIMIT'], endedOn: '2026-09-05' }), OB({ actions: ['ISOLATION', 'MASK_HAND'] }), OB({ kind: 'NATIONAL' })];
  const r = outbreakSummary(list, '2026-01-01', '2026-12-31', '2026-09-10');
  assert.deepEqual([r.total, r.open, r.complete, r.withActions], [3, 2, 2, 2]);
});

test('outbreakSummary — 빈 목록·범위 밖이면 모두 0', () => {
  assert.deepEqual(outbreakSummary([], '2026-01-01', '2026-12-31', '2026-09-10'), { total: 0, open: 0, complete: 0, withActions: 0 });
});
