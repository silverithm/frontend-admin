/**
 * 장기요양등급 판정기준 — `node --test src/lib/ltcGradeCriteria.test.ts`
 *
 * 기대값은 원문 규칙을 손으로 적용한 값이다(코드에서 베끼지 않는다).
 * - 시행령 제7조제1항: 1등급 95점 이상, 2등급 75점 이상 95점 미만, 3등급 60점 이상 75점 미만, 4등급 51점 이상 60점 미만,
 *   5등급 치매환자로서 45점 이상 51점 미만, 인지지원등급 치매환자로서 45점 미만.
 * - 시행령 제8조제1항: 처음 2년, 갱신되면 1등급 5년·2~4등급 4년·5등급 및 인지지원등급 2년.
 * - 등급판정기준 고시 제2조: 52개 항목(신체기능 12·인지기능 7·행동변화 14·간호처치 9·재활 10),
 *   점수표(기능자립정도 1~3, 증상여부 예1/아니오0, 증상유무 있다1/없다0, 운동장애정도 1~3, 관절제한정도 1~3),
 *   제5호 — 75점 미만 + 치매 요건 + 회귀모형 0.5 이상이면 한 단계 위 등급의 최저점수.
 *   영역별 100점 득점 환산표(그림 35746899·35746901)의 원점수 칸도 신체기능 12~36, 인지기능 0~7, 행동변화 0~14,
 *   간호처치 0~9, 재활 10~30으로 되어 있다 — 아래 원점수 범위와 같다.
 * - 시행령 별표 1: 노인성 질병 가~처 24개, 질병명에 '치매'가 들어간 것은 가~라(F00*·F01·F02*·F03).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ASSESSMENT_DOMAINS,
  GERIATRIC_DISEASES,
  GRADE_CRITERIA,
  INITIAL_VALIDITY_YEARS,
  dementiaAdjustedScore,
  domainItemCount,
  gradeById,
  gradeFor,
  rawScoreRange,
  scoreRangeLabel,
  totalItemCount,
} from './ltcGradeCriteria.ts';

test('여섯 등급의 점수 구간 — 시행령 제7조제1항 원문 표현', () => {
  assert.deepEqual(
    GRADE_CRITERIA.map((g) => [g.label, scoreRangeLabel(g), g.dementiaRequired]),
    [
      ['1등급', '95점 이상', false],
      ['2등급', '75점 이상 95점 미만', false],
      ['3등급', '60점 이상 75점 미만', false],
      ['4등급', '51점 이상 60점 미만', false],
      ['5등급', '45점 이상 51점 미만', true],
      ['인지지원등급', '45점 미만', true],
    ],
  );
});

test('경계 점수는 "이상" 쪽 등급 — 95·75·60·51·45', () => {
  assert.equal(gradeFor(100, false), '1');
  assert.equal(gradeFor(95, false), '1');
  assert.equal(gradeFor(94.9, false), '2');
  assert.equal(gradeFor(75, false), '2');
  assert.equal(gradeFor(74.9, false), '3');
  assert.equal(gradeFor(60, false), '3');
  assert.equal(gradeFor(59.9, false), '4');
  assert.equal(gradeFor(51, false), '4');
  assert.equal(gradeFor(51, true), '4'); // 치매가 있어도 51점이면 4등급
  assert.equal(gradeFor(50.9, true), '5');
  assert.equal(gradeFor(45, true), '5');
  assert.equal(gradeFor(44.9, true), 'cognitive');
  assert.equal(gradeFor(0, true), 'cognitive');
});

test('치매가 없으면 51점 미만은 어느 등급에도 해당하지 않는다', () => {
  assert.equal(gradeFor(50.9, false), null);
  assert.equal(gradeFor(45, false), null);
  assert.equal(gradeFor(30, false), null);
});

test('치매가 있어도 1~4등급은 점수대로', () => {
  assert.equal(gradeFor(96, true), '1');
  assert.equal(gradeFor(80, true), '2');
  assert.equal(gradeFor(65, true), '3');
  assert.equal(gradeFor(55, true), '4');
});

test('유효기간 — 처음 2년, 갱신 1등급 5년·2~4등급 4년·5등급·인지지원등급 2년', () => {
  assert.equal(INITIAL_VALIDITY_YEARS, 2);
  assert.equal(gradeById('1').renewedValidityYears, 5);
  assert.equal(gradeById('2').renewedValidityYears, 4);
  assert.equal(gradeById('3').renewedValidityYears, 4);
  assert.equal(gradeById('4').renewedValidityYears, 4);
  assert.equal(gradeById('5').renewedValidityYears, 2);
  assert.equal(gradeById('cognitive').renewedValidityYears, 2);
});

test('52개 항목 — 신체기능 12·인지기능 7·행동변화 14·간호처치 9·재활 10(운동장애 4 + 관절제한 6)', () => {
  assert.deepEqual(
    ASSESSMENT_DOMAINS.map((d) => [d.name, domainItemCount(d)]),
    [
      ['신체기능(기본적 일상생활기능)', 12],
      ['인지기능', 7],
      ['행동변화', 14],
      ['간호처치', 9],
      ['재활', 10],
    ],
  );
  const rehab = ASSESSMENT_DOMAINS[4];
  assert.deepEqual(
    rehab.groups.map((g) => [g.name, g.items.length]),
    [
      ['운동장애', 4],
      ['관절제한', 6],
    ],
  );
  assert.equal(totalItemCount(), 52);
});

test('영역별 원점수 범위 — 항목 수 × 최저·최고 점수 = 환산표 원점수 칸의 처음과 끝', () => {
  assert.deepEqual(
    ASSESSMENT_DOMAINS.map((d) => [d.name, rawScoreRange(d)]),
    [
      ['신체기능(기본적 일상생활기능)', { min: 12, max: 36 }], // 12 × 1, 12 × 3
      ['인지기능', { min: 0, max: 7 }],
      ['행동변화', { min: 0, max: 14 }],
      ['간호처치', { min: 0, max: 9 }],
      ['재활', { min: 10, max: 30 }], // (4 + 6) × 1, (4 + 6) × 3
    ],
  );
});

test('치매 보정 — 한 단계 위 등급의 최저점수, 75점 이상은 대상 아님', () => {
  assert.equal(dementiaAdjustedScore(74.9), 75); // 3등급 → 2등급 최저 75
  assert.equal(dementiaAdjustedScore(60), 75);
  assert.equal(dementiaAdjustedScore(59.9), 60); // 4등급 → 3등급 최저 60
  assert.equal(dementiaAdjustedScore(51), 60);
  assert.equal(dementiaAdjustedScore(50.9), 51); // 5등급 → 4등급 최저 51
  assert.equal(dementiaAdjustedScore(45), 51);
  assert.equal(dementiaAdjustedScore(44.9), 45); // 인지지원등급 → 5등급 최저 45
  assert.equal(dementiaAdjustedScore(10), 45);
  assert.equal(dementiaAdjustedScore(75), null);
  assert.equal(dementiaAdjustedScore(96), null);
});

test('노인성 질병 별표 1 — 24개, 치매가 들어간 질병명은 가~라', () => {
  assert.equal(GERIATRIC_DISEASES.length, 24);
  assert.equal(GERIATRIC_DISEASES[0].mark, '가');
  assert.equal(GERIATRIC_DISEASES[23].mark, '처');
  assert.deepEqual(
    GERIATRIC_DISEASES.filter((d) => d.name.includes('치매')).map((d) => [d.mark, d.code]),
    [
      ['가', 'F00*'],
      ['나', 'F01'],
      ['다', 'F02*'],
      ['라', 'F03'],
    ],
  );
  assert.equal(GERIATRIC_DISEASES.find((d) => d.mark === '버')?.code, 'U23.4');
  assert.equal(GERIATRIC_DISEASES.find((d) => d.mark === '서')?.code, 'R25.1');
  assert.equal(GERIATRIC_DISEASES.find((d) => d.mark === '처')?.code, 'G35');
});

test('잘못된 점수는 거절', () => {
  assert.throws(() => gradeFor(-1, true), RangeError);
  assert.throws(() => gradeFor(Number.NaN, false), RangeError);
});
