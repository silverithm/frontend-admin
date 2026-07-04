'use client';

import { useState, useEffect, useMemo, useRef, useCallback, CSSProperties } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday } from 'date-fns';
import { ko } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@astryxdesign/core/Button';
import { Text } from '@astryxdesign/core/Text';
import { Icon } from '@astryxdesign/core/Icon';
import { Badge } from '@astryxdesign/core/Badge';
import { Spinner } from '@astryxdesign/core/Spinner';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { TextInput } from '@astryxdesign/core/TextInput';
import { TextArea } from '@astryxdesign/core/TextArea';
import { Selector } from '@astryxdesign/core/Selector';
import { DateInput } from '@astryxdesign/core/DateInput';
import { TimeInput } from '@astryxdesign/core/TimeInput';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import type { ISODateString } from '@astryxdesign/core/Calendar';
import type { ISOTimeString } from '@astryxdesign/core/TimeInput';
import { Card } from '@astryxdesign/core/Card';
import { IconList, IconUsers, IconPlus, IconPaperclip, IconFileText, IconMapPin, IconBell, IconPencil, IconTrash, IconTag } from '@tabler/icons-react';
import { getSchedules, createSchedule, updateSchedule, deleteSchedule, getScheduleLabels, createScheduleLabel, updateScheduleLabel, deleteScheduleLabel, getAllMembers, getAllVacationRequests } from '@/lib/apiService';
import { Schedule, ScheduleLabel, ScheduleCategory, SCHEDULE_CATEGORIES, LABEL_COLORS } from '@/types/schedule';
import { useAlert } from './Alert';
import { useDispatchStore } from '@/lib/dispatchStore';
import type { DailyDispatch, DispatchDaySummary } from '@/types/dispatch';
import type { VacationRequest } from '@/types/vacation';
import { getDailyDispatch, getMonthlyDispatchSummary } from '@/lib/dispatchAlgorithm';
import DispatchDayDetail from './DispatchDayDetail';
import DispatchSettings from './DispatchSettings';
import DispatchListView from './DispatchListView';
import SeniorAbsenceManagement from './SeniorAbsenceManagement';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const CARD_STYLE: CSSProperties = {
  background: 'var(--color-background-card)',
  borderRadius: 'var(--radius-element)',
  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
  border: '1px solid var(--color-border)',
  overflow: 'hidden',
};

// 라벨 색상 스와치 스타일
const colorSwatchStyle = (selected: boolean, value: string): CSSProperties => ({
  width: 28,
  height: 28,
  borderRadius: '50%',
  padding: 'var(--spacing-0)',
  cursor: 'pointer',
  border: selected ? '2px solid var(--color-border-emphasized)' : '2px solid transparent',
  boxShadow: selected ? '0 0 0 2px var(--color-border)' : undefined,
  transform: selected ? 'scale(1.1)' : undefined,
  backgroundColor: value,
  transition: 'all var(--duration-fast-min)',
});

interface ScheduleCalendarProps {
  isAdmin?: boolean;
  mode?: 'schedule' | 'dispatch';
  onNotification?: (message: string, type: 'success' | 'error' | 'info') => void;
}

interface ScheduleFormData {
  title: string;
  content: string;
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
}

