/**
 * 투약 규칙 테스트 — `node --test src/lib/lab/medicationRules.test.ts`
 * 왜: 오늘 투약 목록이 한 칸 어긋나면 약을 빠뜨리거나(끝난 의뢰·아직 시작 안 한 의뢰) 결석자에게 약을 준비하게 된다. 날짜·시간대 경계를 손으로 센 값과 맞춘다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_MEDICINES,
  ROUTES,
  SIX_RIGHTS,
  SLOTS,
  TIMINGS,
  doseStatus,
  dosesDue,
  expiringStock,
  isRoute,
  isSlot,
  isTiming,
  missedQuarters,
  quarterChecks,
  requestIssues,
  routeLabel,
  slotLabel,
  timingLabel,
} from './medicationRules.ts';
import type { MedicationItem } from './labTypes.ts';

const med = (name: string, slots: MedicationItem['slots']): MedicationItem => ({ name, dose: '1정', route: 'ORAL', slots, timing: 'AFTER_MEAL', note: '' });
const req = (id: number, elderlyId: number, o: Partial<{ status: 'ACTIVE' | 'ENDED'; startDate: string; endDate: string | null; medicines: MedicationItem[] }> = {}) => ({
  id,
  elderlyId,
  status: 'ACTIVE' as const,
  startDate: '2026-10-01',
  endDate: null,
  medicines: [med('아모디핀', ['MORNING', 'LUNCH'])],
  ...o,
});
const shape = (list: ReturnType<typeof dosesDue>) => list.map((d) => [d.requestId, d.elderlyId, d.slot, d.medicines.map((m) => m.name)]);

test('라벨 목록 — 시간대 네 개·경로·식전후, 모르는 값은 그대로', () => {
  assert.deepEqual(SLOTS.map((s) => s.label), ['아침', '점심', '저녁', '자기 전']);
  assert.equal(ROUTES.length, 5);
  assert.equal(TIMINGS.length, 4);
  assert.equal(slotLabel('BEDTIME'), '자기 전');
  assert.equal(routeLabel('EYE'), '안약(점안)');
  assert.equal(timingLabel('WITH_MEAL'), '식사 중');
  assert.equal(slotLabel('X'), 'X');
  assert.equal(isSlot('LUNCH'), true);
  assert.equal(isSlot('NOON'), false);
  assert.equal(isRoute('PILL'), false);
  assert.equal(isTiming('ANYTIME'), true);
});

test('투약 6원칙은 여섯 문장이고 대상자로 시작해 기록으로 끝난다', () => {
  assert.equal(SIX_RIGHTS.length, 6);
  assert.match(SIX_RIGHTS[0], /대상자/);
  assert.match(SIX_RIGHTS[5], /기록/);
  assert.equal(MAX_MEDICINES, 15);
});

test('dosesDue — 시간대마다 하나, 그 시간대 약만, 어르신·시간대 순', () => {
  const list = dosesDue([req(2, 2, { medicines: [med('나', ['BEDTIME', 'MORNING'])] }), req(1, 1, { medicines: [med('가', ['EVENING']), med('다', ['MORNING', 'EVENING'])] })], '2026-10-15');
  assert.deepEqual(shape(list), [[1, 1, 'MORNING', ['다']], [1, 1, 'EVENING', ['가', '다']], [2, 2, 'MORNING', ['나']], [2, 2, 'BEDTIME', ['나']]]);
  assert.ok(list.every((d) => d.date === '2026-10-15'));
});

test('dosesDue — 시작 전·끝난 뒤는 빼고, 끝난 의뢰도 기간 안이면 센다(양 끝 포함)', () => {
  const reqs = [req(1, 1, { status: 'ENDED', startDate: '2026-09-01', endDate: '2026-10-10' }), req(2, 2, { startDate: '2026-10-20' })];
  assert.equal(dosesDue(reqs, '2026-10-10').length, 2); // 끝난 날 당일 아침·점심
  assert.equal(dosesDue(reqs, '2026-10-11').length, 0);
  assert.equal(dosesDue(reqs, '2026-08-31').length, 0);
  assert.equal(dosesDue(reqs, '2026-10-19').length, 0);
  assert.deepEqual(shape(dosesDue(reqs, '2026-10-20')).map((r) => r[1]), [2, 2]);
});

test('dosesDue — 끝난 날 없이 ENDED인 의뢰와 끝난 날이 지난 ACTIVE 의뢰는 그날 이후 나오지 않는다', () => {
  assert.equal(dosesDue([req(1, 1, { status: 'ENDED', endDate: null })], '2026-10-15').length, 0);
  assert.equal(dosesDue([req(1, 1, { endDate: '2026-10-14' })], '2026-10-15').length, 0);
});

test('dosesDue — 출석한 어르신만, 빈 목록이면 아무도 없고, 날짜가 틀리면 빈 결과', () => {
  const reqs = [req(1, 1), req(2, 2)];
  assert.deepEqual(shape(dosesDue(reqs, '2026-10-15', [2])).map((r) => r[1]), [2, 2]);
  assert.equal(dosesDue(reqs, '2026-10-15', []).length, 0);
  assert.equal(dosesDue(reqs, '2026-02-30').length, 0);
  assert.equal(dosesDue(reqs, '').length, 0);
});

test('dosesDue — 같은 어르신의 두 의뢰는 따로 나온다', () => {
  const list = dosesDue([req(5, 1, { medicines: [med('가', ['LUNCH'])] }), req(3, 1, { medicines: [med('나', ['LUNCH'])] })], '2026-10-15');
  assert.deepEqual(shape(list), [[3, 1, 'LUNCH', ['나']], [5, 1, 'LUNCH', ['가']]]);
});

test('doseStatus — 같은 날짜·시간대 기록만 맞춰 보고 상태를 옮긴다', () => {
  const due = dosesDue([req(1, 1, { medicines: [med('가', ['MORNING', 'LUNCH', 'EVENING', 'BEDTIME'])] })], '2026-10-15');
  const states = doseStatus(due, [
    { requestId: 1, givenOn: '2026-10-15', slot: 'MORNING', status: 'GIVEN' },
    { requestId: 1, givenOn: '2026-10-15', slot: 'LUNCH', status: 'SKIPPED' },
    { requestId: 1, givenOn: '2026-10-15', slot: 'EVENING', status: 'REFUSED' },
    { requestId: 1, givenOn: '2026-10-14', slot: 'BEDTIME', status: 'GIVEN' }, // 어제 기록은 오늘 것이 아니다
    { requestId: 9, givenOn: '2026-10-15', slot: 'BEDTIME', status: 'GIVEN' }, // 다른 의뢰
  ]).map((d) => d.state);
  assert.deepEqual(states, ['DONE', 'SKIPPED', 'REFUSED', 'PENDING']);
});

test('doseStatus — 기록이 없으면 dose는 null', () => {
  const [row] = doseStatus(dosesDue([req(1, 1)], '2026-10-15'), []);
  assert.equal(row.dose, null);
  assert.equal(row.state, 'PENDING');
});

test('requestIssues — 처방 미확인·끝난 날 지남·시간대 없는 약·의뢰자 없음 네 가지', () => {
  const base = { prescriptionChecked: true, status: 'ACTIVE' as const, endDate: null, requesterName: '딸', medicines: [med('가', ['LUNCH'])] };
  assert.deepEqual(requestIssues(base, '2026-10-15'), []);
  assert.equal(requestIssues({ ...base, prescriptionChecked: false }, '2026-10-15').length, 1);
  assert.equal(requestIssues({ ...base, requesterName: '  ' }, '2026-10-15').length, 1);
  assert.equal(requestIssues({ ...base, medicines: [med('가', [])] }, '2026-10-15').length, 1);
  assert.match(requestIssues({ ...base, medicines: [med('가', []), med('나', [])] }, '2026-10-15')[0], /가, 나/);
});

test('requestIssues — 끝난 날 당일은 아직 진행 중, 하루 지나면 문제. 끝낸(ENDED) 의뢰는 문제 아님', () => {
  const base = { prescriptionChecked: true, requesterName: '딸', medicines: [med('가', ['LUNCH'])] };
  assert.deepEqual(requestIssues({ ...base, status: 'ACTIVE', endDate: '2026-10-15' }, '2026-10-15'), []);
  assert.equal(requestIssues({ ...base, status: 'ACTIVE', endDate: '2026-10-15' }, '2026-10-16').length, 1);
  assert.deepEqual(requestIssues({ ...base, status: 'ENDED', endDate: '2026-10-01' }, '2026-10-16'), []);
});

test('expiringStock — 지난 약·30일 안 약, 폐기한 약 제외, 사용기한 순', () => {
  const stock = [
    { id: 1, expiresOn: '2026-11-14', disposedOn: null },
    { id: 2, expiresOn: '2026-11-15', disposedOn: null },
    { id: 3, expiresOn: '2026-10-14', disposedOn: null },
    { id: 4, expiresOn: '2026-09-01', disposedOn: '2026-10-01' },
    { id: 5, expiresOn: '2026-10-15', disposedOn: null },
    { id: 6, expiresOn: '2026-08-01', disposedOn: null },
  ];
  const r = expiringStock(stock, '2026-10-15');
  assert.deepEqual(r.expired.map((s) => s.id), [6, 3]);
  assert.deepEqual(r.soon.map((s) => s.id), [5, 1]); // 10/15 + 30일 = 11/14 (11/15는 밖)
});

test('expiringStock — 윤년·연말 경계와 days 인자, 잘못된 값', () => {
  const stock = [{ id: 1, expiresOn: '2028-02-29', disposedOn: null }, { id: 2, expiresOn: '2027-01-30', disposedOn: null }, { id: 3, expiresOn: 'bad', disposedOn: null }];
  assert.deepEqual(expiringStock(stock, '2028-01-30', 30).soon.map((s) => s.id), [1]); // 1/30 + 30일 = 2/29(윤년)
  assert.deepEqual(expiringStock(stock, '2028-01-30', 29).soon.map((s) => s.id), []);
  assert.deepEqual(expiringStock(stock, '2026-12-31', 30).soon.map((s) => s.id), [2]); // 해를 넘겨 1/30
  assert.deepEqual(expiringStock(stock, '2028-01-30', -1).soon.map((s) => s.id), [1]); // 잘못된 days는 30으로
  assert.deepEqual(expiringStock(stock, 'x'), { expired: [], soon: [] });
});

test('quarterChecks — 분기 경계(3/31·4/1), 그 분기 가장 늦은 점검, 해 밖은 제외', () => {
  const checks = [
    { checkedOn: '2026-03-31', cabinetLocked: true, fridgeLocked: null },
    { checkedOn: '2026-04-01', cabinetLocked: false, fridgeLocked: null },
    { checkedOn: '2026-06-30', cabinetLocked: true, fridgeLocked: true },
    { checkedOn: '2026-12-31', cabinetLocked: true, fridgeLocked: false },
    { checkedOn: '2025-12-31', cabinetLocked: true, fridgeLocked: true },
    { checkedOn: '2027-01-01', cabinetLocked: true, fridgeLocked: true },
  ];
  assert.deepEqual(quarterChecks(checks, 2026).map((q) => [q.quarter, q.checkedOn, q.lockedOk]), [[1, '2026-03-31', true], [2, '2026-06-30', true], [3, null, null], [4, '2026-12-31', false]]);
});

test('quarterChecks — 냉장고 잠금 칸이 null이면 보관함 잠금만 본다, 보관함이 안 잠겼으면 false', () => {
  const q = quarterChecks([{ checkedOn: '2026-02-01', cabinetLocked: false, fridgeLocked: true }], 2026);
  assert.equal(q[0].lockedOk, false);
  assert.equal(q[0].done, true);
  assert.equal(quarterChecks([], 2026).every((x) => !x.done && x.lockedOk === null), true);
});

test('missedQuarters — 이미 지난 분기 중 점검 없는 분기만(진행 중 분기는 아직)', () => {
  const checks = [{ checkedOn: '2026-02-10', cabinetLocked: true, fridgeLocked: null }];
  assert.deepEqual(missedQuarters(checks, '2026-10-15'), [2, 3]);
  assert.deepEqual(missedQuarters(checks, '2026-03-31'), []);
  assert.deepEqual(missedQuarters(checks, '2026-04-01'), []); // 2분기는 막 시작했다
  assert.deepEqual(missedQuarters([], '2026-07-01'), [1, 2]);
  assert.deepEqual(missedQuarters(checks, 'x'), []);
});
