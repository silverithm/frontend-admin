import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseDefaultApprovalLine, withoutDrafter } from './approvalLine.ts';

const 팀장 = { approverType: 'MEMBER', approverId: 21, name: '팀장' };
const 국장직원 = { approverType: 'MEMBER', approverId: 9, name: '이수나' };
const 원장관리자 = { approverType: 'ADMIN', approverId: 3, name: '원장' };

test('직원 기안자는 직원 결재자 줄에서만 빠진다', () => {
  const line = [팀장, 국장직원, 원장관리자];
  assert.deepEqual(withoutDrafter(line, '9').map((a) => a.name), ['팀장', '원장']);
});

test('관리자 기안자는 admin_ 식별자로 맞춘다 — 같은 숫자의 직원은 남는다', () => {
  const 같은숫자직원 = { approverType: 'MEMBER', approverId: 3, name: '번호 3 직원' };
  const line = [원장관리자, 같은숫자직원];
  assert.deepEqual(withoutDrafter(line, 'admin_3').map((a) => a.name), ['번호 3 직원']);
  assert.deepEqual(withoutDrafter(line, '3').map((a) => a.name), ['원장']);
});

test('기안자가 없거나 식별자가 비어 있으면 그대로', () => {
  const line = [팀장, 원장관리자];
  assert.deepEqual(withoutDrafter(line, '999'), line);
  assert.deepEqual(withoutDrafter(line, ''), line);
});

test('기본 결재선 JSON을 읽을 때 기안자를 빼고, 깨진 값은 빈 목록', () => {
  const json = JSON.stringify([팀장, 국장직원]);
  assert.deepEqual(parseDefaultApprovalLine<{ approverType: string; approverId: number; name: string }>(json, '9').map((a) => a.name), ['팀장']);
  assert.deepEqual(parseDefaultApprovalLine('not json', '9'), []);
  assert.deepEqual(parseDefaultApprovalLine('{"a":1}', '9'), []);
  assert.deepEqual(parseDefaultApprovalLine(null, '9'), []);
});

console.log('approval-line drafter rules verified');
