'use client';

import { useState, useEffect, useMemo, CSSProperties } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday } from 'date-fns';
import { ko } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { Button } from '@astryxdesign/core/Button';
import { Text } from '@astryxdesign/core/Text';
import { Icon } from '@astryxdesign/core/Icon';
import { Badge } from '@astryxdesign/core/Badge';
import { Spinner } from '@astryxdesign/core/Spinner';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { DateInput } from '@astryxdesign/core/DateInput';
import { Selector } from '@astryxdesign/core/Selector';
import { TextArea } from '@astryxdesign/core/TextArea';
import type { ISODateString } from '@astryxdesign/core/Calendar';
import { getVacationCalendar, requestVacation, getVacationLimits } from '@/lib/apiService';
import { DayInfo, VacationRequest, VacationLimit, VacationDuration, VACATION_DURATION_OPTIONS } from '@/types/vacation';
import { useAlert } from './Alert';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const CARD_STYLE: CSSProperties = {
  background: 'var(--color-background-card)',
  borderRadius: 12,
  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
  border: '1px solid var(--color-border)',
  overflow: 'hidden',
};

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
  const [vacationLimits, setVacationLimits] = useState<Record<string, VacationLimit>>({});

  const [userName] = useState(() => typeof window !== 'undefined' ? localStorage.getItem('userName') : null);

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
      const [data, limitsData] = await Promise.all([
        getVacationCalendar(startDate, endDate),
        getVacationLimits(startDate, endDate).catch(() => ({ limits: {} })),
      ]);

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

      // 휴무 제한 데이터 파싱
      const limits = limitsData.limits || limitsData || {};
      setVacationLimits(limits);
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

  // 휴가 상태에 따른 Badge variant
  const getVacationBadgeVariant = (status: string): 'success' | 'warning' | 'error' | 'neutral' => {
    const lowerStatus = status?.toLowerCase();
    switch (lowerStatus) {
      case 'approved':
        return 'success';
      case 'pending':
        return 'warning';
      case 'rejected':
        return 'error';
      default:
        return 'neutral';
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
  const getStatusLabelStyle = (status: string): CSSProperties => {
    const lowerStatus = status?.toLowerCase();
    switch (lowerStatus) {
      case 'approved':
        return { backgroundColor: '#dcfce7', color: '#16a34a' };
      case 'pending':
        return { backgroundColor: '#fef9c3', color: '#ca8a04' };
      case 'rejected':
        return { backgroundColor: '#fee2e2', color: '#dc2626' };
      default:
        return { backgroundColor: 'var(--color-background-muted)', color: 'var(--color-text-gray)' };
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

  // 휴가 기간에 따른 색상 반환
  const getDurationColor = (duration?: string): string => {
    switch (duration) {
      case 'FULL_DAY':
        return '#14b8a6'; // 연차는 teal
      case 'HALF_DAY_AM':
      case 'HALF_DAY_PM':
        return '#22c55e'; // 반차는 초록색
      default:
        return '#14b8a6';
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

  // 특정 날짜의 휴무 제한 정보 가져오기
  const getLimitsForDate = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const limits: VacationLimit[] = [];
    Object.keys(vacationLimits).forEach((key) => {
      const limit = vacationLimits[key];
      if (limit && limit.date === dateKey) {
        limits.push(limit);
      }
    });
    // vacationLimits가 날짜키로 직접 저장된 경우
    const directLimit = vacationLimits[dateKey];
    if (directLimit && !limits.find(l => l.date === dateKey && l.role === directLimit.role)) {
      if (typeof directLimit === 'object' && directLimit.date) {
        limits.push(directLimit);
      }
    }
    return limits;
  };

  // 날짜의 전체 최대 인원 가져오기
  const getMaxPeopleForDate = (date: Date): number | null => {
    const limits = getLimitsForDate(date);
    if (limits.length === 0) return null;
    return limits.reduce((sum, l) => sum + (l.maxPeople || 0), 0);
  };

  // 셀 안의 작은 상태 라벨 스타일
  const cellStatusPillStyle = (status: string): CSSProperties => ({
    ...getStatusLabelStyle(status),
    flexShrink: 0,
    whiteSpace: 'nowrap',
    marginRight: 4,
    padding: '1px 4px',
    borderRadius: 9999,
  });

  // 셀 안의 원형 배지 스타일
  const circleBadgeStyle = (bg: string, size: number): CSSProperties => ({
    width: size,
    height: size,
    borderRadius: '50%',
    background: bg,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontSize: size <= 12 ? 8 : 10,
    fontWeight: 700,
  });

  return (
    <>
      <AlertContainer />
      <VStack gap={6}>
        {/* 캘린더 카드 */}
        <div style={CARD_STYLE}>
          {/* 캘린더 헤더 */}
          <div style={{ padding: 20, borderBottom: '1px solid var(--color-border)' }}>
            <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
              <HStack gap={3} vAlign="center">
                <Text type="display-3" as="h2" weight="bold" color="primary">
                  {format(currentDate, 'yyyy년 M월', { locale: ko })}
                </Text>
                <Button label="오늘" variant="secondary" size="sm" onClick={goToToday} />
              </HStack>
              <HStack gap={2} vAlign="center">
                <Button
                  label={isExpanded ? '접기' : '펼치기'}
                  variant={isExpanded ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                />
                <Button
                  label="휴무 신청"
                  variant="primary"
                  size="sm"
                  icon={<Icon icon="calendar" size="sm" />}
                  onClick={() => openRequestModal()}
                />
                <HStack gap={1} vAlign="center">
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
                </HStack>
              </HStack>
            </HStack>
          </div>

          {/* 요일 헤더 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--color-border)' }}>
            {WEEKDAYS.map((day, index) => (
              <div
                key={day}
                style={{
                  padding: '12px 0',
                  textAlign: 'center',
                  color: index === 0 ? '#ef4444' : index === 6 ? '#3b82f6' : '#4b5563',
                }}
              >
                <Text type="label" weight="semibold" color="inherit">{day}</Text>
              </div>
            ))}
          </div>

          {/* 캘린더 그리드 */}
          {isLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
              <Spinner size="lg" aria-label="달력 불러오는 중" />
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {calendarDays.map((date, index) => {
                if (!date) {
                  return (
                    <div
                      key={`empty-${index}`}
                      style={{
                        minHeight: isExpanded ? 100 : undefined,
                        aspectRatio: isExpanded ? undefined : '1 / 1',
                        borderBottom: '1px solid var(--color-border)',
                        borderRight: '1px solid var(--color-border)',
                      }}
                    />
                  );
                }

                // 휴가 데이터 가져오기
                const allVacations = getVacationsForDate(date);
                const vacations = allVacations;
                const myVacations = vacations.filter(v => v.userName === userName);
                const hasVacation = vacations.length > 0;
                const _hasMyVacation = myVacations.length > 0; // 향후 사용을 위해 유지
                const isSelected = selectedDate && isSameDay(date, selectedDate);
                const dayOfWeek = date.getDay();

                const dayNumberStyle: CSSProperties = isToday(date)
                  ? {
                      background: '#14b8a6',
                      color: '#fff',
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto',
                    }
                  : dayOfWeek === 0
                  ? { color: '#ef4444' }
                  : dayOfWeek === 6
                  ? { color: '#3b82f6' }
                  : { color: 'var(--color-text-primary)' };

                return (
                  <button
                    key={format(date, 'yyyy-MM-dd')}
                    onClick={() => handleDateClick(date)}
                    className="carev-empcal-cell"
                    style={{
                      minHeight: isExpanded ? 100 : undefined,
                      aspectRatio: isExpanded ? undefined : '1 / 1',
                      padding: 4,
                      border: 'none',
                      borderBottom: '1px solid var(--color-border)',
                      borderRight: '1px solid var(--color-border)',
                      position: 'relative',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 200ms',
                      opacity: !isSameMonth(date, currentDate) ? 0.3 : 1,
                      background: isSelected || isToday(date) ? '#f0fdfa' : undefined,
                      boxShadow: isSelected ? 'inset 0 0 0 2px #2dd4bf' : undefined,
                    }}
                  >
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                      <span style={dayNumberStyle}>
                        <Text type="label" weight="medium" color="inherit">{format(date, 'd')}</Text>
                      </span>
                      {/* 휴무 제한 표시 */}
                      {(() => {
                        const maxPeople = getMaxPeopleForDate(date);
                        if (maxPeople !== null && maxPeople > 0) {
                          const currentCount = vacations.filter(v => v.status?.toLowerCase() === 'approved').length;
                          const isFull = currentCount >= maxPeople;
                          return (
                            <div style={{ padding: '0 4px', color: isFull ? '#ef4444' : '#9ca3af' }}>
                              <Text type="supporting" size="4xs" color="inherit">{currentCount}/{maxPeople}명</Text>
                            </div>
                          );
                        }
                        return null;
                      })()}
                      {hasVacation && (
                        <div
                          style={{
                            flex: 1,
                            marginTop: 4,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 2,
                            overflow: isExpanded ? undefined : 'hidden',
                          }}
                        >
                          {vacations.slice(0, isExpanded ? vacations.length : 3).map((vacation, i) => (
                            <div
                              key={vacation.id || i}
                              style={{ display: 'flex', alignItems: 'center' }}
                              title={`${vacation.userName} - ${getDurationText(vacation.duration)} - ${getVacationStatusText(vacation.status)}${vacation.type === 'mandatory' ? ' (필수)' : ''}`}
                            >
                              {/* 상태 라벨 (관리자와 동일) */}
                              {getStatusShortText(vacation.status) && (
                                <span style={cellStatusPillStyle(vacation.status)}>
                                  <Text type="supporting" size="4xs" color="inherit">{getStatusShortText(vacation.status)}</Text>
                                </span>
                              )}
                              {/* 이름 + 배지 (관리자와 동일) */}
                              <span
                                style={{
                                  flex: 1,
                                  lineHeight: 1.25,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  minWidth: 0,
                                  color: vacation.userName === userName ? '#0d9488' : '#1f2937',
                                }}
                              >
                                <span style={{ minWidth: 0, overflow: 'hidden' }}>
                                  <Text
                                    type="supporting"
                                    size="4xs"
                                    color="inherit"
                                    weight={vacation.userName === userName ? 'semibold' : 'normal'}
                                    maxLines={1}
                                  >
                                    {vacation.userName}
                                  </Text>
                                </span>
                                {isValidDuration(vacation.duration) && (
                                  <span style={circleBadgeStyle(getDurationColor(vacation.duration), 12)}>
                                    {getDurationShortText(vacation.duration)}
                                  </span>
                                )}
                                {vacation.type === 'mandatory' && (
                                  <span style={circleBadgeStyle('#ef4444', 12)}>필</span>
                                )}
                              </span>
                            </div>
                          ))}
                          {!isExpanded && vacations.length > 3 && (
                            <div style={{ marginTop: 2, color: 'var(--color-text-gray)' }}>
                              <Text type="supporting" size="4xs" color="inherit" weight="medium">+{vacations.length - 3}명 더</Text>
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
            style={CARD_STYLE}
          >
            <div style={{ padding: 20, borderBottom: '1px solid var(--color-border)' }}>
              <VStack gap={1}>
                <Text type="display-3" as="h3" weight="bold" color="primary">
                  {format(selectedDate, 'M월 d일 (EEEE)', { locale: ko })}
                </Text>
                <HStack gap={3} vAlign="center">
                  <Text type="supporting">{dayVacations.length}명 휴무</Text>
                  {(() => {
                    const maxPeople = getMaxPeopleForDate(selectedDate);
                    if (maxPeople !== null && maxPeople > 0) {
                      const approvedCount = dayVacations.filter(v => v.status?.toLowerCase() === 'approved').length;
                      const remaining = maxPeople - approvedCount;
                      return (
                        <Badge
                          variant={remaining <= 0 ? 'error' : 'teal'}
                          label={`제한 ${approvedCount}/${maxPeople}명 ${remaining <= 0 ? '(마감)' : `(${remaining}명 가능)`}`}
                        />
                      );
                    }
                    return null;
                  })()}
                </HStack>
              </VStack>
            </div>

            <div style={{ padding: 20 }}>
              {/* 휴가 목록 표시 */}
              {(() => {
                const filteredVacations = dayVacations;
                return filteredVacations.length > 0 ? (
                <VStack gap={3}>
                  {filteredVacations.map((vacation, index) => {
                    const isMyVacation = vacation.userName === userName;
                    return (
                      <div
                        key={vacation.id || index}
                        style={{
                          padding: 16,
                          borderRadius: 12,
                          background: isMyVacation ? '#f0fdfa' : '#f9fafb',
                          border: `1px solid ${isMyVacation ? '#99f6e4' : '#e5e7eb'}`,
                        }}
                      >
                        <HStack hAlign="between" vAlign="center" gap={3}>
                          <HStack gap={3} vAlign="center">
                            <span
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#fff',
                                fontWeight: 700,
                                flexShrink: 0,
                                background: isMyVacation ? '#14b8a6' : '#9ca3af',
                              }}
                            >
                              {vacation.userName?.charAt(0) || '?'}
                            </span>
                            <div>
                              <HStack gap={2} vAlign="center" wrap="wrap">
                                {/* 상태 라벨 (이름 왼쪽에 표시) - 관리자 달력처럼 */}
                                {!isMyVacation && getStatusShortText(vacation.status) && (
                                  <Badge variant={getVacationBadgeVariant(vacation.status)} label={getStatusShortText(vacation.status)} />
                                )}
                                <Text type="body" weight="semibold" color="primary">
                                  {vacation.userName}
                                  {isMyVacation && <Text type="supporting" color="accent">{' (나)'}</Text>}
                                </Text>
                                {isValidDuration(vacation.duration) && (
                                  <span style={circleBadgeStyle(getDurationColor(vacation.duration), 20)}>
                                    {getDurationShortText(vacation.duration)}
                                  </span>
                                )}
                                {vacation.type === 'mandatory' && (
                                  <span style={circleBadgeStyle('#ef4444', 20)}>필</span>
                                )}
                                <Text type="supporting">{getRoleText(vacation.role)}</Text>
                              </HStack>
                              <HStack gap={2} vAlign="center" wrap="wrap">
                                <Text type="supporting">{getDurationText(vacation.duration)}</Text>
                                {vacation.reason && (
                                  <Text type="supporting" color="secondary">• {vacation.reason}</Text>
                                )}
                              </HStack>
                            </div>
                          </HStack>
                          {getVacationStatusText(vacation.status) && (
                            <Badge variant={getVacationBadgeVariant(vacation.status)} label={getVacationStatusText(vacation.status)} />
                          )}
                        </HStack>
                      </div>
                    );
                  })}
                </VStack>
              ) : (
                <div style={{ padding: '48px 0', textAlign: 'center' }}>
                    <Icon icon="calendar" size="lg" color="disabled" />
                    <div style={{ marginTop: 16 }}>
                      <Text type="body" weight="medium" color="secondary">이 날에 등록된 휴무가 없습니다</Text>
                    </div>
                    <div style={{ marginTop: 4 }}>
                      <Text type="supporting">휴무 신청 버튼을 눌러 휴무를 신청하세요</Text>
                    </div>
                  </div>
              );
              })()}
            </div>
          </motion.div>
        )}

        {/* 범례 */}
        <div style={{ ...CARD_STYLE, padding: 16 }}>
          <HStack gap={4} vAlign="center" hAlign="center" wrap="wrap">
            {/* 휴가 유형 */}
            <HStack gap={1.5} vAlign="center">
              <span style={circleBadgeStyle('#14b8a6', 16)}>연</span>
              <Text type="supporting" color="secondary">연차</Text>
            </HStack>
            <HStack gap={1.5} vAlign="center">
              <span style={circleBadgeStyle('#22c55e', 16)}>반</span>
              <Text type="supporting" color="secondary">반차</Text>
            </HStack>
            <HStack gap={1.5} vAlign="center">
              <span style={circleBadgeStyle('#ef4444', 16)}>필</span>
              <Text type="supporting" color="secondary">필수 휴무</Text>
            </HStack>
            <div style={{ borderLeft: '1px solid var(--color-border)', height: 16, margin: '0 8px' }} />
            {/* 상태 */}
            <HStack gap={2} vAlign="center">
              <div style={{ width: 16, height: 16, borderRadius: 4, background: '#14b8a6' }} />
              <Text type="supporting" color="secondary" weight="medium">내 휴무</Text>
            </HStack>
            <HStack gap={2} vAlign="center">
              <div style={{ width: 16, height: 16, borderRadius: 4, background: '#dcfce7', border: '1px solid #bbf7d0' }} />
              <Text type="supporting" color="secondary">승인됨</Text>
            </HStack>
            <HStack gap={2} vAlign="center">
              <div style={{ width: 16, height: 16, borderRadius: 4, background: '#fef9c3', border: '1px solid #fef08a' }} />
              <Text type="supporting" color="secondary">대기중</Text>
            </HStack>
            <HStack gap={2} vAlign="center">
              <div style={{ width: 16, height: 16, borderRadius: 4, background: '#fee2e2', border: '1px solid #fecaca' }} />
              <Text type="supporting" color="secondary">반려됨</Text>
            </HStack>
          </HStack>
        </div>
      </VStack>

      {/* 휴무 신청 모달 */}
      <Dialog
        isOpen={showRequestModal}
        onOpenChange={(open) => { if (!open) setShowRequestModal(false); }}
        purpose="form"
        width={440}
      >
        <Layout
          header={
            <DialogHeader
              title="휴무 신청"
              onOpenChange={(open) => { if (!open) setShowRequestModal(false); }}
            />
          }
          content={
            <LayoutContent>
              <VStack gap={4}>
                <DateInput
                  label="날짜"
                  isRequired
                  value={requestForm.date ? (requestForm.date as ISODateString) : undefined}
                  onChange={(value) => setRequestForm(prev => ({ ...prev, date: value || '' }))}
                />
                <Selector
                  label="휴무 유형"
                  isRequired
                  value={requestForm.duration}
                  options={VACATION_DURATION_OPTIONS.map((option) => ({ value: option.value, label: option.displayName }))}
                  onChange={(value) => setRequestForm(prev => ({ ...prev, duration: value as VacationDuration }))}
                />
                <TextArea
                  label="사유"
                  isOptional
                  value={requestForm.reason}
                  onChange={(value) => setRequestForm(prev => ({ ...prev, reason: value }))}
                  placeholder="휴무 사유를 입력해주세요"
                  rows={3}
                />
              </VStack>
            </LayoutContent>
          }
          footer={
            <LayoutFooter hasDivider>
              <HStack gap={2} hAlign="end">
                <Button label="취소" variant="ghost" onClick={() => setShowRequestModal(false)} />
                <Button
                  label="신청하기"
                  variant="primary"
                  isLoading={isSubmitting}
                  isDisabled={isSubmitting || !requestForm.date}
                  onClick={handleSubmitRequest}
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>
    </>
  );
}
