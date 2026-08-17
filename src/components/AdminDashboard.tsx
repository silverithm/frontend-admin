'use client';

import { useState, useEffect, useMemo, type CSSProperties } from 'react';
import { format, formatDistanceToNow, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isToday, addMonths, subMonths } from 'date-fns';
import { ko } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { Text } from '@astryxdesign/core/Text';
import { ClickableRow } from '@/components/ClickableRow';
import { Card } from '@astryxdesign/core/Card';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Icon } from '@astryxdesign/core/Icon';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Skeleton } from '@astryxdesign/core/Skeleton';
import { ClickableCard } from '@astryxdesign/core/ClickableCard';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import {
  IconUsers,
  IconCalendar,
  IconBell,
  IconCircleCheck,
  IconMoon,
  IconHeart,
  IconHome,
  IconBan,
  IconSpeakerphone,
  IconFileText,
  IconClock,
  IconMapPin,
  IconAlignLeft,
  IconChevronRight,
  IconX,
  IconCircleCheckFilled,
  IconChecklist,
  IconUserCheck,
  IconNews,
  IconPencil,
  IconTrash,
  IconPlus,
  type TablerIcon,
} from '@tabler/icons-react';
import {
  getAllMembers,
  getAllVacationRequests,
  getApprovalRequests,
  getNotices,
  getPendingJoinRequests,
  getSchedules,
  getVacationCalendar,
  getCompanyElderCount,
  getEmployeeAttendanceSummary,
  getElderAttendanceSummary,
  updateScheduleCompletion,
  getMyScheduleTasks,
  updateScheduleTaskCompletion,
  getScheduleTasks,
  getScheduleLabels,
  createScheduleTask,
  updateScheduleTask,
  deleteScheduleTask,
} from '@/lib/apiService';
import { getScheduleColor, withAlpha, getScheduleTextColor, SCHEDULE_CATEGORIES } from '@/types/schedule';
import { useConfirm } from '@/components/ConfirmDialog';
import { buildWeekBarLayouts, WEEK_GRID_COLUMNS } from '@/lib/scheduleBars';
import {
  buildBarSegments,
  loadCalendarPane,
  saveCalendarPane,
  schedulePaneFraction,
  showsSchedules,
  showsVacations,
  vacationPaneFraction,
  CALENDAR_PANE_OPTIONS,
  type CalendarPane,
} from '@/lib/calendarPanes';
import { fetchMonthVacations, vacationKindBadgeStyle, type VacationPerson } from '@/lib/monthVacations';
import CalendarVacationPane from '@/components/CalendarVacationPane';
import type { ScheduleTask } from '@/types/schedule';
import { MOCK_NEWS, loadNews, getNewsCategoryMeta, type NewsItem } from '@/components/plaza/newsMock';
import { dedupeNews } from '@/components/plaza/newsDedup';
import { fetchOfficialNotices, type ApiOfficialNotice } from '@/components/plaza/plazaApi';
import { duration } from '@/theme/motion';
import { getDailyGreeting } from '@/lib/dailyGreeting';
import { buildMemberRoleLookup, getRoleDisplayName } from '@/lib/roleUtils';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Selector } from '@astryxdesign/core/Selector';

interface AdminDashboardProps {
  onTabChange: (tab: string) => void;
  isAdmin?: boolean;
}

interface VacationItem {
  id: string;
  status: string;
  userName?: string;
  memberName?: string;
  name?: string;
  vacationType?: string;
  duration?: string;
  date?: string;
  startDate?: string;
}

interface NoticeItem {
  id: string;
  title: string;
  content?: string;
  priority?: string;
  status?: string;
  createdAt?: string;
  authorName?: string;
  viewCount?: number;
}

interface ApprovalItem {
  id: string;
  status?: string;
  title?: string;
  templateName?: string;
  requesterName?: string;
  createdAt?: string;
}

/**
 * 대시보드 달력에서 여러 날 일정을 잇는 바의 크기.
 * 월간일정 탭보다 셀이 낮아 바를 얇게 잡고 줄 수도 3줄로 제한한다.
 */
const DASH_BAR_HEIGHT = 15;
const DASH_BAR_GAP = 2;
const DASH_BAR_AREA_TOP = 30; // 셀 패딩 + 날짜 숫자 높이
const DASH_BAR_EDGE_INSET = 2;
const DASH_MAX_BAR_LANES = 3;
const DASH_CELL_MIN_HEIGHT = 92;
/** 칸 오른쪽 휴무자 칸에 이름을 몇 줄까지 보여줄지 (넘치면 +N) */
const DASH_VACATION_MAX_VISIBLE = 3;

/* 달력 격자선. 월간일정 탭과 같은 굵기·색으로 맞춘다. */
const GRID_LINE = '1px solid var(--color-border-emphasized)';

interface ScheduleItem {
  id: string;
  title: string;
  category?: string;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  isAllDay?: boolean;
  description?: string;
  content?: string;
  location?: string;
  label?: { id?: string; name?: string; color?: string } | null;
  isCompleted?: boolean;
  completedByName?: string;
  authorId?: string;
  authorName?: string;
  managerId?: number | null;
  managerName?: string | null;
  /** 일정에 등록된 할 일 수 / 그중 완료된 수 */
  taskTotal?: number;
  taskCompleted?: number;
  participants?: { id: number; memberName: string; userName?: string; status?: string }[];
}

interface VacationCalendarItem {
  id: string;
  userName?: string;
  memberName?: string;
  name?: string;
  status?: string;
  vacationType?: string;
  duration?: string;
}

interface MemberItem {
  id?: number;
  name?: string;
  status?: string;
  position?: string;
  role?: string;
}

/**
 * 상단 요약 카드(공지사항·전자결재·요양 소식)에 보여줄 줄 수.
 * 대시보드 첫 화면이 스크롤 없이 들어오도록 두 줄로 끊고, 남는 높이는 월간일정에 넘긴다.
 * 나머지는 각 카드의 "전체보기"로 넘어가서 본다.
 */
const PANEL_ROW_LIMIT = 2;

// 아이콘 칩 배경 제거(투명) — 아이콘은 중립 단색으로 통일(너무 튀지 않게)
const iconBox = (_background: string, size = 32, _radius = 8): CSSProperties => ({
  width: size,
  height: size,
  background: 'transparent',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  color: 'var(--color-icon-secondary)',
});

