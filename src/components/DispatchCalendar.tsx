"use client";

import { useMemo } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isWeekend,
} from "date-fns";
import { ko } from "date-fns/locale";
import { motion } from "framer-motion";
import type { DispatchDaySummary } from "@/types/dispatch";

interface DispatchCalendarProps {
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  monthlySummary: Map<string, DispatchDaySummary>;
  onDateSelect: (date: Date) => void;
  isLoading?: boolean;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export default function DispatchCalendar({
  currentDate,
  setCurrentDate,
  monthlySummary,
  onDateSelect,
  isLoading = false,
}: DispatchCalendarProps) {
  // 캘린더 날짜 배열 생성
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentDate]);

  // 이전/다음 월 이동
  const goToPreviousMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const goToNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const goToToday = () => setCurrentDate(new Date());

  // 날짜별 상태 색상 결정
  const getStatusColors = (summary: DispatchDaySummary | undefined) => {
    if (!summary || summary.totalRoutes === 0) {
      return { bg: "bg-gray-50", border: "border-gray-200" };
    }

    // 휴일인 경우
    if (summary.isHoliday) {
      return { bg: "bg-gray-100", border: "border-gray-300" };
    }

    if (summary.noServiceCount > 0) {
      return { bg: "bg-red-50", border: "border-red-200" };
    }

    if (summary.substituteCount > 0) {
      return { bg: "bg-yellow-50", border: "border-yellow-200" };
    }

    return { bg: "bg-green-50", border: "border-green-200" };
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={goToPreviousMonth}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-xl font-bold text-gray-800">
            {format(currentDate, "yyyy년 M월", { locale: ko })}
          </h2>
          <button
            onClick={goToNextMonth}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={goToToday}
            className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            오늘
          </button>

          {/* 범례 */}
          <div className="flex items-center space-x-3 text-xs">
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-green-500 mr-1"></div>
              <span className="text-gray-600">정상</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-yellow-500 mr-1"></div>
              <span className="text-gray-600">대체</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-red-500 mr-1"></div>
              <span className="text-gray-600">운행없음</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-gray-400 mr-1"></div>
              <span className="text-gray-600">휴일</span>
            </div>
          </div>
        </div>
      </div>

      {/* 로딩 상태 */}
      {isLoading && (
        <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10 rounded-lg">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {WEEKDAYS.map((day, index) => (
          <div
            key={day}
            className={`text-center py-2 text-sm font-medium ${
              index === 0 ? "text-red-500" : index === 6 ? "text-blue-500" : "text-gray-600"
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* 캘린더 그리드 */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const summary = monthlySummary.get(dateStr);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isToday = isSameDay(day, new Date());
          const isSunday = day.getDay() === 0;
          const isSaturday = day.getDay() === 6;
          const statusColors = getStatusColors(summary);

          return (
            <motion.button
              key={dateStr}
              onClick={() => onDateSelect(day)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`
                relative min-h-[100px] p-2 rounded-lg border transition-all
                ${isCurrentMonth ? statusColors.bg : "bg-gray-100"}
                ${isCurrentMonth ? statusColors.border : "border-gray-200"}
                ${isToday ? "ring-2 ring-blue-500 ring-offset-1" : ""}
                ${isCurrentMonth ? "hover:shadow-md cursor-pointer" : "opacity-50 cursor-default"}
              `}
              disabled={!isCurrentMonth}
            >
              {/* 날짜 숫자 */}
              <div
                className={`text-sm font-semibold mb-1 ${
                  !isCurrentMonth
                    ? "text-gray-400"
                    : isSunday
                    ? "text-red-500"
                    : isSaturday
                    ? "text-blue-500"
                    : "text-gray-800"
                }`}
              >
                {format(day, "d")}
              </div>

              {/* 휴일 표시 */}
              {isCurrentMonth && summary?.isHoliday && (
                <div className="text-xs text-gray-500 font-medium">
                  {summary.holidayName}
                </div>
              )}

              {/* 배차 요약 (휴일이 아닌 경우만) */}
              {isCurrentMonth && summary && !summary.isHoliday && summary.totalRoutes > 0 && (
                <div className="space-y-1">
                  {summary.normalCount > 0 && (
                    <div className="flex items-center text-xs">
                      <div className="w-2 h-2 rounded-full bg-green-500 mr-1"></div>
                      <span className="text-green-700">{summary.normalCount}개 정상</span>
                    </div>
                  )}
                  {summary.substituteCount > 0 && (
                    <div className="flex items-center text-xs">
                      <div className="w-2 h-2 rounded-full bg-yellow-500 mr-1"></div>
                      <span className="text-yellow-700">{summary.substituteCount}개 대체</span>
                    </div>
                  )}
                  {summary.noServiceCount > 0 && (
                    <div className="flex items-center text-xs">
                      <div className="w-2 h-2 rounded-full bg-red-500 mr-1"></div>
                      <span className="text-red-700">{summary.noServiceCount}개 미운행</span>
                    </div>
                  )}
                </div>
              )}

              {/* 설정되지 않은 경우 (휴일이 아닌 경우만) */}
              {isCurrentMonth && !summary?.isHoliday && (!summary || summary.totalRoutes === 0) && (
                <div className="text-xs text-gray-400 italic">미설정</div>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
