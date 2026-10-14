/**
 * 인건비 지출비율 테스트 — `node --test src/lib/lab/staffCostRatio.test.ts`
 * 왜: 이 비율은 기준(48.6%)에 걸리는지로 센터의 평가가 갈린다. 반올림 방향·퇴직적립·0으로 나누기가 틀리면 결과가 뒤집힌다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { STAFF_COST_TARGET, ratioPercent, staffCostRatio } from './staffCostRatio.ts';

const line = (grossPay: number, nps = 0, health = 0, ltc = 0, employment = 0) => ({ grossPay, employerNps: nps, employerHealth: health, employerLtc: ltc, employerEmployment: employment });

test('계약 식 — 인건비 = 총지급 + 사업주 4대보험 + 퇴직적립(총지급 1/12)', () => {
  const r = staffCostRatio({ lines: [line(30_000_000, 1_500_000, 1_000_000, 130_000, 345_000)], revenue: 70_000_000 });
  assert.equal(r.grossTotal, 30_000_000);
  assert.equal(r.employerInsuranceTotal, 2_975_000);
  assert.equal(r.retirementAccrual, 2_500_000);
  assert.equal(r.laborCost, 35_475_000);
  assert.equal(r.revenue, 70_000_000);
  assert.equal(r.ratio, 50.7);
  assert.equal(r.target, 48.6);
  assert.equal(r.met, true);
});

test('기준 48.6% — 기준 위는 충족, 아래는 미달(소수 둘째 자리 반올림한 값으로 비교)', () => {
  assert.equal(STAFF_COST_TARGET, 48.6);
  // 인건비 486 ÷ 수입 1,000 = 48.6%
  assert.equal(staffCostRatio({ lines: [], revenue: 1_000, retirementAccrual: 486 }).ratio, 48.6);
  assert.equal(staffCostRatio({ lines: [], revenue: 1_000, retirementAccrual: 486 }).met, true);
  assert.equal(staffCostRatio({ lines: [], revenue: 1_000, retirementAccrual: 485 }).ratio, 48.5);
  assert.equal(staffCostRatio({ lines: [], revenue: 1_000, retirementAccrual: 485 }).met, false);
  // 48.55% → 48.6 (둘째 자리에서 반올림), 48.549% → 48.5
  assert.equal(ratioPercent(4_855, 10_000), 48.6);
  assert.equal(ratioPercent(4_854, 10_000), 48.5);
  assert.equal(staffCostRatio({ lines: [], revenue: 10_000, retirementAccrual: 4_855 }).met, true);
  assert.equal(staffCostRatio({ lines: [], revenue: 10_000, retirementAccrual: 4_854 }).met, false);
});

test('반올림 — 50.678…% → 50.7, 33.333…% → 33.3, 66.666…% → 66.7', () => {
  assert.equal(ratioPercent(35_475_000, 70_000_000), 50.7);
  assert.equal(ratioPercent(1, 3), 33.3);
  assert.equal(ratioPercent(2, 3), 66.7);
  assert.equal(ratioPercent(0, 100), 0);
  assert.equal(ratioPercent(100, 100), 100);
  assert.equal(ratioPercent(150, 100), 150);
});

test('퇴직적립 — 기본은 총지급 합의 1/12(원 미만 절사), 값을 주면 그 값을 쓴다', () => {
  const lines = [line(1_000_000), line(1_000_001)];
  assert.equal(staffCostRatio({ lines, revenue: 5_000_000 }).retirementAccrual, 166_666);
  assert.equal(staffCostRatio({ lines, revenue: 5_000_000, retirementAccrual: 0 }).retirementAccrual, 0);
  assert.equal(staffCostRatio({ lines, revenue: 5_000_000, retirementAccrual: 123_456 }).laborCost, 2_000_001 + 123_456);
});

test('여러 달·여러 직원 줄을 모두 더한다', () => {
  const lines = [line(2_000_000, 95_000, 71_900, 9_440, 23_000), line(2_500_000, 118_750, 89_870, 11_800, 28_750), line(3_000_000)];
  const r = staffCostRatio({ lines, revenue: 20_000_000 });
  assert.equal(r.grossTotal, 7_500_000);
  assert.equal(r.employerInsuranceTotal, 95_000 + 71_900 + 9_440 + 23_000 + 118_750 + 89_870 + 11_800 + 28_750);
  assert.equal(r.retirementAccrual, 625_000);
});

test('수입이 0이거나 없으면 비율이 null이고 충족이 아니다(0으로 나누지 않는다)', () => {
  const r = staffCostRatio({ lines: [line(1_000_000)], revenue: 0 });
  assert.equal(r.ratio, null);
  assert.equal(r.met, false);
  assert.equal(staffCostRatio({ lines: [], revenue: -5 }).ratio, null);
  assert.equal(staffCostRatio({ lines: [], revenue: Number.NaN }).ratio, null);
});

test('줄이 없으면 인건비 0, 수입이 있으면 비율 0으로 미달', () => {
  const r = staffCostRatio({ lines: [], revenue: 1_000_000 });
  assert.equal(r.laborCost, 0);
  assert.equal(r.ratio, 0);
  assert.equal(r.met, false);
});

test('큰 금액에서도 정수로 정확하다(연 수입 100억, 인건비 48.6%)', () => {
  const revenue = 10_000_000_000;
  assert.equal(ratioPercent(4_860_000_000, revenue), 48.6);
  assert.equal(ratioPercent(4_859_999_999, revenue), 48.6);
  assert.equal(ratioPercent(4_854_999_999, revenue), 48.5);
});
