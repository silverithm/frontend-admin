/**
 * 보호자 월간 안내 규칙 테스트 — `node --test src/lib/lab/guardianNotice.test.ts`
 * 왜: 사실 묶음은 AI 초안의 유일한 근거다. 다른 어르신 기록이 섞이거나 이름·형식적 문구가 들어가면 안내문이 곧 오류·유출이 된다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { NAME_TOKEN, buildNoticeFacts, fillName, noticeCoverage, numbersNotInFacts, smsBytes, smsKind } from './guardianNotice.ts';

test('이름 채우기 — 모든 자리표시자를 바꾸고 없으면 그대로', () => {
  assert.equal(NAME_TOKEN, '[어르신]');
  assert.equal(fillName(`${NAME_TOKEN}께서 이번 달 ${NAME_TOKEN}`, '홍길동'), '홍길동께서 이번 달 홍길동');
  assert.equal(fillName('이름 자리가 없는 글', '홍길동'), '이름 자리가 없는 글');
  assert.equal(fillName(`${NAME_TOKEN}`, '$&'), '$&'); // 정규식 특수 치환이 아니다
});

test('문자 바이트 — 한글 2바이트, ASCII 1바이트(공백·줄바꿈 포함)', () => {
  assert.equal(smsBytes('안녕 abc'), 8);
  assert.equal(smsBytes(''), 0);
  assert.equal(smsBytes('a\nb'), 3);
  assert.equal(smsBytes('가나다'), 6);
});

test('문자 종류 — 90바이트까지 SMS, 2000바이트까지 LMS, 넘으면 너무 김', () => {
  assert.equal(smsKind(''), 'SMS');
  assert.equal(smsKind('가'.repeat(45)), 'SMS');
  assert.equal(smsKind('가'.repeat(44) + 'ab'), 'SMS'); // 정확히 90
  assert.equal(smsKind('가'.repeat(46)), 'LMS');
  assert.equal(smsKind('가'.repeat(1000)), 'LMS'); // 정확히 2000
  assert.equal(smsKind('가'.repeat(1001)), 'TOO_LONG');
});

const input = (over: Record<string, unknown> = {}) =>
  ({
    elderlyId: 7,
    month: '2026-10',
    attendanceDays: 18,
    careRecords: [
      { elderlyId: 7, recordDate: '2026-10-03', specialNote: '특이사항 없음' },
      { elderlyId: 7, recordDate: '2026-10-08', specialNote: '오후에 기침을 조금 하셨음' },
      { elderlyId: 8, recordDate: '2026-10-08', specialNote: '다른 어르신 기록' },
    ],
    nursingLogs: [
      { elderlyId: 7, logDate: '2026-10-20', systolic: 140, diastolic: 91, bloodSugar: 150, weight: 51.2 },
      { elderlyId: 7, logDate: '2026-10-02', systolic: 121, diastolic: 80, bloodSugar: 101, weight: 50.0 },
      { elderlyId: 7, logDate: '2026-10-10', systolic: 130, diastolic: 85, bloodSugar: null, weight: null },
      { elderlyId: 7, logDate: '2026-09-30', systolic: 200, diastolic: 120, bloodSugar: 400, weight: 40 },
      { elderlyId: 8, logDate: '2026-10-10', systolic: 200, diastolic: 120, bloodSugar: 400, weight: 90 },
    ],
    programs: [
      { programDate: '2026-10-05', category: 'COGNITIVE', participantIds: [7, 8] },
      { programDate: '2026-10-06', category: 'COGNITIVE', participantIds: [7] },
      { programDate: '2026-10-07', category: 'PHYSICAL', participantIds: [7] },
      { programDate: '2026-10-08', category: 'PHYSICAL', participantIds: [8] },
      { programDate: '2026-11-01', category: 'PHYSICAL', participantIds: [7] },
    ],
    rehabSessions: [
      { elderlyId: 7, sessionDate: '2026-10-02', kind: 'PHYSIO', minutes: 30 },
      { elderlyId: 7, sessionDate: '2026-10-09', kind: 'ADL', minutes: 20 },
      { elderlyId: 7, sessionDate: '2026-10-16', kind: 'PHYSIO', minutes: 10 },
      { elderlyId: 8, sessionDate: '2026-10-09', kind: 'PHYSIO', minutes: 99 },
    ],
    events: [
      { elderlyId: 7, occurredAt: '2026-10-10T10:20', kind: 'FALL', severity: 'MODERATE' },
      { elderlyId: 8, occurredAt: '2026-10-11T10:20', kind: 'INJURY', severity: 'LOW' },
    ],
    copayBill: { elderlyId: 7, billMonth: '2026-10', totalDue: 150000, status: 'UNPAID' },
    ...over,
  }) as never;

test('사실 묶음 — 혈압·혈당·체중은 반올림 정수(체중은 소수 첫째 자리), 그 어르신·그 달만', () => {
  const f = buildNoticeFacts(input());
  assert.equal(f.month, '2026-10');
  assert.equal(f.attendanceDays, 18);
  assert.deepEqual(f.vitals.bp, { avgSys: 130, avgDia: 85, count: 3 });
  assert.deepEqual(f.vitals.bloodSugar, { avg: 126, min: 101, max: 150, count: 2 });
  assert.deepEqual(f.vitals.weight, { first: 50, last: 51.2, change: 1.2 });
});

test('사실 묶음 — 측정이 없으면 null, 체중은 한 번만 쟀으면 변화를 말할 수 없어 null', () => {
  const f = buildNoticeFacts(input({ nursingLogs: [{ elderlyId: 7, logDate: '2026-10-02', systolic: null, diastolic: null, bloodSugar: null, weight: 50 }] }));
  assert.deepEqual(f.vitals, { bp: null, bloodSugar: null, weight: null });
  // 수축기만 있고 이완기가 없는 측정은 혈압으로 세지 않는다
  assert.equal(buildNoticeFacts(input({ nursingLogs: [{ elderlyId: 7, logDate: '2026-10-02', systolic: 130, diastolic: null, bloodSugar: null, weight: null }] })).vitals.bp, null);
});

test('사실 묶음 — 체중 변화는 부동소수 오차 없이 소수 첫째 자리', () => {
  const f = buildNoticeFacts(input({ nursingLogs: [{ elderlyId: 7, logDate: '2026-10-02', systolic: null, diastolic: null, bloodSugar: null, weight: 50.1 }, { elderlyId: 7, logDate: '2026-10-30', systolic: null, diastolic: null, bloodSugar: null, weight: 49.9 }] }));
  assert.deepEqual(f.vitals.weight, { first: 50.1, last: 49.9, change: -0.2 });
});

test('사실 묶음 — 프로그램은 참여한 것만, 훈련은 합계와 종류 이름, 사고는 날짜·종류·심각도만', () => {
  const f = buildNoticeFacts(input());
  assert.deepEqual(f.programs, { total: 3, byCategory: { COGNITIVE: 2, PHYSICAL: 1 } });
  assert.deepEqual(f.rehab, { sessions: 3, minutes: 60, kinds: ['일상생활동작 훈련', '물리치료'] });
  assert.deepEqual(f.events, [{ date: '2026-10-10', kindLabel: '낙상', severityLabel: '보통' }]);
});

test('사실 묶음 — 특이사항은 형식적 문구를 빼고 날짜순 최대 5개, 각 200자까지', () => {
  const notes = Array.from({ length: 8 }, (_, i) => ({ elderlyId: 7, recordDate: `2026-10-${String(i + 1).padStart(2, '0')}`, specialNote: `${i + 1}일 점심 식사량이 절반으로 줄었음` }));
  const f = buildNoticeFacts(input({ careRecords: [{ elderlyId: 7, recordDate: '2026-10-09', specialNote: '특이사항 없음' }, ...notes.reverse()] }));
  assert.equal(f.specialNotes.length, 5);
  assert.match(f.specialNotes[0], /^1일/);
  const long = buildNoticeFacts(input({ careRecords: [{ elderlyId: 7, recordDate: '2026-10-09', specialNote: '기침을 자주 하셨음 ' + '가'.repeat(300) }] }));
  assert.equal(Array.from(long.specialNotes[0]).length, 200);
  assert.deepEqual(buildNoticeFacts(input({ careRecords: [{ elderlyId: 7, recordDate: '2026-10-09', specialNote: '  ' }] })).specialNotes, []);
});

test('사실 묶음 — 본인부담금은 같은 어르신·같은 달 청구서만', () => {
  assert.deepEqual(buildNoticeFacts(input()).copay, { totalDue: 150000, status: 'UNPAID' });
  assert.equal(buildNoticeFacts(input({ copayBill: { elderlyId: 8, billMonth: '2026-10', totalDue: 1, status: 'PAID' } })).copay, null);
  assert.equal(buildNoticeFacts(input({ copayBill: { elderlyId: 7, billMonth: '2026-09', totalDue: 1, status: 'PAID' } })).copay, null);
  assert.equal(buildNoticeFacts(input({ copayBill: null })).copay, null);
});

test('사실 묶음 — 사람 이름이 들어가지 않는다(입력에 이름이 있어도 담지 않는다)', () => {
  const named = input({
    careRecords: [{ elderlyId: 7, elderlyName: '홍길동', recordDate: '2026-10-08', specialNote: '기침을 조금 하셨음' }],
    events: [{ elderlyId: 7, elderlyName: '홍길동', occurredAt: '2026-10-10T10:20', kind: 'FALL', severity: 'LOW', description: '홍길동 어르신이 넘어짐' }],
  });
  assert.doesNotMatch(JSON.stringify(buildNoticeFacts(named)), /홍길동|넘어짐/);
});

test('사실 묶음 — 기록이 하나도 없으면 빈 값들(지어낼 거리가 없다)', () => {
  const f = buildNoticeFacts({ elderlyId: 7, month: '2026-10', attendanceDays: 0, careRecords: [], nursingLogs: [], programs: [], rehabSessions: [], events: [], copayBill: null });
  assert.deepEqual(f, { month: '2026-10', attendanceDays: 0, vitals: { bp: null, bloodSugar: null, weight: null }, programs: { total: 0, byCategory: {} }, rehab: { sessions: 0, minutes: 0, kinds: [] }, events: [], specialNotes: [], copay: null });
});

test('안내에 쓴 숫자 점검 — 사실 묶음에 없는 숫자만 돌려준다', () => {
  const f = buildNoticeFacts(input());
  assert.deepEqual(numbersNotInFacts('10월에 18일 오셨고 혈압은 평균 130/85였습니다. 체중은 50kg에서 51.2kg으로 바뀌었습니다.', f), []);
  assert.deepEqual(numbersNotInFacts('이번 달 20일 출석, 혈당 평균 126, 본인부담금 150,000원, 혈압 170', f), ['20', '170']);
  assert.deepEqual(numbersNotInFacts(`${NAME_TOKEN}께서 잘 지내셨습니다.`, f), []);
});

test('발송 현황 — 보냄·초안·없음을 세고 없는 어르신 id를 순서대로', () => {
  const cov = noticeCoverage(
    [
      { elderlyId: 1, noticeMonth: '2026-10', status: 'SENT' },
      { elderlyId: 2, noticeMonth: '2026-10', status: 'DRAFT' },
      { elderlyId: 3, noticeMonth: '2026-09', status: 'SENT' },
    ],
    [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
    '2026-10',
  );
  assert.deepEqual(cov, { sent: 1, draft: 1, missing: 2, missingElderIds: [3, 4] });
});

test('발송 현황 — 같은 어르신 안내가 둘이면 보낸 쪽, 어르신이 없으면 전부 0', () => {
  const both = noticeCoverage([{ elderlyId: 1, noticeMonth: '2026-10', status: 'DRAFT' }, { elderlyId: 1, noticeMonth: '2026-10', status: 'SENT' }], [{ id: 1 }], '2026-10');
  assert.deepEqual([both.sent, both.draft, both.missing], [1, 0, 0]);
  assert.deepEqual(noticeCoverage([], [], '2026-10'), { sent: 0, draft: 0, missing: 0, missingElderIds: [] });
});
