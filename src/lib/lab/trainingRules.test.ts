/**
 * 법정 교육 이수 점검 테스트 — `node --test src/lib/lab/trainingRules.test.ts`
 * 왜: 평가자는 직원 한 명이라도 다섯 범주 중 빠졌는지 본다. 회의 참석이나 작년 교육을 이수로 세면 거짓 안심이다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { categoriesForKind, isCategoryForKind, summarizeCoverage, trainingCategoryLabel, trainingCoverage } from './trainingRules.ts';

type T = Parameters<typeof trainingCoverage>[0][number];
const T = (category: T['category'], attendeeIds: number[], heldOn = '2026-03-01', kind: T['kind'] = 'TRAINING'): T => ({ kind, category, attendeeIds, heldOn });
const staff = [{ id: 10, name: '가' }, { id: 11, name: '나' }];
const all = (ids: number[]) => (['ELDER_ABUSE', 'SEXUAL_HARASSMENT', 'INFECTION', 'SAFETY', 'PRIVACY'] as const).map((c) => T(c, ids));

test('다섯 범주를 모두 들으면 이수, 하나 빠지면 missing에 그 범주', () => {
  const trainings = all([10, 11]);
  trainings[4] = T('PRIVACY', [10]);
  const cov = trainingCoverage(trainings, staff, 2026);
  assert.equal(cov[0].complete, true);
  assert.deepEqual(cov[0].missing, []);
  assert.equal(cov[1].complete, false);
  assert.deepEqual(cov[1].missing, ['PRIVACY']);
  assert.deepEqual(cov[1].done, ['ELDER_ABUSE', 'SEXUAL_HARASSMENT', 'INFECTION', 'SAFETY']);
});

test('회의(MEETING)와 작년 교육은 이수로 세지 않는다 — 연말·연초 경계', () => {
  const trainings = [...all([10]).slice(0, 4), T('PRIVACY', [10], '2026-03-01', 'MEETING'), T('PRIVACY', [10], '2025-12-31'), T('PRIVACY', [10], '2027-01-01')];
  const cov = trainingCoverage(trainings, [staff[0]], 2026);
  assert.deepEqual(cov[0].missing, ['PRIVACY']);
  const jan1 = trainingCoverage([...all([10]).slice(0, 4), T('PRIVACY', [10], '2026-01-01')], [staff[0]], 2026);
  assert.equal(jan1[0].complete, true);
  const dec31 = trainingCoverage([...all([10]).slice(0, 4), T('PRIVACY', [10], '2026-12-31')], [staff[0]], 2026);
  assert.equal(dec31[0].complete, true);
});

test('법정 범주가 아닌 교육(직무·장애 인식·기타)은 이수에 영향이 없다', () => {
  const cov = trainingCoverage([T('JOB', [10]), T('DISABILITY_AWARENESS', [10]), T('OTHER', [10])], [staff[0]], 2026);
  assert.equal(cov[0].done.length, 0);
  assert.equal(cov[0].missing.length, 5);
});

test('교육이 없으면 모두 미이수, 직원이 없으면 빈 목록', () => {
  const cov = trainingCoverage([], staff, 2026);
  assert.ok(cov.every((c) => !c.complete && c.missing.length === 5));
  assert.deepEqual(trainingCoverage(all([10]), [], 2026), []);
});

test('같은 직원이 같은 범주를 두 번 들어도, 참석자에 없는 직원은 영향받지 않는다', () => {
  const cov = trainingCoverage([T('SAFETY', [10, 10]), T('SAFETY', [10])], staff, 2026);
  assert.deepEqual(cov[0].done, ['SAFETY']);
  assert.deepEqual(cov[1].done, []);
});

test('직원 목록에 같은 id가 중복이면 한 번만 낸다, 순서는 직원 순서 그대로', () => {
  const cov = trainingCoverage([], [{ id: 11, name: '나' }, { id: 10, name: '가' }, { id: 11, name: '나2' }], 2026);
  assert.deepEqual(cov.map((c) => c.staffId), [11, 10]);
  assert.equal(cov[0].staffName, '나');
});

test('잘못된 날짜·참석자 배열 이상 기록은 건너뛴다', () => {
  const bad = [T('SAFETY', [10], '2026-02-30'), { kind: 'TRAINING', category: 'SAFETY', attendeeIds: null as unknown as number[], heldOn: '2026-03-01' } as T];
  const cov = trainingCoverage(bad, [staff[0]], 2026);
  assert.deepEqual(cov[0].done, []);
});

test('summarizeCoverage — 이수 비율과 범주별 이수 직원 수', () => {
  const trainings = all([10, 11]);
  trainings[4] = T('PRIVACY', [10]);
  const summary = summarizeCoverage(trainingCoverage(trainings, staff, 2026));
  assert.equal(summary.total, 2);
  assert.equal(summary.complete, 1);
  assert.equal(summary.percent, 50);
  assert.equal(summary.byCategory.PRIVACY, 1);
  assert.equal(summary.byCategory.SAFETY, 2);
  assert.deepEqual(summarizeCoverage([]), { total: 0, complete: 0, percent: 0, byCategory: { ELDER_ABUSE: 0, SEXUAL_HARASSMENT: 0, INFECTION: 0, SAFETY: 0, PRIVACY: 0 } });
});

test('분류 — 교육은 교육 범주, 회의는 회의 범주만(서버가 400을 주는 조합)', () => {
  assert.equal(isCategoryForKind('TRAINING', 'ELDER_ABUSE'), true);
  assert.equal(isCategoryForKind('TRAINING', 'CASE'), false);
  assert.equal(isCategoryForKind('MEETING', 'CASE'), true);
  assert.equal(isCategoryForKind('MEETING', 'PRIVACY'), false);
  assert.equal(isCategoryForKind('MEETING', 'OTHER'), true);
  assert.equal(categoriesForKind('MEETING').length, 3);
  assert.equal(trainingCategoryLabel('ELDER_ABUSE'), '노인학대 예방');
  assert.equal(trainingCategoryLabel('UNKNOWN'), 'UNKNOWN');
});
