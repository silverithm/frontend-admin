/**
 * 퇴소 연계기록지 규칙 테스트 — `node --test src/lib/lab/dischargeRules.test.ts`
 * 왜: 평가는 "계약 종료일까지 작성·제공"을 보므로 퇴소일 당일·하루 뒤가 갈린다. 사실 묶음은 이름이 없어야 AI로 보낼 수 있다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDischargeFacts, dischargeReasonLabel, hasProvidedLedger, ledgerPartlyFilled, providedMethodLabel, referralCompliance, referralRequired, referralSummary } from './dischargeRules.ts';

const ref = {
  writtenOn: '2026-09-28',
  dischargeOn: '2026-09-30',
  careGrade: '3' as const,
  functionalStatus: '보행기로 실내 이동',
  servicesProvided: '주야간보호(신체·인지)',
  afterPlan: '방문요양 희망',
  providedOn: '2026-09-30' as string | null,
  providedMethod: 'VISIT' as 'VISIT' | null,
  providerName: '최복지' as string | null,
  recipientName: '딸' as string | null,
};
const none = { providedOn: null, providedMethod: null, providerName: null, recipientName: null };
const ok = (r: Parameters<typeof referralCompliance>[0]) => Object.fromEntries(referralCompliance(r).map((c) => [c.code, c.ok]));

test('referralRequired — 전원·입원 후 퇴소·본인 희망·그 밖은 작성, 사망·알 수 없는 값은 아님', () => {
  assert.deepEqual(['TRANSFER', 'HOSPITAL', 'SELF', 'OTHER', 'DEATH', '', 'x'].map(referralRequired), [true, true, true, true, false, false, false]);
});

test('referralCompliance — 모두 갖추면 네 칸 모두 통과, 항목 순서 고정', () => {
  assert.deepEqual(referralCompliance(ref).map((c) => c.code), ['FIELDS', 'WRITTEN_BY_DISCHARGE', 'PROVIDED', 'PROVIDED_BY_DISCHARGE']);
  assert.deepEqual(ok(ref), { FIELDS: true, WRITTEN_BY_DISCHARGE: true, PROVIDED: true, PROVIDED_BY_DISCHARGE: true });
});

test('referralCompliance — 작성일·제공일이 퇴소일 당일이면 통과, 하루 늦으면 실패(예외 인정 안내)', () => {
  assert.deepEqual(ok({ ...ref, writtenOn: '2026-09-30' }).WRITTEN_BY_DISCHARGE, true);
  const late = referralCompliance({ ...ref, writtenOn: '2026-10-01', providedOn: '2026-10-01' });
  assert.equal(late[1].ok, false);
  assert.match(late[1].message, /상담기록지/);
  assert.equal(late[3].ok, false);
  assert.match(late[3].message, /상담기록지/);
  assert.equal(late[2].ok, true); // 제공대장 네 칸은 갖췄다
});

test('referralCompliance — 제공 기록이 없으면 PROVIDED·PROVIDED_BY_DISCHARGE 모두 실패, 네 칸 중 일부만이어도 실패', () => {
  assert.deepEqual(ok({ ...ref, ...none }), { FIELDS: true, WRITTEN_BY_DISCHARGE: true, PROVIDED: false, PROVIDED_BY_DISCHARGE: false });
  assert.equal(ok({ ...ref, recipientName: null }).PROVIDED, false);
  assert.equal(ok({ ...ref, recipientName: '  ' }).PROVIDED, false);
  assert.equal(ok({ ...ref, providerName: null }).PROVIDED_BY_DISCHARGE, false);
});

test('referralCompliance — 빈 칸 이름을 알려 준다', () => {
  const fields = referralCompliance({ ...ref, functionalStatus: ' ', afterPlan: '' })[0];
  assert.equal(fields.ok, false);
  assert.match(fields.message, /심신기능 상태/);
  assert.match(fields.message, /퇴소 후 서비스 이용계획/);
  assert.doesNotMatch(fields.message, /제공한 급여/);
  assert.equal(ok({ ...ref, writtenOn: '' }).FIELDS, false);
});

test('제공대장 칸 도우미', () => {
  assert.equal(hasProvidedLedger(ref), true);
  assert.equal(hasProvidedLedger({ ...ref, ...none }), false);
  assert.equal(ledgerPartlyFilled(ref), false);
  assert.equal(ledgerPartlyFilled({ ...ref, ...none }), false);
  assert.equal(ledgerPartlyFilled({ ...ref, providerName: null }), true);
});

test('referralSummary — 그 해 퇴소만 세고, 제공·기한 내 제공을 나눈다(계약 예)', () => {
  const rs = referralSummary([ref, { ...ref, dischargeOn: '2026-08-31', providedOn: '2026-09-03' }, { ...ref, dischargeOn: '2026-07-31', ...none }, { ...ref, dischargeOn: '2025-12-31' }], 2026);
  assert.deepEqual(rs, { total: 3, provided: 2, onTime: 1 });
});

test('referralSummary — 연말·연초 경계와 퇴소자 없음', () => {
  const r = [{ ...ref, dischargeOn: '2026-12-31', providedOn: '2026-12-31' }, { ...ref, dischargeOn: '2027-01-01', providedOn: '2027-01-01' }];
  assert.deepEqual(referralSummary(r, 2026), { total: 1, provided: 1, onTime: 1 });
  assert.deepEqual(referralSummary(r, 2028), { total: 0, provided: 0, onTime: 0 });
  assert.deepEqual(referralSummary([], 2026), { total: 0, provided: 0, onTime: 0 });
  assert.deepEqual(referralSummary([{ ...ref, dischargeOn: 'bad' }], 2026), { total: 0, provided: 0, onTime: 0 });
});

test('라벨', () => {
  assert.match(dischargeReasonLabel('TRANSFER'), /전원/);
  assert.equal(providedMethodLabel('FAX'), '모사전송(팩스)');
  assert.equal(providedMethodLabel('X'), 'X');
});

// ---------- 사실 묶음 ----------

const sources = {
  elderlyId: 1,
  careRecords: [
    { elderlyId: 1, recordDate: '2026-07-01', specialNote: '보행기로 복도 두 바퀴를 혼자 걸으심' },
    { elderlyId: 1, recordDate: '2026-06-30', specialNote: '기간 앞 기록' },
    { elderlyId: 1, recordDate: '2026-09-30', specialNote: '특이사항 없음' },
    { elderlyId: 2, recordDate: '2026-08-01', specialNote: '다른 어르신' },
  ],
  nursingLogs: [
    { elderlyId: 1, logDate: '2026-07-01', systolic: 130, diastolic: 80, bloodSugar: null, weight: 55 },
    { elderlyId: 1, logDate: '2026-09-30', systolic: 134, diastolic: 86, bloodSugar: 110, weight: 54.2 },
    { elderlyId: 1, logDate: '2026-10-01', systolic: 200, diastolic: 100, bloodSugar: null, weight: null },
    { elderlyId: 2, logDate: '2026-08-01', systolic: 90, diastolic: 60, bloodSugar: null, weight: null },
  ],
  programs: [
    { programDate: '2026-07-01', category: 'COGNITIVE' as const, participantIds: [1, 2] },
    { programDate: '2026-09-30', category: 'PHYSICAL' as const, participantIds: [1] },
    { programDate: '2026-08-01', category: 'PHYSICAL' as const, participantIds: [2] },
  ],
  rehabSessions: [
    { elderlyId: 1, sessionDate: '2026-08-10', kind: 'PHYSICAL_FUNCTION' as const, minutes: 30 },
    { elderlyId: 1, sessionDate: '2026-10-02', kind: 'ADL' as const, minutes: 99 },
  ],
  events: [
    { elderlyId: 1, occurredAt: '2026-08-14T10:30', kind: 'FALL' as const, severity: 'MODERATE' as const },
    { elderlyId: 1, occurredAt: '2026-09-30T23:59', kind: 'FALL' as const, severity: 'LOW' as const },
    { elderlyId: 1, occurredAt: '2026-10-01T00:00', kind: 'FALL' as const, severity: 'LOW' as const },
  ],
  bathLogs: [
    { elderlyId: 1, bathDate: '2026-07-01' },
    { elderlyId: 1, bathDate: '2026-07-01' },
    { elderlyId: 1, bathDate: '2026-09-30' },
    { elderlyId: 1, bathDate: '2026-10-01' },
    { elderlyId: 2, bathDate: '2026-08-01' },
  ],
};

test('buildDischargeFacts — 기간(양 끝 포함) 안의 그 어르신 기록만 모은다', () => {
  const f = buildDischargeFacts({ ...sources, from: '2026-07-01', to: '2026-09-30' });
  assert.deepEqual(f.period, { from: '2026-07-01', to: '2026-09-30' });
  assert.deepEqual(f.vitals.bp, { avgSys: 132, avgDia: 83, count: 2 });
  assert.deepEqual(f.vitals.bloodSugar, { avg: 110, min: 110, max: 110, count: 1 });
  assert.deepEqual(f.vitals.weight, { first: 55, last: 54.2, change: -0.8 });
  assert.deepEqual(f.programs, { total: 2, byCategory: { COGNITIVE: 1, PHYSICAL: 1 } });
  assert.deepEqual([f.rehab.sessions, f.rehab.minutes, f.rehab.kinds], [1, 30, ['신체기능 훈련']]);
  assert.deepEqual(f.events.map((e) => e.date), ['2026-08-14', '2026-09-30']); // 10/01 00:00은 기간 밖
  assert.deepEqual(f.specialNotes, ['보행기로 복도 두 바퀴를 혼자 걸으심']); // 형식적 문구와 기간 밖·다른 사람은 빠짐
  assert.deepEqual(f.bath, { count: 2 }); // 같은 날 두 번은 하루
  assert.equal(f.attendanceDays, null);
});

test('buildDischargeFacts — 출석 일수를 알면 담고, 잘못된 기간은 빈 묶음', () => {
  assert.equal(buildDischargeFacts({ ...sources, from: '2026-07-01', to: '2026-09-30', attendanceDays: 52 }).attendanceDays, 52);
  const empty = buildDischargeFacts({ ...sources, from: '2026-09-30', to: '2026-07-01' });
  assert.deepEqual([empty.programs.total, empty.events.length, empty.bath.count, empty.specialNotes.length, empty.vitals.bp], [0, 0, 0, 0, null]);
  assert.equal(buildDischargeFacts({ ...sources, from: 'x', to: '2026-07-01' }).programs.total, 0);
});

test('buildDischargeFacts — 하루짜리 기간과 윤년 2/29', () => {
  const f = buildDischargeFacts({ ...sources, from: '2026-09-30', to: '2026-09-30' });
  assert.equal(f.programs.total, 1);
  const leap = buildDischargeFacts({ ...sources, bathLogs: [{ elderlyId: 1, bathDate: '2028-02-29' }], from: '2028-02-29', to: '2028-02-29' });
  assert.equal(leap.bath.count, 1);
});

test('buildDischargeFacts — 사실 묶음에 사람 이름이 들어갈 칸이 없다', () => {
  const text = JSON.stringify(buildDischargeFacts({ ...sources, from: '2026-07-01', to: '2026-09-30' }));
  assert.doesNotMatch(text, /elderlyName|recipient|provider|writer/);
});
