"use client";

// 배차표 옆에 붙는 출결 패널 — 그날 이 방향(등원/하원) 노선에 탄 어르신을
// 차량별로 묶어 결석·개인등하원·사유를 바로 체크한다.
//
// 예전 "출결 관리" 탭은 전체 명단을 가나다순으로 쭉 훑는 독립 화면이었다.
// 실제로는 배차표를 보면서 "이 차 이 사람이 오늘 안 온다"를 확인하는 흐름이라
// 배차표 옆에 붙여 따로 탭을 오갈 필요가 없게 했다. 저장 로직은 그대로
// ElderAttendanceManagement에서 옮겨왔다(출결은 백엔드 elder_attendance가 원본).

import { useCallback, useEffect, useMemo, useState } from "react";
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
        {routeType} 출결
      </Text>
      {routesForDirection.map((route) => {
        const seniors = settings.seniors
          .filter((s) => s.routeId === route.id && s.elderlyId !== undefined)
          .sort((a, b) => a.boardingOrder - b.boardingOrder);

        if (seniors.length === 0) return null;

        return (
          <Card key={route.id} variant="muted" padding={3}>
            <VStack gap={2}>
              <Text weight="medium">{route.name}</Text>
              <VStack gap={0}>
                {seniors.map((senior, index) => {
                  const elderlyId = senior.elderlyId as number;
                  const state = stateOf(elderlyId, senior);
                  const isAbsent = state.status === "결석";
                  const note = noteDraft[elderlyId] ?? state.note ?? "";

                  return (
                    <div
                      key={senior.id}
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "var(--spacing-3)",
                        alignItems: "center",
                        padding: "var(--spacing-2) 0",
                        borderTop: index === 0 ? undefined : "1px solid var(--color-border)",
                        backgroundColor: isAbsent ? "var(--color-background-muted)" : undefined,
                      }}
                    >
                      <div style={{ minWidth: 64, flex: "1 1 64px" }}>
                        <Text type="supporting" weight="medium">
                          {senior.name}
                        </Text>
                      </div>
                      <CheckboxInput
                        label="결석"
                        value={isAbsent}
                        onChange={(checked) =>
                          applyChange({ ...state, status: checked ? "결석" : "출석" })
                        }
                      />
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
                      <div style={{ minWidth: 96, flex: "1 1 96px" }}>
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
                      </div>
                    </div>
                  );
                })}
              </VStack>
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
