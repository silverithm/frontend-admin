/**
 * 간이세액표 데이터 테스트 — `node --test src/lib/lab/withholdingTable.test.ts`
 * 왜: 이 표는 법제처 [별표 2] PDF에서 추출한 숫자 8천여 개다. 한 칸이 밀리거나 구간이 비면 원천징수가 조용히 틀린다.
 * 그래서 (1) 구조(이어짐·단조), (2) 조사에서 읽어 둔 값(research-payroll.md), (3) 10,000천원 초과 산식의 이음매를 확인한다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WITHHOLDING_AT_10000,
  WITHHOLDING_FLOOR_WON,
  WITHHOLDING_OVER_10000_BANDS,
  WITHHOLDING_ROWS,
  WITHHOLDING_ROW_COUNT,
  WITHHOLDING_TABLE_VERSION,
  withholdingBaseTax,
} from './withholdingTable.ts';

test('표 구조 — 646행, 770천원부터 10,000천원까지 빈틈·겹침 없이 이어진다', () => {
  assert.equal(WITHHOLDING_ROW_COUNT, 646);
  assert.equal(WITHHOLDING_ROWS[0][0], 770);
  assert.equal(WITHHOLDING_ROWS[WITHHOLDING_ROWS.length - 1][1], 10000);
  for (const row of WITHHOLDING_ROWS) assert.equal(row.length, 13);
  for (let i = 1; i < WITHHOLDING_ROWS.length; i += 1) assert.equal(WITHHOLDING_ROWS[i][0], WITHHOLDING_ROWS[i - 1][1], `${i}행 이음`);
  assert.equal(WITHHOLDING_FLOOR_WON, WITHHOLDING_ROWS[0][0] * 1000);
});

test('표 구조 — 가족이 많을수록 세액이 같거나 작고, 월급여가 클수록 같거나 크다', () => {
  for (const row of WITHHOLDING_ROWS) for (let f = 2; f < 12; f += 1) assert.ok(row[f] >= row[f + 1], `${row[0]}천원 가족 ${f - 1}→${f}명`);
  for (let i = 1; i < WITHHOLDING_ROWS.length; i += 1) for (let f = 2; f < 13; f += 1) assert.ok(WITHHOLDING_ROWS[i][f] >= WITHHOLDING_ROWS[i - 1][f], `${WITHHOLDING_ROWS[i][0]}천원 칸 ${f}`);
  for (let f = 0; f < 10; f += 1) assert.ok(WITHHOLDING_AT_10000[f] >= WITHHOLDING_AT_10000[f + 1]);
});

test('표 구조 — 10,000천원 행은 바로 아래 구간(9,980~10,000) 다음 값이다', () => {
  const last = WITHHOLDING_ROWS[WITHHOLDING_ROWS.length - 1];
  for (let f = 0; f < 11; f += 1) assert.ok(WITHHOLDING_AT_10000[f] >= last[f + 2], `가족 ${f + 1}명`);
});

test('조사 검증값 — 월 2,500~2,510천원 1~4인 (35,600 / 28,600 / 16,530 / 13,150)', () => {
  assert.equal(withholdingBaseTax(2_500_000, 1), 35_600);
  assert.equal(withholdingBaseTax(2_500_000, 2), 28_600);
  assert.equal(withholdingBaseTax(2_500_000, 3), 16_530);
  assert.equal(withholdingBaseTax(2_500_000, 4), 13_150);
  assert.equal(withholdingBaseTax(2_509_999, 1), 35_600);
});

test('조사 검증값 — 3,500~3,520천원 4인 49,340(국세청 예시), 2,000~2,010 1인 19,520, 3,000~3,020 1인 74,350, 5,000~5,020 1인 335,470', () => {
  assert.equal(withholdingBaseTax(3_500_000, 4), 49_340);
  assert.equal(withholdingBaseTax(3_519_999, 4), 49_340);
  assert.equal(withholdingBaseTax(2_000_000, 1), 19_520);
  assert.equal(withholdingBaseTax(3_000_000, 1), 74_350);
  assert.equal(withholdingBaseTax(5_000_000, 1), 335_470);
});

test('조사 검증값 — 표에서 직접 읽은 나머지 값(1,060·1,500·4,000·7,000천원 행, 10,000천원 행)', () => {
  assert.equal(withholdingBaseTax(1_060_000, 1), 1_040);
  assert.equal(withholdingBaseTax(1_060_000, 2), 0);
  assert.equal(withholdingBaseTax(1_500_000, 2), 4_420);
  assert.equal(withholdingBaseTax(4_000_000, 3), 109_590);
  assert.equal(withholdingBaseTax(7_000_000, 1), 732_700);
  assert.equal(withholdingBaseTax(10_000_000, 1), 1_507_400);
  assert.equal(withholdingBaseTax(10_000_000, 11), 960_840);
});

test('행 경계 — 이상은 포함, 미만은 다음 행', () => {
  assert.equal(withholdingBaseTax(2_509_999, 1), 35_600);
  assert.equal(withholdingBaseTax(2_510_000, 1), 35_940);
  assert.equal(withholdingBaseTax(2_519_999, 1), 35_940);
  assert.equal(withholdingBaseTax(2_550_000, 1), 37_310);
  assert.equal(withholdingBaseTax(1_064_999, 1), 1_040);
  assert.equal(withholdingBaseTax(1_065_000, 1), 1_110);
});

test('770천원 미만은 0, 770천원부터 표가 시작하고 0이다', () => {
  assert.equal(withholdingBaseTax(0, 1), 0);
  assert.equal(withholdingBaseTax(769_999, 1), 0);
  assert.equal(withholdingBaseTax(770_000, 1), 0);
  assert.equal(withholdingBaseTax(-5, 1), 0);
  assert.equal(withholdingBaseTax(Number.NaN, 1), 0);
});

test('표의 마지막 행과 10,000천원 경계', () => {
  assert.equal(withholdingBaseTax(9_980_000, 1), 1_503_990);
  assert.equal(withholdingBaseTax(9_999_999, 1), 1_503_990);
  assert.equal(withholdingBaseTax(10_000_000, 1), 1_507_400);
});

test('가족 수 — 1명 미만은 1명으로, 11명 초과는 별표 2 비고 4 식(음수면 0)', () => {
  assert.equal(withholdingBaseTax(3_500_000, 0), 127_220);
  assert.equal(withholdingBaseTax(3_500_000, 11), 10_640);
  // 11명 10,640, 10명 14,010 → 12명 = 10,640 − 3,370
  assert.equal(withholdingBaseTax(3_500_000, 12), 7_270);
  assert.equal(withholdingBaseTax(3_500_000, 13), 3_900);
  assert.equal(withholdingBaseTax(3_500_000, 14), 530);
  assert.equal(withholdingBaseTax(3_500_000, 15), 0);
  assert.equal(withholdingBaseTax(3_500_000, 2.9), 102_220);
});

test('10,000천원 초과 산식 — 손으로 계산한 값', () => {
  // 1인 기준 (10,000천원 세액 1,507,400)
  assert.equal(withholdingBaseTax(10_000_001, 1), 1_507_400 + 25_000);
  // 12,000천원: 초과 2,000,000 × 98% × 35% = 686,000
  assert.equal(withholdingBaseTax(12_000_000, 1), 1_507_400 + 25_000 + 686_000);
  assert.equal(withholdingBaseTax(14_000_000, 1), 1_507_400 + 1_397_000);
  // 20,000천원: 1,397,000 + 6,000,000 × 98% × 38% = 2,234,400
  assert.equal(withholdingBaseTax(20_000_000, 1), 1_507_400 + 1_397_000 + 2_234_400);
  assert.equal(withholdingBaseTax(28_000_000, 1), 1_507_400 + 6_610_600);
  assert.equal(withholdingBaseTax(30_000_000, 1), 1_507_400 + 7_394_600);
  // 40,000천원: 7,394,600 + 10,000,000 × 40%
  assert.equal(withholdingBaseTax(40_000_000, 1), 1_507_400 + 7_394_600 + 4_000_000);
  assert.equal(withholdingBaseTax(45_000_000, 1), 1_507_400 + 13_394_600);
  assert.equal(withholdingBaseTax(60_000_000, 1), 1_507_400 + 13_394_600 + 6_300_000);
  assert.equal(withholdingBaseTax(87_000_000, 1), 1_507_400 + 31_034_600);
  assert.equal(withholdingBaseTax(100_000_000, 1), 1_507_400 + 31_034_600 + 5_850_000);
  // 가족 수가 다르면 10,000천원 세액만 달라진다
  assert.equal(withholdingBaseTax(12_000_000, 4), 1_170_840 + 25_000 + 686_000);
});

test('10,000천원 초과 산식 — 구간 이음매가 끊기지 않는다(경계 바로 위는 경계 값 + 1원 몫)', () => {
  let from = 10_000_000;
  for (const band of WITHHOLDING_OVER_10000_BANDS.slice(0, -1)) {
    assert.equal(band.from, from);
    const atEdge = withholdingBaseTax(band.upTo, 1);
    const above = withholdingBaseTax(band.upTo + 1, 1);
    assert.ok(above >= atEdge && above - atEdge <= 1, `${band.upTo} 이음`);
    from = band.upTo;
  }
  // 표 마지막 행 → 10,000천원 초과 첫 구간도 이어진다
  assert.ok(withholdingBaseTax(10_000_001, 1) - withholdingBaseTax(9_999_999, 1) < 40_000);
});

test('10,000천원 초과 산식 — 소수 곱이 정수로 내림된다', () => {
  // 3 × 3430 / 10000 = 1.029 → 1
  assert.equal(withholdingBaseTax(10_000_003, 1), 1_507_400 + 25_000 + 1);
  // 2 × 3430 / 10000 = 0.686 → 0
  assert.equal(withholdingBaseTax(10_000_002, 1), 1_507_400 + 25_000);
});

test('출처 표시 — 별표 2, 개정일 2026-02-27, 적용 2026-03-01, 대조 필요 문구', () => {
  assert.match(WITHHOLDING_TABLE_VERSION.law, /별표 2/);
  assert.equal(WITHHOLDING_TABLE_VERSION.amended, '2026-02-27');
  assert.equal(WITHHOLDING_TABLE_VERSION.appliesFrom, '2026-03-01');
  assert.match(WITHHOLDING_TABLE_VERSION.sourceUrl, /law\.go\.kr/);
  assert.match(WITHHOLDING_TABLE_VERSION.note, /대조 필요/);
});
