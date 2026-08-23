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
import { DateInput } from "@astryxdesign/core/DateInput";
import type { ISODateString } from "@astryxdesign/core/Calendar";
import {
  getPositions,
  saveVacationLimits,
  getVacationDeadlineSetting,
  saveVacationDeadlineSetting,
  getVacationDeadlineDates,
  saveVacationDeadlineDate,
} from "@/lib/apiService";
import {
  ALL_ROLE_FILTER,
  buildRoleNames,
  getRoleDisplayName,
} from "@/lib/roleUtils";

interface LimitRow extends Record<string, unknown> {
  date: string;
  /** '전체' 탭에서 아직 저장 안 된 날짜는 비어 있다 (입력해야 저장 대상이 됨) */
  maxPeople?: number;
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
  // '전체(all)' 한도를 지운 날짜들 — 저장 시 null 표식으로 보내야 서버 행이 실제로
  // 삭제된다 (저장 API는 페이로드에 없는 행을 건드리지 않는 upsert라서, 목록에서
  // 빼기만 하면 DB에 남은 한도가 계속 신청을 막는다)
  const [clearedAllDates, setClearedAllDates] = useState<Set<string>>(new Set());
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
  // 켜면 직원은 바로 다음 달 휴무만 신청할 수 있다 (마감일과는 별개 스위치)
  const [nextMonthOnly, setNextMonthOnly] = useState(false);
  // 달마다 직접 지정한 마감일 — { "2026-08": "2026-08-16" }. 지정된 달은 고정일보다 우선한다
  const [deadlineDates, setDeadlineDates] = useState<Record<string, string>>({});

  useEffect(() => {
    getVacationDeadlineSetting()
      .then((data) => {
        if (typeof data?.deadlineDay === "number") setDeadlineDay(data.deadlineDay);
        setDeadlineEnabled(Boolean(data?.enabled));
        setNextMonthOnly(Boolean(data?.nextMonthOnly));
      })
      .catch((err) => console.error("휴무 마감일 설정 조회 오류:", err));
    getVacationDeadlineDates()
      .then(setDeadlineDates)
      .catch((err) => console.error("월별 마감일 조회 오류:", err));
  }, []);

  const panelMonthKey = format(panelDate, "yyyy-MM");
  const panelMonthDeadline = deadlineDates[panelMonthKey] ?? null;

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

        // '전체(all)' 한도는 직종과 무관한 그 날짜 총인원 제한 —
        // 서버에 저장된 날짜만 담는다. 직종처럼 매일 기본 3을 만들어 저장하면
        // 모든 기관에 전체 3명 제한이 생겨버린다.
        const matchedAll = existingLimits.find(
          (limit: VacationLimit) =>
            limit.date === dateStr && limit.role === ALL_ROLE_FILTER
        );
        if (matchedAll) {
          allLimits.push({
            id: matchedAll.id,
            date: dateStr,
            maxPeople: matchedAll.maxPeople,
            createdAt: matchedAll.createdAt,
            role: ALL_ROLE_FILTER,
          });
        }

