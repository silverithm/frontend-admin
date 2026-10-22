'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@astryxdesign/core/Button';
import { Icon } from '@astryxdesign/core/Icon';
import { Text } from '@astryxdesign/core/Text';
import type { IconType } from 'react-icons';
import { FiBell, FiCalendar, FiCheckSquare, FiEdit3, FiFileText, FiMessageCircle, FiUserPlus } from 'react-icons/fi';
import { fetchChatRooms, fetchMyUnreadNotifications, markMyNotificationsRead, type MyNotification } from '@/lib/apiService';
import { CHAT_VIEWING_EVENT, NOTIFICATIONS_REFRESH_EVENT, requestOpenChatRoom, viewingChatRoomIds } from '@/lib/alertBus';
import { buildNotificationCards, type NotificationCard, type NotificationTarget } from '@/lib/notificationGroups';
import { useVisiblePolling } from '@/lib/useVisiblePolling';
import { requestOpenWorkTask } from '@/lib/workTasks';
import { duration } from '@/theme/motion';

/** 한 번에 띄우는 카드 수 — 나머지는 "외 n건"으로 접는다 */
const MAX_VISIBLE = 3;
/** 탭 제목 앞에 붙인 확인 안 한 수 "(2) " */
const TITLE_COUNT = /^\(\d+\+?\)\s/;
/** 새 채팅은 말풍선·패널이 신호를 주지만, 그 밖의 알림은 이 주기로 받는다 */
const POLL_MS = 30_000;
/** 채팅방 이름은 자주 바뀌지 않는다 — 카드에 방 이름을 적으려고 받은 목록을 잠시 쓴다 */
const ROOM_NAMES_TTL_MS = 60_000;

interface Props {
  /** 이 화면에서 '열기'로 갈 수 있는 곳 (업무진행도·채팅은 늘 열 수 있다) */
  targets: NotificationTarget[];
  /** '열기' — 셸이 화면을 옮긴다. 업무·채팅 창은 그 뒤 패널·말풍선이 연다 */
  onOpen?: (target: NotificationTarget, notification: MyNotification) => void;
}

function iconOf(target: NotificationTarget | null): IconType {
  switch (target) {
    case 'chat': return FiMessageCircle;
    case 'work_task': return FiCheckSquare;
    case 'approval': return FiFileText;
    case 'vacation':
    case 'schedule': return FiCalendar;
    case 'members': return FiUserPlus;
    case 'meeting_minutes': return FiEdit3;
    default: return FiBell;
  }
}

