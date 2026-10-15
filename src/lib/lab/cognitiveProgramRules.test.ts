/**
 * 인지활동형 프로그램 누락 점검 테스트 — `node --test src/lib/lab/cognitiveProgramRules.test.ts`
 * 왜: 5등급·인지지원 수급자는 그날 60분 이상·허용 제공자의 인지활동형이 없으면 급여비용을 산정할 수 없다(고시 제32조⑩). 정확히 60분과 제공자 경계가 핵심이다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  COGNITIVE_PROVIDERS,
  COGNITIVE_REQUIRED_GRADES,
  cognitiveCoverage,
  cognitiveSessionsFor,
  isCognitiveRequiredGrade,
  monthCognitiveGaps,
  type CognitiveProgramSession,
} from './cognitiveProgramRules.ts';

const A = { elderlyId: 1, careGrade: 'GRADE_5' };
const B = { elderlyId: 2, careGrade: 'COGNITIVE_SUPPORT' };
const C = { elderlyId: 3, careGrade: 'GRADE_3' };
const S = (programDate: string, durationMinutes: number | null, providerKind: CognitiveProgramSession['providerKind'], participantIds: number[], cognitiveActivity = true): CognitiveProgramSession => ({ programDate, cognitiveActivity, durationMinutes, providerKind, participantIds });
const cov = (programs: CognitiveProgramSession[], attendees = [C, B, A]) => cognitiveCoverage('2026-10-14', attendees, programs).map((r) => [r.elderlyId, r.state]);

test('대상 등급은 5등급·인지지원등급뿐이고 허용 제공자는 셋', () => {
  assert.deepEqual(COGNITIVE_REQUIRED_GRADES, ['GRADE_5', 'COGNITIVE_SUPPORT']);
  assert.deepEqual(COGNITIVE_PROVIDERS.map((p) => [p.key, p.allowed]), [['PROGRAM_MANAGER', true], ['DEMENTIA_CAREGIVER', true], ['EXTERNAL_INSTRUCTOR', true], ['OTHER', false]]);
  assert.equal(isCognitiveRequiredGrade('GRADE_4'), false);
  assert.equal(isCognitiveRequiredGrade(null), false);
});

test('1~4등급은 점검 대상이 아니고 결과는 elderlyId 오름차순', () => {
  assert.deepEqual(cov([P60([1])]), [[1, 'OK'], [2, 'NO_SESSION']]);
  assert.deepEqual(cov([], [C, { elderlyId: 9, careGrade: 'GRADE_4' }]), []);
});

function P60(ids: number[]): CognitiveProgramSession {
  return S('2026-10-14', 60, 'DEMENTIA_CAREGIVER', ids);
}

test('정확히 60분은 OK, 59분은 TOO_SHORT', () => {
  assert.deepEqual(cov([S('2026-10-14', 60, 'PROGRAM_MANAGER', [1])], [A]), [[1, 'OK']]);
  assert.deepEqual(cov([S('2026-10-14', 59, 'PROGRAM_MANAGER', [1])], [A]), [[1, 'TOO_SHORT']]);
  assert.deepEqual(cov([S('2026-10-14', 55, 'PROGRAM_MANAGER', [1, 2])]), [[1, 'TOO_SHORT'], [2, 'TOO_SHORT']]);
});

test('세 허용 제공자는 모두 OK, 기타·미기록은 PROVIDER_NOT_ALLOWED', () => {
  for (const kind of ['PROGRAM_MANAGER', 'DEMENTIA_CAREGIVER', 'EXTERNAL_INSTRUCTOR'] as const) {
    assert.deepEqual(cov([S('2026-10-14', 90, kind, [1])], [A]), [[1, 'OK']], kind);
  }
  assert.deepEqual(cov([S('2026-10-14', 60, 'OTHER', [1])], [A]), [[1, 'PROVIDER_NOT_ALLOWED']]);
  assert.deepEqual(cov([S('2026-10-14', 60, null, [1])], [A]), [[1, 'PROVIDER_NOT_ALLOWED']]);
});

test('다른 날 세션·참여자가 아닌 세션·인지활동형이 아닌 세션은 세지 않는다', () => {
  assert.deepEqual(cov([S('2026-10-14', 60, 'OTHER', [1]), S('2026-10-13', 90, 'EXTERNAL_INSTRUCTOR', [2])]), [[1, 'PROVIDER_NOT_ALLOWED'], [2, 'NO_SESSION']]);
  assert.deepEqual(cov([S('2026-10-14', 90, 'PROGRAM_MANAGER', [2], false), S('2026-10-14', null, 'PROGRAM_MANAGER', [1])]), [[1, 'TOO_SHORT'], [2, 'NO_SESSION']]);
  assert.deepEqual(cov([S('2026-10-14', 90, 'PROGRAM_MANAGER', [7])], [A]), [[1, 'NO_SESSION']]);
});

test('여러 세션 — 30분 허용 + 60분 기타는 제공자 문제, 60분 허용이 하나라도 있으면 OK, 30분 둘은 합산하지 않는다', () => {
  assert.deepEqual(cov([S('2026-10-14', 30, 'PROGRAM_MANAGER', [1]), S('2026-10-14', 60, null, [1])]), [[1, 'PROVIDER_NOT_ALLOWED'], [2, 'NO_SESSION']]);
  assert.deepEqual(cov([S('2026-10-14', 60, 'OTHER', [1]), S('2026-10-14', 60, 'PROGRAM_MANAGER', [1])], [A]), [[1, 'OK']]);
  assert.deepEqual(cov([S('2026-10-14', 30, 'PROGRAM_MANAGER', [1]), S('2026-10-14', 30, 'PROGRAM_MANAGER', [1])], [A]), [[1, 'TOO_SHORT']]);
});

test('출석자 중복은 한 번만 센다', () => {
  assert.deepEqual(cov([], [A, A]), [[1, 'NO_SESSION']]);
});

test('그날 참여한 인지활동형 세션 목록 — 화면의 제안(프로그램명)에 쓴다', () => {
  const list = [S('2026-10-14', 60, 'PROGRAM_MANAGER', [1]), S('2026-10-14', 30, 'OTHER', [2]), S('2026-10-14', 45, 'PROGRAM_MANAGER', [1], false), S('2026-10-13', 60, 'PROGRAM_MANAGER', [1])];
  assert.equal(cognitiveSessionsFor('2026-10-14', 1, list).length, 1);
  assert.equal(cognitiveSessionsFor('2026-10-14', 3, list).length, 0);
});

test('달 누락 목록 — OK가 아닌 것만 날짜·elderlyId 순, 1~4등급은 제외', () => {
  const gaps = monthCognitiveGaps({ '2026-10-14': [A, B], '2026-10-13': [A, B, C] }, [S('2026-10-14', 60, 'DEMENTIA_CAREGIVER', [1]), S('2026-10-13', 90, 'EXTERNAL_INSTRUCTOR', [2])]);
  assert.deepEqual(gaps.map((g) => [g.date, g.elderlyId, g.state]), [['2026-10-13', 1, 'NO_SESSION'], ['2026-10-14', 2, 'NO_SESSION']]);
});

test('달 누락 목록 — 해 넘김 순서와 잘못된 날짜 키·출석 없는 날 처리', () => {
  const gaps = monthCognitiveGaps({ '2027-01-02': [B], '2026-12-31': [A, B], '2026-12-32': [A], '2026-12-30': [] }, []);
  assert.deepEqual(gaps.map((g) => [g.date, g.elderlyId]), [['2026-12-31', 1], ['2026-12-31', 2], ['2027-01-02', 2]]);
  assert.deepEqual(monthCognitiveGaps({}, []), []);
});
