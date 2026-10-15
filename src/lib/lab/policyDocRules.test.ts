/**
 * 규정·지침 대장 규칙 테스트 — `node --test src/lib/lab/policyDocRules.test.ts`
 * 왜: 항목 키가 서버·AI와 어긋나면 체크가 저장되지 않고, 개정일 365일 경계를 틀리면 "최근 12개월 개정" 근거가 뒤집힌다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { POLICY_ITEMS, aiKindOf, docStatus, infectionResponseEvidence, itemsOf, operatingRulesEvidence, type InfectionTrainingShape, type PolicyDocShape } from './policyDocRules.ts';

const AS = '2026-10-15';
const OPK = ['capacity', 'contract', 'feeChange', 'servicesFees', 'liability', 'revision', 'staffing', 'pay', 'welfare', 'safetyHealth', 'grievance'];
const DOC = (o: Partial<PolicyDocShape> = {}): PolicyDocShape => ({
  kind: 'OPERATING_RULES', guideNo: null, revisedOn: '2026-03-01', location: '사무실 서가', checks: Object.fromEntries(OPK.map((k) => [k, true])), ...o,
});

test('항목 수와 키: 운영규정 11, ⑩ 개인정보 3, 감염병 2, 수칙 4, 고충처리 3', () => {
  assert.equal(itemsOf('OPERATING_RULES', null).length, 11);
  assert.deepEqual(itemsOf('CARE_GUIDE', 10).map((i) => i.key), ['purpose', 'items', 'retention']);
  assert.deepEqual(itemsOf('INFECTION_PLAN', null).map((i) => i.key), ['nationalCrisis', 'internalOutbreak']);
  assert.equal(itemsOf('TRANSPORT_RULES', null).length, 4);
  assert.deepEqual(itemsOf('GRIEVANCE_GUIDE', null).map((i) => i.key), ['intake', 'process', 'deadline']);
});

test('운영규정 항목 키는 계약 순서 그대로', () => {
  assert.deepEqual(itemsOf('OPERATING_RULES', null).map((i) => i.key), OPK);
});

test('급여제공지침은 ⑩만 항목이 있고 그 밖의 번호·개인정보 처리방침·기타는 빈 목록', () => {
  assert.equal(itemsOf('CARE_GUIDE', 3).length, 0);
  assert.equal(itemsOf('CARE_GUIDE', null).length, 0);
  assert.equal(itemsOf('PRIVACY_POLICY', null).length, 0);
  assert.equal(itemsOf('OTHER', null).length, 0);
});

test('AI 점검 종류: 대장 종류와 지침 번호에서 정한다', () => {
  assert.equal(aiKindOf('CARE_GUIDE', 10), 'PRIVACY_GUIDE');
  assert.equal(aiKindOf('CARE_GUIDE', 4), null);
  assert.equal(aiKindOf('OPERATING_RULES', null), 'OPERATING_RULES');
  assert.equal(aiKindOf('OTHER', null), null);
  assert.deepEqual(Object.keys(POLICY_ITEMS).sort(), ['GRIEVANCE_GUIDE', 'INFECTION_PLAN', 'OPERATING_RULES', 'PRIVACY_GUIDE', 'TRANSPORT_RULES']);
});

test('대장 상태: 항목·개정일·비치 장소가 모두 있으면 READY', () => {
  const s = docStatus(DOC(), AS);
  assert.deepEqual([s.itemsTotal, s.itemsChecked, s.missingItems, s.complete, s.revisedWithin12m, s.state], [11, 11, [], true, true, 'READY']);
});

test('대장 상태: 빠진 항목은 라벨로, 키가 아예 없거나 false인 것 모두 빠진 것', () => {
  const checks = Object.fromEntries(OPK.filter((k) => k !== 'welfare').map((k) => [k, k !== 'pay']));
  const s = docStatus(DOC({ checks }), AS);
  assert.deepEqual([s.itemsChecked, s.missingItems, s.complete, s.state], [9, ['보수', '복리후생'], false, 'PARTIAL']);
});

test('대장 상태: 모르는 키는 항목 수에 영향이 없다', () => {
  const s = docStatus(DOC({ checks: { ...DOC().checks, bogus: true } }), AS);
  assert.deepEqual([s.itemsTotal, s.itemsChecked], [11, 11]);
});

test('대장 상태: 개정일 365일째는 12개월 안, 366일째는 밖', () => {
  assert.equal(docStatus(DOC({ revisedOn: '2025-10-15' }), AS).revisedWithin12m, true);
  assert.equal(docStatus(DOC({ revisedOn: '2025-10-14' }), AS).revisedWithin12m, false);
  assert.equal(docStatus(DOC({ revisedOn: null }), AS).revisedWithin12m, false);
});

test('대장 상태: 개정일이나 비치 장소가 없으면 항목이 완비여도 PARTIAL, 장소가 공백뿐이어도 마찬가지', () => {
  assert.equal(docStatus(DOC({ revisedOn: null }), AS).state, 'PARTIAL');
  assert.equal(docStatus(DOC({ location: null }), AS).state, 'PARTIAL');
  assert.equal(docStatus(DOC({ location: '  ' }), AS).state, 'PARTIAL');
});

test('대장 상태: 항목이 없는 종류(기타)는 개정일·비치 장소만 있으면 READY', () => {
  assert.equal(docStatus(DOC({ kind: 'OTHER', checks: {} }), AS).state, 'READY');
  assert.equal(docStatus(DOC({ kind: 'OTHER', checks: {} }), AS).itemsTotal, 0);
});

test('운영규정 근거: 없으면 MISSING(열한 개 전부 빠짐), 갖추면 READY, 장소 없으면 PARTIAL', () => {
  const none = operatingRulesEvidence([], AS);
  assert.deepEqual([none.state, none.missingItems.length], ['MISSING', 11]);
  assert.equal(operatingRulesEvidence([DOC()], AS).state, 'READY');
  assert.equal(operatingRulesEvidence([DOC({ location: null })], AS).state, 'PARTIAL');
  assert.equal(operatingRulesEvidence([DOC({ kind: 'INFECTION_PLAN' })], AS).state, 'MISSING');
});

const INF = DOC({ kind: 'INFECTION_PLAN', revisedOn: '2026-02-01', checks: { nationalCrisis: true, internalOutbreak: true } });
const TRN = (heldOn: string, category: InfectionTrainingShape['category'], attendeeIds: number[], kind: InfectionTrainingShape['kind'] = 'TRAINING'): InfectionTrainingShape => ({ kind, category, heldOn, attendeeIds });

test('감염병 대응: 계획과 교육이 모두 있으면 READY', () => {
  const r = infectionResponseEvidence([INF], [TRN('2025-11-01', 'INFECTION', [1, 2])], AS);
  assert.deepEqual([r.plan, r.revisedWithin12m, r.trainings12m, r.state], [true, true, 1, 'READY']);
});

test('감염병 대응: 교육 365일째는 안, 366일째는 밖, 참석자 없는 교육·다른 범주·회의는 세지 않는다', () => {
  const t = [TRN('2025-10-15', 'INFECTION', [1]), TRN('2025-10-14', 'INFECTION', [1]), TRN('2026-05-01', 'SAFETY', [1]), TRN('2026-06-01', 'INFECTION', []), TRN('2026-06-02', 'INFECTION', [1], 'MEETING')];
  assert.equal(infectionResponseEvidence([INF], t, AS).trainings12m, 1);
});

test('감염병 대응: 아직 안 한(미래 날짜) 교육은 세지 않는다', () => {
  assert.equal(infectionResponseEvidence([], [TRN('2026-10-16', 'INFECTION', [1])], AS).trainings12m, 0);
});

test('감염병 대응: 둘 중 하나만 있으면 PARTIAL, 둘 다 없으면 MISSING, 두 체계 중 하나만 체크하면 계획 없음', () => {
  assert.equal(infectionResponseEvidence([INF], [], AS).state, 'PARTIAL');
  assert.equal(infectionResponseEvidence([], [TRN('2026-05-01', 'INFECTION', [1])], AS).state, 'PARTIAL');
  assert.equal(infectionResponseEvidence([], [], AS).state, 'MISSING');
  const half = DOC({ kind: 'INFECTION_PLAN', checks: { nationalCrisis: true } });
  assert.equal(infectionResponseEvidence([half], [], AS).plan, false);
});
