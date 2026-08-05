"use client";
import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Layout, LayoutContent, LayoutFooter } from "@astryxdesign/core/Layout";
import { VacationLimit, DayInfo } from "@/types/vacation";
import type { Position } from "@/types/position";
import {
  format,
  addDays,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
} from "date-fns";
import { ko } from "date-fns/locale";
import { Card } from "@astryxdesign/core/Card";
import { Button } from "@astryxdesign/core/Button";
import { IconButton } from "@astryxdesign/core/IconButton";
import { NumberInput } from "@astryxdesign/core/NumberInput";
import { Table } from "@astryxdesign/core/Table";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Banner } from "@astryxdesign/core/Banner";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Divider } from "@astryxdesign/core/Divider";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { VStack, HStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Heading } from "@astryxdesign/core/Heading";
import { Icon } from "@astryxdesign/core/Icon";
import { Switch } from "@astryxdesign/core/Switch";
import {
  getPositions,
  saveVacationLimits,
  getVacationDeadlineSetting,
  saveVacationDeadlineSetting,
} from "@/lib/apiService";
import {
  ALL_ROLE_FILTER,
  buildRoleNames,
  getRoleDisplayName,
} from "@/lib/roleUtils";

interface LimitRow extends Record<string, unknown> {
  date: string;
  maxPeople: number;
  role: string;
}

interface AdminPanelProps {
  currentDate: Date;
  onClose: () => void;
  onUpdateSuccess: () => void | Promise<void>;
  vacationLimits?: Record<string, VacationLimit>;
  vacationDays?: Record<string, DayInfo>;
}

