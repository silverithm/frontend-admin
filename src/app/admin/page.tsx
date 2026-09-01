"use client";

import {useState, useEffect, useMemo, useCallback, useRef, Fragment } from "react";
import {useRouter} from "next/navigation";
import {format, addMonths, subMonths, isSameDay, startOfMonth, endOfMonth} from "date-fns";
import {ko} from "date-fns/locale";
import {
    DayInfo,
    VacationRequest,
    VacationLimit,
    resolveVacationKind,
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
    bulkDeleteVacations,
    getMemberUsers,
    getPositions,
    getApprovalRequests,
} from "@/lib/apiService";
import { useVisiblePolling } from "@/lib/useVisiblePolling";
import {motion, AnimatePresence} from "framer-motion";
import VacationCalendar from "@/components/VacationCalendar";
import ScheduleCalendar from "@/components/ScheduleCalendar";
import AnnualScheduleView from "@/components/AnnualScheduleView";
import TodayTaskReminder from "@/components/TodayTaskReminder";
import AdminPanel from "@/components/AdminPanel";
import VacationDetails from "@/components/VacationDetails";
import UserManagement from "@/components/UserManagement";
import SubscriptionStatus from "@/components/SubscriptionStatus";
import ApprovalManagement from "@/components/ApprovalManagement";
import ApprovalTemplateManager from "@/components/ApprovalTemplateManager";
import EmployeeApproval from "@/components/EmployeeApproval";
import NoticeManagement from "@/components/NoticeManagement";
import PlazaManagement from "@/components/plaza/PlazaManagement";
import VoiceBoxAdmin from "@/components/VoiceBoxAdmin";
import ExternalLinksNav from "@/components/ExternalLinksNav";
import { ChatManagement } from "@/components/ChatManagement";
import NoticeRollingBanner from "@/components/NoticeRollingBanner";
import { ChatRail } from "@/components/ChatRail/ChatRail";
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
    normalizeRoleKey,
    type MemberRoleSource,
} from "@/lib/roleUtils";
import { exportWorkScheduleExcel } from "@/lib/workScheduleExcel";
import { Button } from "@astryxdesign/core/Button";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Badge } from "@astryxdesign/core/Badge";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Text } from "@astryxdesign/core/Text";
import { Card } from "@astryxdesign/core/Card";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Selector } from "@astryxdesign/core/Selector";
import { MultiSelector } from "@astryxdesign/core/MultiSelector";
import { DateRangeInput } from "@astryxdesign/core/DateRangeInput";
import type { DateRange } from "@astryxdesign/core/DateRangeInput";
import type { ISODateString } from "@astryxdesign/core/Calendar";
import { VStack, HStack } from "@astryxdesign/core/Stack";
import { Loading, LoadingOverlay } from "@/components/Loading";
import { Banner } from "@astryxdesign/core/Banner";
import { useToast } from "@astryxdesign/core/Toast";
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
    IconUsersGroup,
    IconMailbox,
    IconHelp,
    IconApps,
    IconBus,
    IconFolder,
    IconNotes,
    IconSparkles,
} from "@tabler/icons-react";
import { duration } from '@/theme/motion';
import { Link } from '@astryxdesign/core/Link';
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Layout, LayoutContent, LayoutFooter } from "@astryxdesign/core/Layout";
import OnboardingTour from "@/components/OnboardingTour";
import AiPostWriter from "@/components/AiPostWriter";
import MeetingMinutes from "@/components/meetingMinutes/MeetingMinutes";
import CompanyLibrary from "@/components/CompanyLibrary";
import { hasSeenTour } from "@/lib/onboarding";
import { useTabBadges } from "@/lib/useTabBadges";

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

