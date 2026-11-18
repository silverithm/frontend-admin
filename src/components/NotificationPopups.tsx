'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Toaster, toast } from 'sonner';
import { Avatar } from '@astryxdesign/core/Avatar';
import { Button } from '@astryxdesign/core/Button';
import { Icon } from '@astryxdesign/core/Icon';
import type { IconType } from 'react-icons';
import { FiBell, FiCalendar, FiCheckSquare, FiEdit3, FiFileText, FiMessageCircle, FiUserPlus } from 'react-icons/fi';
import { fetchChatRooms, fetchMyUnreadNotifications, markMyNotificationsRead, type MyNotification } from '@/lib/apiService';
import { CHAT_VIEWING_EVENT, NOTIFICATIONS_REFRESH_EVENT, requestOpenChatRoom, viewingChatRoomIds } from '@/lib/alertBus';
import { useDirectoryPerson } from '@/lib/memberDirectory';
import { actorRefOf } from '@/lib/notificationActor';
import { buildNotificationCards, type NotificationCard, type NotificationTarget } from '@/lib/notificationGroups';
import { useVisiblePolling } from '@/lib/useVisiblePolling';
import { requestOpenWorkTask } from '@/lib/workTasks';

/** 앞에 펼쳐 보이는 카드 수 — 나머지는 뒤에 겹쳐 두고, 앞 카드를 확인하면 올라온다 */
const MAX_VISIBLE = 3;
/** 탭 제목 앞에 붙인 확인 안 한 수 "(2) " */
const TITLE_COUNT = /^\(\d+\+?\)\s/;
/** 새 채팅은 말풍선·패널이 신호를 주지만, 그 밖의 알림은 이 주기로 받는다 */
const POLL_MS = 30_000;
/** 채팅방 이름은 자주 바뀌지 않는다 — 카드에 방 이름을 적으려고 받은 목록을 잠시 쓴다 */
const ROOM_NAMES_TTL_MS = 60_000;
/** 앱 알림(CarevToaster, 저장·실패 결과)과 다른 자리 — sonner는 toasterId로 둘을 가른다 */
const INBOX_TOASTER = 'carev-inbox';

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
export function whenText(createdAt: string, now: number = Date.now()): string {
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
 * 카드 왼쪽 얼굴 — 알림을 일으킨 사람(보낸 사람·기안자·신청자)의 사진, 오른쪽 아래에 알림 종류 표시.
 * 사람을 모르면(리마인더·옛 알림) 종류 아이콘만 그린다. 사진이 없는 사람은 이름 첫 글자.
 */
function InboxFace({ notification, target }: { notification: MyNotification; target: NotificationTarget | null }) {
  const person = useDirectoryPerson(actorRefOf(notification) ?? {});
  const icon = iconOf(target);
  if (!person) {
    return (
      <span className="carev-inbox-face carev-inbox-face--icon" aria-hidden="true">
        <Icon icon={icon} size="sm" />
      </span>
    );
  }
  return (
    <span className="carev-inbox-face" aria-hidden="true">
      <Avatar key={person.imageUrl ?? 'none'} name={person.name} src={person.imageUrl ?? undefined} size={36} />
      <span className="carev-inbox-kind"><Icon icon={icon} size="xsm" /></span>
    </span>
  );
}

interface CardView {
  card: NotificationCard;
  title: string;
  body: string;
  meta: string;
  canOpen: boolean;
  /** 맨 앞 카드에만 — "알림 5개 · 모두 확인" */
  total: number | null;
}

function InboxCard({
  view,
  onOpen,
  onConfirm,
  onConfirmAll,
}: {
  view: CardView;
  onOpen: () => void;
  onConfirm: () => void;
  onConfirmAll: () => void;
}) {
  const { card, title, body, meta, canOpen, total } = view;
  const titleId = `inbox-title-${card.key}`;
  return (
    <article className="carev-inbox-card" aria-labelledby={titleId}>
      {total != null && (
        <div className="carev-inbox-summary">
          <span>확인 안 한 알림 <b>{total}</b>개</span>
          <button type="button" className="carev-inbox-link" onClick={onConfirmAll}>모두 확인</button>
        </div>
      )}
      <div className="carev-inbox-main">
        <InboxFace notification={card.latest} target={card.target} />
        <div className="carev-inbox-text">
          <div className="carev-inbox-titleline">
            <span id={titleId} className="carev-inbox-title">{title}</span>
            <time className="carev-inbox-when" dateTime={card.latest.createdAt}>{meta}</time>
          </div>
          <p className="carev-inbox-body">{body}</p>
          <div className="carev-inbox-actions">
            {canOpen && <Button label="열기" size="sm" variant="ghost" onClick={onOpen} />}
            <Button label="확인" size="sm" variant="secondary" onClick={onConfirm} />
          </div>
        </div>
      </div>
    </article>
  );
}

/**
 * 확인할 때까지 떠 있는 알림 — 원장 요청(2026-10-22):
 * "웹에서 알람 뜰 때 사람이 확인하기 전까지 우측 상단에 팝업처럼 떠 있어야",
 * "채팅·근무조정·일정 등록·결재·업무진행도 등 새로운 내용이 생기면 모두 뜨게 — 지금은 중구난방".
 *
 * 서버 알림함의 '확인 안 한' 알림만 카드로 쌓는다. 채팅은 방마다 카드 하나로 묶고, 그 방을 읽으면 내려간다.
 *
 * 2026-11-18: 사용자 "알림에도 관련된 직원 사진을, 더 세련된 라이브러리로" — 카드 왼쪽에 알림을 일으킨 사람
 * 사진(서버 actorId), 카드는 sonner(이미 쓰는 알림 라이브러리)로 겹쳐 쌓고 마우스를 올리면 펼친다.
 * 오른쪽으로 밀어 내리면 '확인'과 같다.
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

  // 카드 단추가 늘 지금 값을 보게 — sonner 카드는 띄울 때 그린 함수를 들고 있다
  const handlersRef = useRef({ targets, onOpen, confirm, cards });
  handlersRef.current = { targets, onOpen, confirm, cards };

  /** 화면에 올린 카드 key → 확인하면 읽음으로 바꿀 id들 */
  const shownRef = useRef<Map<string, number[]>>(new Map());
  /** 코드가 내린 카드 — sonner가 onDismiss를 불러도 '확인'으로 치지 않는다 */
  const quietRef = useRef<Set<string>>(new Set());

  const dismissQuietly = useCallback((key: string) => {
    quietRef.current.add(key);
    shownRef.current.delete(key);
    toast.dismiss(key);
  }, []);

  const confirmCard = useCallback((key: string) => {
    const ids = shownRef.current.get(key) ?? [];
    dismissQuietly(key);
    void handlersRef.current.confirm(ids);
  }, [dismissQuietly]);

  const confirmAll = useCallback(() => {
    const all = handlersRef.current.cards;
    all.forEach((c) => dismissQuietly(c.key));
    void handlersRef.current.confirm(all.flatMap((c) => c.ids));
  }, [dismissQuietly]);

  const openCard = useCallback((key: string) => {
    const { cards: current, onOpen: open } = handlersRef.current;
    const card = current.find((c) => c.key === key);
    if (!card?.target) return;
    // 셸이 먼저 화면을 옮기고(채팅 탭이면 대시보드로 등), 업무·채팅은 패널·말풍선이 그 창을 연다
    open?.(card.target, card.latest);
    if (card.target === 'work_task') requestOpenWorkTask(card.latest.relatedEntityId);
    if (card.target === 'chat' && card.roomId != null) requestOpenChatRoom(card.roomId);
    confirmCard(key);
  }, [confirmCard]);

  // 서버 목록 → sonner 카드. 오래된 것부터 올려 가장 새 알림이 맨 앞에 온다. 같은 key는 그 자리에서 고쳐 그린다.
  useEffect(() => {
    const now = Date.now();
    const nextKeys = new Set(cards.map((c) => c.key));
    for (const key of Array.from(shownRef.current.keys())) {
      if (!nextKeys.has(key)) dismissQuietly(key);
    }
    const canOpen = (card: NotificationCard) =>
      card.target === 'work_task' || card.target === 'chat' || (card.target != null && targets.includes(card.target));

    [...cards].reverse().forEach((card) => {
      const n = card.latest;
      const isChat = card.target === 'chat';
      const view: CardView = {
        card,
        title: isChat ? (card.roomId != null ? roomNames.get(card.roomId) : null) ?? '새 메시지' : n.title,
        body: isChat ? `${n.title}: ${n.message}` : n.message,
        meta: `${whenText(n.createdAt, now)}${card.count > 1 ? ` · ${card.count}개` : ''}`,
        canOpen: canOpen(card),
        total: card === cards[0] && cards.length > 1 ? cards.length : null,
      };
      shownRef.current.set(card.key, card.ids);
      quietRef.current.delete(card.key);
      toast.custom(
        () => (
          <InboxCard
            view={view}
            onOpen={() => openCard(card.key)}
            onConfirm={() => confirmCard(card.key)}
            onConfirmAll={confirmAll}
          />
        ),
        {
          id: card.key,
          toasterId: INBOX_TOASTER,
          duration: Infinity,
          // 밀어서 내리면 '확인'과 같다. 코드가 내린 카드(읽음이 된 채팅 등)는 다시 확인하지 않는다
          onDismiss: () => {
            if (quietRef.current.delete(card.key)) return;
            const ids = shownRef.current.get(card.key) ?? card.ids;
            shownRef.current.delete(card.key);
            void handlersRef.current.confirm(ids);
          },
        },
      );
    });
  }, [cards, roomNames, targets, confirmCard, confirmAll, openCard, dismissQuietly]);

  // 화면을 떠나면 카드도 걷는다
  useEffect(() => () => {
    for (const key of Array.from(shownRef.current.keys())) {
      quietRef.current.add(key);
      toast.dismiss(key);
    }
    shownRef.current.clear();
  }, []);

  return (
    <Toaster
      id={INBOX_TOASTER}
      className="carev-inbox"
      position="top-right"
      visibleToasts={MAX_VISIBLE}
      // 겹친 뒤 카드가 앞 카드 아래로 보이는 폭(=펼쳤을 때 카드 사이) — 8이면 뒤 카드가 4px만 비쳐 겹친 줄 모른다
      gap={14}
      offset={{ top: 52, right: 16 }}
      mobileOffset={{ top: 64, left: 12, right: 12 }}
      hotkey={[]}
      containerAriaLabel="확인하지 않은 알림"
      swipeDirections={['right']}
      style={{ '--width': '360px' } as React.CSSProperties}
    />
  );
}
