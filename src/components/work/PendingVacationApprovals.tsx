"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format, endOfMonth, startOfMonth } from "date-fns";
import { Card } from "@astryxdesign/core/Card";
import { Button } from "@astryxdesign/core/Button";
import { Text } from "@astryxdesign/core/Text";
import { Badge } from "@astryxdesign/core/Badge";
import { Divider } from "@astryxdesign/core/Divider";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Spinner } from "@astryxdesign/core/Spinner";
import { VStack, HStack, StackItem } from "@astryxdesign/core/Stack";

import { approveVacation, bulkApproveVacations, getAllVacationRequests, rejectVacation } from "@/lib/apiService";
import type { VacationRequest } from "@/types/vacation";

/**
 * 휴무 신청 승인 패널 — **근무조정 관리 권한을 받은 직원**이 쓰는 자리.
 *
 * 권한(WORK_MANAGE)을 켜 줘도 정작 승인할 화면이 직원 쪽에 없었다. 사무국장님께 권한을
 * 전부 켜 두고도 "관리자랑 근무 조정 승인하는 기능을 쓸 수 없다"는 제보가 그것이다.
 *
 * 관리자 화면의 근무조정 사이드바는 그 화면의 상태와 깊게 얽혀 있어 통째로 옮기면
 * 관리자 화면 전체가 위험해진다. 그래서 승인에 필요한 것만 독립된 패널로 새로 만든다 —
 * 관리자 화면은 한 줄도 건드리지 않는다.
 */
export function PendingVacationApprovals({
    currentDate,
    onChanged,
    onNotification,
}: {
    /** 보고 있는 달 — 이 달의 신청만 다룬다 */
    currentDate: Date;
    /** 승인·거절 뒤 달력을 다시 그리게 한다 */
    onChanged?: () => void;
    onNotification?: (message: string, type: "success" | "error") => void;
}) {
    const [requests, setRequests] = useState<VacationRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [isBulkRunning, setIsBulkRunning] = useState(false);

    const monthStart = format(startOfMonth(currentDate), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(currentDate), "yyyy-MM-dd");

    const load = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await getAllVacationRequests();
            // 백엔드 응답은 래퍼 객체로 온다 — 배열을 직접 넣지 않는다
            const list: VacationRequest[] = Array.isArray(data)
                ? data
                : (data?.requests || data?.content || data?.data || []);
            setRequests(list);
        } catch (error) {
            console.error("휴무 신청 조회 실패:", error);
            onNotification?.("휴무 신청을 불러오지 못했습니다.", "error");
            setRequests([]);
        } finally {
            setIsLoading(false);
        }
    }, [onNotification]);

    useEffect(() => {
        load();
    }, [load]);

    /** 보고 있는 달의 대기 중인 신청만 — 전 기간을 열면 실수로 옛 신청까지 승인된다 */
    const pending = useMemo(
        () =>
            requests
                .filter((request) => request.status === "pending")
                .filter((request) => request.date >= monthStart && request.date <= monthEnd)
                .sort((a, b) => a.date.localeCompare(b.date)),
        [requests, monthStart, monthEnd],
    );

    const afterChange = async (message: string) => {
        onNotification?.(message, "success");
        await load();
        onChanged?.();
    };

    const handleApprove = async (request: VacationRequest) => {
        setProcessingId(request.id);
        try {
            await approveVacation(request.id);
            await afterChange(`${request.userName}님의 휴무를 승인했습니다.`);
        } catch (error) {
            console.error("승인 실패:", error);
            onNotification?.("승인에 실패했습니다.", "error");
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (request: VacationRequest) => {
        setProcessingId(request.id);
        try {
            await rejectVacation(request.id);
            await afterChange(`${request.userName}님의 휴무를 반려했습니다.`);
        } catch (error) {
            console.error("반려 실패:", error);
            onNotification?.("반려에 실패했습니다.", "error");
        } finally {
            setProcessingId(null);
        }
    };

    const handleApproveAll = async () => {
        if (pending.length === 0) return;
        setIsBulkRunning(true);
        try {
            await bulkApproveVacations(pending.map((request) => request.id));
            await afterChange(`${pending.length}건을 승인했습니다.`);
        } catch (error) {
            console.error("일괄 승인 실패:", error);
            onNotification?.("일괄 승인에 실패했습니다.", "error");
        } finally {
            setIsBulkRunning(false);
        }
    };

    return (
        <Card padding={3} style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <VStack gap={2} style={{ flex: 1, minHeight: 0 }}>
                <HStack hAlign="between" vAlign="center">
                    <HStack gap={2} vAlign="center">
                        <Text type="body" weight="medium" color="primary">승인 대기</Text>
                        <Badge label={`${pending.length}`} variant={pending.length > 0 ? "red" : "neutral"} />
                    </HStack>
                    <Button
                        label="모두 승인"
                        variant="secondary"
                        size="sm"
                        isDisabled={pending.length === 0 || isBulkRunning}
                        isLoading={isBulkRunning}
                        onClick={handleApproveAll}
                    />
                </HStack>

                <Text type="supporting" color="secondary">
                    {format(currentDate, "yyyy년 M월")}에 신청된 휴무입니다
                </Text>

                <Divider />

                <StackItem size="fill">
                    <div style={{ height: "100%", overflowY: "auto" }}>
                        {isLoading ? (
                            <div style={{ display: "flex", justifyContent: "center", padding: "var(--spacing-6)" }}>
                                <Spinner />
                            </div>
                        ) : pending.length === 0 ? (
                            <EmptyState
                                title="승인할 휴무가 없습니다"
                                description="이 달에 대기 중인 신청이 없습니다"
                            />
                        ) : (
                            <VStack gap={2}>
                                {pending.map((request) => (
                                    <div
                                        key={request.id}
                                        style={{
                                            border: "1px solid var(--color-border)",
                                            borderRadius: "var(--radius-inner)",
                                            padding: "var(--spacing-2)",
                                        }}
                                    >
                                        <VStack gap={1.5}>
                                            <HStack hAlign="between" vAlign="center">
                                                <Text type="body" weight="medium" color="primary">
                                                    {request.userName}
                                                </Text>
                                                <Text type="supporting" color="secondary">
                                                    {request.date}
                                                </Text>
                                            </HStack>
                                            {request.reason && (
                                                <Text type="supporting" color="secondary" maxLines={2}>
                                                    {request.reason}
                                                </Text>
                                            )}
                                            <HStack gap={2} hAlign="end">
                                                <Button
                                                    label="반려"
                                                    variant="ghost"
                                                    size="sm"
                                                    isDisabled={processingId === request.id}
                                                    onClick={() => handleReject(request)}
                                                />
                                                <Button
                                                    label="승인"
                                                    variant="primary"
                                                    size="sm"
                                                    isLoading={processingId === request.id}
                                                    isDisabled={processingId === request.id}
                                                    onClick={() => handleApprove(request)}
                                                />
                                            </HStack>
                                        </VStack>
                                    </div>
                                ))}
                            </VStack>
                        )}
                    </div>
                </StackItem>
            </VStack>
        </Card>
    );
}

export default PendingVacationApprovals;