        currentDay = addDays(currentDay, 1);
      }
      setLimits(allLimits);
      setClearedAllDates(new Set());
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
    if (role === ALL_ROLE_FILTER) {
      // 지웠다가 다시 입력한 날짜는 삭제 표식을 거둔다
      setClearedAllDates((prev) => {
        if (!prev.has(date)) return prev;
        const next = new Set(prev);
        next.delete(date);
        return next;
      });
    }
    const idx = limits.findIndex((l) => l.date === date && l.role === role);
    if (idx === -1) {
      // '전체(all)' 한도는 저장된 날짜만 목록에 있다 — 처음 입력하는 날짜는 새로 추가
      if (role === ALL_ROLE_FILTER) {
        setLimits((prev) => [...prev, { date, role, maxPeople: value }]);
      }
      return;
    }
    const newLimits = [...limits];
    newLimits[idx] = { ...newLimits[idx], maxPeople: value };
    setLimits(newLimits);
  };

  // NumberInput을 hasClear로 비웠을 때(null) 호출된다.
  const handleClearLimit = (date: string, role: string) => {
    if (role === ALL_ROLE_FILTER) {
      // '전체(all)' 한도는 저장된 날짜만 목록에 있다 — 지우면 그 날짜의 전체 제한
      // 항목 자체를 없애 안내 문구대로 "제한 없음"이 되게 하고, 저장 시 서버 행도
      // 지워지도록 삭제 표식을 남긴다.
      setLimits((prev) => prev.filter((l) => !(l.date === date && l.role === role)));
      setClearedAllDates((prev) => new Set(prev).add(date));
      return;
    }

    // 직종별 한도는 매달 기본값 3이 항상 채워지는 모델이라 '값 없음' 상태가 없다
    // (getMaxRoleLimitForDate의 기본값과 동일). 지우면 그 기본값으로 되돌린다 —
    // 목록에서 행이 사라지면(=필터링에서 빠지면) 오히려 더 헷갈린다.
    handleUpdateLimit(date, role, 3);
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

      // 지운 전체(all) 한도는 null 표식으로 보내 서버가 그 행을 삭제하게 한다
      const allDeletions = [...clearedAllDates]
        .filter((date) => !saveLimits.some((l) => l.date === date && l.role === ALL_ROLE_FILTER))
        .map((date) => ({ date, role: ALL_ROLE_FILTER, maxPeople: null }));

      await saveVacationLimits([...saveLimits, ...allDeletions]);
      await saveVacationDeadlineSetting(deadlineDay, deadlineEnabled, nextMonthOnly);
      // 지금 보고 있는 달의 마감일 지정만 저장한다 (다른 달은 그 달을 열었을 때 저장됨)
      await saveVacationDeadlineDate(panelMonthKey, deadlineDates[panelMonthKey] ?? null);

      setClearedAllDates(new Set());
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

  // '전체' 탭은 저장된 all 행이 없는 날짜도 빈 입력으로 보여준다 (입력해야 저장 대상이 됨)
  const rows: LimitRow[] = activeFilter === ALL_ROLE_FILTER
    ? (() => {
        const monthStart = startOfMonth(panelDate);
        const monthEnd = endOfMonth(panelDate);
        const result: LimitRow[] = [];
        let day = monthStart;
        while (day <= monthEnd) {
          const dateStr = format(day, "yyyy-MM-dd");
          const existing = limits.find(
            (l) => l.date === dateStr && l.role === ALL_ROLE_FILTER
          );
          result.push({
            date: dateStr,
            maxPeople: existing?.maxPeople,
            role: ALL_ROLE_FILTER,
          });
          day = addDays(day, 1);
        }
        return result;
      })()
    : limits
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
              <>
                <HStack gap={3} vAlign="center">
                  <Text>기본은 매월</Text>
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

                {/* 셋째 주 일요일처럼 달마다 날짜가 달라지는 기관을 위해 이번 달만 따로 지정한다.
                    이 달에 지정한 마감일은 '다음 달' 휴무 신청분을 관장한다 — 문구에 명시한다. */}
                <HStack gap={3} vAlign="center" wrap="wrap">
                  <Text>{format(panelDate, "yyyy년 M월", { locale: ko })}은</Text>
                  <div style={{ width: 190 }}>
                    <DateInput
                      label="이 달의 마감일"
                      isLabelHidden
                      value={panelMonthDeadline ? (panelMonthDeadline as ISODateString) : undefined}
                      min={format(startOfMonth(panelDate), "yyyy-MM-dd") as ISODateString}
                      max={format(endOfMonth(panelDate), "yyyy-MM-dd") as ISODateString}
                      onChange={(value) =>
                        setDeadlineDates((prev) => {
                          const next = { ...prev };
                          if (value) next[panelMonthKey] = value;
                          else delete next[panelMonthKey];
                          return next;
                        })
                      }
                      isDisabled={isBusy}
                    />
                  </div>
                  <Text>
                    까지 {format(addMonths(panelDate, 1), "M월", { locale: ko })} 휴무를 받습니다
                  </Text>
                  {panelMonthDeadline ? (
                    <Button
                      label="지정 해제"
                      variant="ghost"
                      size="sm"
                      isDisabled={isBusy}
                      onClick={() =>
                        setDeadlineDates((prev) => {
                          const next = { ...prev };
                          delete next[panelMonthKey];
                          return next;
                        })
                      }
                    />
                  ) : (
                    <Text type="supporting" color="secondary">
                      비워두면 매월 {deadlineDay}일이 적용됩니다
                    </Text>
                  )}
                </HStack>
              </>
            )}
            <Text type="supporting" color="secondary">
              마감일이 지나도 휴무 인원이 제한을 초과한 날짜가 남아 있으면, 그 날짜에
              신청한 직원들에게 조정 요청 알림을 매일 보냅니다. 지정한 마감일은 달력에 별표로
              표시됩니다.
            </Text>

            <Divider />

            <Switch
              label="다음 달 휴무만 신청받기"
              value={nextMonthOnly}
              onChange={(checked) => setNextMonthOnly(checked)}
              labelPosition="start"
              labelSpacing="spread"
              isDisabled={isBusy}
            />
            <Text type="supporting" color="secondary">
              켜면 직원은 바로 다음 달 날짜만 고를 수 있습니다. 근무표를 달 단위로 짜실 때
              몇 달 뒤 휴무가 미리 들어와 표가 흔들리는 걸 막아줍니다.
              관리자가 대신 등록하시는 건 이 제한을 받지 않습니다.
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
          ) : (
            <VStack gap={2}>
              {activeFilter === ALL_ROLE_FILTER && (
                <Text type="supporting" color="secondary">
                  직종과 무관하게 그 날짜에 쉴 수 있는 총인원을 제한합니다. 직종별 제한과
                  함께 적용되며, 비워둔 날짜는 전체 제한이 없습니다.
                </Text>
              )}
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
                    header: activeFilter === ALL_ROLE_FILTER
                      ? "전체 최대 인원 (직종 무관)"
                      : `${getRoleDisplayName(activeFilter)} 최대 인원`,
                    renderCell: (row) => (
                      <NumberInput
                        label={`${getRoleDisplayName(activeFilter)} 인원`}
                        isLabelHidden
                        value={row.maxPeople}
                        min={0}
                        isIntegerOnly
                        hasClear
                        placeholder={activeFilter === ALL_ROLE_FILTER
                          ? "제한 없음"
                          : `${getRoleDisplayName(activeFilter)} 인원`}
                        onChange={(value) => {
                          if (value === null) {
                            handleClearLimit(row.date, row.role);
                          } else {
                            handleUpdateLimit(row.date, row.role, value);
                          }
                        }}
                        isDisabled={isBusy}
                      />
                    ),
                  },
                ]}
              />
            </VStack>
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
