/**
 * 2026년 요양원·노인요양공동생활가정 수가 — `node --test src/lib/ltcFacilityFee.test.ts`
 *
 * 기대값은 원문 규칙을 손으로 적용한 값이다(코드에서 베끼지 않는다).
 * - 제44조제1항제1호 표(그림 flSeq=169768535): 바-1 1등급 93,070 · 바-2 2등급 86,340 · 바-3 3~5등급 81,540 (원)
 * - 제44조제1항제2호 표(169768217): 바-4 88,520 · 바-5 82,120 · 바-6 77,540
 * - 제44조제2항 표(169768539): 바-7 74,590 · 바-8 69,210 · 바-9 63,800
 * - 제74조제2항 표(169768599): 아-1 2등급 가형 96,950 나형 90,160 · 3~5등급 가형 89,400 나형 83,140,
 *   아-2 2등급 85,790 · 3~5등급 79,100
 *   (위 15칸은 공단 건강Law 제2025-247호 개정전문 PDF 글자와도 같다)
 * - 시행령 제15조의8제2호: 시설급여 본인부담 100분의 20
 * - 제45조제2항제1호: 외박 50%, 1개월 15일까지 / 제38조제2항(제45조제1항 준용): 입·퇴소 당일 12시간 미만 50%
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEMENTIA_FACILITY_FEES_2026,
  FACILITY_FEE_TABLES_2026,
  facilityFee,
  facilityMonth,
  percentOf,
} from './ltcFacilityFee.ts';

test('제44조 표 — 아홉 칸 분류번호·등급·금액 (원문 순서)', () => {
  assert.deepEqual(
    FACILITY_FEE_TABLES_2026.map((t) => [t.basis, t.rows.map((r) => [r.code, r.grade, r.fee])]),
    [
      ['제44조제1항제1호', [['바-1', '1', 93070], ['바-2', '2', 86340], ['바-3', '3-5', 81540]]],
      ['제44조제1항제2호', [['바-4', '1', 88520], ['바-5', '2', 82120], ['바-6', '3-5', 77540]]],
      ['제44조제2항', [['바-7', '1', 74590], ['바-8', '2', 69210], ['바-9', '3-5', 63800]]],
    ]
  );
});

test('제74조제2항 표 — 치매전담실 가형·나형, 치매전담형 공동생활가정 (1등급 행 없음)', () => {
  assert.deepEqual(
    DEMENTIA_FACILITY_FEES_2026.map((r) => [r.code, r.grade, r.typeA, r.typeB]),
    [
      ['아-1', '2', 96950, 90160],
      ['아-1', '3-5', 89400, 83140],
      ['아-2', '2', 85790, null],
      ['아-2', '3-5', 79100, null],
    ]
  );
});

test('분류번호로 금액 찾기, 없는 번호는 에러', () => {
  assert.equal(facilityFee('바-1'), 93070);
  assert.equal(facilityFee('바-6'), 77540);
  assert.equal(facilityFee('바-9'), 63800);
  // @ts-expect-error 없는 분류번호
  assert.throws(() => facilityFee('바-10'), RangeError);
});

test('1일 본인부담 20% — 아홉 칸 손계산', () => {
  // 93,070×0.2=18,614 / 86,340×0.2=17,268 / 81,540×0.2=16,308 / 88,520×0.2=17,704 / 82,120×0.2=16,424
  // 77,540×0.2=15,508 / 74,590×0.2=14,918 / 69,210×0.2=13,842 / 63,800×0.2=12,760
  const fees = [93070, 86340, 81540, 88520, 82120, 77540, 74590, 69210, 63800];
  assert.deepEqual(
    fees.map((f) => percentOf(f, 20)),
    [18614, 17268, 16308, 17704, 16424, 15508, 14918, 13842, 12760]
  );
});

test('30일·31일 본인부담 — 1일 본인부담 × 일수', () => {
  // 30일: 18,614×30=558,420 / 17,268×30=518,040 / 16,308×30=489,240 / 12,760×30=382,800
  assert.equal(facilityMonth({ dailyFee: 93070, fullDays: 30 }).copay, 558420);
  assert.equal(facilityMonth({ dailyFee: 86340, fullDays: 30 }).copay, 518040);
  assert.equal(facilityMonth({ dailyFee: 81540, fullDays: 30 }).copay, 489240);
  assert.equal(facilityMonth({ dailyFee: 63800, fullDays: 30 }).copay, 382800);
  // 31일: 558,420+18,614=577,034 / 13,842×31=429,102 / 치매전담실 가형 2등급 19,390×31=601,090
  assert.equal(facilityMonth({ dailyFee: 93070, fullDays: 31 }).copay, 577034);
  assert.equal(facilityMonth({ dailyFee: 69210, fullDays: 31 }).copay, 429102);
  assert.equal(facilityMonth({ dailyFee: 96950, fullDays: 31 }).copay, 601090);
  // 치매전담형 공동생활가정 3~5등급 79,100×0.2=15,820, ×30=474,600
  assert.equal(facilityMonth({ dailyFee: 79100, fullDays: 30 }).copay, 474600);
});

test('예시 1 — 1등급, 제1호 시설, 30일', () => {
  // 93,070×30=2,792,100 · 20%=558,420 · 공단 2,233,680
  assert.deepEqual(facilityMonth({ dailyFee: 93070, fullDays: 30 }), {
    totalFee: 2792100,
    copay: 558420,
    insurerShare: 2233680,
  });
});

test('예시 2 — 2등급, 제1호 시설, 31일 중 입원 외박 3일', () => {
  // 86,340×28=2,417,520 + 외박 86,340×50%=43,170 ×3=129,510 → 2,547,030 · 20%=509,406 · 공단 2,037,624
  assert.deepEqual(facilityMonth({ dailyFee: 86340, fullDays: 28, overnightDays: 3 }), {
    totalFee: 2547030,
    copay: 509406,
    insurerShare: 2037624,
  });
});

test('예시 3 — 3등급(등급판정위원회 인정), 제1호 시설, 15시 입소일 + 20일', () => {
  // 입소일 9시간 → 81,540×50%=40,770 + 81,540×20=1,630,800 → 1,671,570 · 20%=334,314 · 공단 1,337,256
  assert.deepEqual(facilityMonth({ dailyFee: 81540, fullDays: 20, shortDays: 1 }), {
    totalFee: 1671570,
    copay: 334314,
    insurerShare: 1337256,
  });
});

test('제1호와 제2호의 1일 차이 — 1등급 4,550원, 2등급 4,220원, 3~5등급 4,000원', () => {
  assert.equal(facilityFee('바-1') - facilityFee('바-4'), 4550);
  assert.equal(facilityFee('바-2') - facilityFee('바-5'), 4220);
  assert.equal(facilityFee('바-3') - facilityFee('바-6'), 4000);
});

test('외박비용 1개월 15일 초과, 음수·소수 날 수는 에러', () => {
  assert.throws(() => facilityMonth({ dailyFee: 93070, fullDays: 10, overnightDays: 16 }), RangeError);
  assert.throws(() => facilityMonth({ dailyFee: 93070, fullDays: -1 }), RangeError);
  assert.throws(() => facilityMonth({ dailyFee: 93070, fullDays: 1.5 }), RangeError);
});

test('원 미만 단수가 생기는 비율 계산은 멈춘다 (단수 처리 규정을 확인하지 않은 값)', () => {
  // 93,075×50% = 46,537.5
  assert.throws(() => percentOf(93075, 50), RangeError);
});
