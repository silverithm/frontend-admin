/**
 * 청구서 한 번에 채우기 계획 테스트 — `node --test src/lib/lab/copayBatch.test.ts`
 * 왜: 이미 저장·수납된 청구서나 직원이 고친 칸을 덮어쓰면 돈 기록이 틀어진다. 덮어쓰지 않는 경계를 손으로 센 값과 맞춘다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { batchSummary, planBatchFill } from './copayBatch.ts';
import type { BatchContract } from './copayBatch.ts';

const contracts = new Map<number, BatchContract>([
  [1, { careGrade: '3', copayClass: 'standard' }],
  [2, { careGrade: '5', copayClass: 'reduced40' }],
  [3, { careGrade: '2', copayClass: 'standard' }],
  [4, { careGrade: 'cognitive', copayClass: 'medicalAid' }],
]);
const elders = [1, 2, 3, 4, 5].map((id) => ({ id }));

test('계약이 있는 어르신만 채우고 계약이 없으면 건너뛴다', () => {
  const plan = planBatchFill({ elders, contracts, billed: new Set(), edited: new Set(), presentDays: new Map([[1, 15]]) });
  assert.equal(plan.fillCount, 4);
  assert.equal(plan.skipped.NO_CONTRACT, 1);
  const r1 = plan.rows.find((r) => r.elderId === 1)!;
  assert.deepEqual([r1.action, r1.grade, r1.copayClass, r1.days], ['FILL', '3', 'standard', 15]);
  const r2 = plan.rows.find((r) => r.elderId === 2)!;
  assert.deepEqual([r2.grade, r2.copayClass], ['5', 'reduced40']);
  assert.equal(plan.rows.find((r) => r.elderId === 5)!.skip, 'NO_CONTRACT');
});

test('이미 저장된 청구서와 직원이 고친 칸은 덮어쓰지 않는다', () => {
  const plan = planBatchFill({ elders, contracts, billed: new Set([1]), edited: new Set([2]), presentDays: new Map() });
  assert.equal(plan.rows.find((r) => r.elderId === 1)!.skip, 'BILLED');
  assert.equal(plan.rows.find((r) => r.elderId === 2)!.skip, 'EDITED');
  assert.equal(plan.fillCount, 2);
  assert.deepEqual(plan.skipped, { BILLED: 1, EDITED: 1, NO_CONTRACT: 1 });
  // 저장된 청구서는 계약이 없어도 BILLED가 먼저다(5번 어르신은 계약이 없지만 저장돼 있으면 BILLED)
  const p2 = planBatchFill({ elders, contracts, billed: new Set([5]), edited: new Set(), presentDays: null });
  assert.equal(p2.rows.find((r) => r.elderId === 5)!.skip, 'BILLED');
});

test('이용일수는 출석이 있을 때만 넣고 없으면 비워 둔 채 알린다', () => {
  const plan = planBatchFill({ elders, contracts, billed: new Set(), edited: new Set(), presentDays: new Map([[1, 15], [2, 0]]) });
  assert.equal(plan.rows.find((r) => r.elderId === 1)!.days, 15);
  assert.equal(plan.rows.find((r) => r.elderId === 2)!.days, null);
  assert.equal(plan.needsDays, 3); // 2·3·4번은 출석 기록이 없다
  // 출석 정보를 아예 못 불러와도 계약은 채운다
  const none = planBatchFill({ elders, contracts, billed: new Set(), edited: new Set(), presentDays: null });
  assert.equal(none.fillCount, 4);
  assert.equal(none.needsDays, 4);
});

test('안내 문장', () => {
  const plan = planBatchFill({ elders, contracts, billed: new Set([1]), edited: new Set([2]), presentDays: new Map([[3, 10]]) });
  assert.equal(batchSummary(plan), '2명을 계약으로 채웠습니다 · 1명은 출석 기록이 없어 이용일수를 적어야 합니다 · 계약이 없는 1명은 건너뛰었습니다 · 이미 저장된 청구서 1건은 그대로 두었습니다 · 직접 고친 1명은 그대로 두었습니다');
});

test('빈 명단과 모두 건너뛰는 경우', () => {
  const empty = planBatchFill({ elders: [], contracts, billed: new Set(), edited: new Set(), presentDays: null });
  assert.equal(empty.fillCount, 0);
  assert.equal(batchSummary(empty), '0명을 계약으로 채웠습니다');
  console.log('copay-batch-fill verified');
});
