/**
 * 운영위원회 규칙 테스트 — `node --test src/lib/lab/committeeRules.test.ts`
 * 왜: 위원 5~15명·임기 3년(사회복지사업법 시행규칙 제24조)을 놓치면 운영위원회 구성이 부적격이 된다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { COMMITTEE_ROLES, committeeRoleLabel, committeeStatus, meetingsByQuarter, meetingsInYear, suggestedTermEnd, termLimit, termWithinLimit } from './committeeRules.ts';

const M = (id: number, termEnd: string, active = true) => ({ id, termStart: '2025-01-01', termEnd, active });
const FAR = '2027-12-31';

test('운영위원 현황 — 활동 6명(임기 지난 1명 제외), 임박 1명, 만료 1명', () => {
  const cs = committeeStatus([1, 2, 3, 4, 5].map((i) => M(i, FAR)).concat([M(6, '2026-11-20'), M(7, '2026-09-30'), M(8, FAR, false)]), '2026-10-15');
  assert.deepEqual([cs.active, cs.sizeOk, cs.expiringSoon.length, cs.expired.length], [6, true, 1, 1]);
  assert.equal(cs.expiringSoon[0].id, 6);
  assert.equal(cs.expired[0].id, 7);
});

test('운영위원 현황 — 4명이면 부족, 5명·15명은 적합, 16명은 초과', () => {
  const n = (count: number) => committeeStatus(Array.from({ length: count }, (_, i) => M(i + 1, FAR)), '2026-10-15').sizeOk;
  assert.deepEqual([n(4), n(5), n(15), n(16), n(0)], [false, true, true, false, false]);
});

test('운영위원 현황 — 임기 마지막 날 당일은 임기 중, 임박은 60일째 당일까지', () => {
  const today = '2026-10-15';
  const cs = committeeStatus([M(1, '2026-10-15'), M(2, '2026-10-14'), M(3, '2026-12-14'), M(4, '2026-12-15')], today);
  assert.equal(cs.active, 3);
  assert.deepEqual(cs.expired.map((m) => m.id), [2]);
  assert.deepEqual(cs.expiringSoon.map((m) => m.id), [1, 3]);
});

test('운영위원 현황 — 활동 해제한 위원은 만료·임박에도 세지 않는다', () => {
  const cs = committeeStatus([M(1, '2026-09-01', false), M(2, '2026-10-20', false)], '2026-10-15');
  assert.deepEqual([cs.active, cs.expired.length, cs.expiringSoon.length], [0, 0, 0]);
});

test('임기 3년 — 시작 + 3년을 넘으면 안 되고(윤일은 2월 28일), 끝이 시작보다 뒤여야 한다', () => {
  assert.equal(termLimit('2025-01-01'), '2028-01-01');
  assert.equal(termLimit('2024-02-29'), '2027-02-28');
  assert.equal(suggestedTermEnd('2025-01-01'), '2027-12-31');
  assert.equal(suggestedTermEnd('abc'), null);
  assert.equal(termWithinLimit('2025-01-01', '2027-12-31'), true);
  assert.equal(termWithinLimit('2025-01-01', '2028-01-01'), true);
  assert.equal(termWithinLimit('2025-01-01', '2028-01-02'), false);
  assert.equal(termWithinLimit('2025-01-01', '2025-01-01'), false);
  assert.equal(termWithinLimit('2025-01-01', '2024-12-31'), false);
  assert.equal(termWithinLimit('2025-01-01', 'xx'), false);
});

test('올해 회의 — 건수·정기·임시·마지막 개최일', () => {
  const r = meetingsInYear([{ heldOn: '2026-03-10', kind: 'REGULAR' }, { heldOn: '2026-06-10', kind: 'REGULAR' }, { heldOn: '2026-07-01', kind: 'SPECIAL' }, { heldOn: '2025-12-01', kind: 'REGULAR' }], 2026);
  assert.deepEqual(r, { count: 3, regular: 2, special: 1, lastHeldOn: '2026-07-01' });
});

test('올해 회의 — 없으면 0과 null, 입력 순서와 관계없이 가장 늦은 날', () => {
  assert.deepEqual(meetingsInYear([], 2026), { count: 0, regular: 0, special: 0, lastHeldOn: null });
  assert.equal(meetingsInYear([{ heldOn: '2026-09-01', kind: 'REGULAR' }, { heldOn: '2026-02-01', kind: 'REGULAR' }], 2026).lastHeldOn, '2026-09-01');
});

test('분기별 회의 수 — 3·4·6·7·12월 경계', () => {
  const q = meetingsByQuarter([{ heldOn: '2026-03-31' }, { heldOn: '2026-04-01' }, { heldOn: '2026-06-30' }, { heldOn: '2026-07-01' }, { heldOn: '2026-12-31' }, { heldOn: '2025-12-31' }], 2026);
  assert.deepEqual(q, [1, 2, 1, 1]);
});

test('위원 역할 목록', () => {
  assert.equal(COMMITTEE_ROLES.length, 9);
  assert.equal(committeeRoleLabel('CHAIR'), '위원장');
  assert.equal(committeeRoleLabel('???'), '???');
});
