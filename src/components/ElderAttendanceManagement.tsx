"use client";

// 출결관리 - 등록된 모든 어르신을 가나다순으로 놓고 그날 출결을 체크한다.
//
// 예전 "결석관리"는 노선을 고르고 어르신을 고른 뒤 월간 캘린더에서 결석일을 찍는
// 3단계였다. 매일 아침 70여 명을 훑어야 하는 실제 업무와 맞지 않았다.
// 여기서는 날짜 하나를 고르고 전체 명단을 위에서 아래로 훑는다.
//
// 결석과 개인등하원은 별개다. 개인등원한 어르신도 하원은 차량을 타는 일이 흔하다.

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { FiSearch } from "react-icons/fi";
import { Card } from "@astryxdesign/core/Card";
import { Button } from "@astryxdesign/core/Button";
import { Text } from "@astryxdesign/core/Text";
import { Badge } from "@astryxdesign/core/Badge";
import { TextInput } from "@astryxdesign/core/TextInput";
import { DateInput } from "@astryxdesign/core/DateInput";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { VStack, HStack, StackItem } from "@astryxdesign/core/Stack";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import type { ISODateString } from "@astryxdesign/core/Calendar";
import { getCompanyElders } from "@/lib/apiService";
import { useDispatchStore } from "@/lib/dispatchStore";
import { useElderAttendanceStore } from "@/lib/elderAttendanceStore";
import type { ElderDayAttendance } from "@/types/attendance";
import type { ElderlyInfo } from "@/types/elderly";

interface ElderAttendanceManagementProps {
  onNotification?: (message: string, type: "success" | "error" | "info") => void;
  /** 바깥(배차 화면)에서 날짜를 정해 오는 경우 */
  date?: string;
  onDateChange?: (date: string) => void;
}

