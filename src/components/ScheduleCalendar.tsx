'use client';

import { useState, useEffect, useMemo, useRef, useCallback, CSSProperties } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday } from 'date-fns';
import { ko } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@astryxdesign/core/Button';
import { Text } from '@astryxdesign/core/Text';
import { Icon } from '@astryxdesign/core/Icon';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Badge } from '@astryxdesign/core/Badge';
import { Loading } from '@/components/Loading';
import MemberItem from '@/components/MemberItem';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { TextInput } from '@astryxdesign/core/TextInput';
import { TextArea } from '@astryxdesign/core/TextArea';
import { Selector } from '@astryxdesign/core/Selector';
import { MultiSelector } from '@astryxdesign/core/MultiSelector';
import { DateInput } from '@astryxdesign/core/DateInput';
import { TimeInput } from '@astryxdesign/core/TimeInput';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import type { ISODateString } from '@astryxdesign/core/Calendar';
import type { ISOTimeString } from '@astryxdesign/core/TimeInput';
import { Card } from '@astryxdesign/core/Card';
import { IconList, IconUsers, IconPlus, IconPaperclip, IconFileText, IconMapPin, IconBell, IconPencil, IconTrash, IconTag, IconCircleCheck, IconChecklist, IconUserCheck } from '@tabler/icons-react';
import { getSchedules, createSchedule, updateSchedule, deleteSchedule, updateScheduleCompletion, getScheduleLabels, createScheduleLabel, updateScheduleLabel, deleteScheduleLabel, getAllMembers, getAllVacationRequests, createScheduleTask, updateScheduleTask, updateScheduleTaskCompletion, deleteScheduleTask } from '@/lib/apiService';
import { Schedule, ScheduleLabel, ScheduleTask, ScheduleCategory, SCHEDULE_CATEGORIES, SCHEDULE_CATEGORY_COLORS, LABEL_COLORS, getScheduleColor, withAlpha, getScheduleTextColor } from '@/types/schedule';
import { useAlert } from './Alert';
import { useConfirm } from './ConfirmDialog';
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
import { getRoleDisplayName, getMemberRoleName } from '@/lib/roleUtils';
import { useDispatchStore } from '@/lib/dispatchStore';
import type { DailyDispatch, DispatchDaySummary } from '@/types/dispatch';
import type { VacationRequest } from '@/types/vacation';
import { getDailyDispatch, getMonthlyDispatchSummary } from '@/lib/dispatchAlgorithm';
import DispatchDayDetail from './DispatchDayDetail';
import DispatchSettings from './DispatchSettings';
import DispatchListView from './DispatchListView';
import SeniorAbsenceManagement from './SeniorAbsenceManagement';
import { duration } from '@/theme/motion';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/*
 * 일요일 열 폭 배율(SUNDAY_FR)과 바 좌표 계산은 대시보드 달력과 공유한다 — @/lib/scheduleBars.
 * globals.css의 `.carev-schedcal-cols` grid-template-columns도 같은 비율이어야 한다.
 * 여러 날 일정 바가 이 비율로 계산한 % 좌표에 절대배치되기 때문에, 한쪽만 바꾸면 어긋난다.
 */

// 여러 날 일정을 주 단위로 이어서 표시하기 위한 바 레이아웃 상수
const BAR_HEIGHT = 16;
const BAR_GAP = 2;
const BAR_AREA_TOP = 38; // 셀 패딩 + 날짜 숫자 영역 높이
const MAX_VISIBLE_LANES = 3;
const BAR_EDGE_INSET = 3;
/** 칸 오른쪽 휴무자 칸에 이름을 몇 줄까지 보여줄지 (넘치면 +N) */
const VACATION_MAX_VISIBLE = 4;

/* 달력 격자선. 칸 배경과 구분이 또렷하도록 기본 테두리보다 한 단계 진한 토큰을 쓴다. */
const GRID_LINE = '1px solid var(--color-border-emphasized)';

// 한 주 안에서 일정이 차지하는 구간
interface ScheduleBar {
  schedule: Schedule;
  startCol: number;
  endCol: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
  lane: number;
}

interface WeekBarLayout {
  bars: ScheduleBar[];
  hiddenCounts: Record<string, number>;
}

/*
 * 이전·다음 달 자리의 빈 칸.
 *
 * 예전에는 실제 칸처럼 aspect-ratio: 1/1을 줬는데, 칸 폭이 열마다 다르면(특히 좁은 일요일)
 * 높이가 저마다 달라져 아래 구분선이 행 중간에 어긋나 그려졌다. 높이를 행에 맡긴다.
 */
const EMPTY_CELL_STYLE: CSSProperties = {
  height: '100%',
  borderBottom: GRID_LINE,
  borderRight: GRID_LINE,
};

const CARD_STYLE: CSSProperties = {
  background: 'var(--color-background-card)',
  borderRadius: 'var(--radius-element)',
  boxShadow: 'var(--shadow-low)',
  border: '1px solid var(--color-border)',
  overflow: 'hidden',
};

// 라벨 색상 스와치 스타일
const colorSwatchStyle = (selected: boolean, value: string): CSSProperties => ({
  width: 28,
  height: 28,
  borderRadius: 'var(--radius-full)',
  padding: 'var(--spacing-0)',
  cursor: 'pointer',
  border: selected ? '2px solid var(--color-border-emphasized)' : '2px solid transparent',
  boxShadow: selected ? '0 0 0 2px var(--color-border)' : undefined,
  transform: selected ? 'scale(1.1)' : undefined,
  backgroundColor: value,
  // 실제로 바뀌는 속성만 명시 — border/boxShadow/transform은 선택 여부에 따라 토글된다
  transition: 'border-color var(--duration-fast-min) var(--ease-standard), box-shadow var(--duration-fast-min) var(--ease-standard), transform var(--duration-fast-min) var(--ease-standard)',
});

interface ScheduleCalendarProps {
  isAdmin?: boolean;
  mode?: 'schedule' | 'dispatch';
  /** 연간일정에서 특정 달을 눌러 들어온 경우 그 달을 펼친 채로 연다. */
  initialMonth?: Date | null;
  onNotification?: (message: string, type: 'success' | 'error' | 'info') => void;
}

interface ScheduleFormData {
  title: string;
  category: ScheduleCategory;
  labelId: string;
  location: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  isAllDay: boolean;
  sendNotification: boolean;
  participantIds: string[];
  /** 담당자 member id ('' = 미지정) */
  managerId: string;
}

