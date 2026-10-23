import test from 'node:test';
import assert from 'node:assert/strict';
import { assigneeLabel, dueLabel, isDone, myInProgressCount, seoulToday, splitTasks, type WorkTask } from './workTasks.ts';

function task(over: Partial<WorkTask>): WorkTask {
  return {
    id: 1, content: '사업계획서 작성', importance: 'NORMAL', progress: 0, dueDate: null,
    assignees: [{ id: '34', name: '박소향' }], createdBy: { id: '40', name: '이수나' },
    createdAt: '2026-10-22T09:00:00', updatedAt: '2026-10-22T09:00:00', completedAt: null,
    canEdit: true, canDelete: true, ...over,
  };
}

test('기한 표시 — 지남·오늘·내일·사흘 안·그 뒤', () => {
  const today = '2026-10-22';
  assert.deepEqual(dueLabel('2026-10-20', today), { text: '10/20 지남', tone: 'overdue' });
  assert.deepEqual(dueLabel('2026-10-22', today), { text: '오늘까지', tone: 'overdue' });
  assert.deepEqual(dueLabel('2026-10-23', today), { text: '내일까지', tone: 'soon' });
  assert.deepEqual(dueLabel('2026-10-25', today), { text: 'D-3', tone: 'soon' });
  assert.deepEqual(dueLabel('2026-10-31', today), { text: '10/31', tone: 'normal' });
  assert.equal(dueLabel(null, today), null);
  // 달·해를 넘겨도 날 수가 맞다
  assert.deepEqual(dueLabel('2027-01-01', '2026-12-31'), { text: '내일까지', tone: 'soon' });
});

test('담당자 표시 — 한 명이면 이름, 여럿이면 "외 n"', () => {
  assert.equal(assigneeLabel([{ id: '34', name: '박소향' }]), '박소향');
  assert.equal(assigneeLabel([{ id: '34', name: '박소향' }, { id: 'admin_3', name: '김도형' }, { id: '21', name: '김보경' }]), '박소향 외 2');
  assert.equal(assigneeLabel([]), '담당자 없음');
});

test('완료는 수행도 100 또는 완료 시각', () => {
  assert.equal(isDone(task({ progress: 100 })), true);
  assert.equal(isDone(task({ progress: 90 })), false);
  assert.equal(isDone(task({ progress: 90, completedAt: '2026-10-22T10:00:00' })), true);
  const { inProgress, done } = splitTasks([task({ id: 1 }), task({ id: 2, progress: 100, completedAt: 'x' })]);
  assert.deepEqual(inProgress.map((t) => t.id), [1]);
  assert.deepEqual(done.map((t) => t.id), [2]);
});

test('내가 맡은 진행 중 업무만 센다', () => {
  const tasks = [
    task({ id: 1, assignees: [{ id: '34', name: '박소향' }] }),
    task({ id: 2, assignees: [{ id: '40', name: '이수나' }, { id: '34', name: '박소향' }] }),
    task({ id: 3, assignees: [{ id: '34', name: '박소향' }], progress: 100, completedAt: 'x' }),
    task({ id: 4, assignees: [{ id: '21', name: '김보경' }] }),
  ];
  assert.equal(myInProgressCount(tasks, '34'), 2);
  assert.equal(myInProgressCount(tasks, null), 0);
});

test('서울 기준 오늘 — UTC 저녁은 서울 다음 날', () => {
  assert.equal(seoulToday(new Date('2026-10-21T16:00:00Z')), '2026-10-22');
  assert.equal(seoulToday(new Date('2026-10-21T14:00:00Z')), '2026-10-21');
});
