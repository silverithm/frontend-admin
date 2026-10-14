/**
 * 봉사자 활동·자원연계 규칙 테스트 — `node --test src/lib/lab/communityRules.test.ts`
 * 왜: 봉사 시간 합계와 VMS 30일 기한은 확인서·실적 등록에 그대로 쓰인다. 하루 8시간 한도와 기한 경계가 한 칸 어긋나면 잘못된 시간이 인쇄된다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { RESOURCE_TYPES, VOLUNTEER_ACTIVITY_TYPES, resourceSummary, resourceTypeLabel, volunteerMinutes, volunteerSummary } from './communityRules.ts';

test('봉사 분 계산 — 정상·끝이 앞섬·같음·형식 오류·자정 근처', () => {
  assert.equal(volunteerMinutes('09:00', '11:30'), 150);
  assert.equal(volunteerMinutes('09:00', '09:01'), 1);
  assert.equal(volunteerMinutes('00:00', '23:59'), 1439);
  assert.equal(volunteerMinutes('11:00', '10:00'), null);
  assert.equal(volunteerMinutes('10:00', '10:00'), null);
  assert.equal(volunteerMinutes('9:00', '10:00'), null);
  assert.equal(volunteerMinutes('09:00', '24:00'), null);
  assert.equal(volunteerMinutes('09:60', '10:00'), null);
  assert.equal(volunteerMinutes('', ''), null);
});

test('목록 — 활동 종류 여섯, 연계 종류 여덟에 한글 이름', () => {
  assert.deepEqual(VOLUNTEER_ACTIVITY_TYPES.map((t) => t.value), ['MEAL', 'PROGRAM', 'COMPANION', 'CLEANING', 'TALENT', 'OTHER']);
  assert.deepEqual(RESOURCE_TYPES.map((t) => t.value), ['MEDICAL', 'HEALTH_CENTER', 'DEMENTIA_CENTER', 'WELFARE', 'COMMUNITY', 'GOODS', 'EDUCATION', 'OTHER']);
  assert.equal(resourceTypeLabel('DEMENTIA_CENTER'), '치매안심센터');
  assert.equal(resourceTypeLabel('X'), 'X');
});

const V = (activityDate: string, volunteerName: string, minutes: number, vmsRegistered: boolean) => ({ activityDate, volunteerName, minutes, vmsRegistered });

test('봉사 요약 — 이름 공백은 같은 사람, 그 해만, 시간은 소수 첫째 자리', () => {
  const s = volunteerSummary(
    [V('2026-03-02', '김봉사', 150, true), V('2026-04-02', ' 김봉사 ', 90, false), V('2025-12-30', '김봉사', 600, false), V('2026-04-09', '이봉사', 25, false)],
    2026,
    '2026-05-15',
  );
  assert.deepEqual(s.byVolunteer, [
    { volunteerName: '김봉사', count: 2, minutes: 240, hours: 4, certifiableMinutes: 240 },
    { volunteerName: '이봉사', count: 1, minutes: 25, hours: 0.4, certifiableMinutes: 25 },
  ]);
  assert.deepEqual(s.byMonth, { '2026-03': 150, '2026-04': 115 });
  assert.equal(s.totalMinutes, 265);
});

test('봉사 요약 — 한 사람 하루 합이 480분을 넘으면 인정 시간만 자른다(사람이 다르면 따로)', () => {
  const s = volunteerSummary(
    [V('2026-06-01', '이봉사', 600, false), V('2026-06-01', '이봉사', 60, false), V('2026-06-02', '이봉사', 60, false), V('2026-06-01', '박봉사', 400, false)],
    2026,
    '2026-06-30',
  );
  const lee = s.byVolunteer.find((v) => v.volunteerName === '이봉사')!;
  assert.deepEqual([lee.minutes, lee.hours, lee.certifiableMinutes], [720, 12, 540]);
  assert.equal(s.byVolunteer.find((v) => v.volunteerName === '박봉사')!.certifiableMinutes, 400);
  // 하루가 정확히 480분이면 그대로
  assert.equal(volunteerSummary([V('2026-06-01', '최봉사', 480, true)], 2026, '2026-06-30').byVolunteer[0].certifiableMinutes, 480);
});

test('VMS 기한 — 활동일 + 30일까지는 괜찮고 31일째부터 지남, 등록된 건은 세지 않는다', () => {
  const logs = [V('2026-04-01', 'a', 60, false), V('2026-04-02', 'b', 60, false), V('2026-03-01', 'c', 60, true)];
  // 4/1 + 30일 = 5/1
  assert.equal(volunteerSummary(logs, 2026, '2026-05-01').vmsOverdue, 0);
  assert.equal(volunteerSummary(logs, 2026, '2026-05-02').vmsOverdue, 1);
  assert.equal(volunteerSummary(logs, 2026, '2026-05-03').vmsOverdue, 2);
  assert.equal(volunteerSummary(logs, 2026, '2026-05-03').vmsPending, 2);
});

test('봉사 요약 — 일지가 없으면 비어 있고, 미래 활동은 기한이 지난 것이 아니다', () => {
  assert.deepEqual(volunteerSummary([], 2026, '2026-05-15'), { byVolunteer: [], byMonth: {}, totalMinutes: 0, vmsPending: 0, vmsOverdue: 0 });
  assert.equal(volunteerSummary([V('2026-12-01', 'a', 60, false)], 2026, '2026-05-15').vmsOverdue, 0);
});

test('봉사 요약 — 달을 가르는 하루 합과 비정상 분(0·음수·NaN)은 0분으로', () => {
  const s = volunteerSummary([V('2026-01-31', 'a', Number.NaN, false), V('2026-02-01', 'a', -5, false), V('2026-02-01', 'a', 90, false)], 2026, '2026-03-01');
  assert.equal(s.totalMinutes, 90);
  assert.equal(s.byVolunteer[0].count, 3);
});

const L = (over: Record<string, unknown>) => ({ elderlyId: 1, linkedOn: '2026-02-01', resourceType: 'MEDICAL', followUpOn: null, outcome: null, ...over }) as { elderlyId: number | null; linkedOn: string; resourceType: 'MEDICAL'; followUpOn: string | null; outcome: string | null };

test('자원연계 요약 — 그 해만, 종류별, 기관 전체 연계(null)는 어르신 수에서 뺀다', () => {
  const s = resourceSummary(
    [L({}), L({ elderlyId: 1, resourceType: 'WELFARE' }), L({ elderlyId: null, resourceType: 'GOODS' }), L({ elderlyId: 2 }), L({ elderlyId: 3, linkedOn: '2025-05-01' })],
    2026,
    '2026-10-15',
  );
  assert.equal(s.total, 4);
  assert.equal(s.eldersLinked, 2);
  assert.deepEqual([s.byType.MEDICAL, s.byType.WELFARE, s.byType.GOODS, s.byType.EDUCATION], [2, 1, 1, 0]);
});

test('후속 확인 — 예정일이 오늘 이전(오늘 포함)이고 결과가 비어 있는 것만, 예정일 순', () => {
  const s = resourceSummary(
    [
      L({ linkedOn: '2026-03-01', followUpOn: '2026-10-15' }),
      L({ linkedOn: '2026-02-01', followUpOn: '2026-10-10' }),
      L({ linkedOn: '2026-04-01', followUpOn: '2026-10-16' }),
      L({ linkedOn: '2026-05-01', followUpOn: '2026-10-01', outcome: '물품 받음' }),
      L({ linkedOn: '2026-06-01', followUpOn: '2026-10-01', outcome: '   ' }),
      L({ linkedOn: '2026-07-01', followUpOn: null }),
    ],
    2026,
    '2026-10-15',
  );
  assert.deepEqual(s.followUpsDue.map((l) => l.linkedOn), ['2026-06-01', '2026-02-01', '2026-03-01']);
});
