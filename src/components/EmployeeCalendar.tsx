'use client';

import { useState, useEffect, useMemo } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday } from 'date-fns';
import { ko } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { getVacationCalendar, requestVacation } from '@/lib/apiService';
import { DayInfo, VacationRequest, VacationDuration, VACATION_DURATION_OPTIONS } from '@/types/vacation';
import { useAlert } from './Alert';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export default function EmployeeCalendar() {
  const { showAlert, AlertContainer } = useAlert();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [vacationDays, setVacationDays] = useState<Record<string, DayInfo>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dayVacations, setDayVacations] = useState<VacationRequest[]>([]);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [requestForm, setRequestForm] = useState({
    date: '',
    duration: 'FULL_DAY' as VacationDuration,
    reason: '',
  });

  const userName = typeof window !== 'undefined' ? localStorage.getItem('userName') : null;

  // 달력 날짜 계산
  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const days = eachDayOfInterval({ start, end });

    // 첫 주 시작 요일에 맞춰 빈 칸 추가
    const startDay = start.getDay();
    const paddedDays: (Date | null)[] = Array(startDay).fill(null);

    return [...paddedDays, ...days];
  }, [currentDate]);

  // 휴가 데이터 로드
  useEffect(() => {
    loadVacations();
  }, [currentDate]);

  const loadVacations = async () => {
    setIsLoading(true);
    try {
      const startDate = format(startOfMonth(currentDate), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(currentDate), 'yyyy-MM-dd');
      const data = await getVacationCalendar(startDate, endDate);

      // API 응답 구조에 맞게 파싱
      const days: Record<string, DayInfo> = {};
      const dates = data.dates || data || {};

      Object.keys(dates).forEach((dateKey) => {
        const dateData = dates[dateKey];
        if (dateData) {
          const vacationsList = Array.isArray(dateData.vacations) ? dateData.vacations : [];
          days[dateKey] = {
            date: dateKey,
            count: dateData.totalVacationers || vacationsList.length,
            people: vacationsList,
            vacations: vacationsList,
          };
        }
      });

      setVacationDays(days);
    } catch (error) {
      console.error('휴가 데이터 로드 실패:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 날짜에 해당하는 전체 휴가 정보 가져오기
  const getVacationsForDate = (date: Date): VacationRequest[] => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const dayInfo = vacationDays[dateKey];
    return dayInfo?.vacations || [];
  };

  // 날짜에 해당하는 내 휴가 정보 가져오기
  const getMyVacationsForDate = (date: Date): VacationRequest[] => {
    const vacations = getVacationsForDate(date);
    return vacations.filter(v => v.userName === userName);
  };

  // 날짜 클릭 핸들러
  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    const vacations = getVacationsForDate(date);
    setDayVacations(vacations);
  };

  // 이전/다음 달 이동
  const goToPrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const goToNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  // 휴무 신청 모달 열기
  const openRequestModal = (date?: Date) => {
    const targetDate = date || selectedDate || new Date();
    setRequestForm({
      date: format(targetDate, 'yyyy-MM-dd'),
      duration: 'FULL_DAY',
      reason: '',
    });
    setShowRequestModal(true);
  };

  // 휴무 신청 제출
  const handleSubmitRequest = async () => {
    if (!requestForm.date) {
      showAlert({ type: 'error', title: '입력 오류', message: '날짜를 선택해주세요.' });
      return;
    }

    setIsSubmitting(true);
    try {
      await requestVacation({
        date: requestForm.date,
        duration: requestForm.duration,
        reason: requestForm.reason || undefined,
      });

      showAlert({ type: 'success', title: '신청 완료', message: '휴무 신청이 접수되었습니다.' });
      setShowRequestModal(false);
      loadVacations();
    } catch (error) {
      console.error('휴무 신청 실패:', error);
      showAlert({ type: 'error', title: '신청 실패', message: '휴무 신청에 실패했습니다.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 휴가 상태에 따른 스타일
  const getVacationStyle = (status: string) => {
    const lowerStatus = status?.toLowerCase();
    switch (lowerStatus) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'rejected':
        return 'bg-red-100 text-red-800 line-through';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const getVacationStatusText = (status: string) => {
    const lowerStatus = status?.toLowerCase();
    switch (lowerStatus) {
      case 'approved':
        return '승인됨';
      case 'pending':
        return '대기중';
      case 'rejected':
        return '반려됨';
      case 'unused':
        return ''; // unused는 표시하지 않음
      default:
        return '';
    }
  };

  // 상태 라벨 텍스트 (달력 셀용) - 관리자 달력과 동일
  const getStatusShortText = (status: string) => {
    const lowerStatus = status?.toLowerCase();
    switch (lowerStatus) {
      case 'approved':
        return '승인됨';
      case 'pending':
        return '대기중';
      case 'rejected':
        return '거절됨';
      default:
        return null; // unused 등은 null 반환
    }
  };

  // 상태에 따른 라벨 스타일
  const getStatusLabelStyle = (status: string) => {
    const lowerStatus = status?.toLowerCase();
    switch (lowerStatus) {
      case 'approved':
        return 'bg-green-100 text-green-600';
      case 'pending':
        return 'bg-yellow-100 text-yellow-600';
      case 'rejected':
        return 'bg-red-100 text-red-600';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const getDurationText = (duration: string) => {
    switch (duration?.toUpperCase()) {
      case 'FULL_DAY':
        return '종일';
      case 'HALF_DAY_AM':
        return '오전 반차';
      case 'HALF_DAY_PM':
        return '오후 반차';
      case 'UNUSED':
        return ''; // UNUSED는 표시하지 않음
      default:
        return '';
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

  // 휴가 기간이 유효한지 확인하는 함수 (UNUSED는 제외)
  const isValidDuration = (duration?: string) => {
    if (!duration) return false;
    const upper = duration.toUpperCase();
    return ['FULL_DAY', 'HALF_DAY_AM', 'HALF_DAY_PM'].includes(upper);
  };

  const getRoleText = (role?: string) => {
    switch (role) {
      case 'caregiver':
        return '요양보호사';
      case 'office':
        return '사무직';
      default:
        return role || '직원';
    }
  };

  return (
    <>
      <AlertContainer />
      <div className="space-y-6">
        {/* 캘린더 카드 */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          {/* 캘린더 헤더 */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <h2 className="text-2xl font-bold text-gray-900">
                  {format(currentDate, 'yyyy년 M월', { locale: ko })}
                </h2>
                <button
                  onClick={goToToday}
                  className="px-3 py-1.5 text-sm font-medium bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  오늘
                </button>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className={`flex items-center justify-center px-4 py-2 rounded-lg transition-all font-medium shadow-sm ${
                    isExpanded
                      ? 'bg-purple-600 text-white hover:bg-purple-700'
                      : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                  }`}
                >
                  {isExpanded ? '접기' : '펼치기'}
                </button>
                <button
                  onClick={() => openRequestModal()}
                  className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  <span>휴무 신청</span>
                </button>
                <div className="flex items-center border border-gray-200 rounded-lg">
                  <button
                    onClick={goToPrevMonth}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-l-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={goToNextMonth}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-r-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 border-b border-gray-100">
            {WEEKDAYS.map((day, index) => (
              <div
                key={day}
                className={`py-3 text-center text-sm font-semibold ${
                  index === 0 ? 'text-red-500' : index === 6 ? 'text-blue-500' : 'text-gray-600'
                }`}
              >
                {day}
              </div>
            ))}
          </div>

          {/* 캘린더 그리드 */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <svg className="animate-spin h-10 w-10 text-blue-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : (
            <div className="grid grid-cols-7">
              {calendarDays.map((date, index) => {
                if (!date) {
                  return <div key={`empty-${index}`} className={`${isExpanded ? 'min-h-[100px]' : 'aspect-square'} border-b border-r border-gray-50`} />;
                }

                // 휴가 데이터 가져오기
                const allVacations = getVacationsForDate(date);
                const vacations = allVacations;
                const myVacations = vacations.filter(v => v.userName === userName);
                const hasVacation = vacations.length > 0;
                const _hasMyVacation = myVacations.length > 0; // 향후 사용을 위해 유지
                const isSelected = selectedDate && isSameDay(date, selectedDate);
                const dayOfWeek = date.getDay();

                return (
                  <button
                    key={format(date, 'yyyy-MM-dd')}
                    onClick={() => handleDateClick(date)}
                    className={`${isExpanded ? 'min-h-[100px]' : 'aspect-square'} p-1 border-b border-r border-gray-50 transition-all duration-200 hover:bg-blue-50 relative ${
                      !isSameMonth(date, currentDate) ? 'opacity-30' : ''
                    } ${isSelected ? 'bg-blue-50 ring-2 ring-blue-400 ring-inset' : ''} ${
                      isToday(date) ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="h-full flex flex-col">
                      <span
                        className={`text-sm font-medium ${
                          isToday(date)
                            ? 'bg-blue-600 text-white w-7 h-7 rounded-full flex items-center justify-center mx-auto'
                            : dayOfWeek === 0
                            ? 'text-red-500'
                            : dayOfWeek === 6
                            ? 'text-blue-500'
                            : 'text-gray-900'
                        }`}
                      >
                        {format(date, 'd')}
                      </span>
                      {hasVacation && (
                        <div className={`flex-1 mt-1 space-y-0.5 ${isExpanded ? '' : 'overflow-hidden'}`}>
                          {vacations.slice(0, isExpanded ? vacations.length : 3).map((vacation, i) => (
                            <div
                              key={vacation.id || i}
                              className="flex items-center text-[8px] sm:text-xs"
                              title={`${vacation.userName} - ${getDurationText(vacation.duration)} - ${getVacationStatusText(vacation.status)}${vacation.type === 'mandatory' ? ' (필수)' : ''}`}
                            >
                              {/* 상태 라벨 (관리자와 동일) */}
                              {getStatusShortText(vacation.status) && (
                                <span className={`flex-shrink-0 whitespace-nowrap text-[6px] sm:text-[10px] mr-1 px-1 py-0.5 rounded-full ${getStatusLabelStyle(vacation.status)}`}>
                                  {getStatusShortText(vacation.status)}
                                </span>
                              )}
                              {/* 이름 + 배지 (관리자와 동일) */}
                              <span className={`flex-1 leading-tight flex items-center gap-1 ${
                                vacation.userName === userName
                                  ? 'text-blue-600 font-semibold'
                                  : 'text-gray-800'
                              }`}>
                                <span className="truncate">{vacation.userName}</span>
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
                              </span>
                            </div>
                          ))}
                          {!isExpanded && vacations.length > 3 && (
                            <div className="text-[8px] sm:text-xs text-gray-500 mt-0.5 font-medium">
                              +{vacations.length - 3}명 더
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 선택된 날짜 상세 */}
        {selectedDate && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden"
          >
            <div className="p-6 border-b border-gray-100">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {format(selectedDate, 'M월 d일 (EEEE)', { locale: ko })}
                </h3>
                <p className="text-gray-500 text-sm mt-1">
                  {dayVacations.length}명 휴무
                </p>
              </div>
            </div>

            <div className="p-6">
              {/* 휴가 목록 표시 */}
              {(() => {
                const filteredVacations = dayVacations;
                return filteredVacations.length > 0 ? (
                <div className="space-y-3">
                  {filteredVacations.map((vacation, index) => {
                    const isMyVacation = vacation.userName === userName;
                    return (
                      <div
                        key={vacation.id || index}
                        className={`p-4 rounded-xl border ${
                          isMyVacation
                            ? 'bg-blue-50 border-blue-200'
                            : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                              isMyVacation ? 'bg-blue-600' : 'bg-gray-400'
                            }`}>
                              {vacation.userName?.charAt(0) || '?'}
                            </div>
                            <div>
                              <div className="flex items-center space-x-2">
                                {/* 상태 라벨 (이름 왼쪽에 표시) - 관리자 달력처럼 */}
                                {!isMyVacation && getStatusShortText(vacation.status) && (
                                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${getStatusLabelStyle(vacation.status)}`}>
                                    {getStatusShortText(vacation.status)}
                                  </span>
                                )}
                                <span className="font-semibold text-gray-900">
                                  {vacation.userName}
                                  {isMyVacation && <span className="text-blue-600 text-sm ml-1">(나)</span>}
                                </span>
                                {isValidDuration(vacation.duration) && (
                                  <span className={`w-5 h-5 rounded-full ${getDurationColorClass(vacation.duration)} text-white text-[10px] font-bold flex items-center justify-center`}>
                                    {getDurationShortText(vacation.duration)}
                                  </span>
                                )}
                                {vacation.type === 'mandatory' && (
                                  <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                                    필
                                  </span>
                                )}
                                <span className="text-xs text-gray-500">
                                  {getRoleText(vacation.role)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-gray-500">{getDurationText(vacation.duration)}</span>
                                {vacation.reason && (
                                  <span className="text-sm text-gray-600">• {vacation.reason}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-bold ${getVacationStyle(vacation.status)}`}
                          >
                            {getVacationStatusText(vacation.status)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-gray-500 font-medium">이 날에 등록된 휴무가 없습니다</p>
                  <p className="text-gray-400 text-sm mt-1">휴무 신청 버튼을 눌러 휴무를 신청하세요</p>
                </div>
              );
              })()}
            </div>
          </motion.div>
        )}

        {/* 범례 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-sm">
            {/* 휴가 유형 */}
            <div className="flex items-center">
              <span className="w-4 h-4 rounded-full bg-blue-500 text-white text-[8px] font-bold flex items-center justify-center mr-1.5">연</span>
              <span className="text-gray-600">연차</span>
            </div>
            <div className="flex items-center">
              <span className="w-4 h-4 rounded-full bg-green-500 text-white text-[8px] font-bold flex items-center justify-center mr-1.5">반</span>
              <span className="text-gray-600">반차</span>
            </div>
            <div className="flex items-center">
              <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center mr-1.5">필</span>
              <span className="text-gray-600">필수 휴무</span>
            </div>
            <div className="border-l border-gray-200 h-4 mx-2"></div>
            {/* 상태 */}
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 rounded bg-blue-500"></div>
              <span className="text-gray-700 font-medium">내 휴무</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 rounded bg-green-100 border border-green-200"></div>
              <span className="text-gray-600">승인됨</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 rounded bg-yellow-100 border border-yellow-200"></div>
              <span className="text-gray-600">대기중</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 rounded bg-red-100 border border-red-200"></div>
              <span className="text-gray-600">반려됨</span>
            </div>
          </div>
        </div>
      </div>

      {/* 휴무 신청 모달 */}
      <AnimatePresence>
        {showRequestModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowRequestModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">휴무 신청</h2>
                    <p className="text-gray-500 text-sm mt-1">휴무를 신청합니다</p>
                  </div>
                  <button
                    onClick={() => setShowRequestModal(false)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                {/* 날짜 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    날짜 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={requestForm.date}
                    onChange={(e) => setRequestForm(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* 휴무 유형 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    휴무 유형 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={requestForm.duration}
                    onChange={(e) => setRequestForm(prev => ({ ...prev, duration: e.target.value as VacationDuration }))}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {VACATION_DURATION_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.displayName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 사유 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    사유 (선택)
                  </label>
                  <textarea
                    value={requestForm.reason}
                    onChange={(e) => setRequestForm(prev => ({ ...prev, reason: e.target.value }))}
                    placeholder="휴무 사유를 입력해주세요"
                    rows={3}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  />
                </div>
              </div>

              <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end space-x-3">
                <button
                  onClick={() => setShowRequestModal(false)}
                  className="px-4 py-2 text-gray-600 font-medium hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleSubmitRequest}
                  disabled={isSubmitting || !requestForm.date}
                  className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    '신청하기'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
