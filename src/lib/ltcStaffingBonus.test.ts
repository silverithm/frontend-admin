/**
 * 주·야간보호 인력추가배치 가산 — `node --test src/lib/ltcStaffingBonus.test.ts`
 *
 * 기대값은 원문 규칙을 손으로 적용한 값이다(코드에서 베끼지 않는다).
 * - 제55조제1항: 요양보호사 1인당 이용자 6.4명 미만(치매전담형 3.9명 미만), 간호(조무)사 19.0명 미만,
 *   1인당 이용자 수 = 이용자 수 ÷ 근무인원 수, 소수점 셋째자리에서 절사
 * - 제56조제1항: 가산금액 = 기준금액(급여비용 합의 85%) × [가산점수의 합/입소자수] × 서비스유형점수(1.5)
 *   가산점수: 요양보호사·간호(조무)사 1.2, 사회복지사·물리(작업)치료사 1.4, 조리원 1.2(인원수 무관)
 * - 제56조제2항 인정범위(주·야간보호): 5명 미만 1.4 · 5~10 2.6 · 10~30 4.0 · 30~50 6.4 · 50~70 8.8 · 70~80 10.0 ·
 *   80~90 11.2 · 90~120 13.6 · 120 이상 14.8 (점 이하). 조리원 점수는 포함하지 않는다(단서).
 * - 제56조제4항: 인정범위를 넘은 10명 이상 기관은 요양보호사 추가 인원에 따라 인정범위를 더한다.
 * - 의무 인원: 별표 9(7명당 1명) + 제48조제1항(반올림, 0.5 미만 1명)
 * - 제52조제2항: 10원 미만 반올림
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  bonusAmountWon,
  bonusPoints,
  bonusStartBands,
  capFor,
  caregiverBonusEligible,
  extraCapFor,
  firstBonusCaregivers,
  perHeadHundredths,
} from './ltcStaffingBonus.ts';

test('1인당 이용자 수 — 소수점 셋째자리에서 절사', () => {
  // 45 ÷ 7 = 6.428… → 6.42
  assert.equal(perHeadHundredths(45, 7), 642);
  // 64 ÷ 10 = 6.4 → 6.40
  assert.equal(perHeadHundredths(64, 10), 640);
  // 30 ÷ 6 = 5 → 5.00
  assert.equal(perHeadHundredths(30, 6), 500);
  // 19 ÷ 1 = 19 → 19.00 (간호(조무)사 19.0명 '미만'이 아니다)
  assert.equal(perHeadHundredths(19, 1), 1900);
});

test('요양보호사 가산 요건 — 기준 초과 + 6.4명 미만', () => {
  // 30명: 기준 30/7 = 4.29 → 4명. 5명이면 30/5 = 6.0 < 6.4 → 충족
  assert.equal(caregiverBonusEligible(30, 4, 'general'), false); // 기준 초과가 아님
  assert.equal(caregiverBonusEligible(30, 5, 'general'), true);
  // 45명: 기준 45/7 = 6.43 → 6명. 7명이면 6.42 → 6.4 미만 아님, 8명이면 5.62 → 충족
  assert.equal(caregiverBonusEligible(45, 7, 'general'), false);
  assert.equal(caregiverBonusEligible(45, 8, 'general'), true);
  // 64명: 기준 64/7 = 9.14 → 9명. 10명이면 정확히 6.40 → '미만'이 아니라 불충족
  assert.equal(caregiverBonusEligible(64, 10, 'general'), false);
  assert.equal(caregiverBonusEligible(64, 11, 'general'), true);
  // 치매전담실 20명: 기준 20/4 = 5명. 6명이면 3.33 < 3.9 → 충족
  assert.equal(caregiverBonusEligible(20, 6, 'dementia'), true);
});

test('가산 요건을 처음 채우는 인원 — 기준 + 1명으로 모자란 이용자 수', () => {
  // 44명: 기준 6(6.29 반올림), 7명 → 6.28 < 6.4
  assert.equal(firstBonusCaregivers(44, 'general'), 7);
  // 45명: 기준 6, 7명 → 6.42 불충족 → 8명
  assert.equal(firstBonusCaregivers(45, 'general'), 8);
  // 52명: 기준 7(7.43), 8명 → 6.5 불충족 → 9명
  assert.equal(firstBonusCaregivers(52, 'general'), 9);
  // 58명: 기준 8(8.29), 9명 → 6.44 불충족 → 10명. 59명도 9명 → 6.55 → 10명
  assert.equal(firstBonusCaregivers(58, 'general'), 10);
  assert.equal(firstBonusCaregivers(59, 'general'), 10);
  // 66명: 기준 9(9.43), 10명 → 6.6 불충족 → 11명
  assert.equal(firstBonusCaregivers(66, 'general'), 11);
});

test('구간 묶음 — 일반실 1~70명', () => {
  // 손으로 센 표: [이용자 수 구간, 의무 인원, 가산 시작 인원]
  assert.deepEqual(bonusStartBands('general', 70), [
    { from: 1, to: 10, required: 1, firstBonus: 2 },
    { from: 11, to: 17, required: 2, firstBonus: 3 },
    { from: 18, to: 24, required: 3, firstBonus: 4 },
    { from: 25, to: 31, required: 4, firstBonus: 5 },
    { from: 32, to: 38, required: 5, firstBonus: 6 },
    { from: 39, to: 44, required: 6, firstBonus: 7 },
    { from: 45, to: 45, required: 6, firstBonus: 8 },
    { from: 46, to: 51, required: 7, firstBonus: 8 },
    { from: 52, to: 52, required: 7, firstBonus: 9 },
    { from: 53, to: 57, required: 8, firstBonus: 9 },
    { from: 58, to: 59, required: 8, firstBonus: 10 },
    { from: 60, to: 63, required: 9, firstBonus: 10 },
    { from: 64, to: 66, required: 9, firstBonus: 11 },
    { from: 67, to: 70, required: 10, firstBonus: 11 },
  ]);
});

test('구간 묶음 — 치매전담실 1~25명은 모두 기준 + 1명', () => {
  assert.deepEqual(bonusStartBands('dementia', 25), [
    { from: 1, to: 5, required: 1, firstBonus: 2 },
    { from: 6, to: 9, required: 2, firstBonus: 3 },
    { from: 10, to: 13, required: 3, firstBonus: 4 },
    { from: 14, to: 17, required: 4, firstBonus: 5 },
    { from: 18, to: 21, required: 5, firstBonus: 6 },
    { from: 22, to: 25, required: 6, firstBonus: 7 },
  ]);
});

test('인정범위 — 표의 경계(이상·미만)', () => {
  assert.equal(capFor(4), 14);
  assert.equal(capFor(5), 26);
  assert.equal(capFor(9), 26);
  assert.equal(capFor(10), 40);
  assert.equal(capFor(29), 40);
  assert.equal(capFor(30), 64);
  assert.equal(capFor(50), 88);
  assert.equal(capFor(70), 100);
  assert.equal(capFor(79), 100);
  assert.equal(capFor(80), 112);
  assert.equal(capFor(90), 136);
  assert.equal(capFor(119), 136);
  assert.equal(capFor(120), 148);
});

test('인정범위 추가산정 — 제56조제4항', () => {
  assert.equal(extraCapFor(9, 5), 0); // 10명 미만은 대상 아님
  assert.equal(extraCapFor(25, 2), 0);
  assert.equal(extraCapFor(25, 3), 12);
  assert.equal(extraCapFor(25, 6), 24);
  assert.equal(extraCapFor(30, 3), 0); // 30~50명은 4명부터
  assert.equal(extraCapFor(30, 4), 12);
  assert.equal(extraCapFor(85, 7), 24);
  assert.equal(extraCapFor(100, 8), 24);
  assert.equal(extraCapFor(100, 12), 36);
  assert.equal(extraCapFor(130, 8), 12);
});

test('예시 1 — 이용자 30명, 요양보호사 6명(기준 4명), 급여비용 합 4,500만 원', () => {
  // 추가 2명 × 1.2 = 2.4점, 인정범위 6.4점 안
  const points = bonusPoints({ users: 30, added: { caregiver: 2 } });
  assert.deepEqual(points, { raw: 24, cap: 64, extraCap: 0, recognized: 24, cook: 0, total: 24 });
  // 45,000,000 × 85% = 38,250,000 → × 2.4/30 = 3,060,000 → × 1.5 = 4,590,000
  assert.equal(bonusAmountWon(45_000_000, points.total, 30, 15), 4_590_000);
});

test('예시 2 — 이용자 25명, 요양보호사 추가 3명·사회복지사 추가 1명·조리원 추가', () => {
  // 3 × 1.2 + 1 × 1.4 = 5.0점 > 인정범위 4.0점 → 제4항: 10~30명, 요양보호사 3명 → +1.2 → 5.2점까지 → 5.0점 인정
  // 조리원 1.2점은 인정범위 밖에서 더한다 → 6.2점
  const points = bonusPoints({ users: 25, added: { caregiver: 3, socialWorker: 1 }, cookAdded: true });
  assert.deepEqual(points, { raw: 50, cap: 40, extraCap: 12, recognized: 50, cook: 12, total: 62 });
  // 37,500,000 × 85% = 31,875,000 → × 6.2/25 = 7,905,000 → × 1.5 = 11,857,500
  assert.equal(bonusAmountWon(37_500_000, points.total, 25, 15), 11_857_500);
});

test('인정범위를 넘고 추가산정도 없으면 범위까지만', () => {
  // 25명, 요양보호사 추가 2명(2.4) + 사회복지사 1명(1.4) + 물리치료사 1명(1.4) = 5.2 > 4.0, 요양보호사 2명은 제4항 표에 없음 → 4.0
  const points = bonusPoints({ users: 25, added: { caregiver: 2, socialWorker: 1, therapist: 1 } });
  assert.equal(points.raw, 52);
  assert.equal(points.extraCap, 0);
  assert.equal(points.recognized, 40);
});

test('10원 미만 반올림 — 제52조제2항', () => {
  // 100 × 85% = 85 → × 1.0/1 → × 1.5 = 127.5 → 130
  assert.equal(bonusAmountWon(100, 10, 1, 15), 130);
  // 10,000,001 × 85% = 8,500,000.85 → × 1.2/7 × 1.5 = 15,300,001.53 ÷ 7 = 2,185,714.50… → 2,185,710
  assert.equal(bonusAmountWon(10_000_001, 12, 7, 15), 2_185_710);
  // 치매전담실만 있는 기관 1.3점: 10,000,000 × 85% × 1.2/10 × 1.3 = 1,326,000
  assert.equal(bonusAmountWon(10_000_000, 12, 10, 13), 1_326_000);
});