export default function AdminDashboard({ onTabChange, isAdmin = true }: AdminDashboardProps) {
  const { confirm, ConfirmContainer } = useConfirm();
  const [isLoading, setIsLoading] = useState(true);
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [vacationRequests, setVacationRequests] = useState<VacationItem[]>([]);
  const [approvalRequests, setApprovalRequests] = useState<ApprovalItem[]>([]);
  const [pendingJoinRequests, setPendingJoinRequests] = useState<unknown[]>([]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  // 접속 시 오늘 일정 알림 (하루 1회)
  const [showTodayScheduleAlert, setShowTodayScheduleAlert] = useState(false);
  const [vacationCalendar, setVacationCalendar] = useState<VacationCalendarItem[]>([]);
  const [todayVacationCount, setTodayVacationCount] = useState(0);
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [monthlySchedules, setMonthlySchedules] = useState<ScheduleItem[]>([]);
  const [currentTime, setCurrentTime] = useState(format(new Date(), 'HH:mm:ss'));
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleItem | null>(null);
  const [showDaySchedules, setShowDaySchedules] = useState(false);
  // 일정 상세 모달의 할 일 관리 (월간일정 탭과 동일한 UX)
  const [detailTasks, setDetailTasks] = useState<ScheduleTask[] | null>(null);
  const [newTaskContent, setNewTaskContent] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskForm, setEditTaskForm] = useState({ content: '', assigneeMemberId: '' });
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [elderCount, setElderCount] = useState(0);
  const [employeeAttendance, setEmployeeAttendance] = useState({ total: 0, present: 0, absent: 0, vacation: 0 });
  const [elderAttendance, setElderAttendance] = useState({ total: 0, present: 0, absent: 0 });
  const [currentUserEmail, setCurrentUserEmail] = useState('');
  const [currentMemberId, setCurrentMemberId] = useState<number | null>(null);
  const [togglingScheduleId, setTogglingScheduleId] = useState<string | null>(null);
  const [myTasks, setMyTasks] = useState<ScheduleTask[]>([]);
  const [taskBusyId, setTaskBusyId] = useState<string | null>(null);
  const [newsItems, setNewsItems] = useState<NewsItem[]>(MOCK_NEWS);
  // 달력이 보고 있는 달 (월간일정 탭처럼 앞뒤로 넘길 수 있다)
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [isMonthLoading, setIsMonthLoading] = useState(false);
  const [scheduleLabels, setScheduleLabels] = useState<{ id: string; name: string; color: string }[]>([]);
  const [showMyTasksOnly, setShowMyTasksOnly] = useState(false);
  // 달력 칸을 일정/휴무자로 어떻게 나눠 볼지 (월간일정 탭과 선택을 공유한다)
  const [pane, setPane] = useState<CalendarPane>('both');
  const [monthVacations, setMonthVacations] = useState<Map<string, VacationPerson[]>>(new Map());
  // 케어브이 시스템 공지 — 광장에 [운영]으로 올린 글을 기관 공지 위에 함께 보여준다
  const [officialNotices, setOfficialNotices] = useState<ApiOfficialNotice[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchOfficialNotices(3).then((items) => {
      if (!cancelled) setOfficialNotices(items);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadNews().then((items) => {
      if (!cancelled) setNewsItems(items);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentUserEmail(localStorage.getItem('userEmail') || '');
      // 직원 로그인 시 userId에 member id가 저장된다 (담당자 매칭용)
      const storedMemberId = Number(localStorage.getItem('userId'));
      setCurrentMemberId(Number.isFinite(storedMemberId) && storedMemberId > 0 ? storedMemberId : null);
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(format(new Date(), 'HH:mm:ss'));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const todayStr = format(new Date(), 'yyyy-MM-dd');

      // 달력에 얹는 월간 일정·휴무자는 보고 있는 달이 바뀔 때마다 따로 불러온다(아래 useEffect)
      // 직원은 기본 데이터만 로드, 관리자는 전체 데이터 로드
      const apiCalls = isAdmin
        ? [
            getAllMembers(),
            getAllVacationRequests(),
            getApprovalRequests({ status: 'PENDING' }),
            getPendingJoinRequests(),
            getSchedules(todayStr, todayStr),
            getVacationCalendar(todayStr, todayStr),
            getNotices(),
            getCompanyElderCount(),
            getEmployeeAttendanceSummary(todayStr),
            getElderAttendanceSummary(todayStr),
          ]
        : [
            getAllMembers(),
            Promise.resolve({ requests: [] }),
            Promise.resolve({ approvals: [] }),
            Promise.resolve([]),
            getSchedules(todayStr, todayStr),
            // 직원 대시보드에도 오늘 출근·휴무 현황을 보여준다
            getVacationCalendar(todayStr, todayStr),
            getNotices(),
            Promise.resolve({ count: 0 }),
            Promise.resolve({ total: 0, present: 0, absent: 0, vacation: 0 }),
            Promise.resolve({ total: 0, present: 0, absent: 0 }),
          ];
      const results = await Promise.allSettled(apiCalls);

      // Helper to safely extract array from API response
      const extractArray = (d: unknown, ...keys: string[]): unknown[] => {
        if (Array.isArray(d)) return d;
        if (d && typeof d === 'object') {
          const obj = d as Record<string, unknown>;
          for (const key of keys) {
            if (Array.isArray(obj[key])) return obj[key] as unknown[];
          }
        }
        return [];
      };

      results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          console.log(`[Dashboard] API[${i}] response keys:`, r.value && typeof r.value === 'object' ? Object.keys(r.value as object) : typeof r.value);
        } else {
          console.error(`[Dashboard] API[${i}] failed:`, r.reason);
        }
      });

      if (results[0].status === 'fulfilled') {
        setMembers(extractArray(results[0].value, 'members', 'content', 'data') as MemberItem[]);
      }

      if (results[1].status === 'fulfilled') {
        const arr = extractArray(results[1].value, 'requests', 'content', 'data');
        setVacationRequests(arr as VacationItem[]);
      }

      if (results[2].status === 'fulfilled') {
        const arr = extractArray(results[2].value, 'approvals', 'content', 'data');
        setApprovalRequests(arr as ApprovalItem[]);
      }

      if (results[3].status === 'fulfilled') {
        setPendingJoinRequests(extractArray(results[3].value, 'requests', 'content', 'data'));
      }

      if (results[4].status === 'fulfilled') {
        const arr = extractArray(results[4].value, 'schedules', 'content', 'data');
        setSchedules(arr as ScheduleItem[]);
        // 접속 시 오늘 일정 알림 — 하루에 한 번만 띄운다
        const alertKey = `todayScheduleAlertShown:${todayStr}`;
        if (arr.length > 0 && typeof window !== 'undefined' && localStorage.getItem(alertKey) !== '1') {
          setShowTodayScheduleAlert(true);
        }
      }

      if (results[5].status === 'fulfilled') {
        const d = results[5].value as Record<string, unknown>;
        // getVacationCalendar returns { dates: { "2026-02-27": { people: [...], count: N } } }
        if (d && d.dates && typeof d.dates === 'object') {
          const datesObj = d.dates as Record<
            string,
            {
              people?: VacationCalendarItem[];
              vacations?: VacationCalendarItem[];
              count?: number;
              totalVacationers?: number;
            }
          >;
          const todayData = datesObj[todayStr];
          if (todayData) {
            const rawPeople = todayData.people || todayData.vacations || [];
            const visiblePeople = rawPeople.filter((person) => person.status !== 'rejected');
            const visibleCount = rawPeople.length > 0
              ? visiblePeople.length
              : typeof todayData.totalVacationers === 'number'
                ? todayData.totalVacationers
                : typeof todayData.count === 'number'
                  ? todayData.count
                  : visiblePeople.length;

            setVacationCalendar(visiblePeople as VacationCalendarItem[]);
            setTodayVacationCount(visibleCount);
          } else {
            setVacationCalendar([]);
            setTodayVacationCount(0);
          }
        } else if (Array.isArray(d)) {
          const visiblePeople = (d as VacationCalendarItem[]).filter((person) => person.status !== 'rejected');
          setVacationCalendar(visiblePeople);
          setTodayVacationCount(visiblePeople.length);
        } else {
          setVacationCalendar([]);
          setTodayVacationCount(0);
        }
      }

      if (results[6].status === 'fulfilled') {
        const arr = extractArray(results[6].value, 'notices', 'content', 'data');
        setNotices(arr as NoticeItem[]);
      }

      if (results[7].status === 'fulfilled') {
        const d = results[7].value as Record<string, unknown>;
        const count = typeof d?.count === 'number' ? d.count : 0;
        setElderCount(count);
      }

      if (results[8].status === 'fulfilled') {
        const d = results[8].value as Record<string, number>;
        if (d && typeof d.total === 'number') {
          setEmployeeAttendance({
            total: d.total || 0,
            present: d.present || 0,
            absent: d.absent || 0,
            vacation: d.vacation || 0,
          });
        }
      }

      if (results[9].status === 'fulfilled') {
        const d = results[9].value as Record<string, number>;
        if (d && typeof d.total === 'number') {
          setElderAttendance({
            total: d.total || 0,
            present: d.present || 0,
            absent: d.absent || 0,
          });
        }
      }

      setIsLoading(false);
    };

    loadData();
  }, [isAdmin]);

  // 저장해 둔 보기 선택을 복원한다 (일정만/휴무만/둘 다)
  useEffect(() => {
    setPane(loadCalendarPane());
  }, []);

  const changePane = (next: CalendarPane) => {
    setPane(next);
    saveCalendarPane(next);
  };

  // 달력이 보고 있는 달의 일정·휴무자. 달을 넘길 때마다 다시 불러온다.
  useEffect(() => {
    let cancelled = false;
    const monthStartStr = format(startOfMonth(calendarMonth), 'yyyy-MM-dd');
    const monthEndStr = format(endOfMonth(calendarMonth), 'yyyy-MM-dd');

    setIsMonthLoading(true);
    Promise.allSettled([getSchedules(monthStartStr, monthEndStr), fetchMonthVacations(calendarMonth)])
      .then(([scheduleResult, vacationResult]) => {
        if (cancelled) return;
        if (scheduleResult.status === 'fulfilled') {
          const raw = scheduleResult.value;
          const arr = Array.isArray(raw)
            ? raw
            : ((raw as Record<string, unknown>)?.schedules as unknown[]) ||
              ((raw as Record<string, unknown>)?.content as unknown[]) ||
              [];
          setMonthlySchedules(arr as ScheduleItem[]);
        } else {
          console.error('[Dashboard] 월간일정 로드 실패:', scheduleResult.reason);
          setMonthlySchedules([]);
        }
        setMonthVacations(vacationResult.status === 'fulfilled' ? vacationResult.value : new Map());
        setIsMonthLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [calendarMonth]);

  // 일정 색상 범례에 쓸 사용자 지정 라벨
  useEffect(() => {
    let cancelled = false;
    getScheduleLabels()
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data : data?.labels || [];
        setScheduleLabels(list as { id: string; name: string; color: string }[]);
      })
      .catch((error) => console.error('[Dashboard] 일정 라벨 로드 실패:', error));
    return () => {
      cancelled = true;
    };
  }, []);

  const pendingVacationCount = vacationRequests.filter(
    (v) => v.status === 'pending' || v.status === 'PENDING'
  ).length;
  const hasMemberStatus = members.some((member) => typeof member.status === 'string' && member.status.length > 0);
  const activeMembersCount = members.filter((member) => {
    if (!member.status) return true;
    const normalizedStatus = member.status.toLowerCase();
    return normalizedStatus === 'active' || normalizedStatus === 'approved';
  }).length;
  const visibleMembersCount = hasMemberStatus ? activeMembersCount : members.length;
  const employeeAttendanceBase = employeeAttendance.total || visibleMembersCount;

  // 오늘 일정 알림 닫기 — 같은 날 다시 띄우지 않는다
  const dismissTodayScheduleAlert = () => {
    setShowTodayScheduleAlert(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`todayScheduleAlertShown:${format(new Date(), 'yyyy-MM-dd')}`, '1');
    }
  };

  /**
   * 이름 → 직무 표. 휴무 API가 직무를 주지 않아 회원 목록에서 이름으로 찾는다
   * (운영 데이터에서 휴무의 user_id는 회원 id와 맞지 않아 이름이 유일한 연결고리다).
   */
  const vacationRoleByName = useMemo(() => {
    const lookup = buildMemberRoleLookup(members);
    const map = new Map<string, string>();
    lookup.byName.forEach((role, name) => {
      if (role) map.set(name, getRoleDisplayName(role));
    });
    return map;
  }, [members]);

  // 오늘 휴무자 명단 — 회원 목록에서 직종(직책)을 찾아 "요양보호사 김영희" 형식으로 만든다
  const todayVacationRosterText = (() => {
    const lookup = buildMemberRoleLookup(members);
    return vacationCalendar
      .map((person) => {
        const name = (person.memberName || person.userName || person.name || '').trim();
        if (!name) return '';
        // lookup에는 'caregiver' 같은 원본 키가 담긴다 — 화면에는 등록된 직종명으로 보여준다
        const role = lookup.byName.get(name) || '';
        const roleLabel = role ? getRoleDisplayName(role) : '';
        return roleLabel ? `${roleLabel} ${name}` : name;
      })
      .filter(Boolean)
      .join(', ');
  })();
  const elderAttendanceBase = elderAttendance.total || elderCount;
  const todayWorkingCount = Math.max(visibleMembersCount - todayVacationCount, 0);

  // 내가 관련된 일정인지 (작성자 / 담당자 / 참석자 / 내 할 일이 걸린 일정)
  // 월간일정 탭(ScheduleCalendar)의 '내 업무만'과 같은 규칙이다.
  const isMySchedule = (schedule: ScheduleItem) => {
    if (schedule.authorId && schedule.authorId === currentUserEmail) return true;
    if (currentMemberId == null) return false;
    if (schedule.managerId != null && Number(schedule.managerId) === currentMemberId) return true;
    if (myTasks.some((task) => String(task.scheduleId) === String(schedule.id))) return true;
    return !!schedule.participants?.some((p) => {
      const participant = p as { memberId?: number; userId?: number; id?: number };
      return Number(participant.memberId ?? participant.userId ?? participant.id) === currentMemberId;
    });
  };

  const visibleMonthlySchedules = useMemo(
    () => (showMyTasksOnly ? monthlySchedules.filter(isMySchedule) : monthlySchedules),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [monthlySchedules, showMyTasksOnly, currentMemberId, currentUserEmail, myTasks],
  );

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const selectedDayVacations = monthVacations.get(selectedDateStr) || [];
  const selectedSchedules = visibleMonthlySchedules.filter((s) => {
    const start = s.startDate?.substring(0, 10);
    const end = s.endDate?.substring(0, 10);
    if (start && end) {
      return selectedDateStr >= start && selectedDateStr <= end;
    }
    return start === selectedDateStr;
  });

  const monthlySchedulesByDay = useMemo(() => {
    const dayMap = new Map<string, ScheduleItem[]>();
    const push = (key: string, schedule: ScheduleItem) => {
      const list = dayMap.get(key);
      if (list) list.push(schedule);
      else dayMap.set(key, [schedule]);
    };

    visibleMonthlySchedules.forEach((schedule) => {
      const start = schedule.startDate?.substring(0, 10);
      const end = schedule.endDate?.substring(0, 10);

      if (!start) return;

      if (!end || end < start) {
        push(start, schedule);
        return;
      }

      const cursor = new Date(`${start}T00:00:00`);
      const endDate = new Date(`${end}T00:00:00`);

      while (cursor <= endDate) {
        push(format(cursor, 'yyyy-MM-dd'), schedule);
        cursor.setDate(cursor.getDate() + 1);
      }
    });

    return dayMap;
  }, [visibleMonthlySchedules]);

  // 보고 있는 달의 일정 진행도
  const monthlyProgress = useMemo(() => {
    const total = visibleMonthlySchedules.length;
    const done = visibleMonthlySchedules.filter((s) => s.isCompleted).length;
    return { total, done, percent: total > 0 ? Math.round((done / total) * 100) : 0 };
  }, [visibleMonthlySchedules]);

  // 내 할 일 로드 (이번 달 기준)
  useEffect(() => {
    const loadMyTasks = async () => {
      try {
        const monthStartStr = format(startOfMonth(new Date()), 'yyyy-MM-dd');
        const monthEndStr = format(endOfMonth(new Date()), 'yyyy-MM-dd');
        const data = await getMyScheduleTasks(monthStartStr, monthEndStr);
        const list = Array.isArray(data) ? data : (data?.tasks || []);
        setMyTasks(list as ScheduleTask[]);
      } catch (error) {
        console.error('[Dashboard] 내 할 일 로드 실패:', error);
        setMyTasks([]);
      }
    };
    loadMyTasks();
  }, []);

  // 내 할 일 완료 토글 (낙관적 업데이트 후 실패 시 롤백)
  const handleToggleMyTask = async (task: ScheduleTask, completed: boolean) => {
    setTaskBusyId(task.id);
    const apply = (value: boolean) =>
      setMyTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, isCompleted: value } : t)));

    apply(completed);
    try {
      await updateScheduleTaskCompletion(String(task.scheduleId), task.id, completed);
    } catch (error) {
      console.error('[Dashboard] 할 일 완료 변경 실패:', error);
      apply(!completed);
    } finally {
      setTaskBusyId(null);
    }
  };

  const getCategoryLabel = (category?: string) =>
    SCHEDULE_CATEGORIES.find((c) => c.value === category)?.label || category || '';

  // 수정/삭제 권한 (관리자 또는 작성자 본인)
  const canManageSchedule = (schedule: ScheduleItem) =>
    isAdmin || (!!schedule.authorId && schedule.authorId === currentUserEmail);

  // 수행완료 권한: 담당자가 지정된 일정은 담당자 본인만, 미지정 일정은 관리자/작성자
  // (월간일정 화면 ScheduleCalendar와 동일한 규칙)
  const canToggleCompletion = (schedule: ScheduleItem) =>
    schedule.managerId != null
      ? Number(schedule.managerId) === currentMemberId
      : canManageSchedule(schedule);

  // 할 일이 등록된 일정은 일정 자체를 직접 완료 처리하지 않는다.
  // 담당자들이 할 일을 모두 체크하면 완료된다 (서버 로직과 동일).
  const hasTasks = (schedule: ScheduleItem) => (schedule.taskTotal || 0) > 0;

  // 수행완료 토글 (낙관적 업데이트 후 실패 시 롤백)
  const handleToggleCompletion = async (schedule: ScheduleItem, completed: boolean) => {
    setTogglingScheduleId(schedule.id);
    const applyState = (value: boolean) => {
      setMonthlySchedules((prev) => prev.map((s) => (s.id === schedule.id ? { ...s, isCompleted: value } : s)));
      setSelectedSchedule((prev) => (prev && prev.id === schedule.id ? { ...prev, isCompleted: value } : prev));
    };

    applyState(completed);
    try {
      await updateScheduleCompletion(schedule.id, completed);
    } catch (error) {
      console.error('[Dashboard] 수행완료 변경 실패:', error);
      applyState(!completed);
    } finally {
      setTogglingScheduleId(null);
    }
  };

  // ==================== 일정 상세 모달: 할 일 (월간일정 탭과 동일한 규칙) ====================

  const selectedScheduleId = selectedSchedule?.id ?? null;

  // 모달이 열리면 할 일 목록을 로드하고, 닫히면 입력 상태를 정리한다
  useEffect(() => {
    if (!selectedScheduleId) {
      setDetailTasks(null);
      setEditingTaskId(null);
      setNewTaskContent('');
      setNewTaskAssignee('');
      return;
    }
    let cancelled = false;
    getScheduleTasks(selectedScheduleId)
      .then((res) => {
        if (!cancelled) setDetailTasks(((res?.tasks || []) as ScheduleTask[]));
      })
      .catch((error) => {
        console.error('[Dashboard] 할 일 목록 로드 실패:', error);
        if (!cancelled) setDetailTasks([]);
      });
    return () => { cancelled = true; };
  }, [selectedScheduleId]);

  // 할 일 변경을 상세 모달·달력 위젯의 집계(taskTotal/완료 여부)에 함께 반영
  const applyDetailTasks = (scheduleId: string, tasks: ScheduleTask[]) => {
    setDetailTasks(tasks);
    const done = tasks.filter((t) => t.isCompleted).length;
    const patch = (s: ScheduleItem): ScheduleItem => ({
      ...s,
      taskTotal: tasks.length,
      taskCompleted: done,
      isCompleted: tasks.length > 0 ? done === tasks.length : s.isCompleted,
    });
    setMonthlySchedules((prev) => prev.map((s) => (s.id === scheduleId ? patch(s) : s)));
    setSelectedSchedule((prev) => (prev && prev.id === scheduleId ? patch(prev) : prev));
  };

  // 담당자가 지정된 할 일은 담당자 본인만 체크할 수 있다. 미지정 항목은 누구나 가능.
  const canCompleteTask = (task: ScheduleTask) =>
    task.assigneeMemberId == null || Number(task.assigneeMemberId) === currentMemberId;

  // 내용 수정/삭제는 관리자, 일정 작성자, 항목 등록자, 담당자 본인
  const canEditTask = (task: ScheduleTask) =>
    isAdmin ||
    task.createdById === currentUserEmail ||
    selectedSchedule?.authorId === currentUserEmail ||
    (task.assigneeMemberId != null && Number(task.assigneeMemberId) === currentMemberId);

  const handleAddDetailTask = async () => {
    if (!selectedSchedule || !newTaskContent.trim()) return;
    setIsAddingTask(true);
    try {
      const res = await createScheduleTask(selectedSchedule.id, {
        content: newTaskContent.trim(),
        assigneeMemberId: newTaskAssignee ? Number(newTaskAssignee) : null,
      });
      const created: ScheduleTask | undefined = res?.task;
      if (created) applyDetailTasks(selectedSchedule.id, [...(detailTasks || []), created]);
      setNewTaskContent('');
      setNewTaskAssignee('');
    } catch (error) {
      console.error('[Dashboard] 할 일 추가 실패:', error);
    } finally {
      setIsAddingTask(false);
    }
  };

  const handleToggleDetailTask = async (task: ScheduleTask, completed: boolean) => {
    if (!selectedSchedule) return;
    setTaskBusyId(task.id);
    const before = detailTasks || [];
    applyDetailTasks(selectedSchedule.id, before.map((t) => (t.id === task.id ? { ...t, isCompleted: completed } : t)));
    try {
      const res = await updateScheduleTaskCompletion(selectedSchedule.id, task.id, completed);
      const updated: ScheduleTask | undefined = res?.task;
      if (updated) {
        applyDetailTasks(selectedSchedule.id, before.map((t) => (t.id === task.id ? updated : t)));
      }
    } catch (error) {
      console.error('[Dashboard] 할 일 완료 변경 실패:', error);
      applyDetailTasks(selectedSchedule.id, before);
    } finally {
      setTaskBusyId(null);
    }
  };

  const handleUpdateDetailTask = async () => {
    if (!selectedSchedule || !editingTaskId || !editTaskForm.content.trim()) return;
    setTaskBusyId(editingTaskId);
    try {
      const res = await updateScheduleTask(selectedSchedule.id, editingTaskId, {
        content: editTaskForm.content.trim(),
        assigneeMemberId: editTaskForm.assigneeMemberId ? Number(editTaskForm.assigneeMemberId) : null,
      });
      const updated: ScheduleTask | undefined = res?.task;
      if (updated) {
        applyDetailTasks(selectedSchedule.id, (detailTasks || []).map((t) => (t.id === editingTaskId ? updated : t)));
      }
      setEditingTaskId(null);
    } catch (error) {
      console.error('[Dashboard] 할 일 수정 실패:', error);
    } finally {
      setTaskBusyId(null);
    }
  };

  const handleDeleteDetailTask = async (task: ScheduleTask) => {
    if (!selectedSchedule) return;
    const confirmed = await confirm({
      title: '할 일 삭제',
      message: '이 할 일을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.',
      confirmText: '삭제',
      type: 'danger',
    });
    if (!confirmed) return;
    setTaskBusyId(task.id);
    try {
      await deleteScheduleTask(selectedSchedule.id, task.id);
      applyDetailTasks(selectedSchedule.id, (detailTasks || []).filter((t) => t.id !== task.id));
    } catch (error) {
      console.error('[Dashboard] 할 일 삭제 실패:', error);
    } finally {
      setTaskBusyId(null);
    }
  };

  const monthlyCalendarDays = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = endOfMonth(calendarMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    const cells = days.map((day) => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const daySchedules = monthlySchedulesByDay.get(dayStr) || [];

      return {
        date: day,
        dayStr,
        inMonth: isSameMonth(day, calendarMonth),
        todayFlag: isToday(day),
        dayOfWeek: day.getDay(),
        scheduleCount: daySchedules.length,
        daySchedules,
      };
    });

    // 주 단위로 잘라서 담는다. 여러 날 일정을 한 줄로 잇는 바가 주 안에서 좌표를 잡기 때문이다.
    const weeks: (typeof cells)[] = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }

    return { weeksCount: weeks.length, days: cells, weeks };
  }, [monthlySchedulesByDay, calendarMonth]);

  /**
   * 주별 바 레이아웃. 월간일정 탭과 같은 규칙으로 여러 날 일정을 하나로 잇는다.
   * 대시보드 셀은 월간일정보다 낮아서 줄 수만 더 좁게 잡는다.
   */
  const monthlyWeekBars = useMemo(
    () =>
      buildWeekBarLayouts(
        visibleMonthlySchedules,
        monthlyCalendarDays.weeks.map((week) => week.map((cell) => cell.dayStr)),
        DASH_MAX_BAR_LANES,
      ),
    [visibleMonthlySchedules, monthlyCalendarDays],
  );

  if (isLoading) {
    return (
      <div className="carev-dash-root" style={{ display: 'flex', minHeight: 0, flex: 1, flexDirection: 'column', gap: 'var(--spacing-3)', paddingBottom: 'var(--spacing-4)' }}>
        <div style={{ height: 56 }} />
        <div className="carev-dash-panels" style={{ display: 'grid', gap: 'var(--spacing-3)', flex: 1 }}>
          <Skeleton height={340} radius={3} />
          <Skeleton height={340} radius={3} />
          <div className="carev-dash-panel-full">
            <Skeleton height={480} radius={3} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="carev-dash-root" style={{ display: 'flex', minHeight: 0, flex: 1, flexDirection: 'column', gap: 'var(--spacing-3)', paddingBottom: 'var(--spacing-4)' }}>
      {/* 1. Header Bar */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: duration.fastMax }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <HStack gap={2} vAlign="center">
          <Text type="body" weight="bold" color="primary">
            {getDailyGreeting()}
          </Text>
          <Text type="supporting" color="secondary">
            {format(new Date(), 'yyyy년 M월 d일 (EEEE)', { locale: ko })}
          </Text>
        </HStack>
        <div className="carev-dash-clock" style={{ textAlign: 'right' }}>
          <Text type="body" weight="bold" color="secondary" hasTabularNumbers>{currentTime}</Text>
        </div>
      </motion.div>

      {/* 상단 통계 줄은 없앴다 — 같은 수치를 각 패널 안에서 보고 있어 한 줄을 통째로 쓰는 값이
          아니었고, 그 높이를 월간일정에 넘기는 편이 훨씬 유용하다는 요청이 있었다.
          당일 휴무인원만 월간일정 헤더 우측으로 옮겼다. */}

      {/* 3. Three-panel grid: 공지사항, 전자결재, 월간일정(하단 전체) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: duration.mediumMin, delay: 0.15 }}
        className="carev-dash-panels"
        style={{ display: 'grid', gap: 'var(--spacing-3)', flex: 1, minHeight: 0 }}
      >
        {/* 내 할 일 — 담당자로 지정된 업무를 여기서 바로 완료 처리한다 */}
        {myTasks.length > 0 && (
          <div className="carev-dash-panel-full">
            <Card padding={0} height="100%">
              <VStack gap={0} height="100%">
                <div style={{ padding: 'var(--spacing-4) var(--spacing-4) var(--spacing-2)' }}>
                  <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
                    <HStack gap={2} vAlign="center">
                      <div style={{ ...iconBox('var(--color-background-blue)'), color: 'var(--color-text-blue)' }}>
                        <Icon icon={IconChecklist} size="sm" color="inherit" />
                      </div>
                      <VStack gap={0} align="start">
                        <Text type="body" weight="bold" color="primary">내 할 일</Text>
                        <Text type="supporting" color="secondary">
                          {format(new Date(), 'M월', { locale: ko })} · 미완료 {myTasks.filter((t) => !t.isCompleted).length}건 / 전체 {myTasks.length}건
                        </Text>
                      </VStack>
                    </HStack>
                    <Button
                      variant="ghost"
                      size="sm"
                      label="월간일정 열기"
                      endContent={<Icon icon={IconChevronRight} size="xsm" />}
                      onClick={() => onTabChange('schedule')}
                    />
                  </HStack>
                </div>

                <div style={{ padding: '0 var(--spacing-4) var(--spacing-4)', overflowY: 'auto', flex: 1, minHeight: 0 }}>
                  <VStack gap={1}>
                    {[...myTasks]
                      .sort((a, b) => Number(a.isCompleted) - Number(b.isCompleted))
                      .map((task) => (
                        <div
                          key={task.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--spacing-2)',
                            padding: 'var(--spacing-2)',
                            borderRadius: 'var(--radius-element)',
                            border: `1px solid ${task.isCompleted ? 'var(--color-border-green)' : 'var(--color-border)'}`,
                            background: task.isCompleted ? 'var(--color-background-green)' : undefined,
                          }}
                        >
                          <Icon
                            icon={IconUserCheck}
                            size="sm"
                            color={task.isCompleted ? 'success' : 'secondary'}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ textDecoration: task.isCompleted ? 'line-through' : 'none', opacity: task.isCompleted ? 0.65 : 1 }}>
                              <Text as="p" type="body" weight="medium" color="primary" maxLines={1}>{task.content}</Text>
                            </div>
                            <Text as="p" type="supporting" color="secondary" maxLines={1}>
                              {task.scheduleTitle || ''}
                              {task.scheduleStartDate ? ` · ${format(new Date(task.scheduleStartDate), 'M.d')}` : ''}
                            </Text>
                          </div>
                          <div style={{ flexShrink: 0 }}>
                            <Button
                              label={task.isCompleted ? '완료 해제' : '완료'}
                              variant={task.isCompleted ? 'ghost' : 'primary'}
                              size="sm"
                              isLoading={taskBusyId === task.id}
                              isDisabled={taskBusyId === task.id}
                              onClick={() => handleToggleMyTask(task, !task.isCompleted)}
                            />
                          </div>
                        </div>
                      ))}
                  </VStack>
                </div>
              </VStack>
            </Card>
          </div>
        )}

        {/* Top-Left: 공지사항 — 3개가 보이는 높이, 나머지는 스크롤 */}
        <Card padding={0} height="100%">
          <VStack gap={0} height="100%">
            <div style={{ padding: 'var(--spacing-4) var(--spacing-4) var(--spacing-2)' }}>
              <HStack hAlign="between" vAlign="center">
                <HStack gap={2} vAlign="center">
                  <div style={{ ...iconBox('var(--color-background-yellow)'), color: 'var(--color-text-yellow)' }}>
                    <Icon icon={IconSpeakerphone} size="sm" color="inherit" />
                  </div>
                  <VStack gap={0} align="start">
                    <Text type="body" weight="bold" color="primary">공지사항</Text>
                    <Text type="supporting" color="secondary">{notices.length + officialNotices.length}개</Text>
                  </VStack>
                </HStack>
                <Button
                  variant="ghost"
                  size="sm"
                  label="전체보기"
                  endContent={<Icon icon={IconChevronRight} size="xsm" />}
                  onClick={() => onTabChange('notice')}
                />
              </HStack>
            </div>

            <div style={{ padding: '0 var(--spacing-4) var(--spacing-4)', overflowY: 'auto', flex: 1, minHeight: 0 }}>
              {notices.length === 0 && officialNotices.length === 0 ? (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <EmptyState
                    isCompact
                    title="공지사항이 없습니다"
                    icon={<Icon icon={IconSpeakerphone} size="lg" color="secondary" />}
                  />
                </div>
              ) : (
                <VStack gap={1}>
                  {/* 케어브이 시스템 공지 — 광장 [운영] 글.
                      admin 안에 광장 탭이 있으므로 새 탭으로 나가지 않고 그 탭에서 연다.
                      PlazaManagement가 마운트될 때 ?post= 를 읽으므로 먼저 주소에 심어둔다. */}
                  {officialNotices.slice(0, PANEL_ROW_LIMIT).map((notice) => (
                    <ClickableRow
                      key={`official-${notice.id}`}
                      label={`케어브이 공지 열기: ${notice.title}`}
                      className="carev-dash-row"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--spacing-2)', borderRadius: 'var(--radius-element)' }}
                      onClick={() => {
                        const url = new URL(window.location.href);
                        url.searchParams.set('post', String(notice.id));
                        window.history.replaceState(null, '', url);
                        onTabChange('plaza');
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <HStack gap={2} vAlign="center">
                          <Badge variant="teal" label="운영" />
                          <Text type="body" weight="medium" color="primary" maxLines={1}>{notice.title}</Text>
                        </HStack>
                        <Text type="supporting" color="secondary">
                          {notice.displayAuthor} · {notice.createdAt ? format(new Date(notice.createdAt), 'M.d') : ''}
                        </Text>
                      </div>
                    </ClickableRow>
                  ))}
                  {/* 운영 공지가 자리를 먼저 차지하고, 남는 줄만 기관 공지로 채운다 */}
                  {notices.slice(0, Math.max(0, PANEL_ROW_LIMIT - officialNotices.length)).map((notice) => (
                    <ClickableRow
                      key={notice.id}
                      label={`공지사항으로 이동: ${notice.title}`}
                      className="carev-dash-row"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--spacing-2)', borderRadius: 'var(--radius-element)' }}
                      onClick={() => onTabChange('notice')}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <HStack gap={2} vAlign="center">
                          {notice.priority === 'HIGH' && <Badge variant="red" label="중요" />}
                          <Text type="body" weight="medium" color="primary" maxLines={1}>{notice.title}</Text>
                        </HStack>
                        <Text type="supporting" color="secondary">
                          {notice.authorName && `${notice.authorName} · `}
                          {notice.createdAt ? format(new Date(notice.createdAt), 'M.d') : ''}
                        </Text>
                      </div>
                    </ClickableRow>
                  ))}
                </VStack>
              )}
            </div>
          </VStack>
        </Card>

        {/* Top-Right: 전자결재 — 3개가 보이는 높이, 나머지는 스크롤 */}
        <Card padding={0} height="100%">
          <VStack gap={0} height="100%">
            <div style={{ padding: 'var(--spacing-4) var(--spacing-4) var(--spacing-2)' }}>
              <HStack hAlign="between" vAlign="center">
                <HStack gap={2} vAlign="center">
                  <div style={{ ...iconBox('var(--color-background-purple)'), color: 'var(--color-text-purple)' }}>
                    <Icon icon={IconFileText} size="sm" color="inherit" />
                  </div>
                  <VStack gap={0} align="start">
                    <Text type="body" weight="bold" color="primary">전자결재</Text>
                    <Text type="supporting" color="secondary">대기 {approvalRequests.length}건</Text>
                  </VStack>
                </HStack>
                <Button
                  variant="ghost"
                  size="sm"
                  label="전체보기"
                  endContent={<Icon icon={IconChevronRight} size="xsm" />}
                  onClick={() => onTabChange('approval')}
                />
              </HStack>
            </div>

            <div style={{ padding: '0 var(--spacing-4) var(--spacing-4)', overflowY: 'auto', flex: 1, minHeight: 0 }}>
              {approvalRequests.length === 0 ? (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <EmptyState
                    isCompact
                    title="대기 중인 결재가 없습니다"
                    icon={<Icon icon={IconCircleCheck} size="lg" color="secondary" />}
                  />
                </div>
              ) : (
                <VStack gap={1}>
                  {approvalRequests.slice(0, PANEL_ROW_LIMIT).map((approval) => (
                    <ClickableRow
                      key={approval.id}
                      label={`전자결재로 이동: ${approval.title || approval.templateName || '결재 요청'}`}
                      className="carev-dash-row"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--spacing-2)', borderRadius: 'var(--radius-element)' }}
                      onClick={() => onTabChange('approval')}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text as="p" type="body" weight="medium" color="primary" maxLines={1}>
                          {approval.title || approval.templateName || '결재 요청'}
                        </Text>
                        <Text type="supporting" color="secondary">
                          {approval.requesterName && `${approval.requesterName} · `}
                          {approval.createdAt ? format(new Date(approval.createdAt), 'M.d') : ''}
                        </Text>
                      </div>
                      <div style={{ flexShrink: 0 }}>
                        <Badge variant="orange" label="대기" />
                      </div>
                    </ClickableRow>
                  ))}
                </VStack>
              )}
            </div>
          </VStack>
        </Card>

        {/* 요양 소식 — 데스크탑 와이드에선 3번째 열, 그 외엔 전체 폭 */}
        <div className="carev-dash-panel-news">
          <Card padding={0} height="100%">
            <VStack gap={0} height="100%">
              <div style={{ padding: 'var(--spacing-4) var(--spacing-4) var(--spacing-2)' }}>
                <HStack hAlign="between" vAlign="center">
                  <HStack gap={2} vAlign="center">
                    <div style={{ ...iconBox('var(--color-background-teal)'), color: 'var(--color-text-teal)' }}>
                      <Icon icon={IconNews} size="sm" color="inherit" />
                    </div>
                    <VStack gap={0} align="start">
                      <Text type="body" weight="bold" color="primary">요양 소식</Text>
                      <Text type="supporting" color="secondary">오늘의 업계 뉴스</Text>
                    </VStack>
                  </HStack>
                  <Button
                    variant="ghost"
                    size="sm"
                    label="전체보기"
                    endContent={<Icon icon={IconChevronRight} size="xsm" />}
                    onClick={() => onTabChange('plaza')}
                  />
                </HStack>
              </div>

              <div style={{ padding: '0 var(--spacing-4) var(--spacing-4)', overflowY: 'auto', flex: 1, minHeight: 0 }}>
                <VStack gap={1}>
                  {dedupeNews(newsItems).slice(0, PANEL_ROW_LIMIT).map((news) => {
                    const meta = getNewsCategoryMeta(news.category);
                    return (
                      <a
                        key={news.id}
                        className="carev-dash-row"
                        style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', padding: 'var(--spacing-2)', borderRadius: 'var(--radius-element)', textDecoration: 'none', color: 'inherit' }}
                        href={news.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <div style={{ flexShrink: 0 }}>
                          <Badge variant={meta.badgeVariant} label={meta.label} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Text as="p" type="body" weight="medium" color="primary" maxLines={1}>{news.title}</Text>
                          <Text type="supporting" color="secondary">
                            {news.source} · {formatDistanceToNow(news.publishedAt, { addSuffix: true, locale: ko })}
                          </Text>
                        </div>
                      </a>
                    );
                  })}
                </VStack>
              </div>
            </VStack>
          </Card>
        </div>

        {/* Bottom: 월간일정 (하단 전체 폭) */}
        <div className="carev-dash-panel-full">
          <Card padding={0} height="100%">
            <VStack gap={0} height="100%">
              <div style={{ padding: 'var(--spacing-3) var(--spacing-4) var(--spacing-2)' }}>
                <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
                  <HStack gap={2} vAlign="center">
                    <div style={{ ...iconBox('var(--color-background-green)'), color: 'var(--color-text-green)' }}>
                      <Icon icon={IconCalendar} size="sm" color="inherit" />
                    </div>
                    <VStack gap={0} align="start">
                      <Text type="body" weight="bold" color="primary">월간일정</Text>
                      <Text type="supporting" color="secondary">
                        {format(calendarMonth, 'yyyy년 M월', { locale: ko })} · {visibleMonthlySchedules.length}건
                        {isMonthLoading ? ' · 불러오는 중' : ''}
                      </Text>
                    </VStack>
                    {/* 달 이동 — 월간일정 탭과 같은 조작 */}
                    <HStack gap={1} vAlign="center">
                      <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-inner)' }}>
                        <IconButton
                          label="이전 달"
                          variant="ghost"
                          size="sm"
                          icon={<Icon icon="chevronLeft" size="sm" />}
                          onClick={() => setCalendarMonth((prev) => startOfMonth(subMonths(prev, 1)))}
                        />
                        <IconButton
                          label="다음 달"
                          variant="ghost"
                          size="sm"
                          icon={<Icon icon="chevronRight" size="sm" />}
                          onClick={() => setCalendarMonth((prev) => startOfMonth(addMonths(prev, 1)))}
                        />
                      </div>
                      <Button
                        label="오늘"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setCalendarMonth(startOfMonth(new Date()));
                          setSelectedDate(new Date());
                        }}
                      />
                    </HStack>
                  </HStack>
                  <HStack gap={3} vAlign="center">
                    {/* 당일 휴무인원 — 상단 통계 줄을 없애고 여기로 옮겼다.
                        달력을 보면서 "오늘 몇 명 빠지는지"를 같이 확인하는 게 실제 사용 흐름이다. */}
                    <button
                      type="button"
                      onClick={() => onTabChange('work')}
                      title={todayVacationRosterText || '오늘 휴무자 없음'}
                      className="carev-dash-today-off"
                    >
                      <HStack gap={1.5} vAlign="center">
                        <span style={{ display: 'flex', color: 'var(--color-text-yellow)' }}>
                          <Icon icon={IconMoon} size="xsm" color="inherit" />
                        </span>
                        <Text type="supporting" color="secondary">오늘 휴무</Text>
                        <Text type="supporting" weight="bold" color="primary" hasTabularNumbers>{todayVacationCount}명</Text>
                      </HStack>
                    </button>

                    {/* 이번 달 진행도 */}
                    <HStack gap={2} vAlign="center">
                      <Text type="supporting" color="secondary" hasTabularNumbers>
                        진행 {monthlyProgress.done}/{monthlyProgress.total}
                      </Text>
                      <div
                        role="progressbar"
                        aria-label="이번 달 일정 진행도"
                        aria-valuenow={monthlyProgress.percent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        style={{ width: 96, height: 6, borderRadius: 'var(--radius-full)', background: 'var(--color-background-muted)', overflow: 'hidden' }}
                      >
                        {/* 폭 대신 scaleX를 움직인다 — 폭을 애니메이션하면 매 프레임 레이아웃을 다시 계산한다 */}
                        <div style={{ width: '100%', height: '100%', background: 'var(--color-background-green)', transformOrigin: 'left', transform: `scaleX(${monthlyProgress.percent / 100})`, transition: 'transform var(--duration-fast) var(--ease-standard)' }} />
                      </div>
                      <Text type="supporting" weight="semibold" color="primary" hasTabularNumbers>{monthlyProgress.percent}%</Text>
                    </HStack>
                    {/* 일정/휴무자 보기 토글 — 기본은 둘 다 */}
                    <SegmentedControl
                      value={pane}
                      onChange={(v) => changePane(v as CalendarPane)}
                      label="달력 표시 내용"
                      size="sm"
                    >
                      {CALENDAR_PANE_OPTIONS.map((option) => (
                        <SegmentedControlItem key={option.value} value={option.value} label={option.label} />
                      ))}
                    </SegmentedControl>
                    <Button
                      label={showMyTasksOnly ? '전체 일정 보기' : '담당 업무'}
                      variant={showMyTasksOnly ? 'primary' : 'secondary'}
                      size="sm"
                      icon={<Icon icon={IconUserCheck} size="sm" />}
                      onClick={() => setShowMyTasksOnly((v) => !v)}
                    />
                    {/* 일정 등록은 월간일정 탭에서 한다 — 여기서는 그 화면으로 넘긴다 */}
                    <Button
                      label="일정 추가"
                      variant="secondary"
                      size="sm"
                      icon={<Icon icon={IconPlus} size="sm" />}
                      onClick={() => onTabChange('schedule')}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      label="전체보기"
                      endContent={<Icon icon={IconChevronRight} size="xsm" />}
                      onClick={() => onTabChange('schedule')}
                    />
                  </HStack>
                </HStack>
                {/* 색상 범례 (사용자 지정 라벨 + 카테고리 기본색) — 월간일정 탭과 같은 구성 */}
                <div style={{ marginTop: 'var(--spacing-2)', display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-3)', alignItems: 'center' }}>
                  {scheduleLabels.map((label) => (
                    <HStack key={label.id} gap={1} vAlign="center">
                      <span style={{ width: 8, height: 8, borderRadius: 'var(--radius-full)', background: label.color }} />
                      <Text type="supporting" color="secondary">{label.name}</Text>
                    </HStack>
                  ))}
                  {scheduleLabels.length > 0 && <span style={{ width: 1, height: 12, background: 'var(--color-border)' }} />}
                  {SCHEDULE_CATEGORIES.map((cat) => (
                    <HStack key={cat.value} gap={1} vAlign="center">
                      <span style={{ width: 8, height: 8, borderRadius: 'var(--radius-full)', background: getScheduleColor({ category: cat.value }) }} />
                      <Text type="supporting" color="secondary">{cat.label}</Text>
                    </HStack>
                  ))}
                  <HStack gap={1} vAlign="center">
                    <Icon icon={IconCircleCheckFilled} size="xsm" color="success" />
                    <Text type="supporting" color="secondary">수행완료</Text>
                  </HStack>
                </div>
              </div>

              {/* 격자는 월간일정 탭과 같은 규칙 — 칸마다 아래·오른쪽 선을 긋고 바깥은 테두리로 닫는다.
                  칸 사이 여백(gap)을 쓰던 예전 방식은 선이 없어 날짜 경계가 흐릿했다. */}
              <div style={{ padding: '0 var(--spacing-4) var(--spacing-3)', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    flex: 1,
                    minHeight: 0,
                    border: GRID_LINE,
                    borderRadius: 'var(--radius-inner)',
                    overflow: 'hidden',
                  }}
                >
                <div style={{ display: 'grid', gridTemplateColumns: WEEK_GRID_COLUMNS, flexShrink: 0, borderBottom: GRID_LINE }}>
                  {['일','월','화','수','목','금','토'].map((d) => (
                    <div key={d} style={{ display: 'flex', height: 28, alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: d === '일' ? 'var(--color-text-red)' : d === '토' ? 'var(--color-text-blue)' : 'var(--color-text-primary)' }}>{d}</div>
                  ))}
                </div>
                {/* 주 단위로 감싼다 — 여러 날 일정을 이어 그리는 바가 주 안에서 좌표를 잡기 때문 */}
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                {monthlyCalendarDays.weeks.map((week, weekIndex) => {
                  const layout = monthlyWeekBars[weekIndex];
                  return (
                <div
                  key={`week-${weekIndex}`}
                  style={{ position: 'relative', display: 'grid', gridTemplateColumns: WEEK_GRID_COLUMNS, flex: 1, minHeight: DASH_CELL_MIN_HEIGHT }}
                >
                  {week.map(({ date, dayStr, inMonth, todayFlag, dayOfWeek, scheduleCount, daySchedules }) => {
                    const hiddenCount = layout?.hiddenCounts[dayStr] || 0;
                    const dayVacations = monthVacations.get(dayStr) || [];
                    const isLastWeek = weekIndex === monthlyCalendarDays.weeks.length - 1;
                    return (
                      <button
                        key={date.toISOString()}
                        type="button"
                        onClick={() => {
                          if (!inMonth) return;
                          setSelectedDate(date);
                          setShowDaySchedules(true);
                        }}
                        className={!inMonth ? undefined : todayFlag ? 'carev-dash-cal-cell carev-dash-cal-cell-today' : 'carev-dash-cal-cell carev-dash-cal-cell-day'}
                        style={{
                          position: 'relative', display: 'flex', height: '100%', minHeight: 92,
                          flexDirection: 'column', alignItems: 'stretch', gap: 'var(--spacing-0-5)', padding: 'var(--spacing-1)', textAlign: 'left',
                          background: !inMonth ? 'transparent' : todayFlag ? 'var(--color-background-teal)' : 'transparent',
                          border: 'none',
                          // 격자선 — 마지막 열·마지막 주는 바깥 테두리와 겹치므로 긋지 않는다
                          borderRight: dayOfWeek === 6 ? 'none' : GRID_LINE,
                          borderBottom: isLastWeek ? 'none' : GRID_LINE,
                          opacity: inMonth ? 1 : 0.4,
                          cursor: !inMonth ? 'default' : 'pointer',
                        }}
                        disabled={!inMonth}
                      >
                        <span
                          style={{
                            // 날짜는 칸 왼쪽 위에 붙인다 (오른쪽은 휴무자 자리)
                            display: 'flex', height: 22, width: 22, flexShrink: 0, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start', borderRadius: 'var(--radius-full)', fontSize: 'var(--font-size-sm)',
                            ...(
                              !inMonth ? { color: 'var(--color-text-gray)' } :
                              todayFlag ? { background: 'var(--color-background-green)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-green)' } :
                              dayOfWeek === 0 ? { fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-red)' } :
                              dayOfWeek === 6 ? { fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-blue)' } :
                              { fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }
                            ),
                          }}
                        >
                          {format(date, 'd')}
                        </span>
                        {/* 오른쪽(또는 칸 전체) 휴무자 명단 */}
                        {showsVacations(pane) && inMonth && (
                          <CalendarVacationPane
                            people={dayVacations}
                            // 그날 일정이 없으면 휴무자가 칸을 통째로 쓴다 (왼쪽이 빈 채로 남지 않게)
                            fraction={pane === 'both' && scheduleCount === 0 ? 1 : vacationPaneFraction(pane)}
                            maxVisible={DASH_VACATION_MAX_VISIBLE}
                            topOffset={DASH_BAR_AREA_TOP}
                            hasDivider={pane === 'both' && scheduleCount > 0}
                            roleByName={vacationRoleByName}
                          />
                        )}
                        {showsSchedules(pane) && scheduleCount > 0 && inMonth && (
                          <>
                            {/* 모바일: 도트 표시 (일정 색상 그대로) */}
                            <div className="carev-dash-cal-dots" style={{ alignItems: 'center', justifyContent: 'flex-start', gap: 'var(--spacing-0-5)' }}>
                              {daySchedules.slice(0, 3).map((schedule, i) => (
                                <div
                                  key={`${schedule.id}-dot-${i}`}
                                  style={{
                                    height: 5,
                                    width: 5,
                                    borderRadius: 'var(--radius-full)',
                                    background: getScheduleColor(schedule),
                                    opacity: schedule.isCompleted ? 0.35 : 1,
                                  }}
                                />
                              ))}
                              {scheduleCount > 3 && (
                                <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 'var(--font-weight-bold)', lineHeight: 'var(--text-display-1-leading)', color: 'var(--color-text-gray)' }}>+{scheduleCount - 3}</span>
                              )}
                            </div>
                            {/* 데스크탑: 일정 제목은 주 단위 바 오버레이가 그린다(여러 날 일정을 한 줄로 잇기 위해).
                                여기서는 줄 수 제한에 걸려 못 그린 개수만 셀 아래에 남긴다. */}
                            {hiddenCount > 0 && (
                              <div className="carev-dash-cal-chips" style={{ marginTop: 'auto', justifyContent: 'flex-start', width: `calc(${schedulePaneFraction(pane) * 100}% - var(--spacing-1))` }}>
                                {/* 문구는 월간일정 달력과 같게 — 같은 뜻인데 다르게 적으면 다른 수로 읽힌다 */}
                                <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-gray)', paddingLeft: 'var(--spacing-0-5)' }}>
                                  +{hiddenCount}개
                                </span>
                              </div>
                            )}
                          </>
                        )}
                      </button>
                    );
                  })}

                  {/* 여러 날 일정을 하나의 바로 이어서 표시하는 오버레이 (월간일정 탭과 같은 규칙) */}
                  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} className="carev-dash-cal-bars">
                    {showsSchedules(pane) && layout?.bars.flatMap((bar) =>
                      buildBarSegments(bar, pane, (col) => {
                        const day = week[col];
                        return !!day && (monthVacations.get(day.dayStr)?.length ?? 0) > 0;
                      }).map((segment) => {
                      const schedule = bar.schedule;
                      const color = getScheduleColor(schedule);
                      const done = !!schedule.isCompleted;
                      const leftInset = segment.continuesBefore ? 0 : DASH_BAR_EDGE_INSET;
                      const rightInset = segment.continuesAfter ? 0 : DASH_BAR_EDGE_INSET;
                      const startRadius = segment.continuesBefore ? '0' : 'var(--radius-inner)';
                      const endRadius = segment.continuesAfter ? '0' : 'var(--radius-inner)';
                      return (
                        <button
                          key={`${schedule.id}-${weekIndex}-${segment.startCol}`}
                          type="button"
                          title={done ? `${schedule.title} (수행완료)` : schedule.title}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSchedule(schedule);
                          }}
                          style={{
                            position: 'absolute',
                            top: DASH_BAR_AREA_TOP + bar.lane * (DASH_BAR_HEIGHT + DASH_BAR_GAP),
                            left: `calc(${segment.leftPct}% + ${leftInset}px)`,
                            width: `calc(${segment.widthPct}% - ${leftInset + rightInset}px)`,
                            height: DASH_BAR_HEIGHT,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 'var(--spacing-0-5)',
                            padding: '0 var(--spacing-1)',
                            border: done ? `1px solid ${color}` : 'none',
                            borderRadius: `${startRadius} ${endRadius} ${endRadius} ${startRadius}`,
                            background: done ? withAlpha(color, 0.14) : color,
                            color: done ? color : getScheduleTextColor(color),
                            opacity: done ? 0.85 : 0.9,
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 'var(--font-weight-medium)',
                            lineHeight: '15px',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            cursor: 'pointer',
                            pointerEvents: 'auto',
                          }}
                        >
                          {segment.continuesBefore && <span style={{ flexShrink: 0 }}>◀</span>}
                          {done && <Icon icon={IconCircleCheckFilled} size="xsm" color="inherit" />}
                          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: done ? 'line-through' : 'none' }}>
                            {schedule.title}
                          </span>
                          {segment.continuesAfter && <span style={{ flexShrink: 0 }}>▶</span>}
                        </button>
                      );
                      })
                    )}
                  </div>
                </div>
                  );
                })}
                </div>
                </div>
              </div>
            </VStack>
          </Card>
        </div>
      </motion.div>

      {/* 날짜별 일정 목록 */}
      <Dialog
        isOpen={showDaySchedules}
        onOpenChange={(open) => { if (!open) setShowDaySchedules(false); }}
        purpose="info"
        width={480}
      >
        <Layout
          header={
            <DialogHeader
              title={isToday(selectedDate) ? '오늘의 일정' : format(selectedDate, 'M월 d일 (EEEE)', { locale: ko })}
              subtitle={`총 ${selectedSchedules.length}개의 일정 · 완료 ${selectedSchedules.filter((s) => s.isCompleted).length}개 · 휴무 ${selectedDayVacations.length}명`}
              onOpenChange={(open) => { if (!open) setShowDaySchedules(false); }}
            />
          }
          content={
            <LayoutContent>
              {/* 그날 휴무자 — 달력 칸에는 몇 명만 보이므로 여기서 전부 펼친다 */}
              {selectedDayVacations.length > 0 && (
                <div style={{ marginBottom: 'var(--spacing-4)' }}>
                  <VStack gap={1.5}>
                    <Text type="label" weight="semibold" color="secondary">휴무자</Text>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-1)' }}>
                      {selectedDayVacations.map((person) => (
                        <span
                          key={person.id}
                          title={person.kindLabel}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 'var(--spacing-1)',
                            padding: '2px var(--spacing-2)',
                            borderRadius: 'var(--radius-full)',
                            border: '1px solid var(--color-border)',
                            background: 'var(--color-background-muted)',
                          }}
                        >
                          <span style={vacationKindBadgeStyle(person.color)}>{person.short}</span>
                          <Text type="supporting" color="secondary">{person.name}</Text>
                        </span>
                      ))}
                    </div>
                  </VStack>
                </div>
              )}
              {selectedSchedules.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--spacing-3)', padding: 'var(--spacing-8) 0' }}>
                  <EmptyState
                    isCompact
                    title={`${format(selectedDate, 'M월 d일')} 일정이 없습니다`}
                    icon={<Icon icon={IconClock} size="lg" color="secondary" />}
                  />
                </div>
              ) : (
                <VStack gap={0}>
                  {selectedSchedules.map((schedule, idx) => (
                    <ClickableRow
                      key={schedule.id}
                      label={`일정 상세 보기: ${schedule.title}`}
                      className="carev-dash-timeline"
                      style={{ display: 'flex', gap: 'var(--spacing-3)', borderRadius: 'var(--radius-inner)', padding: '0 var(--spacing-2)', margin: '0 calc(var(--spacing-2) * -1)' }}
                      onClick={() => {
                        setShowDaySchedules(false);
                        setSelectedSchedule(schedule);
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 'var(--radius-full)', background: getScheduleColor(schedule), boxShadow: `0 0 0 4px ${withAlpha(getScheduleColor(schedule), 0.15)}`, flexShrink: 0, marginTop: 'var(--spacing-1-5)', opacity: schedule.isCompleted ? 0.4 : 1 }} />
                        {idx < selectedSchedules.length - 1 && (
                          <div style={{ width: 2, flex: 1, background: 'var(--color-background-muted)', margin: 'var(--spacing-1) 0' }} />
                        )}
                      </div>
                      <div style={{ paddingBottom: 'var(--spacing-4)', flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                          <Text type="supporting" weight="semibold" color="accent" hasTabularNumbers>
                            {schedule.isAllDay ? '종일' : (schedule.startTime || '')}
                          </Text>
                          {schedule.category && <Badge variant="neutral" label={getCategoryLabel(schedule.category)} />}
                          {schedule.isCompleted && <Badge variant="green" label="수행완료" />}
                          {hasTasks(schedule) && !schedule.isCompleted && (
                            <Badge
                              variant="blue"
                              label={`할 일 ${schedule.taskCompleted || 0}/${schedule.taskTotal}`}
                            />
                          )}
                        </div>
                        <div style={{ marginTop: 'var(--spacing-0-5)', textDecoration: schedule.isCompleted ? 'line-through' : 'none', opacity: schedule.isCompleted ? 0.6 : 1 }}>
                          <Text as="p" type="body" weight="medium" color="primary" maxLines={1}>{schedule.title}</Text>
                        </div>
                        {schedule.location && (
                          <Text as="p" type="supporting" color="secondary" maxLines={1}>{schedule.location}</Text>
                        )}
                      </div>
                      <div style={{ flexShrink: 0, alignSelf: 'center', display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}>
                        {!hasTasks(schedule) && canToggleCompletion(schedule) && (
                          <span onClick={(e) => e.stopPropagation()} style={{ display: 'flex' }}>
                            <Button
                              variant={schedule.isCompleted ? 'secondary' : 'primary'}
                              size="sm"
                              label={schedule.isCompleted ? '완료 해제' : '수행완료'}
                              isLoading={togglingScheduleId === schedule.id}
                              isDisabled={togglingScheduleId === schedule.id}
                              onClick={() => handleToggleCompletion(schedule, !schedule.isCompleted)}
                            />
                          </span>
                        )}
                        <Icon icon={IconChevronRight} size="sm" color="secondary" />
                      </div>
                    </ClickableRow>
                  ))}
                </VStack>
              )}
            </LayoutContent>
          }
          footer={
            <LayoutFooter hasDivider>
              <HStack gap={2} hAlign="between" vAlign="center">
                <Button
                  label="월간일정 전체보기"
                  variant="ghost"
                  onClick={() => {
                    setShowDaySchedules(false);
                    onTabChange('schedule');
                  }}
                />
                <Button
                  label="닫기"
                  variant="secondary"
                  onClick={() => setShowDaySchedules(false)}
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>

      {/* 일정 상세 — 월간일정(ScheduleCalendar)과 같은 Astryx Dialog를 쓴다.
          Dialog가 backdrop·ESC·포커스 트랩·애니메이션을 자체 처리한다. */}
      <Dialog
        isOpen={!!selectedSchedule}
        onOpenChange={(open) => { if (!open) setSelectedSchedule(null); }}
        purpose="info"
        width={640}
      >
        {selectedSchedule && (
          <Layout
            header={
              <DialogHeader
                title={selectedSchedule.title}
                subtitle={selectedSchedule.category ? getCategoryLabel(selectedSchedule.category) : undefined}
                onOpenChange={(open) => { if (!open) setSelectedSchedule(null); }}
              />
            }
            content={
              <LayoutContent>
              <VStack gap={4} align="stretch">
                {/* 상태 배지 */}
                {selectedSchedule.isAllDay && (
                  <HStack gap={2} vAlign="center" wrap="wrap">
                    <Badge variant="neutral" label="종일" />
                  </HStack>
                )}

                {/* 수행 상태 — 월간일정 탭 상세 모달과 동일 */}
                {(() => {
                  const liveTasks = detailTasks || [];
                  const liveHasTasks = detailTasks ? liveTasks.length > 0 : hasTasks(selectedSchedule);
                  return (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-2)',
                        padding: 'var(--spacing-3)',
                        borderRadius: 'var(--radius-inner)',
                        border: `1px solid ${selectedSchedule.isCompleted ? 'var(--color-border-green)' : 'var(--color-border)'}`,
                        background: selectedSchedule.isCompleted ? 'var(--color-background-green)' : 'var(--color-background-muted)',
                      }}
                    >
                      <Icon icon={IconCircleCheck} size="md" color={selectedSchedule.isCompleted ? 'success' : 'tertiary'} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text type="body" weight="medium" color="primary">
                          {selectedSchedule.isCompleted ? '수행완료' : '진행 예정'}
                        </Text>
                        {selectedSchedule.isCompleted && selectedSchedule.completedByName && (
                          <Text type="supporting" color="secondary">{selectedSchedule.completedByName} 완료</Text>
                        )}
                        {!selectedSchedule.isCompleted && liveHasTasks && (
                          <Text type="supporting" color="secondary">
                            담당자가 할 일을 모두 체크하면 완료됩니다
                          </Text>
                        )}
                        {!selectedSchedule.isCompleted && !liveHasTasks && selectedSchedule.managerId != null && !canToggleCompletion(selectedSchedule) && (
                          <Text type="supporting" color="secondary">
                            담당자{selectedSchedule.managerName ? `(${selectedSchedule.managerName})` : ''}만 완료 처리할 수 있습니다
                          </Text>
                        )}
                      </div>
                      {!liveHasTasks && canToggleCompletion(selectedSchedule) && (
                        <Button
                          label={selectedSchedule.isCompleted ? '완료 해제' : '수행완료 체크'}
                          variant={selectedSchedule.isCompleted ? 'secondary' : 'primary'}
                          size="sm"
                          isLoading={togglingScheduleId === selectedSchedule.id}
                          isDisabled={togglingScheduleId === selectedSchedule.id}
                          onClick={() => handleToggleCompletion(selectedSchedule, !selectedSchedule.isCompleted)}
                        />
                      )}
                    </div>
                  );
                })()}

                {/* 할 일 (담당자별 업무) — 월간일정 탭과 동일 */}
                {(() => {
                  const tasks = detailTasks || [];
                  const done = tasks.filter((t) => t.isCompleted).length;
                  const percent = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;
                  const assigneeOptions = [
                    { value: '', label: '담당자 미지정' },
                    ...members
                      .filter((m) => m.id != null && m.name)
                      .map((m) => ({ value: String(m.id), label: m.name as string })),
                  ];

                  return (
                    <div style={{ paddingTop: 'var(--spacing-4)', borderTop: '1px solid var(--color-border)' }}>
                      <VStack gap={3}>
                        <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
                          <HStack gap={2} vAlign="center">
                            <Icon icon={IconChecklist} size="md" color="tertiary" />
                            <Text type="label" weight="medium">할 일</Text>
                          </HStack>
                          {tasks.length > 0 && (
                            <HStack gap={2} vAlign="center">
                              <Text type="supporting" color="secondary" hasTabularNumbers>
                                진행 {done}/{tasks.length}
                              </Text>
                              <div
                                role="progressbar"
                                aria-label="할 일 진행도"
                                aria-valuenow={percent}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                style={{ width: 100, height: 6, borderRadius: 'var(--radius-full)', background: 'var(--color-background-muted)', overflow: 'hidden' }}
                              >
                                <div style={{ width: '100%', height: '100%', background: 'var(--color-background-green)', transformOrigin: 'left', transform: `scaleX(${percent / 100})`, transition: 'transform var(--duration-fast) var(--ease-standard)' }} />
                              </div>
                              <Text type="supporting" weight="semibold" color="primary" hasTabularNumbers>{percent}%</Text>
                            </HStack>
                          )}
                        </HStack>

                        {detailTasks === null ? (
                          <Text type="supporting" color="secondary">할 일을 불러오는 중...</Text>
                        ) : tasks.length === 0 ? (
                          <Text type="supporting" color="secondary">
                            아직 등록된 할 일이 없습니다. 이 일정에서 해야 할 업무와 담당자를 추가해보세요.
                          </Text>
                        ) : null}

                        {tasks.map((task) => (
                          <div
                            key={task.id}
                            style={{
                              padding: 'var(--spacing-3)',
                              borderRadius: 'var(--radius-inner)',
                              border: `1px solid ${task.isCompleted ? 'var(--color-border-green)' : 'var(--color-border)'}`,
                              background: task.isCompleted ? 'var(--color-background-green)' : 'var(--color-background-card)',
                            }}
                          >
                            {editingTaskId === task.id ? (
                              <VStack gap={2}>
                                <TextInput
                                  label="할 일 내용"
                                  isLabelHidden
                                  value={editTaskForm.content}
                                  onChange={(value) => setEditTaskForm((prev) => ({ ...prev, content: value }))}
                                  placeholder="할 일 내용"
                                />
                                <Selector
                                  label="담당자"
                                  isLabelHidden
                                  width="100%"
                                  value={editTaskForm.assigneeMemberId}
                                  options={assigneeOptions}
                                  onChange={(value) => setEditTaskForm((prev) => ({ ...prev, assigneeMemberId: value ?? '' }))}
                                />
                                <HStack gap={2} hAlign="end">
                                  <Button label="취소" variant="ghost" size="sm" onClick={() => setEditingTaskId(null)} />
                                  <Button
                                    label="저장"
                                    variant="primary"
                                    size="sm"
                                    isLoading={taskBusyId === task.id}
                                    isDisabled={taskBusyId === task.id || !editTaskForm.content.trim()}
                                    onClick={handleUpdateDetailTask}
                                  />
                                </HStack>
                              </VStack>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--spacing-2)' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ textDecoration: task.isCompleted ? 'line-through' : 'none', opacity: task.isCompleted ? 0.65 : 1 }}>
                                    <Text type="body" weight="medium" color="primary">{task.content}</Text>
                                  </div>
                                  <div style={{ marginTop: 'var(--spacing-1)' }}>
                                    <HStack gap={1.5} vAlign="center" wrap="wrap">
                                      {task.assigneeName ? (
                                        <Badge variant="blue" label={task.assigneeName} icon={<Icon icon={IconUserCheck} size="xsm" />} />
                                      ) : (
                                        <Badge variant="neutral" label="담당자 미지정" />
                                      )}
                                      {task.isCompleted && task.completedAt && (
                                        <Text type="supporting" color="secondary">
                                          {task.completedByName ? `${task.completedByName} · ` : ''}
                                          {format(new Date(task.completedAt), 'MM.dd HH:mm')}
                                        </Text>
                                      )}
                                    </HStack>
                                  </div>
                                </div>
                                <HStack gap={1} vAlign="center">
                                  {canCompleteTask(task) && (
                                    <Button
                                      label={task.isCompleted ? '완료 해제' : '완료'}
                                      variant={task.isCompleted ? 'ghost' : 'primary'}
                                      size="sm"
                                      isLoading={taskBusyId === task.id}
                                      isDisabled={taskBusyId === task.id}
                                      onClick={() => handleToggleDetailTask(task, !task.isCompleted)}
                                    />
                                  )}
                                  {canEditTask(task) && (
                                    <>
                                      <Button
                                        label="할 일 수정"
                                        variant="ghost"
                                        size="sm"
                                        isIconOnly
                                        icon={<Icon icon={IconPencil} size="sm" />}
                                        onClick={() => {
                                          setEditingTaskId(task.id);
                                          setEditTaskForm({
                                            content: task.content,
                                            assigneeMemberId: task.assigneeMemberId ? String(task.assigneeMemberId) : '',
                                          });
                                        }}
                                      />
                                      <Button
                                        label="할 일 삭제"
                                        variant="ghost"
                                        size="sm"
                                        isIconOnly
                                        icon={<Icon icon={IconTrash} size="sm" />}
                                        isDisabled={taskBusyId === task.id}
                                        onClick={() => handleDeleteDetailTask(task)}
                                      />
                                    </>
                                  )}
                                </HStack>
                              </div>
                            )}
                          </div>
                        ))}

                        {/* 할 일 추가 — 기관 구성원 누구나 */}
                        <div style={{ padding: 'var(--spacing-3)', borderRadius: 'var(--radius-inner)', background: 'var(--color-background-muted)' }}>
                          <VStack gap={2}>
                            <TextInput
                              label="할 일 추가"
                              value={newTaskContent}
                              onChange={setNewTaskContent}
                              placeholder="예) 소방점검표 작성"
                            />
                            <Selector
                              label="담당자"
                              width="100%"
                              value={newTaskAssignee}
                              options={assigneeOptions}
                              onChange={(value) => setNewTaskAssignee(value ?? '')}
                            />
                            <HStack hAlign="end">
                              <Button
                                label="할 일 추가"
                                variant="secondary"
                                size="sm"
                                icon={<Icon icon={IconPlus} size="sm" />}
                                isLoading={isAddingTask}
                                isDisabled={isAddingTask || !newTaskContent.trim()}
                                onClick={handleAddDetailTask}
                              />
                            </HStack>
                          </VStack>
                        </div>
                      </VStack>
                    </div>
                  );
                })()}
                {/* 날짜 */}
                <HStack gap={3} vAlign="start">
                  <div style={{ ...iconBox('var(--color-background-teal)'), color: 'var(--color-text-teal)', marginTop: 'var(--spacing-0-5)' }}>
                    <Icon icon={IconCalendar} size="sm" color="inherit" />
                  </div>
                  <VStack gap={0} align="start">
                    <Text type="supporting" weight="medium" color="secondary">날짜</Text>
                    <Text type="body" weight="medium" color="primary">
                      {selectedSchedule.startDate ? format(new Date(selectedSchedule.startDate), 'yyyy년 M월 d일 (EEEE)', { locale: ko }) : '-'}
                      {selectedSchedule.endDate && selectedSchedule.startDate !== selectedSchedule.endDate && (
                        <> ~ {format(new Date(selectedSchedule.endDate), 'M월 d일 (EEEE)', { locale: ko })}</>
                      )}
                    </Text>
                  </VStack>
                </HStack>

                {/* 시간 */}
                {!selectedSchedule.isAllDay && (selectedSchedule.startTime || selectedSchedule.endTime) && (
                  <HStack gap={3} vAlign="start">
                    <div style={{ ...iconBox('var(--color-background-purple)'), color: 'var(--color-text-purple)', marginTop: 'var(--spacing-0-5)' }}>
                      <Icon icon={IconClock} size="sm" color="inherit" />
                    </div>
                    <VStack gap={0} align="start">
                      <Text type="supporting" weight="medium" color="secondary">시간</Text>
                      <Text type="body" weight="medium" color="primary">
                        {selectedSchedule.startTime || ''}
                        {selectedSchedule.endTime && ` ~ ${selectedSchedule.endTime}`}
                      </Text>
                    </VStack>
                  </HStack>
                )}

                {/* 장소 */}
                {selectedSchedule.location && (
                  <HStack gap={3} vAlign="start">
                    <div style={{ ...iconBox('var(--color-background-green)'), color: 'var(--color-text-green)', marginTop: 'var(--spacing-0-5)' }}>
                      <Icon icon={IconMapPin} size="sm" color="inherit" />
                    </div>
                    <VStack gap={0} align="start">
                      <Text type="supporting" weight="medium" color="secondary">장소</Text>
                      <Text type="body" weight="medium" color="primary">{selectedSchedule.location}</Text>
                    </VStack>
                  </HStack>
                )}

                {/* 설명 */}
                {(selectedSchedule.description || selectedSchedule.content) && (
                  <HStack gap={3} vAlign="start">
                    <div style={{ ...iconBox('var(--color-background-yellow)'), color: 'var(--color-text-yellow)', marginTop: 'var(--spacing-0-5)' }}>
                      <Icon icon={IconAlignLeft} size="sm" color="inherit" />
                    </div>
                    <VStack gap={0} align="start">
                      <Text type="supporting" weight="medium" color="secondary">설명</Text>
                      <Text type="body" color="primary"><span style={{ whiteSpace: 'pre-wrap' }}>{selectedSchedule.description || selectedSchedule.content}</span></Text>
                    </VStack>
                  </HStack>
                )}

                {/* 담당자 — 참석자와 구분 표시 */}
                {selectedSchedule.managerName && (
                  <HStack gap={3} vAlign="start">
                    <div style={{ ...iconBox('var(--color-background-teal)'), color: 'var(--color-text-teal)', marginTop: 'var(--spacing-0-5)' }}>
                      <Icon icon={IconUsers} size="sm" color="inherit" />
                    </div>
                    <VStack gap={1} align="start">
                      <Text type="supporting" weight="medium" color="secondary">담당자</Text>
                      <Badge variant="teal" label={selectedSchedule.managerName} />
                    </VStack>
                  </HStack>
                )}

                {/* 참석자 */}
                {selectedSchedule.participants && selectedSchedule.participants.length > 0 && (
                  <HStack gap={3} vAlign="start">
                    <div style={{ ...iconBox('var(--color-background-red)'), color: 'var(--color-text-red)', marginTop: 'var(--spacing-0-5)' }}>
                      <Icon icon={IconUsers} size="sm" color="inherit" />
                    </div>
                    <VStack gap={1} align="start">
                      <Text type="supporting" weight="medium" color="secondary">참석자</Text>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-1-5)' }}>
                        {selectedSchedule.participants.map((p, i) => (
                          <Badge key={i} variant="neutral" label={p.memberName || p.userName || '참석자'} />
                        ))}
                      </div>
                    </VStack>
                  </HStack>
                )}
              </VStack>
              </LayoutContent>
            }
            footer={
              <LayoutFooter hasDivider>
              <HStack gap={2} hAlign="end" vAlign="center">
                <Button
                  label="월간일정에서 보기"
                  variant="ghost"
                  onClick={() => { setSelectedSchedule(null); onTabChange('schedule'); }}
                />
                <Button
                  label="닫기"
                  variant="secondary"
                  onClick={() => setSelectedSchedule(null)}
                />
              </HStack>
              </LayoutFooter>
            }
          />
        )}
      </Dialog>

      {/* 접속 시 오늘 일정 알림 — 하루 1회 */}
      <Dialog
        isOpen={showTodayScheduleAlert}
        onOpenChange={(o) => { if (!o) dismissTodayScheduleAlert(); }}
        purpose="info"
        width={440}
      >
        <Layout
          header={
            <DialogHeader
              title={`오늘 일정 ${schedules.length}건`}
              onOpenChange={(o) => { if (!o) dismissTodayScheduleAlert(); }}
            />
          }
          content={
            <LayoutContent>
              <VStack gap={3}>
                <Text type="supporting" color="secondary">
                  {format(new Date(), 'M월 d일 (EEEE)', { locale: ko })} 예정된 일정입니다.
                </Text>
                <VStack gap={2}>
                  {schedules.slice(0, 6).map((schedule) => (
                    <HStack key={schedule.id} gap={2} vAlign="center">
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          flexShrink: 0,
                          background: schedule.label?.color || 'var(--color-text-accent)',
                        }}
                      />
                      <Text type="supporting" color="secondary" hasTabularNumbers>
                        {schedule.isAllDay ? '종일' : (schedule.startTime || '').slice(0, 5) || '-'}
                      </Text>
                      <Text type="body" weight="medium" maxLines={1}>{schedule.title}</Text>
                    </HStack>
                  ))}
                  {schedules.length > 6 && (
                    <Text type="supporting" color="secondary">외 {schedules.length - 6}건</Text>
                  )}
                </VStack>
              </VStack>
            </LayoutContent>
          }
          footer={
            <LayoutFooter hasDivider>
              <HStack gap={2} hAlign="end">
                <Button label="닫기" variant="ghost" onClick={dismissTodayScheduleAlert} />
                <Button
                  label="일정 보기"
                  variant="primary"
                  onClick={() => { dismissTodayScheduleAlert(); onTabChange('schedule'); }}
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>

      <ConfirmContainer />
    </div>
  );
}
