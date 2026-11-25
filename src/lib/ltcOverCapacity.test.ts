/**
 * 정원초과 감액 계산 — `node --test src/lib/ltcOverCapacity.test.ts`
 *
 * 기대값은 원문 규칙을 손으로 적용한 값이다(코드에서 베끼지 않는다).
 * - 고시 제65조제1항 표(그림): 정원 초과비율 5% 미만 90%, 5% 이상~10% 미만 80%, 10% 이상~20% 미만 70%,
 *   20% 이상~30% 미만 60%, 30% 이상 50% — 그날 수급자 전원의 급여비용을 이 비율로 산정한다.
 * - 초과비율 = (그날 입소자 수 − 정원) ÷ 정원 (표 머리말 '정원 초과비율').
 * - 제47조제1항제6·7·8호: 정원의 10%(소수점 이하 반올림).
 * - 제52조제2항: 10원 미만 반올림. 제54조제2항: 급여 제공일수 중 정원초과 발생일수의 비율만큼 가산 제외.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  OVER_CAPACITY_BANDS,
  bandFor,
  bonusKeptFraction,
  excessPercentLabel,
  excessRangesFor,
  payPercentFor,
  payableWon,
  tenPercentOfCapacity,
} from './ltcOverCapacity.ts';

test('표 다섯 행 — 산정비율 90·80·70·60·50', () => {
  assert.deepEqual(
    OVER_CAPACITY_BANDS.map((b) => [b.label, b.payPercent]),
    [
      ['5% 미만', 90],
      ['5% 이상~10% 미만', 80],
      ['10% 이상~20% 미만', 70],
      ['20% 이상~30% 미만', 60],
      ['30% 이상', 50],
    ],
  );
});

test('정원 30명 — 31명 3.33% 90, 32명 6.67% 80, 33명 10% 70, 36명 20% 60, 39명 30% 50', () => {
  assert.equal(payPercentFor(30, 29), 100);
  assert.equal(payPercentFor(30, 30), 100); // 정원과 같으면 초과가 아니다
  assert.equal(payPercentFor(30, 31), 90); // 1/30 = 3.33%
  assert.equal(payPercentFor(30, 32), 80); // 2/30 = 6.67%
  assert.equal(payPercentFor(30, 33), 70); // 3/30 = 10% — 10% 이상
  assert.equal(payPercentFor(30, 35), 70); // 5/30 = 16.67%
  assert.equal(payPercentFor(30, 36), 60); // 6/30 = 20%
  assert.equal(payPercentFor(30, 38), 60); // 8/30 = 26.67%
  assert.equal(payPercentFor(30, 39), 50); // 9/30 = 30%
  assert.equal(payPercentFor(30, 45), 50);
});

test('경계는 "이상" 쪽 — 정원 20명 1명 초과는 정확히 5%라 80, 정원 21명 1명 초과는 4.76%라 90', () => {
  assert.equal(payPercentFor(20, 21), 80);
  assert.equal(payPercentFor(21, 22), 90);
  assert.equal(payPercentFor(10, 11), 70); // 1/10 = 10%
  assert.equal(payPercentFor(10, 12), 60); // 2/10 = 20%
  assert.equal(payPercentFor(10, 13), 50); // 3/10 = 30%
  assert.equal(payPercentFor(100, 104), 90);
  assert.equal(payPercentFor(100, 105), 80);
  assert.equal(payPercentFor(100, 110), 70);
  assert.equal(payPercentFor(100, 119), 70);
  assert.equal(payPercentFor(100, 120), 60);
  assert.equal(payPercentFor(100, 129), 60);
  assert.equal(payPercentFor(100, 130), 50);
  assert.equal(bandFor(40, 2).payPercent, 80); // 2/40 = 5%
  assert.equal(bandFor(40, 1).payPercent, 90); // 2.5%
});

test('초과비율 표시 — 소수 둘째자리 반올림', () => {
  assert.equal(excessPercentLabel(30, 2), '6.67%');
  assert.equal(excessPercentLabel(30, 1), '3.33%');
  assert.equal(excessPercentLabel(20, 1), '5%');
  assert.equal(excessPercentLabel(40, 1), '2.5%');
  assert.equal(excessPercentLabel(21, 1), '4.76%');
});

const ranges = (capacity: number) => excessRangesFor(capacity).map((r) => [r.band.payPercent, r.from, r.to]);

test('정원별 구간에 드는 초과 인원 — 손으로 센 값', () => {
  // 정원 10: 1명 = 10% → 70, 2명 = 20% → 60, 3명 = 30% → 50. 90·80 구간에 드는 인원 없음
  assert.deepEqual(ranges(10), [[90, null, null], [80, null, null], [70, 1, 1], [60, 2, 2], [50, 3, null]]);
  // 정원 15: 5% = 0.75명, 10% = 1.5명, 20% = 3명, 30% = 4.5명
  assert.deepEqual(ranges(15), [[90, null, null], [80, 1, 1], [70, 2, 2], [60, 3, 4], [50, 5, null]]);
  // 정원 20: 5% = 1명, 10% = 2명, 20% = 4명, 30% = 6명
  assert.deepEqual(ranges(20), [[90, null, null], [80, 1, 1], [70, 2, 3], [60, 4, 5], [50, 6, null]]);
  // 정원 25: 5% = 1.25명, 10% = 2.5명, 20% = 5명, 30% = 7.5명
  assert.deepEqual(ranges(25), [[90, 1, 1], [80, 2, 2], [70, 3, 4], [60, 5, 7], [50, 8, null]]);
  // 정원 30: 5% = 1.5명, 10% = 3명, 20% = 6명, 30% = 9명
  assert.deepEqual(ranges(30), [[90, 1, 1], [80, 2, 2], [70, 3, 5], [60, 6, 8], [50, 9, null]]);
  // 정원 50: 5% = 2.5명, 10% = 5명, 20% = 10명, 30% = 15명
  assert.deepEqual(ranges(50), [[90, 1, 2], [80, 3, 4], [70, 5, 9], [60, 10, 14], [50, 15, null]]);
});

test('정원의 10%(소수점 이하 반올림)', () => {
  assert.equal(tenPercentOfCapacity(10), 1);
  assert.equal(tenPercentOfCapacity(14), 1); // 1.4
  assert.equal(tenPercentOfCapacity(15), 2); // 1.5
  assert.equal(tenPercentOfCapacity(25), 3); // 2.5
  assert.equal(tenPercentOfCapacity(30), 3);
  assert.equal(tenPercentOfCapacity(44), 4); // 4.4
  assert.equal(tenPercentOfCapacity(45), 5); // 4.5
  assert.equal(tenPercentOfCapacity(4), 0); // 0.4
});

test('산정 금액 — 2,000,000원 × 80% = 1,600,000원, 10원 미만 반올림', () => {
  assert.equal(payableWon(2_000_000, 80), 1_600_000);
  assert.equal(payableWon(2_000_000, 100), 2_000_000);
  assert.equal(payableWon(1_234_567, 90), 1_111_110); // 1,111,110.3 → 1,111,110
  assert.equal(payableWon(1_234_575, 90), 1_111_120); // 1,111,117.5 → 1,111,120
});

test('가산 적용 몫 — 급여 제공일수 22일 중 2일 정원초과면 20/22', () => {
  assert.deepEqual(bonusKeptFraction(22, 2), { numerator: 20, denominator: 22 });
  assert.deepEqual(bonusKeptFraction(22, 0), { numerator: 22, denominator: 22 });
  assert.throws(() => bonusKeptFraction(22, 23), RangeError);
});

test('잘못된 입력은 거절', () => {
  assert.throws(() => payPercentFor(0, 1), RangeError);
  assert.throws(() => payPercentFor(30, 31.5), RangeError);
  assert.throws(() => bandFor(30, 0), RangeError);
});
