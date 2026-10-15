/**
 * 기존 기록 근거 규칙 테스트 — `node --test src/lib/lab/evalGapRules.test.ts`
 * 왜: 분모가 0이거나 90일 경계에서 하루를 잘못 세면 평가 근거 화면이 거짓 비율을 보여 준다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { eventFollowUpRates, gradeChange, medicationRecordCompleteness, privacyConsentRate, vitalsCompleteness, type EventShape, type MedicationLogShape, type VitalsLogShape } from './evalGapRules.ts';

const AS = '2026-10-15';

test('개인정보 동의: 발급일이 있는 동의 서류만 세고, 진행 중이 아닌 어르신은 뺀다', () => {
  const docs = [
    { elderlyId: 1, docType: 'PRIVACY_CONSENT' as const, issuedOn: '2026-01-02' },
    { elderlyId: 2, docType: 'PRIVACY_CONSENT' as const, issuedOn: null },
    { elderlyId: 3, docType: 'CONTRACT' as const, issuedOn: '2026-01-02' },
    { elderlyId: 9, docType: 'PRIVACY_CONSENT' as const, issuedOn: '2026-01-01' },
  ];
  assert.deepEqual(privacyConsentRate([1, 2, 3, 4], docs), { total: 4, withConsent: 1, rate: 25 });
});

test('개인정보 동의: 진행 중이 없으면 rate null, 서류가 두 장이어도 한 명, 66.7 반올림', () => {
  assert.equal(privacyConsentRate([], []).rate, null);
  const two = [{ elderlyId: 1, docType: 'PRIVACY_CONSENT' as const, issuedOn: '2026-01-02' }, { elderlyId: 1, docType: 'PRIVACY_CONSENT' as const, issuedOn: '2026-02-02' }];
  assert.equal(privacyConsentRate([1, 2, 3], two).withConsent, 1);
  assert.equal(privacyConsentRate([1, 2, 3], [...two, { elderlyId: 2, docType: 'PRIVACY_CONSENT' as const, issuedOn: '2026-03-01' }]).rate, 66.7);
});

const N = (logDate: string, o: Partial<MedicationLogShape> = {}): MedicationLogShape => ({
  logDate, medMorning: null, medLunch: null, medEvening: null, recorderName: null, note: null, treatment: null, ...o,
});

test('투약 기록: 값이 있는 기록 수·기록자 없음·건너뜀 사유 없음 (해당 없음도 값)', () => {
  const logs = [
    N('2026-10-01', { medLunch: 'GIVEN', recorderName: '정간호' }),
    N('2026-10-02', { medLunch: 'SKIPPED', recorderName: '정간호' }),
    N('2026-10-03', { medMorning: 'GIVEN' }),
    N('2026-10-04'),
    N('2026-09-10', { medLunch: 'GIVEN' }),
    N('2026-10-05', { medEvening: 'SKIPPED', note: '구토로 보류' }),
    N('2026-10-06', { medMorning: 'NA', recorderName: '정간호' }),
  ];
  assert.deepEqual(medicationRecordCompleteness(logs, '2026-09-16', '2026-10-15'), { days: 5, noRecorder: 2, skippedNoNote: 1 });
});

test('투약 기록: 기간 양 끝 날짜는 포함, 처치만 적어도 건너뜀 사유가 있는 것', () => {
  const logs = [N('2026-09-16', { medMorning: 'GIVEN', recorderName: 'a' }), N('2026-10-15', { medLunch: 'SKIPPED', recorderName: 'a', treatment: '재투약' }), N('2026-10-16', { medLunch: 'GIVEN' })];
  assert.deepEqual(medicationRecordCompleteness(logs, '2026-09-16', '2026-10-15'), { days: 2, noRecorder: 0, skippedNoNote: 0 });
  assert.deepEqual(medicationRecordCompleteness([], '2026-09-16', '2026-10-15'), { days: 0, noRecorder: 0, skippedNoNote: 0 });
});

const VL = (elderlyId: number, logDate: string, o: Partial<VitalsLogShape> = {}): VitalsLogShape => ({ elderlyId, logDate, systolic: 130, diastolic: 80, temperature: 36.5, ...o });

test('바이탈 완결: 이용일 쌍 중 수축기·이완기·체온이 다 있는 비율 (2/3 → 66.7)', () => {
  const careDays = [{ elderlyId: 1, date: '2026-10-01' }, { elderlyId: 1, date: '2026-10-02' }, { elderlyId: 2, date: '2026-10-01' }];
  const logs = [VL(1, '2026-10-01'), VL(1, '2026-10-02', { temperature: null }), VL(2, '2026-10-01'), VL(3, '2026-10-01')];
  assert.deepEqual(vitalsCompleteness(careDays, logs), { total: 3, complete: 2, rate: 66.7 });
});

test('바이탈 완결: 이용일이 없으면 rate null, 같은 쌍이 겹쳐도 한 번, 이용일이 아닌 날의 일지는 세지 않는다', () => {
  assert.deepEqual(vitalsCompleteness([], [VL(1, '2026-10-01')]), { total: 0, complete: 0, rate: null });
  const r = vitalsCompleteness([{ elderlyId: 1, date: '2026-10-01' }, { elderlyId: 1, date: '2026-10-01' }], [VL(1, '2026-10-01'), VL(1, '2026-10-05')]);
  assert.deepEqual([r.total, r.complete, r.rate], [1, 1, 100]);
});

const EV = (kind: EventShape['kind'], occurredAt: string, o: Partial<EventShape> = {}): EventShape => ({ kind, occurredAt, guardianNotifiedAt: null, followUp: null, status: 'OPEN', ...o });

test('사건 후속: 최근 90일의 낙상·부상·응급·병원만, 90일째까지 포함 91일째는 제외', () => {
  const evs = [
    EV('FALL', '2026-10-01T10:00', { guardianNotifiedAt: '2026-10-01T10:30', status: 'CLOSED', followUp: '보행 보조' }),
    EV('INJURY', '2026-09-01T09:00'),
    EV('CONDITION_CHANGE', '2026-10-02T09:00'),
    EV('HOSPITAL', '2026-07-16T10:00', { guardianNotifiedAt: '2026-07-16T11:00' }),
    EV('EMERGENCY', '2026-07-17T08:00', { guardianNotifiedAt: '2026-07-17T08:10', status: 'CLOSED' }),
  ];
  assert.deepEqual(eventFollowUpRates(evs, AS), { total: 3, notified: 2, closed: 2, closedWithFollowUp: 1 });
});

test('사건 후속: 오늘 이후 사건은 세지 않고 days를 바꿀 수 있다, 사건이 없으면 모두 0', () => {
  assert.equal(eventFollowUpRates([EV('FALL', '2026-10-16T09:00')], AS).total, 0);
  assert.equal(eventFollowUpRates([EV('FALL', '2026-09-15T09:00')], AS, 30).total, 1);
  assert.equal(eventFollowUpRates([EV('FALL', '2026-09-14T09:00')], AS, 30).total, 0);
  assert.deepEqual(eventFollowUpRates([], AS), { total: 0, notified: 0, closed: 0, closedWithFollowUp: 0 });
});

test('사건 후속: 후속 기록이 공백뿐이면 없는 것으로 본다', () => {
  assert.equal(eventFollowUpRates([EV('FALL', '2026-10-01T10:00', { status: 'CLOSED', followUp: '   ' })], AS).closedWithFollowUp, 0);
});

test('등급 변화: 숫자가 커지면 호전, 인지지원은 가장 경증', () => {
  assert.deepEqual([gradeChange('3', '4'), gradeChange('4', '3'), gradeChange('5', '5'), gradeChange('5', 'cognitive'), gradeChange('cognitive', '5')], ['BETTER', 'WORSE', 'KEEP', 'BETTER', 'WORSE']);
});

test('등급 변화: 둘 중 하나라도 없거나 모르는 값이면 null', () => {
  assert.deepEqual([gradeChange(null, '2'), gradeChange('2', null), gradeChange(undefined, undefined), gradeChange('NONE', '2'), gradeChange('2', 'APPLYING')], [null, null, null, null, null]);
});
