'use client';
import React, { useState, useEffect, useMemo, useCallback, SetStateAction, useRef } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay, addDays, getDay, startOfWeek, endOfWeek, isBefore, startOfDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { DayInfo, VacationRequest, VacationLimit, VacationData, CalendarProps } from '@/types/vacation';
import AdminPanel from './AdminPanel';
import CalendarSkeleton from './CalendarSkeleton';
import AdminVacationAddModal from './AdminVacationAddModal';
import { FiChevronLeft, FiChevronRight, FiX, FiCalendar, FiRefreshCw, FiAlertCircle, FiCheck, FiUser, FiBriefcase, FiUsers, FiArrowLeft, FiArrowRight, FiSettings, FiChevronDown, FiClock, FiSun, FiSunrise, FiSunset, FiCamera, FiUserPlus } from 'react-icons/fi';
import * as htmlToImage from 'html-to-image';
import { Button } from '@astryxdesign/core/Button';
import { Text } from '@astryxdesign/core/Text';
import { Icon } from '@astryxdesign/core/Icon';
import { Badge } from '@astryxdesign/core/Badge';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';

import { getVacationCalendar, getVacationForDate } from '@/lib/apiService';
import {
  ALL_ROLE_FILTER,
  compareRoleNames,
  getRoleDisplayName,
  getVacationRequestRole,
  type RoleLookup,
} from '@/lib/roleUtils';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

interface VacationCalendarProps extends CalendarProps {
  currentDate: Date;
  setCurrentDate: (date: Date | SetStateAction<Date>) => void;
  roleFilter?: string;
  nameFilter?: string | null;
  onShowLimitPanel?: () => void;
  onNameFilterChange?: (name: string | null) => void;
  sortOrder?: 'latest' | 'oldest' | 'vacation-date-asc' | 'vacation-date-desc' | 'name' | 'role';
  memberRoleLookup?: RoleLookup;
}

