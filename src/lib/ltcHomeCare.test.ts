/**
 * 2026년 방문요양 수가 — `node --test src/lib/ltcHomeCare.test.ts`
 *
 * 기대값은 원문 규칙을 손으로 적용한 값이다(코드에서 베끼지 않는다).
 * - 제18조 표(그림 flSeq=169768523, 공단 개정전문 PDF와 일치): 가-1 30분 17,450 · 가-2 60분 25,320 · 가-3 90분 34,120 ·
 *   가-4 120분 43,430 · 가-5 150분 50,640 · 가-6 180분 57,020 · 가-7 210분 63,530 · 가-8 240분 70,080 (원)
 * - 제13조제1항 월 한도액: 1등급 2,512,900 · 2등급 2,331,200 · 3등급 1,528,200 · 4등급 1,409,700 (원)
 * - 제19조의2: 1회 60분 이상 120분 미만 2,000원, 120분 이상 180분 미만 4,000원, 180분 이상 6,000원, 1일 6,000원 상한
 * - 제19조제2항: 가-7·가-8은 1·2등급만
 * - 시행령 제15조의8: 재가급여 본인부담 100분의 15, 제13조제6항: 한도 초과분은 수급자 전부 부담
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  HOME_CARE_FEES_2026,
  codeAllowedForGrade,
  homeCareFee,
  homeCareMonth,
  rowForMinutes,
  severeAddOnPerDay,
  severeAddOnPerVisit,
  visitsWithinLimit,
} from './ltcHomeCare.ts';

test('제18조 표 — 여덟 칸 금액과 시간', () => {
  assert.deepEqual(
    HOME_CARE_FEES_2026.map((r) => [r.code, r.minutes, r.fee]),
    [
      ['가-1', 30, 17450],
      ['가-2', 60, 25320],
      ['가-3', 90, 34120],
      ['가-4', 120, 43430],
      ['가-5', 150, 50640],
      ['가-6', 180, 57020],
      ['가-7', 210, 63530],
      ['가-8', 240, 70080],
    ]
  );
});

test('급여제공시간 → 표의 행 ("N분 이상")', () => {
  assert.equal(rowForMinutes(29), null);
  assert.equal(rowForMinutes(30)?.code, '가-1');
  assert.equal(rowForMinutes(59)?.code, '가-1');
  assert.equal(rowForMinutes(60)?.code, '가-2');
  assert.equal(rowForMinutes(179)?.code, '가-5');
  assert.equal(rowForMinutes(180)?.code, '가-6');
  assert.equal(rowForMinutes(269)?.code, '가-8');
});

test('중증 수급자 가산 — 구간 경계와 1일 상한', () => {
  assert.equal(severeAddOnPerVisit(59), 0);
  assert.equal(severeAddOnPerVisit(60), 2000);
  assert.equal(severeAddOnPerVisit(119), 2000);
  assert.equal(severeAddOnPerVisit(120), 4000);
  assert.equal(severeAddOnPerVisit(179), 4000);
  assert.equal(severeAddOnPerVisit(180), 6000);
  assert.equal(severeAddOnPerVisit(240), 6000);
  // 하루 90분 두 번 = 2,000 + 2,000 = 4,000 (상한 아래)
  assert.equal(severeAddOnPerDay([90, 90]), 4000);
  // 하루 120분 두 번 = 4,000 + 4,000 = 8,000 → 상한 6,000
  assert.equal(severeAddOnPerDay([120, 120]), 6000);
  // 60분 세 번 = 6,000 (상한과 같음)
  assert.equal(severeAddOnPerDay([60, 60, 60]), 6000);
});

test('가-7·가-8은 1·2등급만, 5등급·인지지원등급은 일반 방문요양 표 밖', () => {
  assert.equal(codeAllowedForGrade('가-8', '1'), true);
  assert.equal(codeAllowedForGrade('가-7', '2'), true);
  assert.equal(codeAllowedForGrade('가-8', '3'), false);
  assert.equal(codeAllowedForGrade('가-7', '4'), false);
  assert.equal(codeAllowedForGrade('가-6', '4'), true);
  assert.equal(codeAllowedForGrade('가-2', '5'), false);
  assert.equal(codeAllowedForGrade('가-2', 'cognitive'), false);
});

test('월 한도액 ÷ 1회 금액 (소수점 버림)', () => {
  // 1등급 2,512,900 ÷ 25,320 = 99.24 → 99, ÷ 43,430 = 57.86 → 57, ÷ 57,020 = 44.07 → 44, ÷ 70,080 = 35.86 → 35
  assert.equal(visitsWithinLimit('1', '가-2'), 99);
  assert.equal(visitsWithinLimit('1', '가-4'), 57);
  assert.equal(visitsWithinLimit('1', '가-6'), 44);
  assert.equal(visitsWithinLimit('1', '가-8'), 35);
  // 2등급 2,331,200 ÷ 25,320 = 92.07 → 92, ÷ 43,430 = 53.68 → 53, ÷ 57,020 = 40.88 → 40, ÷ 70,080 = 33.26 → 33
  assert.equal(visitsWithinLimit('2', '가-2'), 92);
  assert.equal(visitsWithinLimit('2', '가-4'), 53);
  assert.equal(visitsWithinLimit('2', '가-6'), 40);
  assert.equal(visitsWithinLimit('2', '가-8'), 33);
  // 3등급 1,528,200 ÷ 25,320 = 60.36 → 60, ÷ 43,430 = 35.19 → 35, ÷ 57,020 = 26.80 → 26
  assert.equal(visitsWithinLimit('3', '가-2'), 60);
  assert.equal(visitsWithinLimit('3', '가-4'), 35);
  assert.equal(visitsWithinLimit('3', '가-6'), 26);
  assert.equal(visitsWithinLimit('3', '가-8'), null);
  // 4등급 1,409,700 ÷ 25,320 = 55.68 → 55, ÷ 43,430 = 32.46 → 32, ÷ 57,020 = 24.72 → 24
  assert.equal(visitsWithinLimit('4', '가-2'), 55);
  assert.equal(visitsWithinLimit('4', '가-4'), 32);
  assert.equal(visitsWithinLimit('4', '가-6'), 24);
});

test('한 달 본인부담 — 한도 안', () => {
  // 3등급, 180분(57,020원) 22회 = 1,254,440원 ≤ 1,528,200원 → 15% = 188,166원, 공단 1,066,274원
  const m = homeCareMonth('3', '가-6', 22);
  assert.equal(m.totalFee, 1254440);
  assert.equal(m.overLimit, 0);
  assert.equal(m.copayWithinLimit, 188166);
  assert.equal(m.insurerShare, 1066274);
  assert.equal(m.totalCopay, 188166);
});

test('한 달 본인부담 — 1·2등급 240분 매일', () => {
  // 1등급, 240분(70,080원) 30회 = 2,102,400원 ≤ 2,512,900원 → 15% = 315,360원
  const m = homeCareMonth('1', '가-8', 30);
  assert.equal(m.totalFee, 2102400);
  assert.equal(m.copayWithinLimit, 315360);
  // 31일 매일이어도 70,080 × 31 = 2,172,480원으로 2등급 한도 2,331,200원 안
  assert.equal(homeCareMonth('2', '가-8', 31).overLimit, 0);
  assert.equal(homeCareMonth('2', '가-8', 31).totalFee, 2172480);
});

test('한 달 본인부담 — 한도 초과', () => {
  // 4등급, 180분 26회 = 1,482,520원 > 1,409,700원 → 초과 72,820원, 한도 안 15% = 211,455원, 합 284,275원
  const m = homeCareMonth('4', '가-6', 26);
  assert.equal(m.totalFee, 1482520);
  assert.equal(m.coveredFee, 1409700);
  assert.equal(m.overLimit, 72820);
  assert.equal(m.copayWithinLimit, 211455);
  assert.equal(m.totalCopay, 284275);
});

test('homeCareFee — 없는 분류는 오류', () => {
  assert.equal(homeCareFee('가-5'), 50640);
  // @ts-expect-error 일부러 잘못된 분류번호
  assert.throws(() => homeCareFee('가-9'), RangeError);
});
