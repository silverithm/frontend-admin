'use client';
import React, { useState, useEffect, useMemo, useCallback, SetStateAction, useRef } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay, addDays, getDay, startOfWeek, endOfWeek, isBefore, startOfDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { DayInfo, VacationRequest, VacationLimit, VacationData, CalendarProps } from '@/types/vacation';
import AdminPanel from './AdminPanel';
import CalendarSkeleton from './CalendarSkeleton';
import { FiChevronLeft, FiChevronRight, FiX, FiCalendar, FiRefreshCw, FiAlertCircle, FiCheck, FiUser, FiBriefcase, FiUsers, FiArrowLeft, FiArrowRight, FiSettings, FiChevronDown, FiClock, FiSun, FiSunrise, FiSunset, FiCamera } from 'react-icons/fi';
import * as htmlToImage from 'html-to-image';

import { getVacationCalendar, getVacationForDate } from '@/lib/apiService';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

interface VacationCalendarProps extends CalendarProps {
  currentDate: Date;
  setCurrentDate: (date: Date | SetStateAction<Date>) => void;
  roleFilter?: 'all' | 'caregiver' | 'office';
  nameFilter?: string | null;
  onShowLimitPanel?: () => void;
  onNameFilterChange?: (name: string | null) => void;
  sortOrder?: 'latest' | 'oldest' | 'vacation-date-asc' | 'vacation-date-desc' | 'name' | 'role';
}

