/**
 * 요양원(노인요양시설) 가산 계산 — `node --test src/lib/ltcNursingHomeBonus.test.ts`
 *
 * 기대값은 원문 규칙을 손으로 적용한 값이다(코드에서 베끼지 않는다).
 * - 고시 제55조제1항제2호·제3호: 간호(조무)사 1인당 입소자 수 19.0명 미만, 소수점 셋째자리에서 절사
 * - 제56조제1항: 가산금액 = 기준금액(시설급여 급여비용 합의 80%) × [가산점수의 합/입소자수] × 서비스유형점수(1점, 치매전담실만 0.9점)
 *   제2호: 간호(조무)사 1.2점, 사회복지사·물리(작업)치료사 1.4점, 조리원 노인요양시설 1점, 치매전담실 요양보호사 실별 최대 2명 × 1.3점
 * - 제56조제2항 노인요양시설 인정범위(그림 표): 10명 미만 1.4, 10~30 2.6, 30~50 4.0, 50~70 5.2, 70~90 6.6, 90 이상 7.8점 이하.
 *   조리원(다목)·치매전담실 요양보호사(마목)·한시 가산(제56조의2)은 인정범위에 넣지 않는다.
 * - 제56조의2: 초과 배치 요양보호사 1인당 1.3점, 한도는 전월 대비 감소한 의무배치인원 수(2.1명당 1명, 반올림)
 * - 별표 4 제6호: 간호사 또는 간호조무사 입소자 30명 이상 25명당 1명, 30명 미만 10명 이상 1명. 고시 제48조제1항 반올림.
 * - 제52조제2항: 10원 미만 반올림
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  bonusAmountWon,
  capFor,
  dementiaUnitPoints,
  firstNurseBonusStaff,
  nurseBonusBands,
  nurseBonusEligible,
  nursingHomeBonusPoints,
  requiredNurses,
  tempBonusLimit,
  tempBonusPoints,
} from './ltcNursingHomeBonus.ts';

test('인정범위 — 노인요양시설 칸, 구간 경계', () => {
  assert.equal(capFor(9), 14);
  assert.equal(capFor(10), 26);
  assert.equal(capFor(29), 26);
  assert.equal(capFor(30), 40);
  assert.equal(capFor(49), 40);
  assert.equal(capFor(50), 52);
  assert.equal(capFor(69), 52);
  assert.equal(capFor(70), 66);
  assert.equal(capFor(89), 66);
  assert.equal(capFor(90), 78);
  assert.equal(capFor(150), 78);
});

test('간호(조무)사 의무 인원 — 30명 미만 1명, 30명 이상 25명당 반올림', () => {
  assert.equal(requiredNurses(10), 1);
  assert.equal(requiredNurses(29), 1);
  // 30/25 = 1.2 → 1, 37/25 = 1.48 → 1, 38/25 = 1.52 → 2
  assert.equal(requiredNurses(30), 1);
  assert.equal(requiredNurses(37), 1);
  assert.equal(requiredNurses(38), 2);
  // 62/25 = 2.48 → 2, 63/25 = 2.52 → 3, 87/25 = 3.48 → 3, 88/25 = 3.52 → 4, 100/25 = 4
  assert.equal(requiredNurses(62), 2);
  assert.equal(requiredNurses(63), 3);
  assert.equal(requiredNurses(87), 3);
  assert.equal(requiredNurses(88), 4);
  assert.equal(requiredNurses(100), 4);
});

test('간호(조무)사 가산 요건 — 의무보다 많고 19.0명 미만', () => {
  // 50명: 의무 2. 2명은 초과가 아니고, 3명이면 50/3 = 16.66 → 가산
  assert.equal(nurseBonusEligible(50, 2), false);
  assert.equal(nurseBonusEligible(50, 3), true);
  // 57명: 의무 2. 3명이면 57/3 = 19.00 → '미만' 아님, 4명이면 14.25
  assert.equal(nurseBonusEligible(57, 3), false);
  assert.equal(nurseBonusEligible(57, 4), true);
  assert.equal(firstNurseBonusStaff(57), 4);
  // 56명: 56/3 = 18.66 → 3명
  assert.equal(firstNurseBonusStaff(56), 3);
  // 76명: 의무 3. 4명이면 19.00 → 아님, 5명이면 15.2
  assert.equal(firstNurseBonusStaff(75), 4);
  assert.equal(firstNurseBonusStaff(76), 5);
  // 95명: 의무 4. 5명이면 19.00 → 아님, 6명이면 15.83
  assert.equal(firstNurseBonusStaff(94), 5);
  assert.equal(firstNurseBonusStaff(95), 6);
  // 10명·37명: 의무 1, 2명이면 5.0·18.5
  assert.equal(firstNurseBonusStaff(10), 2);
  assert.equal(firstNurseBonusStaff(37), 2);
});

test('간호(조무)사 가산 시작 인원 구간 10~100명', () => {
  assert.deepEqual(nurseBonusBands(10, 100), [
    { from: 10, to: 37, required: 1, firstBonus: 2 },
    { from: 38, to: 56, required: 2, firstBonus: 3 },
    { from: 57, to: 62, required: 2, firstBonus: 4 },
    { from: 63, to: 75, required: 3, firstBonus: 4 },
    { from: 76, to: 87, required: 3, firstBonus: 5 },
    { from: 88, to: 94, required: 4, firstBonus: 5 },
    { from: 95, to: 100, required: 4, firstBonus: 6 },
  ]);
});

test('치매전담실 요양보호사 — 실별 최대 2명 × 1.3점', () => {
  assert.equal(dementiaUnitPoints(0), 0);
  assert.equal(dementiaUnitPoints(1), 13);
  assert.equal(dementiaUnitPoints(2), 26);
  assert.equal(dementiaUnitPoints(3), 26);
});

test('한시 가산 한도 — 전월 대비 줄어든 의무 인원(2.1명당, 반올림)', () => {
  // 60/2.1 = 28.57 → 29, 55/2.1 = 26.19 → 26 → 3명
  assert.equal(tempBonusLimit(60, 55), 3);
  // 30/2.1 = 14.29 → 14, 28/2.1 = 13.33 → 13 → 1명
  assert.equal(tempBonusLimit(30, 28), 1);
  // 100/2.1 = 47.62 → 48, 97/2.1 = 46.19 → 46 → 2명
  assert.equal(tempBonusLimit(100, 97), 2);
  // 40/2.1 = 19.05 → 19, 39/2.1 = 18.57 → 19 → 의무 인원이 줄지 않음
  assert.equal(tempBonusLimit(40, 39), 0);
  // 41/2.1 = 19.52 → 20, 40 → 19 → 1명
  assert.equal(tempBonusLimit(41, 40), 1);
  // 입소자가 늘면 0
  assert.equal(tempBonusLimit(55, 60), 0);
});

test('한시 가산점수 — 초과 인원과 한도 중 작은 수 × 1.3점', () => {
  // 60 → 55명, 요양보호사 29명 유지: 초과 29 - 26 = 3, 한도 3 → 3.9점
  assert.equal(tempBonusPoints(60, 55, 29), 39);
  // 같은 달 요양보호사 27명: 초과 1, 한도 3 → 1.3점
  assert.equal(tempBonusPoints(60, 55, 27), 13);
  // 요양보호사 31명: 초과 5, 한도 3 → 3.9점
  assert.equal(tempBonusPoints(60, 55, 31), 39);
  // 40 → 39명: 한도 0 → 0점
  assert.equal(tempBonusPoints(40, 39, 25), 0);
});

test('예시 1 — 입소자 50명, 간호(조무)사·사회복지사 1명씩 추가, 조리원 추가, 급여비용 합 1억 2,000만 원', () => {
  // 1.2 + 1.4 = 2.6점 ≤ 인정범위 5.2, 조리원 1점 따로 → 3.6점
  const points = nursingHomeBonusPoints({ residents: 50, added: { nurse: 1, socialWorker: 1 }, cookAdded: true });
  assert.deepEqual(points, { raw: 26, cap: 52, recognized: 26, cook: 10, total: 36 });
  // 120,000,000 × 80% = 96,000,000, × 3.6 ÷ 50 = 6,912,000, × 1 = 6,912,000원
  assert.equal(bonusAmountWon(120_000_000, 36, 50, 10), 6_912_000);
});

test('예시 2 — 입소자 45명, 인정범위 4.0점을 넘는 경우, 급여비용 합 1억 원', () => {
  // 간호(조무)사 2명 2.4 + 물리치료사 1.4 + 사회복지사 1.4 = 5.2점 → 인정범위 4.0점까지
  const points = nursingHomeBonusPoints({ residents: 45, added: { nurse: 2, therapist: 1, socialWorker: 1 } });
  assert.deepEqual(points, { raw: 52, cap: 40, recognized: 40, cook: 0, total: 40 });
  // 100,000,000 × 80% = 80,000,000, × 4.0 ÷ 45 = 7,111,111.1 → 10원 미만 반올림 7,111,110원
  assert.equal(bonusAmountWon(100_000_000, 40, 45, 10), 7_111_110);
});

test('서비스유형점수 0.9 — 치매전담실만 있는 노인요양시설', () => {
  // 50,000,000 × 80% = 40,000,000, × 2.6 ÷ 16 = 6,500,000, × 0.9 = 5,850,000원
  assert.equal(bonusAmountWon(50_000_000, 26, 16, 9), 5_850_000);
});
