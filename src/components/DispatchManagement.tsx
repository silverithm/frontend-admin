"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@astryxdesign/core/Card";
import { Button } from "@astryxdesign/core/Button";
import { Banner } from "@astryxdesign/core/Banner";
import { VStack, HStack, StackItem } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Icon } from "@astryxdesign/core/Icon";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Loading } from "@/components/Loading";
import { IconCalendar, IconList, IconUsers, IconSettings } from "@tabler/icons-react";
import { useDispatchStore } from "@/lib/dispatchStore";
import { loadDispatchSettings, startDispatchAutoSave } from "@/lib/dispatchSync";
import type { DailyDispatch, DispatchDaySummary } from "@/types/dispatch";
import type { VacationRequest } from "@/types/vacation";
import { getDailyDispatch, getMonthlyDispatchSummary } from "@/lib/dispatchAlgorithm";
import { getAllVacationRequests } from "@/lib/apiService";
import DispatchCalendar from "./DispatchCalendar";
import DispatchListView from "./DispatchListView";
import DispatchDayDetail from "./DispatchDayDetail";
import DispatchSettings from "./DispatchSettings";
import SeniorAbsenceManagement from "./SeniorAbsenceManagement";
import { duration } from '@/theme/motion';

interface DispatchManagementProps {
  onNotification: (message: string, type: "success" | "error" | "info") => void;
}

type SubTab = "calendar" | "list" | "absence";

export default function DispatchManagement({ onNotification }: DispatchManagementProps) {
  // Zustand 스토어
  const { settings, seniorAbsences, isHydrated } = useDispatchStore();

  // 로컬 상태
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("calendar");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDayDetail, setShowDayDetail] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [monthlySummary, setMonthlySummary] = useState<Map<string, DispatchDaySummary>>(new Map());
  const [vacations, setVacations] = useState<VacationRequest[]>([]);

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

  // 월간 요약 정보 계산 (일요일 = 휴일, 나머지 = 정상 운행)
  useEffect(() => {
    if (isHydrated && settings.routes.length > 0) {
      // 직원 실명이 담긴 디버그 로그였어서 제거
      const summary = getMonthlyDispatchSummary(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        settings,
        vacations,
        seniorAbsences
      );
      setMonthlySummary(summary);
    }
  }, [currentDate, settings, vacations, seniorAbsences, isHydrated]);

  // 날짜 선택 핸들러
  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setShowDayDetail(true);
  };

  // 일일 배차 정보 가져오기
  const getSelectedDayDispatch = (): DailyDispatch | null => {
    if (!selectedDate) return null;
    return getDailyDispatch(selectedDate, settings, vacations, seniorAbsences);
  };

  // 설정이 비어있는지 확인
  const isSettingsEmpty = settings.routes.length === 0;

  if (!isHydrated) {
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
                value="absence"
                label="결석 관리"
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

          {/* 통계 요약 */}
          <HStack gap={4}>
            <StackItem size="fill">
              <div style={{ width: '100%', background: 'var(--color-background-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-container)', padding: 'var(--spacing-4)' }}>
                <VStack gap={1} hAlign="center">
                  <Text type="display-3" weight="bold">{settings.routes.length}</Text>
                  <Text type="supporting">노선</Text>
                </VStack>
              </div>
            </StackItem>
            <StackItem size="fill">
              <div style={{ width: '100%', background: 'var(--color-background-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-container)', padding: 'var(--spacing-4)' }}>
                <VStack gap={1} hAlign="center">
                  <Text type="display-3" weight="bold">{settings.seniors.length}</Text>
                  <Text type="supporting">어르신</Text>
                </VStack>
              </div>
            </StackItem>
          </HStack>
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
                seniorAbsences={seniorAbsences}
              />
            </motion.div>
          )}

          {activeSubTab === "absence" && (
            <motion.div
              key="absence"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: duration.fast }}
            >
              <SeniorAbsenceManagement />
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