const VacationCalendar: React.FC<VacationCalendarProps> = ({
  onDateSelect,
  onRequestSelect,
  isAdmin = false,
  maxPeopleAllowed = 5,
  currentDate,
  setCurrentDate,
  roleFilter = ALL_ROLE_FILTER,
  nameFilter = null,
  onShowLimitPanel,
  onNameFilterChange,
  sortOrder = 'latest',
  memberRoleLookup,
}) => {
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
  
  // 로그에 모든 휴가 데이터 출력
  const logAllVacations = useCallback(() => {
    if (Object.keys(calendarData).length === 0) {
      return;
    }
    
    Object.keys(calendarData).forEach(dateKey => {
      const dateData = calendarData[dateKey];
      if (dateData && dateData.vacations && dateData.vacations.length > 0) {
        // 필터에 맞는 휴가만 로깅
        const filteredVacations = dateData.vacations.filter(v => {
          const resolvedRole = getVacationRequestRole(v, memberRoleLookup);
          return roleFilter === ALL_ROLE_FILTER || resolvedRole === roleFilter;
        });
        
        if (filteredVacations.length > 0) {
          const vacationersInfo = filteredVacations.map(v => 
            `${v.userName}(${getVacationRequestRole(v, memberRoleLookup) || v.role}, ${v.status})`
          ).join(', ');
        }
      }
    });
  }, [calendarData, memberRoleLookup, roleFilter]);
  
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
      const data = await getVacationCalendar(startDateStr, endDateStr, roleFilter, nameFilter || undefined);

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
  }, [roleFilter, MAX_RETRY_COUNT, MAX_RETRY_DELAY, nameFilter]);

  const fetchSelectedDateData = async (date: Date) => {
    try {
      const formattedDate = format(date, 'yyyy-MM-dd');


      // apiService의 getVacationForDate 함수 사용 (토큰 갱신 로직 포함)
      const data = await getVacationForDate(formattedDate, roleFilter === ALL_ROLE_FILTER ? ALL_ROLE_FILTER : roleFilter, nameFilter || undefined);
      

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
    logAllVacations();
  }, [fetchCalendarData, currentDate, logAllVacations]);

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
  }, [roleFilter, nameFilter, fetchCalendarData, currentDate]);

  useEffect(() => {
    setRetryCount(0);
    setShowMonthError(false);
  }, [currentDate]);

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
  const getDayColor = (date: Date): { bg: string; hoverBg: string; today?: boolean; status?: string } => {
    if (!isSameMonth(date, currentDate)) {
      return { bg: 'var(--color-background-muted)', hoverBg: '#f3f4f6' };
    }

    // 전체 필터일 때는 무색, 단 오늘 날짜는 강조색
    if (roleFilter === ALL_ROLE_FILTER) {
      if (isToday(date)) {
        return { bg: 'var(--color-background-teal)', hoverBg: '#f3f4f6', today: true };
      }
      return { bg: 'transparent', hoverBg: '#f3f4f6' };
    }

    const dateKey = format(date, 'yyyy-MM-dd');
    const dayData = calendarData[dateKey];
    const filteredVacations = getDayVacations(date);
    const vacationersCount = filteredVacations.length;
    const maxPeople = dayData?.maxPeople ?? 3;

    if (isToday(date)) {
      return { bg: 'var(--color-background-teal)', hoverBg: '#f3f4f6', today: true };
    }

    if (vacationersCount < maxPeople) {
      return { bg: 'var(--color-background-green)', hoverBg: '#bbf7d0', status: '여유' };
    } else {
      return { bg: 'var(--color-background-red)', hoverBg: '#fecaca', status: '마감' };
    }
  };

  const selectedDateInfo = selectedDate
    ? calendarData[format(selectedDate, 'yyyy-MM-dd')]
    : null;

  const selectedVacations = selectedDateInfo?.vacations || [];

  const fadeInVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } }
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
    
    if (roleFilter !== ALL_ROLE_FILTER) {
      vacations = vacations.filter((vacation) => {
        const resolvedRole = getVacationRequestRole(vacation, memberRoleLookup);
        return resolvedRole === roleFilter;
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

  // 휴무 유형 한글 변환
  const getVacationTypeText = (type?: string) => {
    switch (type) {
      case 'regular':
        return '일반 휴무';
      case 'mandatory':
        return '필수 휴무';
      case 'personal':
        return '개인 휴무';
      case 'sick':
        return '병가';
      case 'emergency':
        return '긴급 휴무';
      case 'family':
        return '가족 돌봄 휴무';
      default:
        return type || '일반 휴무';
    }
  };

  // 휴가 기간을 짧게 표시하는 함수 (동그라미 안에 표시용)
  const getDurationShortText = (duration?: string) => {
    switch (duration) {
      case 'FULL_DAY':
        return '연';
      case 'HALF_DAY_AM':
        return '반';
      case 'HALF_DAY_PM':
        return '반';
      default:
        return '연';
    }
  };

  // 휴가 기간에 따른 색상 반환 (인라인 style 값)
  const getDurationColor = (duration?: string): string => {
    switch (duration) {
      case 'FULL_DAY':
        return '#3b82f6'; // 연차는 파란색
      case 'HALF_DAY_AM':
      case 'HALF_DAY_PM':
        return '#22c55e'; // 반차는 초록색
      default:
        return '#3b82f6';
    }
  };

  // 셀 안의 원형 배지 스타일
  const circleBadgeStyle = (bg: string, size: number): React.CSSProperties => ({
    width: size,
    height: size,
    borderRadius: '50%',
    background: bg,
    color: '#fff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontSize: size <= 12 ? 8 : 10,
    fontWeight: 700,
  });

  // 셀 안의 상태 라벨(pill) 스타일
  const cellStatusPillStyle = (status?: string): React.CSSProperties => {
    const base: React.CSSProperties = {
      flexShrink: 0,
      whiteSpace: 'nowrap',
      marginRight: 4,
      padding: '2px 4px',
      borderRadius: 9999,
      fontWeight: 500,
    };
    if (status === 'approved') return { ...base, backgroundColor: 'var(--color-background-teal)', color: 'var(--color-text-teal)' };
    if (status === 'rejected') return { ...base, backgroundColor: 'var(--color-background-red)', color: 'var(--color-text-red)' };
    return { ...base, backgroundColor: 'var(--color-background-yellow)', color: 'var(--color-text-yellow)' };
  };

  // 휴가 기간이 유효한지 확인하는 함수
  const isValidDuration = (duration?: string) => {
    return duration && ['FULL_DAY', 'HALF_DAY_AM', 'HALF_DAY_PM'].includes(duration);
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

  // 역할 한글 변환
  const getRoleText = (role?: string) => {
    switch (role) {
      default:
        return getRoleDisplayName(role);
    }
  };

  // 캘린더 캡처 기능
  const handleCapture = async () => {
    if (!calendarRef.current || !isExpanded) return;
    
    setIsCapturing(true);
    
    try {
      // 현재 보이는 달력 전체를 캡처 (인터랙티브 달력)
      const captureElement = calendarRef.current;
      
      // html-to-image를 사용하여 캡처
      const dataUrl = await htmlToImage.toPng(captureElement, {
        backgroundColor: 'var(--color-background-card)',
        pixelRatio: 2,
        canvasWidth: captureElement.offsetWidth * 2,
        canvasHeight: captureElement.offsetHeight * 2,
        style: {
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: '14px',
        },
        filter: (node: HTMLElement) => {
          // 버튼과 불필요한 요소 제외
          if (node.tagName === 'BUTTON') {
            return false;
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
      successMessage.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);background:#16a34a;color:#fff;padding:12px 24px;border-radius:8px;box-shadow:0 10px 15px -3px rgba(0,0,0,0.1);z-index:500;transition:opacity 300ms;';
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
      errorMessage.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);background:#dc2626;color:#fff;padding:12px 24px;border-radius:8px;box-shadow:0 10px 15px -3px rgba(0,0,0,0.1);z-index:500;transition:opacity 300ms;';
      document.body.appendChild(errorMessage);
      
      setTimeout(() => {
        errorMessage.style.opacity = '0';
        setTimeout(() => {
          document.body.removeChild(errorMessage);
        }, 300);
      }, 3000);
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <div style={{ width: '100%', background: 'var(--color-background-card)', border: '1px solid var(--color-border)', borderRadius: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
      {showMonthError && (
        <div style={{ margin: 12, padding: 12, background: 'var(--color-background-red)', border: '1px solid #fecaca', borderRadius: 8, color: 'var(--color-text-red)' }}>
          <VStack gap={0.5}>
            <Text type="label" weight="semibold" color="inherit">데이터 로드 오류</Text>
            <Text type="supporting" color="inherit">
              요청한 월({format(currentDate, 'yyyy년 MM월')})의 데이터를 가져오지 못했습니다. 새로고침 버튼을 눌러 다시 시도해주세요.
            </Text>
          </VStack>
        </div>
      )}
      <div ref={calendarRef} style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
        <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2} width="100%">
          <HStack gap={2} vAlign="center">
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-background-teal)', padding: 8, borderRadius: 8, color: 'var(--color-text-teal)' }}>
              <Icon icon="calendar" size="sm" color="inherit" />
            </span>
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
            <span style={{ width: 1, height: 20, background: 'var(--color-background-muted)', margin: '0 4px' }} />
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
                  variant="secondary"
                  size="sm"
                  onClick={onShowLimitPanel}
                />
                <Button
                  label="직원 휴무 추가"
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--color-border)', marginBottom: 4 }}>
          {WEEKDAYS.map((day, index) => (
            <div
              key={day}
              style={{ padding: '10px 0', textAlign: 'center', color: index === 0 ? '#f87171' : index === 6 ? '#60a5fa' : '#9ca3af' }}
            >
              <Text type="label" weight="medium" color="inherit">{day}</Text>
            </div>
          ))}
        </div>

        <motion.div
          style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px 4px' }}
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

            let dayColor = getDayColor(day);
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayData = calendarData[dateKey];
            const vacations = getDayVacations(day);
            const vacationersCount = vacations.length;
            const maxPeople = dayData?.maxPeople ?? 3;

            const cellStyle = {
              padding: 8,
              borderRadius: 8,
              position: 'relative',
              cursor: 'pointer',
              transition: 'background-color 200ms',
              border: isSelected ? '1px solid #99f6e4' : '1px solid transparent',
              background: isSelected ? 'rgba(240,253,250,0.5)' : dayColor.bg,
              boxShadow: isSelected ? '0 0 0 2px #14b8a6, 0 1px 2px rgba(0,0,0,0.05)' : undefined,
              opacity: !isCurrentMonth ? 0.3 : (isPast && isCurrentMonth ? 0.7 : 1),
              overflow: isExpanded ? undefined : 'hidden',
              zIndex: isSelected ? 10 : undefined,
              ['--carev-cell-hover']: dayColor.hoverBg,
            } as React.CSSProperties;

            return (
              <motion.div
                key={index}
                variants={fadeInVariants}
                onClick={() => handleDateClick(day)}
                className={`${isExpanded ? 'carev-vaccal-cell-expanded' : 'carev-vaccal-cell'}${!isSelected ? ' carev-vaccal-hover' : ''}`}
                style={cellStyle}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    {isCurrentDay ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', background: 'var(--color-background-teal)', color: '#fff' }}>
                        <Text type="label" weight="bold" color="inherit">{format(day, 'd')}</Text>
                      </span>
                    ) : (
                      <span style={{ color: !isCurrentMonth ? '#d1d5db' : isSunday ? '#ef4444' : isSaturday ? '#3b82f6' : '#111827' }}>
                        <Text type="label" weight="semibold" color="inherit">{format(day, 'd')}</Text>
                      </span>
                    )}
                  </div>

                  {isCurrentMonth && roleFilter !== ALL_ROLE_FILTER && vacationersCount > 0 && (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      fontSize: 10,
                      fontWeight: 600,
                      padding: '2px 6px',
                      borderRadius: 9999,
                      background: vacationersCount >= maxPeople ? '#ef4444' : '#f0fdfa',
                      color: vacationersCount >= maxPeople ? '#fff' : '#0d9488',
                    }}>
                      {vacationersCount}/{maxPeople}
                    </span>
                  )}
                </div>

                {isCurrentMonth && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: isExpanded ? 'none' : 112, overflow: isExpanded ? undefined : 'hidden' }}>
                    {isLoading ? (
                      // 로딩 중일 때 스켈레톤 표시
                      <>
                        {[0, 1, 2].map((i) => (
                          <div key={i} className="skeleton" style={{ borderRadius: 9999, width: '100%', height: 14 }}></div>
                        ))}
                      </>
                    ) : vacations && vacations.length > 0 ? (
                      // 데이터가 있을 때
                      <>
                        {vacations
                          .slice(0, isExpanded ? vacations.length : 4)
                          .map((vacation, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center' }}>
                          <span style={cellStatusPillStyle(vacation.status)}>
                            <Text type="supporting" size="4xs" color="inherit">{getStatusText(vacation.status)}</Text>
                          </span>
                          <span
                            style={{
                              flex: 1,
                              minWidth: 0,
                              lineHeight: 1.25,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              cursor: vacation.status === 'rejected' ? 'default' : 'pointer',
                              color: vacation.status === 'rejected'
                                ? '#f87171'
                                : nameFilter === vacation.userName
                                  ? '#0d9488'
                                  : '#374151',
                              textDecoration: vacation.status === 'rejected' ? 'line-through' : undefined,
                            }}
                            title={vacation.userName || '이름 없음'}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (vacation.userName) {
                                handleNameClick(vacation.userName);
                              }
                            }}>
                            <span style={{ minWidth: 0, overflow: 'hidden' }}>
                              <Text type="supporting" size="4xs" color="inherit" weight={nameFilter === vacation.userName ? 'semibold' : 'normal'} maxLines={1}>
                                {vacation.userName || `이름 없음`}
                              </Text>
                            </span>
                            {isValidDuration(vacation.duration) && (
                              <span style={circleBadgeStyle(getDurationColor(vacation.duration), 12)}>
                                {getDurationShortText(vacation.duration)}
                              </span>
                            )}
                            {vacation.type === 'mandatory' && (
                              <span style={circleBadgeStyle('#ef4444', 12)}>
                                필
                              </span>
                            )}
                            {nameFilter === vacation.userName && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, color: 'var(--color-text-teal)' }}>
                                <Icon icon="check" size="xsm" color="inherit" />
                              </span>
                            )}
                          </span>

                        </div>
                        ))}
                        {!isExpanded && vacations.length > 4 && (
                          <div style={{ marginTop: 2, color: 'var(--color-text-gray)' }}>
                            <Text type="supporting" size="4xs" color="inherit" weight="medium">+{vacations.length - 4}명 더</Text>
                          </div>
                        )}
                      </>
                    ) : null}
                  </div>
                )}

                {isCurrentMonth && roleFilter !== ALL_ROLE_FILTER && vacationersCount > 0 && (
                  <div style={{ position: 'absolute', bottom: 6, right: 6 }}>
                    {vacationersCount >= maxPeople ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: '50%', background: 'var(--color-background-red)', color: '#fff' }}>
                        <Icon icon={FiAlertCircle} size="xsm" color="inherit" />
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: '50%', background: 'var(--color-background-teal)', color: '#fff' }}>
                        <Icon icon="check" size="xsm" color="inherit" />
                      </div>
                    )}
                  </div>
                )}

                {isSelected && (
                  <div style={{ position: 'absolute', inset: 0, border: '2px solid #14b8a6', borderRadius: 8, pointerEvents: 'none' }}></div>
                )}
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      <div style={{ padding: '14px 20px', borderTop: '1px solid var(--color-border)', background: 'rgba(249,250,251,0.5)' }}>
        <div style={{ marginBottom: 10 }}>
          <Text type="supporting" color="secondary" weight="medium">상태 표시</Text>
        </div>
        <HStack gap={4} vAlign="center" wrap="wrap">
          {/* 인원 상태 */}
          <HStack gap={1.5} vAlign="center">
            <span style={{ width: 12, height: 12, background: 'var(--color-background-teal)', borderRadius: '50%' }} />
            <Text type="supporting" color="secondary">여유</Text>
          </HStack>
          <HStack gap={1.5} vAlign="center">
            <span style={{ width: 12, height: 12, background: 'var(--color-background-red)', borderRadius: '50%' }} />
            <Text type="supporting" color="secondary">마감</Text>
          </HStack>

          {/* 구분선 */}
          <span style={{ width: 1, height: 12, background: 'var(--color-background-muted)' }} />

          {/* 승인 상태 */}
          <HStack gap={1.5} vAlign="center">
            <span style={{ padding: '2px 6px', background: 'var(--color-background-teal)', color: 'var(--color-text-teal)', borderRadius: 9999, fontSize: 11, fontWeight: 500 }}>승인</span>
            <Text type="supporting" color="secondary">승인됨</Text>
          </HStack>
          <HStack gap={1.5} vAlign="center">
            <span style={{ padding: '2px 6px', background: 'var(--color-background-yellow)', color: 'var(--color-text-yellow)', borderRadius: 9999, fontSize: 11, fontWeight: 500 }}>대기</span>
            <Text type="supporting" color="secondary">대기중</Text>
          </HStack>
          <HStack gap={1.5} vAlign="center">
            <span style={{ padding: '2px 6px', background: 'var(--color-background-red)', color: 'var(--color-text-red)', borderRadius: 9999, fontSize: 11, fontWeight: 500 }}>거절</span>
            <Text type="supporting" color="secondary">거부됨</Text>
          </HStack>

          {/* 구분선 */}
          <span style={{ width: 1, height: 12, background: 'var(--color-background-muted)' }} />

          {/* 휴가 유형 */}
          <HStack gap={1.5} vAlign="center">
            <span style={circleBadgeStyle('#3b82f6', 14)}>연</span>
            <Text type="supporting" color="secondary">연차</Text>
          </HStack>
          <HStack gap={1.5} vAlign="center">
            <span style={circleBadgeStyle('#22c55e', 14)}>반</span>
            <Text type="supporting" color="secondary">반차</Text>
          </HStack>
          <HStack gap={1.5} vAlign="center">
            <span style={circleBadgeStyle('#ef4444', 14)}>필</span>
            <Text type="supporting" color="secondary">필수 휴무</Text>
          </HStack>
        </HStack>
      </div>

      {isAdmin && showAdminPanel && (
        <AdminPanel
          currentDate={selectedDate || currentDate}
          onClose={handleCloseAdminPanel}
          onUpdateSuccess={async () => {
            await fetchCalendarData(currentDate);
          }}
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
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
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
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
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
