/**
 * 오른쪽 위 알림 카드 — 서버 알림함의 '확인 안 한 알림'을 카드로 묶는 규칙.
 *
 * 채팅은 한 방에서 수십 건이 올 수 있어 방마다 카드 하나로 묶는다(가장 새 메시지 + 몇 개).
 * 지금 펼쳐 보고 있는 방의 채팅은 띄우지 않는다. 나머지 알림은 한 건씩 카드가 된다.
 */
import type { MyNotification } from '@/lib/apiService';

/** 카드의 '열기'가 가는 곳 — 셸(관리자·직원)마다 갈 수 있는 곳이 다르다 */
export type NotificationTarget = 'chat' | 'work_task' | 'approval' | 'notice' | 'vacation' | 'schedule' | 'members' | 'meeting_minutes';

export function notificationTarget(n: Pick<MyNotification, 'type' | 'relatedEntityType'>): NotificationTarget | null {
  const type = n.type ?? '';
  if (type === 'CHAT') return 'chat';
  if (type === 'WORK_TASK') return 'work_task';
  if (type === 'APPROVAL') return 'approval';
  if (type === 'NOTICE') return 'notice';
  if (type.startsWith('VACATION')) return 'vacation';
  if (type.startsWith('MEMBER_JOIN')) return 'members';
  if (type === 'MEETING_MINUTES') return 'meeting_minutes';
  // 일정은 알림 종류 칸에 따로 없어 GENERAL로 오고, 무엇인지는 relatedEntityType이 말한다 —
  // 등록·배정은 'schedule', 매일 아침 리마인더는 'schedule_start_reminder'·'schedule_task_reminder'
  if (n.relatedEntityType?.startsWith('schedule')) return 'schedule';
  return null;
}

export interface NotificationCard {
  /** 화면 key — 채팅은 방, 나머지는 알림 id */
  key: string;
  target: NotificationTarget | null;
  /** 이 카드를 '확인'하면 읽음으로 바꿀 알림 id들 */
  ids: number[];
  /** 가장 새 알림 */
  latest: MyNotification;
  /** 묶인 알림 수(채팅 외에는 1) */
  count: number;
  /** 채팅 카드의 방 */
  roomId: number | null;
}

/**
 * @param list 서버가 준 확인 안 한 알림(새것부터)
 * @param viewingRoomIds 지금 펼쳐 보고 있는 채팅방 — 그 방 채팅은 뺀다
 */
export function buildNotificationCards(list: MyNotification[], viewingRoomIds: Set<number>): NotificationCard[] {
  const cards: NotificationCard[] = [];
  const chatByRoom = new Map<number, NotificationCard>();
  for (const n of list) {
    const target = notificationTarget(n);
    if (target === 'chat' && n.relatedEntityId != null) {
      const roomId = n.relatedEntityId;
      if (viewingRoomIds.has(roomId)) continue;
      const existing = chatByRoom.get(roomId);
      if (existing) {
        existing.ids.push(n.id);
        existing.count += 1;
        continue;
      }
      const card: NotificationCard = { key: `chat:${roomId}`, target, ids: [n.id], latest: n, count: 1, roomId };
      chatByRoom.set(roomId, card);
      cards.push(card);
      continue;
    }
    cards.push({ key: `n:${n.id}`, target, ids: [n.id], latest: n, count: 1, roomId: null });
  }
  return cards;
}
