/**
 * 사례관리 회의 규칙 테스트 — `node --test src/lib/lab/caseMeetingRules.test.ts`
 * 왜: 참석 직종·30일 기한을 하루 잘못 세면 반기 충족 여부와 기한 알림이 어긋난다. 30일째·31일째 경계와 반기 경계가 핵심이다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { attendeeCheck, caseGroupOf, followUpAlerts, halfYearStatus, meetingRecordCheck, targetFollowUp, type CaseMeetingShape, type CaseStaffProfile } from './caseMeetingRules.ts';

const P = (memberId: number, jobType: string, hireDate = '2020-01-01'): CaseStaffProfile => ({ memberId, jobType, hireDate });
const pf = [P(1, 'DIRECTOR'), P(2, 'SOCIAL_WORKER'), P(3, 'NURSE_AIDE'), P(4, 'CAREGIVER'), P(5, 'CAREGIVER'), P(6, 'COOK'), P(7, 'DRIVER')];
const H = '2026-03-10';

type TargetIn = CaseMeetingShape['targets'][number];
const T = (o: Partial<TargetIn> = {}): TargetIn => ({
  elderlyId: 1, reason: '낙상 뒤 보행 불안', plan: '보행 보조 주 3회',
  reflectedOn: null, evaluatedOn: null, evaluatorName: null, resolved: null, nextAction: null, ...o,
});
const DONE_T = (o: Partial<TargetIn> = {}) => T({ reflectedOn: '2026-04-09', evaluatedOn: '2026-05-09', evaluatorName: '김사회', resolved: true, ...o });
const M = (id: number, heldOn: string, ids: number[], targets: TargetIn[]): CaseMeetingShape => ({
  id, heldOn, attendees: ids.map((memberId) => ({ memberId })), opinions: ids.map((memberId) => ({ memberId, opinion: '의견' })), targets,
});

test('직종 묶음: 간호조무사·치료사는 한 묶음, 조리원·운전원·사무원은 필수 아님', () => {
  assert.deepEqual(['DIRECTOR', 'SOCIAL_WORKER', 'NURSE', 'NURSE_AIDE', 'THERAPIST', 'CAREGIVER', 'COOK', 'DRIVER', 'OFFICE'].map(caseGroupOf),
    ['DIRECTOR', 'SOCIAL_WORKER', 'NURSING', 'NURSING', 'NURSING', 'CAREGIVER', null, null, null]);
});

test('참석자: 네 직종이 모두 오면 통과', () => {
  const r = attendeeCheck([1, 2, 3, 4], pf, H);
  assert.deepEqual([r.count, r.missing, r.unknown, r.ok], [4, [], 0, true]);
});

test('참석자: 시설장이 빠지면 항상 빠진 직종에 시설장', () => {
  assert.deepEqual(attendeeCheck([2, 3, 4], pf, H).missing, ['DIRECTOR']);
});

test('참석자: 정확히 3명이고 직종이 갖춰지면 통과, 2명이면 직종이 갖춰져도 통과 못 함', () => {
  const small = [P(1, 'DIRECTOR'), P(4, 'CAREGIVER')];
  assert.equal(attendeeCheck([1, 4], small, H).ok, false);
  assert.equal(attendeeCheck([1, 4], small, H).missing.length, 0);
  assert.equal(attendeeCheck([1, 3, 4], pf.filter((p) => p.memberId !== 2), H).ok, true);
});

test('참석자: 회의일에 아직 입사하지 않은 직원의 직종은 요구하지 않는다(입사일 당일부터 요구)', () => {
  const profiles = [P(1, 'DIRECTOR'), P(4, 'CAREGIVER'), P(8, 'THERAPIST', '2026-03-11'), P(9, 'SOCIAL_WORKER', '2026-03-10')];
  const r = attendeeCheck([1, 4, 9], profiles, H);
  assert.deepEqual(r.missing, []);
  assert.deepEqual(attendeeCheck([1, 4, 5], profiles, H).missing, ['SOCIAL_WORKER']);
});

test('참석자: 인사 기준이 없는 참석자는 unknown, 같은 직원이 두 번 들어와도 한 명', () => {
  const r = attendeeCheck([1, 2, 3, 4, 9, 9], pf, H);
  assert.deepEqual([r.count, r.unknown], [5, 1]);
});

test('회의 기록: 의견 칸이 없는 참석자·사유·계획이 빈 대상을 센다', () => {
  const r = meetingRecordCheck({
    attendees: [{ memberId: 1 }, { memberId: 2 }, { memberId: 3 }],
    opinions: [{ memberId: 1, opinion: 'a' }, { memberId: 2, opinion: null }],
    targets: [{ reason: '사유', plan: '계획' }, { reason: '  ', plan: '계획' }, { reason: '사유', plan: null as unknown as string }],
  });
  assert.deepEqual([r.opinionsMissing, r.targetsIncomplete, r.ok], [[3], 2, false]);
});

test('회의 기록: 의견 null은 의견 없음으로 기록된 것이라 빠진 게 아니다, 빈 글자만 있는 의견은 빠진 것', () => {
  const base = { attendees: [{ memberId: 1 }, { memberId: 2 }], targets: [{ reason: '사유', plan: '계획' }] };
  assert.equal(meetingRecordCheck({ ...base, opinions: [{ memberId: 1, opinion: null }, { memberId: 2, opinion: '의견' }] }).ok, true);
  assert.deepEqual(meetingRecordCheck({ ...base, opinions: [{ memberId: 1, opinion: ' ' }, { memberId: 2, opinion: '의견' }] }).opinionsMissing, [1]);
});

test('반영 기한 경계: 30일째는 DONE, 31일째는 LATE (3/10 → 4/9가 마지막 날)', () => {
  assert.equal(targetFollowUp(H, T({ reflectedOn: '2026-04-09' }), '2026-04-09').reflectState, 'DONE');
  assert.equal(targetFollowUp(H, T({ reflectedOn: '2026-04-10' }), '2026-04-10').reflectState, 'LATE');
  assert.equal(targetFollowUp(H, T(), '2026-04-09').reflectDue, '2026-04-09');
});

test('반영 기한: 회의 당일 반영은 DONE, 회의일보다 앞선 반영일은 인정하지 않고 미반영', () => {
  assert.equal(targetFollowUp(H, T({ reflectedOn: '2026-03-10' }), '2026-03-11').reflectState, 'DONE');
  assert.equal(targetFollowUp(H, T({ reflectedOn: '2026-03-09' }), '2026-03-11').reflectState, 'PENDING');
});

test('미반영: 기한 당일까지 PENDING, 다음 날부터 OVERDUE, 평가는 WAITING', () => {
  assert.deepEqual(pickStates(targetFollowUp(H, T(), '2026-04-09')), ['PENDING', 'WAITING', null]);
  assert.deepEqual(pickStates(targetFollowUp(H, T(), '2026-04-10')), ['OVERDUE', 'WAITING', null]);
});

function pickStates(f: ReturnType<typeof targetFollowUp>) {
  return [f.reflectState, f.evalState, f.evalDue];
}

test('평가 기한 경계: 반영일 + 30일째까지 PENDING, 31일째 OVERDUE', () => {
  const t = T({ reflectedOn: '2026-04-09' });
  assert.deepEqual(pickStates(targetFollowUp(H, t, '2026-05-09')), ['DONE', 'PENDING', '2026-05-09']);
  assert.equal(targetFollowUp(H, t, '2026-05-10').evalState, 'OVERDUE');
});

test('평가가 기한 다음 날이면 LATE, 기한 당일이면 DONE', () => {
  assert.equal(targetFollowUp(H, DONE_T({ evaluatedOn: '2026-05-09' }), '2026-06-01').evalState, 'DONE');
  assert.equal(targetFollowUp(H, DONE_T({ evaluatedOn: '2026-05-10' }), '2026-06-01').evalState, 'LATE');
});

test('평가 기록 불완전: 작성자 없음·해결 여부 없음·미해결인데 추가 조치 없음은 INCOMPLETE, 추가 조치가 있으면 DONE', () => {
  const asOf = '2026-06-01';
  assert.equal(targetFollowUp(H, DONE_T({ evaluatorName: ' ' }), asOf).evalState, 'INCOMPLETE');
  assert.equal(targetFollowUp(H, DONE_T({ resolved: null }), asOf).evalState, 'INCOMPLETE');
  assert.equal(targetFollowUp(H, DONE_T({ resolved: false }), asOf).evalState, 'INCOMPLETE');
  assert.equal(targetFollowUp(H, DONE_T({ resolved: false, nextAction: '다음 달 재평가' }), asOf).evalState, 'DONE');
});

test('기한 계산은 윤년·월말을 건넌다(2028-02-01 회의 → 3/2가 반영 기한)', () => {
  assert.equal(targetFollowUp('2028-02-01', T(), '2028-02-02').reflectDue, '2028-03-02');
  assert.equal(targetFollowUp('2026-12-15', T(), '2026-12-16').reflectDue, '2027-01-14');
});

test('반기 판정: 6/30 회의는 상반기, 7/1 회의는 하반기', () => {
  const june = M(1, '2026-06-30', [1, 2, 3, 4], [T()]);
  const july = M(2, '2026-07-01', [1, 2, 3, 4], [T()]);
  assert.equal(halfYearStatus([june, july], pf, 2026, 1, '2026-07-01').count, 1);
  assert.equal(halfYearStatus([june, july], pf, 2026, 2, '2026-07-01').count, 1);
  assert.equal(halfYearStatus([june], pf, 2026, 2, '2026-07-01').count, 0);
  assert.equal(halfYearStatus([M(3, '2026-12-31', [1, 2, 3, 4], [T()])], pf, 2026, 2, '2026-12-31').count, 1);
});

test('반기 판정: 직종을 못 갖춘 회의는 건수에는 들어가도 갖춘 회의가 아니다', () => {
  const bad = M(1, '2026-03-10', [1, 4, 5], [DONE_T()]);
  const r = halfYearStatus([bad], pf, 2026, 1, '2026-06-01');
  assert.deepEqual([r.count, r.okCount, r.c1, r.c2], [1, 0, false, 'NA']);
});

test('반기 판정 c2: 모두 DONE이면 MET, 진행 중이면 IN_PROGRESS, 하나라도 기한을 넘기면 NOT_MET', () => {
  const done = M(1, H, [1, 2, 3, 4], [DONE_T()]);
  assert.equal(halfYearStatus([done], pf, 2026, 1, '2026-06-01').c2, 'MET');
  const pending = M(2, '2026-06-20', [1, 2, 3, 4], [T({ elderlyId: 2 })]);
  assert.equal(halfYearStatus([done, pending], pf, 2026, 1, '2026-07-01').c2, 'IN_PROGRESS');
  assert.equal(halfYearStatus([done, pending], pf, 2026, 1, '2026-07-21').c2, 'NOT_MET');
});

test('반기 판정 c2: 갖춘 회의에 대상이 없으면 NA', () => {
  assert.equal(halfYearStatus([M(1, H, [1, 2, 3, 4], [])], pf, 2026, 1, '2026-06-01').c2, 'NA');
});

test('알림: 기한 5일 전부터(5일 남음 포함) 나오고 6일 남으면 나오지 않는다', () => {
  const m = M(40, '2026-10-01', [1, 2, 3, 4], [T({ elderlyId: 7 })]);
  assert.deepEqual(followUpAlerts([m], '2026-10-26').map((a) => [a.kind, a.dueOn, a.daysLeft]), [['REFLECT', '2026-10-31', 5]]);
  assert.deepEqual(followUpAlerts([m], '2026-10-25'), []);
});

test('알림: 기한 당일은 daysLeft 0, 지나면 음수로 계속 나온다', () => {
  const m = M(40, '2026-10-01', [1, 2, 3, 4], [T({ elderlyId: 7 })]);
  assert.equal(followUpAlerts([m], '2026-10-31')[0].daysLeft, 0);
  assert.equal(followUpAlerts([m], '2026-11-30')[0].daysLeft, -30);
});

test('알림: 반영·평가를 마친 대상은 나오지 않고, 평가 알림은 반영일 기준 기한 순으로 정렬된다', () => {
  const finished = M(1, '2026-03-10', [1, 2, 3, 4], [DONE_T()]);
  assert.deepEqual(followUpAlerts([finished], '2026-10-01'), []);
  const evalSoon = M(41, '2026-09-01', [1, 2, 3, 4], [T({ elderlyId: 8, reflectedOn: '2026-09-20' })]);
  const reflectSoon = M(40, '2026-10-01', [1, 2, 3, 4], [T({ elderlyId: 7 })]);
  assert.deepEqual(followUpAlerts([reflectSoon, evalSoon], '2026-10-26').map((a) => [a.meetingId, a.kind]), [[41, 'EVAL'], [40, 'REFLECT']]);
});

test('알림: leadDays를 바꿀 수 있다', () => {
  const m = M(40, '2026-10-01', [1, 2, 3, 4], [T({ elderlyId: 7 })]);
  assert.equal(followUpAlerts([m], '2026-10-21', 10).length, 1);
  assert.equal(followUpAlerts([m], '2026-10-20', 10).length, 0);
});
