'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday } from 'date-fns';
import { ko } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { getSchedules, createSchedule, updateSchedule, deleteSchedule, getScheduleLabels, createScheduleLabel, getAllMembers } from '@/lib/apiService';
import { Schedule, ScheduleLabel, ScheduleCategory, SCHEDULE_CATEGORIES, LABEL_COLORS } from '@/types/schedule';
import { useAlert } from './Alert';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

interface ScheduleCalendarProps {
  isAdmin?: boolean;
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

export default function ScheduleCalendar({ isAdmin = false }: ScheduleCalendarProps) {
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
    loadSchedules();
    loadLabels();
    loadMembers();
  }, [currentDate]);

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
  const handleScheduleClick = (e: React.MouseEvent, schedule: Schedule) => {
    e.stopPropagation();
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
  const handleEditSchedule = () => {
    if (!selectedSchedule) return;

    setFormData({
      title: selectedSchedule.title,
      content: selectedSchedule.content || '',
      category: selectedSchedule.category,
      labelId: selectedSchedule.labelId || '',
      location: selectedSchedule.location || '',
      startDate: selectedSchedule.startDate.split('T')[0],
      startTime: selectedSchedule.startTime || '09:00',
      endDate: selectedSchedule.endDate.split('T')[0],
      endTime: selectedSchedule.endTime || '10:00',
      isAllDay: selectedSchedule.isAllDay,
      sendNotification: selectedSchedule.sendNotification,
      participantIds: selectedSchedule.participants?.map(p => p.userId) || [],
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
      setShowLabelModal(false);
      setLabelForm({ name: '', color: LABEL_COLORS[0].value });
      loadLabels();
    } catch (error) {
      console.error('라벨 생성 실패:', error);
      showAlert({ type: 'error', title: '생성 실패', message: '라벨 생성에 실패했습니다.' });
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

  return (
    <>
      <AlertContainer />
      <div className="flex flex-col xl:flex-row gap-6">
        {/* 캘린더 카드 */}
        <div className={`${selectedDate ? 'xl:w-3/4' : 'w-full'} transition-all duration-300`}>
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
                    onClick={() => openCreateModal()}
                    className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                    <span>일정 추가</span>
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
                    return <div key={`empty-${index}`} className="aspect-square border-b border-r border-gray-50" />;
                  }

                  const daySchedules = getSchedulesForDate(date);
                  const isSelected = selectedDate && isSameDay(date, selectedDate);
                  const dayOfWeek = date.getDay();

                  return (
                    <button
                      key={format(date, 'yyyy-MM-dd')}
                      onClick={() => handleDateClick(date)}
                      className={`aspect-square p-2 border-b border-r border-gray-50 transition-all duration-200 hover:bg-blue-50 relative ${
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
                        {daySchedules.length > 0 && (
                          <div className="flex-1 mt-1 space-y-0.5 overflow-hidden">
                            {daySchedules.slice(0, 3).map((schedule) => (
                              <div
                                key={schedule.id}
                                onClick={(e) => handleScheduleClick(e, schedule)}
                                className="text-[10px] px-1.5 py-0.5 rounded truncate bg-blue-500 text-white font-medium hover:bg-blue-600 transition-colors"
                                style={{
                                  borderLeft: schedule.label?.color ? `3px solid ${schedule.label.color}` : undefined,
                                }}
                                title={schedule.title}
                              >
                                {schedule.title}
                              </div>
                            ))}
                            {daySchedules.length > 3 && (
                              <div className="text-[10px] text-gray-500 font-medium">
                                +{daySchedules.length - 3}개
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
        </div>

        {/* 선택된 날짜 상세 (우측 패널) */}
        <AnimatePresence>
          {selectedDate && (
            <motion.div
              className="xl:w-1/4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.25 }}
            >
              <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden sticky top-6 min-h-[calc(100vh-200px)] flex flex-col">
                {/* 헤더 */}
                <div className="p-5 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">
                        {format(selectedDate, 'M월 d일 (EEEE)', { locale: ko })}
                      </h3>
                      <p className="text-gray-500 text-sm mt-1">
                        {getSchedulesForDate(selectedDate).length}개 일정
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedDate(null)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* 일정 추가 버튼 */}
                <div className="px-5 pt-4">
                  <button
                    onClick={() => openCreateModal(selectedDate)}
                    className="w-full flex items-center justify-center space-x-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                    <span>일정 추가</span>
                  </button>
                </div>

                {/* 일정 목록 (스크롤 가능) */}
                <div className="p-5 flex-1 overflow-y-auto">
                  {getSchedulesForDate(selectedDate).length > 0 ? (
                    <div className="space-y-2.5">
                      {getSchedulesForDate(selectedDate).map((schedule) => (
                        <button
                          key={schedule.id}
                          onClick={() => handleScheduleClick({} as React.MouseEvent, schedule)}
                          className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 hover:bg-blue-50 hover:border-blue-200 transition-all text-left"
                        >
                          <div className="flex items-start space-x-2">
                            {schedule.label && (
                              <div
                                className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0"
                                style={{ backgroundColor: schedule.label.color }}
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <span className="font-semibold text-sm text-gray-900 block truncate">{schedule.title}</span>
                              <div className="flex items-center space-x-1.5 mt-1">
                                <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                                  {getCategoryText(schedule.category)}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {schedule.isAllDay ? '종일' : `${schedule.startTime || ''} - ${schedule.endTime || ''}`}
                                </span>
                              </div>
                              {schedule.location && (
                                <span className="text-xs text-gray-400 mt-0.5 block truncate">{schedule.location}</span>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-gray-500 text-sm font-medium">일정이 없습니다</p>
                      <p className="text-gray-400 text-xs mt-1">일정 추가 버튼으로 새 일정을 등록하세요</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 일정 생성/수정 모달 */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => {
              setShowCreateModal(false);
              setSelectedSchedule(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      {selectedSchedule ? '일정 수정' : '일정 추가'}
                    </h2>
                    <p className="text-gray-500 text-sm mt-1">일정 정보를 입력해주세요</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setSelectedSchedule(null);
                    }}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                {/* 제목 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    제목 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="일정 제목을 입력하세요"
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* 일정 구분 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">일정 구분</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as ScheduleCategory }))}
                      className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {SCHEDULE_CATEGORIES.map((cat) => (
                        <option key={cat.value} value={cat.value}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 라벨 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">라벨</label>
                    <div className="flex space-x-2">
                      <select
                        value={formData.labelId}
                        onChange={(e) => setFormData(prev => ({ ...prev, labelId: e.target.value }))}
                        className="flex-1 px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">라벨 없음</option>
                        {labels.map((label) => (
                          <option key={label.id} value={label.id}>
                            {label.name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => setShowLabelModal(true)}
                        className="px-3 py-2.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                      >
                        새 라벨
                      </button>
                    </div>
                  </div>
                </div>

                {/* 장소 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">장소</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="장소를 입력하세요"
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* 날짜/시간 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">날짜/시간</label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isAllDay}
                        onChange={(e) => setFormData(prev => ({ ...prev, isAllDay: e.target.checked }))}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">종일</span>
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">시작일</label>
                      <input
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    {!formData.isAllDay && (
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">시작 시간</label>
                        <input
                          type="time"
                          value={formData.startTime}
                          onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                          className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">종료일</label>
                      <input
                        type="date"
                        value={formData.endDate}
                        onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    {!formData.isAllDay && (
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">종료 시간</label>
                        <input
                          type="time"
                          value={formData.endTime}
                          onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                          className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* 알림 */}
                <div>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.sendNotification}
                      onChange={(e) => setFormData(prev => ({ ...prev, sendNotification: e.target.checked }))}
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">참석자에게 알림 전송</span>
                  </label>
                </div>

                {/* 참석자 선택 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">참석자</label>
                  <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-2 space-y-1">
                    {members.map((member) => (
                      <label key={member.id} className="flex items-center space-x-2 cursor-pointer p-1.5 rounded hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={formData.participantIds.includes(member.id.toString())}
                          onChange={(e) => {
                            const memberId = member.id.toString();
                            if (e.target.checked) {
                              setFormData(prev => ({ ...prev, participantIds: [...prev.participantIds, memberId] }));
                            } else {
                              setFormData(prev => ({ ...prev, participantIds: prev.participantIds.filter(id => id !== memberId) }));
                            }
                          }}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{member.name}</span>
                      </label>
                    ))}
                    {members.length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-2">직원이 없습니다</p>
                    )}
                  </div>
                  {formData.participantIds.length > 0 && (
                    <p className="text-xs text-blue-600 mt-1">
                      {formData.participantIds.length}명 선택됨
                    </p>
                  )}
                </div>

                {/* 첨부파일 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">첨부파일</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors flex items-center justify-center space-x-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    <span>파일 선택</span>
                  </button>
                  {attachments.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {attachments.map((file, index) => (
                        <div key={index} className="text-sm text-gray-600 flex items-center space-x-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span>{file.name}</span>
                          <span className="text-gray-400">({(file.size / 1024).toFixed(1)} KB)</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 내용 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">내용</label>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                    placeholder="일정 내용을 입력하세요"
                    rows={4}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  />
                </div>
              </div>

              <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setSelectedSchedule(null);
                  }}
                  className="px-4 py-2 text-gray-600 font-medium hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={selectedSchedule ? handleSubmitUpdate : handleSubmitCreate}
                  disabled={isSubmitting || !formData.title}
                  className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : selectedSchedule ? (
                    '수정하기'
                  ) : (
                    '추가하기'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 일정 상세 모달 */}
      <AnimatePresence>
        {showDetailModal && selectedSchedule && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => {
              setShowDetailModal(false);
              setSelectedSchedule(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {selectedSchedule.label && (
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: selectedSchedule.label.color }}
                      />
                    )}
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">{selectedSchedule.title}</h2>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {getCategoryText(selectedSchedule.category)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      setSelectedSchedule(null);
                    }}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                {/* 날짜/시간 */}
                <div className="flex items-start space-x-3">
                  <svg className="w-5 h-5 text-gray-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <div>
                    <p className="text-gray-900 font-medium">
                      {format(new Date(selectedSchedule.startDate), 'yyyy년 M월 d일 (EEEE)', { locale: ko })}
                      {selectedSchedule.startDate !== selectedSchedule.endDate && (
                        <> ~ {format(new Date(selectedSchedule.endDate), 'M월 d일 (EEEE)', { locale: ko })}</>
                      )}
                    </p>
                    {!selectedSchedule.isAllDay && selectedSchedule.startTime && (
                      <p className="text-gray-600 text-sm">
                        {selectedSchedule.startTime} - {selectedSchedule.endTime}
                      </p>
                    )}
                    {selectedSchedule.isAllDay && (
                      <p className="text-gray-600 text-sm">종일</p>
                    )}
                  </div>
                </div>

                {/* 장소 */}
                {selectedSchedule.location && (
                  <div className="flex items-start space-x-3">
                    <svg className="w-5 h-5 text-gray-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <p className="text-gray-900">{selectedSchedule.location}</p>
                  </div>
                )}

                {/* 알림 */}
                {selectedSchedule.sendNotification && (
                  <div className="flex items-start space-x-3">
                    <svg className="w-5 h-5 text-gray-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    <p className="text-gray-900">알림 전송됨</p>
                  </div>
                )}

                {/* 내용 */}
                {selectedSchedule.content && (
                  <div className="pt-4 border-t border-gray-100">
                    <p className="text-gray-700 whitespace-pre-wrap">{selectedSchedule.content}</p>
                  </div>
                )}

                {/* 첨부파일 */}
                {selectedSchedule.attachments && selectedSchedule.attachments.length > 0 && (
                  <div className="pt-4 border-t border-gray-100">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">첨부파일</h4>
                    <div className="space-y-2">
                      {selectedSchedule.attachments.map((attachment) => (
                        <a
                          key={attachment.id}
                          href={attachment.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <div className="flex-1">
                            <p className="text-sm text-gray-900">{attachment.fileName}</p>
                            <p className="text-xs text-gray-500">{(attachment.fileSize / 1024).toFixed(1)} KB</p>
                          </div>
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* 참석자 */}
                {selectedSchedule.participants && selectedSchedule.participants.length > 0 && (
                  <div className="pt-4 border-t border-gray-100">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">참석자</h4>
                    <div className="space-y-2">
                      {selectedSchedule.participants.map((participant) => (
                        <div key={participant.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                          <span className="text-gray-900">{participant.userName}</span>
                          <span
                            className={`text-xs px-2 py-1 rounded-full ${
                              participant.status === 'ACCEPTED'
                                ? 'bg-green-100 text-green-700'
                                : participant.status === 'DECLINED'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}
                          >
                            {participant.status === 'ACCEPTED' ? '수락' : participant.status === 'DECLINED' ? '거절' : '대기중'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 작성자 */}
                <div className="pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-500">
                    작성자: {selectedSchedule.authorName} · {format(new Date(selectedSchedule.createdAt), 'yyyy.MM.dd HH:mm')}
                  </p>
                </div>
              </div>

              {isAdmin && (
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between">
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-4 py-2 text-red-600 font-medium hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    삭제
                  </button>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => {
                        setShowDetailModal(false);
                        setSelectedSchedule(null);
                      }}
                      className="px-4 py-2 text-gray-600 font-medium hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      닫기
                    </button>
                    <button
                      onClick={handleEditSchedule}
                      className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                    >
                      수정
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 삭제 확인 모달 */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">일정 삭제</h3>
                    <p className="text-sm text-gray-500 mt-0.5">정말 이 일정을 삭제하시겠습니까?</p>
                  </div>
                </div>
                <p className="text-gray-600 mb-6">이 작업은 되돌릴 수 없습니다.</p>
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 px-4 py-2 text-gray-600 font-medium hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleDeleteSchedule}
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? '삭제 중...' : '삭제'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 라벨 생성 모달 */}
      <AnimatePresence>
        {showLabelModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
            onClick={() => setShowLabelModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">새 라벨</h2>
                    <p className="text-gray-500 text-sm mt-1">라벨 정보를 입력하세요</p>
                  </div>
                  <button
                    onClick={() => setShowLabelModal(false)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                {/* 라벨 이름 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    라벨 이름 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={labelForm.name}
                    onChange={(e) => setLabelForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="라벨 이름을 입력하세요"
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* 색상 선택 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">색상</label>
                  <div className="grid grid-cols-4 gap-3">
                    {LABEL_COLORS.map((color) => (
                      <button
                        key={color.value}
                        onClick={() => setLabelForm(prev => ({ ...prev, color: color.value }))}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          labelForm.color === color.value
                            ? 'border-gray-900 ring-2 ring-gray-200'
                            : 'border-transparent hover:border-gray-300'
                        }`}
                      >
                        <div
                          className="w-full h-8 rounded"
                          style={{ backgroundColor: color.value }}
                        />
                        <p className="text-xs text-gray-600 mt-1 text-center">{color.label}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end space-x-3">
                <button
                  onClick={() => setShowLabelModal(false)}
                  className="px-4 py-2 text-gray-600 font-medium hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleCreateLabel}
                  disabled={isSubmitting || !labelForm.name}
                  className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? '생성 중...' : '생성'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
