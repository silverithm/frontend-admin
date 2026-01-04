"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDispatchStore } from "@/lib/dispatchStore";
import type { DailyDispatch, DispatchDaySummary } from "@/types/dispatch";
import type { VacationRequest } from "@/types/vacation";
import { getDailyDispatch, getMonthlyDispatchSummary } from "@/lib/dispatchAlgorithm";
import { getAllVacationRequests } from "@/lib/apiService";
import DispatchCalendar from "./DispatchCalendar";
import DispatchListView from "./DispatchListView";
import DispatchDayDetail from "./DispatchDayDetail";
import DispatchSettings from "./DispatchSettings";
import SeniorAbsenceManagement from "./SeniorAbsenceManagement";

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
        console.log("휴무 데이터 개수:", response.requests.length);
        console.log("휴무자 샘플:", response.requests.slice(0, 5).map((v: VacationRequest) => ({ userName: v.userName, date: v.date })));
        setVacations(response.requests);
      } else if (response.data) {
        setVacations(response.data);
      } else if (Array.isArray(response)) {
        setVacations(response);
      } else {
        console.log("휴무 데이터 형식 불명:", response);
      }
    } catch (error) {
      console.error("휴무 데이터 로드 실패:", error);
    }
  }, []);

  // 초기 데이터 로드
  useEffect(() => {
    fetchVacations();
  }, [fetchVacations]);

  // 월간 요약 정보 계산 (일요일 = 휴일, 나머지 = 정상 운행)
  useEffect(() => {
    if (isHydrated && settings.routes.length > 0) {
      // 디버깅: 노선별 운전자 이름 확인
      console.log("노선별 운전자:", settings.routes.map(r => ({
        routeName: r.name,
        drivers: r.routeDrivers?.map(d => d.driverName)
      })));
      console.log("휴무 데이터 수:", vacations.length);

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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 서브탭 네비게이션 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex space-x-4">
            <button
              onClick={() => setActiveSubTab("calendar")}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                activeSubTab === "calendar"
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <span className="flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                캘린더 뷰
              </span>
            </button>
            <button
              onClick={() => setActiveSubTab("list")}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                activeSubTab === "list"
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <span className="flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                    d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                리스트 뷰
              </span>
            </button>
          </div>

          <div className="flex space-x-2">
            <button
              onClick={() => setShowSettings(true)}
              className="px-4 py-2 rounded-lg font-medium text-sm bg-gray-800 text-white hover:bg-gray-900 transition-all flex items-center"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              배차 설정
            </button>
            <button
              onClick={() => setActiveSubTab("absence")}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center ${
                activeSubTab === "absence"
                  ? "bg-red-600 text-white shadow-md"
                  : "bg-red-100 text-red-700 hover:bg-red-200"
              }`}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              결석 관리
            </button>
          </div>
        </div>

        {/* 통계 요약 */}
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-gray-800">{settings.routes.length}</div>
            <div className="text-xs text-gray-500">노선</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-gray-800">{settings.seniors.length}</div>
            <div className="text-xs text-gray-500">어르신</div>
          </div>
        </div>
      </div>

      {/* 설정이 비어있을 때 안내 메시지 */}
      {isSettingsEmpty && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <svg className="w-12 h-12 mx-auto text-yellow-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">배차 설정이 필요합니다</h3>
          <p className="text-yellow-700 mb-4">
            배차 시스템을 사용하려면 먼저 노선, 직원 정보를 등록해주세요.
          </p>
          <button
            onClick={() => setShowSettings(true)}
            className="px-6 py-2 bg-yellow-600 text-white rounded-lg font-medium hover:bg-yellow-700 transition-colors"
          >
            설정하러 가기
          </button>
        </div>
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
              transition={{ duration: 0.2 }}
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
              transition={{ duration: 0.2 }}
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
              transition={{ duration: 0.2 }}
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
    </div>
  );
}
