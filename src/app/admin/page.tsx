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
            <div className="min-h-screen flex flex-col items-center justify-center bg-white">
                <div className="flex flex-col items-center space-y-6">
                    <Image
                        src="/images/carev-favicon.png"
                        alt="케어브이 로고"
                        width={48}
                        height={48}
                        className="mb-2 rounded-xl"
                    />
                    <div className="flex items-center space-x-3">
                        <svg
                            className="animate-spin h-5 w-5 text-teal-500"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                        >
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <p className="text-sm text-gray-500 font-medium">
                            {!isClient ? "준비 중..." : "불러오는 중..."}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-gray-50">
            {/* 사이드바 (데스크탑) */}
            <aside className="hidden lg:flex flex-col w-56 bg-white border-r border-gray-200 fixed inset-y-0 left-0 z-30">
                {/* 로고 */}
                <div className="flex items-center gap-3 px-6 h-16 border-b border-gray-100 flex-shrink-0">
                    <Image src="/images/carev-favicon.png" alt="케어브이" width={32} height={32} className="rounded-lg" />
                    <div>
                        <h1 className="text-sm font-bold text-gray-900 leading-tight">케어브이</h1>
                        {companyName && <p className="text-[11px] text-gray-400 leading-tight truncate max-w-[140px]">{companyName}</p>}
                    </div>
                </div>

                {/* 네비게이션 */}
                <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
                    <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">메뉴</p>
                    {([
                        { key: "dashboard", label: "대시보드", icon: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" },
                        { key: "notice", label: "공지사항", icon: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" },
                        { key: "chat", label: "채팅", icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" },
                        { key: "schedule", label: "월간일정", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
                        { key: "approval", label: "전자결재", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
                        { key: "work", label: "근무조정", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z", badge: pendingRequests.length > 0 ? pendingRequests.length : undefined },
                        ...(isAdmin ? [{ key: "members", label: "회원관리", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-2a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" }] : []),
                    ] as { key: string; label: string; icon: string; badge?: number }[]).map((tab) => (
                        <div key={tab.key}>
                            <button
                                onClick={() => setActiveMainTab(tab.key as MainTab)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                                    activeMainTab === tab.key
                                        ? "bg-teal-50 text-teal-700 shadow-sm"
                                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                }`}
                            >
                                <svg className={`w-[18px] h-[18px] flex-shrink-0 ${activeMainTab === tab.key ? 'text-teal-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d={tab.icon} />
                                </svg>
                                {tab.label}
                                {tab.badge && (
                                    <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold bg-red-500 text-white rounded-full">{tab.badge}</span>
                                )}
                            </button>
                            {/* 전자결재 서브탭 */}
                            {tab.key === "approval" && activeMainTab === "approval" && (
                                <div className="pl-9 mt-1 space-y-0.5">
                                    <button onClick={() => setApprovalSubTab("submit")} className={`w-full text-left px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${approvalSubTab === "submit" ? "text-teal-700 bg-teal-50" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}>
                                        결재 신청
                                    </button>
                                    {isAdmin && (
                                    <button onClick={() => setApprovalSubTab("management")} className={`w-full text-left px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${approvalSubTab === "management" ? "text-teal-700 bg-teal-50" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}>
                                        결재 관리
                                    </button>
                                    )}
                                    {isAdmin && (
                                    <button onClick={() => setApprovalSubTab("templates")} className={`w-full text-left px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${approvalSubTab === "templates" ? "text-teal-700 bg-teal-50" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}>
                                        양식 관리
                                    </button>
                                    )}
                                </div>
                            )}
                            {/* 월간일정 서브탭 */}
                            {tab.key === "schedule" && activeMainTab === "schedule" && isAdmin && (
                                <div className="pl-9 mt-1 space-y-0.5">
                                    <button onClick={() => setScheduleMode("schedule")} className={`w-full text-left px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${scheduleMode === "schedule" ? "text-teal-700 bg-teal-50" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}>
                                        일정
                                    </button>
                                    <button onClick={() => setScheduleMode("dispatch")} className={`w-full text-left px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${scheduleMode === "dispatch" ? "text-teal-700 bg-teal-50" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}>
                                        배차관리
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </nav>

                {/* 사이드바 하단 */}
                <div className="border-t border-gray-100 py-3 space-y-1 flex-shrink-0">
                    <div className="px-3"><SubscriptionStatus /></div>
                    <button onClick={() => router.push("/admin/organization-profile")} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h4M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                        기관 프로필
                    </button>
                    <button onClick={handleLogout} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        로그아웃
                    </button>
                </div>
            </aside>

            {/* 모바일 헤더 (lg 미만) */}
            <header className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b border-gray-200 shadow-sm">
                <div className="flex items-center justify-between px-4 h-13">
                    <div className="flex items-center gap-2">
                        <Image src="/images/carev-favicon.png" alt="케어브이" width={26} height={26} className="rounded-lg" />
                        <div>
                            <span className="text-sm font-bold text-gray-900">케어브이</span>
                            {companyName && <p className="text-[10px] text-gray-400 leading-tight truncate max-w-[120px]">{companyName}</p>}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <SubscriptionStatus />
                        <button onClick={handleLogout} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        </button>
                    </div>
                </div>
                <nav className="flex overflow-x-auto scrollbar-hide px-2 -mb-px">
                    {([
                        { key: "dashboard", label: "대시보드" }, { key: "notice", label: "공지" }, { key: "chat", label: "채팅" },
                        { key: "schedule", label: "일정" }, { key: "approval", label: "결재" }, { key: "work", label: "근무" },
                        ...(isAdmin ? [{ key: "members" as const, label: "회원" as const }] : []),
                    ] as { key: string; label: string }[]).map((tab) => (
                        <button key={tab.key} onClick={() => setActiveMainTab(tab.key as MainTab)} className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${activeMainTab === tab.key ? "text-teal-600 border-teal-500" : "text-gray-500 border-transparent"}`}>
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </header>

            {/* 메인 콘텐츠 영역 */}
            <div className="flex-1 lg:ml-56 flex flex-col min-h-screen">
            {/* 공지사항 롤링 배너 */}
            <div className="mt-[88px] lg:mt-0">
            <NoticeRollingBanner
              onNoticeClick={() => setActiveMainTab('notice')}
              autoScrollInterval={5000}
              maxNotices={5}
            />
            </div>

            {/* 메인 콘텐츠 */}
            <main className="flex-grow w-full px-3 sm:px-4 lg:px-5 py-4 flex flex-col">
                {/* 알림 메시지 */}
                <AnimatePresence>
                    {notification.show && (
                        <motion.div
                            initial={{opacity: 0, y: -12, scale: 0.95}}
                            animate={{opacity: 1, y: 0, scale: 1}}
                            exit={{opacity: 0, y: -12, scale: 0.95}}
                            className={`mb-4 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-md ${
                                notification.type === "success"
                                    ? "bg-green-50 text-green-700 border border-green-200"
                                    : notification.type === "error"
                                        ? "bg-red-50 text-red-700 border border-red-200"
                                        : "bg-blue-50 text-blue-700 border border-blue-200"
                            }`}
                        >
                            <span className="text-base">
                                {notification.type === "success" ? "✓" : notification.type === "error" ? "✕" : "ℹ"}
                            </span>
                            <p className="text-xs font-medium flex-1">{notification.message}</p>
                            <button
                                onClick={() => setNotification({...notification, show: false})}
                                className="text-current opacity-40 hover:opacity-70 transition-opacity p-0.5"
                                aria-label="닫기"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
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
                            className="flex-1 flex flex-col"
                        >
                            <AdminDashboard onTabChange={(tab) => setActiveMainTab(tab as MainTab)} isAdmin={isAdmin} />
                        </motion.div>
                    ) : activeMainTab === "notice" ? (
                        <motion.div
                            key="notice"
                            initial={{opacity: 0, y: 20}}
                            animate={{opacity: 1, y: 0}}
                            exit={{opacity: 0, y: -20}}
                            transition={{duration: 0.2}}
                            className="flex-1 flex flex-col"
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
                            className="flex-1 flex flex-col"
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
                            className="flex-1 flex flex-col"
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
                            className="flex-1 flex flex-col"
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
                            className="flex-1 flex flex-col"
                        >
                            {/* 근무관리 - 캘린더 + 사이드바 */}
                            <div className="flex flex-col xl:flex-row gap-6">
                                {/* 캘린더 영역 */}
                                <div className="xl:w-4/5 bg-white p-6 rounded-lg shadow-sm border border-gray-200 h-fit">
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
                                <div className="xl:w-1/5 flex flex-col gap-4">
                                    {/* 필터 패널 */}
                                    <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200">
                                        <h3 className="text-sm font-medium text-gray-800 mb-3">필터</h3>
                                        <div className="space-y-3">
                                            {/* 상태 필터 */}
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">상태</label>
                                                <div className="grid grid-cols-2 gap-1">
                                                    {(["all", "pending", "approved", "rejected"] as const).map((status) => (
                                                        <button
                                                            key={status}
                                                            onClick={() => setStatusFilter(status)}
                                                            className={`px-2 py-1 text-[10px] font-medium rounded transition-colors ${
                                                                statusFilter === status
                                                                    ? status === "all" ? "bg-teal-500 text-white"
                                                                        : status === "pending" ? "bg-yellow-500 text-white"
                                                                            : status === "approved" ? "bg-green-500 text-white"
                                                                                : "bg-red-500 text-white"
                                                                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                                            }`}
                                                        >
                                                            {status === "all" ? "전체" : status === "pending" ? "대기" : status === "approved" ? "승인" : "거부"}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* 역할 필터 */}
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">역할</label>
                                                <div className="grid grid-cols-1 gap-1">
                                                    {[ALL_ROLE_FILTER, ...availableRoles].map((role) => (
                                                        <button
                                                            key={role}
                                                            onClick={() => setRoleFilter(role)}
                                                            className={`px-2 py-1 text-[10px] font-medium rounded transition-colors ${
                                                                roleFilter === role
                                                                    ? "bg-teal-500 text-white"
                                                                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                                            }`}
                                                        >
                                                            {role === ALL_ROLE_FILTER ? "전체" : getRoleDisplayName(role)}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* 정렬 옵션 */}
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">정렬</label>
                                                <div className="grid grid-cols-1 gap-1">
                                                    {([["latest", "최신순"], ["name", "이름순"], ["role", "직무순"]] as const).map(([order, label]) => (
                                                        <button
                                                            key={order}
                                                            onClick={() => setSortOrder(order)}
                                                            className={`px-2 py-1 text-[10px] font-medium rounded transition-colors ${
                                                                sortOrder === order
                                                                    ? "bg-teal-500 text-white"
                                                                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                                            }`}
                                                        >
                                                            {label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* 이름 필터 표시 */}
                                            {nameFilter && (
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">선택된 직원</label>
                                                    <div className="flex items-center justify-between bg-teal-50 border border-teal-200 rounded px-2 py-1">
                                                        <span className="text-[10px] font-medium text-teal-700">{nameFilter}</span>
                                                        <button
                                                            onClick={() => setNameFilter(null)}
                                                            className="text-teal-500 hover:text-teal-700 ml-1"
                                                            title="필터 해제"
                                                        >
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* 필터 초기화 */}
                                            <button
                                                onClick={resetFilter}
                                                className="w-full mt-2 px-2 py-1 text-[10px] font-medium text-gray-600 bg-gray-100 border border-gray-200 rounded hover:bg-gray-200 focus:outline-none focus:ring-1 focus:ring-teal-500 transition-colors"
                                            >
                                                초기화
                                            </button>
                                        </div>
                                    </div>

                                    {/* 휴무 목록 */}
                                    <div className="flex-grow bg-white p-3 rounded-lg shadow-sm border border-gray-200 overflow-auto">
                                        <div className="mb-3">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-sm font-medium text-gray-800">
                                                    {selectedDate
                                                        ? `${format(selectedDate, "yyyy년 MM월 dd일", { locale: ko })} 휴무 목록`
                                                        : "전체 휴무 목록"}
                                                </h3>
                                                {isAdmin && filteredRequests.some(req => req.status === 'pending') && (
                                                    <button
                                                        onClick={() => {
                                                            setIsSelectMode(!isSelectMode);
                                                            setSelectedVacationIds(new Set());
                                                        }}
                                                        className={`px-2 py-1 text-xs rounded-lg border transition-colors ${
                                                            isSelectMode
                                                                ? 'bg-teal-50 text-teal-600 border-teal-300'
                                                                : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                                                        }`}
                                                    >
                                                        {isSelectMode ? '선택 취소' : '다중 선택'}
                                                    </button>
                                                )}
                                            </div>
                                            {selectedDate && (
                                                <button
                                                    onClick={() => setSelectedDate(null)}
                                                    className="mt-1 text-xs text-teal-600 hover:text-teal-700 underline"
                                                >
                                                    전체 목록 보기
                                                </button>
                                            )}
                                        </div>

                                        {/* 일괄 작업 버튼 */}
                                        {isAdmin && isSelectMode && (
                                            <div className="mb-3 p-2 bg-teal-50 rounded-lg border border-teal-200">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={handleSelectAll}
                                                            className="px-2 py-1 text-xs bg-white border border-teal-300 text-teal-600 rounded-lg hover:bg-teal-50 transition-colors"
                                                        >
                                                            {selectedVacationIds.size === filteredRequests.filter(req => req.status === 'pending').length
                                                                ? '전체 해제'
                                                                : '전체 선택'}
                                                        </button>
                                                        <span className="text-xs text-teal-700 font-medium">{selectedVacationIds.size}개</span>
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
                                                <div className="w-8 h-8 border-4 border-teal-200 border-t-teal-500 rounded-full animate-spin"></div>
                                            </div>
                                        ) : filteredRequests.length === 0 ? (
                                            <div className="text-center py-6 text-gray-500 text-xs">
                                                조건에 맞는 휴무 요청이 없습니다.
                                            </div>
                                        ) : (
                                            <ul className="space-y-2 max-h-[100vh] overflow-y-auto pr-1">
                                                {filteredRequests.map((request) => {
                                                    const resolvedRole = getVacationRequestRole(
                                                        request,
                                                        memberRoleLookup
                                                    );
                                                    const roleBadgeClasses = getRoleBadgeClasses(resolvedRole);

                                                    return (
                                                    <li
                                                        key={request.id}
                                                        className="p-2 bg-gray-50 rounded border border-gray-200 hover:shadow-sm transition-shadow"
                                                    >
                                                        <div className="flex justify-between items-start mb-1">
                                                            <div className="flex items-start gap-2">
                                                                {isSelectMode && request.status === 'pending' && (
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={selectedVacationIds.has(request.id)}
                                                                        onChange={() => handleToggleSelection(request.id)}
                                                                        className="mt-0.5 w-4 h-4 text-teal-500 border-gray-300 rounded focus:ring-teal-500"
                                                                    />
                                                                )}
                                                                <div>
                                                                    <div
                                                                        className={`font-medium text-xs truncate cursor-pointer transition-colors duration-200 ${
                                                                            nameFilter === request.userName
                                                                                ? "text-teal-600 font-bold"
                                                                                : "text-gray-900 hover:text-teal-600"
                                                                        }`}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setNameFilter(nameFilter === request.userName ? null : request.userName);
                                                                        }}
                                                                        title={`${request.userName} ${nameFilter === request.userName ? "필터 해제" : "필터링"}`}
                                                                    >
                                                                        {request.userName}
                                                                        {nameFilter === request.userName && (
                                                                            <span className="ml-1 inline-flex items-center">
                                                                                <svg className="w-3 h-3 text-teal-600" fill="currentColor" viewBox="0 0 20 20">
                                                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                                </svg>
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-[10px] text-gray-500">
                                                                        {formatVacationDate(request.date)}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <span
                                                                className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium ${
                                                                    request.status === "approved"
                                                                        ? "bg-green-100 text-green-800"
                                                                        : request.status === "pending"
                                                                            ? "bg-yellow-100 text-yellow-800"
                                                                            : "bg-red-100 text-red-800"
                                                                }`}
                                                            >
                                                                {getStatusText(request.status)}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-1">
                                                                <span className={`px-1.5 py-0.5 text-[9px] rounded border ${roleBadgeClasses}`}>
                                                                    {getRoleText(resolvedRole)}
                                                                </span>
                                                                {isValidDuration(request.duration) && (
                                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] rounded bg-purple-50 text-purple-700">
                                                                        <span>{getDurationText(request.duration)}</span>
                                                                    </span>
                                                                )}
                                                                <span className={`px-1.5 py-0.5 text-[9px] rounded ${
                                                                    request.type === "mandatory" ? "bg-orange-50 text-orange-700" : "bg-gray-50 text-gray-700"
                                                                }`}>
                                                                    {getVacationTypeText(request.type)}
                                                                </span>
                                                                <span className="text-[9px] text-gray-500">{formatDate(request.createdAt)}</span>
                                                            </div>
                                                            {isAdmin && (
                                                            <div className="flex gap-1">
                                                                {request.status === "pending" && (
                                                                    <>
                                                                        <button
                                                                            onClick={() => handleApproveVacation(request.id)}
                                                                            className="px-1.5 py-0.5 text-[10px] text-green-600 hover:bg-green-50 rounded border border-green-200 hover:border-green-300 transition-colors"
                                                                        >
                                                                            승인
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleRejectVacation(request.id)}
                                                                            className="px-1.5 py-0.5 text-[10px] text-red-600 hover:bg-red-50 rounded border border-red-200 hover:border-red-300 transition-colors"
                                                                        >
                                                                            거절
                                                                        </button>
                                                                    </>
                                                                )}
                                                                <button
                                                                    onClick={() => handleDeleteVacation(request)}
                                                                    className="p-0.5 text-gray-600 hover:bg-gray-100 rounded"
                                                                    title="삭제"
                                                                >
                                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                    </svg>
                                                                </button>
                                                            </div>
                                                            )}
                                                        </div>
                                                        {request.reason && request.reason !== "(사유 미입력)" && (
                                                            <div className="mt-1 p-1.5 bg-white rounded border border-gray-200">
                                                                <div className="text-[9px] text-gray-600">
                                                                    <span className="font-medium text-gray-700">사유:</span>{" "}
                                                                    {request.reason}
                                                                </div>
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
                            className="flex-1 flex flex-col"
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
                            className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black bg-opacity-50"
                            onClick={handleCloseDetails}
                        >
                            <motion.div
                                initial={{scale: 0.95}}
                                animate={{scale: 1}}
                                exit={{scale: 0.95}}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full max-w-md"
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
                            className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black bg-opacity-50"
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
                            className="fixed inset-0 z-50 flex items-center justify-center p-4"
                            onClick={cancelDelete}
                        >
                            <motion.div
                                initial={{scale: 0.95}}
                                animate={{scale: 1}}
                                exit={{scale: 0.95}}
                                onClick={(e) => e.stopPropagation()}
                                className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm"
                            >
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
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            )}

            {/* 푸터 */}
            <footer className="border-t border-gray-200 bg-gray-50">
                <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
                        <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-3 text-xs text-gray-400">
                            <span>&copy; 2025 케어브이 (silverithm) 대표: 김준형</span>
                            <span className="hidden sm:inline text-gray-300">|</span>
                            <span>사업자등록번호: 107-21-26475</span>
                            <span className="hidden sm:inline text-gray-300">|</span>
                            <span>서울특별시 신림동 1547-10</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                            <a
                                href="https://plip.kr/pcc/d9017bf3-00dc-4f8f-b750-f7668e2b7bb7/privacy/1.html"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                개인정보처리방침
                            </a>
                            <span className="text-gray-300">|</span>
                            <a
                                href="https://relic-baboon-412.notion.site/silverithm-13c766a8bb468082b91ddbd2dd6ce45d"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                이용약관
                            </a>
                            <span className="text-gray-300">|</span>
                            <a href="mailto:ggprgrkjh@naver.com" className="text-gray-400 hover:text-gray-600 transition-colors">
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
                <div className="fixed inset-0 z-50 bg-white/40">
                    <div className="relative flex items-center justify-center h-full">
                        <svg className="animate-spin h-6 w-6 text-teal-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                    </div>
                </div>
            )}
        </div>
    );
}
