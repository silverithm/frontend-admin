"use client";

import { format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Layout, LayoutContent, LayoutFooter } from "@astryxdesign/core/Layout";
import { Button } from "@astryxdesign/core/Button";
import { VStack, HStack, StackItem } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Icon } from "@astryxdesign/core/Icon";
import { Card } from "@astryxdesign/core/Card";
import { Badge } from "@astryxdesign/core/Badge";
import { IconUser, IconBus, IconUsers, IconMoon } from "@tabler/icons-react";
import type { DailyDispatch, RouteDispatch } from "@/types/dispatch";
import { isNonWorkingDay } from "@/lib/dispatchAlgorithm";

interface DispatchDayDetailProps {
  dispatch: DailyDispatch | null;
  onClose: () => void;
}

const infoBoxStyle: React.CSSProperties = {
  background: "rgba(255, 255, 255, 0.6)",
  borderRadius: 'var(--radius-inner)',
  padding: 'var(--spacing-3)',
};

export default function DispatchDayDetail({ dispatch, onClose }: DispatchDayDetailProps) {
  if (!dispatch) return null;

  const date = parseISO(dispatch.date);

  // 휴일 체크
  const holidayInfo = isNonWorkingDay(dispatch.date);

  // 상태별 스타일 (Astryx 매핑)
  const getStatusStyle = (status: RouteDispatch["status"]) => {
    switch (status) {
      case "정상":
        return {
          cardVariant: "green",
          badgeVariant: "success",
          icon: "success",
          iconColor: "success",
        } as const;
      case "대체":
        return {
          cardVariant: "yellow",
          badgeVariant: "warning",
          icon: "arrowsUpDown",
          iconColor: "warning",
        } as const;
      case "운행없음":
        return {
          cardVariant: "red",
          badgeVariant: "error",
          icon: "error",
          iconColor: "error",
        } as const;
      case "휴일":
        return {
          cardVariant: "gray",
          badgeVariant: "neutral",
          icon: "info",
          iconColor: "secondary",
        } as const;
      default:
        return {
          cardVariant: "gray",
          badgeVariant: "neutral",
          icon: "info",
          iconColor: "secondary",
        } as const;
    }
  };

  return (
    <Dialog
      isOpen={true}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      purpose="info"
      width={760}
    >
      <Layout
        header={
          <DialogHeader
            title={format(date, "yyyy년 M월 d일 (EEEE)", { locale: ko })}
            onOpenChange={(open) => {
              if (!open) onClose();
            }}
          />
        }
        content={
          <LayoutContent>
            <VStack gap={4}>
              {/* 통계 요약 */}
              {holidayInfo.isHoliday ? (
                <div style={{ padding: "24px 0", textAlign: "center" }}>
                  <VStack gap={2} hAlign="center">
                    <Icon icon={IconMoon} size="lg" color="secondary" />
                    <Text type="large" weight="medium">
                      {holidayInfo.holidayName}
                    </Text>
                    <Text type="supporting" color="secondary">
                      오늘은 휴무일입니다
                    </Text>
                  </VStack>
                </div>
              ) : (
                <VStack gap={3}>
                  <Text type="supporting" color="secondary">
                    총 {dispatch.routeDispatches.length}개 노선 배차표
                  </Text>
                  <HStack gap={4} wrap="wrap">
                    <HStack gap={2} vAlign="center">
                      <span
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 'var(--radius-full)',
                          background: 'var(--color-background-green)',
                          display: "inline-block",
                        }}
                      />
                      <Text type="supporting" color="secondary">
                        정상 운행: {dispatch.routeDispatches.filter((r) => r.status === "정상").length}개
                      </Text>
                    </HStack>
                    <HStack gap={2} vAlign="center">
                      <span
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 'var(--radius-full)',
                          background: 'var(--color-background-yellow)',
                          display: "inline-block",
                        }}
                      />
                      <Text type="supporting" color="secondary">
                        대체 운행: {dispatch.routeDispatches.filter((r) => r.status === "대체").length}개
                      </Text>
                    </HStack>
                    <HStack gap={2} vAlign="center">
                      <span
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 'var(--radius-full)',
                          background: 'var(--color-background-red)',
                          display: "inline-block",
                        }}
                      />
                      <Text type="supporting" color="secondary">
                        운행 없음: {dispatch.routeDispatches.filter((r) => r.status === "운행없음").length}개
                      </Text>
                    </HStack>
                  </HStack>
                </VStack>
              )}

              {/* 배차 목록 */}
              {dispatch.routeDispatches.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 0" }}>
                  <Text type="body" color="secondary">
                    등록된 노선이 없습니다.
                  </Text>
                </div>
              ) : (
                <VStack gap={3}>
                  {dispatch.routeDispatches.map((routeDispatch) => {
                    const style = getStatusStyle(routeDispatch.status);

                    return (
                      <Card key={routeDispatch.routeId} variant={style.cardVariant} padding={4}>
                        <VStack gap={3}>
                          {/* 헤더 */}
                          <HStack gap={3} vAlign="start">
                            <Icon icon={style.icon} size="md" color={style.iconColor} />
                            <VStack gap={1}>
                              <Text type="body" weight="bold">
                                {routeDispatch.routeName} 노선
                              </Text>
                              <HStack gap={2} vAlign="center" wrap="wrap">
                                <Badge
                                  variant={style.badgeVariant}
                                  label={
                                    routeDispatch.driverRole && routeDispatch.status === "대체"
                                      ? `${routeDispatch.status} (${routeDispatch.driverRole})`
                                      : routeDispatch.status
                                  }
                                />
                              </HStack>
                              {/* 배차 사유 표시 */}
                              {routeDispatch.reason && (
                                <Text type="supporting" color="secondary">
                                  {routeDispatch.reason}
                                </Text>
                              )}
                            </VStack>
                          </HStack>

                          {routeDispatch.status !== "운행없음" ? (
                            <VStack gap={2}>
                              <div className="carev-dispatch-day-info-grid">
                                {/* 운전자 정보 */}
                                <div style={infoBoxStyle}>
                                  <VStack gap={1}>
                                    <HStack gap={2} vAlign="center">
                                      <Icon icon={IconUser} size="sm" color="secondary" />
                                      <Text type="label" color="secondary">
                                        운전자
                                      </Text>
                                    </HStack>
                                    <Text type="body" weight="semibold">
                                      {routeDispatch.driver?.driverName || "-"}
                                    </Text>
                                    {routeDispatch.status === "대체" && routeDispatch.originalMainDriver && (
                                      <Text type="supporting" color="secondary">
                                        (원래: {routeDispatch.originalMainDriver.driverName} 휴무)
                                      </Text>
                                    )}
                                  </VStack>
                                </div>

                                {/* 차량 정보 */}
                                <div style={infoBoxStyle}>
                                  <VStack gap={1}>
                                    <HStack gap={2} vAlign="center">
                                      <Icon icon={IconBus} size="sm" color="secondary" />
                                      <Text type="label" color="secondary">
                                        차량
                                      </Text>
                                    </HStack>
                                    <Text type="body" weight="semibold">
                                      {routeDispatch.driver?.vehicleName || "-"}
                                      {routeDispatch.driver?.vehicleCapacity &&
                                        ` (${routeDispatch.driver.vehicleCapacity}인승)`}
                                    </Text>
                                  </VStack>
                                </div>
                              </div>

                              {/* 탑승 어르신 */}
                              <div style={infoBoxStyle}>
                                <VStack gap={2}>
                                  <HStack gap={2} vAlign="center">
                                    <Icon icon={IconUsers} size="sm" color="secondary" />
                                    <Text type="label" color="secondary">
                                      탑승 어르신 ({routeDispatch.passengers.length}명)
                                    </Text>
                                  </HStack>
                                  {routeDispatch.passengers.length > 0 ? (
                                    <HStack gap={2} wrap="wrap">
                                      {routeDispatch.passengers.map((senior, index) => (
                                        <span
                                          key={senior.id}
                                          style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: 'var(--spacing-1-5)',
                                            padding: "4px 8px",
                                            background: 'var(--color-background-muted)',
                                            color: 'var(--color-text-gray)',
                                            borderRadius: 'var(--radius-inner)',
                                            fontSize: 'var(--font-size-base)',
                                          }}
                                        >
                                          <span
                                            style={{
                                              width: 20,
                                              height: 20,
                                              display: "inline-flex",
                                              alignItems: "center",
                                              justifyContent: "center",
                                              background: 'var(--color-background-muted)',
                                              color: 'var(--color-text-gray)',
                                              borderRadius: 'var(--radius-full)',
                                              fontSize: 'var(--font-size-xs)',
                                            }}
                                          >
                                            {index + 1}
                                          </span>
                                          {senior.name}
                                        </span>
                                      ))}
                                    </HStack>
                                  ) : (
                                    <Text type="supporting" color="secondary">
                                      탑승 어르신 없음
                                    </Text>
                                  )}
                                </VStack>
                              </div>
                            </VStack>
                          ) : (
                            <div style={{ textAlign: "center", padding: "8px 0", color: 'var(--color-text-red)' }}>
                              <Text type="body" weight="medium" color="inherit">
                                {routeDispatch.reason || "운행 불가"}
                              </Text>
                            </div>
                          )}
                        </VStack>
                      </Card>
                    );
                  })}
                </VStack>
              )}
            </VStack>
          </LayoutContent>
        }
        footer={
          <LayoutFooter hasDivider>
            <HStack gap={2} hAlign="end">
              <Button label="닫기" variant="primary" onClick={onClose} />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  );
}
