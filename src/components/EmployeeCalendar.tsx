'use client';

import { useState, useEffect, useMemo, CSSProperties } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday } from 'date-fns';
import { ko } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { Button } from '@astryxdesign/core/Button';
import { Text } from '@astryxdesign/core/Text';
import { Icon } from '@astryxdesign/core/Icon';
import { Badge } from '@astryxdesign/core/Badge';
import { Loading } from '@/components/Loading';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { DateInput } from '@astryxdesign/core/DateInput';
import { Selector } from '@astryxdesign/core/Selector';
import { MultiSelector } from '@astryxdesign/core/MultiSelector';
import { TextArea } from '@astryxdesign/core/TextArea';
import { Avatar } from '@astryxdesign/core/Avatar';
import { Banner } from '@astryxdesign/core/Banner';
import type { ISODateString } from '@astryxdesign/core/Calendar';
import {
  getVacationCalendar,
  requestVacation,
  getVacationLimits,
  getVacationDeadlineSetting,
  getVacationDeadlineDates,
  getVacationEvents,
  type VacationEvent,
} from '@/lib/apiService';
import {
  VACATION_NOTICES,
  VACATION_NOTICE_LIST_CLASS,
  VACATION_NOTICE_LIST_STYLE,
  VACATION_NOTICE_TITLE,
} from '@/lib/vacationGuard';
import { getHolidayName } from '@/lib/holidays';
import {
  DayInfo,
  VacationRequest,
  VacationLimit,
  VacationKind,
  VACATION_KIND_OPTIONS,
  resolveVacationKind,
  toVacationRequestFields,
} from '@/types/vacation';
import { getRoleDisplayName } from '@/lib/roleUtils';
import { useAlert } from './Alert';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const CARD_STYLE: CSSProperties = {
  background: 'var(--color-background-card)',
  borderRadius: 'var(--radius-element)',
  boxShadow: 'var(--shadow-low)',
  border: '1px solid var(--color-border)',
  overflow: 'hidden',
};

