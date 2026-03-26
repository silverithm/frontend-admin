'use client';

import { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isToday } from 'date-fns';
import { ko } from 'date-fns/locale';
import { motion } from 'framer-motion';
import {
  getAllMembers,
  getAllVacationRequests,
  getApprovalRequests,
  getNotices,
  getPendingJoinRequests,
  getSchedules,
  getVacationCalendar,
} from '@/lib/apiService';

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
  location?: string;
  participants?: string[];
}

interface VacationCalendarItem {
  id: string;
  userName?: string;
  memberName?: string;
  name?: string;
  vacationType?: string;
  duration?: string;
}

export default function AdminDashboard({ onTabChange, isAdmin = true }: AdminDashboardProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [members, setMembers] = useState<unknown[]>([]);
  const [vacationRequests, setVacationRequests] = useState<VacationItem[]>([]);
  const [approvalRequests, setApprovalRequests] = useState<ApprovalItem[]>([]);
  const [pendingJoinRequests, setPendingJoinRequests] = useState<unknown[]>([]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [vacationCalendar, setVacationCalendar] = useState<VacationCalendarItem[]>([]);
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [monthlySchedules, setMonthlySchedules] = useState<ScheduleItem[]>([]);
  const [currentTime, setCurrentTime] = useState(format(new Date(), 'HH:mm:ss'));
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleItem | null>(null);

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
      const monthStartStr = format(startOfMonth(new Date()), 'yyyy-MM-dd');
      const monthEndStr = format(endOfMonth(new Date()), 'yyyy-MM-dd');

      const results = await Promise.allSettled([
        getAllMembers(),
        getAllVacationRequests(),
        getApprovalRequests({ status: 'PENDING' }),
        getPendingJoinRequests(),
        getSchedules(todayStr, todayStr),
        getVacationCalendar(todayStr, todayStr),
        getNotices(),
        getSchedules(monthStartStr, monthEndStr),
      ]);

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
        setMembers(extractArray(results[0].value, 'members', 'content', 'data'));
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
      }

      if (results[5].status === 'fulfilled') {
        const d = results[5].value as Record<string, unknown>;
        // getVacationCalendar returns { dates: { "2026-02-27": { people: [...], count: N } } }
        if (d && d.dates && typeof d.dates === 'object') {
          const datesObj = d.dates as Record<string, { people?: VacationCalendarItem[]; vacations?: VacationCalendarItem[] }>;
          const todayData = datesObj[todayStr];
          if (todayData) {
            const people = todayData.people || todayData.vacations || [];
            setVacationCalendar(people as VacationCalendarItem[]);
          }
        } else if (Array.isArray(d)) {
          setVacationCalendar(d as VacationCalendarItem[]);
        }
      }

      if (results[6].status === 'fulfilled') {
        const arr = extractArray(results[6].value, 'notices', 'content', 'data');
        setNotices(arr as NoticeItem[]);
      }

      if (results[7].status === 'fulfilled') {
        const arr = extractArray(results[7].value, 'schedules', 'content', 'data');
        setMonthlySchedules(arr as ScheduleItem[]);
      }

      setIsLoading(false);
    };

    loadData();
  }, []);

  const pendingVacationCount = vacationRequests.filter(
    (v) => v.status === 'pending' || v.status === 'PENDING'
  ).length;

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const selectedSchedules = monthlySchedules.filter((s) => {
    const start = s.startDate?.substring(0, 10);
    const end = s.endDate?.substring(0, 10);
    if (start && end) {
      return selectedDateStr >= start && selectedDateStr <= end;
    }
    return start === selectedDateStr;
  });

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        {/* Header skeleton */}
        <div className="bg-slate-200 animate-pulse rounded-2xl h-20" />
        {/* Stat cards skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-200 animate-pulse rounded-2xl h-28" />
          ))}
        </div>
        {/* Content skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-200 animate-pulse rounded-2xl h-64" />
          <div className="bg-gray-200 animate-pulse rounded-2xl h-64" />
        </div>
        {/* Quick nav skeleton */}
        <div className="bg-gray-200 animate-pulse rounded-2xl h-28" />
      </div>
    );
  }

  const statCards = [
    {
      label: '총 직원',
      value: members.length,
      subtitle: '명',
      gradient: 'from-blue-500 to-blue-600',
      hoverGradient: 'hover:from-blue-600 hover:to-blue-700',
      tab: 'info',
      showBadge: false,
    },
    {
      label: '대기 휴무',
      value: pendingVacationCount,
      subtitle: '건',
      gradient: 'from-amber-500 to-orange-500',
      hoverGradient: 'hover:from-amber-600 hover:to-orange-600',
      tab: 'work',
      showBadge: pendingVacationCount > 0,
    },
    {
      label: '대기 결재',
      value: approvalRequests.length,
      subtitle: '건',
      gradient: 'from-violet-500 to-purple-600',
      hoverGradient: 'hover:from-violet-600 hover:to-purple-700',
      tab: 'approval',
      showBadge: approvalRequests.length > 0,
    },
    {
      label: '가입 대기',
      value: pendingJoinRequests.length,
      subtitle: '건',
      gradient: 'from-emerald-500 to-teal-600',
      hoverGradient: 'hover:from-emerald-600 hover:to-teal-700',
      tab: 'info',
      showBadge: pendingJoinRequests.length > 0,
    },
  ];

  const avatarColors = [
    'bg-orange-500',
    'bg-blue-500',
    'bg-emerald-500',
    'bg-violet-500',
    'bg-rose-500',
  ];

  return (
    <div className="space-y-3 px-6 pb-4 pt-1">
      {/* 1. Header Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0 }}
        className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl px-6 py-4 flex items-center justify-between"
      >
        <div>
          <p className="text-slate-400 text-xs font-medium tracking-wider uppercase">Dashboard</p>
          <h1 className="text-white text-lg font-bold mt-0.5">
            {format(new Date(), 'yyyy년 M월 d일 (EEEE)', { locale: ko })}
          </h1>
        </div>
        <div className="text-right">
          <p className="text-slate-400 text-xs font-medium">현재 시각</p>
          <p className="text-white text-lg font-bold font-mono tabular-nums">{currentTime}</p>
        </div>
      </motion.div>

      {/* 2. Stat Cards */}
      <div className={`grid gap-3 ${isAdmin ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-1'}`} style={{ gridAutoRows: '5.5rem' }}>
        {statCards.filter((card) => isAdmin || card.label === '총 직원').map((card, idx) => (
          <motion.button
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 + idx * 0.05 }}
            onClick={() => onTabChange(card.tab)}
            className={`relative bg-gradient-to-br ${card.gradient} ${card.hoverGradient} rounded-2xl p-4 text-white transition-all duration-300 hover:scale-[1.02] hover:shadow-lg group overflow-hidden text-left h-full`}
          >
            {/* Decorative circles */}
            <div className="absolute -top-4 -right-4 w-20 h-20 bg-white/10 rounded-full" />
            <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-white/5 rounded-full" />

            <div className="relative">
              <div className="flex items-center gap-2 flex-nowrap">
                <p className="text-white/80 text-xs font-medium whitespace-nowrap">{card.label}</p>
                {card.showBadge && (
                  <span className="inline-flex items-center gap-1 bg-white/20 backdrop-blur-sm rounded-full px-1.5 py-px flex-shrink-0 whitespace-nowrap">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                    <span className="text-[10px] font-semibold">처리 필요</span>
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-3xl font-extrabold">{card.value}</span>
                <span className="text-white/70 text-sm font-medium">{card.subtitle}</span>
              </div>
            </div>

            {/* Arrow on hover */}
            <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </div>
          </motion.button>
        ))}
      </div>

      {/* 3. Four-panel grid: 공지사항, 전자결재, 월간일정, 오늘의 일정 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-3"
      >
        {/* Top-Left: 공지사항 */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden h-80">
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">공지사항</h2>
                <p className="text-xs text-gray-400">{notices.length}개</p>
              </div>
            </div>
            <button
              onClick={() => onTabChange('notice')}
              className="text-xs text-amber-600 hover:text-amber-700 font-semibold transition-colors"
            >
              전체보기 →
            </button>
          </div>

          <div className="px-4 pb-4 overflow-y-auto flex-1">
            {notices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-400">공지사항이 없습니다</p>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                {notices.slice(0, 5).map((notice) => (
                  <div
                    key={notice.id}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => onTabChange('notice')}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {notice.priority === 'HIGH' && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded font-semibold flex-shrink-0">중요</span>
                        )}
                        <p className="text-sm text-gray-800 font-medium truncate">{notice.title}</p>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {notice.authorName && `${notice.authorName} · `}
                        {notice.createdAt ? format(new Date(notice.createdAt), 'M.d') : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Top-Right: 전자결재 */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden h-80">
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">전자결재</h2>
                <p className="text-xs text-gray-400">대기 {approvalRequests.length}건</p>
              </div>
            </div>
            <button
              onClick={() => onTabChange('approval')}
              className="text-xs text-violet-600 hover:text-violet-700 font-semibold transition-colors"
            >
              전체보기 →
            </button>
          </div>

          <div className="px-4 pb-4 overflow-y-auto flex-1">
            {approvalRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-400">대기 중인 결재가 없습니다</p>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                {approvalRequests.slice(0, 5).map((approval) => (
                  <div
                    key={approval.id}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => onTabChange('approval')}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 font-medium truncate">
                        {approval.title || approval.templateName || '결재 요청'}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {approval.requesterName && `${approval.requesterName} · `}
                        {approval.createdAt ? format(new Date(approval.createdAt), 'M.d') : ''}
                      </p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-600 rounded-full font-semibold flex-shrink-0">
                      대기
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bottom-Left: 월간일정 */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden h-80">
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">월간일정</h2>
                <p className="text-xs text-gray-400">{format(new Date(), 'yyyy년 M월', { locale: ko })}</p>
              </div>
            </div>
            <button
              onClick={() => onTabChange('schedule')}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold transition-colors"
            >
              전체보기 →
            </button>
          </div>

          <div className="px-4 pb-3">
            <div className="grid grid-cols-7 gap-0.5">
              {['일','월','화','수','목','금','토'].map((d) => (
                <div key={d} className={`text-center text-[11px] font-medium py-1 ${d === '일' ? 'text-red-400' : d === '토' ? 'text-blue-400' : 'text-gray-400'}`}>{d}</div>
              ))}
              {(() => {
                const now = new Date();
                const mStart = startOfMonth(now);
                const mEnd = endOfMonth(now);
                const calStart = startOfWeek(mStart, { weekStartsOn: 0 });
                const calEnd = endOfWeek(mEnd, { weekStartsOn: 0 });
                const days = eachDayOfInterval({ start: calStart, end: calEnd });
                return days.map((day) => {
                  const inMonth = isSameMonth(day, now);
                  const todayFlag = isToday(day);
                  const dayStr = format(day, 'yyyy-MM-dd');
                  const dayOfWeek = day.getDay();
                  const hasSchedule = monthlySchedules.some((s) => {
                    const start = s.startDate?.substring(0, 10);
                    const end = s.endDate?.substring(0, 10);
                    if (start && end) {
                      return dayStr >= start && dayStr <= end;
                    }
                    return start === dayStr;
                  });
                  const isSelected = inMonth && selectedDateStr === dayStr && !todayFlag;
                  return (
                    <div
                      key={day.toISOString()}
                      onClick={() => inMonth && setSelectedDate(day)}
                      className={`text-center py-1.5 text-xs rounded-lg relative cursor-pointer transition-colors ${
                        !inMonth ? 'text-gray-200' :
                        todayFlag && selectedDateStr === dayStr ? 'bg-emerald-500 text-white font-bold ring-2 ring-emerald-300' :
                        todayFlag ? 'bg-emerald-500 text-white font-bold' :
                        isSelected ? 'bg-blue-500 text-white font-bold' :
                        dayOfWeek === 0 ? 'text-red-500 hover:bg-red-50' :
                        dayOfWeek === 6 ? 'text-blue-500 hover:bg-blue-50' :
                        'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {format(day, 'd')}
                      {hasSchedule && inMonth && !todayFlag && !isSelected && (
                        <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-emerald-400 rounded-full" />
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>

        {/* Bottom-Right: 오늘의 일정 */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden h-80">
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">
                  {isToday(selectedDate) ? '오늘의 일정' : format(selectedDate, 'M월 d일 일정', { locale: ko })}
                </h2>
                <p className="text-xs text-gray-400">{selectedSchedules.length}개</p>
              </div>
            </div>
            <button
              onClick={() => onTabChange('schedule')}
              className="text-xs text-blue-600 hover:text-blue-700 font-semibold transition-colors"
            >
              전체보기 →
            </button>
          </div>

          <div className="px-4 pb-4 overflow-y-auto flex-1">
            {selectedSchedules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-400">
                    {isToday(selectedDate) ? '오늘 일정이 없습니다' : `${format(selectedDate, 'M월 d일')} 일정이 없습니다`}
                  </p>
                  <p className="text-xs text-gray-300 mt-0.5">월간일정에서 일정을 추가해보세요</p>
                </div>
              </div>
            ) : (
              <div className="space-y-0">
                {selectedSchedules.slice(0, 5).map((schedule, idx) => (
                  <div
                    key={schedule.id}
                    className="flex gap-3 group cursor-pointer hover:bg-blue-50 rounded-lg transition-colors"
                    onClick={() => setSelectedSchedule(schedule)}
                  >
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-blue-50 flex-shrink-0 mt-1.5" />
                      {idx < Math.min(selectedSchedules.length, 5) - 1 && (
                        <div className="w-0.5 flex-1 bg-gray-100 my-1" />
                      )}
                    </div>
                    <div className="pb-4 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-blue-600 tabular-nums">
                          {schedule.isAllDay ? '종일' : (schedule.startTime || '')}
                        </span>
                        {schedule.category && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded font-medium">
                            {schedule.category}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-800 font-medium mt-0.5 truncate">{schedule.title}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* 일정 상세 모달 */}
      {selectedSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelectedSchedule(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {selectedSchedule.category && (
                    <span className="text-xs px-2 py-0.5 bg-white/20 text-white rounded-full font-medium">
                      {selectedSchedule.category}
                    </span>
                  )}
                  {selectedSchedule.isAllDay && (
                    <span className="text-xs px-2 py-0.5 bg-white/20 text-white rounded-full font-medium">
                      종일
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setSelectedSchedule(null)}
                  className="text-white/70 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <h3 className="text-white text-lg font-bold mt-2">{selectedSchedule.title}</h3>
            </div>

            {/* 내용 */}
            <div className="px-6 py-4 space-y-4">
              {/* 날짜 */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium">날짜</p>
                  <p className="text-sm text-gray-800 font-medium">
                    {selectedSchedule.startDate ? format(new Date(selectedSchedule.startDate), 'yyyy년 M월 d일 (EEEE)', { locale: ko }) : '-'}
                    {selectedSchedule.endDate && selectedSchedule.startDate !== selectedSchedule.endDate && (
                      <> ~ {format(new Date(selectedSchedule.endDate), 'M월 d일 (EEEE)', { locale: ko })}</>
                    )}
                  </p>
                </div>
              </div>

              {/* 시간 */}
              {!selectedSchedule.isAllDay && (selectedSchedule.startTime || selectedSchedule.endTime) && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-violet-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-medium">시간</p>
                    <p className="text-sm text-gray-800 font-medium">
                      {selectedSchedule.startTime || ''}
                      {selectedSchedule.endTime && ` ~ ${selectedSchedule.endTime}`}
                    </p>
                  </div>
                </div>
              )}

              {/* 장소 */}
              {selectedSchedule.location && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-medium">장소</p>
                    <p className="text-sm text-gray-800 font-medium">{selectedSchedule.location}</p>
                  </div>
                </div>
              )}

              {/* 설명 */}
              {selectedSchedule.description && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-medium">설명</p>
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{selectedSchedule.description}</p>
                  </div>
                </div>
              )}

              {/* 참석자 */}
              {selectedSchedule.participants && selectedSchedule.participants.length > 0 && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-rose-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-medium">참석자</p>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {selectedSchedule.participants.map((p, i) => (
                        <span key={i} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full font-medium">{p}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 하단 */}
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setSelectedSchedule(null)}
                className="text-sm font-semibold text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                닫기
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
