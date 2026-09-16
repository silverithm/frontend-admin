"use client";

// 배차표 옆에 붙는 출결 패널 — 그날 이 방향(등원/하원) 노선에 탄 어르신을
// 차량별로 묶어 결석·개인등하원·사유를 바로 체크한다.
//
// 예전 "출결 관리" 탭은 전체 명단을 가나다순으로 쭉 훑는 독립 화면이었다.
// 실제로는 배차표를 보면서 "이 차 이 사람이 오늘 안 온다"를 확인하는 흐름이라
// 배차표 옆에 붙여 따로 탭을 오갈 필요가 없게 했다. 저장 로직은 그대로
// ElderAttendanceManagement에서 옮겨왔다(출결은 백엔드 elder_attendance가 원본).
//
// 어르신 1명당 2줄(결석·개인등원 / 개인하원·사유)로 세로가 너무 길어져서
// 차량별 그룹 안에 1명당 1줄짜리 표로 다시 짰다.

import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import { Card } from "@astryxdesign/core/Card";
import { Text } from "@astryxdesign/core/Text";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { TextInput } from "@astryxdesign/core/TextInput";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { VStack } from "@astryxdesign/core/Stack";
import { useElderAttendanceStore } from "@/lib/elderAttendanceStore";
import type { DispatchSettings, RouteType, Senior } from "@/types/dispatch";
import type { ElderDayAttendance } from "@/types/attendance";

interface DispatchAttendancePanelProps {
  date: string;
  routeType: RouteType;
  settings: DispatchSettings;
  onNotification?: (message: string, type: "success" | "error" | "info") => void;
}

export default function DispatchAttendancePanel({
  date,
  routeType,
  settings,
  onNotification,
}: DispatchAttendancePanelProps) {
  const { records, loadRange, saveRecords, isLoading } = useElderAttendanceStore();

  useEffect(() => {
    loadRange(date, date);
  }, [date, loadRange]);

  const recordByElderlyId = useMemo(() => {
    const map = new Map<number, ElderDayAttendance>();
    records.filter((r) => r.date === date).forEach((r) => map.set(r.elderlyId, r));
    return map;
  }, [records, date]);

  const stateOf = useCallback(
    (elderlyId: number, senior: Senior): ElderDayAttendance => {
      const saved = recordByElderlyId.get(elderlyId);
      if (saved) return saved;
      return {
        elderlyId,
        date,
        status: "출석",
        personalPickup: !!senior.personalPickup,
        personalDropoff: !!senior.personalDropoff,
      };
    },
    [recordByElderlyId, date]
  );

  const applyChange = useCallback(
    async (next: ElderDayAttendance) => {
      const ok = await saveRecords([next]);
      if (!ok) onNotification?.("출결 저장에 실패했습니다.", "error");
    },
    [saveRecords, onNotification]
  );

  // 사유는 글자마다 저장하면 너무 잦은 요청이 된다. 로컬에서만 들고 있다가
  // 포커스를 벗어날 때(blur) 한 번만 저장한다.
  const [noteDraft, setNoteDraft] = useState<Record<number, string>>({});

  const routesForDirection = useMemo(
    () => settings.routes.filter((r) => r.type === routeType),
    [settings.routes, routeType]
  );

  const dateLabel = useMemo(() => {
    try {
      return format(parseISO(date), "M/d (EEE)", { locale: ko });
    } catch {
      return date;
    }
  }, [date]);

  if (routesForDirection.length === 0) {
    return (
      <EmptyState
        isCompact
        title={`${routeType} 노선이 없습니다`}
        description="배차 설정에서 노선을 추가하면 여기서 출결을 관리할 수 있습니다."
      />
    );
  }

  return (
    <VStack gap={3}>
      <Text type="label" weight="semibold" color="secondary">
        출결 · {dateLabel}
      </Text>
      {routesForDirection.map((route) => {
        const seniors = settings.seniors
          .filter((s) => s.routeId === route.id && s.elderlyId !== undefined)
          .sort((a, b) => a.boardingOrder - b.boardingOrder);

        if (seniors.length === 0) return null;

        // 헤드라인용 — 배차표(dispatchBoardText.buildRouteHeadline)와 같은 "A/박순자" 표기.
        // 그쪽은 그날의 대체 배차까지 반영하는 RouteDispatch가 필요해 여기선 쓰지 않고,
        // 노선 설정의 주운전자 기준으로 같은 형식만 맞춘다.
        const mainDriver = route.routeDrivers[0];
        const vehicle = mainDriver?.vehicleName?.trim() || route.name;
        const headline = mainDriver?.driverName?.trim()
          ? `${vehicle}/${mainDriver.driverName.trim()}`
          : vehicle;

        return (
          <Card key={route.id} variant="muted" padding={3}>
            <VStack gap={2}>
              <Text weight="medium">
                {route.name} · {headline} · {seniors.length}명
              </Text>
              <div className="carev-dispatch-attendance-table-scroll">
                <table className="carev-dispatch-attendance-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left" }}>
                        <Text type="supporting" color="secondary">성명</Text>
                      </th>
                      <th>
                        <Text type="supporting" color="secondary">결석</Text>
                      </th>
                      <th>
                        <Text type="supporting" color="secondary">개인등원</Text>
                      </th>
                      <th>
                        <Text type="supporting" color="secondary">개인하원</Text>
                      </th>
                      <th style={{ textAlign: "left" }}>
                        <Text type="supporting" color="secondary">사유</Text>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {seniors.map((senior) => {
                      const elderlyId = senior.elderlyId as number;
                      const state = stateOf(elderlyId, senior);
                      const isAbsent = state.status === "결석";
                      const note = noteDraft[elderlyId] ?? state.note ?? "";

                      return (
                        <tr key={senior.id}>
                          <td>
                            <Text type="supporting" weight="medium" color={isAbsent ? "disabled" : "primary"}>
                              {senior.name}
                            </Text>
                          </td>
                          <td>
                            <CheckboxInput
                              label="결석"
                              isLabelHidden
                              value={isAbsent}
                              onChange={(checked) =>
                                applyChange({ ...state, status: checked ? "결석" : "출석" })
                              }
                            />
                          </td>
                          <td>
                            <CheckboxInput
                              label="개인등원"
                              isLabelHidden
                              value={state.personalPickup}
                              isDisabled={isAbsent}
                              onChange={(checked) => applyChange({ ...state, personalPickup: checked })}
                            />
                          </td>
                          <td>
                            <CheckboxInput
                              label="개인하원"
                              isLabelHidden
                              value={state.personalDropoff}
                              isDisabled={isAbsent}
                              onChange={(checked) => applyChange({ ...state, personalDropoff: checked })}
                            />
                          </td>
                          <td style={{ minWidth: 96 }}>
                            <TextInput
                              label={`${senior.name} 사유`}
                              isLabelHidden
                              size="sm"
                              value={note}
                              placeholder="사유"
                              onChange={(value) =>
                                setNoteDraft((prev) => ({ ...prev, [elderlyId]: value }))
                              }
                              onBlur={() => {
                                if (note !== (state.note ?? "")) {
                                  applyChange({ ...state, note });
                                }
                              }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </VStack>
          </Card>
        );
      })}
      {isLoading && (
        <Text type="supporting" color="secondary">
          출결을 불러오는 중...
        </Text>
      )}
    </VStack>
  );
}
