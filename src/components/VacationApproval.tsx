"use client";

import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import {
    VacationRequest,
    VacationLimit,
    VACATION_DURATION_OPTIONS,
    VacationDuration,
} from "@/types/vacation";
import {
    deleteVacation as apiDeleteVacation,
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
            const token = localStorage.getItem("authToken");

            if (!token) {
                throw new Error("인증 토큰이 없습니다.");
            }

            const headers: Record<string, string> = {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            };

            const response = await fetch(`/api/vacation/approve/${vacationId}`, {
                method: "PUT",
                headers,
            });

            if (!response.ok) {
                const errorData = await response.text();
                console.error("승인 오류 응답:", errorData);
                throw new Error(`휴무 승인 실패: ${response.status} - ${errorData}`);
            }

            const result = await response.json();

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
            const token = localStorage.getItem("authToken");

            if (!token) {
                throw new Error("인증 토큰이 없습니다.");
            }

            const headers: Record<string, string> = {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            };

            const response = await fetch(`/api/vacation/reject/${vacationId}`, {
                method: "PUT",
                headers,
            });

            if (!response.ok) {
                const errorData = await response.text();
                console.error("거절 오류 응답:", errorData);
                throw new Error(`휴무 거절 실패: ${response.status} - ${errorData}`);
            }

            const result = await response.json();

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

    return (
        <div className="flex flex-col xl:flex-row gap-4">
            {/* 휴무 목록 (좌측 메인) */}
            <div className="xl:flex-1 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="mb-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-gray-800">
                            {selectedDate
                                ? `${format(selectedDate, "yyyy년 MM월 dd일", { locale: ko })} 휴무 목록`
                                : "전체 휴무 목록"}
                        </h3>
                        <div className="flex items-center gap-2">
                            {selectedDate && (
                                <button
                                    onClick={() => setSelectedDate(null)}
                                    className="text-xs text-blue-600 hover:text-blue-800 underline"
                                >
                                    전체 보기
                                </button>
                            )}
                            {filteredRequests.some(req => req.status === 'pending') && (
                                <button
                                    onClick={() => {
                                        setIsSelectMode(!isSelectMode);
                                        setSelectedVacationIds(new Set());
                                    }}
                                    className={`px-2 py-1 text-xs rounded border transition-colors ${
                                        isSelectMode
                                            ? 'bg-blue-50 text-blue-600 border-blue-300'
                                            : 'bg-gray-50 text-gray-600 border-gray-300 hover:bg-gray-100'
                                    }`}
                                >
                                    {isSelectMode ? '선택 취소' : '다중 선택'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* 일괄 작업 바 */}
                {isSelectMode && (
                    <div className="mb-3 p-2 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleSelectAll}
                                    className="px-2 py-1 text-xs bg-white border border-blue-300 text-blue-600 rounded hover:bg-blue-50 transition-colors"
                                >
                                    {selectedVacationIds.size === filteredRequests.filter(req => req.status === 'pending').length
                                        ? '전체 해제'
                                        : '전체 선택'}
                                </button>
                                <span className="text-xs text-blue-700 font-medium">{selectedVacationIds.size}개</span>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleBulkApprove}
                                    disabled={selectedVacationIds.size === 0 || isProcessing}
                                    className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                                        selectedVacationIds.size === 0 || isProcessing
                                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                            : 'bg-green-600 text-white hover:bg-green-700'
                                    }`}
                                >
                                    {isProcessing ? '처리 중...' : '승인'}
                                </button>
                                <button
                                    onClick={handleBulkReject}
                                    disabled={selectedVacationIds.size === 0 || isProcessing}
                                    className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                                        selectedVacationIds.size === 0 || isProcessing
                                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                            : 'bg-red-600 text-white hover:bg-red-700'
                                    }`}
                                >
                                    {isProcessing ? '처리 중...' : '거절'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {isLoadingRequests ? (
                    <div className="flex justify-center items-center h-32">
                        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                    </div>
                ) : filteredRequests.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 text-xs">
                        조건에 맞는 휴무 요청이 없습니다.
                    </div>
                ) : (
                    <div className="max-h-[80vh] overflow-y-auto">
                        <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                                <tr>
                                    {isSelectMode && <th className="py-1.5 px-1 w-6"></th>}
                                    <th className="py-1.5 px-2 text-left font-medium text-gray-600">이름</th>
                                    <th className="py-1.5 px-2 text-left font-medium text-gray-600">날짜</th>
                                    <th className="py-1.5 px-2 text-left font-medium text-gray-600">직무</th>
                                    <th className="py-1.5 px-2 text-left font-medium text-gray-600">유형</th>
                                    <th className="py-1.5 px-2 text-left font-medium text-gray-600">기간</th>
                                    <th className="py-1.5 px-2 text-center font-medium text-gray-600">상태</th>
                                    <th className="py-1.5 px-2 text-right font-medium text-gray-600">작업</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredRequests.map((request) => (
                                    <tr key={request.id} className="hover:bg-gray-50 transition-colors">
                                        {isSelectMode && (
                                            <td className="py-1.5 px-1">
                                                {request.status === 'pending' && (
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedVacationIds.has(request.id)}
                                                        onChange={() => handleToggleSelection(request.id)}
                                                        className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                    />
                                                )}
                                            </td>
                                        )}
                                        <td className="py-1.5 px-2">
                                            <span
                                                className={`font-medium cursor-pointer transition-colors ${
                                                    nameFilter === request.userName
                                                        ? "text-blue-600 font-bold"
                                                        : "text-gray-900 hover:text-blue-600"
                                                }`}
                                                onClick={() => setNameFilter(nameFilter === request.userName ? null : request.userName)}
                                                title={`${request.userName} 필터`}
                                            >
                                                {request.userName}
                                            </span>
                                        </td>
                                        <td className="py-1.5 px-2 text-gray-600">{formatVacationDate(request.date)}</td>
                                        <td className="py-1.5 px-2">
                                            <span className={`px-1.5 py-0.5 text-[9px] rounded ${
                                                request.role === "caregiver" ? "bg-blue-50 text-blue-700" : "bg-green-50 text-green-700"
                                            }`}>
                                                {getRoleText(request.role)}
                                            </span>
                                        </td>
                                        <td className="py-1.5 px-2">
                                            <span className={`px-1.5 py-0.5 text-[9px] rounded ${
                                                request.type === "mandatory" ? "bg-orange-50 text-orange-700" : "bg-gray-100 text-gray-600"
                                            }`}>
                                                {getVacationTypeText(request.type)}
                                            </span>
                                        </td>
                                        <td className="py-1.5 px-2">
                                            {isValidDuration(request.duration) && (
                                                <span className="px-1.5 py-0.5 text-[9px] rounded bg-purple-50 text-purple-700">
                                                    {getDurationText(request.duration)}
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-1.5 px-2 text-center">
                                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium ${
                                                request.status === "approved"
                                                    ? "bg-green-100 text-green-800"
                                                    : request.status === "pending"
                                                        ? "bg-yellow-100 text-yellow-800"
                                                        : "bg-red-100 text-red-800"
                                            }`}>
                                                {getStatusText(request.status)}
                                            </span>
                                        </td>
                                        <td className="py-1.5 px-2 text-right">
                                            <div className="flex gap-1 justify-end">
                                                {request.status === "pending" && (
                                                    <>
                                                        <button
                                                            onClick={() => handleApproveVacation(request.id)}
                                                            className="px-1.5 py-0.5 text-[10px] text-green-600 hover:bg-green-50 rounded border border-green-200 transition-colors"
                                                        >
                                                            승인
                                                        </button>
                                                        <button
                                                            onClick={() => handleRejectVacation(request.id)}
                                                            className="px-1.5 py-0.5 text-[10px] text-red-600 hover:bg-red-50 rounded border border-red-200 transition-colors"
                                                        >
                                                            거절
                                                        </button>
                                                    </>
                                                )}
                                                <button
                                                    onClick={() => handleDeleteVacation(request)}
                                                    className="p-0.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                                                    title="삭제"
                                                >
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* 필터 패널 (우측 사이드바) */}
            <div className="xl:w-48 flex-shrink-0">
                <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 sticky top-4">
                    <h3 className="text-sm font-medium text-gray-800 mb-3">필터</h3>
                    <div className="space-y-3">
                        {/* 상태 */}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">상태</label>
                            <div className="grid grid-cols-2 gap-1">
                                {(["all", "pending", "approved", "rejected"] as const).map((status) => (
                                    <button
                                        key={status}
                                        onClick={() => toggleStatusFilter(status)}
                                        className={`px-2 py-1 text-[10px] font-medium rounded ${
                                            statusFilter === status
                                                ? status === "all" ? "bg-blue-600 text-white"
                                                    : status === "pending" ? "bg-yellow-500 text-white"
                                                        : status === "approved" ? "bg-green-600 text-white"
                                                            : "bg-red-600 text-white"
                                                : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                                        }`}
                                    >
                                        {status === "all" ? "전체" : status === "pending" ? "대기" : status === "approved" ? "승인" : "거부"}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 직원 */}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">직원</label>
                            <div className="grid grid-cols-1 gap-1">
                                {(["all", "caregiver", "office"] as const).map((role) => (
                                    <button
                                        key={role}
                                        onClick={() => toggleRoleFilter(role)}
                                        className={`px-2 py-1 text-[10px] font-medium rounded ${
                                            roleFilter === role
                                                ? role === "all" ? "bg-indigo-600 text-white"
                                                    : role === "caregiver" ? "bg-blue-600 text-white"
                                                        : "bg-green-600 text-white"
                                                : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                                        }`}
                                    >
                                        {role === "all" ? "전체" : role === "caregiver" ? "요양보호사" : "사무직"}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 정렬 */}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">정렬</label>
                            <div className="grid grid-cols-1 gap-1">
                                {([["latest", "최신순"], ["name", "이름순"], ["role", "직무순"]] as const).map(([order, label]) => (
                                    <button
                                        key={order}
                                        onClick={() => toggleSortOrder(order)}
                                        className={`px-2 py-1 text-[10px] font-medium rounded ${
                                            sortOrder === order
                                                ? "bg-purple-600 text-white"
                                                : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                                        }`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 이름 필터 */}
                        {nameFilter && (
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">선택된 직원</label>
                                <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded px-2 py-1">
                                    <span className="text-[10px] font-medium text-blue-800">{nameFilter}</span>
                                    <button onClick={() => setNameFilter(null)} className="text-blue-600 hover:text-blue-800 ml-1" title="필터 해제">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* 초기화 */}
                        <button
                            onClick={resetFilter}
                            className="w-full px-2 py-1 text-[10px] font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                            초기화
                        </button>
                    </div>
                </div>
            </div>

            {/* 삭제 확인 모달 */}
            {showDeleteConfirm && selectedDeleteVacation && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
                        <div className="flex items-start mb-4">
                            <div className="flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4v2m0 4v2m-6-4a2 2 0 11-4 0 2 2 0 014 0m6-4a2 2 0 11-4 0 2 2 0 014 0m6-4a2 2 0 11-4 0 2 2 0 014 0" />
                                </svg>
                            </div>
                            <div className="ml-4">
                                <h3 className="text-lg font-medium text-gray-900">휴무 삭제 확인</h3>
                                <p className="mt-2 text-sm text-gray-600">
                                    <span className="font-semibold text-gray-800">{selectedDeleteVacation.userName}</span>님의 <span className="font-semibold text-gray-800">{selectedDeleteVacation.date}</span> 휴무를 정말 삭제하시겠습니까?
                                </p>
                                <p className="mt-1 text-xs text-gray-500">이 작업은 되돌릴 수 없습니다.</p>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={cancelDelete}
                                disabled={isProcessing}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
                            >
                                취소
                            </button>
                            <button
                                onClick={confirmDelete}
                                disabled={isProcessing}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 flex items-center gap-2"
                            >
                                {isProcessing ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        삭제 중...
                                    </>
                                ) : (
                                    '삭제하기'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
