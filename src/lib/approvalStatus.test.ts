import { test } from 'node:test';
import assert from 'node:assert/strict';
import { approvalStatusBadge, APPROVAL_STATUS_BADGE } from './approvalStatus.ts';

test('네 상태 모두 한국어 글자 — 영어(DRAFT 등)가 화면에 나오지 않는다', () => {
  for (const { label } of Object.values(APPROVAL_STATUS_BADGE)) {
    assert.match(label, /^[가-힣]+$/);
  }
  assert.equal(approvalStatusBadge('DRAFT').label, '임시저장');
});

test('상태 색은 옅은 꼬리표 세 갈래 — 진한 바탕(success·warning·error)을 쓰지 않는다', () => {
  assert.equal(approvalStatusBadge('APPROVED').variant, 'green');
  assert.equal(approvalStatusBadge('PENDING').variant, 'yellow');
  assert.equal(approvalStatusBadge('REJECTED').variant, 'red');
  assert.equal(approvalStatusBadge('DRAFT').variant, 'neutral');
});

test('모르는 상태는 받은 글자를 회색으로', () => {
  assert.deepEqual(approvalStatusBadge('CANCELLED'), { label: 'CANCELLED', variant: 'neutral' });
  assert.deepEqual(approvalStatusBadge(null), { label: '', variant: 'neutral' });
});
