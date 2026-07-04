"use client";

import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths } from "date-fns";
import { ko } from "date-fns/locale";
import { IconUsers, IconCalendarEvent } from "@tabler/icons-react";
import { Card } from "@astryxdesign/core/Card";
import { Selector } from "@astryxdesign/core/Selector";
import { Text } from "@astryxdesign/core/Text";
import { Badge } from "@astryxdesign/core/Badge";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { VStack, HStack } from "@astryxdesign/core/Stack";
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

  const routeOptions = settings.routes.map((route) => {
    const seniorCount = settings.seniors.filter(s => s.routeId === route.id).length;
    return {
      value: route.id,
      label: `${route.name} (${route.type}) - ${seniorCount}명`,
    };
  });

  return (
    <Card width="100%" padding={0}>
      <div style={{ display: "flex", height: 600, overflow: "hidden", borderRadius: "inherit" }}>
        {/* 왼쪽: 노선 및 어르신 목록 */}
        <div style={{ width: 320, borderRight: "1px solid var(--color-border)", display: "flex", flexDirection: "column" }}>
          {/* 노선 선택 */}
          <div style={{ padding: 'var(--spacing-4)', borderBottom: "1px solid var(--color-border)", backgroundColor: 'var(--color-background-muted)' }}>
            <Selector
              label="노선 선택"
              options={routeOptions}
              value={selectedRouteId || ""}
              onChange={handleSelectRoute}
              placeholder="노선을 선택하세요"
            />
          </div>

          {/* 어르신 목록 */}
          <div style={{ flex: 1, overflowY: "auto", padding: 'var(--spacing-4)' }}>
            {!selectedRouteId ? (
              <EmptyState
                icon={<Icon icon={IconUsers} size="lg" color="disabled" />}
                title="노선을 선택해주세요"
              />
            ) : routeSeniors.length === 0 ? (
              <EmptyState
                title="등록된 어르신이 없습니다."
                description="배차 설정에서 어르신을 추가해주세요."
              />
            ) : (
              <VStack gap={2}>
                <Text type="supporting" color="secondary">
                  어르신을 선택하여 결석을 관리하세요
                </Text>
                {routeSeniors.map((senior, index) => {
                  const absenceCount = getAbsenceCount(senior.id);
                  const isSelected = selectedSenior?.id === senior.id;

                  return (
                    <button
                      key={senior.id}
                      onClick={() => setSelectedSenior(senior)}
                      className={isSelected ? undefined : "carev-seniorabs-row"}
                      style={{
                        width: "100%",
                        padding: 'var(--spacing-3)',
                        borderRadius: 'var(--radius-inner)',
                        transition: 'all var(--duration-fast-min) var(--ease-standard)',
                        cursor: "pointer",
                        textAlign: "left",
                        border: isSelected ? "2px solid #14b8a6" : "1px solid #e5e7eb",
                        backgroundColor: isSelected ? 'var(--color-background-teal)' : undefined,
                      }}
                    >
                      <HStack gap={0} hAlign="between" vAlign="center">
                        <HStack gap={3} vAlign="center">
                          <span
                            style={{
                              width: 24,
                              height: 24,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              borderRadius: 'var(--radius-full)',
                              fontSize: 'var(--font-size-sm)',
                              fontWeight: 'var(--font-weight-medium)',
                              backgroundColor: isSelected ? 'var(--color-background-teal)' : 'var(--color-background-muted)',
                              color: isSelected ? "#ffffff" : 'var(--color-text-primary)',
                            }}
                          >
                            {index + 1}
                          </span>
                          <span style={{ fontWeight: 'var(--font-weight-medium)', color: isSelected ? 'var(--color-text-teal)' : 'var(--color-text-primary)' }}>
                            {senior.name}
                          </span>
                        </HStack>
                        {absenceCount > 0 && (
                          <Badge variant={isSelected ? "teal" : "red"} label={`${absenceCount}일`} />
                        )}
                      </HStack>
                    </button>
                  );
                })}
              </VStack>
            )}
          </div>
        </div>

        {/* 오른쪽: 결석 캘린더 */}
        <div style={{ flex: 1, padding: 'var(--spacing-6)' }}>
          {!selectedSenior ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
              <EmptyState
                icon={<Icon icon={IconCalendarEvent} size="lg" color="disabled" />}
                title="결석 캘린더"
                description="왼쪽에서 어르신을 선택해주세요"
              />
            </div>
          ) : (
            <div>
              {/* 헤더 */}
              <div style={{ marginBottom: 'var(--spacing-6)' }}>
                <HStack gap={0} hAlign="between" vAlign="center">
                  <VStack gap={0.5} vAlign="start">
                    <Text type="large" weight="bold" size="xl">{selectedSenior.name}</Text>
                    <Text type="supporting" color="secondary">
                      결석 일수: <span style={{ fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-red)' }}>{selectedSeniorAbsenceDates.size}일</span>
                    </Text>
                  </VStack>
                  <HStack gap={2} vAlign="center">
                    <IconButton
                      label="이전 달"
                      variant="ghost"
                      icon={<Icon icon="chevronLeft" size="md" />}
                      onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}
                    />
                    <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-gray)', minWidth: 120, textAlign: "center" }}>
                      {format(calendarMonth, "yyyy년 M월", { locale: ko })}
                    </span>
                    <IconButton
                      label="다음 달"
                      variant="ghost"
                      icon={<Icon icon="chevronRight" size="md" />}
                      onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
                    />
                  </HStack>
                </HStack>
              </div>

              {/* 캘린더 */}
              <div style={{ backgroundColor: 'var(--color-background-muted)', borderRadius: 'var(--radius-element)', padding: 'var(--spacing-4)' }}>
                {/* 요일 헤더 */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-2)' }}>
                  {["일", "월", "화", "수", "목", "금", "토"].map((day, i) => (
                    <div
                      key={day}
                      style={{
                        textAlign: "center",
                        fontSize: 'var(--font-size-base)',
                        fontWeight: 'var(--font-weight-medium)',
                        paddingTop: 'var(--spacing-2)',
                        paddingBottom: 'var(--spacing-2)',
                        color: i === 0 ? 'var(--color-text-red)' : i === 6 ? 'var(--color-text-blue)' : 'var(--color-text-primary)',
                      }}
                    >
                      {day}
                    </div>
                  ))}
                </div>

                {/* 날짜 */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 'var(--spacing-2)' }}>
                  {/* 첫 주 빈 칸 */}
                  {Array.from({ length: getDay(calendarDays[0]) }).map((_, i) => (
                    <div key={`empty-${i}`} style={{ height: 48 }} />
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
                        className={isAbsent ? "carev-seniorabs-day-absent" : isSunday ? undefined : "carev-seniorabs-day"}
                        style={{
                          height: 48,
                          fontSize: 'var(--font-size-base)',
                          borderRadius: 'var(--radius-inner)',
                          transition: 'all var(--duration-fast-min) var(--ease-standard)',
                          fontWeight: 'var(--font-weight-medium)',
                          position: "relative",
                          cursor: isSunday ? "not-allowed" : "pointer",
                          backgroundColor: isSunday && !isAbsent ? 'var(--color-background-muted)' : undefined,
                          color: isAbsent ? undefined : isSunday ? 'var(--color-text-red)' : isSaturday ? 'var(--color-text-teal)' : 'var(--color-text-primary)',
                        }}
                      >
                        {format(date, "d")}
                        {isToday && !isAbsent && (
                          <span
                            style={{
                              position: "absolute",
                              bottom: 4,
                              left: "50%",
                              transform: "translateX(-50%)",
                              width: 4,
                              height: 4,
                              backgroundColor: 'var(--color-background-teal)',
                              borderRadius: 'var(--radius-full)',
                            }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 범례 */}
              <div style={{ marginTop: 'var(--spacing-4)' }}>
                <HStack gap={6} hAlign="center" vAlign="center">
                  <HStack gap={2} vAlign="center">
                    <div style={{ width: 16, height: 16, backgroundColor: 'var(--color-background-red)', borderRadius: 'var(--radius-none)' }} />
                    <Text type="body" color="secondary">결석</Text>
                  </HStack>
                  <HStack gap={2} vAlign="center">
                    <div style={{ width: 16, height: 16, backgroundColor: 'var(--color-background-card)', border: "1px solid var(--color-border)", borderRadius: 'var(--radius-none)' }} />
                    <Text type="body" color="secondary">출석</Text>
                  </HStack>
                  <HStack gap={2} vAlign="center">
                    <div style={{ width: 16, height: 16, backgroundColor: 'var(--color-background-muted)', borderRadius: 'var(--radius-none)' }} />
                    <Text type="body" color="secondary">일요일 (휴무)</Text>
                  </HStack>
                </HStack>
              </div>

              <div style={{ marginTop: 'var(--spacing-4)', textAlign: "center" }}>
                <Text type="supporting" color="secondary">
                  날짜를 클릭하여 결석을 등록하거나 해제할 수 있습니다.
                </Text>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