const AdminPanel = ({
  currentDate,
  onClose,
  onUpdateSuccess,
}: AdminPanelProps) => {
  const [panelDate, setPanelDate] = useState(currentDate);
  const [limits, setLimits] = useState<VacationLimit[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>(ALL_ROLE_FILTER);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(
    null
  );
  // 휴무 입력 마감일 설정 (회사당 한 벌)
  const [deadlineDay, setDeadlineDay] = useState<number>(20);
  const [deadlineEnabled, setDeadlineEnabled] = useState(false);

  useEffect(() => {
    getVacationDeadlineSetting()
      .then((data) => {
        if (typeof data?.deadlineDay === "number") setDeadlineDay(data.deadlineDay);
        setDeadlineEnabled(Boolean(data?.enabled));
      })
      .catch((err) => console.error("휴무 마감일 설정 조회 오류:", err));
  }, []);

  const availableRoles = useMemo(
    () => buildRoleNames({ positions, limits }),
    [positions, limits]
  );

  useEffect(() => {
    setPanelDate(currentDate); // 모달 열릴 때 부모 값으로 초기화
  }, [currentDate]);

  useEffect(() => {
    fetchPanelData();
  }, [panelDate]);

  useEffect(() => {
    if (activeFilter === ALL_ROLE_FILTER) return;

    if (!availableRoles.includes(activeFilter)) {
      setActiveFilter(availableRoles[0] || ALL_ROLE_FILTER);
    }
  }, [activeFilter, availableRoles]);

  const fetchPanelData = async () => {
    try {
      const monthStart = startOfMonth(panelDate);
      const monthEnd = endOfMonth(panelDate);

      // JWT 토큰과 companyId 가져오기
      const token = localStorage.getItem("authToken");
      const companyId = localStorage.getItem("companyId");

      if (!companyId) {
        throw new Error("회사 ID를 찾을 수 없습니다. 다시 로그인해주세요.");
      }

      const headers: Record<string, string> = {};

      // JWT 토큰이 있으면 Authorization 헤더 추가
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const [response, positionsData] = await Promise.all([
        fetch(
          `/api/vacation/limits?start=${format(
            monthStart,
            "yyyy-MM-dd"
          )}&end=${format(monthEnd, "yyyy-MM-dd")}&companyId=${companyId}`,
          {
            headers,
          }
        ),
        getPositions().catch(() => ({ positions: [] })),
      ]);

      if (!response.ok) {
        throw new Error("휴무 제한 정보를 가져오는데 실패했습니다.");
      }

      const data = await response.json();
      const existingLimits = Array.isArray(data.limits) ? data.limits : [];
      const positionList = Array.isArray(positionsData?.positions)
        ? (positionsData.positions as Position[])
        : [];
      const roleNames = buildRoleNames({ positions: positionList, limits: existingLimits });
      const allLimits: VacationLimit[] = [];

      setPositions(positionList);

      let currentDay = monthStart;
      while (currentDay <= monthEnd) {
        const dateStr = format(currentDay, "yyyy-MM-dd");
        roleNames.forEach((roleName) => {
          const matchedLimit = existingLimits.find(
            (limit: VacationLimit) =>
              limit.date === dateStr && limit.role === roleName
          );

          allLimits.push({
            id: matchedLimit?.id,
            date: dateStr,
            maxPeople:
              matchedLimit?.maxPeople !== undefined
                ? matchedLimit.maxPeople
                : 3,
            createdAt: matchedLimit?.createdAt,
            role: roleName,
          });
        });

        currentDay = addDays(currentDay, 1);
      }
      setLimits(allLimits);
    } catch (err) {
      console.error("휴가 제한 조회 오류:", err);
      setError("휴가 제한 조회에 실패했습니다.");
    }
  };

  const handleUpdateLimit = (
    date: string,
    role: string,
    value: number
  ) => {
    const idx = limits.findIndex((l) => l.date === date && l.role === role);
    if (idx === -1) return;
    const newLimits = [...limits];
    newLimits[idx] = { ...newLimits[idx], maxPeople: value };
    setLimits(newLimits);
  };

  const saveChanges = async () => {
    try {
      setIsSaving(true);
      setIsSubmitting(true);
      setError("");

      // companyId 가져오기
      const companyId = localStorage.getItem("companyId");

      if (!companyId) {
        throw new Error("회사 ID를 찾을 수 없습니다. 다시 로그인해주세요.");
      }

      const saveLimits = limits.filter((limit) => limit.role.trim().length > 0);

      await saveVacationLimits(saveLimits);
      await saveVacationDeadlineSetting(deadlineDay, deadlineEnabled);

      // 성공 후 최신 데이터 새로고침
      await onUpdateSuccess();

      setMessage({ type: "success", text: "휴무 제한 설정이 저장되었습니다!" });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      console.error("제한 저장 오류:", err);
      setError("저장 중 오류가 발생했습니다. 다시 시도해주세요.");
      setMessage({ type: "error", text: "저장 중 오류가 발생했습니다." });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setIsSaving(false);
      setIsSubmitting(false);
    }
  };

  const isBusy = isSaving || isSubmitting;

  const rows: LimitRow[] = limits
    .filter((l) => l.role === activeFilter)
    .map((limit) => ({
      date: limit.date,
      maxPeople: limit.maxPeople,
      role: limit.role,
    }));

  return (
    // Dialog가 backdrop·ESC·포커스 트랩을 처리한다. 호출부에서 오버레이를 만들지 않는다.
    <Dialog
      isOpen
      onOpenChange={(open) => { if (!open && !isBusy) onClose(); }}
      purpose="form"
      width={768}
    >
      <Layout
        header={
          <DialogHeader
            title="휴가 제한 설정"
            onOpenChange={(open) => { if (!open && !isBusy) onClose(); }}
          />
        }
        content={
          <LayoutContent>
      <VStack gap={4}>
        {/* 월 이동 */}
        <HStack gap={3} vAlign="center" hAlign="center">
          <IconButton
            label="이전 달"
            icon={<Icon icon="chevronLeft" />}
            variant="secondary"
            onClick={() => setPanelDate((prev) => subMonths(prev, 1))}
            isDisabled={isBusy}
          />
          <Heading level={2}>
            {format(panelDate, "yyyy년 MM월", { locale: ko })}
          </Heading>
          <IconButton
            label="다음 달"
            icon={<Icon icon="chevronRight" />}
            variant="secondary"
            onClick={() => setPanelDate((prev) => addMonths(prev, 1))}
            isDisabled={isBusy}
          />
        </HStack>

        {error && <Banner status="error" title={error} />}
        {message && message.type === "success" && (
          <Banner status="success" title={message.text} />
        )}

        {/* 로딩 인디케이터 */}
        {isBusy && (
          <HStack gap={2} vAlign="center">
            <Spinner size="sm" />
            <Text color="accent">저장 중... 기다려주세요.</Text>
          </HStack>
        )}

        {/* 휴무 입력 마감일 설정 */}
        <Card variant="muted" padding={4}>
          <VStack gap={3}>
            <Switch
              label="휴무 입력 마감일 사용"
              value={deadlineEnabled}
              onChange={(checked) => setDeadlineEnabled(checked)}
              labelPosition="start"
              labelSpacing="spread"
              isDisabled={isBusy}
            />
            {deadlineEnabled && (
              <HStack gap={3} vAlign="center">
                <Text>매월</Text>
                <div style={{ width: 96 }}>
                  <NumberInput
                    label="마감일"
                    isLabelHidden
                    value={deadlineDay}
                    min={1}
                    max={31}
                    isIntegerOnly
                    onChange={(value) => setDeadlineDay(value || 20)}
                    isDisabled={isBusy}
                  />
                </div>
                <Text>일까지 다음 달 휴무를 입력받습니다</Text>
              </HStack>
            )}
            <Text type="supporting" color="secondary">
              마감일이 지나도 휴무 인원이 제한을 초과한 날짜가 남아 있으면, 그 날짜에
              신청한 직원들에게 조정 요청 알림을 매일 보냅니다.
            </Text>
          </VStack>
        </Card>

        {/* 역할 필터 */}
        <HStack hAlign="center">
          <SegmentedControl
            value={activeFilter}
            onChange={(value) => setActiveFilter(value)}
            label="역할 필터"
          >
            <SegmentedControlItem value={ALL_ROLE_FILTER} label="전체" />
            {availableRoles.map((role) => (
              <SegmentedControlItem
                key={role}
                value={role}
                label={getRoleDisplayName(role)}
              />
            ))}
          </SegmentedControl>
        </HStack>

        {/* 본문 */}
        <div style={{ overflowY: "auto", maxHeight: "60vh" }}>
          {availableRoles.length === 0 ? (
            <EmptyState
              title="설정할 역할이 없습니다."
              description="회원관리의 역할관리에서 역할을 먼저 등록해주세요."
            />
          ) : activeFilter === ALL_ROLE_FILTER ? (
            <EmptyState
              title="역할을 선택하면 해당 역할별 휴가 제한을 설정할 수 있습니다."
              description="회원관리의 역할관리에서 등록한 역할이 여기서 함께 표시됩니다."
            />
          ) : (
            <Table
              data={rows}
              idKey={(item) => `${item.date}-${item.role}`}
              isStriped
              hasHover
              columns={[
                {
                  key: "date",
                  header: "날짜",
                  renderCell: (row) => (
                    <Text weight="medium">
                      {format(new Date(row.date), "yyyy-MM-dd (EEE)", {
                        locale: ko,
                      })}
                    </Text>
                  ),
                },
                {
                  key: "maxPeople",
                  header: `${getRoleDisplayName(activeFilter)} 최대 인원`,
                  renderCell: (row) => (
                    <NumberInput
                      label={`${getRoleDisplayName(activeFilter)} 인원`}
                      isLabelHidden
                      value={row.maxPeople}
                      min={0}
                      isIntegerOnly
                      placeholder={`${getRoleDisplayName(activeFilter)} 인원`}
                      onChange={(value) =>
                        handleUpdateLimit(row.date, row.role, value || 0)
                      }
                      isDisabled={isBusy}
                    />
                  ),
                },
              ]}
            />
          )}
        </div>

      </VStack>
          </LayoutContent>
        }
        footer={
          <LayoutFooter hasDivider>
            <HStack gap={2} hAlign="end">
              <Button
                label="취소"
                variant="secondary"
                onClick={onClose}
                isDisabled={isBusy}
              />
              <Button
                label="저장"
                variant="primary"
                onClick={saveChanges}
                isLoading={isBusy}
                isDisabled={isBusy || availableRoles.length === 0}
              />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  );
};

export default AdminPanel;
