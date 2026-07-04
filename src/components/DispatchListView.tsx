"use client";

import { useState, useMemo } from "react";
import { format, parseISO, addDays, startOfMonth, endOfMonth } from "date-fns";
import { ko } from "date-fns/locale";
import { Card } from "@astryxdesign/core/Card";
import { VStack, HStack } from "@astryxdesign/core/Stack";
import { Grid } from "@astryxdesign/core/Grid";
import { Text } from "@astryxdesign/core/Text";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { DateInput } from "@astryxdesign/core/DateInput";
import { Selector } from "@astryxdesign/core/Selector";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableHeaderCell,
} from "@astryxdesign/core/Table";
import type { ISODateString } from "@astryxdesign/core/Calendar";
import type { DispatchSettings, SeniorAbsence, DailyDispatch } from "@/types/dispatch";
import type { VacationRequest } from "@/types/vacation";
import { getDispatchForDateRange } from "@/lib/dispatchAlgorithm";

interface DispatchListViewProps {
  settings: DispatchSettings;
  vacations: VacationRequest[];
  seniorAbsences: SeniorAbsence[];
}

export default function DispatchListView({
  settings,
  vacations,
  seniorAbsences,
}: DispatchListViewProps) {
  const [startDate, setStartDate] = useState(() => format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(() => format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [routeFilter, setRouteFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // 배차 데이터 계산
  const dispatches = useMemo(() => {
    if (!startDate || !endDate) return [];
    return getDispatchForDateRange(startDate, endDate, settings, vacations, seniorAbsences);
  }, [startDate, endDate, settings, vacations, seniorAbsences]);

  // 필터링된 데이터
  const filteredDispatches = useMemo(() => {
    return dispatches.map((daily) => ({
      ...daily,
      routeDispatches: daily.routeDispatches.filter((rd) => {
        if (routeFilter !== "all" && rd.routeId !== routeFilter) return false;
        if (statusFilter !== "all" && rd.status !== statusFilter) return false;
        return true;
      }),
    })).filter((daily) => daily.routeDispatches.length > 0);
  }, [dispatches, routeFilter, statusFilter]);

  // 통계
  const stats = useMemo(() => {
    let normal = 0;
    let substitute = 0;
    let noService = 0;
    let holiday = 0;

    dispatches.forEach((daily) => {
      daily.routeDispatches.forEach((rd) => {
        if (rd.status === "정상") normal++;
        else if (rd.status === "대체") substitute++;
        else if (rd.status === "운행없음") noService++;
        else if (rd.status === "휴일") holiday++;
      });
    });

    return { normal, substitute, noService, holiday, total: normal + substitute + noService };
  }, [dispatches]);

  // 퀵 날짜 설정
  const setThisMonth = () => {
    const now = new Date();
    setStartDate(format(startOfMonth(now), "yyyy-MM-dd"));
    setEndDate(format(endOfMonth(now), "yyyy-MM-dd"));
  };

  const setThisWeek = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = addDays(now, -dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
    const sunday = addDays(monday, 6);
    setStartDate(format(monday, "yyyy-MM-dd"));
    setEndDate(format(sunday, "yyyy-MM-dd"));
  };

  const statusVariant = (status: string): "success" | "warning" | "neutral" | "error" =>
    status === "정상"
      ? "success"
      : status === "대체"
      ? "warning"
      : status === "휴일"
      ? "neutral"
      : "error";

  return (
    <VStack gap={6}>
      {/* 필터 패널 */}
      <Card padding={6}>
        <VStack gap={4}>
          <Grid columns={{ minWidth: 180 }} gap={4}>
            {/* 기간 선택 */}
            <DateInput
              label="시작일"
              value={startDate as ISODateString}
              onChange={(value) => setStartDate(value ?? "")}
            />
            <DateInput
              label="종료일"
              value={endDate as ISODateString}
              onChange={(value) => setEndDate(value ?? "")}
            />

            {/* 노선 필터 */}
            <Selector
              label="노선"
              value={routeFilter}
              onChange={(value) => setRouteFilter(value)}
              options={[
                { value: "all", label: "전체 노선" },
                ...settings.routes.map((route) => ({ value: route.id, label: route.name })),
              ]}
            />

            {/* 상태 필터 */}
            <Selector
              label="상태"
              value={statusFilter}
              onChange={(value) => setStatusFilter(value)}
              options={[
                { value: "all", label: "전체 상태" },
                { value: "정상", label: "정상 운행" },
                { value: "대체", label: "대체 운행" },
                { value: "운행없음", label: "운행 없음" },
                { value: "휴일", label: "휴일" },
              ]}
            />
          </Grid>

          {/* 퀵 버튼 */}
          <HStack gap={3}>
            <Button label="이번 주" variant="secondary" size="sm" onClick={setThisWeek} />
            <Button label="이번 달" variant="secondary" size="sm" onClick={setThisMonth} />
          </HStack>
        </VStack>
      </Card>

      {/* 통계 카드 */}
      <Grid columns={5} gap={4}>
        <Card padding={4}>
          <VStack gap={1} hAlign="center">
            <Text type="display-3" weight="bold" hasTabularNumbers>{stats.total}</Text>
            <Text type="supporting">운행일</Text>
          </VStack>
        </Card>
        <Card variant="green" padding={4}>
          <VStack gap={1} hAlign="center">
            <Text type="display-3" weight="bold" hasTabularNumbers>{stats.normal}</Text>
            <Text type="supporting">정상 운행</Text>
          </VStack>
        </Card>
        <Card variant="yellow" padding={4}>
          <VStack gap={1} hAlign="center">
            <Text type="display-3" weight="bold" hasTabularNumbers>{stats.substitute}</Text>
            <Text type="supporting">대체 운행</Text>
          </VStack>
        </Card>
        <Card variant="red" padding={4}>
          <VStack gap={1} hAlign="center">
            <Text type="display-3" weight="bold" hasTabularNumbers>{stats.noService}</Text>
            <Text type="supporting">운행 없음</Text>
          </VStack>
        </Card>
        <Card variant="muted" padding={4}>
          <VStack gap={1} hAlign="center">
            <Text type="display-3" weight="bold" hasTabularNumbers>{stats.holiday}</Text>
            <Text type="supporting">휴일</Text>
          </VStack>
        </Card>
      </Grid>

      {/* 배차 테이블 */}
      <Card padding={0}>
        {filteredDispatches.length === 0 ? (
          <EmptyState
            title="배차 데이터가 없습니다"
            description="해당 기간에 배차 데이터가 없습니다."
          />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <Table hasHover>
              <TableHeader>
                <TableRow isHeaderRow>
                  <TableHeaderCell>날짜</TableHeaderCell>
                  <TableHeaderCell>노선</TableHeaderCell>
                  <TableHeaderCell>상태</TableHeaderCell>
                  <TableHeaderCell>사유</TableHeaderCell>
                  <TableHeaderCell>운전자</TableHeaderCell>
                  <TableHeaderCell>차량</TableHeaderCell>
                  <TableHeaderCell>탑승 인원</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDispatches.flatMap((daily) =>
                  daily.routeDispatches.map((rd) => (
                    <TableRow key={`${daily.date}-${rd.routeId}`}>
                      <TableCell>
                        <Text weight="medium">
                          {format(parseISO(daily.date), "M/d (EEE)", { locale: ko })}
                        </Text>
                      </TableCell>
                      <TableCell>
                        <Text>{rd.routeName}</Text>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(rd.status)} label={rd.status} />
                      </TableCell>
                      <TableCell>
                        <Text type="supporting">{rd.reason || "-"}</Text>
                      </TableCell>
                      <TableCell>
                        <Text>{rd.driver?.driverName || "-"}</Text>
                      </TableCell>
                      <TableCell>
                        <Text>
                          {rd.driver?.vehicleName || "-"}
                          {rd.driver?.vehicleCapacity && (
                            <Text type="supporting"> ({rd.driver.vehicleCapacity}인승)</Text>
                          )}
                        </Text>
                      </TableCell>
                      <TableCell>
                        {rd.passengers.length > 0 ? (
                          <HStack gap={2} vAlign="center">
                            <Text weight="medium">{rd.passengers.length}명</Text>
                            <Text type="supporting">
                              ({rd.passengers.map((p) => p.name).join(", ")})
                            </Text>
                          </HStack>
                        ) : (
                          <Text color="disabled">-</Text>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </VStack>
  );
}