type MainTab = "dashboard" | "notice" | "chat" | "schedule" | "approval" | "work" | "members" | "plaza" | "voice" | "tools" | "library";
type ApprovalSubTab = "management" | "templates" | "submit";
// 배차관리는 편의기능 탭으로 옮겨져 더 이상 일정 서브탭이 아니다.
type ScheduleMode = "schedule" | "annual";
// 편의기능 탭에 들어가는 부가 도구들. 새 편의기능을 붙일 때 여기에 키를 추가한다.
type ToolKey = "dispatch" | "aipost" | "minutes";
export default function AdminPage() {
    const router = useRouter();
    const [activeMainTab, setActiveMainTab] = useState<MainTab>("dashboard");
    /** 우측 레일에서 고른 대화방 — 채팅 탭이 열릴 때 이 방을 편다 */
    const [railRoomId, setRailRoomId] = useState<number | null>(null);
    /** 채팅 탭 안에서 지금 실제로 보고 있는 방 — 그 방의 새 메시지는 토스트를 띄우지 않는다 */
    const [activeChatRoomId, setActiveChatRoomId] = useState<number | null>(null);
    const [showTour, setShowTour] = useState(false);
    // 인라인 함수를 넘기면 투어 쪽 효과가 매 렌더 재실행되어 대상 탐색이 취소된다
    const handleTourNavigate = useCallback((tab: string) => setActiveMainTab(tab as MainTab), []);

    // 커뮤니티 [운영] 공지는 새 탭(랜딩)이 아니라 admin 안의 커뮤니티 탭에서 연다.
    // PlazaManagement가 마운트될 때 ?post= 를 읽으므로 먼저 주소에 심어둔다.
    const handleOpenPlazaPost = useCallback((postId: number) => {
        const url = new URL(window.location.href);
        url.searchParams.set('post', String(postId));
        window.history.replaceState(null, '', url);
        setActiveMainTab('plaza');
    }, []);
    const [approvalSubTab, setApprovalSubTab] = useState<ApprovalSubTab>("submit");
    const [scheduleMode, setScheduleMode] = useState<ScheduleMode>("schedule");
    // 연간일정에서 특정 달을 누르면 그 달을 펼친 채로 월간일정으로 넘어간다.
    const [scheduleFocusMonth, setScheduleFocusMonth] = useState<Date | null>(null);
    const [activeTool, setActiveTool] = useState<ToolKey>("dispatch");
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [dateVacations, setDateVacations] = useState<VacationRequest[]>([]);
    const [showDetails, setShowDetails] = useState(false);
    const [showLimitPanel, setShowLimitPanel] = useState(false);
    const [vacationDays, setVacationDays] = useState<Record<string, DayInfo>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingRequests, setIsLoadingRequests] = useState(true);
    const toast = useToast();
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

    // 휴무 목록 조회 기간. 기본값은 캘린더가 보고 있는 달이다.
    // 이 값이 목록에 보이는 범위이자 일괄 승인의 범위다 — 화면에 없는 다음 달 휴무가
    // "전체 선택"에 딸려 들어가 승인되던 문제를 여기서 막는다.
    const [listRange, setListRange] = useState<{ start: string; end: string }>(() => ({
        start: format(startOfMonth(new Date()), "yyyy-MM-dd"),
        end: format(endOfMonth(new Date()), "yyyy-MM-dd"),
    }));

    const [statusFilter, setStatusFilter] = useState<
        "all" | "pending" | "approved" | "rejected"
    >("all");
    const [allRequests, setAllRequests] = useState<VacationRequest[]>([]);
    const [roleFilters, setRoleFilters] = useState<string[]>([]);
    // 단일 소비처 호환용 파생값: 1개 선택이면 그 직종, 그 외(전체·다중)는 전체.
    // 다중 선택의 정밀 필터링은 각 소비처에서 roleFilters로 직접 처리한다.
    const roleFilter = roleFilters.length === 1 ? roleFilters[0] : ALL_ROLE_FILTER;
    const [nameFilter, setNameFilter] = useState<string | null>(null);
    const [sortOrder, setSortOrder] = useState<
        "latest" | "oldest" | "vacation-date-asc" | "vacation-date-desc" | "name" | "role"
    >("latest");
    const [members, setMembers] = useState<MemberRoleSource[]>([]);
    const [isExportingExcel, setIsExportingExcel] = useState(false);
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
    const [isDemoMode, setIsDemoMode] = useState(false);

    // 탭별 새 콘텐츠 배지 — 근무조정(pendingRequests)·채팅(서버 unreadCount)을 뺀
    // 나머지 탭의 숫자를 이 훅이 폴링으로 집계한다
    const { counts: tabCounts, onNoticesLoaded, onMembersPendingChange } = useTabBadges({
        activeTab: activeMainTab,
    });
    /** 전체 안 읽은 채팅 수 — 채팅 탭 밖에서는 레일이, 채팅 탭 안에서는 채팅 화면이 채운다 */
    const [chatUnread, setChatUnread] = useState(0);

    /** 사이드바·모바일 탭에 붙는 빨간 숫자. 0이면 아무것도 그리지 않는다. */
    const tabBadgeEl = (key: MainTab) => {
        const count =
            key === "work" ? pendingRequests.length
            : key === "chat" ? chatUnread
            : key in tabCounts ? tabCounts[key as keyof typeof tabCounts]
            : 0;
        return count > 0 ? <Badge variant="error" label={count > 99 ? "99+" : count} /> : undefined;
    };

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
    // 첫 방문이면 사용법 안내를 띄운다 (완료 여부는 브라우저에 계정별로 저장)
    useEffect(() => {
        const userKey = typeof window !== 'undefined'
            ? (localStorage.getItem('userId') || localStorage.getItem('userEmail'))
            : null;
        if (!hasSeenTour(userKey)) {
            // 화면이 다 그려진 뒤에 띄워야 대상 요소를 찾을 수 있다
            const timer = setTimeout(() => setShowTour(true), 600);
            return () => clearTimeout(timer);
        }
    }, []);

    useEffect(() => {
        setIsClient(true);
        setIsDemoMode(localStorage.getItem('isDemoMode') === 'true');
    }, []);

    useEffect(() => {
        if (!isClient) return; // 클라이언트 사이드가 아니면 실행하지 않음

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

        // 데이터 조회는 아래 effect가 전담한다.
        // 여기서도 부르면 화면이 뜰 때 같은 요청이 두 벌씩 나가면서
        // 토큰 갱신 경합과 백엔드 부하를 괜히 키운다.
    }, [router, isClient]);

    useEffect(() => {
        if (!isClient) return; // 클라이언트 사이드가 아니면 실행하지 않음

        if (localStorage.getItem("authToken")) {
            fetchMonthData();
            // fetchAllRequests(); // 제거: getVacationCalendar 데이터 사용
        }
        // 조회 기간이 달 밖으로 넓어지면 그만큼 더 받아와야 하므로 listRange도 의존성이다
    }, [currentDate, listRange, isClient]);

    const filteredRequests = useMemo(() => {
        // allRequests가 배열인지 확인
        if (!Array.isArray(allRequests)) {
            console.warn("allRequests가 배열이 아닙니다:", allRequests);
            return [];
        }

        let filtered = allRequests;

        // 조회 기간 밖의 휴무는 목록에도, 일괄 승인 대상에도 들어가지 않는다
        // (yyyy-MM-dd는 사전순 비교가 곧 날짜 비교다)
        filtered = filtered.filter(
            (request) => request.date >= listRange.start && request.date <= listRange.end
        );

        // 선택된 날짜 필터링 추가
        if (selectedDate) {
            const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
            filtered = filtered.filter((request) => request.date === selectedDateStr);
        }

        if (statusFilter !== "all") {
            filtered = filtered.filter((request) => request.status === statusFilter);
        }
        if (roleFilters.length > 0) {
            filtered = filtered.filter((request) => {
                const resolved = getVacationRequestRole(request, memberRoleLookup);
                return resolved != null && roleFilters.includes(resolved);
            });
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
        roleFilters,
        nameFilter,
        memberRoleLookup,
        sortOrder,
        selectedDate,
        listRange,
    ]);

    // 화면에서 사라진 휴무가 선택에 남아 있으면 일괄 승인에 딸려 들어간다.
    // (달을 넘기거나 기간·상태 필터를 바꾼 뒤가 특히 위험하다)
    // 선택은 항상 지금 목록에 보이는 것만 유지한다.
    useEffect(() => {
        setSelectedVacationIds((prev) => {
            if (prev.size === 0) return prev;
            const visibleIds = new Set(filteredRequests.map((request) => request.id));
            const kept = new Set([...prev].filter((id) => visibleIds.has(id)));
            return kept.size === prev.size ? prev : kept;
        });
    }, [filteredRequests]);

    const handleLogout = async () => {
        try {
            await apiLogout();
            router.push("/");
        } catch (error) {
            console.error("로그아웃 실패:", error);
            showNotification("로그아웃 중 오류가 발생했습니다.", "error");
        }
    };

    // 달을 빠르게 넘기면 이전 달 응답이 뒤늦게 도착할 수 있다.
    // 마지막으로 시작한 조회만 화면에 반영한다.
    const monthDataRequestIdRef = useRef(0);

    const fetchMonthData = async () => {
        const requestId = ++monthDataRequestIdRef.current;
        const isStale = () => monthDataRequestIdRef.current !== requestId;

        try {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth();



            // 캘린더는 보고 있는 달이 다 필요하고 목록은 조회 기간이 필요하다.
            // 조회 기간이 달 밖으로 나갈 수 있으므로 둘을 합친 범위를 한 번에 받는다.
            const monthStartStr = format(new Date(year, month, 1), "yyyy-MM-dd");
            const monthEndStr = format(new Date(year, month + 1, 0), "yyyy-MM-dd");
            const startDateStr = listRange.start < monthStartStr ? listRange.start : monthStartStr;
            const endDateStr = listRange.end > monthEndStr ? listRange.end : monthEndStr;

            // apiService 함수들 사용 (토큰 갱신 로직 포함)
            const [calendarData, limitsData, membersData, positionsData] = await Promise.all([
                getVacationCalendar(startDateStr, endDateStr, ALL_ROLE_FILTER),
                getVacationLimits(startDateStr, endDateStr),
                getMemberUsers().catch(() => ({ members: [] })),
                getPositions().catch(() => ({ positions: [] })),
            ]);

            if (isStale()) return; // 더 최신 조회가 이미 시작됐다

            const limitsMap: Record<string, VacationLimit> = {};
            const limits = Array.isArray(limitsData.limits) ? limitsData.limits : [];
            const membersList = Array.isArray(membersData?.members)
                ? (membersData.members as MemberRoleSource[])
                : [];
            const positionsList = Array.isArray(positionsData?.positions)
                ? (positionsData.positions as Position[])
                : [];
            limits.forEach((limit: VacationLimit) => {
                limitsMap[`${limit.date}_${normalizeRoleKey(limit.role)}`] = limit;
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
            // 뒤늦게 실패한 이전 조회는 이미 지나간 화면의 결과다. 알릴 필요 없다.
            if (isStale()) return;

            console.error("월별 휴무 데이터 로드 중 오류 발생:", error);
            setIsLoadingRequests(false); // 실패해도 목록이 계속 로딩 상태로 남지 않게
            const message = (error as Error).message || "";

            // 인증이 끊긴 경우: fetchWithAuth가 이미 로그인 페이지로 보내는 중이므로 토스트는 생략한다.
            const isAuthProblem =
                message.includes("인증") ||
                message.includes("회사 ID") ||
                message.includes("Company ID");

            if (isAuthProblem) {
                router.push("/login");
                return;
            }

            showNotification(
                "월별 휴무 데이터를 불러오는 중 오류가 발생했습니다.",
                "error"
            );
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
            let vacations = Array.isArray(data.vacations)
                ? data.vacations.map((vacation: any) => ({
                    ...vacation,
                    duration: vacation.duration || "FULL_DAY", // duration이 없으면 기본값 설정
                }))
                : [];

            // 다중 직종 선택 시 서버는 전체를 반환하므로 클라이언트에서 거른다
            if (roleFilters.length > 1) {
                vacations = vacations.filter((vacation: any) => {
                    const resolved = getVacationRequestRole(vacation, memberRoleLookup);
                    return resolved != null && roleFilters.includes(resolved);
                });
            }





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

    // 근무조정 근무표 → 직원근무일정 엑셀 내보내기 (현재 보고 있는 달 기준)
    const handleExportWorkScheduleExcel = async () => {
        if (members.length === 0) {
            showNotification("내보낼 직원이 없습니다.", "error");
            return;
        }

        setIsExportingExcel(true);
        try {
            const rowCount = await exportWorkScheduleExcel({
                targetMonth: currentDate,
                members,
                vacations: allRequests,
            });

            showNotification(
                `${format(currentDate, "yyyy년 MM월", { locale: ko })} 근무일정 ${rowCount}건을 내보냈습니다.`,
                "success"
            );
        } catch (error) {
            console.error("근무일정 엑셀 내보내기 실패:", error);
            showNotification("엑셀 내보내기에 실패했습니다.", "error");
        } finally {
            setIsExportingExcel(false);
        }
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

            // 이미 승인된 건을 함께 고를 수 있으므로 서버가 돌려준 실제 건수를 알린다
            const succeeded = response?.successCount ?? vacationIds.length;
            const failed = response?.failureCount ?? 0;
            showNotification(
                failed > 0
                    ? `${succeeded}개를 승인했습니다. ${failed}개는 처리하지 못했습니다(이미 승인됨 등).`
                    : `${succeeded}개의 휴무 요청이 승인되었습니다.`,
                failed > 0 ? "info" : "success"
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

            // 이미 거절된 건을 함께 고를 수 있으므로 서버가 돌려준 실제 건수를 알린다
            const succeeded = response?.successCount ?? vacationIds.length;
            const failed = response?.failureCount ?? 0;
            showNotification(
                failed > 0
                    ? `${succeeded}개를 거절했습니다. ${failed}개는 처리하지 못했습니다(이미 거절됨 등).`
                    : `${succeeded}개의 휴무 요청이 거절되었습니다.`,
                failed > 0 ? "info" : "success"
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

    // 일괄 삭제 처리 — 되돌릴 수 없으므로 확인을 받는다
    const handleBulkDelete = async () => {
        if (selectedVacationIds.size === 0) {
            showNotification("선택된 휴무 요청이 없습니다.", "info");
            return;
        }
        const count = selectedVacationIds.size;
        const ok = window.confirm(
            `선택한 휴무 ${count}건을 삭제합니다.\n삭제한 휴무는 되돌릴 수 없습니다. 계속할까요?`,
        );
        if (!ok) return;

        setIsProcessing(true);
        try {
            await bulkDeleteVacations(Array.from(selectedVacationIds));
            showNotification(`${count}개의 휴무가 삭제되었습니다.`, "success");
            setSelectedVacationIds(new Set());
            setIsSelectMode(false);
            await fetchMonthData();
        } catch (error) {
            console.error("일괄 삭제 실패:", error);
            showNotification(
                `일괄 삭제 중 오류가 발생했습니다: ${(error as Error).message}`,
                "error"
            );
        } finally {
            setIsProcessing(false);
        }
    };

    /**
     * 다중 선택 대상 — 조회 기간·필터를 통과한 목록 전체.
     * 승인/거절은 대기 건에만 의미가 있지만 삭제는 승인된 건도 대상이라 상태로 거르지 않는다.
     * (서버가 이미 처리된 건은 실패로 돌려주고 나머지는 정상 처리한다)
     */
    const selectableRequests = filteredRequests;

    // 전체 선택/해제 — 조회 기간 안의 모든 휴무가 대상
    const handleSelectAll = () => {
        const ids = selectableRequests.map(req => req.id);

        if (ids.length > 0 && selectedVacationIds.size === ids.length) {
            // 모두 선택되어 있으면 전체 해제
            setSelectedVacationIds(new Set());
        } else {
            setSelectedVacationIds(new Set(ids));
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
        // Astryx Toast는 'info'|'error' 두 타입만 지원한다 — success/info는 info로 매핑.
        toast({ body: message, type: type === "error" ? "error" : "info" });
    };

    /** 클릭하면 해당 화면으로 이동하는 실시간 알림 토스트 (새 메시지·새 결재) */
    const showActionToast = (message: string, onGo: () => void) => {
        toast({
            body: message,
            type: "info",
            endContent: (
                <Button label="이동" size="sm" variant="ghost" onClick={onGo} />
            ),
        });
    };

    /**
     * 결재 도착 알림 — 채팅과 달리 실시간 채널이 없어 가벼운 폴링으로 대신한다.
     * useVisiblePolling이 탭이 백그라운드면 스스로 멈춘다. 60초면 충분히 넉넉하다.
     * 첫 응답은 '지금 이만큼 있다'이지 '새로 왔다'가 아니므로 토스트를 띄우지 않는다.
     */
    const seenPendingApprovalIdsRef = useRef<Set<string> | null>(null);
    useVisiblePolling(async () => {
        if (!isAdmin) return;
        try {
            const data = await getApprovalRequests({ status: 'PENDING' });
            const list = Array.isArray(data) ? data : (data?.approvals || data?.content || data?.data || []);
            const ids = new Set<string>(list.map((a: { id: string | number }) => String(a.id)));
            if (seenPendingApprovalIdsRef.current) {
                for (const a of list as { id: string | number; title?: string; templateName?: string; requesterName?: string }[]) {
                    if (!seenPendingApprovalIdsRef.current.has(String(a.id))) {
                        const who = a.requesterName ? `${a.requesterName}님의 ` : '';
                        showActionToast(`${who}새로운 결재가 도착했습니다`, () => {
                            setActiveMainTab('approval');
                            setApprovalSubTab('management');
                        });
                    }
                }
            }
            seenPendingApprovalIdsRef.current = ids;
        } catch (error) {
            console.error('[알림] 결재 대기 목록 조회 실패:', error);
        }
    }, 60000);

    const toggleStatusFilter = (
        status: "all" | "pending" | "approved" | "rejected"
    ) => setStatusFilter(status);
    const toggleRoleFilter = (role: string) =>
        setRoleFilters(role === ALL_ROLE_FILTER ? [] : [role]);
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

    // 캘린더에서 달을 넘기면 조회 기간도 그 달로 맞춘다.
    // 두 상태를 같은 이벤트에서 바꾸므로 리렌더는 한 번이고 데이터도 한 번만 받는다.
    const handleCurrentDateChange = useCallback((value: Date | ((prev: Date) => Date)) => {
        const next = typeof value === "function" ? value(currentDate) : value;
        setCurrentDate(next);
        setListRange({
            start: format(startOfMonth(next), "yyyy-MM-dd"),
            end: format(endOfMonth(next), "yyyy-MM-dd"),
        });
    }, [currentDate]);

    const resetFilter = () => {
        setStatusFilter("all");
        setRoleFilters([]);
        setNameFilter(null);
        setSortOrder("latest");
        // 기간까지 보고 있는 달로 되돌린다. 예전에는 여기서 전체 기간을 다시 불러와
        // 화면에 안 보이는 다음 달 휴무까지 목록에 섞였다.
        setListRange({
            start: format(startOfMonth(currentDate), "yyyy-MM-dd"),
            end: format(endOfMonth(currentDate), "yyyy-MM-dd"),
        });
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

    // 상태 한글 변환
    const getStatusText = (status?: string) => {
        switch (status) {
            case "approved":
                return "승인됨";
            case "pending":
                return "대기중";
            case "rejected":
                return "거절됨";
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
                    <Loading size="inline" label={!isClient ? "준비 중..." : "불러오는 중..."} />
                </div>
            </div>
        );
    }

    // 커뮤니티는 기관 바깥의 공간이라 맨 위에 따로 두고, 그 아래를 기관 업무 메뉴로 묶는다.
    const navGroups = ([
        {
            title: "커뮤니티",
            items: [
                { key: "plaza", label: "커뮤니티", icon: IconUsersGroup, isNew: true },
            ],
        },
        {
            title: "기관",
            items: [
                { key: "dashboard", label: "대시보드", icon: IconLayoutDashboard },
                { key: "notice", label: "공지사항", icon: IconBell },
                { key: "chat", label: "채팅", icon: IconMessageDots },
                { key: "schedule", label: "일정", icon: IconCalendar },
                { key: "approval", label: "전자결재", icon: IconFileText },
                { key: "work", label: "근무조정", icon: IconCalendarStats },
                // 고충·건의함은 기관 관리자 전용 (백엔드도 403으로 강제하지만 탭 자체를 숨긴다)
                ...(isAdmin ? [{ key: "voice", label: "고충·건의함", icon: IconMailbox, isNew: true }] : []),
                { key: "library", label: "자료실", icon: IconFolder },
                ...(isAdmin ? [{ key: "members", label: "회원관리", icon: IconUsers }] : []),
                // 편의기능 — 본 업무 흐름에 속하지 않는 부가 도구를 모으는 자리.
                // 새 편의기능이 생기면 ToolKey / 편의기능 서브탭 / 콘텐츠 분기 세 곳에만 추가하면 된다.
                ...(isAdmin ? [{ key: "tools", label: "편의기능", icon: IconApps }] : []),
            ],
        },
    ] as { title: string; items: { key: string; label: string; icon: IconType; isNew?: boolean }[] }[]);

    // 편의기능 탭의 도구 목록 (사이드바 서브탭 + 모바일 서브탭이 함께 사용)
    const toolItems = ([
        { key: "dispatch", label: "배차관리", icon: IconBus },
        { key: "aipost", label: "AI 글쓰기", icon: IconSparkles },
        { key: "minutes", label: "회의록", icon: IconNotes },
    ] as { key: ToolKey; label: string; icon: IconType }[]);

    return (
        <div style={{ display: "flex", minHeight: "100vh", background: 'var(--color-background-muted)' }}>
            {/* 사이드바 (데스크탑) */}
            <aside className="carev-admin-sidebar" style={{ flexDirection: "column", width: 224, background: 'var(--color-background-card)', borderRight: "1px solid var(--color-border)", position: "fixed", top: 0, bottom: 0, left: 0, zIndex: 30 }}>
                {/* 로고 */}
                <div style={{ display: "flex", alignItems: "center", gap: 'var(--spacing-3)', padding: "0 var(--spacing-6)", height: 64, borderBottom: "1px solid var(--color-border)", flexShrink: 0 }}>
                    <Image src="/images/carev-favicon.png" alt="케어브이" width={32} height={32} style={{ borderRadius: 'var(--radius-inner)' }} />
                    <div>
                        <Text as="p" type="body" weight="bold" color="primary">케어브이</Text>
                        {companyName && <Text as="p" type="supporting" color="secondary" maxLines={1}>{companyName}</Text>}
                    </div>
                </div>

                {/* 네비게이션 */}
                <nav style={{ flex: 1, overflowY: "auto", padding: "var(--spacing-4) var(--spacing-3)", display: "flex", flexDirection: "column", gap: 'var(--spacing-1)' }}>
                    {navGroups.map((group, groupIndex) => (
                    <Fragment key={group.title}>
                    <Text as="p" type="supporting" weight="semibold" color="secondary" style={groupIndex > 0 ? { marginTop: 'var(--spacing-3)' } : undefined}>{group.title}</Text>
                    {group.items.map((tab) => (
                        <div key={tab.key} data-tour={`nav-${tab.key}`}>
                            <Button
                                label={tab.label}
                                variant={activeMainTab === tab.key ? "secondary" : "ghost"}
                                size="md"
                                onClick={() => setActiveMainTab(tab.key as MainTab)}
                                icon={<Icon icon={tab.icon} size="sm" color={activeMainTab === tab.key ? "accent" : "primary"} />}
                                endContent={tabBadgeEl(tab.key as MainTab) ?? (tab.isNew ? <Badge variant="teal" label="NEW" /> : undefined)}
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
                            {/* 일정 서브탭 */}
                            {tab.key === "schedule" && activeMainTab === "schedule" && isAdmin && (
                                <div style={{ paddingLeft: 'var(--spacing-9)', marginTop: 'var(--spacing-1)', display: "flex", flexDirection: "column", gap: 'var(--spacing-0-5)' }}>
                                    <Button label="월간일정" variant={scheduleMode === "schedule" ? "secondary" : "ghost"} size="sm" onClick={() => setScheduleMode("schedule")} style={{ width: "100%", justifyContent: "flex-start" }} />
                                    <Button label="연간일정" variant={scheduleMode === "annual" ? "secondary" : "ghost"} size="sm" onClick={() => setScheduleMode("annual")} style={{ width: "100%", justifyContent: "flex-start" }} />
                                </div>
                            )}
                            {/* 편의기능 서브탭 — 도구가 늘어나면 toolItems에만 추가하면 된다 */}
                            {tab.key === "tools" && activeMainTab === "tools" && isAdmin && (
                                <div style={{ paddingLeft: 'var(--spacing-9)', marginTop: 'var(--spacing-1)', display: "flex", flexDirection: "column", gap: 'var(--spacing-0-5)' }}>
                                    {toolItems.map((tool) => (
                                        <Button
                                            key={tool.key}
                                            label={tool.label}
                                            variant={activeTool === tool.key ? "secondary" : "ghost"}
                                            size="sm"
                                            onClick={() => setActiveTool(tool.key)}
                                            style={{ width: "100%", justifyContent: "flex-start" }}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                    </Fragment>
                    ))}
                </nav>

                {/* 사이드바 하단 */}
                <div style={{ borderTop: "1px solid var(--color-border)", padding: "var(--spacing-3) 0", display: "flex", flexDirection: "column", gap: 'var(--spacing-1)', flexShrink: 0 }}>
                    <ExternalLinksNav />
                    <div style={{ padding: "0 var(--spacing-3)" }}><SubscriptionStatus /></div>
                    <span data-tour="sidebar-help"><Button label="사용법 보기" variant="ghost" size="sm" onClick={() => setShowTour(true)} icon={<Icon icon={IconHelp} size="sm" color="secondary" />} style={{ width: "100%", justifyContent: "flex-start" }} /></span>
                    <span data-tour="sidebar-profile"><Button label="기관 프로필" variant="ghost" size="sm" onClick={() => router.push("/admin/organization-profile")} icon={<Icon icon={IconBuilding} size="sm" color="secondary" />} style={{ width: "100%", justifyContent: "flex-start" }} /></span>
                    <Button label="로그아웃" variant="ghost" size="sm" onClick={handleLogout} icon={<Icon icon={IconLogout} size="sm" color="secondary" />} style={{ width: "100%", justifyContent: "flex-start" }} />
                </div>
            </aside>

            {/* 모바일 헤더 (lg 미만) */}
            <header className="carev-admin-mobile-header" style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 30, background: 'var(--color-background-card)', borderBottom: "1px solid var(--color-border)", boxShadow: 'var(--shadow-low)' }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 var(--spacing-4)", height: 52 }}>
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
                <nav className="scrollbar-hide" style={{ display: "flex", overflowX: "auto", padding: "0 var(--spacing-2)", marginBottom: -1 }}>
                    {([
                        { key: "plaza", label: "커뮤니티" },
                        { key: "dashboard", label: "대시보드" }, { key: "notice", label: "공지" }, { key: "chat", label: "채팅" },
                        { key: "schedule", label: "일정" }, { key: "approval", label: "결재" }, { key: "work", label: "근무" },
                        ...(isAdmin ? [{ key: "voice" as const, label: "고충·건의" as const }] : []),
                        { key: "library" as const, label: "자료실" as const },
                        ...(isAdmin ? [{ key: "members" as const, label: "회원" as const }] : []),
                        ...(isAdmin ? [{ key: "tools" as const, label: "편의기능" as const }] : []),
                    ] as { key: string; label: string }[]).map((tab) => (
                        <Button
                            key={tab.key}
                            label={tab.label}
                            variant={activeMainTab === tab.key ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => setActiveMainTab(tab.key as MainTab)}
                            endContent={tabBadgeEl(tab.key as MainTab)}
                            style={{ whiteSpace: "nowrap", flexShrink: 0 }}
                        />
                    ))}
                </nav>
            </header>

            {/* 메인 콘텐츠 영역 */}
            <div className="carev-admin-content" style={{ flex: 1, display: "flex", flexDirection: "column", height: "100dvh", minHeight: 0 }}>
            {/* 체험 모드 안내 배너 */}
            {isDemoMode && (
                <div className="carev-admin-rolling">
                    <Banner
                        status="warning"
                        container="section"
                        title="체험 모드"
                        description="예시 데이터로 둘러보는 중입니다. 데이터는 7일 후 자동 삭제되며, 직원 앱 연동·푸시 알림은 체험판에서 동작하지 않습니다. 정식 가입 시 모든 기능을 이용할 수 있습니다."
                        endContent={<Button label="정식 가입하기" variant="primary" size="sm" onClick={() => router.push('/signup')} />}
                    />
                </div>
            )}
            {/* 공지사항 롤링 배너 */}
            <div className="carev-admin-rolling">
            <NoticeRollingBanner
              onNoticeClick={() => setActiveMainTab('notice')}
              autoScrollInterval={5000}
              maxNotices={5}
              onNoticesLoaded={onNoticesLoaded}
            />
            </div>

            {/* 메인 콘텐츠 */}
            {/* 본문 + 우측 상시 채팅 레일 */}
            <div className="carev-admin-body">
            <main style={{ flexGrow: 1, minWidth: 0, minHeight: 0, overflowY: "auto", padding: 'var(--spacing-4)', display: "flex", flexDirection: "column" }}>
                {/* 탭별 컨텐츠 */}
                <AnimatePresence mode="wait" initial={false}>
                    {activeMainTab === "dashboard" ? (
                        <motion.div
                            key="dashboard"
                            initial={{opacity: 0}}
                            animate={{opacity: 1}}
                            exit={{opacity: 0}}
                            transition={{duration: duration.fastMin}}
                            style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
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
                            initial={{opacity: 0}}
                            animate={{opacity: 1}}
                            exit={{opacity: 0}}
                            transition={{duration: duration.fastMin}}
                            style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
                        >
                            {/* 관리자는 로그인 타입 자체가 공지 관리 권한이다 */}
                            <NoticeManagement canManage={isAdmin} onOpenPlazaPost={handleOpenPlazaPost} />
                        </motion.div>
                    ) : activeMainTab === "chat" ? (
                        <motion.div
                            key="chat"
                            initial={{opacity: 0}}
                            animate={{opacity: 1}}
                            exit={{opacity: 0}}
                            transition={{duration: duration.fastMin}}
                            style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
                        >
                            {/* ChatManagement의 isAdmin prop은 실제로는 "채팅방 생성·삭제 권한"이다(다른 작업자가 수정 중이라 이 파일은 손대지 않는다).
                                관리자는 로그인 타입 자체가 그 권한이므로 명시적으로 넘긴다. */}
                            <ChatManagement onNotification={showNotification} isAdmin={isAdmin} initialRoomId={railRoomId} onUnreadChange={setChatUnread} onActiveRoomChange={setActiveChatRoomId} />
                        </motion.div>
                    ) : activeMainTab === "schedule" ? (
                        <motion.div
                            key={`schedule-${scheduleMode}`}
                            initial={{opacity: 0}}
                            animate={{opacity: 1}}
                            exit={{opacity: 0}}
                            transition={{duration: duration.fastMin}}
                            style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
                        >
                            {scheduleMode === "annual" ? (
                                <AnnualScheduleView
                                    onSelectMonth={(date) => {
                                        setScheduleFocusMonth(date);
                                        setScheduleMode("schedule");
                                    }}
                                />
                            ) : (
                                <ScheduleCalendar
                                    isAdmin={isAdmin}
                                    mode={scheduleMode}
                                    initialMonth={scheduleFocusMonth}
                                    onNotification={showNotification}
                                />
                            )}
                        </motion.div>
                    ) : activeMainTab === "tools" ? (
                        <motion.div
                            key={`tools-${activeTool}`}
                            initial={{opacity: 0}}
                            animate={{opacity: 1}}
                            exit={{opacity: 0}}
                            transition={{duration: duration.fastMin}}
                            style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
                        >
                            {/* 도구가 둘 이상이 되면 모바일에서도 고를 수 있도록 전환 바를 띄운다 */}
                            {toolItems.length > 1 && (
                                <div className="carev-admin-tools-switch" style={{ marginBottom: 'var(--spacing-3)' }}>
                                    <SegmentedControl label="편의기능 선택" value={activeTool} onChange={(value) => setActiveTool(value as ToolKey)}>
                                        {toolItems.map((tool) => (
                                            <SegmentedControlItem key={tool.key} value={tool.key} label={tool.label} />
                                        ))}
                                    </SegmentedControl>
                                </div>
                            )}
                            {/* 새 편의기능은 여기에 분기를 추가한다 */}
                            {activeTool === "dispatch" && (
                                <ScheduleCalendar isAdmin={isAdmin} mode="dispatch" onNotification={showNotification} />
                            )}
                            {activeTool === "aipost" && (
                                <AiPostWriter companyName={companyName} onNotification={showNotification} />
                            )}
                            {activeTool === "minutes" && (
                                <MeetingMinutes onNotification={showNotification} />
                            )}
                        </motion.div>
                    ) : activeMainTab === "approval" ? (
                        <motion.div
                            key={`approval-${approvalSubTab}`}
                            initial={{opacity: 0}}
                            animate={{opacity: 1}}
                            exit={{opacity: 0}}
                            transition={{duration: duration.fastMin}}
                            style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
                        >
                            {approvalSubTab === "management" && isAdmin ? (
                                <ApprovalManagement />
                            ) : approvalSubTab === "templates" && isAdmin ? (
                                <ApprovalTemplateManager canManage={isAdmin} />
                            ) : (
                                <EmployeeApproval />
                            )}
                        </motion.div>
                    ) : activeMainTab === "plaza" ? (
                        <motion.div
                            key="plaza"
                            initial={{opacity: 0}}
                            animate={{opacity: 1}}
                            exit={{opacity: 0}}
                            transition={{duration: duration.fastMin}}
                            style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
                        >
                            <PlazaManagement />
                        </motion.div>
                    ) : activeMainTab === "voice" ? (
                        <motion.div
                            key="voice"
                            initial={{opacity: 0}}
                            animate={{opacity: 1}}
                            exit={{opacity: 0}}
                            transition={{duration: duration.fastMin}}
                            style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
                        >
                            <VoiceBoxAdmin />
                        </motion.div>
                    ) : activeMainTab === "work" ? (
                        <motion.div
                            key="work"
                            initial={{opacity: 0}}
                            animate={{opacity: 1}}
                            exit={{opacity: 0}}
                            transition={{duration: duration.fastMin}}
                            style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
                        >
                            {/* 근무관리 - 캘린더 + 사이드바 */}
                            <div className="carev-admin-work-layout">
                                {/* 캘린더 영역 — VacationCalendar가 자체 카드를 렌더링하므로 래퍼는 컬럼 역할만 (카드 중첩 금지) */}
                                <div className="carev-admin-work-calendar">
                                    <VacationCalendar
                                        currentDate={currentDate}
                                        setCurrentDate={handleCurrentDateChange}
                                        onDateSelect={handleDateSelect}
                                        isAdmin={isAdmin}
                                        roleFilter={roleFilter}
                                        roleFilters={roleFilters}
                                        nameFilter={nameFilter}
                                        onShowLimitPanel={handleShowLimitPanel}
                                        onNameFilterChange={setNameFilter}
                                        sortOrder={sortOrder}
                                        memberRoleLookup={memberRoleLookup}
                                        onExportExcel={handleExportWorkScheduleExcel}
                                        isExportingExcel={isExportingExcel}
                                    />
                                </div>

                                {/* 필터 및 휴무 목록 사이드바 */}
                                <div className="carev-admin-work-side" data-tour="work-side">
                                    {/* 필터 패널 — 역할이 늘어나도 높이가 고정되도록 검색 + 드롭다운 구성 */}
                                    <Card padding={3} style={{ flexShrink: 0 }}>
                                        <VStack gap={3}>
                                            <HStack hAlign="between" vAlign="center">
                                                <Text type="body" weight="medium" color="primary">필터</Text>
                                                <Button label="초기화" variant="ghost" size="sm" onClick={resetFilter} />
                                            </HStack>

                                            {/* 조회 기간 — 목록과 일괄 승인이 이 범위 안에서만 이뤄진다 */}
                                            <DateRangeInput
                                                label="조회 기간"
                                                description="이 기간의 휴무만 목록·일괄 승인 대상이 됩니다"
                                                value={{ start: listRange.start as ISODateString, end: listRange.end as ISODateString }}
                                                onChange={(value: DateRange | null) => {
                                                    if (!value?.start || !value?.end) {
                                                        // 지우면 보고 있는 달로 되돌린다 (전 기간이 열리면 다시 같은 사고가 난다)
                                                        setListRange({
                                                            start: format(startOfMonth(currentDate), "yyyy-MM-dd"),
                                                            end: format(endOfMonth(currentDate), "yyyy-MM-dd"),
                                                        });
                                                        return;
                                                    }
                                                    setListRange({ start: value.start, end: value.end });
                                                    setSelectedVacationIds(new Set());
                                                }}
                                                numberOfMonths={1}
                                            />

                                            {/* 직원 검색 — 이름으로 바로 필터 */}
                                            <TextInput
                                                label="직원 검색"
                                                isLabelHidden
                                                placeholder="직원 이름 검색"
                                                value={nameFilter ?? ""}
                                                onChange={(value) => setNameFilter(value.trim() ? value : null)}
                                                startIcon="search"
                                                hasClear
                                            />

                                            {/* 상태 — 한눈에 토글 */}
                                            <div>
                                                <div style={{ marginBottom: 'var(--spacing-1)' }}><Text as="label" type="supporting" weight="medium" color="primary">상태</Text></div>
                                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 'var(--spacing-1)' }}>
                                                    {(["all", "pending", "approved", "rejected"] as const).map((status) => {
                                                        const active = statusFilter === status;
                                                        return (
                                                        <Button
                                                            key={status}
                                                            label={status === "all" ? "전체" : status === "pending" ? "대기" : status === "approved" ? "승인" : "거절"}
                                                            variant={active ? (status === "rejected" ? "destructive" : "primary") : "ghost"}
                                                            size="sm"
                                                            onClick={() => setStatusFilter(status)}
                                                            style={{ width: "100%" }}
                                                        />
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* 역할 — 직무 수가 많아져도 한 줄 유지 */}
                                            <MultiSelector
                                                label="역할 (중복 선택 가능)"
                                                placeholder="전체 역할"
                                                options={availableRoles.map((role) => ({ value: role, label: getRoleDisplayName(role) }))}
                                                value={roleFilters}
                                                onChange={(values) => setRoleFilters(values)}
                                                triggerDisplay="badges"
                                                hasSelectAll
                                                selectAllLabel="전체 역할"
                                            />

                                            {/* 정렬 — 드롭다운이라 옵션을 더 제공할 수 있음 */}
                                            <Selector
                                                label="정렬"
                                                width="100%"
                                                value={sortOrder}
                                                options={[
                                                    { value: "latest", label: "최신 신청순" },
                                                    { value: "oldest", label: "오래된 신청순" },
                                                    { value: "vacation-date-asc", label: "휴무일 빠른순" },
                                                    { value: "vacation-date-desc", label: "휴무일 늦은순" },
                                                    { value: "name", label: "이름순" },
                                                    { value: "role", label: "직무순" },
                                                ]}
                                                onChange={(value) => setSortOrder((value || "latest") as typeof sortOrder)}
                                            />
                                        </VStack>
                                    </Card>

                                    {/* 휴무 목록 — 카드는 컬럼 잔여 높이를 채우고, 목록만 내부 스크롤 */}
                                    <Card padding={3} style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                                        <div style={{ marginBottom: 'var(--spacing-3)', flexShrink: 0 }}>
                                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                                <Text type="body" weight="medium" color="primary">
                                                    {selectedDate
                                                        ? `${format(selectedDate, "yyyy년 MM월 dd일", { locale: ko })} 휴무 목록`
                                                        : "전체 휴무 목록"}
                                                </Text>
                                                {isAdmin && selectableRequests.length > 0 && (
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
                                                            label={selectedVacationIds.size > 0 && selectedVacationIds.size === selectableRequests.length ? '전체 해제' : '기간 전체 선택'}
                                                            variant="secondary"
                                                            size="sm"
                                                            onClick={handleSelectAll}
                                                        />
                                                        <Text type="supporting" weight="medium" color="accent">
                                                            {selectedVacationIds.size} / {selectableRequests.length}개
                                                        </Text>
                                                    </div>
                                                    <div style={{ display: "flex", gap: 'var(--spacing-3)' }}>
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
                                                            variant="secondary"
                                                            size="sm"
                                                            isLoading={isProcessing}
                                                            isDisabled={selectedVacationIds.size === 0}
                                                            onClick={handleBulkReject}
                                                        />
                                                        <Button
                                                            label="삭제"
                                                            variant="destructive"
                                                            size="sm"
                                                            isLoading={isProcessing}
                                                            isDisabled={selectedVacationIds.size === 0}
                                                            onClick={handleBulkDelete}
                                                        />
                                                    </div>
                                                </div>
                                                {/* 조회 기간이 선택 범위를 정한다 — 어디까지 한 번에 처리되는지 분명히 보여준다 */}
                                                <Text type="supporting" color="secondary">
                                                    조회 기간 {listRange.start} ~ {listRange.end}의 휴무가 대상입니다.
                                                </Text>
                                            </div>
                                        )}

                                        {isLoadingRequests ? (
                                            <Loading size="inline" height={128} label="휴무 신청을 불러오는 중..." />
                                        ) : filteredRequests.length === 0 ? (
                                            <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                <EmptyState isCompact title="조건에 맞는 휴무 요청이 없습니다." />
                                            </div>
                                        ) : (
                                            <ul style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 'var(--spacing-2)', overflowY: "auto", paddingRight: 'var(--spacing-1)', listStyle: "none", margin: 'var(--spacing-0)' }}>
                                                {filteredRequests.map((request) => {
                                                    const resolvedRole = getVacationRequestRole(
                                                        request,
                                                        memberRoleLookup
                                                    );
                                                    const roleBadgeClasses = getRoleBadgeClasses(resolvedRole);
                                                    const requestKind = resolveVacationKind(request.type, request.duration);

                                                    return (
                                                    <li
                                                        key={request.id}
                                                        style={{ padding: 'var(--spacing-2)', background: 'var(--color-background-muted)', borderRadius: 'var(--radius-none)', border: "1px solid var(--color-border)", transition: 'box-shadow var(--duration-fast-min) var(--ease-standard)' }}
                                                    >
                                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 'var(--spacing-1)' }}>
                                                            <div style={{ display: "flex", alignItems: "flex-start", gap: 'var(--spacing-2)' }}>
                                                                {/* 승인·거절은 대기 건에만 의미가 있지만 삭제는 처리된 건도 대상이라 전부 고를 수 있게 둔다 */}
                                                                {isSelectMode && (
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
                                                                        className="carev-name-filter"
                                                                        style={{
                                                                            fontWeight: nameFilter === request.userName ? 'var(--font-weight-bold)' : 'var(--font-weight-medium)',
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
                                                                {/* 휴무 종류 — 종류와 종일·반일 구분이 하나로 합쳐졌다 */}
                                                                <Badge variant={requestKind.badgeVariant} label={requestKind.label} />
                                                                <Text type="supporting" color="secondary">{formatDate(request.createdAt)}</Text>
                                                            </div>
                                                            {isAdmin && (
                                                            <div style={{ display: "flex", gap: 'var(--spacing-3)', alignItems: "center" }}>
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
                                                            <div style={{ marginTop: 'var(--spacing-1)', padding: 'var(--spacing-2)', background: 'var(--color-background-surface)', borderRadius: 'var(--radius-inner)', border: "1px solid var(--color-border)" }}>
                                                                <Text type="supporting" color="primary">
                                                                    <Text type="supporting" weight="medium" color="accent">사유:</Text>{" "}
                                                                    {request.reason}
                                                                </Text>
                                                            </div>
                                                        )}
                                                    </li>
                                                    );
                                                })}
                                            </ul>
                                        )}
                                    </Card>
                                </div>
                            </div>
                        </motion.div>
                    ) : activeMainTab === "library" ? (
                        <motion.div
                            key="library"
                            initial={{opacity: 0}}
                            animate={{opacity: 1}}
                            exit={{opacity: 0}}
                            transition={{duration: duration.fastMin}}
                            style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
                        >
                            <CompanyLibrary canManage={isAdmin} onNotification={showNotification} />
                        </motion.div>
                    ) : activeMainTab === "members" ? (
                        <motion.div
                            key="members"
                            initial={{opacity: 0}}
                            animate={{opacity: 1}}
                            exit={{opacity: 0}}
                            transition={{duration: duration.fastMin}}
                            style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
                        >
                            <UserManagement
                                organizationName={companyName || undefined}
                                onNotification={showNotification}
                                canManage={isAdmin}
                                onPendingCountChange={onMembersPendingChange}
                            />
                        </motion.div>
                    ) : null}
                </AnimatePresence>

            </main>

            {/* 채팅 탭에서는 레일을 그리지 않는다 — 같은 목록이 화면 안에 이미 있어 중복이다.
                다만 언마운트는 하지 않는다 — 폴링(새 메시지 토스트 감지)이 다른 탭에서도 계속 돌아야 한다. */}
            <ChatRail
                hidden={activeMainTab === "chat"}
                currentRoomId={activeMainTab === "chat" ? activeChatRoomId : null}
                onOpenRoom={(roomId) => {
                    setRailRoomId(roomId);
                    setActiveMainTab("chat");
                }}
                onOpenChatTab={() => setActiveMainTab("chat")}
                onUnreadChange={setChatUnread}
                onNewMessage={(room) => {
                    showActionToast(`${room.name} — 새로운 메시지가 왔습니다`, () => {
                        setRailRoomId(room.id);
                        setActiveMainTab("chat");
                    });
                }}
            />
            </div>

            {/* 모달 컴포넌트들 - 근무관리 탭에서만 표시 */}
            {activeMainTab === "work" && (
                <>
                <AnimatePresence>
                    {showDetails && selectedDate && (
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
                                    hasExplicitAllLimit={Boolean(
                                        vacationLimits[
                                            `${format(selectedDate, "yyyy-MM-dd")}_${ALL_ROLE_FILTER}`
                                        ]
                                    )}
                                    roleFilter={roleFilter}
                                    isAdmin={isAdmin}
                                    roleOptions={availableRoles}
                                    memberRoleLookup={memberRoleLookup}
                                />
                    )}

                    {showLimitPanel && (
                        <AdminPanel
                            currentDate={currentDate}
                            onClose={handleCloseLimitPanel}
                            onUpdateSuccess={fetchMonthData}
                            vacationLimits={vacationLimits}
                            vacationDays={vacationDays}
                        />
                    )}

                </AnimatePresence>

                {/* 삭제 확인 — Astryx Dialog(purpose="required")가 backdrop·ESC·포커스 트랩을 처리한다 */}
                <Dialog
                    isOpen={showDeleteConfirm && !!selectedDeleteVacation}
                    onOpenChange={(open) => { if (!open) cancelDelete(); }}
                    purpose="required"
                    width={420}
                >
                    {selectedDeleteVacation && (
                        <Layout
                            header={
                                <DialogHeader
                                    title="휴무 삭제 확인"
                                    onOpenChange={(open) => { if (!open) cancelDelete(); }}
                                />
                            }
                            content={
                                <LayoutContent>
                                    <HStack gap={4} vAlign="start">
                                        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", height: 48, width: 48, borderRadius: 'var(--radius-full)', background: 'var(--color-background-red)' }}>
                                            <Icon icon={IconAlertTriangle} size="lg" color="error" />
                                        </div>
                                        <VStack gap={1} align="start">
                                            <Text type="body" color="secondary">
                                                <Text type="body" weight="semibold" color="primary">{selectedDeleteVacation.userName}</Text>님의 <Text type="body" weight="semibold" color="primary">{selectedDeleteVacation.date}</Text> 휴무를 정말 삭제하시겠습니까?
                                            </Text>
                                            <Text type="supporting" color="secondary">이 작업은 되돌릴 수 없습니다.</Text>
                                        </VStack>
                                    </HStack>
                                </LayoutContent>
                            }
                            footer={
                                <LayoutFooter hasDivider>
                                    <HStack gap={2} hAlign="end">
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
                                    </HStack>
                                </LayoutFooter>
                            }
                        />
                    )}
                </Dialog>
                </>
            )}

            <OnboardingTour
                isOpen={showTour}
                isAdmin={isAdmin}
                userKey={typeof window !== 'undefined' ? (localStorage.getItem('userId') || localStorage.getItem('userEmail')) : null}
                onNavigate={handleTourNavigate}
                onFinish={() => setShowTour(false)}
            />

            {/* 푸터 */}
            <footer style={{ borderTop: "1px solid var(--color-border)", background: 'var(--color-background-muted)' }}>
                <div style={{ maxWidth: 1600, margin: "0 auto", padding: "var(--spacing-4) var(--spacing-6)" }}>
                    <div className="carev-admin-footer-row">
                        <div className="carev-admin-footer-meta" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-gray)' }}>
                            <span>&copy; 2025 케어브이 (silverithm) 대표: 김준형</span>
                            <span className="carev-admin-footer-sep" style={{ color: 'var(--color-text-gray)' }}>|</span>
                            <span>사업자등록번호: 107-21-26475</span>
                            <span className="carev-admin-footer-sep" style={{ color: 'var(--color-text-gray)' }}>|</span>
                            <span>서울특별시 신림동 1547-10</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 'var(--spacing-3)', fontSize: 'var(--font-size-sm)' }}>
                            <Link
                                href="https://plip.kr/pcc/d9017bf3-00dc-4f8f-b750-f7668e2b7bb7/privacy/1.html"
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: 'var(--color-text-gray)', textDecoration: "none", transition: 'color var(--duration-fast-min) var(--ease-standard)' }}
                            >
                                개인정보처리방침
                            </Link>
                            <span style={{ color: 'var(--color-text-gray)' }}>|</span>
                            <Link
                                href="https://relic-baboon-412.notion.site/silverithm-13c766a8bb468082b91ddbd2dd6ce45d"
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: 'var(--color-text-gray)', textDecoration: "none", transition: 'color var(--duration-fast-min) var(--ease-standard)' }}
                            >
                                이용약관
                            </Link>
                            <span style={{ color: 'var(--color-text-gray)' }}>|</span>
                            <Link href="mailto:ggprgrkjh2@gmail.com" style={{ color: 'var(--color-text-gray)', textDecoration: "none", transition: 'color var(--duration-fast-min) var(--ease-standard)' }}>
                                ggprgrkjh2@gmail.com
                            </Link>
                        </div>
                    </div>
                </div>
            </footer>
            </div>{/* end lg:ml-56 wrapper */}

            {/* 오늘 담당 일정을 아직 체크하지 않았으면 우측 아래에 알림 */}
            <TodayTaskReminder
                onOpenSchedule={() => {
                    setScheduleMode("schedule");
                    setActiveMainTab("schedule");
                }}
            />

            {/* 로딩 오버레이 */}
            {isProcessing && (
                <LoadingOverlay label="처리 중..." />
            )}
        </div>
    );
}
