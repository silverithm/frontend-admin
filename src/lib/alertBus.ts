/**
 * 웹 알림 한 줄기 — 새로 생긴 일(채팅·근무조정·일정·결재·업무진행도 …)은 모두 오른쪽 위 알림 카드(NotificationPopups)로만 띄운다.
 * 2026-10-22 원장 "검은 알림도 계속 뜨고, 언제는 뜨고 언제는 안 떠서 중구난방"을 정리하면서, 화면마다 따로 띄우던
 * 토스트를 걷고 카드에 신호만 보내게 했다.
 */

/** 카드가 서버 알림함을 바로 다시 받게 한다 — 새 채팅이 왔거나 방을 읽었을 때(다음 주기까지 기다리지 않게) */
export const NOTIFICATIONS_REFRESH_EVENT = 'carev:notifications-refresh';

export function requestNotificationsRefresh(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_REFRESH_EVENT));
}

/** 채팅 카드의 '열기' — 말풍선 채팅창(FloatingChat)이 그 방을 연다 */
export const OPEN_CHAT_ROOM_EVENT = 'carev:open-chat-room';

export function requestOpenChatRoom(roomId: number): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<{ roomId: number }>(OPEN_CHAT_ROOM_EVENT, { detail: { roomId } }));
}

/**
 * 지금 화면에 펼쳐 놓고 보고 있는 채팅방 — 그 방의 새 메시지는 카드로 띄우지 않는다(이미 보고 있다).
 * 말풍선 창과 채팅 탭이 각자 알려 준다.
 */
export type ChatViewSource = 'floating' | 'tab';

const viewing = new Map<ChatViewSource, number>();
export const CHAT_VIEWING_EVENT = 'carev:chat-viewing';

export function setViewingChatRoom(source: ChatViewSource, roomId: number | null): void {
  const before = viewing.get(source) ?? null;
  if (roomId == null) viewing.delete(source);
  else viewing.set(source, roomId);
  if (before !== roomId && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CHAT_VIEWING_EVENT));
  }
}

export function viewingChatRoomIds(): Set<number> {
  return new Set(viewing.values());
}