export default function EmployeeCalendar() {
  const { showAlert, AlertContainer } = useAlert();
  const [currentDate, setCurrentDate] = useState(new Date());
  // 기관이 "다음 달 휴무만 신청받기"를 켰는지
  const [nextMonthOnly, setNextMonthOnly] = useState(false);
  // 제한이 걸렸을 때 신청 가능한 달 (오늘 기준 바로 다음 달)
  const nextMonthStart = useMemo(() => startOfMonth(addMonths(new Date(), 1)), []);
  const [vacationDays, setVacationDays] = useState<Record<string, DayInfo>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dayVacations, setDayVacations] = useState<VacationRequest[]>([]);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [requestForm, setRequestForm] = useState({
    date: '',
    kind: 'regular' as VacationKind,
    reason: '',
  });
  const [vacationLimits, setVacationLimits] = useState<Record<string, VacationLimit>>({});
  // 기관이 직접 지정한 월별 휴무 입력 마감일 — { "2026-08": "2026-08-16" }
  const [deadlineDates, setDeadlineDates] = useState<Record<string, string>>({});
  const [deadlineSetting, setDeadlineSetting] = useState<{ enabled: boolean; deadlineDay: number }>({ enabled: false, deadlineDay: 0 });
  // 이 달에 걸친 중요 행사 — 이 날짜는 휴무를 피하도록 안내한다
  const [events, setEvents] = useState<VacationEvent[]>([]);

  const [userName] = useState(() => typeof window !== 'undefined' ? localStorage.getItem('userName') : null);
  // 직종 필터 (중복 선택 가능, 빈 배열 = 전체) — 관리자 근무조정과 동일한 보기 기능
  const [roleFilters, setRoleFilters] = useState<string[]>([]);

  // 이번 달 휴무 데이터에 등장하는 직종 목록
  const availableRoles = useMemo(() => {
    const roles = new Set<string>();
    Object.values(vacationDays).forEach((day) => {
      (day.vacations || []).forEach((v) => {
        if (v.role) roles.add(v.role);
      });
    });
    return Array.from(roles).sort();
  }, [vacationDays]);

  const matchesRoleFilter = (role?: string) =>
    roleFilters.length === 0 || (role != null && roleFilters.includes(role));

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

  // 기관이 "다음 달만 신청" 제한을 켰는지 확인한다 (조회 실패 시 제한 없음으로 본다)
  useEffect(() => {
    getVacationDeadlineSetting()
      .then((data) => {
        setNextMonthOnly(Boolean(data?.nextMonthOnly));
        setDeadlineSetting({
          enabled: Boolean(data?.enabled),
          deadlineDay: Number(data?.deadlineDay) || 0,
        });
      })
      .catch(() => setNextMonthOnly(false));
    getVacationDeadlineDates()
      .then(setDeadlineDates)
      .catch(() => setDeadlineDates({}));
  }, []);

  // 보고 있는 달 휴무의 '신청 마감일' — 마감일은 그 전 달에 위치한다
  // (예: 9월 휴무 마감 = 8월 16일). 월별 지정이 있으면 그 날짜, 없으면 매월 고정일.
  const viewMonthDeadline = useMemo(() => {
    const prev = subMonths(startOfMonth(currentDate), 1);
    const prevKey = format(prev, 'yyyy-MM');
    const override = deadlineDates[prevKey];
    if (override) return new Date(`${override}T00:00:00`);
    if (!deadlineSetting.enabled || !deadlineSetting.deadlineDay) return null;
    const lastDay = endOfMonth(prev).getDate();
    return new Date(prev.getFullYear(), prev.getMonth(), Math.min(deadlineSetting.deadlineDay, lastDay));
  }, [currentDate, deadlineDates, deadlineSetting]);

  const viewMonthDeadlinePassed = useMemo(() => {
    if (!viewMonthDeadline) return false;
    const end = new Date(viewMonthDeadline);
    end.setHours(23, 59, 59, 999);
    return new Date() > end;
  }, [viewMonthDeadline]);

  // 중요 행사 — 달력 표시 + 신청 시 안내.
  // 다음 달 휴무를 신청하는 흐름이 많아 보고 있는 달 다음 달까지 함께 받아둔다.
  useEffect(() => {
    const start = format(startOfMonth(currentDate), 'yyyy-MM-dd');
    const end = format(endOfMonth(addMonths(currentDate, 1)), 'yyyy-MM-dd');
    getVacationEvents(start, end)
      .then(setEvents)
      .catch(() => setEvents([]));
  }, [currentDate]);

  /** 그날에 걸친 행사들 (기간 행사는 매일 표시) */
  const getEventsForDate = (date: Date) => {
    const key = format(date, 'yyyy-MM-dd');
    return events.filter((e) => e.startDate <= key && e.endDate >= key);
  };

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
    const vacations = dayInfo?.vacations || [];
    return roleFilters.length === 0
      ? vacations
      : vacations.filter((v) => matchesRoleFilter(v.role));
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

    // 기관이 제한을 걸었으면 다음 달 날짜만 받는다 (서버도 같은 규칙으로 한 번 더 막는다)
    if (nextMonthOnly && !isSameMonth(targetDate, nextMonthStart)) {
      showAlert({
        type: 'info',
        title: '신청할 수 없는 날짜입니다',
        message: `${format(nextMonthStart, 'yyyy년 M월', { locale: ko })} 휴무만 신청하실 수 있습니다.`,
      });
      return;
    }

    setRequestForm({
      date: format(targetDate, 'yyyy-MM-dd'),
      kind: 'regular',
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

    // 필수휴무는 다른 화면과 같은 규칙으로 사유를 받는다
    if (requestForm.kind === 'mandatory' && !requestForm.reason.trim()) {
      showAlert({ type: 'error', title: '입력 오류', message: '필수휴무는 사유를 입력해주세요.' });
      return;
    }

    setIsSubmitting(true);
    try {
      // 고른 종류 하나를 서버가 쓰는 type/duration으로 편다
      const { type, duration } = toVacationRequestFields(requestForm.kind);

      await requestVacation({
        date: requestForm.date,
        duration,
        reason: requestForm.reason || undefined,
        type,
      });

      showAlert({ type: 'success', title: '신청 완료', message: '휴무 신청이 접수되었습니다.' });
      setShowRequestModal(false);
      loadVacations();
    } catch (error) {
      console.error('휴무 신청 실패:', error);
      // 서버가 사유를 돌려주면(기간 제한 등) 그대로 보여준다 — 왜 막혔는지 알아야 다시 시도한다
      const message = error instanceof Error && error.message ? error.message : '휴무 신청에 실패했습니다.';
      showAlert({ type: 'error', title: '신청 실패', message });
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
  const getStatusShortText = (status: string): string | null => {
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

  const getRoleText = (role?: string) => getRoleDisplayName(role);

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

  return (
    <>
      <AlertContainer />
      <VStack gap={6}>
        {/* 신청 가능한 달이 제한돼 있으면 먼저 알려준다 — 눌러보고 막히는 것보다 낫다 */}
        {nextMonthOnly && (
          <Banner
            status="info"
            container="section"
            title={`${format(nextMonthStart, 'yyyy년 M월', { locale: ko })} 휴무만 신청하실 수 있습니다`}
            description="기관 설정에 따라 바로 다음 달 휴무만 받고 있습니다. 다른 달 휴무가 필요하시면 관리자에게 말씀해주세요."
          />
        )}

        {/* 보고 있는 달 휴무의 신청 마감 안내 — 마감일은 그 전 달에 있다 (9월 휴무 마감 = 8월 16일) */}
        {viewMonthDeadline && (
          <Banner
            status={viewMonthDeadlinePassed ? 'warning' : 'info'}
            container="section"
            title={viewMonthDeadlinePassed
              ? `${format(currentDate, 'M월', { locale: ko })} 휴무 신청이 ${format(viewMonthDeadline, 'M월 d일', { locale: ko })}에 마감됐습니다`
              : `${format(currentDate, 'M월', { locale: ko })} 휴무 신청 마감일: ${format(viewMonthDeadline, 'M월 d일', { locale: ko })}`}
            description={viewMonthDeadlinePassed
              ? '마감을 놓친 휴무는 관리자에게 문의해주세요.'
              : '마감일까지 근무표에 반영할 휴무를 신청해주세요.'}
          />
        )}

        {/* 캘린더 카드 */}
        <div style={CARD_STYLE}>
          {/* 캘린더 헤더 */}
          <div style={{ padding: 'var(--spacing-5)', borderBottom: '1px solid var(--color-border)' }}>
            <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
              <HStack gap={3} vAlign="center">
                <Text type="display-3" as="h2" weight="bold" color="primary">
                  {format(currentDate, 'yyyy년 M월', { locale: ko })}
                </Text>
                <Button label="오늘" variant="secondary" size="sm" onClick={goToToday} />
              </HStack>
              <HStack gap={2} vAlign="center">
                {availableRoles.length > 0 && (
                  <MultiSelector
                    label="직종 필터"
                    isLabelHidden
                    size="sm"
                    placeholder="전체 직종"
                    options={availableRoles.map((role) => ({ value: role, label: getRoleDisplayName(role) }))}
                    value={roleFilters}
                    onChange={(values) => setRoleFilters(values)}
                    triggerDisplay="badges"
                    hasSelectAll
                    selectAllLabel="전체 직종"
                  />
                )}
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
                  padding: 'var(--spacing-3) 0',
                  textAlign: 'center',
                  color: index === 0 ? 'var(--color-text-red)' : index === 6 ? 'var(--color-text-blue)' : 'var(--color-text-primary)',
                }}
              >
                <Text type="label" weight="semibold" color="inherit">{day}</Text>
              </div>
            ))}
          </div>

          {/* 캘린더 그리드 */}
          {isLoading ? (
            <Loading label="달력을 불러오는 중..." />
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
                const holidayName = getHolidayName(date);
                const dateKey = format(date, 'yyyy-MM-dd');
                const isDeadlineDay = deadlineDates[dateKey.slice(0, 7)] === dateKey;
                const dayEvents = getEventsForDate(date);

                const dayNumberStyle: CSSProperties = isToday(date)
                  ? {
                      background: 'var(--color-background-teal)',
                      color: 'var(--color-text-teal)',
                      width: 'var(--spacing-7)',
                      height: 'var(--spacing-7)',
                      borderRadius: 'var(--radius-full)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto',
                    }
                  : holidayName || dayOfWeek === 0
                  ? { color: 'var(--color-text-red)' }
                  : dayOfWeek === 6
                  ? { color: 'var(--color-text-blue)' }
                  : { color: 'var(--color-text-primary)' };

                return (
                  <button
                    key={format(date, 'yyyy-MM-dd')}
                    onClick={() => handleDateClick(date)}
                    className="carev-empcal-cell"
                    style={{
                      minHeight: isExpanded ? 100 : undefined,
                      aspectRatio: isExpanded ? undefined : '1 / 1',
                      padding: 'var(--spacing-1)',
                      border: 'none',
                      borderBottom: '1px solid var(--color-border)',
                      borderRight: '1px solid var(--color-border)',
                      position: 'relative',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background var(--duration-fast)',
                      opacity: !isSameMonth(date, currentDate) ? 0.3 : 1,
                      background: isSelected || isToday(date) ? 'var(--color-background-teal)' : undefined,
                      boxShadow: isSelected ? 'inset 0 0 0 2px var(--color-border-teal)' : undefined,
                    }}
                  >
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                      <span style={dayNumberStyle}>
                        <Text type="label" weight="medium" color="inherit">{format(date, 'd')}</Text>
                      </span>
                      {/* 공휴일 이름 */}
                      {holidayName && (
                        <div style={{ padding: '0 var(--spacing-1)', color: 'var(--color-text-red)', overflow: 'hidden' }} title={holidayName}>
                          <Text type="supporting" color="inherit" maxLines={1}>{holidayName}</Text>
                        </div>
                      )}
                      {/* 휴무 입력 마감일 */}
                      {isDeadlineDay && (
                        <div
                          title="휴무 입력 마감일"
                          style={{
                            margin: '0 var(--spacing-0-5)',
                            padding: '0 var(--spacing-1)',
                            borderRadius: 'var(--radius-full)',
                            background: 'var(--color-background-yellow)',
                            color: 'var(--color-text-yellow)',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 'var(--font-weight-bold)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          ★ 마감
                        </div>
                      )}
                      {/* 중요 행사 — 이 날은 휴무를 피해달라는 표시 */}
                      {dayEvents.map((event) => (
                        <div
                          key={event.id}
                          title={event.description ? `${event.title} — ${event.description}` : event.title}
                          style={{
                            margin: '1px var(--spacing-0-5) 0',
                            padding: '0 var(--spacing-1)',
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
                        </div>
                      ))}
                      {/* 휴무 제한 표시 */}
                      {(() => {
                        const maxPeople = getMaxPeopleForDate(date);
                        if (maxPeople !== null && maxPeople > 0) {
                          const currentCount = vacations.filter(v => v.status?.toLowerCase() === 'approved').length;
                          const isFull = currentCount >= maxPeople;
                          return (
                            <div style={{ padding: '0 var(--spacing-1)', color: isFull ? 'var(--color-text-red)' : 'var(--color-text-primary)' }}>
                              <Text type="supporting" color="inherit">{currentCount}/{maxPeople}명</Text>
                            </div>
                          );
                        }
                        return null;
                      })()}
                      {hasVacation && (
                        <div
                          style={{
                            flex: 1,
                            marginTop: 'var(--spacing-1)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 'var(--spacing-0-5)',
                            overflow: isExpanded ? undefined : 'hidden',
                          }}
                        >
                          {vacations.slice(0, isExpanded ? vacations.length : 3).map((vacation, i) => (
                            <div
                              key={vacation.id || i}
                              style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-0-5)' }}
                              title={`${vacation.userName} - ${resolveVacationKind(vacation.type, vacation.duration).label} - ${getVacationStatusText(vacation.status)}`}
                            >
                              {/* 상태 Badge (상태만 의미색) */}
                              {(() => {
                                const statusText = getStatusShortText(vacation.status);
                                return statusText ? (
                                  <Badge variant={getVacationBadgeVariant(vacation.status)} label={statusText} />
                                ) : null;
                              })()}
                              {/* 이름 + 유형 표시 */}
                              <span
                                style={{
                                  flex: 1,
                                  lineHeight: 'var(--text-display-3-leading)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 'var(--spacing-1)',
                                  minWidth: 0,
                                  color: vacation.userName === userName ? 'var(--color-text-teal)' : 'var(--color-text-primary)',
                                }}
                              >
                                <span style={{ minWidth: 0, overflow: 'hidden' }}>
                                  <Text
                                    type="supporting"
                                    color="inherit"
                                    weight={vacation.userName === userName ? 'semibold' : 'normal'}
                                    maxLines={1}
                                  >
                                    {vacation.userName}
                                  </Text>
                                </span>
                                {/* 휴무 종류는 한 사람당 하나. 한 글자로만 붙인다 */}
                                <Text type="supporting" color="secondary">
                                  {resolveVacationKind(vacation.type, vacation.duration).short}
                                </Text>
                              </span>
                            </div>
                          ))}
                          {!isExpanded && vacations.length > 3 && (
                            <div style={{ marginTop: 'var(--spacing-0-5)', color: 'var(--color-text-secondary)' }}>
                              <Text type="supporting" color="inherit" weight="medium">+{vacations.length - 3}명 더</Text>
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
            <div style={{ padding: 'var(--spacing-5)', borderBottom: '1px solid var(--color-border)' }}>
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

            <div style={{ padding: 'var(--spacing-5)' }}>
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
                          padding: 'var(--spacing-4)',
                          borderRadius: 'var(--radius-element)',
                          background: isMyVacation ? 'var(--color-background-teal)' : 'var(--color-background-muted)',
                          border: `1px solid ${isMyVacation ? 'var(--color-border-teal)' : 'var(--color-border)'}`,
                        }}
                      >
                        <HStack hAlign="between" vAlign="center" gap={3}>
                          <HStack gap={3} vAlign="center">
                            <Avatar name={vacation.userName || '?'} size="medium" />
                            <div>
                              <HStack gap={2} vAlign="center" wrap="wrap">
                                {/* 상태 Badge (관리자 달력처럼) */}
                                {(() => {
                                  const statusText = getStatusShortText(vacation.status);
                                  return !isMyVacation && statusText ? (
                                    <Badge variant={getVacationBadgeVariant(vacation.status)} label={statusText} />
                                  ) : null;
                                })()}
                                <Text type="body" weight="semibold" color="primary">
                                  {vacation.userName}
                                  {isMyVacation && <Text type="supporting" color="accent">{' (나)'}</Text>}
                                </Text>
                                {/* 휴무 종류 — 종류와 종일·반일 구분이 하나로 합쳐졌다 */}
                                {(() => {
                                  const kind = resolveVacationKind(vacation.type, vacation.duration);
                                  return <Badge variant={kind.badgeVariant} label={kind.label} />;
                                })()}
                                <Text type="supporting">{getRoleText(vacation.role)}</Text>
                              </HStack>
                              <HStack gap={2} vAlign="center" wrap="wrap">
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
                <div style={{ padding: 'var(--spacing-12) 0', textAlign: 'center' }}>
                    <Icon icon="calendar" size="lg" color="disabled" />
                    <div style={{ marginTop: 'var(--spacing-4)' }}>
                      <Text type="body" weight="medium" color="secondary">이 날에 등록된 휴무가 없습니다</Text>
                    </div>
                    <div style={{ marginTop: 'var(--spacing-1)' }}>
                      <Text type="supporting">휴무 신청 버튼을 눌러 휴무를 신청하세요</Text>
                    </div>
                  </div>
              );
              })()}
            </div>
          </motion.div>
        )}

        {/* 범례 */}
        <div style={{ ...CARD_STYLE, padding: 'var(--spacing-4)' }}>
          <HStack gap={4} vAlign="center" hAlign="center" wrap="wrap">
            {/* 휴가 유형 (배경 없이 중립 텍스트) */}
            <HStack gap={1.5} vAlign="center">
              <Text type="supporting" weight="semibold" color="secondary">연</Text>
              <Text type="supporting" color="secondary">연차</Text>
            </HStack>
            <HStack gap={1.5} vAlign="center">
              <Text type="supporting" weight="semibold" color="secondary">반</Text>
              <Text type="supporting" color="secondary">반차</Text>
            </HStack>
            <HStack gap={1.5} vAlign="center">
              <Text type="supporting" weight="semibold" color="secondary">필</Text>
              <Text type="supporting" color="secondary">필수 휴무</Text>
            </HStack>
            <HStack gap={1.5} vAlign="center">
              <Text type="supporting" weight="semibold" color="secondary">대</Text>
              <Text type="supporting" color="secondary">대체휴무</Text>
            </HStack>
            <div style={{ borderLeft: '1px solid var(--color-border)', height: 'var(--spacing-4)', margin: '0 var(--spacing-2)' }} />
            {/* 상태 (의미색 Badge) */}
            <HStack gap={2} vAlign="center">
              <div style={{ width: 'var(--spacing-4)', height: 'var(--spacing-4)', borderRadius: 'var(--radius-none)', background: 'var(--color-background-teal)' }} />
              <Text type="supporting" color="secondary" weight="medium">내 휴무</Text>
            </HStack>
            <Badge variant="success" label="승인됨" />
            <Badge variant="warning" label="대기중" />
            <Badge variant="error" label="반려됨" />
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
                {/* 신청 전 필수 숙지 — 시스템이 다 막지 못하는 부분이라 강한 색으로 강조 */}
                <Banner status="error" container="card" title={VACATION_NOTICE_TITLE} defaultIsExpanded>
                  <ul className={VACATION_NOTICE_LIST_CLASS} style={VACATION_NOTICE_LIST_STYLE}>
                    {VACATION_NOTICES.map((notice) => (
                      <li key={notice}>{notice}</li>
                    ))}
                  </ul>
                </Banner>
                {/* 고른 날짜에 기관 행사가 있으면 알려준다 (막지는 않는다 — 사정이 있을 수 있다) */}
                {(() => {
                  const warnEvents = requestForm.date
                    ? events.filter(
                        (e) => e.warnOnRequest && e.startDate <= requestForm.date && e.endDate >= requestForm.date,
                      )
                    : [];
                  if (warnEvents.length === 0) return null;
                  return (
                    <Banner
                      status="warning"
                      container="card"
                      title="이 날은 기관 행사가 있습니다"
                      description={warnEvents
                        .map((e) => `· ${e.title}${e.description ? ` — ${e.description}` : ''}`)
                        .join('\n')}
                    />
                  );
                })()}
                <DateInput
                  label="날짜"
                  isRequired
                  value={requestForm.date ? (requestForm.date as ISODateString) : undefined}
                  onChange={(value) => setRequestForm(prev => ({ ...prev, date: value || '' }))}
                  // 제한이 걸리면 달력에서 다음 달 밖은 아예 고를 수 없게 한다
                  min={nextMonthOnly ? (format(nextMonthStart, 'yyyy-MM-dd') as ISODateString) : undefined}
                  max={nextMonthOnly ? (format(endOfMonth(nextMonthStart), 'yyyy-MM-dd') as ISODateString) : undefined}
                  description={nextMonthOnly
                    ? `${format(nextMonthStart, 'yyyy년 M월', { locale: ko })} 안에서 고르실 수 있습니다`
                    : undefined}
                />
                {/* 휴무 종류 — 종류와 종일·반일 구분을 이 하나로 고른다 */}
                <Selector
                  label="휴무 종류"
                  isRequired
                  value={requestForm.kind}
                  options={VACATION_KIND_OPTIONS.map((option) => ({
                    value: option.value,
                    label: `${option.label} · ${option.description}`,
                  }))}
                  onChange={(value) => setRequestForm(prev => ({ ...prev, kind: value as VacationKind }))}
                />
                <TextArea
                  label="사유"
                  isRequired={requestForm.kind === 'mandatory'}
                  isOptional={requestForm.kind !== 'mandatory'}
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
