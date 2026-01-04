"use client";

import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths } from "date-fns";
import { ko } from "date-fns/locale";
import { useDispatchStore } from "@/lib/dispatchStore";
import type { Senior } from "@/types/dispatch";

export default function SeniorAbsenceManagement() {
  const {
    settings,
    seniorAbsences,
    addSeniorAbsence,
    removeSeniorAbsence,
  } = useDispatchStore();

  // 선택된 노선
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  // 선택된 어르신
  const [selectedSenior, setSelectedSenior] = useState<Senior | null>(null);
  // 캘린더 월
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  // 선택된 노선의 어르신 목록
  const routeSeniors = useMemo(() => {
    if (!selectedRouteId) return [];
    return settings.seniors
      .filter(s => s.routeId === selectedRouteId)
      .sort((a, b) => a.boardingOrder - b.boardingOrder);
  }, [selectedRouteId, settings.seniors]);

  // 캘린더 날짜 목록
  const calendarDays = useMemo(() => {
    const start = startOfMonth(calendarMonth);
    const end = endOfMonth(calendarMonth);
    return eachDayOfInterval({ start, end });
  }, [calendarMonth]);

  // 선택된 어르신의 결석 날짜
  const selectedSeniorAbsenceDates = useMemo(() => {
    if (!selectedSenior) return new Set<string>();
    return new Set(
      seniorAbsences
        .filter(a => a.seniorId === selectedSenior.id)
        .map(a => a.date)
    );
  }, [selectedSenior, seniorAbsences]);

  // 어르신별 결석 일수
  const getAbsenceCount = (seniorId: string) => {
    return seniorAbsences.filter(a => a.seniorId === seniorId).length;
  };

  // 결석 토글
  const handleToggleAbsence = (date: Date) => {
    if (!selectedSenior) return;
    const dateStr = format(date, "yyyy-MM-dd");

    if (selectedSeniorAbsenceDates.has(dateStr)) {
      removeSeniorAbsence(selectedSenior.id, dateStr);
    } else {
      addSeniorAbsence({
        seniorId: selectedSenior.id,
        date: dateStr,
      });
    }
  };

  // 노선 선택 시 어르신 선택 초기화
  const handleSelectRoute = (routeId: string) => {
    setSelectedRouteId(routeId);
    setSelectedSenior(null);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="flex h-[600px]">
        {/* 왼쪽: 노선 및 어르신 목록 */}
        <div className="w-80 border-r border-gray-200 flex flex-col">
          {/* 노선 선택 */}
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <label className="block text-sm font-medium text-gray-700 mb-2">노선 선택</label>
            <select
              value={selectedRouteId || ""}
              onChange={(e) => handleSelectRoute(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">노선을 선택하세요</option>
              {settings.routes.map((route) => {
                const seniorCount = settings.seniors.filter(s => s.routeId === route.id).length;
                return (
                  <option key={route.id} value={route.id}>
                    {route.name} ({route.type}) - {seniorCount}명
                  </option>
                );
              })}
            </select>
          </div>

          {/* 어르신 목록 */}
          <div className="flex-1 overflow-y-auto p-4">
            {!selectedRouteId ? (
              <div className="text-center py-12 text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p>노선을 선택해주세요</p>
              </div>
            ) : routeSeniors.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>등록된 어르신이 없습니다.</p>
                <p className="text-sm mt-1">배차 설정에서 어르신을 추가해주세요.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-gray-500 mb-3">
                  어르신을 선택하여 결석을 관리하세요
                </p>
                {routeSeniors.map((senior, index) => {
                  const absenceCount = getAbsenceCount(senior.id);
                  const isSelected = selectedSenior?.id === senior.id;

                  return (
                    <button
                      key={senior.id}
                      onClick={() => setSelectedSenior(senior)}
                      className={`w-full flex items-center justify-between p-3 rounded-lg transition-all ${
                        isSelected
                          ? "bg-blue-100 border-2 border-blue-500"
                          : "bg-gray-50 border border-gray-200 hover:bg-gray-100"
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium ${
                          isSelected ? "bg-blue-500 text-white" : "bg-gray-300 text-gray-600"
                        }`}>
                          {index + 1}
                        </span>
                        <span className={`font-medium ${isSelected ? "text-blue-700" : "text-gray-800"}`}>
                          {senior.name}
                        </span>
                      </div>
                      {absenceCount > 0 && (
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          isSelected ? "bg-blue-200 text-blue-700" : "bg-red-100 text-red-600"
                        }`}>
                          {absenceCount}일
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 오른쪽: 결석 캘린더 */}
        <div className="flex-1 p-6">
          {!selectedSenior ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-lg font-medium mb-1">결석 캘린더</p>
                <p className="text-sm">왼쪽에서 어르신을 선택해주세요</p>
              </div>
            </div>
          ) : (
            <div>
              {/* 헤더 */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-800">{selectedSenior.name}</h3>
                  <p className="text-sm text-gray-500">
                    결석 일수: <span className="font-medium text-red-600">{selectedSeniorAbsenceDates.size}일</span>
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <span className="text-lg font-medium text-gray-700 min-w-[120px] text-center">
                    {format(calendarMonth, "yyyy년 M월", { locale: ko })}
                  </span>
                  <button
                    onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* 캘린더 */}
              <div className="bg-gray-50 rounded-xl p-4">
                {/* 요일 헤더 */}
                <div className="grid grid-cols-7 gap-2 mb-2">
                  {["일", "월", "화", "수", "목", "금", "토"].map((day, i) => (
                    <div
                      key={day}
                      className={`text-center text-sm font-medium py-2 ${
                        i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-gray-600"
                      }`}
                    >
                      {day}
                    </div>
                  ))}
                </div>

                {/* 날짜 */}
                <div className="grid grid-cols-7 gap-2">
                  {/* 첫 주 빈 칸 */}
                  {Array.from({ length: getDay(calendarDays[0]) }).map((_, i) => (
                    <div key={`empty-${i}`} className="h-12" />
                  ))}
                  {/* 날짜들 */}
                  {calendarDays.map((date) => {
                    const dateStr = format(date, "yyyy-MM-dd");
                    const isAbsent = selectedSeniorAbsenceDates.has(dateStr);
                    const dayOfWeek = getDay(date);
                    const isSunday = dayOfWeek === 0;
                    const isSaturday = dayOfWeek === 6;
                    const isToday = format(new Date(), "yyyy-MM-dd") === dateStr;

                    return (
                      <button
                        key={dateStr}
                        onClick={() => handleToggleAbsence(date)}
                        disabled={isSunday}
                        className={`h-12 text-sm rounded-lg transition-all font-medium relative ${
                          isAbsent
                            ? "bg-red-500 text-white shadow-md hover:bg-red-600"
                            : isSunday
                            ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                            : "bg-white hover:bg-blue-50 hover:border-blue-300 border border-gray-200"
                        } ${
                          isSunday ? "text-red-300" : isSaturday ? "text-blue-600" : "text-gray-700"
                        } ${isAbsent ? "!text-white" : ""}`}
                      >
                        {format(date, "d")}
                        {isToday && !isAbsent && (
                          <span className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-blue-500 rounded-full" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 범례 */}
              <div className="mt-4 flex items-center justify-center space-x-6 text-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-red-500 rounded" />
                  <span className="text-gray-600">결석</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-white border border-gray-200 rounded" />
                  <span className="text-gray-600">출석</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-gray-200 rounded" />
                  <span className="text-gray-600">일요일 (휴무)</span>
                </div>
              </div>

              <p className="mt-4 text-center text-sm text-gray-500">
                날짜를 클릭하여 결석을 등록하거나 해제할 수 있습니다.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
