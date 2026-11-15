/**
 * 주·야간보호 인력배치 계산 — `node --test src/lib/ltcStaffing.test.ts`
 *
 * 기대값은 원문 규칙을 손으로 적용한 값이다(코드에서 베끼지 않는다).
 * - 별표 9: 일반 이용자 7명당 1명, 치매전담실 4명당 1명
 * - 고시 제48조제1항: 소수점 이하 반올림, 0.5 미만이면 기본 1명
 * - 고시 제49조제1항: (공휴일·근로자의 날·토요일 뺀 근무가능일수) × 8시간
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { caregiverBands, monthlyStandardHours, requiredCaregivers } from './ltcStaffing.ts';

test('일반실 — 7명당 1명, 반올림, 0.5 미만은 1명', () => {
  // 3/7 = 0.43 → 0.5 미만 → 기본 1명
  assert.equal(requiredCaregivers(3, 'general'), 1);
  // 10/7 = 1.43 → 1명
  assert.equal(requiredCaregivers(10, 'general'), 1);
  // 11/7 = 1.57 → 2명
  assert.equal(requiredCaregivers(11, 'general'), 2);
  // 17/7 = 2.43 → 2명, 18/7 = 2.57 → 3명
  assert.equal(requiredCaregivers(17, 'general'), 2);
  assert.equal(requiredCaregivers(18, 'general'), 3);
  // 20/7 = 2.86 → 3명, 25/7 = 3.57 → 4명, 30/7 = 4.29 → 4명
  assert.equal(requiredCaregivers(20, 'general'), 3);
  assert.equal(requiredCaregivers(25, 'general'), 4);
  assert.equal(requiredCaregivers(30, 'general'), 4);
  // 49/7 = 7 → 7명
  assert.equal(requiredCaregivers(49, 'general'), 7);
});

test('치매전담실 — 4명당 1명, 정확히 .5는 올린다', () => {
  // 1/4 = 0.25 → 기본 1명, 2/4 = 0.5 → 반올림 1명
  assert.equal(requiredCaregivers(1, 'dementia'), 1);
  assert.equal(requiredCaregivers(2, 'dementia'), 1);
  // 5/4 = 1.25 → 1명, 6/4 = 1.5 → 2명
  assert.equal(requiredCaregivers(5, 'dementia'), 1);
  assert.equal(requiredCaregivers(6, 'dementia'), 2);
  // 10/4 = 2.5 → 3명, 25/4 = 6.25 → 6명
  assert.equal(requiredCaregivers(10, 'dementia'), 3);
  assert.equal(requiredCaregivers(25, 'dementia'), 6);
});

test('이용자 수가 1 미만이거나 정수가 아니면 계산하지 않는다', () => {
  assert.throws(() => requiredCaregivers(0, 'general'), RangeError);
  assert.throws(() => requiredCaregivers(7.5, 'general'), RangeError);
});

test('구간 묶음 — 일반실 1~10명은 1명, 11~17명은 2명', () => {
  const bands = caregiverBands('general', 59);
  assert.deepEqual(bands.slice(0, 4), [
    { from: 1, to: 10, caregivers: 1 },
    { from: 11, to: 17, caregivers: 2 },
    { from: 18, to: 24, caregivers: 3 },
    { from: 25, to: 31, caregivers: 4 },
  ]);
  assert.deepEqual(bands[bands.length - 1], { from: 53, to: 59, caregivers: 8 });
  // 구간이 빈틈없이 이어진다
  for (let i = 1; i < bands.length; i += 1) assert.equal(bands[i].from, bands[i - 1].to + 1);
});

test('구간 묶음 — 치매전담실 1~5명 1명, 6~9명 2명, 22~25명 6명', () => {
  assert.deepEqual(caregiverBands('dementia', 25), [
    { from: 1, to: 5, caregivers: 1 },
    { from: 6, to: 9, caregivers: 2 },
    { from: 10, to: 13, caregivers: 3 },
    { from: 14, to: 17, caregivers: 4 },
    { from: 18, to: 21, caregivers: 5 },
    { from: 22, to: 25, caregivers: 6 },
  ]);
});

test('월 기준 근무시간 — 2026년 11월 168시간, 12월 176시간', () => {
  // 2026년 11월: 1일이 일요일, 평일 21일, 공휴일 없음 → 21 × 8
  assert.equal(monthlyStandardHours(2026, 11, []), 168);
  // 2026년 12월: 평일 23일 중 25일(금) 성탄절 → 22 × 8
  assert.equal(monthlyStandardHours(2026, 12, [25]), 176);
});
