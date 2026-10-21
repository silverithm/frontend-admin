'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Icon } from '@astryxdesign/core/Icon';
import { Text } from '@astryxdesign/core/Text';
import { FiCheckSquare, FiChevronDown, FiChevronRight, FiPlus } from 'react-icons/fi';
import { Loading } from '@/components/Loading';
import WorkTaskDialog from '@/components/WorkTask/WorkTaskDialog';
import { fetchWorkTasks } from '@/lib/apiService';
import type { DirectChatMember } from '@/lib/directChat';
import { useVisiblePolling } from '@/lib/useVisiblePolling';
import {
  IMPORTANCE_META,
  assigneeLabel,
  dueLabel,
  isDone,
  myInProgressCount,
  seoulToday,
  splitTasks,
  type WorkTask,
} from '@/lib/workTasks';

interface Props {
  meId: string | null;
  members: DirectChatMember[];
  isOpen: boolean;
  onToggle: () => void;
  /** 알림 팝업의 '열기'로 열어 달라는 업무 — 최신 목록을 받아 그 업무 창을 연다 */
  openTaskId: number | null;
  /** [openTaskId]를 처리했다(열었거나, 이미 지워져 없었다) */
  onOpenedTask: () => void;
  /** 내가 맡은 진행 중 업무 수 — 패널을 접었을 때 배지 */
  onMyCountChange?: (count: number) => void;
  hasDividerAbove?: boolean;
}

/**
 * 오른쪽 패널의 "업무진행도" 칸 — 원장 그림대로 대화방 자리에 들어간다.
 * 한 줄에 [중요도] 업무 내용 · 기한, 아랫줄에 담당자 이름 뒤 진행도 게이지(중요도 색).
 * 기관 전체가 같은 목록을 본다. 1분마다, 그리고 창을 닫을 때마다 다시 받는다.
 */
