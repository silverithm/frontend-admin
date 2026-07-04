"use client";

import {useState, useEffect, useMemo} from "react";
import {useRouter} from "next/navigation";
import {format, addMonths, subMonths, isSameDay} from "date-fns";
import {ko} from "date-fns/locale";
import {
    DayInfo,
    VacationRequest,
    VacationLimit,
    VACATION_DURATION_OPTIONS,
    VacationDuration,
} from "@/types/vacation";
import {
    deleteVacation as apiDeleteVacation,
    logout as apiLogout,
    getVacationCalendar,
    getVacationLimits,
    saveVacationLimits,
    getAllVacationRequests,
    getVacationForDate,
    bulkApproveVacations,
    bulkRejectVacations,
    getMemberUsers,
    getPositions,
} from "@/lib/apiService";
import {motion, AnimatePresence} from "framer-motion";
import VacationCalendar from "@/components/VacationCalendar";
import ScheduleCalendar from "@/components/ScheduleCalendar";
import AdminPanel from "@/components/AdminPanel";
import VacationDetails from "@/components/VacationDetails";
import UserManagement from "@/components/UserManagement";
import SubscriptionStatus from "@/components/SubscriptionStatus";
import ApprovalManagement from "@/components/ApprovalManagement";
import ApprovalTemplateManager from "@/components/ApprovalTemplateManager";
import EmployeeApproval from "@/components/EmployeeApproval";
import NoticeManagement from "@/components/NoticeManagement";
import { ChatManagement } from "@/components/ChatManagement";
import NoticeRollingBanner from "@/components/NoticeRollingBanner";
import { FloatingChat } from "@/components/FloatingChat/FloatingChat";
import AdminDashboard from "@/components/AdminDashboard";
import Image from "next/image";
import type { Position } from "@/types/position";
import {
    ALL_ROLE_FILTER,
    buildMemberRoleLookup,
    buildRoleNames,
    compareRoleNames,
    getMaxRoleLimitForDate,
    getRoleBadgeClasses,
    getRoleDisplayName,
    getVacationRequestRole,
    type MemberRoleSource,
} from "@/lib/roleUtils";
import { Button } from "@astryxdesign/core/Button";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Badge } from "@astryxdesign/core/Badge";
import { Text } from "@astryxdesign/core/Text";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Banner } from "@astryxdesign/core/Banner";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { EmptyState } from "@astryxdesign/core/EmptyState";

// 역할 배지 Tailwind 클래스 문자열을 Astryx Badge variant로 매핑
type BadgeVariant =
    | "neutral" | "blue" | "cyan" | "green" | "orange" | "pink" | "purple" | "red" | "teal" | "yellow";
const roleBadgeVariant = (classes: string): BadgeVariant => {
    if (classes.includes("purple")) return "purple";
    if (classes.includes("blue")) return "blue";
    if (classes.includes("emerald") || classes.includes("green")) return "green";
    if (classes.includes("red") || classes.includes("rose")) return "red";
    if (classes.includes("amber") || classes.includes("yellow")) return "yellow";
    if (classes.includes("orange")) return "orange";
    if (classes.includes("pink") || classes.includes("fuchsia")) return "pink";
    if (classes.includes("teal") || classes.includes("cyan")) return "teal";
    return "neutral";
};

