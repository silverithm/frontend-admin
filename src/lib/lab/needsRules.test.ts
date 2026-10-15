/**
 * 욕구사정 규칙 테스트 — `node --test src/lib/lab/needsRules.test.ts`
 * 왜: 열 칸 완결·연 1회·신규 시점·30일 반영은 평가에서 날짜 하루로 갈리는 규칙이라 경계값(30일째·90일 창)을 고정한다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { CHANGE_GAP_LABEL, NEEDS_ITEMS, assessmentCoverage, changeRecordCheck, eventPlanReflection, needsComplete, type AssessmentContract, type AssessmentPlan } from './needsRules.ts';

const FULL = { physical: 'a', disease: 'b', cognition: 'c', communication: 'd', oral: 'e', nutrition: 'f', family: 'g', subjective: 'h', resources: 'i', summary: 'j', avoidFoods: '없음', other: '' };
const K = (elderlyId: number, contractStart: string, contractEnd: string | null = null, status: AssessmentContract['status'] = 'ACTIVE'): AssessmentContract => ({ elderlyId, contractStart, contractEnd, status });
const P = (elderlyId: number, assessedOn: string, needs: AssessmentPlan['needs'] = FULL): AssessmentPlan => ({ elderlyId, planYear: Number(assessedOn.slice(0, 4)), assessedOn, needs });

test('욕구사정 항목은 열 개, 정해진 순서', () => {
  assert.equal(NEEDS_ITEMS.length, 10);
  assert.equal(NEEDS_ITEMS[0].key, 'physical');
  assert.equal(NEEDS_ITEMS[9].key, 'summary');
});

test('needsComplete — 열 칸과 기피식품이 다 있으면 완결', () => {
  const r = needsComplete(FULL);
  assert.deepEqual([r.total, r.filled, r.missing, r.avoidFoodsRecorded, r.complete], [10, 10, [], true, true]);
});

test('needsComplete — 공백뿐인 칸은 빈 칸으로 센다(스페이스·탭·줄바꿈)', () => {
  const r = needsComplete({ ...FULL, oral: '   ', summary: '\n\t', disease: '' });
  assert.deepEqual(r.missing, ['disease', 'oral', 'summary']);
  assert.equal(r.filled, 7);
  assert.equal(r.complete, false);
});

test('needsComplete — 기피식품이 비면 열 칸이 다 차도 미완결, "없음"은 기록으로 센다', () => {
  assert.equal(needsComplete({ ...FULL, avoidFoods: '' }).complete, false);
  assert.equal(needsComplete({ ...FULL, avoidFoods: '  ' }).avoidFoodsRecorded, false);
  assert.equal(needsComplete({ ...FULL, avoidFoods: '없음' }).complete, true);
});

test('needsComplete — 옛 여섯 칸 기록은 새 다섯 칸이 빈 것으로 나온다', () => {
  const r = needsComplete({ physical: 'a', cognition: 'b', nutrition: 'c', communication: 'd', family: 'e', other: '' });
  assert.deepEqual(r.missing, ['disease', 'oral', 'subjective', 'resources', 'summary']);
  assert.equal(r.filled, 5);
  assert.equal(r.avoidFoodsRecorded, false);
});

test('needsComplete — null·undefined·글이 아닌 값도 터지지 않는다', () => {
  assert.equal(needsComplete(null).filled, 0);
  assert.equal(needsComplete(undefined).complete, false);
  assert.equal(needsComplete({ ...FULL, oral: 5 as unknown as string }).missing[0], 'oral');
});

test('other(기타 요구)는 완결 판정에 들어가지 않는다', () => {
  assert.equal(needsComplete({ ...FULL, other: '' }).complete, true);
});

test('assessmentCoverage — 진행 중이 아닌 계약(종료·시작 전·만료)은 대상이 아니다', () => {
  const r = assessmentCoverage([K(1, '2025-01-01', '2026-06-30', 'ENDED'), K(2, '2026-10-16'), K(3, '2024-01-01', '2026-10-14'), K(4, '2024-01-01')], [], 2026, '2026-10-15');
  assert.deepEqual(r.rows.map((x) => x.elderlyId), [4]);
});

test('assessmentCoverage — 계약 끝일이 asOf 당일이면 아직 진행 중', () => {
  assert.equal(assessmentCoverage([K(1, '2024-01-01', '2026-10-15')], [], 2026, '2026-10-15').total, 1);
});

test('assessmentCoverage — 시작일이 asOf 당일이면 대상', () => {
  assert.equal(assessmentCoverage([K(1, '2026-10-15')], [], 2026, '2026-10-15').total, 1);
});

test('assessmentCoverage — 같은 어르신 계약이 둘이면 한 명으로 세고 가장 늦은 시작일로 신규를 가른다', () => {
  const r = assessmentCoverage([K(1, '2020-01-01', '2026-02-28'), K(1, '2026-04-01')], [], 2026, '2026-10-15');
  assert.equal(r.total, 1);
  assert.equal(r.rows[0].isNew, true);
});

test('assessmentCoverage — 신규 사정은 시작일 전 90일째까지만 인정(89·90일 전 인정, 91일 전은 아님)', () => {
  const start = '2026-06-01';
  const ok90 = assessmentCoverage([K(1, start)], [P(1, '2026-03-03')], 2026, '2026-10-15');
  assert.equal(ok90.rows[0].newOk, true);
  const late91 = assessmentCoverage([K(1, start)], [P(1, '2026-03-02')], 2026, '2026-10-15');
  assert.equal(late91.rows[0].newOk, false);
});

test('assessmentCoverage — 신규 사정이 시작일 당일이면 인정, 다음 날이면 불인정', () => {
  assert.equal(assessmentCoverage([K(1, '2026-06-01')], [P(1, '2026-06-01')], 2026, '2026-10-15').rows[0].newOk, true);
  assert.equal(assessmentCoverage([K(1, '2026-06-01')], [P(1, '2026-06-02')], 2026, '2026-10-15').rows[0].newOk, false);
});

test('assessmentCoverage — 신규 사정은 작년 것이어도 90일 창 안이면 인정한다(연 1회는 별개)', () => {
  const r = assessmentCoverage([K(1, '2026-01-10')], [P(1, '2025-12-20')], 2026, '2026-10-15');
  assert.equal(r.rows[0].newOk, true);
  assert.equal(r.rows[0].annual, false);
  assert.equal(r.rows[0].ok, false);
});

test('assessmentCoverage — 신규가 아니면 newOk는 true', () => {
  const r = assessmentCoverage([K(1, '2024-01-01')], [], 2026, '2026-10-15');
  assert.deepEqual([r.rows[0].isNew, r.rows[0].newOk, r.newTotal, r.newOk], [false, true, 0, 0]);
});

test('assessmentCoverage — 완결 판정은 그 해 가장 늦은 사정으로(앞선 완결본이 있어도 늦은 미완결본이 이긴다)', () => {
  const r = assessmentCoverage([K(1, '2024-01-01')], [P(1, '2026-02-01'), P(1, '2026-09-01', { ...FULL, oral: '' })], 2026, '2026-10-15');
  assert.equal(r.rows[0].complete, false);
  assert.equal(r.rows[0].annual, true);
  const r2 = assessmentCoverage([K(1, '2024-01-01')], [P(1, '2026-02-01', { ...FULL, oral: '' }), P(1, '2026-09-01')], 2026, '2026-10-15');
  assert.equal(r2.rows[0].complete, true);
});

test('assessmentCoverage — 작년 사정만 있으면 연 1회 미충족', () => {
  const r = assessmentCoverage([K(1, '2024-01-01')], [P(1, '2025-12-31')], 2026, '2026-10-15');
  assert.deepEqual([r.rows[0].annual, r.rows[0].complete, r.ok], [false, false, 0]);
});

test('assessmentCoverage — 12-31·1-1 해 경계', () => {
  const r = assessmentCoverage([K(1, '2024-01-01')], [P(1, '2026-01-01')], 2026, '2026-10-15');
  assert.equal(r.rows[0].annual, true);
});

test('assessmentCoverage — 날짜가 올바르지 않은 사정은 무시한다', () => {
  const r = assessmentCoverage([K(1, '2024-01-01')], [P(1, '2026-02-30')], 2026, '2026-10-15');
  assert.equal(r.rows[0].annual, false);
});

test('assessmentCoverage — 계약이 없으면 모두 0', () => {
  const r = assessmentCoverage([], [P(1, '2026-01-01')], 2026, '2026-10-15');
  assert.deepEqual([r.total, r.annual, r.newTotal, r.newOk, r.complete, r.ok, r.rows], [0, 0, 0, 0, 0, 0, []]);
});

const EV = (id: number, elderlyId: number, kind: string, severity: string, occurredAt: string, followUp: string | null = null) => ({ id, elderlyId, kind, severity, occurredAt, followUp }) as Parameters<typeof eventPlanReflection>[0][number];
const CH = (elderlyId: number, changedOn: string, eventId: number | null = null) => ({ elderlyId, changedOn, eventId });

test('eventPlanReflection — 대상 사건은 종류·정도로 거른다', () => {
  const r = eventPlanReflection([EV(1, 1, 'FALL', 'LOW', '2026-09-01T10:00'), EV(2, 1, 'MEDICATION', 'HIGH', '2026-09-01T10:00'), EV(3, 1, 'BEHAVIOR', 'CRITICAL', '2026-09-01T10:00'), EV(4, 1, 'OTHER', 'HIGH', '2026-09-01T10:00'), EV(5, 1, 'EMERGENCY', 'MODERATE', '2026-09-01T10:00')], [], '2026-09-02');
  assert.deepEqual(r.rows.map((x) => x.eventId), [5]);
});

test('eventPlanReflection — 변경일이 사건일 당일·30일째(기한 당일)면 반영, 31일째면 아님', () => {
  const e = EV(1, 1, 'FALL', 'HIGH', '2026-09-01T23:30');
  assert.equal(eventPlanReflection([e], [CH(1, '2026-09-01')], '2026-12-01').rows[0].state, 'PLAN_CHANGE');
  assert.equal(eventPlanReflection([e], [CH(1, '2026-10-01')], '2026-12-01').rows[0].state, 'PLAN_CHANGE');
  assert.equal(eventPlanReflection([e], [CH(1, '2026-10-02')], '2026-12-01').rows[0].state, 'NONE');
  assert.equal(eventPlanReflection([e], [CH(1, '2026-08-31')], '2026-12-01').rows[0].state, 'NONE');
});

test('eventPlanReflection — 기한은 사건일 + 30일(월말·윤년 넘김)', () => {
  assert.equal(eventPlanReflection([EV(1, 1, 'FALL', 'HIGH', '2028-02-10T08:00')], [], '2028-02-10').rows[0].due, '2028-03-11');
  assert.equal(eventPlanReflection([EV(1, 1, 'FALL', 'HIGH', '2026-12-15T08:00')], [], '2026-12-15').rows[0].due, '2027-01-14');
});

test('eventPlanReflection — asOf가 기한 당일이면 PENDING, 다음 날이면 NONE', () => {
  const e = EV(1, 1, 'INJURY', 'HIGH', '2026-09-01T08:00');
  assert.equal(eventPlanReflection([e], [], '2026-10-01').rows[0].state, 'PENDING');
  assert.equal(eventPlanReflection([e], [], '2026-10-02').rows[0].state, 'NONE');
});

test('eventPlanReflection — 사건에 직접 묶인 변경은 날짜가 달라도 반영, 다른 어르신 변경은 아님', () => {
  const e = EV(7, 1, 'HOSPITAL', 'CRITICAL', '2026-01-05T08:00');
  assert.equal(eventPlanReflection([e], [CH(1, '2026-06-01', 7)], '2026-12-01').rows[0].state, 'PLAN_CHANGE');
  assert.equal(eventPlanReflection([e], [CH(2, '2026-01-06')], '2026-12-01').rows[0].state, 'NONE');
});

test('eventPlanReflection — 후속 조치 글만 있으면 FOLLOW_UP, 공백뿐이면 없는 것으로', () => {
  assert.equal(eventPlanReflection([EV(1, 1, 'FALL', 'HIGH', '2026-01-05T08:00', '보행 보조 강화')], [], '2026-12-01').rows[0].state, 'FOLLOW_UP');
  assert.equal(eventPlanReflection([EV(1, 1, 'FALL', 'HIGH', '2026-01-05T08:00', '   ')], [], '2026-12-01').rows[0].state, 'NONE');
});

test('eventPlanReflection — 변경 이력이 후속 조치 글보다 우선', () => {
  assert.equal(eventPlanReflection([EV(1, 1, 'FALL', 'HIGH', '2026-09-01T08:00', '조치')], [CH(1, '2026-09-05')], '2026-09-06').rows[0].state, 'PLAN_CHANGE');
});

test('eventPlanReflection — 기한 순(같으면 사건 번호순)으로 정렬하고 합계를 센다', () => {
  const r = eventPlanReflection([EV(9, 1, 'FALL', 'HIGH', '2026-09-01T08:00'), EV(3, 2, 'FALL', 'HIGH', '2026-09-01T08:00'), EV(5, 3, 'FALL', 'HIGH', '2026-08-01T08:00')], [], '2026-09-10');
  assert.deepEqual(r.rows.map((x) => x.eventId), [5, 3, 9]);
  assert.deepEqual([r.total, r.pending, r.none, r.planChange, r.followUpOnly], [3, 2, 1, 0, 0]);
});

test('eventPlanReflection — 날짜가 올바르지 않은 사건은 건너뛴다', () => {
  assert.equal(eventPlanReflection([EV(1, 1, 'FALL', 'HIGH', '')], [], '2026-09-10').total, 0);
  assert.equal(eventPlanReflection([EV(1, 1, 'FALL', 'HIGH', '2026-13-01T08:00')], [], '2026-09-10').total, 0);
});

test('changeRecordCheck — 빠진 칸을 REASON·ITEMS·GUARDIAN·NOTIFIED 순서로', () => {
  const base = { reasonNote: '사유', changeItems: ['CONTENT' as const], guardianSignedOn: '2026-09-02', notifiedOn: '2026-09-03' };
  assert.deepEqual(changeRecordCheck(base), []);
  assert.deepEqual(changeRecordCheck({ ...base, reasonNote: '  ', changeItems: [], guardianSignedOn: null, notifiedOn: null }), ['REASON', 'ITEMS', 'GUARDIAN', 'NOTIFIED']);
  assert.deepEqual(changeRecordCheck({ ...base, notifiedOn: null }), ['NOTIFIED']);
  assert.deepEqual(changeRecordCheck({ ...base, guardianSignedOn: '2026-02-30' }), ['GUARDIAN']);
  assert.equal(CHANGE_GAP_LABEL.GUARDIAN, '보호자 확인서명');
});