export default function WorkTaskSection({ meId, members, isOpen, onToggle, openTaskId, onOpenedTask, onMyCountChange, hasDividerAbove }: Props) {
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [showDone, setShowDone] = useState(false);
  const [dialog, setDialog] = useState<{ open: boolean; task: WorkTask | null }>({ open: false, task: null });

  const load = useCallback(async () => {
    try {
      setTasks(await fetchWorkTasks());
      setStatus('loaded');
    } catch (error) {
      console.error('[WorkTask] 목록을 받지 못했습니다:', error);
      setStatus((prev) => (prev === 'loaded' ? prev : 'error'));
    }
  }, []);

  useVisiblePolling(load, 60_000);

  const { inProgress, done } = useMemo(() => splitTasks(tasks), [tasks]);
  const today = seoulToday();

  useEffect(() => {
    if (status === 'loaded') onMyCountChange?.(myInProgressCount(tasks, meId));
  }, [tasks, meId, status, onMyCountChange]);

  // 알림 팝업의 '열기' — 최신 목록을 받아 그 업무 창을 연다(이미 지워졌으면 목록만 보여 준다)
  useEffect(() => {
    if (openTaskId == null) return;
    let cancelled = false;
    void (async () => {
      const latest = await fetchWorkTasks().catch(() => null);
      if (cancelled) return;
      if (latest) {
        setTasks(latest);
        setStatus('loaded');
      }
      const found = (latest ?? []).find((t) => t.id === openTaskId);
      if (found) setDialog({ open: true, task: found });
      onOpenedTask();
    })();
    return () => { cancelled = true; };
  }, [openTaskId, onOpenedTask]);

  const closeDialog = () => setDialog({ open: false, task: null });

  return (
    <>
      <div className={`carev-chat-rail-sechead-row${hasDividerAbove ? ' carev-chat-rail-sechead-divided' : ''}`}>
        <button type="button" onClick={onToggle} aria-expanded={isOpen} className="carev-chat-rail-sechead carev-chat-rail-sechead-flex">
          <Icon icon={isOpen ? FiChevronDown : FiChevronRight} size="sm" color="secondary" />
          <Text type="label" weight="semibold">업무진행도</Text>
          {status === 'loaded' && <Text type="supporting" color="secondary">{inProgress.length}</Text>}
        </button>
        <Button
          label="등록"
          size="sm"
          variant="secondary"
          icon={<Icon icon={FiPlus} size="sm" />}
          onClick={() => setDialog({ open: true, task: null })}
        />
      </div>

      {isOpen && (
        <div className="carev-chat-rail-section">
          {status === 'loading' ? (
            <Loading size="inline" height={72} label="업무를 불러오는 중..." />
          ) : status === 'error' ? (
            <div className="carev-chat-rail-notice">
              <Banner
                status="error"
                title="업무를 불러오지 못했습니다"
                endContent={<Button label="다시 시도" variant="secondary" size="sm" onClick={() => { setStatus('loading'); void load(); }} />}
              />
            </div>
          ) : tasks.length === 0 ? (
            <div className="carev-chat-rail-empty">
              <EmptyState
                isCompact
                icon={<Icon icon={FiCheckSquare} size="lg" color="tertiary" />}
                title="진행 중인 업무가 없습니다"
                description="등록을 눌러 담당자·기한·중요도를 정해 올려 주세요."
              />
            </div>
          ) : (
            <>
              {inProgress.length === 0 && (
                <div className="carev-wt-allclear">
                  <Text type="supporting" color="secondary">진행 중인 업무를 모두 끝냈습니다</Text>
                </div>
              )}
              <ul className="carev-wt-list" aria-label="진행 중인 업무">
                {inProgress.map((task) => (
                  <WorkTaskRow key={task.id} task={task} today={today} onOpen={() => setDialog({ open: true, task })} />
                ))}
              </ul>
              {done.length > 0 && (
                <>
                  <button type="button" className="carev-wt-done-toggle" aria-expanded={showDone} onClick={() => setShowDone((v) => !v)}>
                    <Icon icon={showDone ? FiChevronDown : FiChevronRight} size="sm" color="secondary" />
                    <Text type="supporting" color="secondary">끝낸 업무 {done.length}건</Text>
                  </button>
                  {showDone && (
                    <ul className="carev-wt-list" aria-label="끝낸 업무">
                      {done.map((task) => (
                        <WorkTaskRow key={task.id} task={task} today={today} onOpen={() => setDialog({ open: true, task })} />
                      ))}
                    </ul>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}

      <WorkTaskDialog
        isOpen={dialog.open}
        task={dialog.task}
        members={members}
        meId={meId}
        onClose={closeDialog}
        onSaved={() => { closeDialog(); void load(); }}
        onDeleted={() => { closeDialog(); void load(); }}
      />
    </>
  );
}

function WorkTaskRow({ task, today, onOpen }: { task: WorkTask; today: string; onOpen: () => void }) {
  const meta = IMPORTANCE_META[task.importance] ?? IMPORTANCE_META.NORMAL;
  const finished = isDone(task);
  const due = finished ? null : dueLabel(task.dueDate, today);
  const who = assigneeLabel(task.assignees);
  return (
    <li>
      <button
        type="button"
        className={`carev-wt-row${finished ? ' carev-wt-row-done' : ''}`}
        onClick={onOpen}
        aria-label={`${meta.label} · ${task.content} · ${who} · 진행 ${task.progress}%${due ? ` · ${due.text}` : ''}`}
      >
        <span className="carev-wt-line">
          <span className={`carev-wt-imp carev-wt-imp-${meta.tone}`}>{meta.label}</span>
          <span className="carev-wt-title">{task.content}</span>
          {due && <span className={`carev-wt-due carev-wt-due-${due.tone}`}>{due.text}</span>}
        </span>
        <span className="carev-wt-line">
          <span className="carev-wt-who">{who}</span>
          <span
            className="carev-wt-gauge"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={task.progress}
            aria-label="수행도"
          >
            <span
              className={`carev-wt-gauge-fill carev-wt-gauge-${finished ? 'done' : meta.tone}`}
              style={{ width: `${Math.max(0, Math.min(100, task.progress))}%` }}
            />
          </span>
          <span className="carev-wt-pct">{finished ? '완료' : `${task.progress}%`}</span>
        </span>
      </button>
    </li>
  );
}