type MainTab = "dashboard" | "notice" | "chat" | "schedule" | "approval" | "work" | "members";
type ApprovalSubTab = "management" | "templates" | "submit";
type ScheduleMode = "schedule" | "dispatch";
export default function AdminPage() {
    const router = useRouter();
    const [activeMainTab, setActiveMainTab] = useState<MainTab>("dashboard");
    const [approvalSubTab, setApprovalSubTab] = useState<ApprovalSubTab>("submit");
    const [scheduleMode, setScheduleMode] = useState<ScheduleMode>("schedule");
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [dateVacations, setDateVacations] = useState<VacationRequest[]>([]);
    const [showDetails, setShowDetails] = useState(false);
    const [showLimitPanel, setShowLimitPanel] = useState(false);
    const [vacationDays, setVacationDays] = useState<Record<string, DayInfo>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingRequests, setIsLoadingRequests] = useState(true);
    const [notification, setNotification] = useState<{
        show: boolean;
        message: string;
        type: "success" | "error" | "info";
    }>({show: false, message: "", type: "success"});
    const [vacationLimits, setVacationLimits] = useState<
        Record<string, VacationLimit>
    >({});
    const [pendingRequests, setPendingRequests] = useState<VacationRequest[]>([]);
    const [organizationName, setOrganizationName] = useState<string | null>(null);
    const [companyName, setCompanyName] = useState<string | null>(null);
    const [companyAddressName, setCompanyAddressName] = useState<string | null>(
        null
    );
    const [userName, setUserName] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const [statusFilter, setStatusFilter] = useState<
        "all" | "pending" | "approved" | "rejected"
    >("all");
    const [allRequests, setAllRequests] = useState<VacationRequest[]>([]);
    const [roleFilter, setRoleFilter] = useState<string>(ALL_ROLE_FILTER);
    const [nameFilter, setNameFilter] = useState<string | null>(null);
    const [sortOrder, setSortOrder] = useState<
        "latest" | "oldest" | "vacation-date-asc" | "vacation-date-desc" | "name" | "role"
    >("latest");
    const [members, setMembers] = useState<MemberRoleSource[]>([]);
    const [positions, setPositions] = useState<Position[]>([]);

    // 다중 선택 관련 상태
    const [selectedVacationIds, setSelectedVacationIds] = useState<Set<string>>(new Set());
    const [isSelectMode, setIsSelectMode] = useState(false);

    // 삭제 확인 모달 관련 상태
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [selectedDeleteVacation, setSelectedDeleteVacation] = useState<VacationRequest | null>(null);

    const [isClient, setIsClient] = useState(false);
    const [loginType, setLoginType] = useState<string>('admin');
    const isAdmin = loginType === 'admin';

    const memberRoleLookup = useMemo(
        () => buildMemberRoleLookup(members),
        [members]
    );

    const availableRoles = useMemo(
        () =>
            buildRoleNames({
                positions,
                members,
                requests: allRequests,
                limits: vacationLimits,
            }),
        [allRequests, members, positions, vacationLimits]
    );

    // 클라이언트 사이드에서만 실행되도록 하는 useEffect
    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        if (!isClient) return; // 클라이언트 사이드가 아니면 실행하지 않음

        const token = localStorage.getItem("authToken");
        const orgName = localStorage.getItem("organizationName");
        const companyNameData = localStorage.getItem("companyName");
        const companyAddressNameData = localStorage.getItem("companyAddressName");
        const userNameData = localStorage.getItem("userName");

        if (orgName) {
            setOrganizationName(orgName);
        }
        if (companyNameData) {
            setCompanyName(companyNameData);
        }
        if (companyAddressNameData) {
            setCompanyAddressName(companyAddressNameData);
        }
        if (userNameData) {
            setUserName(userNameData);
        }

        const storedLoginType = localStorage.getItem('loginType');
        if (storedLoginType) setLoginType(storedLoginType);

        if (token) {
            fetchInitialData();
        }
    }, [router, isClient]);

    useEffect(() => {
        if (!isClient) return; // 클라이언트 사이드가 아니면 실행하지 않음

        if (localStorage.getItem("authToken")) {
            fetchMonthData();
            // fetchAllRequests(); // 제거: getVacationCalendar 데이터 사용
        }
    }, [currentDate, isClient]);

    const filteredRequests = useMemo(() => {
        // allRequests가 배열인지 확인
        if (!Array.isArray(allRequests)) {
            console.warn("allRequests가 배열이 아닙니다:", allRequests);
            return [];
        }

        let filtered = allRequests;

        // 선택된 날짜 필터링 추가
        if (selectedDate) {
            const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
            filtered = filtered.filter((request) => request.date === selectedDateStr);
        }

        if (statusFilter !== "all") {
            filtered = filtered.filter((request) => request.status === statusFilter);
        }
        if (roleFilter !== ALL_ROLE_FILTER) {
            filtered = filtered.filter(
                (request) =>
                    getVacationRequestRole(request, memberRoleLookup) === roleFilter
            );
        }
        if (nameFilter) {
            filtered = filtered.filter((request) => request.userName === nameFilter);
        }

        // filtered가 배열인지 다시 확인
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
                    const roleComparison = compareRoleNames(
                        getVacationRequestRole(a, memberRoleLookup),
                        getVacationRequestRole(b, memberRoleLookup)
                    );

                    if (roleComparison !== 0) {
                        return roleComparison;
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
        memberRoleLookup,
        sortOrder,
        selectedDate,
    ]);

    const fetchInitialData = async () => {
        try {
            await fetchMonthData(); // fetchAllRequests 제거
        } catch (error) {
            console.error("초기 데이터 로드 실패:", error);
            showNotification(
                "데이터를 불러오는데 실패했습니다. 다시 시도해주세요.",
                "error"
            );
            if ((error as Error).message.includes("인증")) {
                router.push("/login");
            }
        }
    };

    const handleLogout = async () => {
        try {
            await apiLogout();
            router.push("/");
        } catch (error) {
            console.error("로그아웃 실패:", error);
            showNotification("로그아웃 중 오류가 발생했습니다.", "error");
        }
    };

    const fetchMonthData = async () => {
        try {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth();



            // 캘린더 데이터 조회
            const startDate = new Date(year, month, 1);
            const endDate = new Date(year, month + 1, 0);
            const startDateStr = format(startDate, "yyyy-MM-dd");
            const endDateStr = format(endDate, "yyyy-MM-dd");

            // apiService 함수들 사용 (토큰 갱신 로직 포함)
            const [calendarData, limitsData, membersData, positionsData] = await Promise.all([
                getVacationCalendar(startDateStr, endDateStr, ALL_ROLE_FILTER),
                getVacationLimits(startDateStr, endDateStr),
                getMemberUsers().catch(() => ({ members: [] })),
                getPositions().catch(() => ({ positions: [] })),
            ]);

            const limitsMap: Record<string, VacationLimit> = {};
            const limits = Array.isArray(limitsData.limits) ? limitsData.limits : [];
            const membersList = Array.isArray(membersData?.members)
                ? (membersData.members as MemberRoleSource[])
                : [];
            const positionsList = Array.isArray(positionsData?.positions)
                ? (positionsData.positions as Position[])
                : [];
            limits.forEach((limit: VacationLimit) => {
                limitsMap[`${limit.date}_${limit.role}`] = limit;
            });
            setVacationLimits(limitsMap);
            setMembers(membersList);
            setPositions(positionsList);

            const days: Record<string, DayInfo> = {};
            const dates = calendarData.dates || {};

            // 캘린더 데이터에서 휴가 정보 추출
            Object.keys(dates).forEach((dateKey) => {
                const dateData = dates[dateKey];
                if (dateData && dateData.vacations) {
                    days[dateKey] = {
                        date: dateKey,
                        count: dateData.totalVacationers || 0,
                        people: Array.isArray(dateData.vacations)
                            ? dateData.vacations.filter(
                                (v: VacationRequest) => v.status !== "rejected"
                            )
                            : [],
                    };
                }
            });

            const allVacations: VacationRequest[] = [];
            Object.values(dates).forEach((dateData: any) => {
                if (dateData && dateData.vacations && Array.isArray(dateData.vacations)) {
                    allVacations.push(...dateData.vacations);
                }
            });

            const availableRoleNames = buildRoleNames({
                positions: positionsList,
                members: membersList,
                requests: allVacations,
                limits,
            });

            Object.keys(days).forEach((date) => {
                const currentLimit = getMaxRoleLimitForDate(
                    limitsMap,
                    date,
                    roleFilter,
                    availableRoleNames
                );

                const currentCount = days[date].count;
                days[date].limit = currentLimit;
                if (currentCount < currentLimit) days[date].status = "available";
                else if (currentCount === currentLimit) days[date].status = "full";
                else days[date].status = "over";
            });
            setVacationDays(days);
            
            setAllRequests(allVacations);
            const pendingOnly = allVacations.filter(
                (req: VacationRequest) => req.status === "pending"
            );
            setPendingRequests(pendingOnly);
            setIsLoadingRequests(false);

        } catch (error) {
            console.error("월별 휴무 데이터 로드 중 오류 발생:", error);
            showNotification(
                "월별 휴무 데이터를 불러오는 중 오류가 발생했습니다.",
                "error"
            );
            if (
                (error as Error).message.includes("인증") ||
                (error as Error).message.includes("회사 ID")
            ) {
                router.push("/login");
            }
        }
    };

    const fetchAllRequests = async () => {
        setIsLoadingRequests(true);
        try {

            // apiService의 getAllVacationRequests 함수 사용 (토큰 갱신 로직 포함)
            const data = await getAllVacationRequests();


            // 데이터가 배열인지 확인
            let requestsArray: VacationRequest[] = [];
            if (Array.isArray(data)) {
                requestsArray = data;
            } else if (data && Array.isArray(data.requests)) {
                requestsArray = data.requests;
            } else if (data && Array.isArray(data.data)) {
                requestsArray = data.data;
            } else {
                console.warn("예상하지 못한 API 응답 형태:", data);
                requestsArray = [];
            }

            // 첫 번째 요청 객체의 구조 상세 로그
            if (requestsArray.length > 0) {
                const firstRequest = requestsArray[0];



            }

            setAllRequests(requestsArray);
            const pendingOnly = requestsArray.filter(
                (req: VacationRequest) => req.status === "pending"
            );
            setPendingRequests(pendingOnly);

        } catch (error) {
            console.error("전체 휴무 요청을 불러오는 중 오류 발생:", error);
            showNotification(
                "전체 휴무 요청을 불러오는 중 오류가 발생했습니다.",
                "error"
            );
            if (
                (error as Error).message.includes("인증") ||
                (error as Error).message.includes("회사 ID")
            ) {
                router.push("/login");
            }
        } finally {
            setIsLoadingRequests(false);
        }
    };

    const fetchDateDetails = async (date: Date) => {
        try {
            const formattedDate = format(date, "yyyy-MM-dd");


            const requestRole =
                roleFilter === ALL_ROLE_FILTER ? ALL_ROLE_FILTER : roleFilter;


            // apiService의 getVacationForDate 함수 사용 (토큰 갱신 로직 포함)
            const data = await getVacationForDate(
                formattedDate,
                requestRole,
                nameFilter || undefined
            );


            // 데이터에서 휴가 목록 추출
            const vacations = Array.isArray(data.vacations)
                ? data.vacations.map((vacation: any) => ({
                    ...vacation,
                    duration: vacation.duration || "FULL_DAY", // duration이 없으면 기본값 설정
                }))
                : [];





            setDateVacations(vacations);
        } catch (error) {
            console.error("날짜 상세 정보 로드 중 오류 발생:", error);
            setDateVacations([]);
            showNotification(
                "날짜 상세 정보를 불러오는 중 오류가 발생했습니다.",
                "error"
            );
            if (
                (error as Error).message.includes("인증") ||
                (error as Error).message.includes("회사 ID")
            ) {
                router.push("/login");
            }
        }
    };

    const handleNextMonth = () => setCurrentDate((prev) => addMonths(prev, 1));
    const handlePrevMonth = () => setCurrentDate((prev) => subMonths(prev, 1));

    const handleDateSelect = async (date: Date | null) => {
        if (!date) {
            setSelectedDate(null);
            return;
        }
        setSelectedDate(date);
        // fetchDateDetails 제거 - 이미 로드된 allRequests 데이터를 사용
    };

    const handleCloseDetails = () => {
        setShowDetails(false);
        document.body.style.overflow = "";
    };

    const handleShowLimitPanel = () => {
        setShowLimitPanel(true);
        document.body.style.overflow = "hidden";
    };

    const handleCloseLimitPanel = () => {
        setShowLimitPanel(false);
        document.body.style.overflow = "";
    };

    const handleLimitSet = async (
        date: Date,
        maxPeople: number,
        role: string
    ) => {
        try {
            const formattedDate = format(date, "yyyy-MM-dd");
            const limits = [
                {
                    date: formattedDate,
                    maxPeople,
                    role,
                },
            ];



            // apiService의 saveVacationLimits 함수 사용 (토큰 갱신 로직 포함)
            await saveVacationLimits(limits);


            // 휴가 제한 설정 후 최신 데이터 가져오기
            await fetchMonthData();

            showNotification("휴무 제한 인원이 설정되었습니다.", "success");
        } catch (error) {
            console.error("휴무 제한 설정 중 오류 발생:", error);
            showNotification("휴무 제한 설정 중 오류가 발생했습니다.", "error");
            if (
                (error as Error).message.includes("인증") ||
                (error as Error).message.includes("회사 ID")
            ) {
                router.push("/login");
            }
        }
    };

    const handleVacationUpdated = async () => {
        try {
            await Promise.all([fetchMonthData(), fetchAllRequests()]);
            if (selectedDate) {
                await fetchDateDetails(selectedDate);
            }
        } catch (error) {
            console.error("휴무 데이터 업데이트 실패:", error);
            showNotification(
                "데이터를 업데이트하는데 실패했습니다. 다시 시도해주세요.",
                "error"
            );
        }
    };

    const handleApproveVacation = async (vacationId: string) => {
        setIsProcessing(true);
        try {

            // JWT 토큰 가져오기
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

            showNotification("휴무 요청이 승인되었습니다.", "success");
            await handleVacationUpdated();
        } catch (error) {
            console.error("휴무 승인 중 상세 오류:", {
                error,
                message: (error as Error).message,
                stack: (error as Error).stack,
                vacationId,
            });
            showNotification(
                `휴무 승인 중 오류가 발생했습니다: ${(error as Error).message}`,
                "error"
            );
            if ((error as Error).message.includes("인증")) router.push("/login");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRejectVacation = async (vacationId: string) => {
        setIsProcessing(true);
        try {

            // JWT 토큰 가져오기
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

            showNotification("휴무 요청이 거절되었습니다.", "success");
            await handleVacationUpdated();
        } catch (error) {
            console.error("휴무 거절 중 상세 오류:", {
                error,
                message: (error as Error).message,
                stack: (error as Error).stack,
                vacationId,
            });
            showNotification(
                `휴무 거절 중 오류가 발생했습니다: ${(error as Error).message}`,
                "error"
            );
            if ((error as Error).message.includes("인증")) router.push("/login");
        } finally {
            setIsProcessing(false);
        }
    };

    // 일괄 승인 처리
    const handleBulkApprove = async () => {
        if (selectedVacationIds.size === 0) {
            showNotification("선택된 휴무 요청이 없습니다.", "info");
            return;
        }

        setIsProcessing(true);
        try {
            const vacationIds = Array.from(selectedVacationIds);
            const response = await bulkApproveVacations(vacationIds);

            showNotification(
                `${vacationIds.length}개의 휴무 요청이 승인되었습니다.`,
                "success"
            );

            // 선택 초기화 및 데이터 새로고침
            setSelectedVacationIds(new Set());
            setIsSelectMode(false);
            await fetchMonthData();
        } catch (error) {
            console.error("일괄 승인 실패:", error);
            showNotification(
                `일괄 승인 중 오류가 발생했습니다: ${(error as Error).message}`,
                "error"
            );
        } finally {
            setIsProcessing(false);
        }
    };

    // 일괄 거절 처리
    const handleBulkReject = async () => {
        if (selectedVacationIds.size === 0) {
            showNotification("선택된 휴무 요청이 없습니다.", "info");
            return;
        }

        setIsProcessing(true);
        try {
            const vacationIds = Array.from(selectedVacationIds);
            const response = await bulkRejectVacations(vacationIds);

            showNotification(
                `${vacationIds.length}개의 휴무 요청이 거절되었습니다.`,
                "success"
            );

            // 선택 초기화 및 데이터 새로고침
            setSelectedVacationIds(new Set());
            setIsSelectMode(false);
            await fetchMonthData();
        } catch (error) {
            console.error("일괄 거절 실패:", error);
            showNotification(
                `일괄 거절 중 오류가 발생했습니다: ${(error as Error).message}`,
                "error"
            );
        } finally {
            setIsProcessing(false);
        }
    };

    // 체크박스 토글 처리
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

    // 전체 선택/해제
    const handleSelectAll = () => {
        const pendingIds = filteredRequests
            .filter(req => req.status === 'pending')
            .map(req => req.id);

        if (selectedVacationIds.size === pendingIds.length) {
            // 모두 선택되어 있으면 전체 해제
            setSelectedVacationIds(new Set());
        } else {
            // 전체 선택
            setSelectedVacationIds(new Set(pendingIds));
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
            await apiDeleteVacation(selectedDeleteVacation.id, {isAdmin: true});
            showNotification("휴무가 삭제되었습니다.", "success");
            setShowDeleteConfirm(false);
            setSelectedDeleteVacation(null);
            await handleVacationUpdated();
            if (showDetails) handleCloseDetails();
        } catch (error) {
            console.error("휴무 삭제 중 오류 발생:", error);
            showNotification("휴무 삭제 중 오류가 발생했습니다.", "error");
            if ((error as Error).message.includes("인증")) router.push("/login");
        } finally {
            setIsProcessing(false);
        }
    };

    const cancelDelete = () => {
        setShowDeleteConfirm(false);
        setSelectedDeleteVacation(null);
    };

    const showNotification = (
        message: string,
        type: "success" | "error" | "info"
    ) => {
        setNotification({show: true, message, type});
        setTimeout(
            () => setNotification((prev) => ({...prev, show: false})),
            3000
        );
    };

    const toggleStatusFilter = (
        status: "all" | "pending" | "approved" | "rejected"
    ) => setStatusFilter(status);
    const toggleRoleFilter = (role: string) =>
        setRoleFilter(role);
    const toggleNameFilter = (name: string) =>
        setNameFilter(name === "전체" || name === "" ? null : name);
    const toggleSortOrder = (
        order:
            | "latest"
            | "oldest"
            | "vacation-date-asc"
            | "vacation-date-desc"
            | "name"
            | "role"
    ) => setSortOrder(order);

    const resetFilter = async () => {
        setStatusFilter("all");
        setRoleFilter(ALL_ROLE_FILTER);
        setNameFilter(null);
        setSortOrder("latest");
        await fetchAllRequests();
    };

    // 날짜를 안전하게 포맷팅하는 함수
    const formatDate = (dateValue: any): string => {
        if (!dateValue) return "";


        let date: Date;

        // 이미 Date 객체인 경우
        if (dateValue instanceof Date) {
            date = dateValue;
        }
        // 문자열인 경우
        else if (typeof dateValue === "string") {
            // ISO 형식 (YYYY-MM-DD) 체크
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
                date = new Date(dateValue + "T00:00:00.000Z");
            } else {
                date = new Date(dateValue);
            }
        }
        // 숫자인 경우 (타임스탬프)
        else if (typeof dateValue === "number") {
            // 밀리초 단위가 아닌 초 단위인 경우 (길이가 10자리)
            if (dateValue.toString().length === 10) {
                date = new Date(dateValue * 1000);
            } else {
                date = new Date(dateValue);
            }
        }
        // 그 외의 경우
        else {
            console.warn("알 수 없는 날짜 형식:", dateValue);
            return "";
        }

        // 유효한 날짜인지 확인
        if (isNaN(date.getTime())) {
            console.warn("유효하지 않은 날짜:", dateValue);
            return "";
        }

        return date.toLocaleDateString("ko-KR");
    };

    // 휴무 날짜를 포맷팅하는 함수 (YYYY-MM-DD 형식)
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
                return format(date, "MM/dd", {locale: ko});
            }
        } catch (error) {
            return "-";
        }
    };

    // 휴가 기간 텍스트 가져오기
    const getDurationText = (duration?: VacationDuration) => {
        const option = VACATION_DURATION_OPTIONS.find(
            (opt) => opt.value === duration
        );
        return option ? option.displayName : "연차";
    };

    // 휴가 기간이 유효한지 확인하는 함수
    const isValidDuration = (duration?: VacationDuration) => {
        return (
            duration &&
            VACATION_DURATION_OPTIONS.find((opt) => opt.value === duration)
        );
    };

    // 휴가 기간을 짧게 표시하는 함수 (동그라미 안에 표시용)
    const getDurationShortText = (duration?: VacationDuration) => {
        switch (duration) {
            case "FULL_DAY":
                return "연";
            case "HALF_DAY_AM":
                return "반";
            case "HALF_DAY_PM":
                return "반";
            default:
                return "연";
        }
    };

    // 휴무 유형 한글 변환
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

    // 상태 한글 변환
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

    // 역할 한글 변환
    const getRoleText = (role?: string) => {
        return getRoleDisplayName(role);
    };

    // 클라이언트 사이드가 아직 준비되지 않았을 때만 로딩 화면 표시
    if (!isClient) {
        return (
            <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: 'var(--color-background-card)' }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
                    <Image
                        src="/images/carev-favicon.png"
                        alt="케어브이 로고"
                        width={48}
                        height={48}
                        style={{ marginBottom: 8, borderRadius: 12 }}
                    />
                    <Spinner size="md" label={!isClient ? "준비 중..." : "불러오는 중..."} />
                </div>
            </div>
        );
    }

    const navItems = ([
        { key: "dashboard", label: "대시보드", icon: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" },
        { key: "notice", label: "공지사항", icon: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" },
        { key: "chat", label: "채팅", icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" },
        { key: "schedule", label: "월간일정", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
        { key: "approval", label: "전자결재", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
        { key: "work", label: "근무조정", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z", badge: pendingRequests.length > 0 ? pendingRequests.length : undefined },
        ...(isAdmin ? [{ key: "members", label: "회원관리", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-2a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" }] : []),
    ] as { key: string; label: string; icon: string; badge?: number }[]);

    const navIconStyle = (active: boolean): React.CSSProperties => ({
        width: 18, height: 18, flexShrink: 0, color: active ? "#14b8a6" : "#9ca3af",
    });
    const subTabButtonStyle = (active: boolean): React.CSSProperties => ({
        width: "100%", textAlign: "left", padding: "6px 12px", fontSize: 12, fontWeight: 500,
        borderRadius: 6, transition: "colors 150ms ease", border: "none", cursor: "pointer",
        background: active ? "#f0fdfa" : "transparent", color: active ? "#0f766e" : "#6b7280",
    });

    return (
        <div style={{ display: "flex", minHeight: "100vh", background: 'var(--color-background-muted)' }}>
            {/* 사이드바 (데스크탑) */}
            <aside className="carev-admin-sidebar" style={{ flexDirection: "column", width: 224, background: 'var(--color-background-card)', borderRight: "1px solid var(--color-border)", position: "fixed", top: 0, bottom: 0, left: 0, zIndex: 30 }}>
                {/* 로고 */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 24px", height: 64, borderBottom: "1px solid var(--color-border)", flexShrink: 0 }}>
                    <Image src="/images/carev-favicon.png" alt="케어브이" width={32} height={32} style={{ borderRadius: 8 }} />
                    <div>
                        <Text as="p" type="body" weight="bold" color="primary">케어브이</Text>
                        {companyName && <Text as="p" type="supporting" color="secondary" maxLines={1}>{companyName}</Text>}
                    </div>
                </div>

                {/* 네비게이션 */}
                <nav style={{ flex: 1, overflowY: "auto", padding: "16px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
                    <Text as="p" type="supporting" weight="semibold" color="secondary">메뉴</Text>
                    {navItems.map((tab) => (
                        <div key={tab.key}>
                            <button
                                onClick={() => setActiveMainTab(tab.key as MainTab)}
                                style={{
                                    width: "100%", display: "flex", alignItems: "center", gap: 12,
                                    padding: "10px 12px", fontSize: 14, fontWeight: 500, borderRadius: 8,
                                    transition: "colors 150ms ease", border: "none", cursor: "pointer",
                                    background: activeMainTab === tab.key ? "#f0fdfa" : "transparent",
                                    color: activeMainTab === tab.key ? "#0f766e" : "#4b5563",
                                    boxShadow: activeMainTab === tab.key ? "0 1px 2px rgba(0,0,0,0.05)" : undefined,
                                }}
                            >
                                <svg style={navIconStyle(activeMainTab === tab.key)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d={tab.icon} />
                                </svg>
                                {tab.label}
                                {tab.badge && (
                                    <span style={{ marginLeft: "auto", display: "inline-flex" }}>
                                        <Badge variant="error" label={tab.badge} />
                                    </span>
                                )}
                            </button>
                            {/* 전자결재 서브탭 */}
                            {tab.key === "approval" && activeMainTab === "approval" && (
                                <div style={{ paddingLeft: 36, marginTop: 4, display: "flex", flexDirection: "column", gap: 2 }}>
                                    <button onClick={() => setApprovalSubTab("submit")} style={subTabButtonStyle(approvalSubTab === "submit")}>
                                        결재 신청
                                    </button>
                                    {isAdmin && (
                                    <button onClick={() => setApprovalSubTab("management")} style={subTabButtonStyle(approvalSubTab === "management")}>
                                        결재 관리
                                    </button>
                                    )}
                                    {isAdmin && (
                                    <button onClick={() => setApprovalSubTab("templates")} style={subTabButtonStyle(approvalSubTab === "templates")}>
                                        양식 관리
                                    </button>
                                    )}
                                </div>
                            )}
                            {/* 월간일정 서브탭 */}
                            {tab.key === "schedule" && activeMainTab === "schedule" && isAdmin && (
                                <div style={{ paddingLeft: 36, marginTop: 4, display: "flex", flexDirection: "column", gap: 2 }}>
                                    <button onClick={() => setScheduleMode("schedule")} style={subTabButtonStyle(scheduleMode === "schedule")}>
                                        일정
                                    </button>
                                    <button onClick={() => setScheduleMode("dispatch")} style={subTabButtonStyle(scheduleMode === "dispatch")}>
                                        배차관리
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </nav>

                {/* 사이드바 하단 */}
                <div style={{ borderTop: "1px solid var(--color-border)", padding: "12px 0", display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                    <div style={{ padding: "0 12px" }}><SubscriptionStatus /></div>
                    <button onClick={() => router.push("/admin/organization-profile")} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", fontSize: 12, fontWeight: 500, color: 'var(--color-text-gray)', background: "transparent", border: "none", cursor: "pointer", transition: "colors 150ms ease" }}>
                        <svg style={{ width: 16, height: 16, color: "#9ca3af" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h4M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                        기관 프로필
                    </button>
                    <button onClick={handleLogout} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", fontSize: 12, fontWeight: 500, color: 'var(--color-text-gray)', background: "transparent", border: "none", cursor: "pointer", transition: "colors 150ms ease" }}>
                        <svg style={{ width: 16, height: 16, color: "#9ca3af" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        로그아웃
                    </button>
                </div>
            </aside>

            {/* 모바일 헤더 (lg 미만) */}
            <header className="carev-admin-mobile-header" style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 30, background: 'var(--color-background-card)', borderBottom: "1px solid var(--color-border)", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", height: 52 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Image src="/images/carev-favicon.png" alt="케어브이" width={26} height={26} style={{ borderRadius: 8 }} />
                        <div>
                            <Text type="body" weight="bold" color="primary">케어브이</Text>
                            {companyName && <Text as="p" type="supporting" color="secondary" maxLines={1}>{companyName}</Text>}
                        </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <SubscriptionStatus />
                        <button onClick={handleLogout} aria-label="로그아웃" style={{ padding: 6, color: "#9ca3af", background: "transparent", border: "none", cursor: "pointer" }}>
                            <svg style={{ width: 16, height: 16 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        </button>
                    </div>
                </div>
                <nav className="scrollbar-hide" style={{ display: "flex", overflowX: "auto", padding: "0 8px", marginBottom: -1 }}>
                    {([
                        { key: "dashboard", label: "대시보드" }, { key: "notice", label: "공지" }, { key: "chat", label: "채팅" },
                        { key: "schedule", label: "일정" }, { key: "approval", label: "결재" }, { key: "work", label: "근무" },
                        ...(isAdmin ? [{ key: "members" as const, label: "회원" as const }] : []),
                    ] as { key: string; label: string }[]).map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveMainTab(tab.key as MainTab)}
                            style={{
                                padding: "8px 12px", fontSize: 12, fontWeight: 500, whiteSpace: "nowrap",
                                borderBottom: "2px solid", transition: "colors 150ms ease",
                                background: "transparent", cursor: "pointer",
                                color: activeMainTab === tab.key ? "#0d9488" : "#6b7280",
                                borderBottomColor: activeMainTab === tab.key ? "#14b8a6" : "transparent",
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </header>

            {/* 메인 콘텐츠 영역 */}
            <div className="carev-admin-content" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: "100vh" }}>
            {/* 공지사항 롤링 배너 */}
            <div className="carev-admin-rolling">
            <NoticeRollingBanner
              onNoticeClick={() => setActiveMainTab('notice')}
              autoScrollInterval={5000}
              maxNotices={5}
            />
            </div>

            {/* 메인 콘텐츠 */}
            <main style={{ flexGrow: 1, width: "100%", padding: "16px", display: "flex", flexDirection: "column" }}>
                {/* 알림 메시지 */}
                <AnimatePresence>
                    {notification.show && (
                        <motion.div
                            initial={{opacity: 0, y: -12, scale: 0.95}}
                            animate={{opacity: 1, y: 0, scale: 1}}
                            exit={{opacity: 0, y: -12, scale: 0.95}}
                            style={{ marginBottom: 16 }}
                        >
                            <Banner
                                status={notification.type === "success" ? "success" : notification.type === "error" ? "error" : "info"}
                                title={notification.message}
                                isDismissable
                                onDismiss={() => setNotification({...notification, show: false})}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* 탭별 컨텐츠 */}
                <AnimatePresence mode="wait">
                    {activeMainTab === "dashboard" ? (
                        <motion.div
                            key="dashboard"
                            initial={{opacity: 0, y: 20}}
                            animate={{opacity: 1, y: 0}}
                            exit={{opacity: 0, y: -20}}
                            transition={{duration: 0.2}}
                            style={{ flex: 1, display: "flex", flexDirection: "column" }}
                        >
                            <AdminDashboard onTabChange={(tab) => {
                                setActiveMainTab(tab as MainTab);
                                if (tab === 'approval' && isAdmin) {
                                    setApprovalSubTab('management');
                                }
                            }} isAdmin={isAdmin} />
                        </motion.div>
                    ) : activeMainTab === "notice" ? (
                        <motion.div
                            key="notice"
                            initial={{opacity: 0, y: 20}}
                            animate={{opacity: 1, y: 0}}
                            exit={{opacity: 0, y: -20}}
                            transition={{duration: 0.2}}
                            style={{ flex: 1, display: "flex", flexDirection: "column" }}
                        >
                            <NoticeManagement isAdmin={isAdmin} />
                        </motion.div>
                    ) : activeMainTab === "chat" ? (
                        <motion.div
                            key="chat"
                            initial={{opacity: 0, y: 20}}
                            animate={{opacity: 1, y: 0}}
                            exit={{opacity: 0, y: -20}}
                            transition={{duration: 0.2}}
                            style={{ flex: 1, display: "flex", flexDirection: "column" }}
                        >
                            <ChatManagement onNotification={showNotification} />
                        </motion.div>
                    ) : activeMainTab === "schedule" ? (
                        <motion.div
                            key={`schedule-${scheduleMode}`}
                            initial={{opacity: 0, y: 20}}
                            animate={{opacity: 1, y: 0}}
                            exit={{opacity: 0, y: -20}}
                            transition={{duration: 0.3}}
                            style={{ flex: 1, display: "flex", flexDirection: "column" }}
                        >
                            <ScheduleCalendar isAdmin={isAdmin} mode={scheduleMode} onNotification={showNotification} />
                        </motion.div>
                    ) : activeMainTab === "approval" ? (
                        <motion.div
                            key={`approval-${approvalSubTab}`}
                            initial={{opacity: 0, y: 20}}
                            animate={{opacity: 1, y: 0}}
                            exit={{opacity: 0, y: -20}}
                            transition={{duration: 0.2}}
                            style={{ flex: 1, display: "flex", flexDirection: "column" }}
                        >
                            {approvalSubTab === "management" && isAdmin ? (
                                <ApprovalManagement />
                            ) : approvalSubTab === "templates" && isAdmin ? (
                                <ApprovalTemplateManager isAdmin={isAdmin} />
                            ) : (
                                <EmployeeApproval />
                            )}
                        </motion.div>
                    ) : activeMainTab === "work" ? (
                        <motion.div
                            key="work"
                            initial={{opacity: 0, y: 20}}
                            animate={{opacity: 1, y: 0}}
                            exit={{opacity: 0, y: -20}}
                            transition={{duration: 0.2}}
                            style={{ flex: 1, display: "flex", flexDirection: "column" }}
                        >
                            {/* 근무관리 - 캘린더 + 사이드바 */}
                            <div className="carev-admin-work-layout">
                                {/* 캘린더 영역 */}
                                <div className="carev-admin-work-calendar" style={{ background: 'var(--color-background-card)', padding: 24, borderRadius: 8, boxShadow: "0 1px 2px rgba(0,0,0,0.05)", border: "1px solid var(--color-border)", height: "fit-content" }}>
                                    <VacationCalendar
                                        currentDate={currentDate}
                                        setCurrentDate={setCurrentDate}
                                        onDateSelect={handleDateSelect}
                                        isAdmin={isAdmin}
                                        roleFilter={roleFilter}
                                        nameFilter={nameFilter}
                                        onShowLimitPanel={handleShowLimitPanel}
                                        onNameFilterChange={setNameFilter}
                                        sortOrder={sortOrder}
                                        memberRoleLookup={memberRoleLookup}
                                    />
                                </div>

                                {/* 필터 및 휴무 목록 사이드바 */}
                                <div className="carev-admin-work-side" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                    {/* 필터 패널 */}
                                    <div style={{ background: 'var(--color-background-card)', padding: 12, borderRadius: 8, boxShadow: "0 1px 2px rgba(0,0,0,0.05)", border: "1px solid var(--color-border)" }}>
                                        <div style={{ marginBottom: 12 }}><Text type="body" weight="medium" color="primary">필터</Text></div>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                            {/* 상태 필터 */}
                                            <div>
                                                <div style={{ marginBottom: 4 }}><Text as="label" type="supporting" weight="medium" color="primary">상태</Text></div>
                                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                                                    {(["all", "pending", "approved", "rejected"] as const).map((status) => {
                                                        const activeBg = status === "all" ? "#14b8a6" : status === "pending" ? "#eab308" : status === "approved" ? "#22c55e" : "#ef4444";
                                                        const active = statusFilter === status;
                                                        return (
                                                        <button
                                                            key={status}
                                                            onClick={() => setStatusFilter(status)}
                                                            style={{
                                                                padding: "4px 8px", fontSize: 10, fontWeight: 500, borderRadius: 4,
                                                                border: "none", cursor: "pointer", transition: "colors 150ms ease",
                                                                background: active ? activeBg : "#f3f4f6",
                                                                color: active ? "#ffffff" : "#4b5563",
                                                            }}
                                                        >
                                                            {status === "all" ? "전체" : status === "pending" ? "대기" : status === "approved" ? "승인" : "거부"}
                                                        </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* 역할 필터 */}
                                            <div>
                                                <div style={{ marginBottom: 4 }}><Text as="label" type="supporting" weight="medium" color="primary">역할</Text></div>
                                                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                                    {[ALL_ROLE_FILTER, ...availableRoles].map((role) => {
                                                        const active = roleFilter === role;
                                                        return (
                                                        <button
                                                            key={role}
                                                            onClick={() => setRoleFilter(role)}
                                                            style={{
                                                                padding: "4px 8px", fontSize: 10, fontWeight: 500, borderRadius: 4,
                                                                border: "none", cursor: "pointer", transition: "colors 150ms ease",
                                                                background: active ? "#14b8a6" : "#f3f4f6",
                                                                color: active ? "#ffffff" : "#4b5563",
                                                            }}
                                                        >
                                                            {role === ALL_ROLE_FILTER ? "전체" : getRoleDisplayName(role)}
                                                        </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* 정렬 옵션 */}
                                            <div>
                                                <div style={{ marginBottom: 4 }}><Text as="label" type="supporting" weight="medium" color="primary">정렬</Text></div>
                                                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                                    {([["latest", "최신순"], ["name", "이름순"], ["role", "직무순"]] as const).map(([order, label]) => {
                                                        const active = sortOrder === order;
                                                        return (
                                                        <button
                                                            key={order}
                                                            onClick={() => setSortOrder(order)}
                                                            style={{
                                                                padding: "4px 8px", fontSize: 10, fontWeight: 500, borderRadius: 4,
                                                                border: "none", cursor: "pointer", transition: "colors 150ms ease",
                                                                background: active ? "#14b8a6" : "#f3f4f6",
                                                                color: active ? "#ffffff" : "#4b5563",
                                                            }}
                                                        >
                                                            {label}
                                                        </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* 이름 필터 표시 */}
                                            {nameFilter && (
                                                <div>
                                                    <div style={{ marginBottom: 4 }}><Text as="label" type="supporting" weight="medium" color="primary">선택된 직원</Text></div>
                                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f0fdfa", border: "1px solid #99f6e4", borderRadius: 4, padding: "4px 8px" }}>
                                                        <Text type="supporting" weight="medium" color="accent">{nameFilter}</Text>
                                                        <button
                                                            onClick={() => setNameFilter(null)}
                                                            aria-label="필터 해제"
                                                            title="필터 해제"
                                                            style={{ color: "#14b8a6", marginLeft: 4, background: "transparent", border: "none", cursor: "pointer", display: "inline-flex" }}
                                                        >
                                                            <svg style={{ width: 12, height: 12 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* 필터 초기화 */}
                                            <div style={{ marginTop: 8 }}>
                                                <Button label="초기화" variant="secondary" size="sm" onClick={resetFilter} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* 휴무 목록 */}
                                    <div style={{ flexGrow: 1, background: 'var(--color-background-card)', padding: 12, borderRadius: 8, boxShadow: "0 1px 2px rgba(0,0,0,0.05)", border: "1px solid var(--color-border)", overflow: "auto" }}>
                                        <div style={{ marginBottom: 12 }}>
                                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                                <Text type="body" weight="medium" color="primary">
                                                    {selectedDate
                                                        ? `${format(selectedDate, "yyyy년 MM월 dd일", { locale: ko })} 휴무 목록`
                                                        : "전체 휴무 목록"}
                                                </Text>
                                                {isAdmin && filteredRequests.some(req => req.status === 'pending') && (
                                                    <Button
                                                        label={isSelectMode ? '선택 취소' : '다중 선택'}
                                                        variant={isSelectMode ? 'primary' : 'secondary'}
                                                        size="sm"
                                                        onClick={() => {
                                                            setIsSelectMode(!isSelectMode);
                                                            setSelectedVacationIds(new Set());
                                                        }}
                                                    />
                                                )}
                                            </div>
                                            {selectedDate && (
                                                <div style={{ marginTop: 4 }}>
                                                    <Button
                                                        label="전체 목록 보기"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setSelectedDate(null)}
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        {/* 일괄 작업 버튼 */}
                                        {isAdmin && isSelectMode && (
                                            <div style={{ marginBottom: 12, padding: 8, background: "#f0fdfa", borderRadius: 8, border: "1px solid #99f6e4" }}>
                                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                        <Button
                                                            label={selectedVacationIds.size === filteredRequests.filter(req => req.status === 'pending').length ? '전체 해제' : '전체 선택'}
                                                            variant="secondary"
                                                            size="sm"
                                                            onClick={handleSelectAll}
                                                        />
                                                        <Text type="supporting" weight="medium" color="accent">{selectedVacationIds.size}개</Text>
                                                    </div>
                                                    <div style={{ display: "flex", gap: 8 }}>
                                                        <Button
                                                            label="승인"
                                                            variant="primary"
                                                            size="sm"
                                                            isLoading={isProcessing}
                                                            isDisabled={selectedVacationIds.size === 0}
                                                            onClick={handleBulkApprove}
                                                        />
                                                        <Button
                                                            label="거절"
                                                            variant="destructive"
                                                            size="sm"
                                                            isLoading={isProcessing}
                                                            isDisabled={selectedVacationIds.size === 0}
                                                            onClick={handleBulkReject}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {isLoadingRequests ? (
                                            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 128 }}>
                                                <Spinner size="md" />
                                            </div>
                                        ) : filteredRequests.length === 0 ? (
                                            <EmptyState isCompact title="조건에 맞는 휴무 요청이 없습니다." />
                                        ) : (
                                            <ul style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "100vh", overflowY: "auto", paddingRight: 4, listStyle: "none", margin: 0 }}>
                                                {filteredRequests.map((request) => {
                                                    const resolvedRole = getVacationRequestRole(
                                                        request,
                                                        memberRoleLookup
                                                    );
                                                    const roleBadgeClasses = getRoleBadgeClasses(resolvedRole);

                                                    return (
                                                    <li
                                                        key={request.id}
                                                        style={{ padding: 8, background: 'var(--color-background-muted)', borderRadius: 4, border: "1px solid var(--color-border)", transition: "box-shadow 150ms ease" }}
                                                    >
                                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                                                            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                                                                {isSelectMode && request.status === 'pending' && (
                                                                    <div style={{ marginTop: 2 }}>
                                                                        <CheckboxInput
                                                                            label="선택"
                                                                            isLabelHidden
                                                                            size="sm"
                                                                            value={selectedVacationIds.has(request.id)}
                                                                            onChange={() => handleToggleSelection(request.id)}
                                                                        />
                                                                    </div>
                                                                )}
                                                                <div>
                                                                    <div
                                                                        style={{
                                                                            fontWeight: nameFilter === request.userName ? 700 : 500,
                                                                            fontSize: 12,
                                                                            cursor: "pointer",
                                                                            transition: "color 200ms ease",
                                                                            color: nameFilter === request.userName ? "#0d9488" : "#111827",
                                                                            display: "flex",
                                                                            alignItems: "center",
                                                                        }}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setNameFilter(nameFilter === request.userName ? null : request.userName);
                                                                        }}
                                                                        title={`${request.userName} ${nameFilter === request.userName ? "필터 해제" : "필터링"}`}
                                                                    >
                                                                        {request.userName}
                                                                        {nameFilter === request.userName && (
                                                                            <span style={{ marginLeft: 4, display: "inline-flex", alignItems: "center" }}>
                                                                                <svg style={{ width: 12, height: 12, color: "#0d9488" }} fill="currentColor" viewBox="0 0 20 20">
                                                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                                </svg>
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div style={{ fontSize: 10, color: 'var(--color-text-gray)', marginTop: 2 }}>
                                                                        {formatVacationDate(request.date)}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <Badge
                                                                variant={request.status === "approved" ? "green" : request.status === "pending" ? "yellow" : "red"}
                                                                label={getStatusText(request.status)}
                                                            />
                                                        </div>
                                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                                                            <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                                                                <Badge variant={roleBadgeVariant(roleBadgeClasses)} label={getRoleText(resolvedRole)} />
                                                                {isValidDuration(request.duration) && (
                                                                    <Badge variant="purple" label={getDurationText(request.duration)} />
                                                                )}
                                                                <Badge
                                                                    variant={request.type === "mandatory" ? "orange" : "neutral"}
                                                                    label={getVacationTypeText(request.type)}
                                                                />
                                                                <Text type="supporting" color="secondary">{formatDate(request.createdAt)}</Text>
                                                            </div>
                                                            {isAdmin && (
                                                            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                                                                {request.status === "pending" && (
                                                                    <>
                                                                        <Button
                                                                            label="승인"
                                                                            variant="primary"
                                                                            size="sm"
                                                                            onClick={() => handleApproveVacation(request.id)}
                                                                        />
                                                                        <Button
                                                                            label="거절"
                                                                            variant="destructive"
                                                                            size="sm"
                                                                            onClick={() => handleRejectVacation(request.id)}
                                                                        />
                                                                    </>
                                                                )}
                                                                <IconButton
                                                                    label="삭제"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    tooltip="삭제"
                                                                    onClick={() => handleDeleteVacation(request)}
                                                                    icon={
                                                                        <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                        </svg>
                                                                    }
                                                                />
                                                            </div>
                                                            )}
                                                        </div>
                                                        {request.reason && request.reason !== "(사유 미입력)" && (
                                                            <div style={{ marginTop: 4, padding: 6, background: 'var(--color-background-card)', borderRadius: 4, border: "1px solid var(--color-border)" }}>
                                                                <Text type="supporting" color="secondary">
                                                                    <Text type="supporting" weight="medium" color="primary">사유:</Text>{" "}
                                                                    {request.reason}
                                                                </Text>
                                                            </div>
                                                        )}
                                                    </li>
                                                    );
                                                })}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ) : activeMainTab === "members" ? (
                        <motion.div
                            key="members"
                            initial={{opacity: 0, y: 20}}
                            animate={{opacity: 1, y: 0}}
                            exit={{opacity: 0, y: -20}}
                            transition={{duration: 0.2}}
                            style={{ flex: 1, display: "flex", flexDirection: "column" }}
                        >
                            <UserManagement
                                organizationName={companyName || undefined}
                                onNotification={showNotification}
                                isAdmin={isAdmin}
                            />
                        </motion.div>
                    ) : null}
                </AnimatePresence>

            </main>

            {/* 모달 컴포넌트들 - 근무관리 탭에서만 표시 */}
            {activeMainTab === "work" && (
                <AnimatePresence>
                    {showDetails && selectedDate && (
                        <motion.div
                            initial={{opacity: 0}}
                            animate={{opacity: 1}}
                            exit={{opacity: 0}}
                            style={{ position: "fixed", inset: 0, zIndex: 40, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(0,0,0,0.5)" }}
                            onClick={handleCloseDetails}
                        >
                            <motion.div
                                initial={{scale: 0.95}}
                                animate={{scale: 1}}
                                exit={{scale: 0.95}}
                                onClick={(e) => e.stopPropagation()}
                                style={{ width: "100%", maxWidth: 448 }}
                            >
                                <VacationDetails
                                    date={selectedDate}
                                    vacations={dateVacations}
                                    onClose={handleCloseDetails}
                                    onApplyVacation={() => {
                                    }}
                                    onVacationUpdated={handleVacationUpdated}
                                    isLoading={isLoading}
                                    maxPeople={getMaxRoleLimitForDate(
                                        vacationLimits,
                                        format(selectedDate, "yyyy-MM-dd"),
                                        roleFilter,
                                        availableRoles
                                    )}
                                    roleFilter={roleFilter}
                                    isAdmin={isAdmin}
                                    roleOptions={availableRoles}
                                    memberRoleLookup={memberRoleLookup}
                                />
                            </motion.div>
                        </motion.div>
                    )}

                    {showLimitPanel && (
                        <motion.div
                            initial={{opacity: 0}}
                            animate={{opacity: 1}}
                            exit={{opacity: 0}}
                            style={{ position: "fixed", inset: 0, zIndex: 40, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(0,0,0,0.5)" }}
                            onClick={handleCloseLimitPanel}
                        >
                            <motion.div
                                initial={{scale: 0.95}}
                                animate={{scale: 1}}
                                exit={{scale: 0.95}}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <AdminPanel
                                    currentDate={currentDate}
                                    onClose={handleCloseLimitPanel}
                                    onUpdateSuccess={fetchMonthData}
                                    vacationLimits={vacationLimits}
                                    vacationDays={vacationDays}
                                />
                            </motion.div>
                        </motion.div>
                    )}

                    {/* 삭제 확인 모달 */}
                    {showDeleteConfirm && selectedDeleteVacation && (
                        <motion.div
                            initial={{opacity: 0}}
                            animate={{opacity: 1}}
                            exit={{opacity: 0}}
                            style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(0,0,0,0.5)" }}
                            onClick={cancelDelete}
                        >
                            <motion.div
                                initial={{scale: 0.95}}
                                animate={{scale: 1}}
                                exit={{scale: 0.95}}
                                onClick={(e) => e.stopPropagation()}
                                style={{ background: 'var(--color-background-card)', borderRadius: 8, boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)", padding: 24, width: "100%", maxWidth: 384 }}
                            >
                                <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 16 }}>
                                    <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", height: 48, width: 48, borderRadius: "50%", background: "#fee2e2" }}>
                                        <svg style={{ height: 24, width: 24, color: "#dc2626" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4v2m0 4v2m-6-4a2 2 0 11-4 0 2 2 0 014 0m6-4a2 2 0 11-4 0 2 2 0 014 0m6-4a2 2 0 11-4 0 2 2 0 014 0" />
                                        </svg>
                                    </div>
                                    <div style={{ marginLeft: 16 }}>
                                        <Text type="large" weight="medium" color="primary">휴무 삭제 확인</Text>
                                        <div style={{ marginTop: 8 }}>
                                            <Text type="body" color="secondary">
                                                <Text type="body" weight="semibold" color="primary">{selectedDeleteVacation.userName}</Text>님의 <Text type="body" weight="semibold" color="primary">{selectedDeleteVacation.date}</Text> 휴무를 정말 삭제하시겠습니까?
                                            </Text>
                                        </div>
                                        <div style={{ marginTop: 4 }}>
                                            <Text type="supporting" color="secondary">이 작업은 되돌릴 수 없습니다.</Text>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
                                    <Button
                                        label="취소"
                                        variant="secondary"
                                        onClick={cancelDelete}
                                        isDisabled={isProcessing}
                                    />
                                    <Button
                                        label={isProcessing ? '삭제 중...' : '삭제하기'}
                                        variant="destructive"
                                        onClick={confirmDelete}
                                        isLoading={isProcessing}
                                    />
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            )}

            {/* 푸터 */}
            <footer style={{ borderTop: "1px solid var(--color-border)", background: 'var(--color-background-muted)' }}>
                <div style={{ maxWidth: 1600, margin: "0 auto", padding: "16px 24px" }}>
                    <div className="carev-admin-footer-row">
                        <div className="carev-admin-footer-meta" style={{ fontSize: 12, color: "#9ca3af" }}>
                            <span>&copy; 2025 케어브이 (silverithm) 대표: 김준형</span>
                            <span className="carev-admin-footer-sep" style={{ color: "#d1d5db" }}>|</span>
                            <span>사업자등록번호: 107-21-26475</span>
                            <span className="carev-admin-footer-sep" style={{ color: "#d1d5db" }}>|</span>
                            <span>서울특별시 신림동 1547-10</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12 }}>
                            <a
                                href="https://plip.kr/pcc/d9017bf3-00dc-4f8f-b750-f7668e2b7bb7/privacy/1.html"
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: "#9ca3af", textDecoration: "none", transition: "color 150ms ease" }}
                            >
                                개인정보처리방침
                            </a>
                            <span style={{ color: "#d1d5db" }}>|</span>
                            <a
                                href="https://relic-baboon-412.notion.site/silverithm-13c766a8bb468082b91ddbd2dd6ce45d"
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: "#9ca3af", textDecoration: "none", transition: "color 150ms ease" }}
                            >
                                이용약관
                            </a>
                            <span style={{ color: "#d1d5db" }}>|</span>
                            <a href="mailto:ggprgrkjh@naver.com" style={{ color: "#9ca3af", textDecoration: "none", transition: "color 150ms ease" }}>
                                ggprgrkjh@naver.com
                            </a>
                        </div>
                    </div>
                </div>
            </footer>
            </div>{/* end lg:ml-56 wrapper */}

            {/* 플로팅 채팅 위젯 */}
            <FloatingChat />

            {/* 로딩 오버레이 */}
            {isProcessing && (
                <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(255,255,255,0.4)" }}>
                    <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                        <Spinner size="lg" />
                    </div>
                </div>
            )}
        </div>
    );
}
