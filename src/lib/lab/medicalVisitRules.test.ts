/**
 * 진료 동행 기록 규칙 테스트 — `node --test src/lib/lab/medicalVisitRules.test.ts`
 * 왜: 진료 후속 확인을 놓치면 어르신 건강 문제로 이어지고, 급여제공기록 문장이 어색하면 직원이 그대로 못 쓴다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { CARE_RECORD_SUMMARY_CHARS, followUpsDue, visitCareRecordText, visitStats } from './medicalVisitRules.ts';

const V = (o: Partial<{ visitDate: string; department: string; escortName: string; guardianNotified: boolean }> = {}) => ({ visitDate: '2026-05-01', department: '정형외과', escortName: '박요양', guardianNotified: true, ...o });
const F = (id: number, followUpOn: string | null, followUpDone: boolean) => ({ id, followUpOn, followUpDone });

test('진료 통계 — 그 해 기록만, 진료과 비면 미기재, 동행·보호자 알림 수와 비율', () => {
  const s = visitStats([V(), V({ department: '', guardianNotified: false }), V({ escortName: '' }), V({ visitDate: '2025-12-01' })], 2026);
  assert.deepEqual([s.total, s.byDepartment, s.escorted, s.guardianNotified, s.notifyRate], [3, { 정형외과: 2, 미기재: 1 }, 2, 2, 66.7]);
});

test('진료 통계 — 기록이 없으면 비율은 null, 공백뿐인 진료과·동행 직원은 비어 있는 것으로', () => {
  const none = visitStats([], 2026);
  assert.deepEqual([none.total, none.escorted, none.notifyRate], [0, 0, null]);
  const s = visitStats([V({ department: '  ', escortName: '  ' })], 2026);
  assert.deepEqual([s.byDepartment, s.escorted], [{ 미기재: 1 }, 0]);
});

test('진료 통계 — 연말·연초 경계(12-31은 그 해, 01-01은 다음 해)와 비율 경계(1/8 = 12.5)', () => {
  const s = visitStats([V({ visitDate: '2026-12-31' }), V({ visitDate: '2027-01-01' })], 2026);
  assert.equal(s.total, 1);
  const eight = Array.from({ length: 8 }, (_, i) => V({ guardianNotified: i === 0 }));
  assert.equal(visitStats(eight, 2026).notifyRate, 12.5);
  assert.equal(visitStats([V({ guardianNotified: false })], 2026).notifyRate, 0);
});

test('후속 확인 — 오늘 포함 지난 것 중 완료 아닌 것만, 날짜 오름차순', () => {
  const rows = [F(1, '2026-10-20', false), F(2, '2026-10-10', false), F(3, '2026-10-01', true), F(4, '2026-10-15', false), F(5, null, false)];
  assert.deepEqual(followUpsDue(rows, '2026-10-15').map((v) => v.id), [2, 4]);
  assert.deepEqual(followUpsDue(rows, '2026-10-14').map((v) => v.id), [2]);
  assert.deepEqual(followUpsDue([], '2026-10-15'), []);
});

test('급여제공기록 문장 — 시각·병원·진료과·동행 직원·진료 내용', () => {
  const line = visitCareRecordText({ startTime: '10:00', endTime: '11:30', hospital: '서울정형외과', department: '정형외과', escortName: '박요양', result: '무릎 X-ray 이상 없음. 진통제 처방' });
  assert.equal(line, '10:00~11:30 서울정형외과 정형외과 진료 동행(직원 박요양) — 무릎 X-ray 이상 없음. 진통제 처방');
});

test('급여제공기록 문장 — 시각이 없으면 병원 이름으로 시작한다', () => {
  const line = visitCareRecordText({ startTime: null, endTime: null, hospital: '서울정형외과', department: '', escortName: '박요양', result: '이상 없음' });
  assert.equal(line, '서울정형외과 진료 동행(직원 박요양) — 이상 없음');
  assert.ok(!/^\d/.test(line));
});

test('급여제공기록 문장 — 한쪽 시각만 있으면 부터·까지로', () => {
  assert.match(visitCareRecordText({ startTime: '10:00', hospital: '가병원', result: 'x' }), /^10:00부터 가병원/);
  assert.match(visitCareRecordText({ endTime: '11:30', hospital: '가병원', result: 'x' }), /^11:30까지 가병원/);
});

test('급여제공기록 문장 — 진료 내용은 앞 60자만, 줄바꿈은 공백 하나로, 잘리면 …', () => {
  const long = `${'가'.repeat(30)}\n\n${'나'.repeat(40)}`;
  const line = visitCareRecordText({ hospital: '가병원', escortName: '박', result: long });
  const summary = line.split(' — ')[1];
  assert.equal(Array.from(summary).length, CARE_RECORD_SUMMARY_CHARS + 1);
  assert.ok(summary.endsWith('…'));
  assert.ok(!summary.includes('\n'));
  const exact = visitCareRecordText({ hospital: '가병원', result: '가'.repeat(60) });
  assert.ok(!exact.endsWith('…'));
});

test('급여제공기록 문장 — 진료 내용·동행 직원이 비어도 문장이 깨지지 않는다', () => {
  assert.equal(visitCareRecordText({ hospital: '가병원' }), '가병원 진료 동행');
  assert.equal(visitCareRecordText({}), '진료 동행');
});
