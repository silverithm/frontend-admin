'use client';
import React, { useState, useEffect, useMemo, useCallback, SetStateAction, useRef } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay, addDays, getDay, startOfWeek, endOfWeek, isBefore, startOfDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DayInfo,
  VacationRequest,
  VacationLimit,
  VacationData,
  CalendarProps,
  VACATION_KIND_OPTIONS,
  resolveVacationKind,
} from '@/types/vacation';
import AdminPanel from './AdminPanel';
import CalendarSkeleton from './CalendarSkeleton';
import AdminVacationAddModal from './AdminVacationAddModal';
import { FiRefreshCw, FiAlertCircle, FiCamera, FiUserPlus, FiDownload } from 'react-icons/fi';
import * as htmlToImage from 'html-to-image';
import { Button } from '@astryxdesign/core/Button';
import { Text } from '@astryxdesign/core/Text';
import { Icon } from '@astryxdesign/core/Icon';
import { Badge } from '@astryxdesign/core/Badge';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';

import { getVacationCalendar, getVacationForDate, getVacationDeadlineDates, getVacationEvents, type VacationEvent } from '@/lib/apiService';
import VacationEventModal from './VacationEventModal';
import { getHolidayName } from '@/lib/holidays';
import {
  ALL_ROLE_FILTER,
  compareRoleNames,
  getVacationRequestRole,
  type RoleLookup,
} from '@/lib/roleUtils';
import { duration } from '@/theme/motion';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

interface VacationCalendarProps extends CalendarProps {
  currentDate: Date;
  setCurrentDate: (date: Date | SetStateAction<Date>) => void;
  roleFilter?: string;
  /** 직종 다중 선택 — 전달되면 roleFilter보다 우선. 빈 배열 = 전체 */
  roleFilters?: string[];
  nameFilter?: string | null;
  onShowLimitPanel?: () => void;
  onNameFilterChange?: (name: string | null) => void;
  sortOrder?: 'latest' | 'oldest' | 'vacation-date-asc' | 'vacation-date-desc' | 'name' | 'role';
  memberRoleLookup?: RoleLookup;
  onExportExcel?: () => void;
  isExportingExcel?: boolean;
}

/**
 * 접힘(기본) 상태에서 한 셀에 보여줄 휴무 인원 수와 목록 최대 높이.
 *
 * 달력 전체 높이는 globals.css의 `.carev-vaccal-grid--fit`이 화면 높이에 맞춰
 * 주 단위로 나눠 갖는다. 이 값은 그 안에서 한 셀이 몇 명까지 보여줄지만 정한다.
 * 넘치는 인원은 "+N명 더"로 표시된다.
 */
const COLLAPSED_VISIBLE_COUNT = 4;
const COLLAPSED_LIST_MAX_HEIGHT = 112;

