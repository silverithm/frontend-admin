/**
 * 급여 만족도 문항·요약·식사 반기 테스트 — `node --test src/lib/lab/satisfactionRules.test.ts`
 * 왜: 평균이 한 칸 어긋나거나 반기 경계(6/30·7/1)가 하루 틀리면 "식사 만족도 반기 1회" 판정이 거짓이 된다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { SURVEY_QUESTIONS, mealSurveyCoverage, mealSurveyHalfStatus, questionByCode, surveySummary } from './satisfactionRules.ts';

const Q = SURVEY_QUESTIONS;
const [q0, q1] = Q.MEAL.map((q) => q.code);
const R = (kind: 'MEAL' | 'PROGRAM' | 'TRANSPORT' | 'GENERAL', surveyDate: string, scores: Record<string, number>, elderlyId: number | null = null) => ({ kind, surveyDate, scores, elderlyId });

test('문항 — 종류마다 4~6개, code 형식과 유일성', () => {
  const codes: string[] = [];
  for (const kind of ['MEAL', 'PROGRAM', 'TRANSPORT', 'GENERAL'] as const) {
    assert.ok(Q[kind].length >= 4 && Q[kind].length <= 6, kind);
    for (const q of Q[kind]) {
      assert.match(q.code, /^[A-Z0-9_]{2,30}$/);
      assert.ok(q.text.length >= 8);
      codes.push(q.code);
    }
  }
  assert.equal(new Set(codes).size, codes.length);
});

test('문항 — 2026 평가 36의 세 기준(식사 양·맛·시간, 프로그램 강사·시간·내용, 이동 소요시간·변경 안내·편안함)을 덮는다', () => {
  const text = (k: keyof typeof Q) => Q[k].map((q) => q.text).join(' ');
  assert.match(text('MEAL'), /양/);
  assert.match(text('MEAL'), /맛/);
  assert.match(text('MEAL'), /시간/);
  assert.match(text('PROGRAM'), /강사/);
  assert.match(text('PROGRAM'), /시간/);
  assert.match(text('PROGRAM'), /내용/);
  assert.match(text('TRANSPORT'), /걸리는 시간/);
  assert.match(text('TRANSPORT'), /안내/);
  assert.match(text('TRANSPORT'), /편안/);
  assert.equal(questionByCode('MEAL_TASTE')?.kind, 'MEAL');
  assert.equal(questionByCode('NOPE'), undefined);
});

test('요약 — 평균은 소수 첫째 자리 반올림, 낮은 문항은 3.0 미만', () => {
  const resp = [R('MEAL', '2026-03-10', { [q0]: 5, [q1]: 2 }), R('MEAL', '2026-05-01', { [q0]: 4, [q1]: 3 }), R('MEAL', '2026-09-01', { [q0]: 4 }), R('PROGRAM', '2026-09-02', { [Q.PROGRAM[0].code]: 1 })];
  const s = surveySummary(resp, 'MEAL');
  const by = Object.fromEntries(s.byQuestion.map((b) => [b.code, [b.avg, b.n]]));
  assert.deepEqual([s.count, by[q0], by[q1], s.overall, s.lowQuestions], [3, [4.3, 3], [2.5, 2], 3.6, [q1]]);
  assert.deepEqual(s.byQuestion.map((b) => b.code), Q.MEAL.map((q) => q.code));
  assert.deepEqual(by[Q.MEAL[2].code], [null, 0]);
});

test('요약 — 반올림 경계: 평균 2.96은 3.0으로 보이지만 낮은 문항이다', () => {
  // 25명 중 24명이 3, 1명이 2 → 평균 2.96
  const resp = Array.from({ length: 25 }, (_, i) => R('MEAL', '2026-03-10', { [q0]: i === 0 ? 2 : 3 }));
  const s = surveySummary(resp, 'MEAL');
  assert.equal(s.byQuestion[0].avg, 3);
  assert.deepEqual(s.lowQuestions, [q0]);
  // 정확히 3.0은 낮은 문항이 아니다
  assert.deepEqual(surveySummary([R('MEAL', '2026-03-10', { [q0]: 3 })], 'MEAL').lowQuestions, []);
});

test('요약 — 반올림은 .x5를 올린다(4.25는 4.3, 3.35 등 부동소수 함정 없음)', () => {
  const four = [5, 4, 4, 4].map((v) => R('MEAL', '2026-03-10', { [q0]: v }));
  assert.equal(surveySummary(four, 'MEAL').byQuestion[0].avg, 4.3);
  const odd = [3, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 4].map((v) => R('MEAL', '2026-03-10', { [q0]: v }));
  assert.equal(surveySummary(odd, 'MEAL').byQuestion[0].avg, 3.5);
});

test('요약 — 응답이 없으면 null, 1~5 밖 점수·그 종류 문항에 없는 코드는 세지 않는다', () => {
  const none = surveySummary([], 'TRANSPORT');
  assert.equal(none.count, 0);
  assert.equal(none.overall, null);
  assert.ok(none.byQuestion.every((b) => b.avg === null && b.n === 0));
  const messy = surveySummary([R('MEAL', '2026-03-10', { [q0]: 9, [q1]: 0, MEAL_OLD: 1, [Q.PROGRAM[0].code]: 1 })], 'MEAL');
  assert.equal(messy.count, 1);
  assert.equal(messy.overall, null);
  assert.deepEqual(messy.lowQuestions, []);
});

test('식사 만족도 반기 — 6/30은 상반기, 7/1은 하반기, 다른 해·다른 종류는 뺀다', () => {
  const resp = [R('MEAL', '2026-03-10', {}), R('MEAL', '2026-06-30', {}), R('MEAL', '2026-07-01', {}), R('MEAL', '2025-12-01', {}), R('PROGRAM', '2026-09-02', {}), R('MEAL', '2027-01-01', {})];
  assert.deepEqual(mealSurveyHalfStatus(resp, 2026), { h1: 2, h2: 1, met: { h1: true, h2: true } });
  assert.deepEqual(mealSurveyHalfStatus([], 2026), { h1: 0, h2: 0, met: { h1: false, h2: false } });
  assert.deepEqual(mealSurveyHalfStatus([R('MEAL', '2026-03-10', {})], 2026).met, { h1: true, h2: false });
});

test('식사 만족도 대상 범위 — 반기마다 응답이 없는 어르신과 익명 응답 처리', () => {
  const resp = [R('MEAL', '2026-03-10', {}, 1), R('MEAL', '2026-04-10', {}, 1), R('MEAL', '2026-09-10', {}, 2), R('MEAL', '2026-04-11', {}, null), R('PROGRAM', '2026-04-11', {}, 3)];
  const c = mealSurveyCoverage(resp, 2026, [1, 2, 3, 3]);
  assert.deepEqual(c.h1, { done: 1, total: 3, missing: [2, 3] });
  assert.deepEqual(c.h2, { done: 1, total: 3, missing: [1, 3] });
  assert.deepEqual(mealSurveyCoverage([], 2026, []).h1, { done: 0, total: 0, missing: [] });
});
