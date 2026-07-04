"use client";

import { useMemo, CSSProperties } from "react";
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
import { Button } from "@astryxdesign/core/Button";
import { Text } from "@astryxdesign/core/Text";
import { Icon } from "@astryxdesign/core/Icon";
import { Spinner } from "@astryxdesign/core/Spinner";
import { HStack } from "@astryxdesign/core/Stack";
import type { DispatchDaySummary } from "@/types/dispatch";

interface DispatchCalendarProps {
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  monthlySummary: Map<string, DispatchDaySummary>;
  onDateSelect: (date: Date) => void;
  isLoading?: boolean;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const CARD_STYLE: CSSProperties = {
  position: "relative",
  background: 'var(--color-background-card)',
  borderRadius: 'var(--radius-element)',
  boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
  border: "1px solid var(--color-border)",
  padding: 'var(--spacing-6)',
};

// 범례/셀 표시용 색상
const LEGEND: { color: string; label: string }[] = [
  { color: 'var(--color-text-green)', label: "정상" },
  { color: 'var(--color-text-yellow)', label: "대체" },
  { color: 'var(--color-text-red)', label: "운행없음" },
  { color: 'var(--color-text-gray)', label: "휴일" },
];

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
      return { bg: 'var(--color-background-muted)', border: "var(--color-border)" };
    }

    // 휴일인 경우
    if (summary.isHoliday) {
      return { bg: 'var(--color-background-muted)', border: "var(--color-border-emphasized)" };
    }

    if (summary.noServiceCount > 0) {
      return { bg: 'var(--color-background-red)', border: 'var(--color-border-red)' };
    }

    if (summary.substituteCount > 0) {
      return { bg: 'var(--color-background-yellow)', border: 'var(--color-background-yellow)' };
    }

    return { bg: 'var(--color-background-green)', border: 'var(--color-border-green)' };
  };

  return (
    <div style={CARD_STYLE}>
      {/* 헤더 */}
      <div style={{ marginBottom: 'var(--spacing-6)' }}>
        <HStack hAlign="between" vAlign="center" wrap="wrap" gap={3}>
          <HStack gap={3} vAlign="center">
          <Button
            label="이전 달"
            variant="ghost"
            size="sm"
            isIconOnly
            icon={<Icon icon="chevronLeft" size="md" />}
            onClick={goToPreviousMonth}
          />
          <Text type="display-3" as="h2" weight="bold" color="primary">
            {format(currentDate, "yyyy년 M월", { locale: ko })}
          </Text>
          <Button
            label="다음 달"
            variant="ghost"
            size="sm"
            isIconOnly
            icon={<Icon icon="chevronRight" size="md" />}
            onClick={goToNextMonth}
          />
        </HStack>

        <HStack gap={3} vAlign="center" wrap="wrap">
          <Button label="오늘" variant="secondary" size="sm" onClick={goToToday} />

          {/* 범례 */}
          <HStack gap={3} vAlign="center" wrap="wrap">
            {LEGEND.map((item) => (
              <HStack key={item.label} gap={1} vAlign="center">
                <span
                  style={{
                    display: "inline-block",
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: item.color,
                  }}
                />
                <Text type="supporting" color="secondary">{item.label}</Text>
              </HStack>
            ))}
          </HStack>
        </HStack>
        </HStack>
      </div>

      {/* 로딩 상태 */}
      {isLoading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(255, 255, 255, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
            borderRadius: 'var(--radius-element)',
          }}
        >
          <Spinner size="lg" aria-label="달력 불러오는 중" />
        </div>
      )}

      {/* 요일 헤더 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 'var(--spacing-1)',
          marginBottom: 'var(--spacing-2)',
        }}
      >
        {WEEKDAYS.map((day, index) => (
          <div key={day} style={{ textAlign: "center", padding: "8px 0" }}>
            <Text type="label" weight="medium" color="inherit">
              <span
                style={{
                  color: index === 0 ? 'var(--color-text-red)' : index === 6 ? 'var(--color-text-blue)' : 'var(--color-text-primary)',
                }}
              >
                {day}
              </span>
            </Text>
          </div>
        ))}
      </div>

      {/* 캘린더 그리드 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 'var(--spacing-1)' }}>
        {calendarDays.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const summary = monthlySummary.get(dateStr);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isToday = isSameDay(day, new Date());
          const isSunday = day.getDay() === 0;
          const isSaturday = day.getDay() === 6;
          const statusColors = getStatusColors(summary);

          // 날짜 숫자 스타일
          const dayNumberStyle: CSSProperties = {
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 'var(--spacing-1)',
            ...(isToday
              ? {
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: 'var(--color-background-teal)',
                  color: "#fff",
                }
              : !isCurrentMonth
              ? { color: 'var(--color-text-gray)' }
              : isSunday
              ? { color: 'var(--color-text-red)' }
              : isSaturday
              ? { color: 'var(--color-text-blue)' }
              : { color: 'var(--color-text-primary)' }),
          };

          return (
            <motion.button
              key={dateStr}
              onClick={() => onDateSelect(day)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={!isCurrentMonth}
              style={{
                position: "relative",
                minHeight: 100,
                padding: 'var(--spacing-2)',
                borderRadius: 'var(--radius-inner)',
                textAlign: "left",
                transition: 'all var(--duration-fast)',
                background: isCurrentMonth ? statusColors.bg : 'var(--color-background-muted)',
                border: `1px solid ${isCurrentMonth ? statusColors.border : "var(--color-border)"}`,
                boxShadow: isToday
                  ? "0 0 0 1px #fff, 0 0 0 3px #2dd4bf"
                  : undefined,
                cursor: isCurrentMonth ? "pointer" : "default",
                opacity: isCurrentMonth ? 1 : 0.5,
              }}
            >
              {/* 날짜 숫자 */}
              <div style={{ display: "flex", alignItems: "flex-start" }}>
                <span style={dayNumberStyle}>
                  <Text type="body" weight="semibold" color="inherit">
                    {format(day, "d")}
                  </Text>
                </span>
              </div>

              {/* 휴일 표시 */}
              {isCurrentMonth && summary?.isHoliday && (
                <Text type="supporting" weight="medium" color="secondary">
                  {summary.holidayName}
                </Text>
              )}

              {/* 배차 요약 (휴일이 아닌 경우만) */}
              {isCurrentMonth && summary && !summary.isHoliday && summary.totalRoutes > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 'var(--spacing-1)' }}>
                  {summary.normalCount > 0 && (
                    <HStack gap={1} vAlign="center">
                      <span style={dotStyle('var(--color-success)')} />
                      <Text type="supporting" color="inherit">
                        <span style={{ color: 'var(--color-text-green)' }}>{summary.normalCount}개 정상</span>
                      </Text>
                    </HStack>
                  )}
                  {summary.substituteCount > 0 && (
                    <HStack gap={1} vAlign="center">
                      <span style={dotStyle('var(--color-warning)')} />
                      <Text type="supporting" color="inherit">
                        <span style={{ color: 'var(--color-text-yellow)' }}>{summary.substituteCount}개 대체</span>
                      </Text>
                    </HStack>
                  )}
                  {summary.noServiceCount > 0 && (
                    <HStack gap={1} vAlign="center">
                      <span style={dotStyle('var(--color-error)')} />
                      <Text type="supporting" color="inherit">
                        <span style={{ color: 'var(--color-text-red)' }}>{summary.noServiceCount}개 미운행</span>
                      </Text>
                    </HStack>
                  )}
                </div>
              )}

              {/* 설정되지 않은 경우 (휴일이 아닌 경우만) */}
              {isCurrentMonth && !summary?.isHoliday && (!summary || summary.totalRoutes === 0) && (
                <div style={{ fontStyle: "italic" }}>
                  <Text type="supporting" color="disabled">미설정</Text>
                </div>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// 상태 표시용 작은 점
const dotStyle = (bg: string): CSSProperties => ({
  display: "inline-block",
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: bg,
  flexShrink: 0,
});