export default function ElderAttendanceManagement({
  onNotification,
  date: externalDate,
  onDateChange,
}: ElderAttendanceManagementProps) {
  const { settings } = useDispatchStore();
  const { records, loadRange, saveRecords, isLoading } = useElderAttendanceStore();

  const [internalDate, setInternalDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const date = externalDate ?? internalDate;

  const [elders, setElders] = useState<ElderlyInfo[]>([]);
  const [isLoadingElders, setIsLoadingElders] = useState(true);
  const [search, setSearch] = useState("");

  // 어르신 전체 목록 (가나다순)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoadingElders(true);
      try {
        const response = await getCompanyElders();
        const list: ElderlyInfo[] = Array.isArray(response)
          ? response
          : (response?.elders || response?.content || response?.data || []);
        if (!cancelled) {
          setElders([...list].sort((a, b) => a.name.localeCompare(b.name, "ko")));
        }
      } catch (error) {
        console.error("[출결] 어르신 목록 조회 실패:", error);
        if (!cancelled) onNotification?.("어르신 목록을 불러오지 못했습니다.", "error");
      } finally {
        if (!cancelled) setIsLoadingElders(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onNotification]);

  // 그날 출결
  useEffect(() => {
    loadRange(date, date);
  }, [date, loadRange]);

  // 어르신별 배정 노선 (배지 표시용)
  const routeByElderlyId = useMemo(() => {
    const map = new Map<number, string[]>();
    settings.seniors.forEach((senior) => {
      if (senior.elderlyId === undefined) return;
      const route = settings.routes.find((r) => r.id === senior.routeId);
      if (!route) return;
      const list = map.get(senior.elderlyId) ?? [];
      list.push(`${route.name} ${route.type}`);
      map.set(senior.elderlyId, list);
    });
    return map;
  }, [settings]);

  const recordByElderlyId = useMemo(() => {
    const map = new Map<number, ElderDayAttendance>();
    records.filter((r) => r.date === date).forEach((r) => map.set(r.elderlyId, r));
    return map;
  }, [records, date]);

  /** 저장된 기록이 없으면 기본값(출석 + 고정 개인등하원 설정) */
  const stateOf = useCallback(
    (elderlyId: number): ElderDayAttendance => {
      const saved = recordByElderlyId.get(elderlyId);
      if (saved) return saved;

      const senior = settings.seniors.find((s) => s.elderlyId === elderlyId);
      return {
        elderlyId,
        date,
        status: "출석",
        personalPickup: !!senior?.personalPickup,
        personalDropoff: !!senior?.personalDropoff,
      };
    },
    [recordByElderlyId, settings.seniors, date]
  );

  const filteredElders = useMemo(() => {
    const q = search.trim();
    if (!q) return elders;
    return elders.filter((e) => e.name.includes(q));
  }, [elders, search]);

  const summary = useMemo(() => {
    let absent = 0;
    let pickup = 0;
    let dropoff = 0;
    elders.forEach((e) => {
      const s = stateOf(e.id);
      if (s.status === "결석") absent += 1;
      else {
        if (s.personalPickup) pickup += 1;
        if (s.personalDropoff) dropoff += 1;
      }
    });
    return { total: elders.length, absent, present: elders.length - absent, pickup, dropoff };
  }, [elders, stateOf]);

  const applyChange = async (next: ElderDayAttendance) => {
    const ok = await saveRecords([next]);
    if (!ok) onNotification?.("출결 저장에 실패했습니다.", "error");
  };

  const handleDateChange = (value: string) => {
    if (onDateChange) onDateChange(value);
    else setInternalDate(value);
  };

  const handleAllPresent = async () => {
    // 이미 출석인 사람은 건드리지 않는다 (개인등하원 설정이 지워지면 안 된다)
    const changes = elders
      .map((e) => stateOf(e.id))
      .filter((s) => s.status === "결석")
      .map((s) => ({ ...s, status: "출석" as const }));

    if (changes.length === 0) {
      onNotification?.("이미 모두 출석입니다.", "info");
      return;
    }
    const ok = await saveRecords(changes);
    onNotification?.(
      ok ? `${changes.length}명을 출석으로 바꿨습니다.` : "출결 저장에 실패했습니다.",
      ok ? "success" : "error"
    );
  };

  return (
    <VStack gap={4} height="100%">
      <Card padding={4}>
        <VStack gap={3}>
          <HStack gap={3} vAlign="end" wrap="wrap" hAlign="between">
            <HStack gap={3} vAlign="end" wrap="wrap">
              <div style={{ minWidth: 160 }}>
                <DateInput
                  label="날짜"
                  value={date as ISODateString}
                  onChange={(value) => handleDateChange(value ?? date)}
                />
              </div>
              <div style={{ minWidth: 200 }}>
                <TextInput
                  label="어르신 검색"
                  value={search}
                  onChange={(value) => setSearch(value)}
                  placeholder="이름으로 찾기"
                  startIcon={FiSearch}
                  hasClear
                />
              </div>
            </HStack>
            <Button label="전체 출석 처리" variant="secondary" size="sm" onClick={handleAllPresent} />
          </HStack>

          <HStack gap={2} wrap="wrap" vAlign="center">
            <Text type="supporting" color="secondary">
              {format(new Date(date), "M월 d일 (EEE)", { locale: ko })}
            </Text>
            <Badge variant="teal" label={`출석 ${summary.present}`} />
            {summary.absent > 0 && <Badge variant="error" label={`결석 ${summary.absent}`} />}
            {summary.pickup > 0 && <Badge variant="orange" label={`개인등원 ${summary.pickup}`} />}
            {summary.dropoff > 0 && <Badge variant="purple" label={`개인하원 ${summary.dropoff}`} />}
            <Text type="supporting" color="disabled">
              전체 {summary.total}명
            </Text>
          </HStack>
        </VStack>
      </Card>

      <StackItem size="fill">
        <Card padding={0} height="100%">
          {isLoadingElders || isLoading ? (
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Text color="secondary">불러오는 중...</Text>
            </div>
          ) : filteredElders.length === 0 ? (
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <EmptyState
                title={search ? "검색 결과가 없습니다" : "등록된 어르신이 없습니다"}
                description={search ? "다른 이름으로 찾아보세요." : "회원관리에서 어르신을 먼저 등록해 주세요."}
              />
            </div>
          ) : (
            <div style={{ height: "100%", overflowY: "auto" }}>
              {filteredElders.map((elder, index) => {
                const state = stateOf(elder.id);
                const routes = routeByElderlyId.get(elder.id) ?? [];
                const isAbsent = state.status === "결석";

                return (
                  <div
                    key={elder.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--spacing-4)",
                      flexWrap: "wrap",
                      padding: "var(--spacing-3) var(--spacing-4)",
                      borderTop: index === 0 ? undefined : "1px solid var(--color-border)",
                      backgroundColor: isAbsent ? "var(--color-background-muted)" : undefined,
                    }}
                  >
                    <div style={{ minWidth: 140, flex: "1 1 140px" }}>
                      <HStack gap={2} vAlign="center" wrap="wrap">
                        <Text weight="medium">{elder.name}</Text>
                        {routes.map((label) => (
                          <Badge key={label} variant="neutral" label={label} />
                        ))}
                      </HStack>
                    </div>

                    <SegmentedControl
                      label={`${elder.name} 출결`}
                      value={state.status}
                      onChange={(value) =>
                        applyChange({ ...state, status: value as "출석" | "결석" })
                      }
                    >
                      <SegmentedControlItem value="출석" label="출석" />
                      <SegmentedControlItem value="결석" label="결석" />
                    </SegmentedControl>

                    <HStack gap={4} vAlign="center">
                      <CheckboxInput
                        label="개인등원"
                        value={state.personalPickup}
                        isDisabled={isAbsent}
                        onChange={(checked) => applyChange({ ...state, personalPickup: checked })}
                      />
                      <CheckboxInput
                        label="개인하원"
                        value={state.personalDropoff}
                        isDisabled={isAbsent}
                        onChange={(checked) => applyChange({ ...state, personalDropoff: checked })}
                      />
                    </HStack>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </StackItem>
    </VStack>
  );
}
