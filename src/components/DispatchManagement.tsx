"use client";

import { useState, useEffect, useCallback } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@astryxdesign/core/Card";
import { StatRow, StatTile } from './StatTile';
import { Button } from "@astryxdesign/core/Button";
import { Banner } from "@astryxdesign/core/Banner";
import { VStack, HStack } from "@astryxdesign/core/Stack";
import { Icon } from "@astryxdesign/core/Icon";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Loading } from "@/components/Loading";
import { IconCalendar, IconList, IconUsers, IconSettings, IconClipboardList } from "@tabler/icons-react";
import { useDispatchStore } from "@/lib/dispatchStore";
import { useElderAttendanceStore, migrateLegacyAbsences } from "@/lib/elderAttendanceStore";
import { loadDispatchSettings, startDispatchAutoSave } from "@/lib/dispatchSync";
import type { DailyDispatch, DispatchAssignmentOverride, DispatchDaySummary } from "@/types/dispatch";
import type { VacationRequest } from "@/types/vacation";
import { getDailyDispatch, getMonthlyDispatchSummary } from "@/lib/dispatchAlgorithm";
import { getAllVacationRequests, getDispatchOverrides, saveDispatchOverrides } from "@/lib/apiService";
import DispatchCalendar from "./DispatchCalendar";
import DispatchListView from "./DispatchListView";
import DispatchDayDetail from "./DispatchDayDetail";
import DispatchSettings from "./DispatchSettings";
import DispatchBoard from "./DispatchBoard";
import ElderAttendanceManagement from "./ElderAttendanceManagement";
import { duration } from '@/theme/motion';

interface DispatchManagementProps {
  onNotification: (message: string, type: "success" | "error" | "info") => void;
}

type SubTab = "board" | "calendar" | "list" | "attendance";