const VacationCalendar: React.FC<VacationCalendarProps> = ({
  onDateSelect,
  onRequestSelect,
  isAdmin = false,
  maxPeopleAllowed = 5,
  currentDate,
  setCurrentDate,
  roleFilter = 'all',
  nameFilter = null,
  onShowLimitPanel,
  onNameFilterChange,
  sortOrder = 'latest',
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
          return roleFilter === 'all' || v.role === roleFilter || v.role === 'all';
        });
        
        if (filteredVacations.length > 0) {
          const vacationersInfo = filteredVacations.map(v => 
            `${v.userName}(${v.role}, ${v.status})`
          ).join(', ');
        }
      }
    });
  }, [calendarData, roleFilter]);
  
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
      const data = await getVacationForDate(formattedDate, roleFilter === 'all' ? 'caregiver' : roleFilter, nameFilter || undefined);
      

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

  const getDayColor = (date: Date) => {
    if (!isSameMonth(date, currentDate)) {
      return {
        bg: 'bg-gray-50',
        text: 'text-gray-300',
        border: 'border-transparent'
      };
    }

    // 전체 필터일 때는 무색, 단 오늘 날짜는 파란색
    if (roleFilter === 'all') {
      if (isToday(date)) {
        return {
          bg: 'bg-blue-50',
          text: 'text-blue-700',
          border: 'border-blue-400',
          today: true
        };
      }
      return {
        bg: 'bg-transparent',
        text: 'text-black',
        border: 'border-transparent'
      };
    }

    const dateKey = format(date, 'yyyy-MM-dd');
    const dayData = calendarData[dateKey];
    const filteredVacations = getDayVacations(date);
    const vacationersCount = filteredVacations.length;
    const maxPeople = dayData?.maxPeople ?? 3;
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;

    if (isToday(date)) {
      return {
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        border: 'border-blue-400',
        today: true
      };
    }

    if (vacationersCount < maxPeople) {
      return {
        bg: 'bg-green-100 hover:bg-green-200',
        text: isWeekend ? (date.getDay() === 0 ? 'text-red-600' : 'text-indigo-600') : 'text-green-800',
        border: 'border-transparent',
        status: '여유'
      };
    } else {
      return {
        bg: 'bg-red-100 hover:bg-red-200',
        text: isWeekend ? (date.getDay() === 0 ? 'text-red-600' : 'text-indigo-600') : 'text-red-700',
        border: 'border-transparent',
        status: '마감'
      };
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
    
    if (roleFilter !== 'all') {
      vacations = vacations.filter(vacation => vacation.role === roleFilter);
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
          // 요양보호사를 먼저, 그 다음 사무직
          const roleOrder = { caregiver: 0, office: 1 };
          const aOrder = roleOrder[a.role as keyof typeof roleOrder] ?? 2;
          const bOrder = roleOrder[b.role as keyof typeof roleOrder] ?? 2;
          
          if (aOrder !== bOrder) {
            return aOrder - bOrder;
          }
          // 같은 직무 내에서는 이름순
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

  // 휴가 기간에 따른 색상 클래스 반환
  const getDurationColorClass = (duration?: string) => {
    switch (duration) {
      case 'FULL_DAY':
        return 'bg-blue-500'; // 연차는 파란색
      case 'HALF_DAY_AM':
      case 'HALF_DAY_PM':
        return 'bg-green-500'; // 반차는 초록색
      default:
        return 'bg-blue-500';
    }
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
      case 'caregiver':
        return '요양보호사';
      case 'office':
        return '사무직';
      case 'admin':
        return '관리자';
      default:
        return role || '직원';
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
        backgroundColor: '#ffffff',
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
      successMessage.className = 'fixed top-20 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 transition-opacity duration-300';
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
      errorMessage.className = 'fixed top-20 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 transition-opacity duration-300';
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
    <div className="w-full bg-white rounded-xl shadow-lg overflow-hidden">
      {showMonthError && (
        <div className="p-3 m-3 bg-red-100 text-red-700 rounded-lg text-sm">
          <p className="font-medium">데이터 로드 오류</p>
          <p>요청한 월({format(currentDate, 'yyyy년 MM월')})의 데이터를 가져오지 못했습니다. 새로고침 버튼을 눌러 다시 시도해주세요.</p>
        </div>
      )}
      <div ref={calendarRef} className="p-3 sm:p-6 md:p-8 flex flex-col">
        <div className="flex justify-between items-center mb-3 sm:mb-6 md:mb-8">
          <div className="flex items-center space-x-1 sm:space-x-4">
            <div className="bg-blue-100 p-1 sm:p-2 rounded-full text-blue-600">
              <FiCalendar size={14} className="sm:w-5 sm:h-5" />
            </div>
            <div>
              <div className="text-base sm:text-2xl font-bold text-gray-800 flex items-center">
                {format(currentDate, 'yyyy년 MM월', { locale: ko })}
                <button
                  onClick={handleOpenMonthPicker}
                  className="ml-2 sm:ml-3 px-2 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-all duration-200 flex items-center space-x-1"
                >
                  <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="hidden sm:inline">월 선택</span>
                  <span className="sm:hidden">선택</span>
                </button>
              </div>
              <p className="text-[10px] sm:text-sm text-gray-500">
                휴무 일정 캘린더
              </p>
            </div>
          </div>

          <div className="flex space-x-0.5 sm:space-x-2">
            <button 
              onClick={prevMonth}
              className={`p-1 sm:p-2 rounded-lg transition-all duration-300 ${
               'hover:bg-gray-100 text-gray-600'
              }`}
              aria-label="이전 달"
            >
              <FiChevronLeft size={14} className="sm:w-5 sm:h-5" />
            </button>
            <button 
              onClick={resetToCurrentMonth}
              className={`p-1 sm:p-2 rounded-lg transition-all duration-300 ${
               'bg-blue-50 hover:bg-blue-100 text-blue-600'
              }`}
              aria-label="이번 달로 돌아가기"
            >
              <FiCalendar size={12} className="sm:w-[18px] sm:h-[18px]" />
            </button>
            <button 
              onClick={nextMonth}
              className={`p-1 sm:p-2 rounded-lg transition-all duration-300 ${
                  'hover:bg-gray-100 text-gray-600'
              }`}
              aria-label="다음 달"
            >
              <FiChevronRight size={14} className="sm:w-5 sm:h-5" />
            </button>
            <button
              onClick={handleRefresh}
              className={`p-1 sm:p-2 rounded-lg transition-all duration-300 ${
                'bg-green-50 hover:bg-green-100 text-green-600'
              }`}
              aria-label="데이터 새로고침"
            >
              <FiRefreshCw size={12} className={`${isLoading ? 'animate-spin' : ''}`} />
            </button>
            {isAdmin && onShowLimitPanel && (
              <button
                onClick={onShowLimitPanel}
                className={`px-3 sm:px-4 py-1.5 sm:py-2.5 rounded-lg transition-all duration-300 text-xs sm:text-sm font-medium ${
                  'bg-indigo-50 hover:bg-indigo-100 text-indigo-600 hover:scale-105'
                }`}
                aria-label="휴무 제한 설정"
              >
                <span className="hidden sm:inline">휴무 제한 설정</span>
                <span className="sm:hidden">제한 설정</span>
              </button>
            )}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={`px-3 sm:px-4 py-1.5 sm:py-2.5 rounded-lg transition-all duration-300 text-xs sm:text-sm font-medium ${
                isLoading
                  ? 'bg-purple-50 text-purple-300 cursor-not-allowed'
                  : isExpanded
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-purple-50 hover:bg-purple-100 text-purple-600 hover:scale-105'
              }`}
              aria-label={isExpanded ? "접기" : "펼치기"}
            >
              <span className="hidden sm:inline">{isExpanded ? "접기" : "펼치기"}</span>
              <span className="sm:hidden">{isExpanded ? "접기" : "펼치기"}</span>
            </button>
            {isExpanded && (
              <button
                onClick={handleCapture}
                disabled={isCapturing || isLoading}
                className={`px-3 sm:px-4 py-1.5 sm:py-2.5 rounded-lg transition-all duration-300 text-xs sm:text-sm font-medium flex items-center gap-1 ${
                  isCapturing
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-orange-50 hover:bg-orange-100 text-orange-600 hover:scale-105'
                }`}
                aria-label="캘린더 캡처"
                title="펼쳐진 캘린더를 이미지로 저장합니다"
              >
                {isCapturing ? (
                  <>
                    <svg className="animate-spin h-3 w-3 sm:h-4 sm:w-4 text-orange-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="hidden sm:inline">캡처 중...</span>
                  </>
                ) : (
                  <>
                    <FiCamera size={14} className="sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">캡처</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* 인터랙티브 캘린더 */}
        <div className="grid grid-cols-7 border-b border-gray-200">
          {WEEKDAYS.map((day, index) => (
            <div 
              key={day} 
              className={`py-0.5 sm:py-2 text-center font-medium text-[8px] sm:text-sm ${
                index === 0 ? 'text-red-500' : 
                index === 6 ? 'text-indigo-500' : 'text-gray-600'
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        <motion.div 
          className="grid grid-cols-7 gap-x-1 gap-y-3 sm:gap-x-4 sm:gap-y-5 md:gap-x-5 md:gap-y-6"
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
            
            return (
              <motion.div
                key={index}
                variants={fadeInVariants}
                onClick={() => handleDateClick(day)}
                className={`p-1 sm:p-3 ${
                  isExpanded 
                    ? 'min-h-[80px] sm:min-h-[200px] md:min-h-[240px]'
                    : 'min-h-[60px] sm:min-h-[120px] md:min-h-[140px]'
                } rounded-lg sm:rounded-xl relative cursor-pointer transition-all ${
                  !isCurrentMonth ? 'opacity-40' : ''
                } ${isSelected ? 'ring-2 ring-blue-500 scale-[1.02] shadow-md z-10' : ''}
                ${dayColor.bg}
                ${isPast ? 'cursor-not-allowed opacity-60' : ''}
                hover:shadow-sm ${isExpanded ? '' : 'overflow-hidden'}`}
              >
                <div className={`flex justify-between items-start mb-1`}>
                  <div className={`text-xs sm:text-sm md:text-base font-semibold ${
                    isSunday ? 'text-red-500' : 
                    isSaturday ? 'text-blue-500' : 
                    'text-black'}
                  `}>
                    {format(day, 'd')}
                    {isCurrentDay && (
                      <span className="ml-0.5 sm:ml-1 inline-flex h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-blue-500"></span>
                    )}
                  </div>
                  
                  {isCurrentMonth && roleFilter !== 'all' && (
                    <span className={`
                      text-[8px] sm:text-xs md:text-sm font-medium px-1 sm:px-1.5 py-0.5 rounded-full inline-flex items-center
                      ${
                        vacationersCount >= maxPeople
                          ? 'bg-red-100 text-red-600' 
                          : 'bg-green-100 text-green-600'
                      }
                    `}>
                      {vacationersCount}/{maxPeople}
                    </span>
                  )}
                </div>
                
                {isCurrentMonth && (
                  <div className={`space-y-0.5 sm:space-y-1 ${
                    isExpanded 
                      ? 'max-h-none' 
                      : 'max-h-20 sm:max-h-20 md:max-h-28 overflow-hidden'
                  }`}>
                    {isLoading ? (
                      // 로딩 중일 때 스켈레톤 표시
                      <>
                        {[0, 1, 2].map((i) => (
                          <div key={i} className="skeleton rounded-full w-full h-3 sm:h-4"></div>
                        ))}
                      </>
                    ) : vacations && vacations.length > 0 ? (
                      // 데이터가 있을 때
                      <>
                        {vacations
                          .slice(0, isExpanded ? vacations.length : 4)
                          .map((vacation, idx) => (
                        <div key={idx} className="flex items-center text-[8px] sm:text-xs md:text-sm">
                          <span className={`flex-shrink-0 whitespace-nowrap text-[6px] sm:text-[10px] md:text-xs mr-1 px-1 py-0.5 rounded-full
                            ${vacation.status === 'approved' 
                              ? 'bg-green-100 text-green-600' 
                              : vacation.status === 'rejected'
                              ? 'bg-red-100 text-red-600'
                              : 'bg-yellow-100 text-yellow-600'}`}>
                            {getStatusText(vacation.status)}
                          </span>
                          <span className={`flex-1 leading-tight flex items-center gap-1 ${
                            vacation.status === 'rejected'
                              ? 'text-red-600 line-through'
                              : nameFilter === vacation.userName
                                ? 'text-blue-600 font-semibold cursor-pointer hover:text-blue-800'
                                : 'text-gray-800 cursor-pointer hover:text-blue-600'
                          }`}
                          title={vacation.userName || '이름 없음'}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (vacation.userName) {
                              handleNameClick(vacation.userName);
                            }
                          }}>
                            <span className="truncate">{vacation.userName || `이름 없음`}</span>
                            {isValidDuration(vacation.duration) && (
                              <span className={`w-3 h-3 rounded-full ${getDurationColorClass(vacation.duration)} text-white text-[8px] font-bold flex items-center justify-center flex-shrink-0`}>
                                {getDurationShortText(vacation.duration)}
                              </span>
                            )}
                            {vacation.type === 'mandatory' && (
                              <span className="w-3 h-3 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center flex-shrink-0">
                                필
                              </span>
                            )}
                            {nameFilter === vacation.userName && (
                              <span className="inline-flex items-center flex-shrink-0">
                                <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </span>
                            )}
                          </span>

                        </div>
                        ))}
                        {!isExpanded && vacations.length > 4 && (
                          <div className="text-[8px] sm:text-xs md:text-sm text-gray-500 mt-0.5 font-medium">
                            +{vacations.length - 4}명 더
                          </div>
                        )}
                      </>
                    ) : null}
                  </div>
                )}
                
                {isCurrentMonth && roleFilter !== 'all' && (
                  <div className="absolute bottom-0 sm:bottom-1 right-0 sm:right-1.5">
                    {vacationersCount >= maxPeople ? (
                      <div className="text-[6px] sm:text-xs bg-red-500 text-white rounded-full w-2 h-2 sm:w-4 sm:h-4 flex items-center justify-center">
                        <FiAlertCircle size={6} className="sm:w-[10px] sm:h-[10px]" />
                      </div>
                    ) : (
                      <div className="text-[6px] sm:text-xs bg-green-500 text-white rounded-full w-2 h-2 sm:w-4 sm:h-4 flex items-center justify-center">
                        <FiCheck size={6} className="sm:w-[10px] sm:h-[10px]" />
                      </div>
                    )}
                  </div>
                )}
                
                {isSelected && (
                  <div className="absolute inset-0 border-1 sm:border-2 border-blue-500 rounded-lg sm:rounded-xl pointer-events-none"></div>
                )}
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      <div className="px-4 sm:px-6 md:px-8 py-3 sm:py-4 border-t border-gray-100">
        <p className="text-xs sm:text-sm md:text-base text-gray-500 mb-2 sm:mb-3 font-medium">상태 표시</p>
        <div className="flex flex-wrap gap-2 sm:gap-4 md:gap-6 items-center">
          {/* 인원 상태 */}
          <div className="flex items-center">
            <div className="w-3 h-3 sm:w-4 sm:h-4 bg-green-500 rounded-full mr-1 sm:mr-1.5"></div>
            <span className="text-xs sm:text-sm text-gray-600">여유</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 sm:w-4 sm:h-4 bg-red-500 rounded-full mr-1 sm:mr-1.5"></div>
            <span className="text-xs sm:text-sm text-gray-600">마감</span>
          </div>
          
          {/* 구분선 */}
          <div className="w-px h-4 bg-gray-300"></div>
          
          {/* 승인 상태 */}
          <div className="flex items-center">
            <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-600 rounded-full mr-1 sm:mr-1.5">승인</span>
            <span className="text-xs sm:text-sm text-gray-600">승인됨</span>
          </div>
          <div className="flex items-center">
            <span className="text-xs px-1.5 py-0.5 bg-yellow-100 text-yellow-600 rounded-full mr-1 sm:mr-1.5">대기</span>
            <span className="text-xs sm:text-sm text-gray-600">대기중</span>
          </div>
          <div className="flex items-center">
            <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full mr-1 sm:mr-1.5">거절</span>
            <span className="text-xs sm:text-sm text-gray-600">거부됨</span>
          </div>
          
          {/* 구분선 */}
          <div className="w-px h-4 bg-gray-300"></div>
          
          {/* 휴가 유형 */}
          <div className="flex items-center">
            <span className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-blue-500 text-white text-[6px] sm:text-[8px] font-bold flex items-center justify-center mr-1 sm:mr-1.5">연</span>
            <span className="text-xs sm:text-sm text-gray-600">연차</span>
          </div>
          <div className="flex items-center">
            <span className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-green-500 text-white text-[6px] sm:text-[8px] font-bold flex items-center justify-center mr-1 sm:mr-1.5">반</span>
            <span className="text-xs sm:text-sm text-gray-600">반차</span>
          </div>
          <div className="flex items-center">
            <span className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-red-500 text-white text-[6px] sm:text-[8px] font-bold flex items-center justify-center mr-1 sm:mr-1.5">필</span>
            <span className="text-xs sm:text-sm text-gray-600">필수 휴무</span>
          </div>
        </div>
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
      <AnimatePresence>
        {showMonthPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
            onClick={() => setShowMonthPicker(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-900">월 선택</h3>
                  <button
                    onClick={() => setShowMonthPicker(false)}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <FiX size={20} />
                  </button>
                </div>
                
                <div className="max-h-96 overflow-y-auto">
                  <div className="space-y-6">
                    {(() => {
                      const { years, months } = generateMonthPickerData();
                      const currentYear = currentDate.getFullYear();
                      const currentMonth = currentDate.getMonth();
                      
                      return (
                        <>
                          {/* 연도 선택 섹션 */}
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-3">연도 선택</h4>
                            <div className="grid grid-cols-4 gap-2">
                              {years.map((year) => (
                                <button
                                  key={year}
                                  onClick={() => handleYearSelect(year)}
                                  className={`p-3 text-sm font-medium rounded-lg transition-all duration-200 ${
                                    year === selectedYear
                                      ? 'bg-blue-600 text-white shadow-lg ring-2 ring-blue-300'
                                      : year === currentYear
                                        ? 'bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100'
                                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                                  }`}
                                >
                                  {year}년
                                </button>
                              ))}
                            </div>
                          </div>
                          
                          {/* 월 선택 섹션 */}
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-3">월 선택</h4>
                            <div className="grid grid-cols-4 gap-2">
                              {months.map((month, index) => (
                                <button
                                  key={month}
                                  onClick={() => handleMonthClick(index)}
                                  className={`p-3 text-sm font-medium rounded-lg transition-all duration-200 ${
                                    index === selectedMonth
                                      ? 'bg-blue-600 text-white shadow-lg ring-2 ring-blue-300'
                                      : index === currentMonth && selectedYear === currentYear
                                        ? 'bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100'
                                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                                  }`}
                                >
                                  {month}
                                </button>
                              ))}
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
                
                {/* 액션 버튼들 */}
                <div className="pt-4 border-t border-gray-200 flex gap-3">
                  <button
                    onClick={() => {
                      const today = new Date();
                      setSelectedYear(today.getFullYear());
                      setSelectedMonth(today.getMonth());
                    }}
                    className="flex-1 p-3 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200"
                  >
                    오늘로 이동
                  </button>
                  <button
                    onClick={handleApplyDateSelection}
                    className="flex-1 p-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors duration-200 shadow-sm"
                  >
                    {selectedYear}년 {selectedMonth + 1}월 선택
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VacationCalendar; 