const VacationCalendar: React.FC<VacationCalendarProps> = ({
  onDateSelect,
  onRequestSelect,
  isAdmin = false,
  maxPeopleAllowed = 5,
  currentDate,
  setCurrentDate,
  roleFilter = ALL_ROLE_FILTER,
  roleFilters,
  nameFilter = null,
  onShowLimitPanel,
  onNameFilterChange,
  sortOrder = 'latest',
  memberRoleLookup,
  onExportExcel,
  isExportingExcel = false,
}) => {
  // 직종 필터 정규화: roleFilters(다중)가 오면 우선, 없으면 기존 단일 roleFilter를 배열로.
  // 빈 배열 = 전체. 서버 API는 단일 role만 받으므로 1개 선택일 때만 서버 필터를 쓰고
  // 그 외에는 전체를 받아 클라이언트에서 거른다.
  const effectiveRoleFilters = (roleFilters ?? (roleFilter === ALL_ROLE_FILTER ? [] : [roleFilter]))
    .filter((r) => r && r !== ALL_ROLE_FILTER);
  const roleFilterKey = effectiveRoleFilters.slice().sort().join(',');
  const isAllRoles = effectiveRoleFilters.length === 0;
  const isSingleRole = effectiveRoleFilters.length === 1;
  const apiRoleFilter = isSingleRole ? effectiveRoleFilters[0] : ALL_ROLE_FILTER;
  const matchesRoleFilter = (resolvedRole: string | null | undefined) =>
    isAllRoles || (resolvedRole != null && effectiveRoleFilters.includes(resolvedRole));

  const [calendarData, setCalendarData] = useState<VacationData>({});

  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [showMonthError, setShowMonthError] = useState(false);
  const [error, setError] = useState('');
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth());
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [showAdminVacationModal, setShowAdminVacationModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  // 기관이 직접 지정한 월별 마감일 — { "2026-08": "2026-08-16" }
  const [deadlineDates, setDeadlineDates] = useState<Record<string, string>>({});
  // 이 달에 걸친 중요 행사
  const [events, setEvents] = useState<VacationEvent[]>([]);
  const calendarRef = useRef<HTMLDivElement>(null);
  
  const MAX_RETRY_COUNT = 3;
  const MAX_RETRY_DELAY = 1000;

  const today = new Date();
  
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  
  // 달력에 표시될 날짜 범위 계산
  const dateRange = eachDayOfInterval({ start: startDate, end: endDate });

  const abortControllerRef = React.useRef<AbortController | null>(null);
  const currentRequestIdRef = React.useRef<string | null>(null);
  const lastFetchTimeRef = React.useRef<number>(0);
  const fetchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const fetchCalendarData = useCallback(async (date: Date, retry = 0, forceRefresh = false) => {
    
    if (retry >= MAX_RETRY_COUNT) {
      setError(`${retry}회 재시도 후에도 데이터를 가져오지 못했습니다. 페이지를 새로고침해 주세요.`);
      setIsLoading(false);
      return;
    }

    // 이전 타이머 취소
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
      fetchTimeoutRef.current = null;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setIsLoading(true);
    setError('');
    lastFetchTimeRef.current = Date.now();

    try {
      const requestId = Math.random().toString(36).substring(2, 15);
      currentRequestIdRef.current = requestId;
      

      const year = date.getFullYear();
      const month = date.getMonth();
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0);
      
      const startDateStr = format(startDate, 'yyyy-MM-dd');
      const endDateStr = format(endDate, 'yyyy-MM-dd');
      const requestMonth = format(startDate, 'yyyy-MM');

      
      // apiService의 getVacationCalendar 함수 사용 (토큰 갱신 로직 포함)
      const data = await getVacationCalendar(startDateStr, endDateStr, apiRoleFilter, nameFilter || undefined);

      if (signal.aborted) {
        return;
      }

      if (currentRequestIdRef.current !== requestId) {
        return;
      }

      const dates = Object.keys(data.dates || {});
      if (dates.length > 0) {
        const firstDateMonth = dates[0].substring(0, 7);
        
        if (firstDateMonth !== requestMonth) {
          console.error(`응답 데이터 월 불일치! 요청: ${requestMonth.substring(5)}, 응답: ${firstDateMonth.substring(5)} (시도: ${retry + 1}/${MAX_RETRY_COUNT})`);
          
          const hasRequestMonthData = dates.some(date => date.startsWith(requestMonth));
          
          if (!hasRequestMonthData) {
            const delay = Math.min(1000 * Math.pow(2, retry), MAX_RETRY_DELAY);

            fetchTimeoutRef.current = setTimeout(() => {
              // 재시도할 때 현재 활성화된 요청이 있는지 확인
              const currentId = currentRequestIdRef.current;
              if (currentId) {
                fetchCalendarData(date, retry + 1);
              }
            }, delay);
            return;
          } else {
            console.warn(`응답에 일부 ${requestMonth} 데이터가 있습니다. 필터링하여 사용합니다.`);
            
            // 요청 월에 해당하는 데이터만 필터링
            const filteredDates: { [key: string]: VacationData[string] } = {};
            Object.entries(data.dates || {}).forEach(([dateKey, dateData]) => {
              if (dateKey.startsWith(requestMonth)) {
                // 타입 안전하게 처리
                if (dateData && typeof dateData === 'object' && 'date' in dateData && 'totalVacationers' in dateData && 'vacations' in dateData) {
                  filteredDates[dateKey] = dateData as VacationData[string];
                } else {
                  console.warn(`데이터 형식 불일치 - 날짜 ${dateKey} 무시됨`, dateData);
                }
              }
            });
            
            data.dates = filteredDates;
          }
        }
      }
      
      if (currentRequestIdRef.current === requestId) {

        const dateKeys = Object.keys(data.dates || {});

        setCalendarData(data.dates || {});
        setRetryCount(0);
        setIsLoading(false);
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      
      console.error('캘린더 데이터 가져오기 오류:', error);
      
      if (retry < MAX_RETRY_COUNT - 1) {
        const delay = Math.min(1000 * Math.pow(2, retry), MAX_RETRY_DELAY);

        fetchTimeoutRef.current = setTimeout(() => {
          // 재시도할 때 현재 활성화된 요청이 있는지 확인
          const currentId = currentRequestIdRef.current;
          if (currentId) {
            fetchCalendarData(date, retry + 1);
          }
        }, delay);
      } else {
        setError('데이터를 가져오지 못했습니다. 페이지를 새로고침해 주세요.');
        setIsLoading(false);
      }
    }
  }, [roleFilterKey, MAX_RETRY_COUNT, MAX_RETRY_DELAY, nameFilter]);

  const fetchSelectedDateData = async (date: Date) => {
    try {
      const formattedDate = format(date, 'yyyy-MM-dd');


      // apiService의 getVacationForDate 함수 사용 (토큰 갱신 로직 포함)
      const data = await getVacationForDate(formattedDate, apiRoleFilter, nameFilter || undefined);
      

      if (data) {

        const newCalendarData = { ...calendarData };
        
        const dateKey = data.date || formattedDate;

        // 이미 API에서 role에 따라 필터링된 데이터를 반환하므로 추가 필터링 불필요
        newCalendarData[formattedDate] = {
          date: formattedDate,
          vacations: data.vacations || [],
          maxPeople: data.maxPeople !== undefined ? data.maxPeople : 3,
          totalVacationers: data.totalVacationers !== undefined 
                          ? data.totalVacationers 
                          : (data.vacations || []).filter((v: VacationRequest) => v.status !== 'rejected').length
        };
        
        setCalendarData(newCalendarData);
      }
    } catch (error) {
      console.error('선택된 날짜 데이터 로딩 오류:', error);
    }
  };

  const handleRefresh = useCallback(() => {
    setIsLoading(true);
    fetchCalendarData(currentDate, 0, true); // forceRefresh = true
  }, [fetchCalendarData, currentDate]);

  const prevMonth = useCallback(() => {
    
    // 이전 요청 취소
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    setCurrentDate((prev: Date) => {
      const newDate = subMonths(prev, 1);
      return newDate;
    });
  }, [setCurrentDate]);

  const nextMonth = useCallback(() => {
    
    // 이전 요청 취소
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    setCurrentDate((prev: Date) => {
      const newDate = addMonths(prev, 1);
      return newDate;
    });
  }, [setCurrentDate]);

  const resetToCurrentMonth = useCallback(() => {
    
    // 이전 요청 취소
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    setCurrentDate(startOfMonth(new Date()));
  }, [setCurrentDate]);

  // 캘린더 초기 로드
  useEffect(() => {
    fetchCalendarData(currentDate, 0, true); // forceRefresh = true로 초기 로드
    
    // 컴포넌트 언마운트 시 정리
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, []); // currentDate 의존성 제거하여 중복 요청 방지

  // 월 변경시 데이터 로드만 처리
  useEffect(() => {
    fetchCalendarData(currentDate, 0, true); // forceRefresh = true
  }, [currentDate, fetchCalendarData]);

  // 필터 변경시 데이터 로드
  useEffect(() => {
    fetchCalendarData(currentDate, 0, true); // forceRefresh = true
  }, [roleFilterKey, nameFilter, fetchCalendarData, currentDate]);

  useEffect(() => {
    setRetryCount(0);
    setShowMonthError(false);
  }, [currentDate]);

  // 월별 마감일 지정 — 달력에 별표로 표시한다 (실패해도 달력은 그대로 뜬다)
  const loadDeadlineDates = useCallback(() => {
    getVacationDeadlineDates()
      .then(setDeadlineDates)
      .catch(() => setDeadlineDates({}));
  }, []);

  useEffect(() => {
    loadDeadlineDates();
  }, [loadDeadlineDates]);

  // 이 달에 걸친 중요 행사
  const loadEvents = useCallback(() => {
    const start = format(startOfMonth(currentDate), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentDate), 'yyyy-MM-dd');
    getVacationEvents(start, end)
      .then(setEvents)
      .catch(() => setEvents([]));
  }, [currentDate]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  /** 그날에 걸친 행사들 (기간 행사는 매일 표시) */
  const getEventsForDate = useCallback(
    (date: Date) => {
      const key = format(date, 'yyyy-MM-dd');
      return events.filter((e) => e.startDate <= key && e.endDate >= key);
    },
    [events],
  );

  const handleDateClick = (date: Date) => {
    if (!isSameMonth(date, currentDate)) return;
    
    if (selectedDate && isSameDay(date, selectedDate)) {
      setSelectedDate(null);
      
      if (onDateSelect) {
        onDateSelect(null);
      }
      return;
    }
    
    setSelectedDate(date);
    
    // fetchSelectedDateData 제거 - 상위 컴포넌트에서 필터링 처리
    
    if (onDateSelect) {
      onDateSelect(date);
    }
  };

  // 날짜 셀 배경/호버 색상 (인라인 style 값 반환)
  // vacations를 이미 계산해둔 곳(셀 렌더링)에서는 넘겨서 getDayVacations 중복 계산을 피한다
  const getDayColor = (date: Date, vacations?: VacationRequest[]): { bg: string; hoverBg: string; today?: boolean; status?: string } => {
    if (!isSameMonth(date, currentDate)) {
      return { bg: 'var(--color-background-muted)', hoverBg: 'var(--color-background-muted)' };
    }

    // 전체·다중 선택일 때는 무색(한도는 직종별이라 단일 선택일 때만 의미), 단 오늘 날짜는 강조색
    if (!isSingleRole) {
      if (isToday(date)) {
        return { bg: 'var(--color-background-teal)', hoverBg: 'var(--color-background-muted)', today: true };
      }
      return { bg: 'transparent', hoverBg: 'var(--color-background-muted)' };
    }

    const dateKey = format(date, 'yyyy-MM-dd');
    const dayData = calendarData[dateKey];
    const filteredVacations = vacations ?? getDayVacations(date);
    const vacationersCount = filteredVacations.length;
    const maxPeople = dayData?.maxPeople ?? 3;

    if (isToday(date)) {
      return { bg: 'var(--color-background-teal)', hoverBg: 'var(--color-background-muted)', today: true };
    }

    if (vacationersCount < maxPeople) {
      return { bg: 'var(--color-background-green)', hoverBg: 'var(--color-background-green)', status: '여유' };
    } else {
      return { bg: 'var(--color-background-red)', hoverBg: 'var(--color-background-red)', status: '마감' };
    }
  };

  const selectedDateInfo = selectedDate
    ? calendarData[format(selectedDate, 'yyyy-MM-dd')]
    : null;

  const selectedVacations = selectedDateInfo?.vacations || [];

  const fadeInVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: duration.mediumMin } }
  };

  const getDayVacations = (date: Date): VacationRequest[] => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const dayData = calendarData[dateKey];
    
    if (!dayData) {
      return [];
    }
    
    let vacations = Array.isArray(dayData.vacations) && dayData.vacations.length > 0
      ? dayData.vacations
      : Array.isArray(dayData.people) && dayData.people.length > 0
      ? dayData.people
      : [];
    
    vacations = vacations.filter(vacation => vacation.status !== 'rejected');
    
    if (!isAllRoles) {
      vacations = vacations.filter((vacation) => {
        const resolvedRole = getVacationRequestRole(vacation, memberRoleLookup);
        return matchesRoleFilter(resolvedRole);
      });
    }
    
    // 이름 필터링 추가
    if (nameFilter) {
      vacations = vacations.filter(vacation => vacation.userName === nameFilter);
    }
    
    // 정렬 적용
    switch (sortOrder) {
      case 'latest':
        vacations.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
        break;
      case 'oldest':
        vacations.sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
        break;
      case 'vacation-date-asc':
        vacations.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        break;
      case 'vacation-date-desc':
        vacations.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        break;
      case 'name':
        vacations.sort((a, b) => (a.userName || '').localeCompare(b.userName || ''));
        break;
      case 'role':
        vacations.sort((a, b) => {
          const aRole = getVacationRequestRole(a, memberRoleLookup);
          const bRole = getVacationRequestRole(b, memberRoleLookup);
          const roleComparison = compareRoleNames(aRole, bRole);

          if (roleComparison !== 0) {
            return roleComparison;
          }

          return (a.userName || '').localeCompare(b.userName || '');
        });
        break;
    }
    
    return vacations;
  };

  const handleShowAdminPanel = () => {
    setShowAdminPanel(true);
  };

  const handleCloseAdminPanel = () => {
    setShowAdminPanel(false);

    setIsLoading(true);
    fetchCalendarData(currentDate, 0, true); // forceRefresh = true
    
    if (selectedDate) {
      fetchSelectedDateData(selectedDate);
    }
  };

  const handleMonthSelect = (year: number, month: number) => {
    const newDate = new Date(year, month, 1);
    setCurrentDate(newDate);
    setShowMonthPicker(false);
  };

  const handleYearSelect = (year: number) => {
    setSelectedYear(year);
  };

  const handleMonthClick = (month: number) => {
    setSelectedMonth(month);
  };

  const handleApplyDateSelection = () => {
    const newDate = new Date(selectedYear, selectedMonth, 1);
    setCurrentDate(newDate);
    setShowMonthPicker(false);
  };

  const handleOpenMonthPicker = () => {
    setSelectedYear(currentDate.getFullYear());
    setSelectedMonth(currentDate.getMonth());
    setShowMonthPicker(true);
  };

  const handleNameClick = (userName: string) => {
    if (onNameFilterChange) {
      // 현재 선택된 이름과 같으면 필터 해제, 다르면 새로운 필터 적용
      const newFilter = nameFilter === userName ? null : userName;
      onNameFilterChange(newFilter);
    }
  };

  const generateMonthPickerData = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    
    // 현재 연도에서 앞뒤로 2년씩
    for (let year = currentYear - 2; year <= currentYear + 2; year++) {
      years.push(year);
    }
    
    const months = [
      '1월', '2월', '3월', '4월', '5월', '6월',
      '7월', '8월', '9월', '10월', '11월', '12월'
    ];
    
    return { years, months };
  };

  // 현재 월의 모든 날짜 생성
  const calendarDates = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 });
    
    const dates: Date[] = [];
    let current = start;
    
    while (current <= end) {
      dates.push(new Date(current));
      current = addDays(current, 1);
    }
    
    return dates;
  }, [currentDate]);


  // 셀 안의 원형 배지 스타일
  const circleBadgeStyle = (bg: string, size: number): React.CSSProperties => ({
    width: size,
    height: size,
    borderRadius: 'var(--radius-full)',
    background: bg,
    color: 'var(--color-on-accent)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontSize: size <= 12 ? 'var(--font-size-2xs)' : 'var(--font-size-xs)',
    fontWeight: 'var(--font-weight-bold)',
  });

  // 셀 안의 상태 라벨(pill) 스타일
  const cellStatusPillStyle = (status?: string): React.CSSProperties => {
    const base: React.CSSProperties = {
      flexShrink: 0,
      whiteSpace: 'nowrap',
      marginRight: 'var(--spacing-1)',
      padding: 'var(--spacing-0-5) var(--spacing-1)',
      borderRadius: 'var(--radius-full)',
      fontWeight: 'var(--font-weight-medium)',
    };
    if (status === 'approved') return { ...base, backgroundColor: 'var(--color-background-teal)', color: 'var(--color-text-teal)' };
    if (status === 'rejected') return { ...base, backgroundColor: 'var(--color-background-red)', color: 'var(--color-text-red)' };
    return { ...base, backgroundColor: 'var(--color-background-yellow)', color: 'var(--color-text-yellow)' };
  };

  // 상태 한글 변환
  const getStatusText = (status?: string) => {
    switch (status) {
      case 'approved':
        return '승인됨';
      case 'pending':
        return '대기중';
      case 'rejected':
        return '거부됨';
      default:
        return status || '알 수 없음';
    }
  };

  // 캘린더 캡처 기능
  const handleCapture = async () => {
    if (!calendarRef.current || !isExpanded) return;

    setIsCapturing(true);

    // 캡처 모드: 달력이 한 화면에 맞춰 눌려 있어도 원래 비율로 펼쳐서 전체를 담는다.
    // (근무조정 컬럼은 뷰포트 높이에 맞춰 셀을 압축하므로 그대로 캡처하면 잘린다)
    const card = calendarRef.current.closest('.carev-vaccal-card') as HTMLElement | null;
    card?.classList.add('carev-vaccal-capturing');
    // 강제 리플로우로 새 레이아웃을 즉시 반영한 뒤, 페인트 여유를 조금 준다.
    // (requestAnimationFrame은 탭이 비활성일 때 멈추므로 타이머를 쓴다)
    void calendarRef.current.offsetHeight;
    await new Promise<void>((resolve) => setTimeout(resolve, 60));

    try {
      // 현재 보이는 달력 전체를 캡처 (인터랙티브 달력)
      const captureElement = calendarRef.current;

      // html-to-image는 CSS 변수를 canvas 배경색으로 해석하지 못하므로
      // 실제로 계산된 색을 읽어서 넘긴다.
      const computedBg = window.getComputedStyle(card ?? captureElement).backgroundColor;
      const backgroundColor =
        computedBg && computedBg !== 'rgba(0, 0, 0, 0)' && computedBg !== 'transparent'
          ? computedBg
          : 'var(--color-on-accent)';

      // 크기는 CSS 픽셀(width/height)로 주고 배율은 pixelRatio가 담당한다.
      // canvasWidth/Height에 직접 2를 곱하면 pixelRatio와 이중으로 적용돼 잘린다.
      const dataUrl = await htmlToImage.toPng(captureElement, {
        backgroundColor,
        pixelRatio: 2,
        width: captureElement.scrollWidth,
        height: captureElement.scrollHeight,
        filter: (node: HTMLElement) => {
          // 조작용 버튼만 뺀다. 달력 셀도 키보드 접근을 위해 button이라,
          // 태그만 보고 거르면 달력 전체가 빠져 빈 이미지가 나온다 (실제로 났던 사고).
          if (node.tagName === 'BUTTON') {
            const cls = typeof node.className === 'string' ? node.className : '';
            return cls.includes('carev-vaccal-cell');
          }
          return true;
        }
      });
      
      // 이미지를 다운로드
      const link = document.createElement('a');
      const yearMonth = format(currentDate, 'yyyy년_MM월');
      link.download = `근무표_${yearMonth}.png`;
      link.href = dataUrl;
      link.click();
      
      // 성공 메시지 표시
      const successMessage = document.createElement('div');
      successMessage.textContent = '캡처가 완료되었습니다!';
      successMessage.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);background:var(--color-success);color:var(--color-on-success);padding:var(--spacing-3) var(--spacing-6);border-radius:var(--radius-element);box-shadow:var(--shadow-med);z-index:500;transition:opacity var(--duration-medium-min) var(--ease-standard);';
      document.body.appendChild(successMessage);
      
      setTimeout(() => {
        successMessage.style.opacity = '0';
        setTimeout(() => {
          document.body.removeChild(successMessage);
        }, 300);
      }, 2000);
    } catch (error) {
      console.error('캡처 실패:', error);
      // 실패 메시지 표시
      const errorMessage = document.createElement('div');
      errorMessage.textContent = '캡처에 실패했습니다. 다시 시도해주세요.';
      errorMessage.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);background:var(--color-error);color:var(--color-on-error);padding:var(--spacing-3) var(--spacing-6);border-radius:var(--radius-element);box-shadow:var(--shadow-med);z-index:500;transition:opacity var(--duration-medium-min) var(--ease-standard);';
      document.body.appendChild(errorMessage);
      
      setTimeout(() => {
        errorMessage.style.opacity = '0';
        setTimeout(() => {
          document.body.removeChild(errorMessage);
        }, 300);
      }, 3000);
    } finally {
      card?.classList.remove('carev-vaccal-capturing');
      setIsCapturing(false);
    }
  };

  return (
    <div className="carev-vaccal-card" style={{ width: '100%', background: 'var(--color-background-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-element)', boxShadow: 'var(--shadow-low)', overflow: 'hidden' }}>
      {showMonthError && (
        <div style={{ margin: 'var(--spacing-3)', padding: 'var(--spacing-3)', background: 'var(--color-background-red)', border: '1px solid var(--color-border-red)', borderRadius: 'var(--radius-inner)', color: 'var(--color-text-red)' }}>
          <VStack gap={0.5}>
            <Text type="label" weight="semibold" color="inherit">데이터 로드 오류</Text>
            <Text type="supporting" color="inherit">
              요청한 월({format(currentDate, 'yyyy년 MM월')})의 데이터를 가져오지 못했습니다. 새로고침 버튼을 눌러 다시 시도해주세요.
            </Text>
          </VStack>
        </div>
      )}
      <div ref={calendarRef} className="carev-vaccal-body" style={{ padding: 'var(--spacing-5)', display: 'flex', flexDirection: 'column' }}>
        {/* 헤더(월 표시·조작)와 달력 그리드 사이 구분선 — 일정·대시보드 달력 카드와 같은 문법으로 맞춘다 */}
        <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2} width="100%" style={{ paddingBottom: 'var(--spacing-4)', marginBottom: 'var(--spacing-4)', borderBottom: '1px solid var(--color-border)' }}>
          <HStack gap={2} vAlign="center">
            <Icon icon="calendar" size="sm" color="secondary" />
            <VStack gap={0.5}>
              <HStack gap={2} vAlign="center">
                <Text type="large" weight="bold" color="primary">
                  {format(currentDate, 'yyyy년 MM월', { locale: ko })}
                </Text>
                <Button
                  label="월 선택"
                  variant="secondary"
                  size="sm"
                  icon={<Icon icon="calendar" size="sm" />}
                  onClick={handleOpenMonthPicker}
                />
              </HStack>
              <Text type="supporting" color="secondary">휴무 일정 캘린더</Text>
            </VStack>
          </HStack>

          <HStack gap={1} vAlign="center">
            <Button
              label="이전 달"
              variant="ghost"
              size="sm"
              isIconOnly
              icon={<Icon icon="chevronLeft" size="md" />}
              onClick={prevMonth}
            />
            <Button
              label="이번 달로 돌아가기"
              variant="secondary"
              size="sm"
              isIconOnly
              icon={<Icon icon="calendar" size="sm" />}
              onClick={resetToCurrentMonth}
            />
            <Button
              label="다음 달"
              variant="ghost"
              size="sm"
              isIconOnly
              icon={<Icon icon="chevronRight" size="md" />}
              onClick={nextMonth}
            />
            <span style={{ width: 1, height: 20, background: 'var(--color-background-muted)', margin: '0 var(--spacing-1)' }} />
            <Button
              label="데이터 새로고침"
              variant="secondary"
              size="sm"
              isIconOnly
              isLoading={isLoading}
              icon={<Icon icon={FiRefreshCw} size="sm" />}
              onClick={handleRefresh}
            />
            {isAdmin && onShowLimitPanel && (
              <>
                <Button
                  label="휴무 제한 설정"
                  data-tour="action-vacation-limit"
                  variant="secondary"
                  size="sm"
                  onClick={onShowLimitPanel}
                />
                <Button
                  label="중요 행사"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowEventModal(true)}
                />
                {onExportExcel && (
                  <Button
                    label={isExportingExcel ? '내보내는 중...' : '엑셀 내보내기'}
                  data-tour="action-export-excel"
                    variant="secondary"
                    size="sm"
                    isLoading={isExportingExcel}
                    isDisabled={isExportingExcel || isLoading}
                    icon={<Icon icon={FiDownload} size="sm" />}
                    onClick={onExportExcel}
                  />
                )}
                <Button
                  label="직원 휴무 추가"
                  data-tour="action-add-vacation"
                  variant="primary"
                  size="sm"
                  icon={<Icon icon={FiUserPlus} size="sm" />}
                  onClick={() => setShowAdminVacationModal(true)}
                />
              </>
            )}
            <Button
              label={isExpanded ? '접기' : '펼치기'}
              variant={isExpanded ? 'secondary' : 'ghost'}
              size="sm"
              isDisabled={isLoading}
              onClick={() => setIsExpanded(!isExpanded)}
            />
            {isExpanded && (
              <Button
                label={isCapturing ? '캡처 중...' : '캡처'}
                variant="secondary"
                size="sm"
                isLoading={isCapturing}
                isDisabled={isCapturing || isLoading}
                icon={<Icon icon={FiCamera} size="sm" />}
                onClick={handleCapture}
              />
            )}
          </HStack>
        </HStack>

        {/* 인터랙티브 캘린더 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--color-border)', marginBottom: 'var(--spacing-1)' }}>
          {WEEKDAYS.map((day, index) => (
            <div
              key={day}
              style={{ padding: '10px 0', textAlign: 'center', color: index === 0 ? 'var(--color-text-red)' : index === 6 ? 'var(--color-text-blue)' : 'var(--color-text-primary)' }}
            >
              <Text type="label" weight="medium" color="inherit">{day}</Text>
            </div>
          ))}
        </div>

        <motion.div
          className={isExpanded ? 'carev-vaccal-grid' : 'carev-vaccal-grid carev-vaccal-grid--fit'}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 'var(--spacing-1-5) var(--spacing-1)' }}
          initial="hidden"
          animate="visible"
          variants={{
            visible: {
              transition: {
                staggerChildren: 0.01
              }
            }
          }}
        >
          {calendarDates.map((day, index) => {
            const isCurrentDay = isToday(day);
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isSunday = getDay(day) === 0;
            const isSaturday = getDay(day) === 6;
            const isPast = isBefore(day, startOfDay(new Date()));
            const holidayName = isCurrentMonth ? getHolidayName(day) : null;

            const dateKey = format(day, 'yyyy-MM-dd');
            // 기관이 이 달의 마감일로 지정한 날 / 그날에 걸친 중요 행사
            const isDeadlineDay = isCurrentMonth && deadlineDates[dateKey.slice(0, 7)] === dateKey;
            const dayEvents = isCurrentMonth ? getEventsForDate(day) : [];
            const dayData = calendarData[dateKey];
            const vacations = getDayVacations(day);
            const vacationersCount = vacations.length;
            const maxPeople = dayData?.maxPeople ?? 3;
            // getDayColor 내부에서 다시 계산하지 않도록 위에서 구한 vacations를 그대로 넘긴다
            let dayColor = getDayColor(day, vacations);

            const cellStyle = {
              padding: 'var(--spacing-2)',
              borderRadius: 'var(--radius-inner)',
              position: 'relative',
              cursor: 'pointer',
              transition: 'background-color var(--duration-fast)',
              border: isSelected ? '1px solid var(--color-border-teal)' : '1px solid transparent',
              background: isSelected ? 'var(--color-background-teal)' : dayColor.bg,
              boxShadow: isSelected ? '0 0 0 2px var(--color-border-teal), 0 1px 2px rgba(0,0,0,0.05)' : undefined,
              opacity: !isCurrentMonth ? 0.3 : (isPast && isCurrentMonth ? 0.7 : 1),
              overflow: isExpanded ? undefined : 'hidden',
              zIndex: isSelected ? 10 : undefined,
              ['--carev-cell-hover']: dayColor.hoverBg,
            } as React.CSSProperties;

            return (
              <motion.button
                key={index}
                type="button"
                aria-label={`${format(day, 'M월 d일')} 휴무 상세 보기`}
                variants={fadeInVariants}
                onClick={() => handleDateClick(day)}
                className={`${isExpanded ? 'carev-vaccal-cell-expanded' : 'carev-vaccal-cell'}${!isSelected ? ' carev-vaccal-hover' : ''}`}
                style={cellStyle}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-1)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-0-5)' }}>
                    {isCurrentDay ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 'var(--radius-full)', background: 'var(--color-background-teal)', color: 'var(--color-text-teal)' }}>
                        <Text type="label" weight="bold" color="inherit">{format(day, 'd')}</Text>
                      </span>
                    ) : (
                      <span style={{ color: !isCurrentMonth ? 'var(--color-text-primary)' : holidayName || isSunday ? 'var(--color-text-red)' : isSaturday ? 'var(--color-text-blue)' : 'var(--color-text-primary)' }}>
                        <Text type="label" weight="semibold" color="inherit">{format(day, 'd')}</Text>
                      </span>
                    )}
                    {/* 휴무 입력 마감일 — 한눈에 띄도록 별표 */}
                    {isDeadlineDay && (
                      <span
                        title="휴무 입력 마감일"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 2,
                          padding: '0 var(--spacing-1)',
                          borderRadius: 'var(--radius-full)',
                          background: 'var(--color-background-yellow)',
                          color: 'var(--color-text-yellow)',
                          fontSize: 'var(--font-size-xs)',
                          fontWeight: 'var(--font-weight-bold)',
                          flexShrink: 0,
                        }}
                      >
                        ★ 마감
                      </span>
                    )}
                    {/* 공휴일 이름 */}
                    {holidayName && (
                      <span style={{ color: 'var(--color-text-red)', minWidth: 0, overflow: 'hidden' }} title={holidayName}>
                        <Text type="supporting" color="inherit" maxLines={1}>{holidayName}</Text>
                      </span>
                    )}
                  </div>

                  {isCurrentMonth && isSingleRole && vacationersCount > 0 && (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 'var(--font-weight-semibold)',
                      padding: 'var(--spacing-0-5) var(--spacing-1-5)',
                      borderRadius: 'var(--radius-full)',
                      background: vacationersCount >= maxPeople ? 'var(--color-background-red)' : 'var(--color-background-teal)',
                      color: vacationersCount >= maxPeople ? 'var(--color-text-red)' : 'var(--color-text-teal)',
                    }}>
                      {vacationersCount}/{maxPeople}
                    </span>
                  )}
                </div>

                {/* 중요 행사 — 휴무자 목록 위에 붙여 이 날을 피하도록 알린다 */}
                {dayEvents.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 'var(--spacing-1)' }}>
                    {dayEvents.map((event) => (
                      <span
                        key={event.id}
                        title={event.description ? `${event.title} — ${event.description}` : event.title}
                        style={{
                          display: 'block',
                          padding: '1px var(--spacing-1)',
                          borderRadius: 'var(--radius-inner)',
                          background: 'var(--color-background-purple)',
                          color: 'var(--color-text-purple)',
                          fontSize: 'var(--font-size-xs)',
                          fontWeight: 'var(--font-weight-semibold)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        📌 {event.title}
                      </span>
                    ))}
                  </div>
                )}

                {isCurrentMonth && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-1)', maxHeight: isExpanded ? 'none' : COLLAPSED_LIST_MAX_HEIGHT, overflow: isExpanded ? undefined : 'hidden' }}>
                    {isLoading ? (
                      // 로딩 중일 때 스켈레톤 표시
                      <>
                        {[0, 1, 2].map((i) => (
                          <div key={i} className="skeleton" style={{ borderRadius: 'var(--radius-full)', width: '100%', height: 14 }}></div>
                        ))}
                      </>
                    ) : vacations && vacations.length > 0 ? (
                      // 데이터가 있을 때
                      <>
                        {vacations
                          .slice(0, isExpanded ? vacations.length : COLLAPSED_VISIBLE_COUNT)
                          .map((vacation, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center' }}>
                          <span style={cellStatusPillStyle(vacation.status)}>
                            <Text type="supporting" color="inherit">{getStatusText(vacation.status)}</Text>
                          </span>
                          {/* 이름을 누르면 그 사람 휴무만 필터링한다 (한 번 더 누르면 해제).
                              셀이 button이라 중첩 버튼은 만들 수 없어 마우스 클릭만 받고
                              전파를 끊는다 — 키보드로는 상단 직원 목록/검색으로 같은 필터가 가능하다. */}
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              if (vacation.userName) handleNameClick(vacation.userName);
                            }}
                            style={{
                              cursor: 'pointer',
                              flex: 1,
                              minWidth: 0,
                              lineHeight: 'var(--text-display-3-leading)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 'var(--spacing-1)',
                              color: vacation.status === 'rejected'
                                ? 'var(--color-text-red)'
                                : nameFilter === vacation.userName
                                  ? 'var(--color-text-teal)'
                                  : 'var(--color-text-primary)',
                              textDecoration: vacation.status === 'rejected' ? 'line-through' : undefined,
                            }}
                            title={vacation.userName || '이름 없음'}>
                            <span style={{ minWidth: 0, overflow: 'hidden' }}>
                              <Text type="supporting" color="inherit" weight={nameFilter === vacation.userName ? 'semibold' : 'normal'} maxLines={1}>
                                {vacation.userName || `이름 없음`}
                              </Text>
                            </span>
                            {(() => {
                              // 휴무 종류는 한 사람당 하나. 배지도 하나만 붙인다
                              const kind = resolveVacationKind(vacation.type, vacation.duration);
                              return (
                                <span style={circleBadgeStyle(kind.color, 12)} title={kind.label}>
                                  {kind.short}
                                </span>
                              );
                            })()}
                            {nameFilter === vacation.userName && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, color: 'var(--color-text-teal)' }}>
                                <Icon icon="check" size="xsm" color="inherit" />
                              </span>
                            )}
                          </span>

                        </div>
                        ))}
                        {!isExpanded && vacations.length > COLLAPSED_VISIBLE_COUNT && (
                          <div style={{ marginTop: 'var(--spacing-0-5)', color: 'var(--color-text-gray)' }}>
                            <Text type="supporting" color="inherit" weight="medium">+{vacations.length - COLLAPSED_VISIBLE_COUNT}명 더</Text>
                          </div>
                        )}
                      </>
                    ) : null}
                  </div>
                )}

                {isCurrentMonth && isSingleRole && vacationersCount > 0 && (
                  <div style={{ position: 'absolute', bottom: 6, right: 6 }}>
                    {vacationersCount >= maxPeople ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: 'var(--radius-full)', background: 'var(--color-background-red)', color: 'var(--color-text-red)' }}>
                        <Icon icon={FiAlertCircle} size="xsm" color="inherit" />
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: 'var(--radius-full)', background: 'var(--color-background-teal)', color: 'var(--color-text-teal)' }}>
                        <Icon icon="check" size="xsm" color="inherit" />
                      </div>
                    )}
                  </div>
                )}

                {isSelected && (
                  <div style={{ position: 'absolute', inset: 0, border: '2px solid var(--color-border-teal)', borderRadius: 'var(--radius-inner)', pointerEvents: 'none' }}></div>
                )}
              </motion.button>
            );
          })}
        </motion.div>
      </div>

      <div style={{ padding: '14px var(--spacing-5)', borderTop: '1px solid var(--color-border)', background: 'var(--color-background-card)' }}>
        <div style={{ marginBottom: 'var(--spacing-2)' }}>
          <Text type="supporting" color="secondary" weight="medium">상태 표시</Text>
        </div>
        <HStack gap={4} vAlign="center" wrap="wrap">
          {/* 인원 상태 */}
          <HStack gap={1.5} vAlign="center">
            <span style={{ width: 12, height: 12, background: 'var(--color-background-teal)', borderRadius: 'var(--radius-full)' }} />
            <Text type="supporting" color="secondary">여유</Text>
          </HStack>
          <HStack gap={1.5} vAlign="center">
            <span style={{ width: 12, height: 12, background: 'var(--color-background-red)', borderRadius: 'var(--radius-full)' }} />
            <Text type="supporting" color="secondary">마감</Text>
          </HStack>

          {/* 구분선 */}
          <span style={{ width: 1, height: 12, background: 'var(--color-background-muted)' }} />

          {/* 승인 상태 */}
          <HStack gap={1.5} vAlign="center">
            <span style={{ padding: 'var(--spacing-0-5) var(--spacing-1-5)', background: 'var(--color-background-teal)', color: 'var(--color-text-teal)', borderRadius: 'var(--radius-full)', fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)' }}>승인</span>
            <Text type="supporting" color="secondary">승인됨</Text>
          </HStack>
          <HStack gap={1.5} vAlign="center">
            <span style={{ padding: 'var(--spacing-0-5) var(--spacing-1-5)', background: 'var(--color-background-yellow)', color: 'var(--color-text-yellow)', borderRadius: 'var(--radius-full)', fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)' }}>대기</span>
            <Text type="supporting" color="secondary">대기중</Text>
          </HStack>
          <HStack gap={1.5} vAlign="center">
            <span style={{ padding: 'var(--spacing-0-5) var(--spacing-1-5)', background: 'var(--color-background-red)', color: 'var(--color-text-red)', borderRadius: 'var(--radius-full)', fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)' }}>거절</span>
            <Text type="supporting" color="secondary">거부됨</Text>
          </HStack>

          {/* 구분선 */}
          <span style={{ width: 1, height: 12, background: 'var(--color-background-muted)' }} />

          {/* 휴무 종류 — 표는 types/vacation.ts 한 곳에서 온다 */}
          {VACATION_KIND_OPTIONS.map((kind) => (
            <HStack key={kind.value} gap={1.5} vAlign="center">
              <span style={circleBadgeStyle(kind.color, 14)}>{kind.short}</span>
              <Text type="supporting" color="secondary">{kind.label}</Text>
            </HStack>
          ))}
        </HStack>
      </div>

      {isAdmin && showAdminPanel && (
        <AdminPanel
          currentDate={selectedDate || currentDate}
          onClose={handleCloseAdminPanel}
          onUpdateSuccess={async () => {
            await fetchCalendarData(currentDate);
            // 마감일 지정도 이 패널에서 저장되므로 별표 표시를 갱신한다
            loadDeadlineDates();
          }}
        />
      )}

      {isAdmin && showEventModal && (
        <VacationEventModal
          currentDate={currentDate}
          onClose={() => setShowEventModal(false)}
          onChanged={loadEvents}
        />
      )}

      {/* 월 선택 모달 */}
      <Dialog
        isOpen={showMonthPicker}
        onOpenChange={(open) => { if (!open) setShowMonthPicker(false); }}
        purpose="info"
        width={440}
      >
        <Layout
          header={
            <DialogHeader
              title="월 선택"
              onOpenChange={(open) => { if (!open) setShowMonthPicker(false); }}
            />
          }
          content={
            <LayoutContent>
              <VStack gap={6}>
                {(() => {
                  const { years, months } = generateMonthPickerData();

                  return (
                    <>
                      {/* 연도 선택 섹션 */}
                      <VStack gap={3}>
                        <Text type="label" weight="medium" color="primary">연도 선택</Text>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--spacing-2)' }}>
                          {years.map((year) => (
                            <Button
                              key={year}
                              label={`${year}년`}
                              variant={year === selectedYear ? 'primary' : 'secondary'}
                              size="sm"
                              onClick={() => handleYearSelect(year)}
                            />
                          ))}
                        </div>
                      </VStack>

                      {/* 월 선택 섹션 */}
                      <VStack gap={3}>
                        <Text type="label" weight="medium" color="primary">월 선택</Text>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--spacing-2)' }}>
                          {months.map((month, index) => (
                            <Button
                              key={month}
                              label={month}
                              variant={index === selectedMonth ? 'primary' : 'secondary'}
                              size="sm"
                              onClick={() => handleMonthClick(index)}
                            />
                          ))}
                        </div>
                      </VStack>
                    </>
                  );
                })()}
              </VStack>
            </LayoutContent>
          }
          footer={
            <LayoutFooter hasDivider>
              <HStack gap={2} hAlign="between" width="100%">
                <Button
                  label="오늘로 이동"
                  variant="secondary"
                  onClick={() => {
                    const today = new Date();
                    setSelectedYear(today.getFullYear());
                    setSelectedMonth(today.getMonth());
                  }}
                />
                <Button
                  label={`${selectedYear}년 ${selectedMonth + 1}월 선택`}
                  variant="primary"
                  onClick={handleApplyDateSelection}
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>

      {/* 관리자 직원 휴무 추가 모달 */}
      <AdminVacationAddModal
        isOpen={showAdminVacationModal}
        onClose={() => setShowAdminVacationModal(false)}
        onSuccess={() => {
          setShowAdminVacationModal(false);
          handleRefresh();
        }}
        selectedDate={selectedDate}
      />
    </div>
  );
};

export default VacationCalendar; 