/** "방금", "12분 전", "3시간 전", "10/21" */
function whenText(createdAt: string, now: number = Date.now()): string {
  const at = new Date(createdAt).getTime();
  if (Number.isNaN(at)) return '';
  const minutes = Math.floor((now - at) / 60_000);
  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분 전`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}시간 전`;
  const d = new Date(createdAt);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/**
 * 확인할 때까지 떠 있는 알림 — 원장 요청(2026-10-22):
 * "웹에서 알람 뜰 때 사람이 확인하기 전까지 우측 상단에 팝업처럼 떠 있어야",
 * "채팅·근무조정·일정 등록·결재·업무진행도 등 새로운 내용이 생기면 모두 뜨게 — 지금은 중구난방".
 *
 * 화면마다 따로 띄우던 검은 토스트(새 메시지·결재 도착)를 걷고, 서버 알림함의 '확인 안 한' 알림만 카드로 쌓는다.
 * 서버가 기기 유무와 상관없이 알림함에 남기므로 누구에게나 같은 기준으로 뜬다. 채팅은 방마다 카드 하나로 묶고,
 * 그 방을 읽으면 내려간다. 앱에서 이미 확인한 알림은 뜨지 않는다.
 */
export default function NotificationPopups({ targets, onOpen }: Props) {
  const [items, setItems] = useState<MyNotification[]>([]);
  const [viewing, setViewing] = useState<Set<number>>(() => viewingChatRoomIds());
  const [roomNames, setRoomNames] = useState<Map<number, string>>(new Map());
  /**
   * 이 화면에서 확인을 누른 알림. 확인 직전에 출발한 목록 요청이 늦게 돌아오면 방금 내린 카드를
   * 되살린다(실제로 겪었다) — 그래서 받은 목록에서도 늘 뺀다.
   */
  const confirmedRef = useRef<Set<number>>(new Set());
  const roomNamesAtRef = useRef(0);

  const loadRoomNames = useCallback(async () => {
    if (Date.now() - roomNamesAtRef.current < ROOM_NAMES_TTL_MS) return;
    roomNamesAtRef.current = Date.now();
    try {
      const data = await fetchChatRooms();
      const list: { id: number; name: string }[] = Array.isArray(data) ? data : (data?.rooms || data?.content || data?.data || []);
      setRoomNames(new Map(list.map((r) => [r.id, r.name])));
    } catch {
      roomNamesAtRef.current = 0; // 다음에 다시
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const list = (await fetchMyUnreadNotifications(3)).filter((n) => !confirmedRef.current.has(n.id));
      setItems(list);
      if (list.some((n) => n.type === 'CHAT')) void loadRoomNames();
    } catch (error) {
      // 알림을 못 받았다고 화면을 막지는 않는다 — 다음 주기에 다시 받는다
      console.warn('[NotificationPopups] 알림을 받지 못했습니다:', error);
    }
  }, [loadRoomNames]);

  useVisiblePolling(load, POLL_MS);

  // 새 채팅이 왔거나 방을 읽었다는 신호 — 다음 주기까지 기다리지 않고 바로 받는다
  useEffect(() => {
    const onRefresh = () => { void load(); };
    const onViewing = () => setViewing(viewingChatRoomIds());
    window.addEventListener(NOTIFICATIONS_REFRESH_EVENT, onRefresh);
    window.addEventListener(CHAT_VIEWING_EVENT, onViewing);
    return () => {
      window.removeEventListener(NOTIFICATIONS_REFRESH_EVENT, onRefresh);
      window.removeEventListener(CHAT_VIEWING_EVENT, onViewing);
    };
  }, [load]);

  const cards = useMemo(() => buildNotificationCards(items, viewing), [items, viewing]);

  const confirm = useCallback(async (ids: number[]) => {
    if (ids.length === 0) return;
    ids.forEach((id) => confirmedRef.current.add(id));
    setItems((prev) => prev.filter((n) => !ids.includes(n.id)));
    try {
      await markMyNotificationsRead(ids);
    } catch (error) {
      // 서버에 못 남겼으면 다시 띄운다 — 확인 안 된 알림을 화면에서만 지우면 놓친다
      console.error('[NotificationPopups] 확인 처리 실패:', error);
      ids.forEach((id) => confirmedRef.current.delete(id));
      void load();
    }
  }, [load]);

  // 다른 탭을 보고 있어도 알 수 있게 탭 제목 앞에 확인 안 한 카드 수를 붙인다 — "(2) 케어브이 …"
  useEffect(() => {
    const base = document.title.replace(TITLE_COUNT, '');
    document.title = cards.length > 0 ? `(${cards.length > 99 ? '99+' : cards.length}) ${base}` : base;
  }, [cards.length]);
  useEffect(() => () => {
    document.title = document.title.replace(TITLE_COUNT, '');
  }, []);

  const canOpen = (card: NotificationCard) =>
    card.target === 'work_task' || card.target === 'chat' || (card.target != null && targets.includes(card.target));

  const open = (card: NotificationCard) => {
    if (!card.target) return;
    // 셸이 먼저 화면을 옮기고(채팅 탭이면 대시보드로 등), 업무·채팅은 패널·말풍선이 그 창을 연다
    onOpen?.(card.target, card.latest);
    if (card.target === 'work_task') requestOpenWorkTask(card.latest.relatedEntityId);
    if (card.target === 'chat' && card.roomId != null) requestOpenChatRoom(card.roomId);
    void confirm(card.ids);
  };

  const visible = cards.slice(0, MAX_VISIBLE);
  const hidden = cards.length - visible.length;
  if (cards.length === 0) return null;

  return (
    <section className="carev-npop" aria-label="확인하지 않은 알림">
      <AnimatePresence initial={false}>
        {visible.map((card) => {
          const n = card.latest;
          const isChat = card.target === 'chat';
          const title = isChat ? (card.roomId != null ? roomNames.get(card.roomId) : null) ?? '새 메시지' : n.title;
          const body = isChat ? `${n.title}: ${n.message}` : n.message;
          return (
            <motion.article
              key={card.key}
              layout
              className="carev-npop-card"
              aria-labelledby={`npop-title-${card.key}`}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: duration.fast, ease: 'easeOut' }}
            >
              <div className="carev-npop-head">
                <span className={`carev-npop-icon carev-npop-icon-${card.target ?? 'general'}`} aria-hidden="true">
                  <Icon icon={iconOf(card.target)} size="sm" />
                </span>
                <div className="carev-npop-titles">
                  <span id={`npop-title-${card.key}`} className="carev-npop-title">{title}</span>
                  <Text type="supporting" color="secondary">
                    {whenText(n.createdAt)}{card.count > 1 ? ` · 새 메시지 ${card.count}개` : ''}
                  </Text>
                </div>
              </div>
              <p className="carev-npop-body">{body}</p>
              <div className="carev-npop-actions">
                {canOpen(card) && <Button label="열기" size="sm" variant="ghost" onClick={() => open(card)} />}
                <Button label="확인" size="sm" variant="primary" onClick={() => void confirm(card.ids)} />
              </div>
            </motion.article>
          );
        })}
      </AnimatePresence>
      {hidden > 0 && (
        <div className="carev-npop-more">
          <Text type="supporting" color="secondary">외 {hidden}건 더 있습니다</Text>
          <Button label="모두 확인" size="sm" variant="secondary" onClick={() => void confirm(cards.flatMap((c) => c.ids))} />
        </div>
      )}
    </section>
  );
}