export default function DispatchManagement({ onNotification }: DispatchManagementProps) {
  // Zustand 스토어
  const { settings, seniorAbsences, isHydrated } = useDispatchStore();
  // 출결은 백엔드 elder_attendance가 원본이다 ([[elderAttendanceStore]])
  const { records: attendances, loadRange } = useElderAttendanceStore();

  // 로컬 상태
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("board");
  // 배차표와 출결관리가 같은 날짜를 본다 (탭을 옮길 때마다 다시 고르지 않도록)
  const [boardDate, setBoardDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDayDetail, setShowDayDetail] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [monthlySummary, setMonthlySummary] = useState<Map<string, DispatchDaySummary>>(new Map());
  const [vacations, setVacations] = useState<VacationRequest[]>([]);
  /**
   * 배차표에서 손으로 고친 그날치 배치.
   *
   * 노선 설정은 건드리지 않는다 — 오늘 저 차로 옮긴 것이 내일까지 따라가면
   * 며칠 뒤 아무도 이유를 모르는 배차가 된다.
   */
  const [boardOverrides, setBoardOverrides] = useState<DispatchAssignmentOverride[]>([]);

  /** 복원 신호가 3초 안에 안 오면 그냥 연다 — 로딩 화면에 갇히는 것보다 낫다 */
  const [hydrationTimedOut, setHydrationTimedOut] = useState(false);
  useEffect(() => {
    if (isHydrated) return;
    const timer = setTimeout(() => {
      console.error('[배차] 저장된 설정 복원이 3초 안에 끝나지 않았다 — 기본값으로 연다');
      setHydrationTimedOut(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, [isHydrated]);

  // 휴무 데이터 가져오기
  const fetchVacations = useCallback(async () => {
    try {
      const response = await getAllVacationRequests();

      // 응답 형식: { requests: [...] }
      if (response.requests && Array.isArray(response.requests)) {
        // 직원 실명·휴무 데이터가 콘솔에 노출되는 디버그 로그였어서 제거
        setVacations(response.requests);
      } else if (Array.isArray(response.data)) {
        setVacations(response.data);
      } else if (Array.isArray(response)) {
        setVacations(response);
      }
    } catch (error) {
      console.error("휴무 데이터 로드 실패:", error);
    }
  }, []);

  // 초기 데이터 로드
  useEffect(() => {
    fetchVacations();
  }, [fetchVacations]);

  // 배차 설정은 서버가 원본이다. 진입 시 불러오고, 이후 변경분은 자동 저장한다.
  // (예전에는 이 브라우저 localStorage에만 있어서 다른 기기·직원 앱에서 볼 수 없었다)
  useEffect(() => {
    loadDispatchSettings();
    return startDispatchAutoSave();
  }, []);

  // 보고 있는 달의 출결을 한 번에 받는다 (날짜별로 부르면 30번 왕복한다)
  useEffect(() => {
    const first = startOfMonth(currentDate);
    const last = endOfMonth(currentDate);
    loadRange(format(first, "yyyy-MM-dd"), format(last, "yyyy-MM-dd"));
  }, [currentDate, loadRange]);

  // 배차설정 JSON에 남아 있던 옛 결석을 백엔드 출결로 한 번만 옮긴다
  useEffect(() => {
    if (!isHydrated) return;
    migrateLegacyAbsences(seniorAbsences, settings.seniors);
  }, [isHydrated, seniorAbsences, settings.seniors]);

  // 월간 요약 정보 계산 (일요일 = 휴일, 나머지 = 정상 운행)
  useEffect(() => {
    if (isHydrated && settings.routes.length > 0) {
      // 직원 실명이 담긴 디버그 로그였어서 제거
      const summary = getMonthlyDispatchSummary(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        settings,
        vacations,
        attendances
      );
      setMonthlySummary(summary);
    }
  }, [currentDate, settings, vacations, attendances, isHydrated]);

  /** 보고 있는 날의 수정본을 받아온다 (없으면 빈 배열 = 설정대로) */
  const fetchOverrides = useCallback(async (date: string) => {
    try {
      const response = await getDispatchOverrides(date);
      const list = Array.isArray(response)
        ? response
        : (response?.assignments || response?.data || []);
      setBoardOverrides(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error("배차 수정본 조회 실패:", error);
      // 수정본을 못 받아도 배차표는 설정대로 그려져야 한다
      setBoardOverrides([]);
    }
  }, []);

  useEffect(() => {
    fetchOverrides(boardDate);
  }, [boardDate, fetchOverrides]);

  /**
   * 옮긴 결과를 저장한다. 화면은 먼저 바꾸고(끌어놓자마자 움직여야 한다)
   * 저장이 실패하면 서버 값으로 되돌린다 — 저장되지 않은 배차를 붙잡고 있으면 안 된다.
   */
  const handleOverridesChange = async (next: DispatchAssignmentOverride[]) => {
    const previous = boardOverrides;
    setBoardOverrides(next);
    try {
      await saveDispatchOverrides(boardDate, next);
      if (next.length === 0) onNotification("오늘 배차를 설정대로 되돌렸습니다.", "success");
    } catch (error) {
      console.error("배차 수정본 저장 실패:", error);
      setBoardOverrides(previous);
      onNotification("배차 수정을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.", "error");
    }
  };

  // 날짜 선택 핸들러
  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setShowDayDetail(true);
  };

  // 일일 배차 정보 가져오기
  const getSelectedDayDispatch = (): DailyDispatch | null => {
    if (!selectedDate) return null;
    return getDailyDispatch(selectedDate, settings, vacations, attendances);
  };

  // 설정이 비어있는지 확인
  const isSettingsEmpty = settings.routes.length === 0;

  // 저장된 설정을 읽는 건 순간이면 끝난다. 그보다 오래 걸리면 무언가 잘못된 것이고,
  // 그때 화면을 계속 붙잡고 있으면 배차관리가 영영 안 열린다 — 설정은 어차피 서버에서 받는다.
  if (!isHydrated && !hydrationTimedOut) {
    return (
      <Loading label="배차 정보를 불러오는 중..." />
    );
  }

  return (
    <VStack gap={5}>
      {/* 서브탭 네비게이션 */}
      <Card padding={5}>
        <VStack gap={4}>
          <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
            <SegmentedControl
              value={activeSubTab}
              onChange={(value) => setActiveSubTab(value as SubTab)}
              label="배차 관리 뷰"
            >
              <SegmentedControlItem
                value="board"
                label="배차표"
                icon={<Icon icon={IconClipboardList} size="sm" />}
              />
              <SegmentedControlItem
                value="calendar"
                label="캘린더 뷰"
                icon={<Icon icon={IconCalendar} size="sm" />}
              />
              <SegmentedControlItem
                value="list"
                label="리스트 뷰"
                icon={<Icon icon={IconList} size="sm" />}
              />
              <SegmentedControlItem
                value="attendance"
                label="출결 관리"
                icon={<Icon icon={IconUsers} size="sm" />}
              />
            </SegmentedControl>

            <Button
              label="배차 설정"
              variant="secondary"
              onClick={() => setShowSettings(true)}
              icon={<Icon icon={IconSettings} size="sm" />}
            />
          </HStack>

          {/* 통계 요약 — 카드 대신 맨 div에 배경·테두리를 직접 적어 두던 자리다.
              같은 숫자 줄이 배차 목록·대시보드에도 있어 규격을 하나로 모았다. */}
          <StatRow>
            <StatTile value={settings.routes.length} label="노선" />
            <StatTile value={settings.seniors.length} label="어르신" />
          </StatRow>
        </VStack>
      </Card>

      {/* 설정이 비어있을 때 안내 메시지 */}
      {isSettingsEmpty && (
        <Banner
          status="warning"
          title="배차 설정이 필요합니다"
          description="배차 시스템을 사용하려면 먼저 노선, 직원 정보를 등록해주세요."
          endContent={
            <Button
              label="설정하러 가기"
              variant="primary"
              size="sm"
              onClick={() => setShowSettings(true)}
            />
          }
        />
      )}

      {/* 메인 컨텐츠 */}
      {!isSettingsEmpty && (
        <AnimatePresence mode="wait">
          {activeSubTab === "board" && (
            <motion.div
              key="board"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: duration.fast }}
            >
              <DispatchBoard
                settings={settings}
                vacations={vacations}
                attendances={attendances}
                onNotification={onNotification}
                overrides={boardOverrides}
                onOverridesChange={handleOverridesChange}
                date={boardDate}
                onDateChange={(d) => {
                  setBoardDate(d);
                  loadRange(d, d);
                }}
              />
            </motion.div>
          )}

          {activeSubTab === "calendar" && (
            <motion.div
              key="calendar"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: duration.fast }}
            >
              <DispatchCalendar
                currentDate={currentDate}
                setCurrentDate={setCurrentDate}
                monthlySummary={monthlySummary}
                onDateSelect={handleDateSelect}
              />
            </motion.div>
          )}

          {activeSubTab === "list" && (
            <motion.div
              key="list"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: duration.fast }}
            >
              <DispatchListView
                settings={settings}
                vacations={vacations}
                attendances={attendances}
              />
            </motion.div>
          )}

          {activeSubTab === "attendance" && (
            <motion.div
              key="attendance"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: duration.fast }}
            >
              <ElderAttendanceManagement
                onNotification={onNotification}
                date={boardDate}
                onDateChange={setBoardDate}
              />
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* 일일 배차 상세 모달 */}
      <AnimatePresence>
        {showDayDetail && selectedDate && (
          <DispatchDayDetail
            dispatch={getSelectedDayDispatch()}
            onClose={() => {
              setShowDayDetail(false);
              setSelectedDate(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* 설정 모달 */}
      <AnimatePresence>
        {showSettings && (
          <DispatchSettings
            isOpen={showSettings}
            onClose={() => setShowSettings(false)}
            onNotification={onNotification}
          />
        )}
      </AnimatePresence>
    </VStack>
  );
}
