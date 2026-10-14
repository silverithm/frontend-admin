/**
 * 입소 상담·대기 규칙 테스트 — `node --test src/lib/lab/intakeRules.test.ts`
 * 왜: 연락 예정일을 놓치면 대기 어르신이 잊히고, 동의 없는 연락처·사유 없는 거절은 법 위반 소지가 된다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import type { IntakeInquiry } from './labTypes.ts';
import { DECLINE_REASONS, INTAKE_STATUSES, inquiryAlerts, intakeStats, waitlist } from './intakeRules.ts';

type Status = 'NEW' | 'CONSULTED' | 'WAITING' | 'CONTRACTED' | 'DECLINED' | 'WITHDRAWN';
type Row = Pick<IntakeInquiry, 'id' | 'inquiryDate' | 'status' | 'applicantName' | 'contactPhone' | 'consentOn' | 'nextContactOn' | 'declineReason' | 'source'>;
const Q = (id: number, inquiryDate: string, status: Status, o: Partial<Row> = {}): Row => ({ id, inquiryDate, status, applicantName: `신청${id}`, contactPhone: null, consentOn: null, nextContactOn: null, declineReason: null, source: 'PHONE', ...o });

test('상태·거절 사유 목록', () => {
  assert.deepEqual(INTAKE_STATUSES.map((s) => s.value), ['NEW', 'CONSULTED', 'WAITING', 'CONTRACTED', 'DECLINED', 'WITHDRAWN']);
  assert.deepEqual(DECLINE_REASONS.map((r) => r.value), ['CAPACITY', 'OUT_OF_AREA', 'SERVICE_MISMATCH', 'OTHER']);
});

test('대기 순번 — 문의일 오름차순, 같으면 id, 대기만', () => {
  const w = waitlist([Q(3, '2026-09-01', 'WAITING'), Q(1, '2026-08-15', 'WAITING'), Q(5, '2026-09-01', 'WAITING'), Q(7, '2026-07-01', 'NEW'), Q(8, '2026-06-01', 'CONTRACTED')]);
  assert.deepEqual(w.map((x) => [x.inquiry.id, x.rank]), [[1, 1], [3, 2], [5, 3]]);
  assert.deepEqual(waitlist([]), []);
});

test('대기 순번 — 입력 배열을 바꾸지 않는다', () => {
  const list = [Q(2, '2026-09-01', 'WAITING'), Q(1, '2026-08-01', 'WAITING')];
  waitlist(list);
  assert.deepEqual(list.map((x) => x.id), [2, 1]);
});

const alerts = () => inquiryAlerts([
  Q(1, '2026-08-15', 'WAITING', { nextContactOn: '2026-10-15' }),
  Q(2, '2026-07-01', 'CONTRACTED', { nextContactOn: '2026-10-01' }),
  Q(3, '2026-10-01', 'NEW', { contactPhone: '010-0000-0000' }),
  Q(4, '2026-06-01', 'DECLINED'),
  Q(5, '2026-10-10', 'NEW'),
  Q(6, '2026-10-08', 'NEW'),
], '2026-10-15');

test('알림 — 연락 예정·동의 없음·사유 없음·오래된 새 문의', () => {
  assert.deepEqual(alerts().map((a) => `${a.inquiryId}:${a.code}`), ['1:FOLLOW_UP_DUE', '3:NO_CONSENT', '3:STALE_NEW', '4:DECLINE_REASON_MISSING']);
  assert.ok(alerts().every((a) => a.message.length > 5));
});

test('알림 경계 — 연락 예정일 당일은 알림, 내일은 아님, 끝난 상태는 알리지 않는다', () => {
  const a = (next: string, status: Status) => inquiryAlerts([Q(1, '2026-10-14', status, { nextContactOn: next })], '2026-10-15').map((x) => x.code);
  assert.deepEqual(a('2026-10-15', 'CONSULTED'), ['FOLLOW_UP_DUE']);
  assert.deepEqual(a('2026-10-16', 'CONSULTED'), []);
  assert.deepEqual(a('2026-10-01', 'DECLINED').filter((c) => c === 'FOLLOW_UP_DUE'), []);
  assert.deepEqual(a('2026-10-01', 'WITHDRAWN'), []);
});

test('알림 경계 — 새 문의는 7일째까지는 괜찮고 8일째부터 알린다(월 경계 포함)', () => {
  const stale = (date: string, today: string) => inquiryAlerts([Q(1, date, 'NEW')], today).some((a) => a.code === 'STALE_NEW');
  assert.equal(stale('2026-10-08', '2026-10-15'), false);
  assert.equal(stale('2026-10-07', '2026-10-15'), true);
  assert.equal(stale('2026-09-28', '2026-10-05'), false);
  assert.equal(stale('2026-09-27', '2026-10-05'), true);
  assert.equal(stale('2028-02-25', '2028-03-03'), false);
  assert.equal(stale('2028-02-24', '2028-03-03'), true);
});

test('알림 — 연락처가 공백뿐이면 동의가 없어도 알리지 않고, 동의일이 있으면 알리지 않는다', () => {
  assert.deepEqual(inquiryAlerts([Q(1, '2026-10-14', 'CONSULTED', { contactPhone: '  ' })], '2026-10-15'), []);
  assert.deepEqual(inquiryAlerts([Q(1, '2026-10-14', 'CONSULTED', { contactPhone: '010-1', consentOn: '2026-10-14' })], '2026-10-15'), []);
  assert.deepEqual(inquiryAlerts([Q(1, '2026-10-14', 'DECLINED', { declineReason: 'CAPACITY' })], '2026-10-15'), []);
});

test('통계 — 그 해 문의만, 전환율은 소수 첫째 자리', () => {
  const st = intakeStats([Q(1, '2026-01-10', 'CONTRACTED'), Q(2, '2026-02-10', 'WAITING', { source: 'VISIT' }), Q(3, '2026-03-10', 'DECLINED', { declineReason: 'CAPACITY' }), Q(4, '2026-04-10', 'NEW'), Q(5, '2025-12-10', 'CONTRACTED')], 2026);
  assert.deepEqual([st.total, st.contracted, st.conversionRate, st.bySource.PHONE, st.bySource.VISIT, st.bySource.WEB], [4, 1, 25, 3, 1, 0]);
  assert.deepEqual(st.byStatus, { NEW: 1, CONSULTED: 0, WAITING: 1, CONTRACTED: 1, DECLINED: 1, WITHDRAWN: 0 });
});

test('통계 — 문의가 없으면 전환율 null, 1/3은 33.3, 2/3은 66.7', () => {
  assert.equal(intakeStats([], 2026).conversionRate, null);
  assert.equal(intakeStats([Q(1, '2026-01-01', 'CONTRACTED'), Q(2, '2026-01-02', 'NEW'), Q(3, '2026-12-31', 'NEW')], 2026).conversionRate, 33.3);
  assert.equal(intakeStats([Q(1, '2026-01-01', 'CONTRACTED'), Q(2, '2026-01-02', 'CONTRACTED'), Q(3, '2026-12-31', 'NEW')], 2026).conversionRate, 66.7);
  assert.equal(intakeStats([Q(1, '2026-01-01', 'CONTRACTED')], 2026).conversionRate, 100);
});
