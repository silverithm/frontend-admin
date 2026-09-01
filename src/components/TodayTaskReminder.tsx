'use client';

/**
 * 오늘 일정 미수행 알림.
 *
 * 내가 담당자로 지정된 오늘 일정이 아직 수행완료가 아니면 화면 가운데 알림창으로 띄운다.
 * 우측 아래 토스트로 두면 화면 구석이라 그냥 지나치기 쉬워, 접속 시 오늘 일정 안내와
 * 같은 모달로 통일했다.
 * 닫아도 한 시간 뒤에 다시 올라온다 — 하루가 끝나기 전에 체크를 받아내는 게 목적이라
 * 한 번 닫으면 끝나는 안내로는 역할을 못 한다.
 *
 * 앱 푸시는 서버가 보내야 하므로 여기서는 다루지 않는다(웹 화면 알림 전용).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import { Button } from '@astryxdesign/core/Button';
import { Text } from '@astryxdesign/core/Text';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { getSchedules, updateScheduleCompletion } from '@/lib/apiService';
import { Schedule } from '@/types/schedule';

/** 닫은 뒤 다시 띄우기까지의 간격 */
const SNOOZE_MS = 60 * 60 * 1000;
/** 일정 목록 재조회 간격 — 다른 화면에서 수행완료했을 수 있다 */
const REFRESH_MS = 10 * 60 * 1000;
/** 스누즈가 풀렸는지 확인하는 주기 */
const TICK_MS = 60 * 1000;

const SNOOZE_KEY = 'todayScheduleReminderSnoozedUntil';

interface TodayTaskReminderProps {
  /** "확인하러 가기"를 누르면 일정 화면으로 보낸다 */
  onOpenSchedule?: () => void;
}

export default function TodayTaskReminder({ onOpenSchedule }: TodayTaskReminderProps) {
  const [pending, setPending] = useState<Schedule[]>([]);
  const [isSnoozed, setIsSnoozed] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const memberIdRef = useRef<number | null>(null);

  /** 스누즈가 끝났는지 확인해 표시 여부를 정한다. */
  const refreshSnooze = useCallback(() => {
    try {
      const until = Number(localStorage.getItem(SNOOZE_KEY) || 0);
      setIsSnoozed(Number.isFinite(until) && until > Date.now());
    } catch {
      setIsSnoozed(false);
    }
  }, []);

  const loadPending = useCallback(async () => {
    const memberId = memberIdRef.current;
    if (memberId == null) return;
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const data = await getSchedules(today, today);
      // 백엔드 응답은 래퍼 객체로 온다 — 배열을 직접 상태에 넣지 않는다.
      const list: Schedule[] = Array.isArray(data) ? data : data.schedules || [];
      setPending(
        list.filter((s) => (
          s.managerId != null
          // managerType이 MEMBER일 때만 managerId가 members.id 공간이다 — ADMIN이면
          // app_user.id라 로그인한 직원의 memberId와 우연히 겹칠 수 있다(V1.88 사고 참고).
          && (s.managerType || 'MEMBER') === 'MEMBER'
          && Number(s.managerId) === memberId
          && !s.isCompleted
        )),
      );
    } catch (error) {
      // 알림은 부가 기능이라 실패해도 화면을 방해하지 않는다.
      console.error('오늘 일정 확인 실패:', error);
    }
  }, []);

  useEffect(() => {
    // 직원 로그인 시 userId에 member id가 저장된다 (담당자 매칭용)
    const stored = Number(localStorage.getItem('userId'));
    memberIdRef.current = Number.isFinite(stored) && stored > 0 ? stored : null;
    if (memberIdRef.current == null) return;

    refreshSnooze();
    loadPending();

    const refreshTimer = setInterval(loadPending, REFRESH_MS);
    const tickTimer = setInterval(refreshSnooze, TICK_MS);
    return () => {
      clearInterval(refreshTimer);
      clearInterval(tickTimer);
    };
  }, [loadPending, refreshSnooze]);

  const snooze = () => {
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
    } catch {
      // 저장이 막히면 이번 화면에서만 숨긴다.
    }
    setIsSnoozed(true);
  };

  const complete = async (schedule: Schedule) => {
    setBusyId(schedule.id);
    try {
      await updateScheduleCompletion(schedule.id, true);
      setPending((prev) => prev.filter((s) => s.id !== schedule.id));
    } catch (error) {
      console.error('수행완료 처리 실패:', error);
    } finally {
      setBusyId(null);
    }
  };

  const visible = !isSnoozed && pending.length > 0;

  return (
    <Dialog
      isOpen={visible}
      onOpenChange={(open) => { if (!open) snooze(); }}
      purpose="info"
      width={440}
    >
      <Layout
        header={
          <DialogHeader
            title="아직 수행 체크가 안 된 일정"
            onOpenChange={(open) => { if (!open) snooze(); }}
          />
        }
        content={
          <LayoutContent>
            <VStack gap={3}>
              <Text type="supporting" color="secondary">
                오늘 담당하신 일정 {pending.length}건이 아직 완료 처리되지 않았습니다.
              </Text>
              <VStack gap={2}>
                {/* 목록이 길어도 알림창이 화면을 넘지 않게 앞의 몇 건만 보여준다 */}
                {pending.slice(0, 5).map((schedule) => (
                  <HStack key={schedule.id} gap={2} vAlign="center">
                    <Text type="supporting" color="secondary" hasTabularNumbers>
                      {schedule.isAllDay ? '종일' : (schedule.startTime || '').slice(0, 5) || '-'}
                    </Text>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text as="p" type="body" weight="medium" color="primary" maxLines={1}>
                        {schedule.title}
                      </Text>
                    </div>
                    <Button
                      label="수행완료"
                      variant="secondary"
                      size="sm"
                      isLoading={busyId === schedule.id}
                      onClick={() => complete(schedule)}
                    />
                  </HStack>
                ))}
                {pending.length > 5 && (
                  <Text type="supporting" color="secondary">외 {pending.length - 5}건</Text>
                )}
              </VStack>
            </VStack>
          </LayoutContent>
        }
        footer={
          <LayoutFooter hasDivider>
            <HStack gap={2} hAlign="end">
              <Button label="한 시간 뒤에" variant="ghost" onClick={snooze} />
              {onOpenSchedule && (
                <Button
                  label="일정에서 보기"
                  variant="primary"
                  onClick={() => {
                    snooze();
                    onOpenSchedule();
                  }}
                />
              )}
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  );
}
