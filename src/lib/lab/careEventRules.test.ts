/**
 * 상태변화·사고 규칙 테스트 — `node --test src/lib/lab/careEventRules.test.ts`
 * 왜: 보호자 연락 누락·닫기 조건·주 1회 기록 빈칸 판정이 어긋나면 평가 전에 거짓 안심을 준다. 서버 닫기 규칙과 문구가 같아야 한다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EVENT_KINDS,
  EVENT_SEVERITIES,
  canClose,
  conditionWeeklyGaps,
  eventChecklist,
  eventStats,
  fallsNeedingReassessment,
  mondayOf,
  requiresGuardianNotice,
  weeksOverlapping,
} from './careEventRules.ts';

const fall = { occurredAt: '2026-10-10T10:20', kind: 'FALL', severity: 'MODERATE', immediateAction: '활력징후 확인', guardianNotifiedAt: null, guardianMethod: null, followUp: null, prevention: null } as const;

test('종류·심각도 목록 — 계약의 값이 모두 있고 한글 이름이 있다', () => {
  assert.deepEqual(EVENT_KINDS.map((k) => k.value), ['CONDITION_CHANGE', 'FALL', 'INJURY', 'EMERGENCY', 'HOSPITAL', 'MEDICATION', 'BEHAVIOR', 'OTHER']);
  assert.deepEqual(EVENT_SEVERITIES.map((s) => s.value), ['LOW', 'MODERATE', 'HIGH', 'CRITICAL']);
  for (const x of [...EVENT_KINDS, ...EVENT_SEVERITIES]) assert.match(x.label, /[가-힣]/);
});

test('보호자 연락 필요 — 낙상·부상·응급·병원·투약은 항상, 그 밖은 심각 이상일 때만', () => {
  for (const kind of ['FALL', 'INJURY', 'EMERGENCY', 'HOSPITAL', 'MEDICATION']) assert.equal(requiresGuardianNotice(kind, 'LOW'), true, kind);
  for (const kind of ['CONDITION_CHANGE', 'BEHAVIOR', 'OTHER']) {
    assert.equal(requiresGuardianNotice(kind, 'LOW'), false, kind);
    assert.equal(requiresGuardianNotice(kind, 'MODERATE'), false, kind);
    assert.equal(requiresGuardianNotice(kind, 'HIGH'), true, kind);
    assert.equal(requiresGuardianNotice(kind, 'CRITICAL'), true, kind);
  }
});

test('체크리스트 — 낙상: 연락·후속·예방이 없고 재평가가 이전이면 모두 미완료, 순서가 고정이다', () => {
  const list = eventChecklist(fall, { latestMorseOn: '2026-10-01' });
  assert.deepEqual(list.map((c) => [c.code, c.ok]), [['ACTION', true], ['GUARDIAN', false], ['FOLLOW_UP', false], ['PREVENTION', false], ['RISK_REASSESS', false]]);
  for (const c of list) assert.ok(c.message.length > 4);
});

test('체크리스트 — 낙상 재평가: 같은 날은 ok, 사고 전이거나 없거나 형식 오류면 미완료', () => {
  const ok = (latestMorseOn: string | null | undefined) => eventChecklist(fall, { latestMorseOn }).find((c) => c.code === 'RISK_REASSESS')!.ok;
  assert.equal(ok('2026-10-10'), true);
  assert.equal(ok('2026-10-11'), true);
  assert.equal(ok('2026-10-09'), false);
  assert.equal(ok(null), false);
  assert.equal(ok(undefined), false);
  assert.equal(ok('엉터리'), false);
});

test('체크리스트 — 상태변화·경미는 보호자·예방·재평가 항목이 없다', () => {
  const codes = eventChecklist({ ...fall, kind: 'CONDITION_CHANGE', severity: 'LOW', immediateAction: '' }, { latestMorseOn: null }).map((c) => c.code);
  assert.deepEqual(codes, ['ACTION', 'FOLLOW_UP']);
});

test('체크리스트 — 상태변화여도 심각이면 보호자 항목이 생기고, 부상은 예방은 있지만 재평가는 없다', () => {
  assert.ok(eventChecklist({ ...fall, kind: 'CONDITION_CHANGE', severity: 'HIGH' }).some((c) => c.code === 'GUARDIAN'));
  const injury = eventChecklist({ ...fall, kind: 'INJURY' }).map((c) => c.code);
  assert.ok(injury.includes('PREVENTION'));
  assert.ok(!injury.includes('RISK_REASSESS'));
});

test('체크리스트 — 공백만 적은 즉시 조치는 비어 있는 것이다', () => {
  assert.equal(eventChecklist({ ...fall, immediateAction: '   ' }).find((c) => c.code === 'ACTION')!.ok, false);
});

test('체크리스트 — 보호자 연락이 있으면 같은 날인지 따로 본다(대조 필요 문구)', () => {
  const next = eventChecklist({ ...fall, guardianNotifiedAt: '2026-10-11T09:00', guardianMethod: 'PHONE' });
  assert.equal(next.find((c) => c.code === 'GUARDIAN')!.ok, true);
  const sameDayItem = next.find((c) => c.code === 'GUARDIAN_SAME_DAY')!;
  assert.equal(sameDayItem.ok, false);
  assert.match(sameDayItem.message, /대조 필요/);
  assert.equal(eventChecklist({ ...fall, guardianNotifiedAt: '2026-10-10T23:59', guardianMethod: 'SMS' }).find((c) => c.code === 'GUARDIAN_SAME_DAY')!.ok, true);
  // 연락이 없으면 이 항목을 넣지 않는다
  assert.ok(!eventChecklist(fall).some((c) => c.code === 'GUARDIAN_SAME_DAY'));
});

test('닫기 — 후속이 없으면 불가, 연락이 필요한 사고는 연락도 있어야 하며 이유 문구는 서버와 같다', () => {
  assert.deepEqual(canClose({ ...fall, followUp: '' }).reasons, ['후속 조치를 적어야 닫을 수 있습니다', '보호자 연락을 기록해야 닫을 수 있습니다']);
  assert.deepEqual(canClose({ ...fall, followUp: '보호자 병원 동행' }), { ok: false, reasons: ['보호자 연락을 기록해야 닫을 수 있습니다'] });
  assert.deepEqual(canClose({ ...fall, followUp: '보호자 병원 동행', guardianNotifiedAt: '2026-10-10T11:00', guardianMethod: 'PHONE' }), { ok: true, reasons: [] });
  assert.deepEqual(canClose({ ...fall, kind: 'CONDITION_CHANGE', severity: 'LOW', followUp: '경과 관찰' }), { ok: true, reasons: [] });
  assert.equal(canClose({ ...fall, kind: 'CONDITION_CHANGE', severity: 'LOW', followUp: '  ' }).ok, false);
});

test('월 통계 — 그 달 사고만 세고 연락률은 소수 첫째 자리까지', () => {
  const base = { ...fall, status: 'OPEN' } as const;
  const st = eventStats(
    [
      { ...base, status: 'CLOSED', guardianNotifiedAt: '2026-10-10T11:00' },
      { ...base, occurredAt: '2026-10-05T14:00', kind: 'INJURY' },
      { ...base, occurredAt: '2026-10-07T09:00', kind: 'CONDITION_CHANGE', severity: 'LOW' },
      { ...base, occurredAt: '2026-09-28T10:00' },
      { ...base, occurredAt: '2026-10-31T23:59', kind: 'EMERGENCY', guardianNotifiedAt: '2026-11-01T00:10' },
    ],
    '2026-10',
  );
  assert.equal(st.total, 4);
  assert.equal(st.open, 3);
  assert.equal(st.byKind.FALL, 1);
  assert.equal(st.byKind.INJURY, 1);
  assert.equal(st.byKind.EMERGENCY, 1);
  assert.equal(st.byKind.MEDICATION, 0);
  assert.deepEqual([st.guardianRequired, st.guardianNotified, st.notifyRate], [3, 2, 66.7]);
});

test('월 통계 — 연락이 필요한 사고가 없으면 연락률은 null, 사고가 없으면 모두 0', () => {
  assert.equal(eventStats([{ ...fall, kind: 'BEHAVIOR', severity: 'LOW', status: 'OPEN' }], '2026-10').notifyRate, null);
  const empty = eventStats([], '2026-10');
  assert.deepEqual([empty.total, empty.open, empty.guardianRequired, empty.notifyRate], [0, 0, 0, null]);
});

test('주 계산 — 월요일 찾기와 달과 겹치는 주', () => {
  assert.equal(mondayOf('2026-10-04'), '2026-09-28'); // 일요일은 앞 주
  assert.equal(mondayOf('2026-10-05'), '2026-10-05');
  assert.equal(mondayOf('2026-01-01'), '2025-12-29'); // 해를 넘는 주
  assert.deepEqual(weeksOverlapping('2026-10'), ['2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26']);
  assert.deepEqual(weeksOverlapping('2026-02'), ['2026-01-26', '2026-02-02', '2026-02-09', '2026-02-16', '2026-02-23']);
  assert.deepEqual(weeksOverlapping('엉터리'), []);
});

test('상태변화 주 1회 — 형식적 문구·빈칸·그 달 밖 기록은 채운 것으로 치지 않는다', () => {
  const gaps = conditionWeeklyGaps({
    elderIds: [1],
    month: '2026-10',
    careRecords: [
      { elderlyId: 1, recordDate: '2026-10-01', specialNote: '오전에 어지럼을 호소하셔서 30분 쉬게 함' },
      { elderlyId: 1, recordDate: '2026-10-06', specialNote: '특이사항 없음' },
      { elderlyId: 1, recordDate: '2026-10-13', specialNote: '' },
      { elderlyId: 1, recordDate: '2026-10-20', specialNote: '점심 식사량이 평소의 절반으로 줄었음' },
      { elderlyId: 1, recordDate: '2026-11-02', specialNote: '11월 기록은 그 달 밖' },
    ],
    events: [],
    attendance: { 1: ['2026-10-01', '2026-10-06', '2026-10-13', '2026-10-20', '2026-10-27'] },
  });
  assert.deepEqual(gaps, [{ elderlyId: 1, missingWeeks: ['2026-10-05', '2026-10-12', '2026-10-26'] }]);
});

test('상태변화 주 1회 — 사고·상태변화 기록이 있으면 그 주는 채운 것, 어르신은 id 오름차순', () => {
  const gaps = conditionWeeklyGaps({
    elderIds: [3, 2],
    month: '2026-10',
    careRecords: [],
    events: [{ elderlyId: 2, occurredAt: '2026-10-14T10:00' }],
    attendance: { 2: ['2026-10-14', '2026-10-21'], 3: ['2026-10-07'] },
  });
  assert.deepEqual(gaps, [{ elderlyId: 2, missingWeeks: ['2026-10-19'] }, { elderlyId: 3, missingWeeks: ['2026-10-05'] }]);
});

test('상태변화 주 1회 — 출석 맵이 있으면 맵에 없는 어르신과 그 달 밖 출석은 따지지 않고, 맵이 없으면 겹친 모든 주', () => {
  const noRecords = { careRecords: [], events: [] };
  assert.deepEqual(conditionWeeklyGaps({ elderIds: [1], month: '2026-10', ...noRecords, attendance: {} }), []);
  assert.deepEqual(conditionWeeklyGaps({ elderIds: [1], month: '2026-10', ...noRecords, attendance: { 1: ['2026-09-30', '2026-11-03'] } }), []);
  assert.equal(conditionWeeklyGaps({ elderIds: [1], month: '2026-10', ...noRecords })[0].missingWeeks.length, 5);
  assert.deepEqual(conditionWeeklyGaps({ elderIds: [], month: '2026-10', ...noRecords }), []);
});

test('상태변화 주 1회 — 달의 첫 주가 전 달에서 이어지면 그 달 안 날짜의 기록만 센다', () => {
  // 2026-10-01(목)이 속한 주의 월요일은 9/28. 9/29 기록은 10월 밖이라 그 주를 채우지 못한다.
  const gaps = conditionWeeklyGaps({
    elderIds: [1],
    month: '2026-10',
    careRecords: [{ elderlyId: 1, recordDate: '2026-09-29', specialNote: '기침을 자주 하셨음' }],
    events: [],
    attendance: { 1: ['2026-10-01'] },
  });
  assert.deepEqual(gaps, [{ elderlyId: 1, missingWeeks: ['2026-09-28'] }]);
});

test('낙상 후 재평가 — 가장 최근 낙상 기준, 같은 날 평가는 통과, 평가 없음·목록에 없음은 대상', () => {
  const ev = (elderlyId: number, occurredAt: string, kind: 'FALL' | 'INJURY' = 'FALL') => ({ elderlyId, occurredAt, kind });
  const morse = (elderlyId: number, assessedOn: string | null) => ({ elderlyId, morse: assessedOn ? { assessedOn } : null });
  const list = fallsNeedingReassessment(
    [ev(5, '2026-10-10T10:00'), ev(2, '2026-10-05T10:00'), ev(2, '2026-10-12T10:00'), ev(3, '2026-10-10T10:00', 'INJURY'), ev(4, '2026-10-10T10:00'), ev(6, '2026-10-10T08:00')],
    [morse(5, '2026-10-10'), morse(2, '2026-10-08'), morse(3, null), morse(4, null)],
  );
  assert.deepEqual(list, [2, 4, 6]);
  assert.deepEqual(fallsNeedingReassessment([], []), []);
});
