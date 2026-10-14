/**
 * 급여제공계획 점검 테스트 — `node --test src/lib/lab/carePlanRules.test.ts`
 * 왜: 평가는 "올해 계획 + 보호자 동의"를 어르신마다 본다. 작년 계획이나 동의일 없는 계획을 완료로 세면 안 된다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { carePlanCoverage, carePlanGaps, carePlanStatus } from './carePlanRules.ts';

test('계획 없음 → MISSING, 동의 없음 → NEEDS_AGREEMENT, 둘 다 → OK', () => {
  assert.equal(carePlanStatus(null, 2026), 'MISSING');
  assert.equal(carePlanStatus(undefined, 2026), 'MISSING');
  assert.equal(carePlanStatus({ planYear: 2026, guardianAgreedOn: null }, 2026), 'NEEDS_AGREEMENT');
  assert.equal(carePlanStatus({ planYear: 2026, guardianAgreedOn: '2026-03-02' }, 2026), 'OK');
});

test('작년·내년 계획은 올해 것이 아니다', () => {
  assert.equal(carePlanStatus({ planYear: 2025, guardianAgreedOn: '2025-03-02' }, 2026), 'MISSING');
  assert.equal(carePlanStatus({ planYear: 2027, guardianAgreedOn: '2026-12-30' }, 2026), 'MISSING');
});

test('동의일이 빈 문자열·공백·날짜가 아닌 값이면 동의 없음으로 본다', () => {
  for (const bad of ['', '  ', '동의함', '2026-13-01', '2026-02-30']) {
    assert.equal(carePlanStatus({ planYear: 2026, guardianAgreedOn: bad }, 2026), 'NEEDS_AGREEMENT', JSON.stringify(bad));
  }
  assert.equal(carePlanStatus({ planYear: 2026, guardianAgreedOn: '2026-03-02T10:00:00' }, 2026), 'OK');
});

test('carePlanCoverage — 어르신별 상태와 비율, 목록 밖 어르신의 계획은 세지 않는다', () => {
  const plans = [
    { elderlyId: 1, planYear: 2026, guardianAgreedOn: '2026-03-02' },
    { elderlyId: 2, planYear: 2026, guardianAgreedOn: null },
    { elderlyId: 3, planYear: 2025, guardianAgreedOn: '2025-03-02' },
    { elderlyId: 99, planYear: 2026, guardianAgreedOn: '2026-03-02' }, // 우리 어르신 아님
  ];
  const c = carePlanCoverage(plans, [1, 2, 3, 4], 2026);
  assert.deepEqual({ total: c.total, ok: c.ok, needsAgreement: c.needsAgreement, missing: c.missing, percent: c.percent }, { total: 4, ok: 1, needsAgreement: 1, missing: 2, percent: 25 });
  assert.deepEqual(c.perElder, { 1: 'OK', 2: 'NEEDS_AGREEMENT', 3: 'MISSING', 4: 'MISSING' });
});

test('carePlanCoverage — 한 어르신 계획이 여럿이면 가장 나은 상태, 어르신 id 중복은 한 번, 어르신이 없으면 0%', () => {
  const c = carePlanCoverage(
    [{ elderlyId: 1, planYear: 2026, guardianAgreedOn: null }, { elderlyId: 1, planYear: 2026, guardianAgreedOn: '2026-04-01' }],
    [1, 1],
    2026,
  );
  assert.equal(c.total, 1);
  assert.equal(c.perElder[1], 'OK');
  assert.deepEqual(carePlanCoverage([], [], 2026), { total: 0, ok: 0, needsAgreement: 0, missing: 0, percent: 0, perElder: {} });
});

test('carePlanGaps — 비어 있는 부분을 알려 준다', () => {
  const empty = { needs: { physical: '', cognition: ' ', nutrition: '', communication: '', family: '', other: '' }, goals: null, services: [] };
  assert.deepEqual(carePlanGaps(empty), ['욕구사정 내용', '목표', '제공 서비스']);
  const noFreq = { needs: { ...empty.needs, physical: '보행 불안' }, goals: '혼자 화장실 가기', services: [{ area: '신체활동지원', content: '보행 훈련', frequency: '' }] };
  assert.deepEqual(carePlanGaps(noFreq), ['서비스별 제공 횟수·주기']);
  const full = { ...noFreq, services: [{ area: '신체활동지원', content: '보행 훈련', frequency: '이용일마다' }] };
  assert.deepEqual(carePlanGaps(full), []);
});