export default function ScheduleCalendar({ isAdmin = false, mode = 'schedule', onNotification }: ScheduleCalendarProps) {
  const { showAlert, AlertContainer } = useAlert();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [labels, setLabels] = useState<ScheduleLabel[]>([]);
  const [members, setMembers] = useState<any[]>([]);
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
    content: '',
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
  });

  const [labelForm, setLabelForm] = useState({
    name: '',
    color: LABEL_COLORS[0].value,
  });
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editLabelForm, setEditLabelForm] = useState({ name: '', color: '' });
  const [deletingLabelId, setDeletingLabelId] = useState<string | null>(null);

  const [fileInputRef] = useState(useRef<HTMLInputElement>(null));
  const [attachments, setAttachments] = useState<File[]>([]);

  // 달력 날짜 계산
  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const days = eachDayOfInterval({ start, end });

    const startDay = start.getDay();
    const paddedDays: (Date | null)[] = Array(startDay).fill(null);

    return [...paddedDays, ...days];
  }, [currentDate]);

  // 일정 데이터 로드
  useEffect(() => {
    if (!isDispatchMode) {
      loadSchedules();
      loadLabels();
      loadMembers();
    }
    if (typeof window !== 'undefined') {
      setCurrentUserEmail(localStorage.getItem('userEmail') || '');
    }
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

  // 날짜에 해당하는 일정 가져오기
  const getSchedulesForDate = (date: Date): Schedule[] => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return schedules.filter(schedule => {
      const scheduleStart = schedule.startDate.split('T')[0];
      const scheduleEnd = schedule.endDate.split('T')[0];
      return dateKey >= scheduleStart && dateKey <= scheduleEnd;
    });
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
      content: '',
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
    });
    setAttachments([]);
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
        content: formData.content || undefined,
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
      content: target.content || '',
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
        content: formData.content || undefined,
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
      await deleteScheduleLabel(id);
      showAlert({ type: 'success', title: '삭제 완료', message: '라벨이 삭제되었습니다.' });
      setDeletingLabelId(null);
      if (formData.labelId === id) {
        setFormData(prev => ({ ...prev, labelId: '' }));
      }
      loadLabels();
    } catch (error) {
      console.error('라벨 삭제 실패:', error);
      showAlert({ type: 'error', title: '삭제 실패', message: '라벨 삭제에 실패했습니다.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 파일 선택 핸들러
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments(Array.from(e.target.files));
    }
  };

  // 카테고리 한글 변환
  const getCategoryText = (category: ScheduleCategory) => {
    const found = SCHEDULE_CATEGORIES.find(c => c.value === category);
    return found?.label || category;
  };

  // 멤버 역할 텍스트
  const getMemberRoleText = (role?: string) => {
    if (!role) return undefined;
    return role === 'admin' ? '관리자' : role === 'caregiver' ? '요양보호사' : role === 'office' ? '사무직' : role;
  };

  return (
    <>
      <AlertContainer />
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
          <div style={CARD_STYLE}>
            {/* 캘린더 헤더 */}
            <div style={{ padding: 'var(--spacing-6)', borderBottom: '1px solid var(--color-border)' }}>
              <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
                <HStack gap={4} vAlign="center">
                  <Text type="display-3" as="h2" weight="bold" color="primary">
                    {format(currentDate, 'yyyy년 M월', { locale: ko })}
                  </Text>
                  <Button label="오늘" variant="secondary" size="sm" onClick={goToToday} />
                </HStack>
                <HStack gap={2} vAlign="center">
                  {isDispatchMode ? (
                    <>
                      {/* 배차 범례 */}
                      <HStack gap={3} vAlign="center">
                        <HStack gap={1} vAlign="center">
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--color-background-green)' }} />
                          <Text type="supporting" color="secondary">정상</Text>
                        </HStack>
                        <HStack gap={1} vAlign="center">
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--color-background-yellow)' }} />
                          <Text type="supporting" color="secondary">대체</Text>
                        </HStack>
                        <HStack gap={1} vAlign="center">
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--color-background-red)' }} />
                          <Text type="supporting" color="secondary">운행없음</Text>
                        </HStack>
                        <HStack gap={1} vAlign="center">
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--color-background-muted)' }} />
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
            {isLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--spacing-10) 0' }}>
                <Spinner size="lg" aria-label="달력 불러오는 중" />
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                {calendarDays.map((date, index) => {
                  if (!date) {
                    return (
                      <div
                        key={`empty-${index}`}
                        style={{ aspectRatio: '1 / 1', borderBottom: '1px solid var(--color-border)', borderRight: '1px solid var(--color-border)' }}
                      />
                    );
                  }

                  const dayOfWeek = date.getDay();
                  const dateStr = format(date, 'yyyy-MM-dd');

                  // 배차 모드
                  if (isDispatchMode) {
                    const summary = dispatchMonthlySummary.get(dateStr);
                    const statusColors = getDispatchStatusColors(summary);
                    const isCurrentMonth = isSameMonth(date, currentDate);

                    const dayNumStyle: CSSProperties = isToday(date)
                      ? {
                          background: 'var(--color-background-teal)',
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
                      ? { color: 'var(--color-text-red)' }
                      : dayOfWeek === 6
                      ? { color: 'var(--color-text-blue)' }
                      : { color: 'var(--color-text-primary)' };

                    return (
                      <button
                        key={dateStr}
                        onClick={() => {
                          if (isCurrentMonth) {
                            setDispatchSelectedDate(date);
                            setShowDispatchDayDetail(true);
                          }
                        }}
                        className={isCurrentMonth ? 'carev-schedcal-cell' : undefined}
                        disabled={!isCurrentMonth}
                        style={{
                          aspectRatio: '1 / 1',
                          padding: 'var(--spacing-2)',
                          border: 'none',
                          borderBottom: '1px solid var(--color-border)',
                          borderRight: '1px solid var(--color-border)',
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
                              <Text type="supporting" size="4xs" color="inherit" weight="medium">{summary.holidayName}</Text>
                            </div>
                          )}
                          {isCurrentMonth && summary && !summary.isHoliday && summary.totalRoutes > 0 && (
                            <div style={{ marginTop: 'var(--spacing-1)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-0-5)' }}>
                              {summary.normalCount > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', color: 'var(--color-text-green)' }}>
                                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-background-green)', marginRight: 'var(--spacing-1)', flexShrink: 0 }} />
                                  <Text type="supporting" size="4xs" color="inherit">{summary.normalCount} 정상</Text>
                                </div>
                              )}
                              {summary.substituteCount > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', color: 'var(--color-text-yellow)' }}>
                                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-background-yellow)', marginRight: 'var(--spacing-1)', flexShrink: 0 }} />
                                  <Text type="supporting" size="4xs" color="inherit">{summary.substituteCount} 대체</Text>
                                </div>
                              )}
                              {summary.noServiceCount > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', color: 'var(--color-text-red)' }}>
                                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-background-red)', marginRight: 'var(--spacing-1)', flexShrink: 0 }} />
                                  <Text type="supporting" size="4xs" color="inherit">{summary.noServiceCount} 미운행</Text>
                                </div>
                              )}
                            </div>
                          )}
                          {isCurrentMonth && !summary?.isHoliday && (!summary || summary.totalRoutes === 0) && (
                            <div style={{ marginTop: 'var(--spacing-1)', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
                              <Text type="supporting" size="4xs" color="inherit">미설정</Text>
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  }

                  // 일정 모드
                  const daySchedules = getSchedulesForDate(date);
                  const isSelected = selectedDate && isSameDay(date, selectedDate);

                  const dayNumStyle: CSSProperties = isToday(date)
                    ? {
                        background: 'var(--color-background-teal)',
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
                    ? { color: 'var(--color-text-red)' }
                    : dayOfWeek === 6
                    ? { color: 'var(--color-text-blue)' }
                    : { color: 'var(--color-text-primary)' };

                  return (
                    <button
                      key={dateStr}
                      onClick={() => handleDateClick(date)}
                      className="carev-schedcal-cell"
                      style={{
                        aspectRatio: '1 / 1',
                        padding: 'var(--spacing-2)',
                        border: 'none',
                        borderBottom: '1px solid var(--color-border)',
                        borderRight: '1px solid var(--color-border)',
                        position: 'relative',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all var(--duration-fast)',
                        opacity: !isSameMonth(date, currentDate) ? 0.3 : 1,
                        background: isSelected || isToday(date) ? 'var(--color-background-teal)' : undefined,
                        boxShadow: isSelected ? 'inset 0 0 0 2px var(--color-border-teal)' : undefined,
                      }}
                    >
                      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <span style={dayNumStyle}>
                          <Text type="label" weight={isToday(date) ? 'bold' : 'medium'} color="inherit">{format(date, 'd')}</Text>
                        </span>
                        {daySchedules.length > 0 && (
                          <div style={{ flex: 1, marginTop: 'var(--spacing-1)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-0-5)', overflowY: 'auto' }}>
                            {daySchedules.map((schedule) => (
                              <div
                                key={schedule.id}
                                onClick={(e) => handleScheduleClick(e, schedule)}
                                title={schedule.title}
                                style={{
                                  padding: 'var(--spacing-0-5) var(--spacing-1-5)',
                                  borderRadius: 'var(--radius-none)',
                                  color: '#fff',
                                  backgroundColor: schedule.label?.color || 'var(--color-background-blue)',
                                  opacity: 0.9,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  cursor: 'pointer',
                                }}
                              >
                                <Text type="supporting" size="4xs" color="inherit" weight="medium" maxLines={1}>{schedule.title}</Text>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
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
              transition={{ duration: 0.25 }}
            >
              <div style={{ ...CARD_STYLE, position: 'sticky', top: 24, minHeight: 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column' }}>
                {/* 헤더 */}
                <div style={{ padding: 'var(--spacing-5)', borderBottom: '1px solid var(--color-border)' }}>
                  <HStack hAlign="between" vAlign="start">
                    <VStack gap={1}>
                      <Text type="display-3" as="h3" weight="bold" color="primary">
                        {format(selectedDate, 'M월 d일 (EEEE)', { locale: ko })}
                      </Text>
                      <Text type="supporting">{getSchedulesForDate(selectedDate).length}개 일정</Text>
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
                                style={{ width: 10, height: 10, borderRadius: '50%', marginTop: 'var(--spacing-1-5)', flexShrink: 0, backgroundColor: schedule.label?.color || 'var(--color-background-blue)' }}
                              />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <Text type="body" weight="semibold" color="primary" maxLines={1}>{schedule.title}</Text>
                                <div style={{ marginTop: 'var(--spacing-1)' }}>
                                  <HStack gap={1.5} vAlign="center">
                                    <Badge variant="teal" label={getCategoryText(schedule.category)} />
                                    <Text type="supporting">
                                      {schedule.isAllDay ? '종일' : `${schedule.startTime || ''} - ${schedule.endTime || ''}`}
                                    </Text>
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
                          {(isAdmin || schedule.authorId === currentUserEmail) && (
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-1)', marginTop: 'var(--spacing-2)', paddingTop: 'var(--spacing-2)', borderTop: '1px solid var(--color-border)' }}>
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
                            </div>
                          )}
                        </div>
                      ))}
                    </VStack>
                  ) : (
                    <div style={{ textAlign: 'center', padding: 'var(--spacing-8) 0' }}>
                      <Icon icon="calendar" size="lg" color="disabled" />
                      <div style={{ marginTop: 'var(--spacing-3)' }}>
                        <Text type="body" weight="medium" color="secondary">일정이 없습니다</Text>
                      </div>
                      <div style={{ marginTop: 'var(--spacing-1)' }}>
                        <Text type="supporting">일정 추가 버튼으로 새 일정을 등록하세요</Text>
                      </div>
                    </div>
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
                          style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: labels.find(l => String(l.id) === String(formData.labelId))?.color }}
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

                {/* 참석자 선택 */}
                <VStack gap={2}>
                  <Text type="label" weight="medium">참석자</Text>
                  <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid var(--color-border-emphasized)', borderRadius: 'var(--radius-inner)', padding: 'var(--spacing-2)' }}>
                    <VStack gap={1}>
                      {members.map((member) => (
                        <div key={member.id} style={{ padding: 'var(--spacing-1-5)', borderRadius: 'var(--radius-inner)' }}>
                          <CheckboxInput
                            label={member.name}
                            description={getMemberRoleText(member.role)}
                            value={formData.participantIds.includes(member.id.toString())}
                            onChange={(checked) => {
                              const memberId = member.id.toString();
                              if (checked) {
                                setFormData(prev => ({ ...prev, participantIds: [...prev.participantIds, memberId] }));
                              } else {
                                setFormData(prev => ({ ...prev, participantIds: prev.participantIds.filter(id => id !== memberId) }));
                              }
                            }}
                          />
                        </div>
                      ))}
                      {members.length === 0 && (
                        <div style={{ textAlign: 'center', padding: 'var(--spacing-2)' }}>
                          <Text type="supporting" color="secondary">직원이 없습니다</Text>
                        </div>
                      )}
                    </VStack>
                  </div>
                  {formData.participantIds.length > 0 && (
                    <Text type="supporting" color="accent">
                      {formData.participantIds.length}명 선택됨
                    </Text>
                  )}
                </VStack>

                {/* 첨부파일 */}
                <VStack gap={2}>
                  <Text type="label" weight="medium">첨부파일</Text>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                  />
                  <div>
                    <Button
                      label="파일 선택"
                      variant="secondary"
                      icon={<Icon icon={IconPaperclip} size="sm" />}
                      onClick={() => fileInputRef.current?.click()}
                    />
                  </div>
                  {attachments.length > 0 && (
                    <VStack gap={1}>
                      {attachments.map((file, index) => (
                        <HStack key={index} gap={2} vAlign="center">
                          <Icon icon={IconFileText} size="sm" color="tertiary" />
                          <Text type="supporting" color="secondary">{file.name}</Text>
                          <Text type="supporting" color="disabled">({(file.size / 1024).toFixed(1)} KB)</Text>
                        </HStack>
                      ))}
                    </VStack>
                  )}
                </VStack>

                {/* 내용 */}
                <TextArea
                  label="내용"
                  value={formData.content}
                  onChange={(value) => setFormData(prev => ({ ...prev, content: value }))}
                  placeholder="일정 내용을 입력하세요"
                  rows={4}
                />
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

                  {/* 참석자 */}
                  {selectedSchedule.participants && selectedSchedule.participants.length > 0 && (
                    <div style={{ paddingTop: 'var(--spacing-4)', borderTop: '1px solid var(--color-border)' }}>
                      <VStack gap={2}>
                        <Text type="label" weight="medium">참석자</Text>
                        {selectedSchedule.participants.map((participant) => (
                          <div key={participant.id} style={{ padding: 'var(--spacing-2)', borderRadius: 'var(--radius-inner)', background: 'var(--color-background-muted)' }}>
                            <Text type="supporting" color="primary">{(participant as any).memberName || participant.userName || '참석자'}</Text>
                          </div>
                        ))}
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
                                  <span style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0, backgroundColor: label.color }} />
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
