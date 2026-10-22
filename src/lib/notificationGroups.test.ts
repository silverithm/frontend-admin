import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNotificationCards, notificationTarget } from './notificationGroups.ts';

type N = Parameters<typeof buildNotificationCards>[0][number];

function n(id: number, type: string | null, over: Partial<N> = {}): N {
  return { id, title: `제목${id}`, message: `내용${id}`, type, relatedEntityId: null, relatedEntityType: null, createdAt: '2026-10-22T09:00:00', ...over };
}

test('채팅은 방마다 카드 하나 — 가장 새 메시지와 묶인 수', () => {
  const list = [
    n(9, 'CHAT', { relatedEntityId: 191, relatedEntityType: 'chatRoom', title: '박소향', message: '확인 부탁드려요' }),
    n(8, 'APPROVAL', { relatedEntityId: 990 }),
    n(7, 'CHAT', { relatedEntityId: 191, relatedEntityType: 'chatRoom' }),
    n(6, 'CHAT', { relatedEntityId: 12, relatedEntityType: 'chatRoom' }),
    n(5, 'CHAT', { relatedEntityId: 191, relatedEntityType: 'chatRoom' }),
  ];
  const cards = buildNotificationCards(list, new Set());
  assert.deepEqual(cards.map((c) => c.key), ['chat:191', 'n:8', 'chat:12']);
  assert.deepEqual(cards[0].ids, [9, 7, 5]);
  assert.equal(cards[0].count, 3);
  assert.equal(cards[0].latest.message, '확인 부탁드려요');
  assert.equal(cards[0].roomId, 191);
});

test('지금 보고 있는 방의 채팅은 띄우지 않는다', () => {
  const list = [
    n(3, 'CHAT', { relatedEntityId: 191 }),
    n(2, 'CHAT', { relatedEntityId: 12 }),
  ];
  assert.deepEqual(buildNotificationCards(list, new Set([191])).map((c) => c.key), ['chat:12']);
});

test('열기가 가는 곳 — 일정은 GENERAL + relatedEntityType schedule', () => {
  assert.equal(notificationTarget({ type: 'CHAT', relatedEntityType: 'chatRoom' }), 'chat');
  assert.equal(notificationTarget({ type: 'WORK_TASK', relatedEntityType: 'work_task' }), 'work_task');
  assert.equal(notificationTarget({ type: 'VACATION_SUBMITTED', relatedEntityType: 'vacation_request' }), 'vacation');
  assert.equal(notificationTarget({ type: 'MEMBER_JOIN_REQUESTED', relatedEntityType: null }), 'members');
  assert.equal(notificationTarget({ type: 'GENERAL', relatedEntityType: 'schedule' }), 'schedule');
  assert.equal(notificationTarget({ type: 'GENERAL', relatedEntityType: null }), null);
});

test('매일 아침 리마인더도 같은 곳으로 — 일정 당일·미완료 할 일, 휴무 마감·조정, 업무 요약', () => {
  assert.equal(notificationTarget({ type: 'GENERAL', relatedEntityType: 'schedule_start_reminder' }), 'schedule');
  assert.equal(notificationTarget({ type: 'GENERAL', relatedEntityType: 'schedule_task_reminder' }), 'schedule');
  assert.equal(notificationTarget({ type: 'VACATION_REMINDER', relatedEntityType: 'vacation_adjustment' }), 'vacation');
  assert.equal(notificationTarget({ type: 'VACATION_REMINDER', relatedEntityType: 'vacation_deadline_reminder' }), 'vacation');
  assert.equal(notificationTarget({ type: 'WORK_TASK', relatedEntityType: 'work_task_daily' }), 'work_task');
  // 종류가 정해진 알림은 relatedEntityType에 흔들리지 않는다
  assert.equal(notificationTarget({ type: 'CHAT', relatedEntityType: 'schedule' }), 'chat');
  assert.equal(notificationTarget({ type: 'GENERAL', relatedEntityType: 'notice' }), null);
});

test('리마인더는 채팅처럼 묶지 않고 한 건씩 카드가 된다', () => {
  const cards = buildNotificationCards([
    n(3, 'GENERAL', { relatedEntityId: 99, relatedEntityType: 'schedule_start_reminder' }),
    n(2, 'WORK_TASK', { relatedEntityId: 41, relatedEntityType: 'work_task_daily' }),
  ], new Set());
  assert.deepEqual(cards.map((c) => [c.key, c.target]), [['n:3', 'schedule'], ['n:2', 'work_task']]);
});
