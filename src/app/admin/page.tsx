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
import { Icon } from "@astryxdesign/core/Icon";
import type { IconType } from "@astryxdesign/core/Icon";
import {
    IconLayoutDashboard,
    IconBell,
    IconMessageDots,
    IconCalendar,
    IconCalendarStats,
    IconFileText,
    IconUsers,
    IconBuilding,
    IconLogout,
    IconX,
    IconCheck,
    IconTrash,
    IconAlertTriangle,
} from "@tabler/icons-react";

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
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 'var(--spacing-6)' }}>
                    <Image
                        src="/images/carev-favicon.png"
                        alt="케어브이 로고"
                        width={48}
                        height={48}
                        style={{ marginBottom: 'var(--spacing-2)', borderRadius: 'var(--radius-element)' }}
                    />
                    <Spinner size="md" label={!isClient ? "준비 중..." : "불러오는 중..."} />
                </div>
            </div>
        );
    }

    const navItems = ([
        { key: "dashboard", label: "대시보드", icon: IconLayoutDashboard },
        { key: "notice", label: "공지사항", icon: IconBell },
        { key: "chat", label: "채팅", icon: IconMessageDots },
        { key: "schedule", label: "월간일정", icon: IconCalendar },
        { key: "approval", label: "전자결재", icon: IconFileText },
        { key: "work", label: "근무조정", icon: IconCalendarStats, badge: pendingRequests.length > 0 ? pendingRequests.length : undefined },
        ...(isAdmin ? [{ key: "members", label: "회원관리", icon: IconUsers }] : []),
    ] as { key: string; label: string; icon: IconType; badge?: number }[]);

    return (
        <div style={{ display: "flex", minHeight: "100vh", background: 'var(--color-background-muted)' }}>
            {/* 사이드바 (데스크탑) */}
            <aside className="carev-admin-sidebar" style={{ flexDirection: "column", width: 224, background: 'var(--color-background-card)', borderRight: "1px solid var(--color-border)", position: "fixed", top: 0, bottom: 0, left: 0, zIndex: 30 }}>
                {/* 로고 */}
                <div style={{ display: "flex", alignItems: "center", gap: 'var(--spacing-3)', padding: "0 24px", height: 64, borderBottom: "1px solid var(--color-border)", flexShrink: 0 }}>
                    <Image src="/images/carev-favicon.png" alt="케어브이" width={32} height={32} style={{ borderRadius: 'var(--radius-inner)' }} />
                    <div>
                        <Text as="p" type="body" weight="bold" color="primary">케어브이</Text>
                        {companyName && <Text as="p" type="supporting" color="secondary" maxLines={1}>{companyName}</Text>}
                    </div>
                </div>

                {/* 네비게이션 */}
                <nav style={{ flex: 1, overflowY: "auto", padding: "16px 12px", display: "flex", flexDirection: "column", gap: 'var(--spacing-1)' }}>
                    <Text as="p" type="supporting" weight="semibold" color="secondary">메뉴</Text>
                    {navItems.map((tab) => (
                        <div key={tab.key}>
                            <Button
                                label={tab.label}
                                variant={activeMainTab === tab.key ? "secondary" : "ghost"}
                                size="md"
                                onClick={() => setActiveMainTab(tab.key as MainTab)}
                                icon={<Icon icon={tab.icon} size="sm" color={activeMainTab === tab.key ? "accent" : "primary"} />}
                                endContent={tab.badge ? <Badge variant="error" label={tab.badge} /> : undefined}
                                style={{ width: "100%", justifyContent: "flex-start" }}
                            />
                            {/* 전자결재 서브탭 */}
                            {tab.key === "approval" && activeMainTab === "approval" && (
                                <div style={{ paddingLeft: 'var(--spacing-9)', marginTop: 'var(--spacing-1)', display: "flex", flexDirection: "column", gap: 'var(--spacing-0-5)' }}>
                                    <Button label="결재 신청" variant={approvalSubTab === "submit" ? "secondary" : "ghost"} size="sm" onClick={() => setApprovalSubTab("submit")} style={{ width: "100%", justifyContent: "flex-start" }} />
                                    {isAdmin && (
                                    <Button label="결재 관리" variant={approvalSubTab === "management" ? "secondary" : "ghost"} size="sm" onClick={() => setApprovalSubTab("management")} style={{ width: "100%", justifyContent: "flex-start" }} />
                                    )}
                                    {isAdmin && (
                                    <Button label="양식 관리" variant={approvalSubTab === "templates" ? "secondary" : "ghost"} size="sm" onClick={() => setApprovalSubTab("templates")} style={{ width: "100%", justifyContent: "flex-start" }} />
                                    )}
                                </div>
                            )}
                            {/* 월간일정 서브탭 */}
                            {tab.key === "schedule" && activeMainTab === "schedule" && isAdmin && (
                                <div style={{ paddingLeft: 'var(--spacing-9)', marginTop: 'var(--spacing-1)', display: "flex", flexDirection: "column", gap: 'var(--spacing-0-5)' }}>
                                    <Button label="일정" variant={scheduleMode === "schedule" ? "secondary" : "ghost"} size="sm" onClick={() => setScheduleMode("schedule")} style={{ width: "100%", justifyContent: "flex-start" }} />
                                    <Button label="배차관리" variant={scheduleMode === "dispatch" ? "secondary" : "ghost"} size="sm" onClick={() => setScheduleMode("dispatch")} style={{ width: "100%", justifyContent: "flex-start" }} />
                                </div>
                            )}
                        </div>
                    ))}
                </nav>

                {/* 사이드바 하단 */}
                <div style={{ borderTop: "1px solid var(--color-border)", padding: "12px 0", display: "flex", flexDirection: "column", gap: 'var(--spacing-1)', flexShrink: 0 }}>
                    <div style={{ padding: "0 12px" }}><SubscriptionStatus /></div>
                    <Button label="기관 프로필" variant="ghost" size="sm" onClick={() => router.push("/admin/organization-profile")} icon={<Icon icon={IconBuilding} size="sm" color="secondary" />} style={{ width: "100%", justifyContent: "flex-start" }} />
                    <Button label="로그아웃" variant="ghost" size="sm" onClick={handleLogout} icon={<Icon icon={IconLogout} size="sm" color="secondary" />} style={{ width: "100%", justifyContent: "flex-start" }} />
                </div>
            </aside>

            {/* 모바일 헤더 (lg 미만) */}
            <header className="carev-admin-mobile-header" style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 30, background: 'var(--color-background-card)', borderBottom: "1px solid var(--color-border)", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", height: 52 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 'var(--spacing-2)' }}>
                        <Image src="/images/carev-favicon.png" alt="케어브이" width={26} height={26} style={{ borderRadius: 'var(--radius-inner)' }} />
                        <div>
                            <Text type="body" weight="bold" color="primary">케어브이</Text>
                            {companyName && <Text as="p" type="supporting" color="secondary" maxLines={1}>{companyName}</Text>}
                        </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 'var(--spacing-2)' }}>
                        <SubscriptionStatus />
                        <IconButton label="로그아웃" variant="ghost" size="sm" tooltip="로그아웃" onClick={handleLogout} icon={<Icon icon={IconLogout} size="sm" color="secondary" />} />
                    </div>
                </div>
                <nav className="scrollbar-hide" style={{ display: "flex", overflowX: "auto", padding: "0 8px", marginBottom: -1 }}>
                    {([
                        { key: "dashboard", label: "대시보드" }, { key: "notice", label: "공지" }, { key: "chat", label: "채팅" },
                        { key: "schedule", label: "일정" }, { key: "approval", label: "결재" }, { key: "work", label: "근무" },
                        ...(isAdmin ? [{ key: "members" as const, label: "회원" as const }] : []),
                    ] as { key: string; label: string }[]).map((tab) => (
                        <Button
                            key={tab.key}
                            label={tab.label}
                            variant={activeMainTab === tab.key ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => setActiveMainTab(tab.key as MainTab)}
                            style={{ whiteSpace: "nowrap", flexShrink: 0 }}
                        />
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
            <main style={{ flexGrow: 1, width: "100%", padding: 'var(--spacing-4)', display: "flex", flexDirection: "column" }}>
                {/* 알림 메시지 */}
                <AnimatePresence>
                    {notification.show && (
                        <motion.div
                            initial={{opacity: 0, y: -12, scale: 0.95}}
                            animate={{opacity: 1, y: 0, scale: 1}}
                            exit={{opacity: 0, y: -12, scale: 0.95}}
                            style={{ marginBottom: 'var(--spacing-4)' }}
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
                                <div className="carev-admin-work-calendar" style={{ background: 'var(--color-background-card)', padding: 'var(--spacing-6)', borderRadius: 'var(--radius-inner)', boxShadow: "0 1px 2px rgba(0,0,0,0.05)", border: "1px solid var(--color-border)", height: "fit-content" }}>
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
                                <div className="carev-admin-work-side" style={{ display: "flex", flexDirection: "column", gap: 'var(--spacing-4)' }}>
                                    {/* 필터 패널 */}
                                    <div style={{ background: 'var(--color-background-card)', padding: 'var(--spacing-3)', borderRadius: 'var(--radius-inner)', boxShadow: "0 1px 2px rgba(0,0,0,0.05)", border: "1px solid var(--color-border)" }}>
                                        <div style={{ marginBottom: 'var(--spacing-3)' }}><Text type="body" weight="medium" color="primary">필터</Text></div>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 'var(--spacing-3)' }}>
                                            {/* 상태 필터 */}
                                            <div>
                                                <div style={{ marginBottom: 'var(--spacing-1)' }}><Text as="label" type="supporting" weight="medium" color="primary">상태</Text></div>
                                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 'var(--spacing-1)' }}>
                                                    {(["all", "pending", "approved", "rejected"] as const).map((status) => {
                                                        const active = statusFilter === status;
                                                        return (
                                                        <Button
                                                            key={status}
                                                            label={status === "all" ? "전체" : status === "pending" ? "대기" : status === "approved" ? "승인" : "거부"}
                                                            variant={active ? (status === "rejected" ? "destructive" : "primary") : "ghost"}
                                                            size="sm"
                                                            onClick={() => setStatusFilter(status)}
                                                            style={{ width: "100%" }}
                                                        />
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* 역할 필터 */}
                                            <div>
                                                <div style={{ marginBottom: 'var(--spacing-1)' }}><Text as="label" type="supporting" weight="medium" color="primary">역할</Text></div>
                                                <div style={{ display: "flex", flexDirection: "column", gap: 'var(--spacing-1)' }}>
                                                    {[ALL_ROLE_FILTER, ...availableRoles].map((role) => {
                                                        const active = roleFilter === role;
                                                        return (
                                                        <Button
                                                            key={role}
                                                            label={role === ALL_ROLE_FILTER ? "전체" : getRoleDisplayName(role)}
                                                            variant={active ? "primary" : "ghost"}
                                                            size="sm"
                                                            onClick={() => setRoleFilter(role)}
                                                            style={{ width: "100%", justifyContent: "flex-start" }}
                                                        />
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* 정렬 옵션 */}
                                            <div>
                                                <div style={{ marginBottom: 'var(--spacing-1)' }}><Text as="label" type="supporting" weight="medium" color="primary">정렬</Text></div>
                                                <div style={{ display: "flex", flexDirection: "column", gap: 'var(--spacing-1)' }}>
                                                    {([["latest", "최신순"], ["name", "이름순"], ["role", "직무순"]] as const).map(([order, label]) => {
                                                        const active = sortOrder === order;
                                                        return (
                                                        <Button
                                                            key={order}
                                                            label={label}
                                                            variant={active ? "primary" : "ghost"}
                                                            size="sm"
                                                            onClick={() => setSortOrder(order)}
                                                            style={{ width: "100%", justifyContent: "flex-start" }}
                                                        />
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* 이름 필터 표시 */}
                                            {nameFilter && (
                                                <div>
                                                    <div style={{ marginBottom: 'var(--spacing-1)' }}><Text as="label" type="supporting" weight="medium" color="primary">선택된 직원</Text></div>
                                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: 'var(--color-background-teal)', border: "1px solid var(--color-border-teal)", borderRadius: 'var(--radius-inner)', padding: "4px 8px" }}>
                                                        <Text type="supporting" weight="medium" color="accent">{nameFilter}</Text>
                                                        <IconButton
                                                            label="필터 해제"
                                                            tooltip="필터 해제"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => setNameFilter(null)}
                                                            icon={<Icon icon={IconX} size="xsm" color="accent" />}
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {/* 필터 초기화 */}
                                            <div style={{ marginTop: 'var(--spacing-2)' }}>
                                                <Button label="초기화" variant="secondary" size="sm" onClick={resetFilter} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* 휴무 목록 */}
                                    <div style={{ flexGrow: 1, background: 'var(--color-background-card)', padding: 'var(--spacing-3)', borderRadius: 'var(--radius-inner)', boxShadow: "0 1px 2px rgba(0,0,0,0.05)", border: "1px solid var(--color-border)", overflow: "auto" }}>
                                        <div style={{ marginBottom: 'var(--spacing-3)' }}>
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
                                                <div style={{ marginTop: 'var(--spacing-1)' }}>
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
                                            <div style={{ marginBottom: 'var(--spacing-3)', padding: 'var(--spacing-2)', background: 'var(--color-background-teal)', borderRadius: 'var(--radius-inner)', border: "1px solid var(--color-border-teal)" }}>
                                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 'var(--spacing-2)' }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 'var(--spacing-2)' }}>
                                                        <Button
                                                            label={selectedVacationIds.size === filteredRequests.filter(req => req.status === 'pending').length ? '전체 해제' : '전체 선택'}
                                                            variant="secondary"
                                                            size="sm"
                                                            onClick={handleSelectAll}
                                                        />
                                                        <Text type="supporting" weight="medium" color="accent">{selectedVacationIds.size}개</Text>
                                                    </div>
                                                    <div style={{ display: "flex", gap: 'var(--spacing-2)' }}>
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
                                            <ul style={{ display: "flex", flexDirection: "column", gap: 'var(--spacing-2)', maxHeight: "100vh", overflowY: "auto", paddingRight: 'var(--spacing-1)', listStyle: "none", margin: 'var(--spacing-0)' }}>
                                                {filteredRequests.map((request) => {
                                                    const resolvedRole = getVacationRequestRole(
                                                        request,
                                                        memberRoleLookup
                                                    );
                                                    const roleBadgeClasses = getRoleBadgeClasses(resolvedRole);

                                                    return (
                                                    <li
                                                        key={request.id}
                                                        style={{ padding: 'var(--spacing-2)', background: 'var(--color-background-muted)', borderRadius: 'var(--radius-none)', border: "1px solid var(--color-border)", transition: 'box-shadow var(--duration-fast-min) var(--ease-standard)' }}
                                                    >
                                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 'var(--spacing-1)' }}>
                                                            <div style={{ display: "flex", alignItems: "flex-start", gap: 'var(--spacing-2)' }}>
                                                                {isSelectMode && request.status === 'pending' && (
                                                                    <div style={{ marginTop: 'var(--spacing-0-5)' }}>
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
                                                                            fontSize: 'var(--font-size-sm)',
                                                                            cursor: "pointer",
                                                                            transition: 'color var(--duration-fast) var(--ease-standard)',
                                                                            color: nameFilter === request.userName ? 'var(--color-text-teal)' : 'var(--color-text-primary)',
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
                                                                            <span style={{ marginLeft: 'var(--spacing-1)', display: "inline-flex", alignItems: "center" }}>
                                                                                <Icon icon={IconCheck} size="xsm" color="accent" />
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-gray)', marginTop: 'var(--spacing-0-5)' }}>
                                                                        {formatVacationDate(request.date)}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <Badge
                                                                variant={request.status === "approved" ? "green" : request.status === "pending" ? "yellow" : "red"}
                                                                label={getStatusText(request.status)}
                                                            />
                                                        </div>
                                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 'var(--spacing-1)' }}>
                                                            <div style={{ display: "flex", alignItems: "center", gap: 'var(--spacing-1)', flexWrap: "wrap" }}>
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
                                                            <div style={{ display: "flex", gap: 'var(--spacing-1)', alignItems: "center" }}>
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
                                                                    icon={<Icon icon={IconTrash} size="sm" color="inherit" />}
                                                                />
                                                            </div>
                                                            )}
                                                        </div>
                                                        {request.reason && request.reason !== "(사유 미입력)" && (
                                                            <div style={{ marginTop: 'var(--spacing-1)', padding: 'var(--spacing-1-5)', background: 'var(--color-background-card)', borderRadius: 'var(--radius-none)', border: "1px solid var(--color-border)" }}>
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
                            style={{ position: "fixed", inset: 0, zIndex: 40, display: "flex", alignItems: "center", justifyContent: "center", padding: 'var(--spacing-4)', background: "rgba(0,0,0,0.5)" }}
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
                            style={{ position: "fixed", inset: 0, zIndex: 40, display: "flex", alignItems: "center", justifyContent: "center", padding: 'var(--spacing-4)', background: "rgba(0,0,0,0.5)" }}
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
                            style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 'var(--spacing-4)', background: "rgba(0,0,0,0.5)" }}
                            onClick={cancelDelete}
                        >
                            <motion.div
                                initial={{scale: 0.95}}
                                animate={{scale: 1}}
                                exit={{scale: 0.95}}
                                onClick={(e) => e.stopPropagation()}
                                style={{ background: 'var(--color-background-card)', borderRadius: 'var(--radius-inner)', boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)", padding: 'var(--spacing-6)', width: "100%", maxWidth: 384 }}
                            >
                                <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 'var(--spacing-4)' }}>
                                    <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", height: 48, width: 48, borderRadius: 'var(--radius-full)', background: 'var(--color-background-red)' }}>
                                        <Icon icon={IconAlertTriangle} size="lg" color="error" />
                                    </div>
                                    <div style={{ marginLeft: 'var(--spacing-4)' }}>
                                        <Text type="large" weight="medium" color="primary">휴무 삭제 확인</Text>
                                        <div style={{ marginTop: 'var(--spacing-2)' }}>
                                            <Text type="body" color="secondary">
                                                <Text type="body" weight="semibold" color="primary">{selectedDeleteVacation.userName}</Text>님의 <Text type="body" weight="semibold" color="primary">{selectedDeleteVacation.date}</Text> 휴무를 정말 삭제하시겠습니까?
                                            </Text>
                                        </div>
                                        <div style={{ marginTop: 'var(--spacing-1)' }}>
                                            <Text type="supporting" color="secondary">이 작업은 되돌릴 수 없습니다.</Text>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: "flex", justifyContent: "flex-end", gap: 'var(--spacing-3)' }}>
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
                        <div className="carev-admin-footer-meta" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-gray)' }}>
                            <span>&copy; 2025 케어브이 (silverithm) 대표: 김준형</span>
                            <span className="carev-admin-footer-sep" style={{ color: 'var(--color-text-gray)' }}>|</span>
                            <span>사업자등록번호: 107-21-26475</span>
                            <span className="carev-admin-footer-sep" style={{ color: 'var(--color-text-gray)' }}>|</span>
                            <span>서울특별시 신림동 1547-10</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 'var(--spacing-3)', fontSize: 'var(--font-size-sm)' }}>
                            <a
                                href="https://plip.kr/pcc/d9017bf3-00dc-4f8f-b750-f7668e2b7bb7/privacy/1.html"
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: 'var(--color-text-gray)', textDecoration: "none", transition: 'color var(--duration-fast-min) var(--ease-standard)' }}
                            >
                                개인정보처리방침
                            </a>
                            <span style={{ color: 'var(--color-text-gray)' }}>|</span>
                            <a
                                href="https://relic-baboon-412.notion.site/silverithm-13c766a8bb468082b91ddbd2dd6ce45d"
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: 'var(--color-text-gray)', textDecoration: "none", transition: 'color var(--duration-fast-min) var(--ease-standard)' }}
                            >
                                이용약관
                            </a>
                            <span style={{ color: 'var(--color-text-gray)' }}>|</span>
                            <a href="mailto:ggprgrkjh@naver.com" style={{ color: 'var(--color-text-gray)', textDecoration: "none", transition: 'color var(--duration-fast-min) var(--ease-standard)' }}>
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
