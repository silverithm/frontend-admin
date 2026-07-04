"use client";

import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { FiTrash2 } from "react-icons/fi";
import { Card } from "@astryxdesign/core/Card";
import { Button } from "@astryxdesign/core/Button";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Badge } from "@astryxdesign/core/Badge";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { Selector } from "@astryxdesign/core/Selector";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import {
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableCell,
    TableHeaderCell,
} from "@astryxdesign/core/Table";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Layout, LayoutContent, LayoutFooter } from "@astryxdesign/core/Layout";
import { VStack, HStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Icon } from "@astryxdesign/core/Icon";
import { Spinner } from "@astryxdesign/core/Spinner";
import {
    VacationRequest,
    VacationLimit,
    VACATION_DURATION_OPTIONS,
    VacationDuration,
} from "@/types/vacation";
import {
    deleteVacation as apiDeleteVacation,
    approveVacation,
    rejectVacation,
    getVacationCalendar,
    getVacationLimits,
    getAllVacationRequests,
    getVacationForDate,
    bulkApproveVacations,
    bulkRejectVacations,
} from "@/lib/apiService";

interface VacationApprovalProps {
    onNotification: (message: string, type: "success" | "error" | "info") => void;
}

export function VacationApproval({ onNotification }: VacationApprovalProps) {
    // State
    const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
    const [allRequests, setAllRequests] = useState<VacationRequest[]>([]);
    const [roleFilter, setRoleFilter] = useState<"all" | "caregiver" | "office">("all");
    const [nameFilter, setNameFilter] = useState<string | null>(null);
    const [sortOrder, setSortOrder] = useState<"latest" | "oldest" | "vacation-date-asc" | "vacation-date-desc" | "name" | "role">("latest");
    const [selectedVacationIds, setSelectedVacationIds] = useState<Set<string>>(new Set());
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [isLoadingRequests, setIsLoadingRequests] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [currentDate] = useState(new Date());
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [selectedDeleteVacation, setSelectedDeleteVacation] = useState<VacationRequest | null>(null);

    // Fetch vacation data on mount
    useEffect(() => {
        fetchMonthData();
    }, []);

    const fetchMonthData = async () => {
        setIsLoadingRequests(true);
        try {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth();
            const startDate = new Date(year, month, 1);
            const endDate = new Date(year, month + 1, 0);
            const startDateStr = format(startDate, "yyyy-MM-dd");
            const endDateStr = format(endDate, "yyyy-MM-dd");

            const calendarData = await getVacationCalendar(
                startDateStr,
                endDateStr,
                roleFilter
            );

            const dates = calendarData.dates || {};

            // Extract all vacation requests from calendar data
            const allVacations: VacationRequest[] = [];
            Object.values(dates).forEach((dateData: any) => {
                if (dateData && dateData.vacations && Array.isArray(dateData.vacations)) {
                    allVacations.push(...dateData.vacations);
                }
            });

            setAllRequests(allVacations);
        } catch (error) {
            console.error("월별 휴무 데이터 로드 중 오류 발생:", error);
            onNotification(
                "월별 휴무 데이터를 불러오는 중 오류가 발생했습니다.",
                "error"
            );
        } finally {
            setIsLoadingRequests(false);
        }
    };

    // Filter and sort requests
    const filteredRequests = useMemo(() => {
        if (!Array.isArray(allRequests)) {
            console.warn("allRequests가 배열이 아닙니다:", allRequests);
            return [];
        }

        let filtered = allRequests;

        // Filter by selected date
        if (selectedDate) {
            const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
            filtered = filtered.filter((request) => request.date === selectedDateStr);
        }

        if (statusFilter !== "all") {
            filtered = filtered.filter((request) => request.status === statusFilter);
        }
        if (roleFilter !== "all") {
            filtered = filtered.filter((request) => request.role === roleFilter);
        }
        if (nameFilter) {
            filtered = filtered.filter((request) => request.userName === nameFilter);
        }

        if (!Array.isArray(filtered)) {
            console.warn("filtered가 배열이 아닙니다:", filtered);
            return [];
        }

        let sorted = [...filtered];
        switch (sortOrder) {
            case "latest":
                sorted.sort(
                    (a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0)
                );
                break;
            case "oldest":
                sorted.sort(
                    (a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0)
                );
                break;
            case "vacation-date-asc":
                sorted.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
                break;
            case "vacation-date-desc":
                sorted.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
                break;
            case "name":
                sorted.sort((a, b) =>
                    (a.userName || "").localeCompare(b.userName || "")
                );
                break;
            case "role":
                sorted.sort((a, b) => {
                    const roleOrder = { caregiver: 0, office: 1 };
                    const aOrder = roleOrder[a.role as keyof typeof roleOrder] ?? 2;
                    const bOrder = roleOrder[b.role as keyof typeof roleOrder] ?? 2;

                    if (aOrder !== bOrder) {
                        return aOrder - bOrder;
                    }
                    return (a.userName || "").localeCompare(b.userName || "");
                });
                break;
        }
        return sorted;
    }, [
        allRequests,
        statusFilter,
        roleFilter,
        nameFilter,
        sortOrder,
        selectedDate,
    ]);

    // Handler functions
    const handleApproveVacation = async (vacationId: string) => {
        setIsProcessing(true);
        try {
            await approveVacation(vacationId);
            onNotification("휴무 요청이 승인되었습니다.", "success");
            await fetchMonthData();
        } catch (error) {
            console.error("휴무 승인 중 상세 오류:", error);
            onNotification(
                `휴무 승인 중 오류가 발생했습니다: ${(error as Error).message}`,
                "error"
            );
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRejectVacation = async (vacationId: string) => {
        setIsProcessing(true);
        try {
            await rejectVacation(vacationId);
            onNotification("휴무 요청이 거절되었습니다.", "success");
            await fetchMonthData();
        } catch (error) {
            console.error("휴무 거절 중 상세 오류:", error);
            onNotification(
                `휴무 거절 중 오류가 발생했습니다: ${(error as Error).message}`,
                "error"
            );
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDeleteVacation = (vacation: VacationRequest) => {
        setSelectedDeleteVacation(vacation);
        setShowDeleteConfirm(true);
    };

    const confirmDelete = async () => {
        if (!selectedDeleteVacation) return;

        setIsProcessing(true);
        try {
            await apiDeleteVacation(selectedDeleteVacation.id, { isAdmin: true });
            onNotification("휴무가 삭제되었습니다.", "success");
            setShowDeleteConfirm(false);
            setSelectedDeleteVacation(null);
            await fetchMonthData();
        } catch (error) {
            console.error("휴무 삭제 중 오류 발생:", error);
            onNotification("휴무 삭제 중 오류가 발생했습니다.", "error");
        } finally {
            setIsProcessing(false);
        }
    };

    const cancelDelete = () => {
        setShowDeleteConfirm(false);
        setSelectedDeleteVacation(null);
    };

    const handleBulkApprove = async () => {
        if (selectedVacationIds.size === 0) {
            onNotification("선택된 휴무 요청이 없습니다.", "info");
            return;
        }

        setIsProcessing(true);
        try {
            const vacationIds = Array.from(selectedVacationIds);
            const response = await bulkApproveVacations(vacationIds);

            onNotification(
                `${vacationIds.length}개의 휴무 요청이 승인되었습니다.`,
                "success"
            );

            setSelectedVacationIds(new Set());
            setIsSelectMode(false);
            await fetchMonthData();
        } catch (error) {
            console.error("일괄 승인 실패:", error);
            onNotification(
                `일괄 승인 중 오류가 발생했습니다: ${(error as Error).message}`,
                "error"
            );
        } finally {
            setIsProcessing(false);
        }
    };

    const handleBulkReject = async () => {
        if (selectedVacationIds.size === 0) {
            onNotification("선택된 휴무 요청이 없습니다.", "info");
            return;
        }

        setIsProcessing(true);
        try {
            const vacationIds = Array.from(selectedVacationIds);
            const response = await bulkRejectVacations(vacationIds);

            onNotification(
                `${vacationIds.length}개의 휴무 요청이 거절되었습니다.`,
                "success"
            );

            setSelectedVacationIds(new Set());
            setIsSelectMode(false);
            await fetchMonthData();
        } catch (error) {
            console.error("일괄 거절 실패:", error);
            onNotification(
                `일괄 거절 중 오류가 발생했습니다: ${(error as Error).message}`,
                "error"
            );
        } finally {
            setIsProcessing(false);
        }
    };

    const handleToggleSelection = (vacationId: string) => {
        setSelectedVacationIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(vacationId)) {
                newSet.delete(vacationId);
            } else {
                newSet.add(vacationId);
            }
            return newSet;
        });
    };

    const handleSelectAll = () => {
        const pendingIds = filteredRequests
            .filter(req => req.status === 'pending')
            .map(req => req.id);

        if (selectedVacationIds.size === pendingIds.length) {
            setSelectedVacationIds(new Set());
        } else {
            setSelectedVacationIds(new Set(pendingIds));
        }
    };

    const toggleStatusFilter = (status: "all" | "pending" | "approved" | "rejected") =>
        setStatusFilter(status);
    const toggleRoleFilter = (role: "all" | "caregiver" | "office") =>
        setRoleFilter(role);
    const toggleSortOrder = (
        order: "latest" | "oldest" | "vacation-date-asc" | "vacation-date-desc" | "name" | "role"
    ) => setSortOrder(order);

    const resetFilter = async () => {
        setStatusFilter("all");
        setRoleFilter("all");
        setNameFilter(null);
        setSortOrder("latest");
        await fetchMonthData();
    };

    // Helper functions
    const formatDate = (dateValue: any): string => {
        if (!dateValue) return "";

        let date: Date;

        if (dateValue instanceof Date) {
            date = dateValue;
        } else if (typeof dateValue === "string") {
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
                date = new Date(dateValue + "T00:00:00.000Z");
            } else {
                date = new Date(dateValue);
            }
        } else if (typeof dateValue === "number") {
            if (dateValue.toString().length === 10) {
                date = new Date(dateValue * 1000);
            } else {
                date = new Date(dateValue);
            }
        } else {
            console.warn("알 수 없는 날짜 형식:", dateValue);
            return "";
        }

        if (isNaN(date.getTime())) {
            console.warn("유효하지 않은 날짜:", dateValue);
            return "";
        }

        return date.toLocaleDateString("ko-KR");
    };

    const formatVacationDate = (dateValue: any): string => {
        if (!dateValue) return "-";

        try {
            const date = new Date(dateValue);
            const now = new Date();
            const diffTime = Math.abs(date.getTime() - now.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays === 0) {
                return "오늘";
            } else if (diffDays === 1) {
                return date > now ? "내일" : "어제";
            } else if (diffDays <= 7) {
                return date > now ? `${diffDays}일 후` : `${diffDays}일 전`;
            } else {
                return format(date, "MM/dd", { locale: ko });
            }
        } catch (error) {
            return "-";
        }
    };

    const getDurationText = (duration?: VacationDuration) => {
        const option = VACATION_DURATION_OPTIONS.find(
            (opt) => opt.value === duration
        );
        return option ? option.displayName : "연차";
    };

    const isValidDuration = (duration?: VacationDuration) => {
        return (
            duration &&
            VACATION_DURATION_OPTIONS.find((opt) => opt.value === duration)
        );
    };

    const getVacationTypeText = (type?: string) => {
        switch (type) {
            case "regular":
                return "일반 휴무";
            case "mandatory":
                return "필수 휴무";
            case "personal":
                return "개인 휴무";
            case "sick":
                return "병가";
            case "emergency":
                return "긴급 휴무";
            case "family":
                return "가족 돌봄 휴무";
            default:
                return type || "일반 휴무";
        }
    };

    const getStatusText = (status?: string) => {
        switch (status) {
            case "approved":
                return "승인됨";
            case "pending":
                return "대기중";
            case "rejected":
                return "거부됨";
            default:
                return status || "알 수 없음";
        }
    };

    const getRoleText = (role?: string) => {
        switch (role) {
            case "caregiver":
                return "요양보호사";
            case "office":
                return "사무직";
            case "admin":
                return "관리자";
            default:
                return role || "직원";
        }
    };

    const getStatusVariant = (
        status?: string
    ): "success" | "warning" | "error" | "neutral" => {
        switch (status) {
            case "approved":
                return "success";
            case "pending":
                return "warning";
            case "rejected":
                return "error";
            default:
                return "neutral";
        }
    };

    const pendingCount = filteredRequests.filter(
        (req) => req.status === "pending"
    ).length;

    return (
        <div className="carev-vacapproval-layout">
            {/* 휴무 목록 (좌측 메인) */}
            <div className="carev-vacapproval-main">
                <Card>
                    <VStack gap={3}>
                        {/* 헤더 */}
                        <HStack hAlign="between" vAlign="center">
                            <Text weight="semibold" color="primary">
                                {selectedDate
                                    ? `${format(selectedDate, "yyyy년 MM월 dd일", { locale: ko })} 휴무 목록`
                                    : "전체 휴무 목록"}
                            </Text>
                            <HStack gap={2} vAlign="center">
                                {selectedDate && (
                                    <Button
                                        label="전체 보기"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setSelectedDate(null)}
                                    />
                                )}
                                {pendingCount > 0 && (
                                    <Button
                                        label={isSelectMode ? "선택 취소" : "다중 선택"}
                                        variant={isSelectMode ? "primary" : "secondary"}
                                        size="sm"
                                        onClick={() => {
                                            setIsSelectMode(!isSelectMode);
                                            setSelectedVacationIds(new Set());
                                        }}
                                    />
                                )}
                            </HStack>
                        </HStack>

                        {/* 일괄 작업 바 */}
                        {isSelectMode && (
                            <Card variant="teal" padding={2}>
                                <HStack hAlign="between" vAlign="center">
                                    <HStack gap={2} vAlign="center">
                                        <Button
                                            label={
                                                selectedVacationIds.size === pendingCount
                                                    ? "전체 해제"
                                                    : "전체 선택"
                                            }
                                            variant="secondary"
                                            size="sm"
                                            onClick={handleSelectAll}
                                        />
                                        <Text type="supporting" weight="medium" color="accent">
                                            {selectedVacationIds.size}개
                                        </Text>
                                    </HStack>
                                    <HStack gap={2}>
                                        <Button
                                            label="승인"
                                            variant="primary"
                                            size="sm"
                                            isLoading={isProcessing}
                                            isDisabled={selectedVacationIds.size === 0 || isProcessing}
                                            onClick={handleBulkApprove}
                                        />
                                        <Button
                                            label="거절"
                                            variant="destructive"
                                            size="sm"
                                            isLoading={isProcessing}
                                            isDisabled={selectedVacationIds.size === 0 || isProcessing}
                                            onClick={handleBulkReject}
                                        />
                                    </HStack>
                                </HStack>
                            </Card>
                        )}

                        {isLoadingRequests ? (
                            <HStack hAlign="center" vAlign="center">
                                <Spinner label="불러오는 중..." />
                            </HStack>
                        ) : filteredRequests.length === 0 ? (
                            <HStack hAlign="center">
                                <Text type="supporting" color="secondary">
                                    조건에 맞는 휴무 요청이 없습니다.
                                </Text>
                            </HStack>
                        ) : (
                            <div style={{ maxHeight: "80vh", overflow: "auto" }}>
                                <Table density="compact" hasHover>
                                    <TableHeader>
                                        <TableRow isHeaderRow>
                                            {isSelectMode && <TableHeaderCell> </TableHeaderCell>}
                                            <TableHeaderCell>이름</TableHeaderCell>
                                            <TableHeaderCell>날짜</TableHeaderCell>
                                            <TableHeaderCell>직무</TableHeaderCell>
                                            <TableHeaderCell>유형</TableHeaderCell>
                                            <TableHeaderCell>기간</TableHeaderCell>
                                            <TableHeaderCell>상태</TableHeaderCell>
                                            <TableHeaderCell>작업</TableHeaderCell>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredRequests.map((request) => (
                                            <TableRow key={request.id}>
                                                {isSelectMode && (
                                                    <TableCell>
                                                        {request.status === "pending" && (
                                                            <CheckboxInput
                                                                label="선택"
                                                                isLabelHidden
                                                                size="sm"
                                                                value={selectedVacationIds.has(request.id)}
                                                                onChange={() =>
                                                                    handleToggleSelection(request.id)
                                                                }
                                                            />
                                                        )}
                                                    </TableCell>
                                                )}
                                                <TableCell>
                                                    <span
                                                        onClick={() =>
                                                            setNameFilter(
                                                                nameFilter === request.userName
                                                                    ? null
                                                                    : request.userName
                                                            )
                                                        }
                                                        style={{ cursor: "pointer" }}
                                                        title={`${request.userName} 필터`}
                                                    >
                                                        <Text
                                                            weight={
                                                                nameFilter === request.userName
                                                                    ? "bold"
                                                                    : "medium"
                                                            }
                                                            color={
                                                                nameFilter === request.userName
                                                                    ? "accent"
                                                                    : "primary"
                                                            }
                                                        >
                                                            {request.userName}
                                                        </Text>
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <Text type="supporting" color="secondary">
                                                        {formatVacationDate(request.date)}
                                                    </Text>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant={
                                                            request.role === "caregiver"
                                                                ? "blue"
                                                                : "green"
                                                        }
                                                        label={getRoleText(request.role)}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant={
                                                            request.type === "mandatory"
                                                                ? "orange"
                                                                : "neutral"
                                                        }
                                                        label={getVacationTypeText(request.type)}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    {isValidDuration(request.duration) && (
                                                        <Badge
                                                            variant="teal"
                                                            label={getDurationText(request.duration)}
                                                        />
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant={getStatusVariant(request.status)}
                                                        label={getStatusText(request.status)}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <HStack gap={1} hAlign="end" vAlign="center">
                                                        {request.status === "pending" && (
                                                            <>
                                                                <Button
                                                                    label="승인"
                                                                    variant="secondary"
                                                                    size="sm"
                                                                    onClick={() =>
                                                                        handleApproveVacation(request.id)
                                                                    }
                                                                />
                                                                <Button
                                                                    label="거절"
                                                                    variant="destructive"
                                                                    size="sm"
                                                                    onClick={() =>
                                                                        handleRejectVacation(request.id)
                                                                    }
                                                                />
                                                            </>
                                                        )}
                                                        <IconButton
                                                            label="삭제"
                                                            tooltip="삭제"
                                                            variant="ghost"
                                                            size="sm"
                                                            icon={<Icon icon={FiTrash2} />}
                                                            onClick={() =>
                                                                handleDeleteVacation(request)
                                                            }
                                                        />
                                                    </HStack>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </VStack>
                </Card>
            </div>

            {/* 필터 패널 (우측 사이드바) */}
            <div className="carev-vacapproval-sidebar">
                <div style={{ position: "sticky", top: 16 }}>
                    <Card padding={3}>
                        <VStack gap={3}>
                            <Text weight="semibold" color="primary">
                                필터
                            </Text>

                            {/* 상태 */}
                            <VStack gap={1}>
                                <Text type="label" color="secondary">
                                    상태
                                </Text>
                                <SegmentedControl
                                    value={statusFilter}
                                    onChange={(value) =>
                                        toggleStatusFilter(
                                            value as "all" | "pending" | "approved" | "rejected"
                                        )
                                    }
                                    label="상태 필터"
                                    size="sm"
                                    layout="fill"
                                >
                                    <SegmentedControlItem value="all" label="전체" />
                                    <SegmentedControlItem value="pending" label="대기" />
                                    <SegmentedControlItem value="approved" label="승인" />
                                    <SegmentedControlItem value="rejected" label="거부" />
                                </SegmentedControl>
                            </VStack>

                            {/* 직원 */}
                            <Selector
                                label="직원"
                                value={roleFilter}
                                onChange={(value) =>
                                    toggleRoleFilter(value as "all" | "caregiver" | "office")
                                }
                                options={[
                                    { value: "all", label: "전체" },
                                    { value: "caregiver", label: "요양보호사" },
                                    { value: "office", label: "사무직" },
                                ]}
                            />

                            {/* 정렬 */}
                            <Selector
                                label="정렬"
                                value={sortOrder}
                                onChange={(value) =>
                                    toggleSortOrder(
                                        value as
                                            | "latest"
                                            | "oldest"
                                            | "vacation-date-asc"
                                            | "vacation-date-desc"
                                            | "name"
                                            | "role"
                                    )
                                }
                                options={[
                                    { value: "latest", label: "최신순" },
                                    { value: "name", label: "이름순" },
                                    { value: "role", label: "직무순" },
                                ]}
                            />

                            {/* 이름 필터 */}
                            {nameFilter && (
                                <VStack gap={1}>
                                    <Text type="label" color="secondary">
                                        선택된 직원
                                    </Text>
                                    <Card variant="teal" padding={2}>
                                        <HStack hAlign="between" vAlign="center">
                                            <Text
                                                type="supporting"
                                                weight="medium"
                                                color="accent"
                                            >
                                                {nameFilter}
                                            </Text>
                                            <IconButton
                                                label="필터 해제"
                                                tooltip="필터 해제"
                                                variant="ghost"
                                                size="sm"
                                                icon={<Icon icon="close" />}
                                                onClick={() => setNameFilter(null)}
                                            />
                                        </HStack>
                                    </Card>
                                </VStack>
                            )}

                            {/* 초기화 */}
                            <div style={{ display: "grid" }}>
                                <Button
                                    label="초기화"
                                    variant="secondary"
                                    size="sm"
                                    onClick={resetFilter}
                                />
                            </div>
                        </VStack>
                    </Card>
                </div>
            </div>

            {/* 삭제 확인 모달 */}
            <Dialog
                isOpen={showDeleteConfirm && !!selectedDeleteVacation}
                onOpenChange={(open) => {
                    if (!open) cancelDelete();
                }}
                purpose="info"
                width={400}
            >
                {selectedDeleteVacation && (
                    <Layout
                        header={
                            <DialogHeader
                                title="휴무 삭제 확인"
                                onOpenChange={(open) => {
                                    if (!open) cancelDelete();
                                }}
                            />
                        }
                        content={
                            <LayoutContent>
                                <HStack gap={3} vAlign="start">
                                    <Icon icon="warning" color="error" size="lg" />
                                    <VStack gap={1}>
                                        <Text color="primary">
                                            <Text weight="semibold" color="primary">
                                                {selectedDeleteVacation.userName}
                                            </Text>
                                            님의{" "}
                                            <Text weight="semibold" color="primary">
                                                {selectedDeleteVacation.date}
                                            </Text>{" "}
                                            휴무를 정말 삭제하시겠습니까?
                                        </Text>
                                        <Text type="supporting" color="secondary">
                                            이 작업은 되돌릴 수 없습니다.
                                        </Text>
                                    </VStack>
                                </HStack>
                            </LayoutContent>
                        }
                        footer={
                            <LayoutFooter hasDivider>
                                <HStack gap={2} hAlign="end">
                                    <Button
                                        label="취소"
                                        variant="ghost"
                                        isDisabled={isProcessing}
                                        onClick={cancelDelete}
                                    />
                                    <Button
                                        label="삭제하기"
                                        variant="destructive"
                                        isLoading={isProcessing}
                                        isDisabled={isProcessing}
                                        onClick={confirmDelete}
                                    />
                                </HStack>
                            </LayoutFooter>
                        }
                    />
                )}
            </Dialog>
        </div>
    );
}
