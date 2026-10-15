/**
 * 예방접종 규칙 테스트 — `node --test src/lib/lab/vaccineRules.test.ts`
 * 왜: 접종률 분모·분자를 잘못 세면 평가 접종률 점수와 올해 접종 현황이 모두 틀어진다. 기준일 경계(12-31)와 반올림이 핵심이다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { evalVaccineRate, seasonProgress, vaccineBaseDate, type VaccineContract, type VaccineRecord } from './vaccineRules.ts';

const K = (elderlyId: number, contractStart: string, contractEnd: string | null = null): VaccineContract => ({ elderlyId, contractStart, contractEnd });
const V = (elderlyId: number, seasonYear: number, status: VaccineRecord['status'], vaccine: VaccineRecord['vaccine'] = 'INFLUENZA'): VaccineRecord => ({ elderlyId, seasonYear, vaccine, status });
const group = (n: number, from = 1) => Array.from({ length: n }, (_, i) => K(from + i, '2025-01-01'));

test('기준일은 평가 연도 − 2년의 12월 31일', () => {
  assert.equal(vaccineBaseDate(2028), '2026-12-31');
  assert.equal(vaccineBaseDate(2030), '2028-12-31');
});

test('기준일 당일: 12-31에 시작한 계약은 대상, 이튿날 시작은 대상 아님', () => {
  const r = evalVaccineRate([K(1, '2026-12-31'), K(2, '2027-01-01')], [], 2028);
  assert.equal(r.eligible, 1);
});

test('기준일 당일: 12-31에 끝난 계약은 대상, 12-30에 끝난 계약은 대상 아님', () => {
  const r = evalVaccineRate([K(1, '2024-01-01', '2026-12-31'), K(2, '2024-01-01', '2026-12-30')], [], 2028);
  assert.equal(r.eligible, 1);
});

test('끊겼다 다시 계약한 어르신은 기준일에 유지 중인 계약이 하나라도 있으면 한 명으로 센다', () => {
  const r = evalVaccineRate([K(7, '2020-01-01', '2026-06-30'), K(7, '2026-08-01')], [], 2028);
  assert.equal(r.eligible, 1);
});

test('기준일 전에 끝난 계약만 있으면 대상이 아니다', () => {
  assert.equal(evalVaccineRate([K(7, '2020-01-01', '2026-06-30')], [], 2028).eligible, 0);
});

test('접종은 분자, 거부·제외는 분자·분모에서 뺀다', () => {
  const contracts = [K(1, '2025-01-01'), K(2, '2025-01-01'), K(3, '2025-01-01'), K(4, '2025-01-01')];
  const r = evalVaccineRate(contracts, [V(1, 2027, 'DONE'), V(2, 2027, 'REFUSED'), V(3, 2027, 'EXCLUDED'), V(4, 2027, 'UNKNOWN')], 2028);
  assert.deepEqual([r.eligible, r.excluded, r.denominator, r.vaccinated, r.rate], [4, 2, 2, 1, 50]);
});

test('접종 기록과 거부 기록이 함께 있으면 접종으로 센다', () => {
  const r = evalVaccineRate([K(1, '2025-01-01')], [V(1, 2027, 'REFUSED'), V(1, 2027, 'DONE')], 2028);
  assert.deepEqual([r.vaccinated, r.excluded], [1, 0]);
});

test('폐렴구균·코로나19와 다른 해의 기록은 세지 않는다', () => {
  const r = evalVaccineRate([K(1, '2025-01-01')], [V(1, 2027, 'DONE', 'PNEUMOCOCCAL'), V(1, 2027, 'DONE', 'COVID19'), V(1, 2026, 'DONE'), V(1, 2028, 'DONE')], 2028);
  assert.equal(r.vaccinated, 0);
});

test('점수 경계: 100% → 1, 90% → 0.75, 80% → 0.5, 그 아래 0', () => {
  const score = (done: number, of: number) => {
    const cs = group(of);
    return evalVaccineRate(cs, cs.slice(0, done).map((c) => V(c.elderlyId, 2027, 'DONE')), 2028).score;
  };
  assert.equal(score(10, 10), 1);
  assert.equal(score(9, 10), 0.75);
  assert.equal(score(8, 10), 0.5);
  assert.equal(score(7, 10), 0);
});

test('점수는 반올림한 접종률로 가른다(매뉴얼 정의): 89.96%는 90.0%로 0.75점, 99.96%는 100.0%로 1점, 89.94%는 89.9%로 0.5점', () => {
  // 2499/2778 = 89.956...% → 90.0
  const cs = group(2778);
  const r = evalVaccineRate(cs, cs.slice(0, 2499).map((c) => V(c.elderlyId, 2027, 'DONE')), 2028);
  assert.equal(r.rate, 90);
  assert.equal(r.score, 0.75);
  // 2777/2778 = 99.964...% → 100.0
  const r2 = evalVaccineRate(cs, cs.slice(0, 2777).map((c) => V(c.elderlyId, 2027, 'DONE')), 2028);
  assert.equal(r2.rate, 100);
  assert.equal(r2.score, 1);
  // 2498/2778 = 89.920...% → 89.9
  const r3 = evalVaccineRate(cs, cs.slice(0, 2498).map((c) => V(c.elderlyId, 2027, 'DONE')), 2028);
  assert.equal(r3.rate, 89.9);
  assert.equal(r3.score, 0.5);
});

test('반올림: 소수 첫째 자리, 66.7과 8.8(8.75% 올림)', () => {
  const three = group(3);
  assert.equal(evalVaccineRate(three, three.slice(0, 2).map((c) => V(c.elderlyId, 2027, 'DONE')), 2028).rate, 66.7);
  const eighty = group(80);
  assert.equal(evalVaccineRate(eighty, eighty.slice(0, 7).map((c) => V(c.elderlyId, 2027, 'DONE')), 2028).rate, 8.8);
});

test('분모가 0이면 비율·점수는 null', () => {
  const r = evalVaccineRate([K(1, '2025-01-01')], [V(1, 2027, 'REFUSED')], 2028);
  assert.deepEqual([r.denominator, r.rate, r.score], [0, null, null]);
  assert.deepEqual([evalVaccineRate([], [], 2028).rate, evalVaccineRate([], [], 2028).score], [null, null]);
});

test('2027년 평가까지는 접종률과 관계없이 충족 처리, 2028년부터는 아니다', () => {
  const cs = group(4);
  assert.deepEqual([2026, 2027, 2028].map((y) => evalVaccineRate(cs, [], y).autoMet), [true, true, false]);
});

test('올해 진행: 접종·거부·제외·미확인과 비율', () => {
  const p = seasonProgress([1, 2, 3, 4, 5, 6], [V(1, 2026, 'DONE'), V(2, 2026, 'REFUSED'), V(3, 2026, 'EXCLUDED'), V(4, 2026, 'UNKNOWN'), V(5, 2025, 'DONE')], 2026);
  assert.deepEqual(p, { total: 6, done: 1, refused: 1, excluded: 1, unknown: 3, rate: 25 });
});

test('올해 진행: 분모(거부·제외를 뺀 수)가 0이면 비율은 null, 진행 중인 사람이 없어도 null', () => {
  assert.equal(seasonProgress([1], [V(1, 2026, 'REFUSED')], 2026).rate, null);
  assert.deepEqual(seasonProgress([], [], 2026), { total: 0, done: 0, refused: 0, excluded: 0, unknown: 0, rate: null });
});

test('올해 진행: 같은 어르신 id가 겹쳐도 한 명, 인플루엔자만 센다', () => {
  const p = seasonProgress([1, 1, 2], [V(1, 2026, 'DONE'), V(1, 2026, 'DONE', 'COVID19'), V(2, 2026, 'DONE', 'PNEUMOCOCCAL')], 2026);
  assert.deepEqual([p.total, p.done, p.unknown], [2, 1, 1]);
});
