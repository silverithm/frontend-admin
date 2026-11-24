/**
 * 노인요양공동생활가정 가산 계산 — `node --test src/lib/ltcGroupHomeBonus.test.ts`
 *
 * 기대값은 원문 규칙을 손으로 적용한 값이다(코드에서 베끼지 않는다).
 * - 별표 4 제6호: 요양보호사 입소자 3명당 1명(치매전담형 2.5명당 1명). 고시 제48조제1항: 소수점 이하 반올림, 0.5 미만이면 기본 1명.
 * - 고시 제55조제1항제1호나목·제3호: 요양보호사 1인당 입소자 수 2.4명 미만, 소수점 셋째자리에서 절사.
 * - 제56조제1항: 가산금액 = 기준금액(시설급여 급여비용 합의 80%) × [가산점수의 합/입소자수] × 서비스유형점수(1점, 치매전담형 0.9점)
 *   제2호: 요양보호사·간호(조무)사 1.2점, 사회복지사·물리(작업)치료사 1.4점, 조리원 노인요양공동생활가정 1.2점.
 * - 제56조제2항 아래 표(그림): 5명 미만 1.4점 이하, 5명 이상 10명 미만 2.6점 이하.
 * - 제56조제3항: 가산점수의 합에 요양보호사 포함 0.4점, 미포함 0.25점을 더하고 인정범위에 포함하지 않는다.
 * - 제52조제2항: 10원 미만 반올림.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  bonusAmountWon,
  capFor,
  caregiverBands,
  caregiverBonusEligible,
  firstBonusCaregivers,
  formatPoints,
  groupHomeBonusPoints,
  requiredCaregivers,
} from './ltcGroupHomeBonus.ts';

test('인정범위 — 5명 미만 1.4점, 5명 이상 10명 미만 2.6점 (0.01점 단위)', () => {
  assert.equal(capFor(1), 140);
  assert.equal(capFor(4), 140);
  assert.equal(capFor(5), 260);
  assert.equal(capFor(9), 260);
});

test('요양보호사 의무 인원 — 3명당 1명, 치매전담형 2.5명당 1명, 반올림', () => {
  // 1/3 = 0.33 → 0.5 미만이라 기본 1명, 4/3 = 1.33 → 1, 5/3 = 1.67 → 2, 7/3 = 2.33 → 2, 8/3 = 2.67 → 3, 9/3 = 3
  assert.equal(requiredCaregivers(1, 'general'), 1);
  assert.equal(requiredCaregivers(4, 'general'), 1);
  assert.equal(requiredCaregivers(5, 'general'), 2);
  assert.equal(requiredCaregivers(7, 'general'), 2);
  assert.equal(requiredCaregivers(8, 'general'), 3);
  assert.equal(requiredCaregivers(9, 'general'), 3);
  // 3/2.5 = 1.2 → 1, 4/2.5 = 1.6 → 2, 6/2.5 = 2.4 → 2, 7/2.5 = 2.8 → 3, 8/2.5 = 3.2 → 3, 9/2.5 = 3.6 → 4
  assert.equal(requiredCaregivers(3, 'dementia'), 1);
  assert.equal(requiredCaregivers(4, 'dementia'), 2);
  assert.equal(requiredCaregivers(6, 'dementia'), 2);
  assert.equal(requiredCaregivers(7, 'dementia'), 3);
  assert.equal(requiredCaregivers(8, 'dementia'), 3);
  assert.equal(requiredCaregivers(9, 'dementia'), 4);
});

test('요양보호사 가산 요건 — 의무보다 많고 1인당 2.4명 미만', () => {
  // 7명: 의무 2. 2명은 초과가 아니고, 3명이면 7/3 = 2.333 → 2.33 < 2.40 → 가산
  assert.equal(caregiverBonusEligible(7, 2, 'general'), false);
  assert.equal(caregiverBonusEligible(7, 3, 'general'), true);
  // 9명: 의무 3. 4명이면 9/4 = 2.25 → 가산
  assert.equal(caregiverBonusEligible(9, 3, 'general'), false);
  assert.equal(caregiverBonusEligible(9, 4, 'general'), true);
  // 치매전담형 9명: 의무 4. 5명이면 9/5 = 1.80 → 가산
  assert.equal(caregiverBonusEligible(9, 4, 'dementia'), false);
  assert.equal(caregiverBonusEligible(9, 5, 'dementia'), true);
});

test('가산 요건을 처음 채우는 인원 — 입소자 1~9명은 모두 의무 인원 + 1명', () => {
  // 일반: 1~4명 의무 1 → 2명, 5~7명 의무 2 → 3명(7/3 = 2.33), 8~9명 의무 3 → 4명(8/4 = 2.00, 9/4 = 2.25)
  assert.deepEqual(caregiverBands('general', 1, 9), [
    { from: 1, to: 4, required: 1, firstBonus: 2 },
    { from: 5, to: 7, required: 2, firstBonus: 3 },
    { from: 8, to: 9, required: 3, firstBonus: 4 },
  ]);
  // 치매전담형: 1~3명 의무 1 → 2명, 4~6명 의무 2 → 3명(6/3 = 2.00), 7~8명 의무 3 → 4명(8/4 = 2.00), 9명 의무 4 → 5명
  assert.deepEqual(caregiverBands('dementia', 1, 9), [
    { from: 1, to: 3, required: 1, firstBonus: 2 },
    { from: 4, to: 6, required: 2, firstBonus: 3 },
    { from: 7, to: 8, required: 3, firstBonus: 4 },
    { from: 9, to: 9, required: 4, firstBonus: 5 },
  ]);
  assert.equal(firstBonusCaregivers(7, 'general'), 3);
});

test('가산점수의 합 — 요양보호사가 포함되면 0.4점을 인정범위 밖에서 더한다', () => {
  // 9명, 요양보호사 1명 추가 1.2 + 조리원 1.2 = 2.4 ≤ 2.6 → 2.4 + 0.4 = 2.8
  assert.deepEqual(groupHomeBonusPoints({ residents: 9, added: { caregiver: 1 }, cook: true }), {
    raw: 240,
    cap: 260,
    recognized: 240,
    groupHomeExtra: 40,
    total: 280,
  });
  // 9명, 요양보호사 3명 추가 3.6 > 2.6 → 2.6 + 0.4 = 3.0
  assert.equal(groupHomeBonusPoints({ residents: 9, added: { caregiver: 3 } }).total, 300);
  // 4명(5명 미만 1.4점), 요양보호사 2명 추가 2.4 > 1.4 → 1.4 + 0.4 = 1.8
  assert.equal(groupHomeBonusPoints({ residents: 4, added: { caregiver: 2 } }).total, 180);
  // 9명, 요양보호사 1명 1.2 → 1.2 + 0.4 = 1.6 / 2명 2.4 → 2.8
  assert.equal(groupHomeBonusPoints({ residents: 9, added: { caregiver: 1 } }).total, 160);
  assert.equal(groupHomeBonusPoints({ residents: 9, added: { caregiver: 2 } }).total, 280);
});

test('가산점수의 합 — 요양보호사가 없으면 0.25점, 가산이 없으면 더하지 않는다', () => {
  // 간호(조무)사 1명 추가 1.2 + 0.25 = 1.45
  assert.equal(groupHomeBonusPoints({ residents: 9, added: { nurse: 1 } }).total, 145);
  // 사회복지사 1명 추가 1.4 + 0.25 = 1.65
  assert.equal(groupHomeBonusPoints({ residents: 6, added: { socialWorker: 1 } }).total, 165);
  assert.equal(groupHomeBonusPoints({ residents: 9, added: {} }).total, 0);
});

test('가산금액 — 기준금액 80% × (점수 합 ÷ 입소자) × 유형점수, 10원 미만 반올림', () => {
  // 2,000만 원 × 80% = 1,600만 원 × 2.8 ÷ 9 = 4,977,777.7… → 4,977,780원
  assert.equal(bonusAmountWon(20_000_000, 280, 9, 10), 4_977_780);
  // 1,600만 원 × 3.0 ÷ 9 = 5,333,333.3… → 5,333,330원
  assert.equal(bonusAmountWon(20_000_000, 300, 9, 10), 5_333_330);
  // 치매전담형 0.9점: 1,600만 원 × 2.8 ÷ 9 × 0.9 = 4,480,000원
  assert.equal(bonusAmountWon(20_000_000, 280, 9, 9), 4_480_000);
  // 1,200만 원 × 80% = 960만 원 × 1.45 ÷ 6 = 2,320,000원
  assert.equal(bonusAmountWon(12_000_000, 145, 6, 10), 2_320_000);
});

test('점수 표기 — 0.1점 단위는 한 자리, 0.25점은 두 자리', () => {
  assert.equal(formatPoints(120), '1.2');
  assert.equal(formatPoints(40), '0.4');
  assert.equal(formatPoints(25), '0.25');
  assert.equal(formatPoints(300), '3.0');
});
