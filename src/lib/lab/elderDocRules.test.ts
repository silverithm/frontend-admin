/**
 * 수급자 서류함 규칙 테스트 — `node --test src/lib/lab/elderDocRules.test.ts`
 * 왜: 급여가 끝난 날부터 5년 보존(시행규칙 제27조④)을 하루라도 일찍 파기하면 안 되고, 만료된 서류가 '있음'으로 보이면 안 된다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { ELDER_DOC_TYPES, REQUIRED_DOCS, destroyCandidates, elderDocStatus, elderDocTypeLabel, isDocExpired, retentionUntil } from './elderDocRules.ts';

const NONE = { hasContract: false, hasCarePlan: false, hasRisk: false, rightsGuided: false };
const statusOf = (rows: ReturnType<typeof elderDocStatus>) => Object.fromEntries(rows.map((x) => [x.docType, x.status]));

test('필수 서류 목록 — 여덟 가지와 자동 근거', () => {
  assert.deepEqual(REQUIRED_DOCS.map((d) => d.docType), ['CONTRACT', 'RECOGNITION', 'USE_PLAN', 'NEEDS_ASSESSMENT', 'CARE_PLAN', 'PRIVACY_CONSENT', 'RIGHTS_GUIDE', 'RISK_ASSESSMENT']);
  assert.deepEqual(REQUIRED_DOCS.map((d) => d.auto), ['contract', null, null, 'carePlan', 'carePlan', null, 'rightsGuide', 'risk']);
  assert.equal(ELDER_DOC_TYPES.at(-1)?.value, 'OTHER');
  assert.equal(elderDocTypeLabel('CONTRACT'), '급여계약서');
  assert.equal(elderDocTypeLabel('ZZZ'), 'ZZZ');
});

test('서류 갖춤 — 기록 OK·자동 근거 AUTO·만료 EXPIRED·없음 MISSING', () => {
  const st = elderDocStatus(
    { docs: [{ docType: 'RECOGNITION', expiresOn: '2027-01-01' }, { docType: 'PRIVACY_CONSENT', expiresOn: '2026-10-01' }], hasContract: true, hasCarePlan: false, hasRisk: true, rightsGuided: false },
    '2026-10-15',
  );
  assert.deepEqual(statusOf(st), { CONTRACT: 'AUTO', RECOGNITION: 'OK', USE_PLAN: 'MISSING', NEEDS_ASSESSMENT: 'MISSING', CARE_PLAN: 'MISSING', PRIVACY_CONSENT: 'EXPIRED', RIGHTS_GUIDE: 'MISSING', RISK_ASSESSMENT: 'AUTO' });
});

test('서류 갖춤 — 급여제공계획이 있으면 욕구사정·급여제공계획서 둘 다 AUTO', () => {
  const s = statusOf(elderDocStatus({ docs: [], ...NONE, hasCarePlan: true, rightsGuided: true }, '2026-10-15'));
  assert.equal(s.NEEDS_ASSESSMENT, 'AUTO');
  assert.equal(s.CARE_PLAN, 'AUTO');
  assert.equal(s.RIGHTS_GUIDE, 'AUTO');
  assert.equal(s.RECOGNITION, 'MISSING');
});

test('서류 갖춤 — 만료일 당일까지는 유효, 다음 날부터 만료, 만료일이 없으면 계속 유효', () => {
  const run = (expiresOn: string | null) => statusOf(elderDocStatus({ docs: [{ docType: 'RECOGNITION', expiresOn }], ...NONE }, '2026-10-15')).RECOGNITION;
  assert.equal(run('2026-10-15'), 'OK');
  assert.equal(run('2026-10-14'), 'EXPIRED');
  assert.equal(run(null), 'OK');
  assert.equal(run('이상한 값'), 'OK');
  assert.equal(isDocExpired('2026-10-14', '2026-10-15'), true);
  assert.equal(isDocExpired(undefined, '2026-10-15'), false);
});

test('서류 갖춤 — 같은 종류가 여러 건이면 유효한 것이 하나라도 있으면 OK(갱신 후 옛 서류가 남아 있어도)', () => {
  const docs = [{ docType: 'RECOGNITION', expiresOn: '2025-12-31', id: 1 }, { docType: 'RECOGNITION', expiresOn: '2027-12-31', id: 2 }];
  const row = elderDocStatus({ docs, ...NONE }, '2026-10-15').find((r) => r.docType === 'RECOGNITION')!;
  assert.equal(row.status, 'OK');
  assert.equal(row.doc?.id, 2);
  const allOld = elderDocStatus({ docs: [{ docType: 'USE_PLAN', expiresOn: '2025-01-01', id: 3 }, { docType: 'USE_PLAN', expiresOn: '2026-03-01', id: 4 }], ...NONE }, '2026-10-15').find((r) => r.docType === 'USE_PLAN')!;
  assert.equal(allOld.status, 'EXPIRED');
  assert.equal(allOld.doc?.id, 4);
});

test('서류 갖춤 — 만료된 기록이 있으면 자동 근거가 있어도 EXPIRED로 알린다', () => {
  const s = statusOf(elderDocStatus({ docs: [{ docType: 'CONTRACT', expiresOn: '2026-01-01' }], ...NONE, hasContract: true }, '2026-10-15'));
  assert.equal(s.CONTRACT, 'EXPIRED');
});

test('보존 기한 — 급여 종료일 + 5년, 윤일은 2월 28일', () => {
  assert.equal(retentionUntil('2020-02-29'), '2025-02-28');
  assert.equal(retentionUntil('2021-10-15'), '2026-10-15');
  assert.equal(retentionUntil('2026-12-31'), '2031-12-31');
  assert.equal(retentionUntil('2019-02-28'), '2024-02-28');
  assert.equal(retentionUntil('2026-13-01'), null);
  assert.equal(retentionUntil(''), null);
});

test('파기 대상 — 보존 기한 당일까지는 보존, 종료되지 않은 계약·종료일 없는 계약은 제외', () => {
  const c = [{ id: 1, status: 'ENDED', contractEnd: '2021-10-14' }, { id: 2, status: 'ENDED', contractEnd: '2021-10-15' }, { id: 3, status: 'ACTIVE', contractEnd: null }];
  assert.deepEqual(destroyCandidates(c, '2026-10-15').map((x) => x.id), [1]);
  assert.deepEqual(destroyCandidates(c, '2026-10-16').map((x) => x.id), [1, 2]);
  assert.deepEqual(destroyCandidates([{ id: 4, status: 'ENDED', contractEnd: null }, { id: 5, status: 'ACTIVE', contractEnd: '2010-01-01' }], '2026-10-15'), []);
});

test('파기 대상 — 윤일에 끝난 계약은 2월 28일 다음 날부터 대상, 오래된 것부터 나열', () => {
  const c = [{ id: 1, status: 'ENDED', contractEnd: '2020-03-01' }, { id: 2, status: 'ENDED', contractEnd: '2020-02-29' }];
  assert.deepEqual(destroyCandidates(c, '2025-02-28'), []);
  assert.deepEqual(destroyCandidates(c, '2025-03-01').map((x) => x.id), [2]);
  assert.deepEqual(destroyCandidates(c, '2025-03-02').map((x) => x.id), [2, 1]);
});
