'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@astryxdesign/core/Button';
import { Icon } from '@astryxdesign/core/Icon';
import { Text } from '@astryxdesign/core/Text';
import type { IconType } from 'react-icons';
import { FiBell, FiCalendar, FiCheckSquare, FiEdit3, FiFileText, FiUserPlus } from 'react-icons/fi';
import { fetchMyUnreadNotifications, markMyNotificationsRead, type MyNotification } from '@/lib/apiService';
import { useVisiblePolling } from '@/lib/useVisiblePolling';
import { requestOpenWorkTask } from '@/lib/workTasks';
import { duration } from '@/theme/motion';

/** 한 번에 띄우는 카드 수 — 나머지는 "외 n건"으로 접는다 */
const MAX_VISIBLE = 3;
/** 탭 제목 앞에 붙인 확인 안 한 수 "(2) " */
const TITLE_COUNT = /^\(\d+\+?\)\s/;

interface Props {
  /**
   * '열기'를 눌렀을 때 그 알림의 화면으로 보낸다. 보낼 곳이 있으면 true.
   * 업무진행도 알림은 화면을 옮긴 뒤 오른쪽 패널이 그 업무 창을 연다.
   */
  onOpen?: (notification: MyNotification) => boolean;
  /** 이 종류는 '열기' 단추를 단다 — 셸마다 갈 수 있는 화면이 다르다 */
  openableTypes?: string[];
}

function iconOf(type: string | null): IconType {
  if (type === 'WORK_TASK') return FiCheckSquare;
  if (type === 'APPROVAL') return FiFileText;
  if (type?.startsWith('VACATION')) return FiCalendar;
  if (type?.startsWith('MEMBER_JOIN')) return FiUserPlus;
  if (type === 'MEETING_MINUTES') return FiEdit3;
  return FiBell;
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
 * 확인할 때까지 떠 있는 알림 — "웹에서 알람 뜰 때 사람이 확인하기 전까지 우측 상단이든
 * 좀 직관적으로 더 잘 보이게, 팝업처럼 떠 있어야"(2026-10-22 원장 요청).
 *
 * 몇 초 뒤 사라지는 안내(토스트)는 자리를 비운 사이 온 알림을 놓친다. 그래서 서버 알림함의 '확인 안 한'
 * 알림을 오른쪽 위에 카드로 쌓고, 확인을 눌러야 내려간다. 앱에서 이미 확인한 알림은 뜨지 않는다.
 * 채팅은 빠진다(말풍선 배지가 따로 있다).
 */
export default function NotificationPopups({ onOpen, openableTypes = [] }: Props) {
  const [items, setItems] = useState<MyNotification[]>([]);
  /**
   * 이 화면에서 확인을 누른 알림. 확인 직전에 출발한 목록 요청이 늦게 돌아오면 방금 내린 카드를
   * 되살린다(실제로 겪었다) — 그래서 받은 목록에서도 늘 뺀다.
   */
  const confirmedRef = useRef<Set<number>>(new Set());

  const load = useCallback(async () => {
    try {
      const list = await fetchMyUnreadNotifications(3);
      setItems(list.filter((n) => !confirmedRef.current.has(n.id)));
    } catch (error) {
      // 알림을 못 받았다고 화면을 막지는 않는다 — 다음 주기에 다시 받는다
      console.warn('[NotificationPopups] 알림을 받지 못했습니다:', error);
    }
  }, []);

  useVisiblePolling(load, 60_000);

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

  // 다른 탭을 보고 있어도 알 수 있게 탭 제목 앞에 확인 안 한 수를 붙인다 — "(2) 케어브이 …"
  useEffect(() => {
    const base = document.title.replace(TITLE_COUNT, '');
    document.title = items.length > 0 ? `(${items.length > 99 ? '99+' : items.length}) ${base}` : base;
  }, [items.length]);
  useEffect(() => () => {
    document.title = document.title.replace(TITLE_COUNT, '');
  }, []);

  const open = (n: MyNotification) => {
    // 셸이 먼저 화면을 옮기고(채팅 탭이면 대시보드로), 업무는 오른쪽 패널이 그 업무 창을 연다
    onOpen?.(n);
    if (n.type === 'WORK_TASK') requestOpenWorkTask(n.relatedEntityId);
    void confirm([n.id]);
  };

  const visible = items.slice(0, MAX_VISIBLE);
  const hidden = items.length - visible.length;
  if (items.length === 0) return null;

  return (
    <section className="carev-npop" aria-label="확인하지 않은 알림">
      <AnimatePresence initial={false}>
        {visible.map((n) => {
          const canOpen = n.type === 'WORK_TASK' || (n.type != null && openableTypes.includes(n.type));
          return (
            <motion.article
              key={n.id}
              layout
              className="carev-npop-card"
              aria-labelledby={`npop-title-${n.id}`}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: duration.fast, ease: 'easeOut' }}
            >
              <div className="carev-npop-head">
                <span className={`carev-npop-icon${n.type === 'WORK_TASK' ? ' carev-npop-icon-task' : ''}`} aria-hidden="true">
                  <Icon icon={iconOf(n.type)} size="sm" />
                </span>
                <div className="carev-npop-titles">
                  <Text type="label" weight="semibold" id={`npop-title-${n.id}`}>{n.title}</Text>
                  <Text type="supporting" color="secondary">{whenText(n.createdAt)}</Text>
                </div>
              </div>
              <p className="carev-npop-body">{n.message}</p>
              <div className="carev-npop-actions">
                {canOpen && <Button label="열기" size="sm" variant="ghost" onClick={() => open(n)} />}
                <Button label="확인" size="sm" variant="primary" onClick={() => void confirm([n.id])} />
              </div>
            </motion.article>
          );
        })}
      </AnimatePresence>
      {hidden > 0 && (
        <div className="carev-npop-more">
          <Text type="supporting" color="secondary">외 {hidden}건 더 있습니다</Text>
          <Button label="모두 확인" size="sm" variant="secondary" onClick={() => void confirm(items.map((n) => n.id))} />
        </div>
      )}
    </section>
  );
}