export default function ScheduleCalendar({ isAdmin = false, mode = 'schedule', initialMonth = null, onNotification }: ScheduleCalendarProps) {
  const { showAlert, AlertContainer } = useAlert();
  const { confirm, ConfirmContainer } = useConfirm();
  const [currentDate, setCurrentDate] = useState(() => initialMonth ?? new Date());
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [labels, setLabels] = useState<ScheduleLabel[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  // 참석자 고르기 보조 — 직종으로 좁혀 보고, 직종 단위로 한 번에 고른다.
  // 직원이 수십 명인 기관에서 한 명씩 찾아 누르는 게 실제로 가장 번거로운 부분이었다.
  const [participantRoleFilter, setParticipantRoleFilter] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');

  // 배차 모드 관련 상태
  const { settings: dispatchSettings, seniorAbsences, isHydrated } = useDispatchStore();
  const [dispatchMonthlySummary, setDispatchMonthlySummary] = useState<Map<string, DispatchDaySummary>>(new Map());
  const [dispatchVacations, setDispatchVacations] = useState<VacationRequest[]>([]);
  const [showDispatchDayDetail, setShowDispatchDayDetail] = useState(false);
  const [showDispatchSettings, setShowDispatchSettings] = useState(false);
  const [dispatchSelectedDate, setDispatchSelectedDate] = useState<Date | null>(null);
  const [dispatchSubTab, setDispatchSubTab] = useState<'calendar' | 'list' | 'absence'>('calendar');

  const isDispatchMode = mode === 'dispatch';

  const [formData, setFormData] = useState<ScheduleFormData>({
    title: '',
    category: 'MEETING',
    labelId: '',
    location: '',
    startDate: '',
    startTime: '09:00',
    endDate: '',
    endTime: '10:00',
    isAllDay: false,
    sendNotification: false,
    participantIds: [],
    managerId: '',
  });

  const [labelForm, setLabelForm] = useState({
    name: '',
    color: LABEL_COLORS[0].value,
  });
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editLabelForm, setEditLabelForm] = useState({ name: '', color: '' });
  const [deletingLabelId, setDeletingLabelId] = useState<string | null>(null);

  const [togglingScheduleId, setTogglingScheduleId] = useState<string | null>(null);
  const [currentMemberId, setCurrentMemberId] = useState<number | null>(null);
  const [showMyTasksOnly, setShowMyTasksOnly] = useState(false);
  // 달력 칸을 일정/휴무자로 어떻게 나눠 볼지 (대시보드 달력과 선택을 공유한다)
  const [pane, setPane] = useState<CalendarPane>('both');
  const [monthVacations, setMonthVacations] = useState<Map<string, VacationPerson[]>>(new Map());
  // 할 일 관련
  const [newTaskContent, setNewTaskContent] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [taskBusyId, setTaskBusyId] = useState<string | null>(null);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskForm, setEditTaskForm] = useState({ content: '', assigneeMemberId: '' });

  // 달력 날짜 계산
  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const days = eachDayOfInterval({ start, end });

    const startDay = start.getDay();
    const paddedDays: (Date | null)[] = Array(startDay).fill(null);

    return [...paddedDays, ...days];
  }, [currentDate]);

  // 주 단위로 7칸씩 분할 (마지막 주는 뒤쪽을 null로 채움)
  const calendarWeeks = useMemo(() => {
    const weeks: (Date | null)[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      const week = calendarDays.slice(i, i + 7);
      while (week.length < 7) week.push(null);
      weeks.push(week);
    }
    return weeks;
  }, [calendarDays]);

  // 일정 데이터 로드
  useEffect(() => {
    if (!isDispatchMode) {
      loadSchedules();
      loadLabels();
      loadMembers();
    }
    if (typeof window !== 'undefined') {
      setCurrentUserEmail(localStorage.getItem('userEmail') || '');
      // 직원 로그인 시 userId에 member id가 저장된다 (담당자 매칭용)
      const storedMemberId = Number(localStorage.getItem('userId'));
      setCurrentMemberId(Number.isFinite(storedMemberId) && storedMemberId > 0 ? storedMemberId : null);
    }
  }, [currentDate, isDispatchMode]);

  // 저장해 둔 보기 선택을 복원한다 (일정만/휴무만/둘 다)
  useEffect(() => {
    setPane(loadCalendarPane());
  }, []);

  const changePane = useCallback((next: CalendarPane) => {
    setPane(next);
    saveCalendarPane(next);
  }, []);

  // 달력 칸에 얹을 그달 휴무자 명단
  useEffect(() => {
    if (isDispatchMode) return;
    let cancelled = false;
    fetchMonthVacations(currentDate)
      .then((map) => {
        if (!cancelled) setMonthVacations(map);
      })
      .catch((error) => {
        console.error('휴무자 명단 로드 실패:', error);
        if (!cancelled) setMonthVacations(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [currentDate, isDispatchMode]);

  // 배차 모드: 휴무 데이터 로드
  const fetchDispatchVacations = useCallback(async () => {
    try {
      const response = await getAllVacationRequests();
      if (response.requests && Array.isArray(response.requests)) {
        setDispatchVacations(response.requests);
      } else if (response.data) {
        setDispatchVacations(response.data);
      } else if (Array.isArray(response)) {
        setDispatchVacations(response);
      }
    } catch (error) {
      console.error('휴무 데이터 로드 실패:', error);
    }
  }, []);

  useEffect(() => {
    if (isDispatchMode) {
      fetchDispatchVacations();
      setIsLoading(false);
    }
  }, [isDispatchMode, fetchDispatchVacations]);

  // 배차 모드: 월간 요약 계산
  useEffect(() => {
    if (isDispatchMode && isHydrated && dispatchSettings.routes.length > 0) {
      const summary = getMonthlyDispatchSummary(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        dispatchSettings,
        dispatchVacations,
        seniorAbsences
      );
      setDispatchMonthlySummary(summary);
    }
  }, [isDispatchMode, currentDate, dispatchSettings, dispatchVacations, seniorAbsences, isHydrated]);

  // 배차 모드: 선택된 날짜의 일일 배차 정보
  const getSelectedDayDispatch = (): DailyDispatch | null => {
    if (!dispatchSelectedDate) return null;
    return getDailyDispatch(dispatchSelectedDate, dispatchSettings, dispatchVacations, seniorAbsences);
  };

  // 배차 날짜별 상태 배경 색상
  const getDispatchStatusColors = (summary: DispatchDaySummary | undefined) => {
    if (!summary || summary.totalRoutes === 0) return { bg: '', border: '' };
    if (summary.isHoliday) return { bg: 'var(--color-background-muted)', border: '' };
    if (summary.noServiceCount > 0) return { bg: 'var(--color-background-red)', border: '' };
    if (summary.substituteCount > 0) return { bg: 'var(--color-background-yellow)', border: '' };
    return { bg: 'var(--color-background-green)', border: '' };
  };

  const loadSchedules = async () => {
    setIsLoading(true);
    try {
      const startDate = format(startOfMonth(currentDate), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(currentDate), 'yyyy-MM-dd');
      const data = await getSchedules(startDate, endDate);
      setSchedules(Array.isArray(data) ? data : data.schedules || []);
    } catch (error) {
      console.error('일정 데이터 로드 실패:', error);
      showAlert({ type: 'error', title: '로드 실패', message: '일정 데이터를 불러오지 못했습니다.' });
    } finally {
      setIsLoading(false);
    }
  };

  const loadLabels = async () => {
    try {
      const data = await getScheduleLabels();
      setLabels(Array.isArray(data) ? data : data.labels || []);
    } catch (error) {
      console.error('라벨 데이터 로드 실패:', error);
    }
  };

  const loadMembers = async () => {
    try {
      const data = await getAllMembers();
      setMembers(Array.isArray(data) ? data : data.members || []);
    } catch (error) {
      console.error('멤버 데이터 로드 실패:', error);
    }
  };

  // 내가 관련된 일정인지 (담당자 / 참석자 / 작성자)
  const isMySchedule = (schedule: Schedule) => {
    if (schedule.authorId && schedule.authorId === currentUserEmail) return true;
    if (currentMemberId == null) return false;
    if (schedule.tasks?.some((t) => Number(t.assigneeMemberId) === currentMemberId)) return true;
    return !!schedule.participants?.some(
      (p) => Number((p as { memberId?: number }).memberId ?? p.userId) === currentMemberId
    );
  };

  // '내 업무만' 필터가 켜져 있으면 나와 관련된 일정만 남긴다
  const visibleSchedules = useMemo(
    () => (showMyTasksOnly ? schedules.filter(isMySchedule) : schedules),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [schedules, showMyTasksOnly, currentMemberId, currentUserEmail]
  );

  // 날짜에 해당하는 일정 가져오기
  const getSchedulesForDate = (date: Date): Schedule[] => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return visibleSchedules.filter(schedule => {
      const scheduleStart = schedule.startDate.split('T')[0];
      const scheduleEnd = schedule.endDate.split('T')[0];
      return dateKey >= scheduleStart && dateKey <= scheduleEnd;
    });
  };

  // 주별 일정 바 레이아웃 계산 (여러 날 일정을 하나의 바로 이어서 표시)
  const weekBarLayouts = useMemo<WeekBarLayout[]>(() => {
    const rangeOf = (schedule: Schedule) => ({
      start: schedule.startDate.split('T')[0],
      end: schedule.endDate.split('T')[0],
    });

    // 시작일 빠른 순 → 기간 긴 순 → id 순으로 정렬해 주가 바뀌어도 같은 줄을 유지
    const sorted = [...visibleSchedules].sort((a, b) => {
      const ra = rangeOf(a);
      const rb = rangeOf(b);
      if (ra.start !== rb.start) return ra.start < rb.start ? -1 : 1;
      if (ra.end !== rb.end) return ra.end > rb.end ? -1 : 1;
      return String(a.id).localeCompare(String(b.id));
    });

    return calendarWeeks.map((week) => {
      const keys = week.map((date) => (date ? format(date, 'yyyy-MM-dd') : null));
      const bars: ScheduleBar[] = [];
      const hiddenCounts: Record<string, number> = {};
      const laneEnds: number[] = [];

      sorted.forEach((schedule) => {
        const { start, end } = rangeOf(schedule);
        if (end < start) return;

        let startCol = -1;
        let endCol = -1;
        keys.forEach((key, index) => {
          if (!key || key < start || key > end) return;
          if (startCol === -1) startCol = index;
          endCol = index;
        });
        if (startCol === -1) return;

        // 이미 놓인 바와 겹치지 않는 첫 번째 줄에 배치
        let lane = laneEnds.findIndex((laneEnd) => laneEnd < startCol);
        if (lane === -1) lane = laneEnds.length;
        laneEnds[lane] = endCol;

        if (lane < MAX_VISIBLE_LANES) {
          bars.push({
            schedule,
            startCol,
            endCol,
            continuesBefore: start < keys[startCol]!,
            continuesAfter: end > keys[endCol]!,
            lane,
          });
        } else {
          for (let i = startCol; i <= endCol; i++) {
            const key = keys[i];
            if (key) hiddenCounts[key] = (hiddenCounts[key] || 0) + 1;
          }
        }
      });

      return { bars, hiddenCounts };
    });
  }, [visibleSchedules, calendarWeeks]);

  // 이번 달 일정 진행도
  const monthProgress = useMemo(() => {
    const total = schedules.length;
    const done = schedules.filter((s) => s.isCompleted).length;
    return { total, done, percent: total > 0 ? Math.round((done / total) * 100) : 0 };
  }, [schedules]);

  // 수정/삭제 권한 (관리자 또는 작성자 본인)
  const canManageSchedule = (schedule: Schedule) =>
    isAdmin || schedule.authorId === currentUserEmail;

  // 수행완료 권한: 담당자가 지정된 일정은 담당자 본인 또는 관리자(대행), 미지정 일정은 관리자/작성자
  const canToggleCompletion = (schedule: Schedule) =>
    schedule.managerId != null
      ? isAdmin || Number(schedule.managerId) === currentMemberId
      : canManageSchedule(schedule);

  // 할 일이 등록된 일정은 일정 자체를 직접 완료 처리하지 않는다.
  // 담당자들이 할 일을 모두 체크하면 완료된다 (서버 로직과 동일).
  // 목록에서는 taskTotal, 상세에서는 불러온 tasks 배열로 판단한다.
  const hasTasks = (schedule: Schedule) =>
    (schedule.tasks?.length ?? schedule.taskTotal ?? 0) > 0;

  // 수행완료 토글 (낙관적 업데이트 후 실패 시 롤백)
  const handleToggleCompletion = async (schedule: Schedule, completed: boolean) => {
    setTogglingScheduleId(schedule.id);
    const applyState = (value: boolean) => {
      setSchedules((prev) => prev.map((s) => (s.id === schedule.id ? { ...s, isCompleted: value } : s)));
      setSelectedSchedule((prev) => (prev && prev.id === schedule.id ? { ...prev, isCompleted: value } : prev));
    };

    applyState(completed);
    try {
      await updateScheduleCompletion(schedule.id, completed);
      showAlert({
        type: 'success',
        title: completed ? '수행완료' : '완료 해제',
        message: completed ? '일정을 수행완료로 표시했습니다.' : '수행완료를 해제했습니다.',
      });
    } catch (error) {
      console.error('일정 수행완료 변경 실패:', error);
      applyState(!completed);
      showAlert({ type: 'error', title: '변경 실패', message: '수행완료 상태를 변경하지 못했습니다.' });
    } finally {
      setTogglingScheduleId(null);
    }
  };

  // ==================== 할 일(담당자 업무) ====================

  const applyTasksToState = (scheduleId: string, tasks: ScheduleTask[]) => {
    const completedCount = tasks.filter((t) => t.isCompleted).length;
    // 할 일이 하나라도 있으면 전부 완료됐을 때만 일정이 완료 상태다 (서버 로직과 동일)
    const patch = (s: Schedule): Schedule => ({
      ...s,
      tasks,
      taskTotal: tasks.length,
      taskCompleted: completedCount,
      isCompleted: tasks.length > 0 ? completedCount === tasks.length : s.isCompleted,
    });
    setSchedules((prev) => prev.map((s) => (s.id === scheduleId ? patch(s) : s)));
    setSelectedSchedule((prev) => (prev && prev.id === scheduleId ? patch(prev) : prev));
  };

  const currentTasks = (): ScheduleTask[] => selectedSchedule?.tasks || [];

  // 담당자가 지정된 할 일은 담당자 본인 또는 관리자(대행)가 체크할 수 있다. 미지정 항목은 누구나 가능.
  const canCompleteTask = (task: ScheduleTask) =>
    isAdmin || task.assigneeMemberId == null || Number(task.assigneeMemberId) === currentMemberId;

  // 내용 수정/삭제는 관리자, 일정 작성자, 항목 등록자, 담당자 본인
  const canEditTask = (task: ScheduleTask) =>
    isAdmin ||
    task.createdById === currentUserEmail ||
    selectedSchedule?.authorId === currentUserEmail ||
    (task.assigneeMemberId != null && Number(task.assigneeMemberId) === currentMemberId);

  const handleAddTask = async () => {
    if (!selectedSchedule || !newTaskContent.trim()) return;
    setIsAddingTask(true);
    try {
      const res = await createScheduleTask(selectedSchedule.id, {
        content: newTaskContent.trim(),
        assigneeMemberId: newTaskAssignee ? Number(newTaskAssignee) : null,
      });
      const created: ScheduleTask | undefined = res?.task;
      if (created) {
        applyTasksToState(selectedSchedule.id, [...currentTasks(), created]);
      }
      setNewTaskContent('');
      setNewTaskAssignee('');
    } catch (error) {
      console.error('할 일 추가 실패:', error);
      showAlert({ type: 'error', title: '추가 실패', message: '할 일을 추가하지 못했습니다.' });
    } finally {
      setIsAddingTask(false);
    }
  };

  const handleToggleTask = async (task: ScheduleTask, completed: boolean) => {
    if (!selectedSchedule) return;
    setTaskBusyId(task.id);

    const optimistic = currentTasks().map((t) =>
      t.id === task.id ? { ...t, isCompleted: completed } : t
    );
    applyTasksToState(selectedSchedule.id, optimistic);

    try {
      const res = await updateScheduleTaskCompletion(selectedSchedule.id, task.id, completed);
      const updated: ScheduleTask | undefined = res?.task;
      if (updated) {
        applyTasksToState(
          selectedSchedule.id,
          currentTasks().map((t) => (t.id === task.id ? updated : t))
        );
      }
    } catch (error) {
      console.error('할 일 완료 변경 실패:', error);
      applyTasksToState(
        selectedSchedule.id,
        currentTasks().map((t) => (t.id === task.id ? { ...t, isCompleted: !completed } : t))
      );
      showAlert({ type: 'error', title: '변경 실패', message: '수행완료 상태를 변경하지 못했습니다.' });
    } finally {
      setTaskBusyId(null);
    }
  };

  const handleUpdateTask = async () => {
    if (!selectedSchedule || !editingTaskId || !editTaskForm.content.trim()) return;
    setTaskBusyId(editingTaskId);
    try {
      const res = await updateScheduleTask(selectedSchedule.id, editingTaskId, {
        content: editTaskForm.content.trim(),
        assigneeMemberId: editTaskForm.assigneeMemberId ? Number(editTaskForm.assigneeMemberId) : null,
      });
      const updated: ScheduleTask | undefined = res?.task;
      if (updated) {
        applyTasksToState(
          selectedSchedule.id,
          currentTasks().map((t) => (t.id === editingTaskId ? updated : t))
        );
      }
      setEditingTaskId(null);
    } catch (error) {
      console.error('할 일 수정 실패:', error);
      showAlert({ type: 'error', title: '수정 실패', message: '할 일을 수정하지 못했습니다.' });
    } finally {
      setTaskBusyId(null);
    }
  };

  const handleDeleteTask = async (task: ScheduleTask) => {
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
      applyTasksToState(selectedSchedule.id, currentTasks().filter((t) => t.id !== task.id));
    } catch (error) {
      console.error('할 일 삭제 실패:', error);
      showAlert({ type: 'error', title: '삭제 실패', message: '할 일을 삭제하지 못했습니다.' });
    } finally {
      setTaskBusyId(null);
    }
  };

  // 이전/다음 달 이동
  const goToPrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const goToNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  // 날짜 클릭 핸들러 - 상세 정보만 표시 (모달 열지 않음)
  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
  };

  // 일정 클릭 핸들러
  const handleScheduleClick = (e: React.MouseEvent | null, schedule: Schedule) => {
    e?.stopPropagation();
    setSelectedSchedule(schedule);
    setShowDetailModal(true);
  };

  // 일정 생성 모달 열기
  const openCreateModal = (date?: Date) => {
    const targetDate = date || selectedDate || new Date();
    setFormData({
      title: '',
      category: 'MEETING',
      labelId: '',
      location: '',
      startDate: format(targetDate, 'yyyy-MM-dd'),
      startTime: '09:00',
      endDate: format(targetDate, 'yyyy-MM-dd'),
      endTime: '10:00',
      isAllDay: false,
      sendNotification: false,
      participantIds: [],
      managerId: '',
    });
    setShowCreateModal(true);
  };

  // 일정 생성 제출
  const handleSubmitCreate = async () => {
    if (!formData.title.trim()) {
      showAlert({ type: 'error', title: '입력 오류', message: '제목을 입력해주세요.' });
      return;
    }

    setIsSubmitting(true);
    try {
      await createSchedule({
        title: formData.title,
        category: formData.category,
        labelId: formData.labelId || undefined,
        location: formData.location || undefined,
        startDate: formData.startDate,
        startTime: formData.isAllDay ? undefined : formData.startTime,
        endDate: formData.endDate,
        endTime: formData.isAllDay ? undefined : formData.endTime,
        isAllDay: formData.isAllDay,
        sendNotification: formData.sendNotification,
        participantIds: formData.participantIds.length > 0 ? formData.participantIds : undefined,
        managerId: formData.managerId ? Number(formData.managerId) : null,
      });

      showAlert({ type: 'success', title: '생성 완료', message: '일정이 등록되었습니다.' });
      setShowCreateModal(false);
      loadSchedules();
    } catch (error) {
      console.error('일정 생성 실패:', error);
      showAlert({ type: 'error', title: '생성 실패', message: '일정 생성에 실패했습니다.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 일정 수정
  const handleEditSchedule = (schedule?: Schedule) => {
    const target = schedule || selectedSchedule;
    if (!target) return;

    setSelectedSchedule(target);
    setFormData({
      title: target.title,
      category: target.category,
      labelId: target.labelId || '',
      location: target.location || '',
      startDate: target.startDate.split('T')[0],
      startTime: target.startTime || '09:00',
      endDate: target.endDate.split('T')[0],
      endTime: target.endTime || '10:00',
      isAllDay: target.isAllDay,
      sendNotification: target.sendNotification,
      participantIds: target.participants?.map(p => p.userId) || [],
      managerId: target.managerId ? String(target.managerId) : '',
    });
    setShowDetailModal(false);
    setShowCreateModal(true);
  };

  // 일정 수정 제출
  const handleSubmitUpdate = async () => {
    if (!selectedSchedule) return;
    if (!formData.title.trim()) {
      showAlert({ type: 'error', title: '입력 오류', message: '제목을 입력해주세요.' });
      return;
    }

    setIsSubmitting(true);
    try {
      await updateSchedule(selectedSchedule.id, {
        title: formData.title,
        category: formData.category,
        labelId: formData.labelId || undefined,
        location: formData.location || undefined,
        startDate: formData.startDate,
        startTime: formData.isAllDay ? undefined : formData.startTime,
        endDate: formData.endDate,
        endTime: formData.isAllDay ? undefined : formData.endTime,
        isAllDay: formData.isAllDay,
        sendNotification: formData.sendNotification,
        participantIds: formData.participantIds.length > 0 ? formData.participantIds : undefined,
        managerId: formData.managerId ? Number(formData.managerId) : null,
      });

      showAlert({ type: 'success', title: '수정 완료', message: '일정이 수정되었습니다.' });
      setShowCreateModal(false);
      setSelectedSchedule(null);
      loadSchedules();
    } catch (error) {
      console.error('일정 수정 실패:', error);
      showAlert({ type: 'error', title: '수정 실패', message: '일정 수정에 실패했습니다.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 일정 삭제
  const handleDeleteSchedule = async () => {
    if (!selectedSchedule) return;

    setIsSubmitting(true);
    try {
      await deleteSchedule(selectedSchedule.id);
      showAlert({ type: 'success', title: '삭제 완료', message: '일정이 삭제되었습니다.' });
      setShowDeleteConfirm(false);
      setShowDetailModal(false);
      setSelectedSchedule(null);
      loadSchedules();
    } catch (error) {
      console.error('일정 삭제 실패:', error);
      showAlert({ type: 'error', title: '삭제 실패', message: '일정 삭제에 실패했습니다.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 라벨 생성
  const handleCreateLabel = async () => {
    if (!labelForm.name.trim()) {
      showAlert({ type: 'error', title: '입력 오류', message: '라벨 이름을 입력해주세요.' });
      return;
    }

    setIsSubmitting(true);
    try {
      await createScheduleLabel({
        name: labelForm.name,
        color: labelForm.color,
      });

      showAlert({ type: 'success', title: '생성 완료', message: '라벨이 생성되었습니다.' });
      setLabelForm({ name: '', color: LABEL_COLORS[0].value });
      loadLabels();
    } catch (error) {
      console.error('라벨 생성 실패:', error);
      showAlert({ type: 'error', title: '생성 실패', message: '라벨 생성에 실패했습니다.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateLabel = async () => {
    if (!editingLabelId || !editLabelForm.name.trim()) return;
    setIsSubmitting(true);
    try {
      await updateScheduleLabel(editingLabelId, {
        name: editLabelForm.name,
        color: editLabelForm.color,
      });
      showAlert({ type: 'success', title: '수정 완료', message: '라벨이 수정되었습니다.' });
      setEditingLabelId(null);
      loadLabels();
    } catch (error) {
      console.error('라벨 수정 실패:', error);
      showAlert({ type: 'error', title: '수정 실패', message: '라벨 수정에 실패했습니다.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLabel = async (id: string) => {
    setIsSubmitting(true);
    try {
      // 서버가 이 라벨을 쓰던 일정에서 참조만 떼고 라벨을 지운다 (일정은 남는다)
      const result = await deleteScheduleLabel(id);
      const detached = Number(result?.detachedCount) || 0;
      showAlert({
        type: 'success',
        title: '삭제 완료',
        message: detached > 0
          ? `라벨을 삭제했습니다. 이 라벨을 쓰던 일정 ${detached}건은 라벨 없음으로 바뀌었습니다.`
          : '라벨이 삭제되었습니다.',
      });
      setDeletingLabelId(null);
      if (formData.labelId === id) {
        setFormData(prev => ({ ...prev, labelId: '' }));
      }
      loadLabels();
      // 달력에 남아 있는 라벨 색을 지우기 위해 일정도 다시 읽는다
      loadSchedules();
    } catch (error) {
      console.error('라벨 삭제 실패:', error);
      showAlert({ type: 'error', title: '삭제 실패', message: '라벨 삭제에 실패했습니다.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 카테고리 한글 변환
  const getCategoryText = (category: ScheduleCategory) => {
    const found = SCHEDULE_CATEGORIES.find(c => c.value === category);
    return found?.label || category;
  };

  // 'yyyy-MM-dd' → 'M/d' (타임존 영향 없이 문자열로 변환)
  const formatMonthDay = (dateString: string) => {
    const [, month, day] = dateString.split('T')[0].split('-');
    return `${Number(month)}/${Number(day)}`;
  };

  // 멤버 역할 텍스트
  /**
   * 이름 → 직무 표. 달력 칸의 휴무자 옆에 직무를 붙이는 데 쓴다.
   * 휴무 API가 직무를 주지 않고, 운영 데이터에서 휴무의 user_id는 회원 id와
   * 맞지 않아 이름이 유일한 연결고리다.
   */
  const vacationRoleByName = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((m) => {
      const name = String(m?.name ?? '').trim();
      const role = getMemberRoleName(m);
      if (name && role) map.set(name, getRoleDisplayName(role));
    });
    return map;
  }, [members]);

  /** 직원 목록에 실제로 등장하는 직종 (역할관리에서 배정한 값 기준) */
  const memberRoleOptions = useMemo(() => {
    const seen = new Set<string>();
    members.forEach((m) => {
      const role = getMemberRoleName(m);
      if (role) seen.add(role);
    });
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [members]);

  /** 직종 필터를 적용한 참석자 후보. 필터가 비어 있으면 전체 */
  const participantCandidates = useMemo(() => (
    participantRoleFilter.length === 0
      ? members
      : members.filter((m) => participantRoleFilter.includes(getMemberRoleName(m)))
  ), [members, participantRoleFilter]);

  /** 직종 하나를 눌러 그 직종 전원을 한꺼번에 넣거나 뺀다 */
  const toggleRoleParticipants = (role: string) => {
    const ids = members.filter((m) => getMemberRoleName(m) === role).map((m) => String(m.id));
    if (ids.length === 0) return;
    const allSelected = ids.every((id) => formData.participantIds.includes(id));
    setFormData((prev) => ({
      ...prev,
      participantIds: allSelected
        ? prev.participantIds.filter((id) => !ids.includes(id))
        : Array.from(new Set([...prev.participantIds, ...ids])),
    }));
  };

  /**
   * 직원에게 보여줄 직종명.
   *
   * member.role에는 'caregiver' 같은 레거시 키가 남아 있어서 그것만 보면 역할관리에서
   * 바꾼 직종이 반영되지 않는다. position(역할관리에서 배정한 직종)을 먼저 본다.
   */
  const getMemberRoleText = (member?: { role?: string | null; position?: string | null }) => {
    const resolved = getMemberRoleName(member);
    return resolved ? getRoleDisplayName(resolved) : undefined;
  };

  // 날짜 숫자 스타일 (오늘 강조 / 주말 색상)
  const getDayNumStyle = (date: Date): CSSProperties => {
    const dayOfWeek = date.getDay();
    if (isToday(date)) {
      return {
        background: 'var(--color-background-teal)',
        color: 'var(--color-text-teal)',
        width: 28,
        height: 28,
        borderRadius: 'var(--radius-full)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // 날짜는 칸 왼쪽 위에 붙인다 — 가운데 두면 오른쪽 휴무자 칸과 시선이 엉킨다
        marginRight: 'auto',
      };
    }
    if (dayOfWeek === 0) return { color: 'var(--color-text-red)' };
    if (dayOfWeek === 6) return { color: 'var(--color-text-blue)' };
    return { color: 'var(--color-text-primary)' };
  };

  // 배차 모드 날짜 셀
  const renderDispatchDayCell = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const summary = dispatchMonthlySummary.get(dateStr);
    const statusColors = getDispatchStatusColors(summary);
    const isCurrentMonth = isSameMonth(date, currentDate);
    const dayNumStyle = getDayNumStyle(date);

    return (
      <button
        key={dateStr}
        onClick={() => {
          if (isCurrentMonth) {
            setDispatchSelectedDate(date);
            setShowDispatchDayDetail(true);
          }
        }}
        className={isCurrentMonth ? 'carev-schedcal-cell' : 'carev-schedcal-cell'}
        disabled={!isCurrentMonth}
        style={{
          // 일정 칸과 같은 이유로 aspect-ratio를 쓰지 않는다 (구분선 어긋남 방지)
          height: '100%',
          padding: 'var(--spacing-2)',
          border: 'none',
          borderBottom: GRID_LINE,
          borderRight: GRID_LINE,
          position: 'relative',
          textAlign: 'left',
          transition: 'background var(--duration-fast)',
          opacity: !isCurrentMonth ? 0.3 : 1,
          cursor: isCurrentMonth ? 'pointer' : 'default',
          background: isCurrentMonth && statusColors.bg ? statusColors.bg : undefined,
          boxShadow: isToday(date) ? 'inset 0 0 0 2px var(--color-border-teal)' : undefined,
        }}
      >
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <span style={dayNumStyle}>
            <Text type="label" weight={isToday(date) ? 'bold' : 'semibold'} color="inherit">{format(date, 'd')}</Text>
          </span>
          {isCurrentMonth && summary?.isHoliday && (
            <div style={{ marginTop: 'var(--spacing-1)', color: 'var(--color-text-secondary)' }}>
              <Text type="supporting" color="inherit" weight="medium">{summary.holidayName}</Text>
            </div>
          )}
          {isCurrentMonth && summary && !summary.isHoliday && summary.totalRoutes > 0 && (
            <div style={{ marginTop: 'var(--spacing-1)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-0-5)' }}>
              {summary.normalCount > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', color: 'var(--color-text-green)' }}>
                  <span style={{ width: 6, height: 6, borderRadius: 'var(--radius-full)', background: 'var(--color-background-green)', marginRight: 'var(--spacing-1)', flexShrink: 0 }} />
                  <Text type="supporting" color="inherit">{summary.normalCount} 정상</Text>
                </div>
              )}
              {summary.substituteCount > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', color: 'var(--color-text-yellow)' }}>
                  <span style={{ width: 6, height: 6, borderRadius: 'var(--radius-full)', background: 'var(--color-background-yellow)', marginRight: 'var(--spacing-1)', flexShrink: 0 }} />
                  <Text type="supporting" color="inherit">{summary.substituteCount} 대체</Text>
                </div>
              )}
              {summary.noServiceCount > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', color: 'var(--color-text-red)' }}>
                  <span style={{ width: 6, height: 6, borderRadius: 'var(--radius-full)', background: 'var(--color-background-red)', marginRight: 'var(--spacing-1)', flexShrink: 0 }} />
                  <Text type="supporting" color="inherit">{summary.noServiceCount} 미운행</Text>
                </div>
              )}
            </div>
          )}
          {isCurrentMonth && !summary?.isHoliday && (!summary || summary.totalRoutes === 0) && (
            <div style={{ marginTop: 'var(--spacing-1)', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
              <Text type="supporting" color="inherit">미설정</Text>
            </div>
          )}
        </div>
      </button>
    );
  };

  // 일정 모드 날짜 셀 (일정 바는 주 단위 오버레이에서 렌더링)
  const renderScheduleDayCell = (date: Date, hiddenCount: number) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const isSelected = selectedDate && isSameDay(date, selectedDate);
    const dayNumStyle = getDayNumStyle(date);
    const dayVacations = monthVacations.get(dateStr) || [];
    // 그날 일정이 하나도 없으면 휴무자가 칸을 통째로 쓴다 (왼쪽 60%가 빈 채로 남지 않게)
    const hasSchedulesToday = getSchedulesForDate(date).length > 0;
    const vacFraction = pane === 'both' && !hasSchedulesToday ? 1 : vacationPaneFraction(pane);

    return (
      <button
        key={dateStr}
        onClick={() => handleDateClick(date)}
        className="carev-schedcal-cell"
        style={{
          // aspect-ratio를 쓰면 열 폭에 따라 칸 높이가 달라져 구분선이 어긋난다.
          // 높이는 CSS의 min-height가 정하고, 남는 높이는 행을 그대로 채운다.
          height: '100%',
          padding: 'var(--spacing-2)',
          border: 'none',
          borderBottom: GRID_LINE,
          borderRight: GRID_LINE,
          position: 'relative',
          cursor: 'pointer',
          textAlign: 'left',
          // 'all'은 .carev-schedcal-cell의 스코프된 전이(background, box-shadow)를 인라인이 항상 이겨서 덮어썼다.
          // 실제로 바뀌는 두 속성만 같은 지속시간으로 맞춘다.
          transition: 'background var(--duration-fast-min) var(--ease-standard), box-shadow var(--duration-fast-min) var(--ease-standard)',
          opacity: !isSameMonth(date, currentDate) ? 0.3 : 1,
          background: isSelected || isToday(date) ? 'var(--color-background-teal)' : undefined,
          boxShadow: isSelected ? 'inset 0 0 0 2px var(--color-border-teal)' : undefined,
        }}
      >
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <span style={dayNumStyle}>
            <Text type="label" weight={isToday(date) ? 'bold' : 'medium'} color="inherit">{format(date, 'd')}</Text>
          </span>
        </div>
        {/* 오른쪽(또는 칸 전체) 휴무자 명단 */}
        {showsVacations(pane) && (
          <CalendarVacationPane
            people={dayVacations}
            fraction={vacFraction}
            maxVisible={VACATION_MAX_VISIBLE}
            topOffset={BAR_AREA_TOP}
            hasDivider={pane === 'both' && hasSchedulesToday}
            roleByName={vacationRoleByName}
          />
        )}
        {showsSchedules(pane) && hiddenCount > 0 && (
          <div
            style={{
              position: 'absolute',
              bottom: 'var(--spacing-1)',
              left: 'var(--spacing-2)',
              // 휴무자 칸을 침범하지 않도록 일정 영역 안에서만 표시한다
              width: `calc(${schedulePaneFraction(pane) * 100}% - var(--spacing-4))`,
              color: 'var(--color-text-secondary)',
            }}
          >
            <Text type="supporting" color="inherit" weight="medium">+{hiddenCount}개</Text>
          </div>
        )}
      </button>
    );
  };

  return (
    <>
      <AlertContainer />
      <ConfirmContainer />
      {/* 배차 모드: 서브탭 */}
      {isDispatchMode && (
        <div style={{ marginBottom: 'var(--spacing-4)' }}>
          <SegmentedControl
            value={dispatchSubTab}
            onChange={(v) => setDispatchSubTab(v as 'calendar' | 'list' | 'absence')}
            label="배차 보기 모드"
          >
            <SegmentedControlItem value="calendar" label="달력" icon={<Icon icon="calendar" size="sm" />} />
            <SegmentedControlItem value="list" label="목록" icon={<Icon icon={IconList} size="sm" />} />
            <SegmentedControlItem value="absence" label="결석 관리" icon={<Icon icon={IconUsers} size="sm" />} />
          </SegmentedControl>
        </div>
      )}

      {/* 배차 모드: 목록 뷰 */}
      {isDispatchMode && dispatchSubTab === 'list' && (
        <DispatchListView
          settings={dispatchSettings}
          vacations={dispatchVacations}
          seniorAbsences={seniorAbsences}
        />
      )}

      {/* 배차 모드: 결석 관리 */}
      {isDispatchMode && dispatchSubTab === 'absence' && (
        <SeniorAbsenceManagement />
      )}

      {/* 달력 뷰 (일정 모드 항상 / 배차 모드는 달력 서브탭일 때만) */}
      {(!isDispatchMode || dispatchSubTab === 'calendar') && (
      <div className="carev-schedcal-layout">
        {/* 캘린더 카드 */}
        <div className={!isDispatchMode && selectedDate ? 'carev-schedcal-main carev-schedcal-main--narrow' : 'carev-schedcal-main'}>
          <div className="carev-schedcal-card" style={CARD_STYLE}>
            {/* 캘린더 헤더 */}
            <div style={{ padding: 'var(--spacing-6)', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
              <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
                <HStack gap={4} vAlign="center" wrap="wrap">
                  <Text type="large" as="h2" weight="bold" color="primary">
                    {format(currentDate, 'yyyy년 M월', { locale: ko })}
                  </Text>
                  <Button label="오늘" variant="secondary" size="sm" onClick={goToToday} />
                  {/* 일정 모드: 이번 달 수행 진행도 */}
                  {!isDispatchMode && (
                    <HStack gap={2} vAlign="center">
                      <Text type="supporting" color="secondary" hasTabularNumbers>
                        수행완료 {monthProgress.done}/{monthProgress.total}
                      </Text>
                      <div
                        role="progressbar"
                        aria-label="이번 달 일정 진행도"
                        aria-valuenow={monthProgress.percent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        style={{ width: 120, height: 6, borderRadius: 'var(--radius-full)', background: 'var(--color-background-muted)', overflow: 'hidden' }}
                      >
                        <div style={{ width: `${monthProgress.percent}%`, height: '100%', background: 'var(--color-background-green)', transition: 'width var(--duration-fast) var(--ease-standard)' }} />
                      </div>
                      <Text type="supporting" weight="semibold" color="primary" hasTabularNumbers>{monthProgress.percent}%</Text>
                    </HStack>
                  )}
                  {/* 일정/휴무자 보기 토글 — 기본은 둘 다 */}
                  {!isDispatchMode && (
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
                  )}
                  {!isDispatchMode && (
                    <Button
                      label={showMyTasksOnly ? '전체 일정 보기' : '담당 업무'}
                      variant={showMyTasksOnly ? 'primary' : 'secondary'}
                      size="sm"
                      icon={<Icon icon={IconUserCheck} size="sm" />}
                      onClick={() => setShowMyTasksOnly((v) => !v)}
                    />
                  )}
                </HStack>
                <HStack gap={2} vAlign="center">
                  {isDispatchMode ? (
                    <>
                      {/* 배차 범례 */}
                      <HStack gap={3} vAlign="center">
                        <HStack gap={1} vAlign="center">
                          <span style={{ width: 10, height: 10, borderRadius: 'var(--radius-full)', background: 'var(--color-background-green)' }} />
                          <Text type="supporting" color="secondary">정상</Text>
                        </HStack>
                        <HStack gap={1} vAlign="center">
                          <span style={{ width: 10, height: 10, borderRadius: 'var(--radius-full)', background: 'var(--color-background-yellow)' }} />
                          <Text type="supporting" color="secondary">대체</Text>
                        </HStack>
                        <HStack gap={1} vAlign="center">
                          <span style={{ width: 10, height: 10, borderRadius: 'var(--radius-full)', background: 'var(--color-background-red)' }} />
                          <Text type="supporting" color="secondary">운행없음</Text>
                        </HStack>
                        <HStack gap={1} vAlign="center">
                          <span style={{ width: 10, height: 10, borderRadius: 'var(--radius-full)', background: 'var(--color-background-muted)' }} />
                          <Text type="supporting" color="secondary">휴일</Text>
                        </HStack>
                      </HStack>
                      <Button
                        label="배차 설정"
                        variant="primary"
                        size="sm"
                        icon={<Icon icon="wrench" size="sm" />}
                        onClick={() => setShowDispatchSettings(true)}
                      />
                    </>
                  ) : (
                    <Button
                      label="일정 추가"
                      variant="primary"
                      size="sm"
                      icon={<Icon icon={IconPlus} size="sm" />}
                      onClick={() => openCreateModal()}
                    />
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-inner)' }}>
                    <Button
                      label="이전 달"
                      variant="ghost"
                      size="sm"
                      isIconOnly
                      icon={<Icon icon="chevronLeft" size="md" />}
                      onClick={goToPrevMonth}
                    />
                    <Button
                      label="다음 달"
                      variant="ghost"
                      size="sm"
                      isIconOnly
                      icon={<Icon icon="chevronRight" size="md" />}
                      onClick={goToNextMonth}
                    />
                  </div>
                </HStack>
              </HStack>

              {/* 일정 모드: 색상 범례 (라벨 + 카테고리 기본색) */}
              {!isDispatchMode && (
                <div style={{ marginTop: 'var(--spacing-3)', display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-3)', alignItems: 'center' }}>
                  {labels.map((label) => (
                    <HStack key={label.id} gap={1} vAlign="center">
                      <span style={{ width: 10, height: 10, borderRadius: 'var(--radius-full)', background: label.color }} />
                      <Text type="supporting" color="secondary">{label.name}</Text>
                    </HStack>
                  ))}
                  {labels.length > 0 && <span style={{ width: 1, height: 12, background: 'var(--color-border)' }} />}
                  {SCHEDULE_CATEGORIES.map((cat) => (
                    <HStack key={cat.value} gap={1} vAlign="center">
                      <span style={{ width: 10, height: 10, borderRadius: 'var(--radius-full)', background: SCHEDULE_CATEGORY_COLORS[cat.value] }} />
                      <Text type="supporting" color="secondary">{cat.label}</Text>
                    </HStack>
                  ))}
                </div>
              )}
            </div>

            {/* 요일 헤더 */}
            <div className="carev-schedcal-cols" style={{ borderBottom: GRID_LINE, flexShrink: 0 }}>
              {WEEKDAYS.map((day, index) => (
                <div
                  key={day}
                  style={{
                    padding: 'var(--spacing-3) 0',
                    textAlign: 'center',
                    color: index === 0 ? 'var(--color-text-red)' : index === 6 ? 'var(--color-text-blue)' : 'var(--color-text-primary)',
                  }}
                >
                  <Text type="label" weight="semibold" color="inherit">{day}</Text>
                </div>
              ))}
            </div>

            {/* 배차 모드: 설정 비어있을 때 안내 */}
            {isDispatchMode && isHydrated && dispatchSettings.routes.length === 0 && (
              <div style={{ padding: 'var(--spacing-6)', textAlign: 'center', borderBottom: '1px solid var(--color-border)' }}>
                <div style={{ background: 'var(--color-background-yellow)', border: '1px solid var(--color-border-yellow)', borderRadius: 'var(--radius-inner)', padding: 'var(--spacing-4)' }}>
                  <VStack gap={1} hAlign="center">
                    <Text type="body" weight="medium" color="primary">배차 설정이 필요합니다</Text>
                    <div style={{ color: 'var(--color-text-yellow)' }}>
                      <Text type="supporting" color="inherit">노선, 직원 정보를 먼저 등록해주세요.</Text>
                    </div>
                    <div style={{ marginTop: 'var(--spacing-2)' }}>
                      <Button label="설정하러 가기" variant="primary" size="sm" onClick={() => setShowDispatchSettings(true)} />
                    </div>
                  </VStack>
                </div>
              </div>
            )}

            {/* 캘린더 그리드 */}
            <div className="carev-schedcal-scroll">
            {isLoading ? (
              <Loading label="달력을 불러오는 중..." />
            ) : isDispatchMode ? (
              <div className="carev-schedcal-cols">
                {calendarDays.map((date, index) =>
                  date ? renderDispatchDayCell(date) : <div key={`empty-${index}`} style={EMPTY_CELL_STYLE} />
                )}
              </div>
            ) : (
              <div className="carev-schedcal-weeks">
                {calendarWeeks.map((week, weekIndex) => {
                  const layout = weekBarLayouts[weekIndex];
                  return (
                    <div key={`week-${weekIndex}`} className="carev-schedcal-week">
                      {week.map((date, dayIndex) =>
                        date ? (
                          renderScheduleDayCell(date, layout?.hiddenCounts[format(date, 'yyyy-MM-dd')] || 0)
                        ) : (
                          <div key={`empty-${weekIndex}-${dayIndex}`} style={EMPTY_CELL_STYLE} />
                        )
                      )}
                      {/* 여러 날 일정을 하나의 바로 이어서 표시하는 오버레이.
                          휴무자를 같이 볼 때는 칸 오른쪽이 명단 자리라 하루 단위로 끊어 그린다. */}
                      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                        {showsSchedules(pane) && layout?.bars.flatMap((bar) =>
                          buildBarSegments(bar, pane, (col) => {
                            const d = week[col];
                            return !!d && (monthVacations.get(format(d, 'yyyy-MM-dd'))?.length ?? 0) > 0;
                          }).map((segment) => {
                          const leftInset = segment.continuesBefore ? 0 : BAR_EDGE_INSET;
                          const rightInset = segment.continuesAfter ? 0 : BAR_EDGE_INSET;
                          const startRadius = segment.continuesBefore ? '0' : 'var(--radius-inner)';
                          const endRadius = segment.continuesAfter ? '0' : 'var(--radius-inner)';
                          const barColor = getScheduleColor(bar.schedule);
                          const isDone = !!bar.schedule.isCompleted;
                          return (
                            <button
                              key={`${bar.schedule.id}-${weekIndex}-${segment.startCol}`}
                              className="carev-schedcal-bar"
                              onClick={(e) => handleScheduleClick(e, bar.schedule)}
                              title={isDone ? `${bar.schedule.title} (수행완료)` : bar.schedule.title}
                              style={{
                                position: 'absolute',
                                top: BAR_AREA_TOP + bar.lane * (BAR_HEIGHT + BAR_GAP),
                                left: `calc(${segment.leftPct}% + ${leftInset}px)`,
                                width: `calc(${segment.widthPct}% - ${leftInset + rightInset}px)`,
                                height: BAR_HEIGHT,
                                display: 'flex',
                                alignItems: 'center',
                                // 일정 제목을 칸 가운데에 둔다 (앞뒤 화살표·완료 아이콘은 제목 옆에 붙는다)
                                justifyContent: 'center',
                                padding: '0 var(--spacing-1-5)',
                                border: isDone ? `1px solid ${barColor}` : 'none',
                                borderRadius: `${startRadius} ${endRadius} ${endRadius} ${startRadius}`,
                                backgroundColor: isDone ? withAlpha(barColor, 0.14) : barColor,
                                color: isDone ? barColor : getScheduleTextColor(barColor),
                                opacity: isDone ? 0.85 : 0.9,
                                overflow: 'hidden',
                                whiteSpace: 'nowrap',
                                textAlign: 'center',
                                cursor: 'pointer',
                                pointerEvents: 'auto',
                              }}
                            >
                              {segment.continuesBefore && (
                                <span style={{ flexShrink: 0, marginRight: 'var(--spacing-1)', lineHeight: 'var(--text-display-1-leading)' }}>
                                  <Text type="supporting" color="inherit" weight="bold">◀</Text>
                                </span>
                              )}
                              {isDone && (
                                <span style={{ flexShrink: 0, marginRight: 2, display: 'flex', lineHeight: 'var(--text-display-1-leading)' }}>
                                  <Icon icon={IconCircleCheck} size="xsm" color="inherit" />
                                </span>
                              )}
                              <span style={{ flex: '0 1 auto', minWidth: 0, overflow: 'hidden', textDecoration: isDone ? 'line-through' : 'none' }}>
                                <Text type="supporting" color="inherit" weight="medium" maxLines={1}>
                                  {bar.schedule.title}
                                </Text>
                              </span>
                              {segment.continuesAfter && (
                                <span style={{ flexShrink: 0, marginLeft: 'var(--spacing-1)', lineHeight: 'var(--text-display-1-leading)' }}>
                                  <Text type="supporting" color="inherit" weight="bold">▶</Text>
                                </span>
                              )}
                            </button>
                          );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            </div>
          </div>
        </div>

        {/* 선택된 날짜 상세 (우측 패널) - 일정 모드에서만 */}
        <AnimatePresence>
          {!isDispatchMode && selectedDate && (
            <motion.div
              className="carev-schedcal-detail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: duration.fastMax }}
            >
              <div style={{ ...CARD_STYLE, height: '100%', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {/* 헤더 */}
                <div style={{ padding: 'var(--spacing-5)', borderBottom: '1px solid var(--color-border)' }}>
                  <HStack hAlign="between" vAlign="start">
                    <VStack gap={1}>
                      <Text type="large" as="h3" weight="bold" color="primary">
                        {format(selectedDate, 'M월 d일 (EEEE)', { locale: ko })}
                      </Text>
                      <Text type="supporting">
                        {getSchedulesForDate(selectedDate).length}개 일정 · 완료 {getSchedulesForDate(selectedDate).filter((s) => s.isCompleted).length}개
                        {' · '}휴무 {(monthVacations.get(format(selectedDate, 'yyyy-MM-dd')) || []).length}명
                      </Text>
                    </VStack>
                    <Button
                      label="닫기"
                      variant="ghost"
                      size="sm"
                      isIconOnly
                      icon={<Icon icon="close" size="md" />}
                      onClick={() => setSelectedDate(null)}
                    />
                  </HStack>
                </div>

                {/* 일정 추가 버튼 */}
                <div style={{ padding: 'var(--spacing-4) var(--spacing-5) 0' }}>
                  <Button
                    label="일정 추가"
                    variant="primary"
                    size="sm"
                    icon={<Icon icon={IconPlus} size="sm" />}
                    onClick={() => openCreateModal(selectedDate)}
                    style={{ width: '100%' }}
                  />
                </div>

                {/* 그날 휴무자 — 달력 칸에서는 이름만 몇 줄 보이므로 여기서 전부 펼친다 */}
                {(monthVacations.get(format(selectedDate, 'yyyy-MM-dd')) || []).length > 0 && (
                  <div style={{ padding: 'var(--spacing-4) var(--spacing-5) 0' }}>
                    <VStack gap={1.5}>
                      <Text type="label" weight="semibold" color="secondary">휴무자</Text>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-1)' }}>
                        {(monthVacations.get(format(selectedDate, 'yyyy-MM-dd')) || []).map((person) => (
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

                {/* 일정 목록 (스크롤 가능) */}
                <div style={{ padding: 'var(--spacing-5)', flex: 1, overflowY: 'auto' }}>
                  {getSchedulesForDate(selectedDate).length > 0 ? (
                    <VStack gap={2}>
                      {getSchedulesForDate(selectedDate).map((schedule) => (
                        <div
                          key={schedule.id}
                          className="carev-schedcal-list-item"
                          style={{ width: '100%', padding: 'var(--spacing-3)', borderRadius: 'var(--radius-element)', border: '1px solid var(--color-border)', background: 'var(--color-background-muted)', textAlign: 'left' }}
                        >
                          <button
                            onClick={() => handleScheduleClick(null, schedule)}
                            style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: 'var(--spacing-0)', cursor: 'pointer' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--spacing-2)' }}>
                              <div
                                style={{ width: 10, height: 10, borderRadius: 'var(--radius-full)', marginTop: 'var(--spacing-1-5)', flexShrink: 0, backgroundColor: getScheduleColor(schedule), opacity: schedule.isCompleted ? 0.4 : 1 }}
                              />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ textDecoration: schedule.isCompleted ? 'line-through' : 'none', opacity: schedule.isCompleted ? 0.6 : 1 }}>
                                  <Text type="body" weight="semibold" color="primary" maxLines={1}>{schedule.title}</Text>
                                </div>
                                <div style={{ marginTop: 'var(--spacing-1)' }}>
                                  <HStack gap={1.5} vAlign="center" wrap="wrap">
                                    <Badge variant="teal" label={getCategoryText(schedule.category)} />
                                    {schedule.isCompleted && <Badge variant="green" label="수행완료" />}
                                    {(schedule.taskTotal || 0) > 0 && !schedule.isCompleted && (
                                      <Badge
                                        variant="blue"
                                        label={`할 일 ${schedule.taskCompleted || 0}/${schedule.taskTotal}`}
                                      />
                                    )}
                                    <Text type="supporting">
                                      {schedule.isAllDay ? '종일' : `${schedule.startTime || ''} - ${schedule.endTime || ''}`}
                                    </Text>
                                    {schedule.startDate.split('T')[0] !== schedule.endDate.split('T')[0] && (
                                      <Text type="supporting" color="secondary">
                                        {formatMonthDay(schedule.startDate)} ~ {formatMonthDay(schedule.endDate)}
                                      </Text>
                                    )}
                                  </HStack>
                                </div>
                                {schedule.location && (
                                  <div style={{ marginTop: 'var(--spacing-0-5)' }}>
                                    <Text type="supporting" color="secondary" maxLines={1}>{schedule.location}</Text>
                                  </div>
                                )}
                              </div>
                            </div>
                          </button>
                          {((!hasTasks(schedule) && canToggleCompletion(schedule)) || canManageSchedule(schedule)) && (
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-1)', marginTop: 'var(--spacing-2)', paddingTop: 'var(--spacing-2)', borderTop: '1px solid var(--color-border)', flexWrap: 'wrap' }}>
                              {!hasTasks(schedule) && canToggleCompletion(schedule) && (
                                <Button
                                  label={schedule.isCompleted ? '완료 해제' : '수행완료'}
                                  variant={schedule.isCompleted ? 'ghost' : 'primary'}
                                  size="sm"
                                  icon={<Icon icon={IconCircleCheck} size="sm" />}
                                  isLoading={togglingScheduleId === schedule.id}
                                  isDisabled={togglingScheduleId === schedule.id}
                                  onClick={() => handleToggleCompletion(schedule, !schedule.isCompleted)}
                                />
                              )}
                              {canManageSchedule(schedule) && (
                                <>
                                  <Button label="수정" variant="ghost" size="sm" onClick={() => handleEditSchedule(schedule)} />
                                  <Button
                                    label="삭제"
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedSchedule(schedule);
                                      setShowDeleteConfirm(true);
                                    }}
                                  />
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </VStack>
                  ) : (
                    <EmptyState
                      icon={<Icon icon="calendar" size="lg" color="disabled" />}
                      title="일정이 없습니다"
                      description="일정 추가 버튼으로 새 일정을 등록하세요"
                    />
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      )}

      {/* 일정 생성/수정 모달 */}
      <Dialog
        isOpen={showCreateModal}
        onOpenChange={(open) => { if (!open) { setShowCreateModal(false); setSelectedSchedule(null); } }}
        purpose="form"
        width={640}
      >
        <Layout
          header={
            <DialogHeader
              title={selectedSchedule ? '일정 수정' : '일정 추가'}
              subtitle="일정 정보를 입력해주세요"
              onOpenChange={(open) => { if (!open) { setShowCreateModal(false); setSelectedSchedule(null); } }}
            />
          }
          content={
            <LayoutContent>
              <VStack gap={4}>
                {/* 제목 */}
                <TextInput
                  label="제목"
                  isRequired
                  value={formData.title}
                  onChange={(value) => setFormData(prev => ({ ...prev, title: value }))}
                  placeholder="일정 제목을 입력하세요"
                />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-4)' }}>
                  {/* 일정 구분 */}
                  <Selector
                    label="일정 구분"
                    width="100%"
                    value={formData.category}
                    options={SCHEDULE_CATEGORIES.map((cat) => ({ value: cat.value, label: cat.label }))}
                    onChange={(value) => setFormData(prev => ({ ...prev, category: value as ScheduleCategory }))}
                  />

                  {/* 라벨 (색상) */}
                  <div>
                    <div style={{ display: 'flex', gap: 'var(--spacing-2)', alignItems: 'flex-end' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Selector
                          label="라벨"
                          width="100%"
                          value={formData.labelId}
                          options={[{ value: '', label: '없음' }, ...labels.map((label) => ({ value: String(label.id), label: label.name }))]}
                          onChange={(value) => setFormData(prev => ({ ...prev, labelId: value }))}
                        />
                      </div>
                      <Button
                        label="라벨 설정"
                        variant="secondary"
                        isIconOnly
                        icon={<Icon icon="wrench" size="sm" />}
                        onClick={() => setShowLabelModal(true)}
                      />
                    </div>
                    {formData.labelId && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', marginTop: 'var(--spacing-1-5)' }}>
                        <span
                          style={{ width: 12, height: 12, borderRadius: 'var(--radius-full)', backgroundColor: labels.find(l => String(l.id) === String(formData.labelId))?.color }}
                        />
                        <Text type="supporting" color="secondary">
                          {labels.find(l => String(l.id) === String(formData.labelId))?.name}
                        </Text>
                      </div>
                    )}
                  </div>
                </div>

                {/* 장소 */}
                <TextInput
                  label="장소"
                  value={formData.location}
                  onChange={(value) => setFormData(prev => ({ ...prev, location: value }))}
                  placeholder="장소를 입력하세요"
                />

                {/* 날짜/시간 */}
                <VStack gap={2}>
                  <HStack hAlign="between" vAlign="center">
                    <Text type="label" weight="medium">날짜/시간</Text>
                    <CheckboxInput
                      label="종일"
                      value={formData.isAllDay}
                      onChange={(checked) => setFormData(prev => ({ ...prev, isAllDay: checked }))}
                    />
                  </HStack>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-4)' }}>
                    <DateInput
                      label="시작일"
                      value={formData.startDate ? (formData.startDate as ISODateString) : undefined}
                      onChange={(value) => setFormData(prev => ({ ...prev, startDate: value || '' }))}
                    />
                    {!formData.isAllDay && (
                      <TimeInput
                        label="시작 시간"
                        hourFormat="24h"
                        value={formData.startTime ? (formData.startTime as ISOTimeString) : undefined}
                        onChange={(value) => setFormData(prev => ({ ...prev, startTime: value || '' }))}
                      />
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-4)' }}>
                    <DateInput
                      label="종료일"
                      value={formData.endDate ? (formData.endDate as ISODateString) : undefined}
                      onChange={(value) => setFormData(prev => ({ ...prev, endDate: value || '' }))}
                    />
                    {!formData.isAllDay && (
                      <TimeInput
                        label="종료 시간"
                        hourFormat="24h"
                        value={formData.endTime ? (formData.endTime as ISOTimeString) : undefined}
                        onChange={(value) => setFormData(prev => ({ ...prev, endTime: value || '' }))}
                      />
                    )}
                  </div>
                </VStack>

                {/* 알림 */}
                <CheckboxInput
                  label="참석자에게 알림 전송"
                  value={formData.sendNotification}
                  onChange={(checked) => setFormData(prev => ({ ...prev, sendNotification: checked }))}
                />

                {/* 담당자 지정 */}
                <Selector
                  label="담당자"
                  placeholder="담당자 미지정"
                  hasClear
                  value={formData.managerId || null}
                  onChange={(value) => setFormData(prev => ({ ...prev, managerId: value || '' }))}
                  options={members.map((m) => ({ value: String(m.id), label: `${m.name}${getMemberRoleText(m) ? ` (${getMemberRoleText(m)})` : ''}` }))}
                />

                {/* 참석자 선택 — 직종으로 좁혀 보고, 직종 단위로 한꺼번에 고를 수 있다 */}
                <VStack gap={2}>
                  <HStack hAlign="between" vAlign="center">
                    <Text type="label" weight="medium">참석자</Text>
                    {formData.participantIds.length > 0 && (
                      <HStack gap={2} vAlign="center">
                        <Text type="supporting" color="accent">{formData.participantIds.length}명 선택됨</Text>
                        <Button
                          label="선택 해제"
                          variant="ghost"
                          size="sm"
                          onClick={() => setFormData((prev) => ({ ...prev, participantIds: [] }))}
                        />
                      </HStack>
                    )}
                  </HStack>

                  {memberRoleOptions.length > 0 && (
                    <>
                      {/* 조회 필터 — 목록에 보이는 직종을 좁힌다 */}
                      <MultiSelector
                        label="직종으로 조회"
                        isLabelHidden
                        size="sm"
                        placeholder="전체 직종"
                        options={memberRoleOptions.map((role) => ({ value: role, label: getRoleDisplayName(role) }))}
                        value={participantRoleFilter}
                        onChange={(values) => setParticipantRoleFilter(values)}
                        triggerDisplay="badges"
                        hasSelectAll
                        selectAllLabel="전체 직종"
                      />

                      {/* 직종 단위 일괄 선택 — 누르면 그 직종 전원이 들어가고, 다시 누르면 빠진다 */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-1)' }}>
                        {memberRoleOptions.map((role) => {
                          const ids = members.filter((m) => getMemberRoleName(m) === role).map((m) => String(m.id));
                          const allSelected = ids.length > 0 && ids.every((id) => formData.participantIds.includes(id));
                          return (
                            <Button
                              key={role}
                              label={`${getRoleDisplayName(role)} ${ids.length}명`}
                              variant={allSelected ? 'primary' : 'secondary'}
                              size="sm"
                              onClick={() => toggleRoleParticipants(role)}
                            />
                          );
                        })}
                      </div>
                    </>
                  )}

                  {/* 이름을 한 줄에 하나씩 두면 스크롤만 길어진다 — 폭이 되는 만큼 여러 열로 채운다 */}
                  <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--color-border-emphasized)', borderRadius: 'var(--radius-inner)', padding: 'var(--spacing-2)' }}>
                    {participantCandidates.length === 0 ? (
                      <EmptyState title={members.length === 0 ? '직원이 없습니다' : '이 직종에 해당하는 직원이 없습니다'} />
                    ) : (
                      // 이름만 늘어놓으면 누가 누군지 알기 어렵다 — 사진과 직종을 함께 보여준다
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--spacing-1)' }}>
                        {participantCandidates.map((member) => {
                          const memberId = member.id.toString();
                          const isPicked = formData.participantIds.includes(memberId);
                          return (
                            <MemberItem
                              key={member.id}
                              name={member.name}
                              role={getMemberRoleText(member)}
                              imageUrl={member.profileImageUrl}
                              isSelected={isPicked}
                              density="compact"
                              onClick={() => {
                                setFormData(prev => ({
                                  ...prev,
                                  participantIds: isPicked
                                    ? prev.participantIds.filter(id => id !== memberId)
                                    : [...prev.participantIds, memberId],
                                }));
                              }}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                </VStack>

              </VStack>
            </LayoutContent>
          }
          footer={
            <LayoutFooter hasDivider>
              <HStack gap={2} hAlign="end">
                <Button
                  label="취소"
                  variant="ghost"
                  onClick={() => { setShowCreateModal(false); setSelectedSchedule(null); }}
                />
                <Button
                  label={selectedSchedule ? '수정하기' : '추가하기'}
                  variant="primary"
                  isLoading={isSubmitting}
                  isDisabled={isSubmitting || !formData.title}
                  onClick={selectedSchedule ? handleSubmitUpdate : handleSubmitCreate}
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>

      {/* 일정 상세 모달 */}
      <Dialog
        isOpen={showDetailModal && !!selectedSchedule}
        onOpenChange={(open) => { if (!open) { setShowDetailModal(false); setSelectedSchedule(null); } }}
        purpose="info"
        width={640}
      >
        {selectedSchedule && (
          <Layout
            header={
              <DialogHeader
                title={selectedSchedule.title}
                subtitle={getCategoryText(selectedSchedule.category)}
                onOpenChange={(open) => { if (!open) { setShowDetailModal(false); setSelectedSchedule(null); } }}
              />
            }
            content={
              <LayoutContent>
                <VStack gap={4}>
                  {/* 수행 상태 */}
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
                      {!selectedSchedule.isCompleted && selectedSchedule.managerId != null && !canToggleCompletion(selectedSchedule) && (
                        <Text type="supporting" color="secondary">
                          담당자{selectedSchedule.managerName ? `(${selectedSchedule.managerName})` : ''}만 완료 처리할 수 있습니다
                        </Text>
                      )}
                      {selectedSchedule.isCompleted && (
                        <Text type="supporting" color="secondary">
                          {selectedSchedule.completedByName ? `${selectedSchedule.completedByName} · ` : ''}
                          {selectedSchedule.completedAt ? format(new Date(selectedSchedule.completedAt), 'yyyy.MM.dd HH:mm') : ''}
                        </Text>
                      )}
                    </div>
                    {/* 할 일이 있으면 완료는 할 일 진행에 따라 자동으로 결정된다 */}
                    {!hasTasks(selectedSchedule) && canToggleCompletion(selectedSchedule) && (
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

                  {/* 할 일 (담당자별 업무) */}
                  {(() => {
                    const tasks = selectedSchedule.tasks || [];
                    const done = tasks.filter((t) => t.isCompleted).length;
                    const percent = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;

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
                                  <div style={{ width: `${percent}%`, height: '100%', background: 'var(--color-background-green)', transition: 'width var(--duration-fast) var(--ease-standard)' }} />
                                </div>
                                <Text type="supporting" weight="semibold" color="primary" hasTabularNumbers>{percent}%</Text>
                              </HStack>
                            )}
                          </HStack>

                          {tasks.length === 0 && (
                            <Text type="supporting" color="secondary">
                              아직 등록된 할 일이 없습니다. 이 일정에서 해야 할 업무와 담당자를 추가해보세요.
                            </Text>
                          )}

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
                                    options={[{ value: '', label: '담당자 미지정' }, ...members.map((m) => ({ value: String(m.id), label: m.name }))]}
                                    onChange={(value) => setEditTaskForm((prev) => ({ ...prev, assigneeMemberId: value }))}
                                  />
                                  <HStack gap={2} hAlign="end">
                                    <Button label="취소" variant="ghost" size="sm" onClick={() => setEditingTaskId(null)} />
                                    <Button
                                      label="저장"
                                      variant="primary"
                                      size="sm"
                                      isLoading={taskBusyId === task.id}
                                      isDisabled={taskBusyId === task.id || !editTaskForm.content.trim()}
                                      onClick={handleUpdateTask}
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
                                        onClick={() => handleToggleTask(task, !task.isCompleted)}
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
                                          onClick={() => handleDeleteTask(task)}
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
                                options={[{ value: '', label: '담당자 미지정' }, ...members.map((m) => ({ value: String(m.id), label: m.name }))]}
                                onChange={setNewTaskAssignee}
                              />
                              <HStack hAlign="end">
                                <Button
                                  label="할 일 추가"
                                  variant="secondary"
                                  size="sm"
                                  icon={<Icon icon={IconPlus} size="sm" />}
                                  isLoading={isAddingTask}
                                  isDisabled={isAddingTask || !newTaskContent.trim()}
                                  onClick={handleAddTask}
                                />
                              </HStack>
                            </VStack>
                          </div>
                        </VStack>
                      </div>
                    );
                  })()}

                  {/* 날짜/시간 */}
                  <HStack gap={3} vAlign="start">
                    <Icon icon="calendar" size="md" color="tertiary" />
                    <VStack gap={0.5}>
                      <Text type="body" weight="medium" color="primary">
                        {format(new Date(selectedSchedule.startDate), 'yyyy년 M월 d일 (EEEE)', { locale: ko })}
                        {selectedSchedule.startDate !== selectedSchedule.endDate && (
                          <> ~ {format(new Date(selectedSchedule.endDate), 'M월 d일 (EEEE)', { locale: ko })}</>
                        )}
                      </Text>
                      {!selectedSchedule.isAllDay && selectedSchedule.startTime && (
                        <Text type="supporting" color="secondary">
                          {selectedSchedule.startTime} - {selectedSchedule.endTime}
                        </Text>
                      )}
                      {selectedSchedule.isAllDay && (
                        <Text type="supporting" color="secondary">종일</Text>
                      )}
                    </VStack>
                  </HStack>

                  {/* 장소 */}
                  {selectedSchedule.location && (
                    <HStack gap={3} vAlign="start">
                      <Icon icon={IconMapPin} size="md" color="tertiary" />
                      <Text type="body" color="primary">{selectedSchedule.location}</Text>
                    </HStack>
                  )}

                  {/* 알림 */}
                  {selectedSchedule.sendNotification && (
                    <HStack gap={3} vAlign="start">
                      <Icon icon={IconBell} size="md" color="tertiary" />
                      <Text type="body" color="primary">알림 전송됨</Text>
                    </HStack>
                  )}

                  {/* 내용 */}
                  {selectedSchedule.content && (
                    <div style={{ paddingTop: 'var(--spacing-4)', borderTop: '1px solid var(--color-border)' }}>
                      <div style={{ whiteSpace: 'pre-wrap' }}>
                        <Text type="body" color="secondary">{selectedSchedule.content}</Text>
                      </div>
                    </div>
                  )}

                  {/* 첨부파일 */}
                  {selectedSchedule.attachments && selectedSchedule.attachments.length > 0 && (
                    <div style={{ paddingTop: 'var(--spacing-4)', borderTop: '1px solid var(--color-border)' }}>
                      <VStack gap={2}>
                        <Text type="label" weight="medium">첨부파일</Text>
                        {selectedSchedule.attachments.map((attachment) => (
                          <a
                            key={attachment.id}
                            href={attachment.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="carev-schedcal-attach"
                            style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', padding: 'var(--spacing-2)', borderRadius: 'var(--radius-inner)', textDecoration: 'none' }}
                          >
                            <Icon icon={IconFileText} size="sm" color="tertiary" />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <Text type="supporting" color="primary">{attachment.fileName}</Text>
                              <Text type="supporting" color="secondary">{(attachment.fileSize / 1024).toFixed(1)} KB</Text>
                            </div>
                            <Icon icon="externalLink" size="sm" color="tertiary" />
                          </a>
                        ))}
                      </VStack>
                    </div>
                  )}

                  {/* 담당자 — 참석자와 구분 표시 */}
                  {selectedSchedule.managerName && (
                    <div style={{ paddingTop: 'var(--spacing-4)', borderTop: '1px solid var(--color-border)' }}>
                      <VStack gap={2}>
                        <Text type="label" weight="medium">담당자</Text>
                        <div style={{ padding: 'var(--spacing-2)', borderRadius: 'var(--radius-inner)', background: 'var(--color-background-teal)' }}>
                          <HStack gap={2} vAlign="center">
                            <Badge variant="teal" label="담당" />
                            <Text type="supporting" color="primary" weight="semibold">{selectedSchedule.managerName}</Text>
                          </HStack>
                        </div>
                      </VStack>
                    </div>
                  )}

                  {/* 참석자 */}
                  {selectedSchedule.participants && selectedSchedule.participants.length > 0 && (
                    <div style={{ paddingTop: 'var(--spacing-4)', borderTop: '1px solid var(--color-border)' }}>
                      <VStack gap={2}>
                        <Text type="label" weight="medium">참석자 {selectedSchedule.participants.length}명</Text>
                        {selectedSchedule.participants.map((participant) => {
                          const participantName = (participant as any).memberName || participant.userName || '참석자';
                          // 참석자 응답에는 사진이 없어 회원 목록에서 찾아 붙인다
                          const matched = members.find((m) => String(m.id) === String(participant.userId));
                          return (
                            <MemberItem
                              key={participant.id}
                              name={participantName}
                              role={matched ? getMemberRoleText(matched) : undefined}
                              imageUrl={matched?.profileImageUrl}
                              density="compact"
                            />
                          );
                        })}
                      </VStack>
                    </div>
                  )}

                  {/* 작성자 */}
                  <div style={{ paddingTop: 'var(--spacing-4)', borderTop: '1px solid var(--color-border)' }}>
                    <Text type="supporting" color="secondary">
                      작성자: {selectedSchedule.authorName} · {format(new Date(selectedSchedule.createdAt), 'yyyy.MM.dd HH:mm')}
                    </Text>
                  </div>
                </VStack>
              </LayoutContent>
            }
            footer={
              <LayoutFooter hasDivider>
                <HStack hAlign="between" vAlign="center">
                  {(isAdmin || selectedSchedule.authorId === currentUserEmail) ? (
                    <Button label="삭제" variant="destructive" onClick={() => setShowDeleteConfirm(true)} />
                  ) : <div />}
                  <HStack gap={2}>
                    <Button
                      label="닫기"
                      variant="ghost"
                      onClick={() => { setShowDetailModal(false); setSelectedSchedule(null); }}
                    />
                    {(isAdmin || selectedSchedule.authorId === currentUserEmail) && (
                      <Button label="수정" variant="primary" onClick={() => handleEditSchedule()} />
                    )}
                  </HStack>
                </HStack>
              </LayoutFooter>
            }
          />
        )}
      </Dialog>

      {/* 삭제 확인 모달 */}
      <Dialog
        isOpen={showDeleteConfirm}
        onOpenChange={(open) => { if (!open) setShowDeleteConfirm(false); }}
        purpose="required"
        width={440}
      >
        <Layout
          header={
            <DialogHeader
              title="일정 삭제"
              subtitle="정말 이 일정을 삭제하시겠습니까?"
              onOpenChange={(open) => { if (!open) setShowDeleteConfirm(false); }}
            />
          }
          content={
            <LayoutContent>
              <Text type="body" color="secondary">이 작업은 되돌릴 수 없습니다.</Text>
            </LayoutContent>
          }
          footer={
            <LayoutFooter hasDivider>
              <HStack gap={2} hAlign="end">
                <Button label="취소" variant="ghost" onClick={() => setShowDeleteConfirm(false)} />
                <Button
                  label="삭제"
                  variant="destructive"
                  isLoading={isSubmitting}
                  isDisabled={isSubmitting}
                  onClick={handleDeleteSchedule}
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>

      {/* 라벨 설정 모달 */}
      <Dialog
        isOpen={showLabelModal}
        onOpenChange={(open) => { if (!open) { setShowLabelModal(false); setEditingLabelId(null); setDeletingLabelId(null); } }}
        purpose="form"
        width={440}
      >
        <Layout
          header={
            <DialogHeader
              title="라벨 설정"
              subtitle="라벨을 추가, 수정, 삭제할 수 있습니다"
              onOpenChange={(open) => { if (!open) { setShowLabelModal(false); setEditingLabelId(null); setDeletingLabelId(null); } }}
            />
          }
          content={
            <LayoutContent>
              <VStack gap={5}>
                {/* 기존 라벨 목록 */}
                {labels.length > 0 && (
                  <VStack gap={3}>
                    <Text type="label" weight="medium">등록된 라벨</Text>
                    <VStack gap={2}>
                      {labels.map((label) => (
                        <div key={label.id}>
                          {editingLabelId === label.id ? (
                            /* 수정 모드 */
                            <Card variant="muted" padding={3} style={{ borderRadius: 'var(--radius-inner)' }}>
                              <VStack gap={3}>
                                <TextInput
                                  label="라벨 이름"
                                  isLabelHidden
                                  value={editLabelForm.name}
                                  onChange={(value) => setEditLabelForm(prev => ({ ...prev, name: value }))}
                                />
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-2)' }}>
                                  {LABEL_COLORS.map((color) => (
                                    <button
                                      key={color.value}
                                      onClick={() => setEditLabelForm(prev => ({ ...prev, color: color.value }))}
                                      style={colorSwatchStyle(editLabelForm.color === color.value, color.value)}
                                      title={color.label}
                                      aria-label={color.label}
                                    />
                                  ))}
                                </div>
                                <HStack gap={2} hAlign="end">
                                  <Button label="취소" variant="ghost" size="sm" onClick={() => setEditingLabelId(null)} />
                                  <Button
                                    label="저장"
                                    variant="primary"
                                    size="sm"
                                    isLoading={isSubmitting}
                                    isDisabled={isSubmitting || !editLabelForm.name.trim()}
                                    onClick={handleUpdateLabel}
                                  />
                                </HStack>
                              </VStack>
                            </Card>
                          ) : deletingLabelId === label.id ? (
                            /* 삭제 확인 */
                            <Card variant="red" padding={3} style={{ borderRadius: 'var(--radius-inner)' }}>
                              <VStack gap={2}>
                                <Text type="supporting" color="secondary">
                                  &apos;{label.name}&apos; 라벨을 삭제하시겠습니까?
                                </Text>
                                <HStack gap={2} hAlign="end">
                                  <Button label="취소" variant="ghost" size="sm" onClick={() => setDeletingLabelId(null)} />
                                  <Button
                                    label="삭제"
                                    variant="destructive"
                                    size="sm"
                                    isLoading={isSubmitting}
                                    isDisabled={isSubmitting}
                                    onClick={() => handleDeleteLabel(label.id)}
                                  />
                                </HStack>
                              </VStack>
                            </Card>
                          ) : (
                            /* 기본 표시 */
                            <Card variant="muted" padding={3} style={{ borderRadius: 'var(--radius-inner)' }}>
                              <HStack hAlign="between" vAlign="center">
                                <HStack gap={3} vAlign="center">
                                  <span style={{ width: 16, height: 16, borderRadius: 'var(--radius-full)', flexShrink: 0, backgroundColor: label.color }} />
                                  <Text type="body" weight="medium">{label.name}</Text>
                                </HStack>
                                <HStack gap={1}>
                                  <Button
                                    label="수정"
                                    variant="ghost"
                                    size="sm"
                                    isIconOnly
                                    icon={<Icon icon={IconPencil} size="sm" />}
                                    onClick={() => {
                                      setEditingLabelId(label.id);
                                      setEditLabelForm({ name: label.name, color: label.color });
                                      setDeletingLabelId(null);
                                    }}
                                  />
                                  <Button
                                    label="삭제"
                                    variant="ghost"
                                    size="sm"
                                    isIconOnly
                                    icon={<Icon icon={IconTrash} size="sm" />}
                                    onClick={() => {
                                      setDeletingLabelId(label.id);
                                      setEditingLabelId(null);
                                    }}
                                  />
                                </HStack>
                              </HStack>
                            </Card>
                          )}
                        </div>
                      ))}
                    </VStack>
                  </VStack>
                )}

                {labels.length === 0 && (
                  <div style={{ textAlign: 'center', padding: 'var(--spacing-6) 0' }}>
                    <Icon icon={IconTag} size="lg" color="disabled" />
                    <div style={{ marginTop: 'var(--spacing-2)' }}>
                      <Text type="supporting" color="secondary">등록된 라벨이 없습니다</Text>
                    </div>
                  </div>
                )}

                {/* 구분선 */}
                <div style={{ borderTop: '1px solid var(--color-border)' }} />

                {/* 새 라벨 추가 */}
                <VStack gap={3}>
                  <Text type="label" weight="medium">새 라벨 추가</Text>
                  <VStack gap={3}>
                    <TextInput
                      label="라벨 이름"
                      isLabelHidden
                      value={labelForm.name}
                      onChange={(value) => setLabelForm(prev => ({ ...prev, name: value }))}
                      placeholder="라벨 이름을 입력하세요"
                    />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-2)' }}>
                      {LABEL_COLORS.map((color) => (
                        <button
                          key={color.value}
                          onClick={() => setLabelForm(prev => ({ ...prev, color: color.value }))}
                          style={colorSwatchStyle(labelForm.color === color.value, color.value)}
                          title={color.label}
                          aria-label={color.label}
                        />
                      ))}
                    </div>
                    <Button
                      label={isSubmitting ? '추가 중...' : '라벨 추가'}
                      variant="primary"
                      isLoading={isSubmitting}
                      isDisabled={isSubmitting || !labelForm.name}
                      icon={<Icon icon={IconPlus} size="sm" />}
                      onClick={handleCreateLabel}
                      style={{ width: '100%' }}
                    />
                  </VStack>
                </VStack>
              </VStack>
            </LayoutContent>
          }
          footer={
            <LayoutFooter hasDivider>
              <HStack hAlign="end">
                <Button
                  label="닫기"
                  variant="ghost"
                  onClick={() => { setShowLabelModal(false); setEditingLabelId(null); setDeletingLabelId(null); }}
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>

      {/* 배차 모드: 일일 배차 상세 모달 */}
      <AnimatePresence>
        {isDispatchMode && showDispatchDayDetail && dispatchSelectedDate && (
          <DispatchDayDetail
            dispatch={getSelectedDayDispatch()}
            onClose={() => {
              setShowDispatchDayDetail(false);
              setDispatchSelectedDate(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* 배차 모드: 설정 모달 */}
      <AnimatePresence>
        {isDispatchMode && showDispatchSettings && (
          <DispatchSettings
            isOpen={showDispatchSettings}
            onClose={() => setShowDispatchSettings(false)}
            onNotification={onNotification || (() => {})}
          />
        )}
      </AnimatePresence>
    </>
  );
}
