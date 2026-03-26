'use client';

import { useState, useEffect, useMemo } from 'react';
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
  getCompanyElderCount,
  getEmployeeAttendanceSummary,
  getElderAttendanceSummary,
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
  status?: string;
  vacationType?: string;
  duration?: string;
}

interface MemberItem {
  status?: string;
}

export default function AdminDashboard({ onTabChange, isAdmin = true }: AdminDashboardProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [vacationRequests, setVacationRequests] = useState<VacationItem[]>([]);
  const [approvalRequests, setApprovalRequests] = useState<ApprovalItem[]>([]);
  const [pendingJoinRequests, setPendingJoinRequests] = useState<unknown[]>([]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [vacationCalendar, setVacationCalendar] = useState<VacationCalendarItem[]>([]);
  const [todayVacationCount, setTodayVacationCount] = useState(0);
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [monthlySchedules, setMonthlySchedules] = useState<ScheduleItem[]>([]);
  const [currentTime, setCurrentTime] = useState(format(new Date(), 'HH:mm:ss'));
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleItem | null>(null);
  const [elderCount, setElderCount] = useState(0);
  const [employeeAttendance, setEmployeeAttendance] = useState({ total: 0, present: 0, absent: 0, vacation: 0 });
  const [elderAttendance, setElderAttendance] = useState({ total: 0, present: 0, absent: 0 });

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
        getCompanyElderCount(),
        getEmployeeAttendanceSummary(todayStr),
        getElderAttendanceSummary(todayStr),
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
        setMembers(extractArray(results[0].value, 'members', 'content', 'data') as MemberItem[]);
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
          const datesObj = d.dates as Record<
            string,
            {
              people?: VacationCalendarItem[];
              vacations?: VacationCalendarItem[];
              count?: number;
              totalVacationers?: number;
            }
          >;
          const todayData = datesObj[todayStr];
          if (todayData) {
            const rawPeople = todayData.people || todayData.vacations || [];
            const visiblePeople = rawPeople.filter((person) => person.status !== 'rejected');
            const visibleCount = rawPeople.length > 0
              ? visiblePeople.length
              : typeof todayData.totalVacationers === 'number'
                ? todayData.totalVacationers
                : typeof todayData.count === 'number'
                  ? todayData.count
                  : visiblePeople.length;

            setVacationCalendar(visiblePeople as VacationCalendarItem[]);
            setTodayVacationCount(visibleCount);
          } else {
            setVacationCalendar([]);
            setTodayVacationCount(0);
          }
        } else if (Array.isArray(d)) {
          const visiblePeople = (d as VacationCalendarItem[]).filter((person) => person.status !== 'rejected');
          setVacationCalendar(visiblePeople);
          setTodayVacationCount(visiblePeople.length);
        } else {
          setVacationCalendar([]);
          setTodayVacationCount(0);
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

      if (results[8].status === 'fulfilled') {
        const d = results[8].value as Record<string, unknown>;
        const count = typeof d?.count === 'number' ? d.count : 0;
        setElderCount(count);
      }

      if (results[9].status === 'fulfilled') {
        const d = results[9].value as Record<string, number>;
        if (d && typeof d.total === 'number') {
          setEmployeeAttendance({
            total: d.total || 0,
            present: d.present || 0,
            absent: d.absent || 0,
            vacation: d.vacation || 0,
          });
        }
      }

      if (results[10].status === 'fulfilled') {
        const d = results[10].value as Record<string, number>;
        if (d && typeof d.total === 'number') {
          setElderAttendance({
            total: d.total || 0,
            present: d.present || 0,
            absent: d.absent || 0,
          });
        }
      }

      setIsLoading(false);
    };

    loadData();
  }, []);

  const pendingVacationCount = vacationRequests.filter(
    (v) => v.status === 'pending' || v.status === 'PENDING'
  ).length;
  const hasMemberStatus = members.some((member) => typeof member.status === 'string' && member.status.length > 0);
  const activeMembersCount = members.filter((member) => {
    if (!member.status) return true;
    const normalizedStatus = member.status.toLowerCase();
    return normalizedStatus === 'active' || normalizedStatus === 'approved';
  }).length;
  const visibleMembersCount = hasMemberStatus ? activeMembersCount : members.length;
  const employeeAttendanceBase = employeeAttendance.total || visibleMembersCount;
  const elderAttendanceBase = elderAttendance.total || elderCount;
  const todayWorkingCount = Math.max(visibleMembersCount - todayVacationCount, 0);

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const selectedSchedules = monthlySchedules.filter((s) => {
    const start = s.startDate?.substring(0, 10);
    const end = s.endDate?.substring(0, 10);
    if (start && end) {
      return selectedDateStr >= start && selectedDateStr <= end;
    }
    return start === selectedDateStr;
  });

  const monthlyScheduleDateSet = useMemo(() => {
    const dateSet = new Set<string>();

    monthlySchedules.forEach((schedule) => {
      const start = schedule.startDate?.substring(0, 10);
      const end = schedule.endDate?.substring(0, 10);

      if (!start) return;

      if (!end || end < start) {
        dateSet.add(start);
        return;
      }

      const cursor = new Date(`${start}T00:00:00`);
      const endDate = new Date(`${end}T00:00:00`);

      while (cursor <= endDate) {
        dateSet.add(format(cursor, 'yyyy-MM-dd'));
        cursor.setDate(cursor.getDate() + 1);
      }
    });

    return dateSet;
  }, [monthlySchedules]);

  const monthlyCalendarDays = useMemo(() => {
    const today = new Date();
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    return {
      weeksCount: Math.ceil(days.length / 7),
      days: days.map((day) => {
        const dayStr = format(day, 'yyyy-MM-dd');

        return {
          date: day,
          dayStr,
          inMonth: isSameMonth(day, today),
          todayFlag: isToday(day),
          dayOfWeek: day.getDay(),
          hasSchedule: monthlyScheduleDateSet.has(dayStr),
        };
      }),
    };
  }, [monthlyScheduleDateSet]);

  if (isLoading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-5 pb-4">
        <div className="h-14" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white border border-gray-100 animate-pulse rounded-xl h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 flex-1">
          <div className="bg-white border border-gray-100 animate-pulse rounded-xl min-h-[340px]" />
          <div className="bg-white border border-gray-100 animate-pulse rounded-xl min-h-[340px]" />
          <div className="bg-white border border-gray-100 animate-pulse rounded-xl min-h-[340px]" />
          <div className="bg-white border border-gray-100 animate-pulse rounded-xl min-h-[340px]" />
        </div>
      </div>
    );
  }

  const statCards = [
    {
      label: '총 직원',
      value: visibleMembersCount,
      subtitle: '명',
      iconBg: 'bg-teal-50',
      iconColor: 'text-teal-500',
      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
      tab: 'members',
      change: null as string | null,
    },
    {
      label: '출근',
      value: todayWorkingCount,
      subtitle: '명',
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-500',
      icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
      tab: 'members',
      change: employeeAttendanceBase > 0 ? `${Math.round((todayWorkingCount / employeeAttendanceBase) * 100)}%` : null,
    },
    {
      label: '오늘 휴무',
      value: todayVacationCount,
      subtitle: '명',
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-500',
      icon: 'M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z',
      tab: 'work',
      change: employeeAttendanceBase > 0 ? `${Math.round((todayVacationCount / employeeAttendanceBase) * 100)}%` : null,
    },
    {
      label: '총 어르신',
      value: elderCount,
      subtitle: '명',
      iconBg: 'bg-rose-50',
      iconColor: 'text-rose-500',
      icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
      tab: 'members',
      change: null as string | null,
    },
    {
      label: '등원',
      value: elderAttendance.present,
      subtitle: '명',
      iconBg: 'bg-violet-50',
      iconColor: 'text-violet-500',
      icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
      tab: 'members',
      change: elderAttendanceBase > 0 ? `${Math.round((elderAttendance.present / elderAttendanceBase) * 100)}%` : null,
    },
    {
      label: '결석',
      value: elderAttendance.absent,
      subtitle: '명',
      iconBg: 'bg-gray-50',
      iconColor: 'text-gray-400',
      icon: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636',
      tab: 'members',
      change: null as string | null,
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 pb-4">
      {/* 1. Header Bar */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-gray-900 text-xl font-bold">
            {(() => { const h = new Date().getHours(); return h < 12 ? '좋은 아침이에요' : h < 18 ? '좋은 오후예요' : '좋은 저녁이에요'; })()}
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {format(new Date(), 'yyyy년 M월 d일 (EEEE)', { locale: ko })}
          </p>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-3xl font-bold text-gray-900 font-mono tabular-nums tracking-tight">{currentTime}</p>
        </div>
      </motion.div>

      {/* 2. Stat Cards - White background */}
      <div className={`grid gap-3 ${isAdmin ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6' : 'grid-cols-1'}`}>
        {statCards.filter((card) => isAdmin || card.label === '총 직원').map((card, idx) => (
          <motion.button
            key={card.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.03 + idx * 0.03 }}
            onClick={() => onTabChange(card.tab)}
            className="bg-white border border-gray-200 rounded-2xl p-4 text-left hover:border-gray-300 hover:shadow-md transition-all duration-200 group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 ${card.iconBg} rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-200`}>
                <svg className={`w-5 h-5 ${card.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={card.icon} />
                </svg>
              </div>
              {card.change && (
                <span className="text-[10px] font-semibold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">{card.change}</span>
              )}
            </div>
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-gray-900 tabular-nums">{card.value}</span>
                <span className="text-gray-400 text-xs font-medium">{card.subtitle}</span>
              </div>
              <span className="text-[11px] font-medium text-gray-400 mt-0.5 block">{card.label}</span>
            </div>
          </motion.button>
        ))}
      </div>

      {/* 3. Four-panel grid: 공지사항, 전자결재, 월간일정, 오늘의 일정 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
        className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-2 lg:auto-rows-fr"
      >
        {/* Top-Left: 공지사항 */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden min-h-[340px] flex h-full flex-col">
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

          <div className="px-4 pb-4 overflow-y-auto flex-1 min-h-0">
            {notices.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3">
                <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-xs font-medium text-gray-400">공지사항이 없습니다</p>
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
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden min-h-[340px] flex h-full flex-col">
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

          <div className="px-4 pb-4 overflow-y-auto flex-1 min-h-0">
            {approvalRequests.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3">
                <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-xs font-medium text-gray-400">대기 중인 결재가 없습니다</p>
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
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden min-h-[340px] flex h-full flex-col">
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

          <div className="px-4 pb-3 flex-1 min-h-0">
            <div
              className="grid h-full grid-cols-7 gap-0.5"
              style={{ gridTemplateRows: `auto repeat(${monthlyCalendarDays.weeksCount}, minmax(0, 1fr))` }}
            >
              {['일','월','화','수','목','금','토'].map((d) => (
                <div key={d} className={`flex h-6 items-center justify-center text-center text-[11px] font-medium ${d === '일' ? 'text-red-400' : d === '토' ? 'text-blue-400' : 'text-gray-400'}`}>{d}</div>
              ))}
              {monthlyCalendarDays.days.map(({ date, dayStr, inMonth, todayFlag, dayOfWeek, hasSchedule }) => {
                const isSelected = inMonth && selectedDateStr === dayStr && !todayFlag;

                return (
                  <button
                    key={date.toISOString()}
                    type="button"
                    onClick={() => inMonth && setSelectedDate(date)}
                    className={`relative flex h-full min-h-[2.75rem] items-center justify-center rounded-lg text-xs transition-colors ${
                      !inMonth ? 'cursor-default text-gray-300' :
                      todayFlag && selectedDateStr === dayStr ? 'bg-emerald-500 text-white font-bold ring-2 ring-emerald-300' :
                      todayFlag ? 'bg-emerald-500 text-white font-bold' :
                      isSelected ? 'bg-teal-500 text-white font-bold' :
                      dayOfWeek === 0 ? 'text-red-500 hover:bg-red-50' :
                      dayOfWeek === 6 ? 'text-blue-500 hover:bg-blue-50' :
                      'text-gray-700 hover:bg-gray-100'
                    }`}
                    disabled={!inMonth}
                  >
                    {format(date, 'd')}
                    {hasSchedule && inMonth && !todayFlag && !isSelected && (
                      <div className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-emerald-400" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom-Right: 오늘의 일정 */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden min-h-[340px] flex h-full flex-col">
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-teal-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              className="text-xs text-teal-600 hover:text-teal-700 font-semibold transition-colors"
            >
              전체보기 →
            </button>
          </div>

          <div className="px-4 pb-4 overflow-y-auto flex-1 min-h-0">
            {selectedSchedules.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3">
                <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-xs font-medium text-gray-400">
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
                    className="flex gap-3 group cursor-pointer hover:bg-teal-50 rounded-lg transition-colors"
                    onClick={() => setSelectedSchedule(schedule)}
                  >
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className="w-2.5 h-2.5 rounded-full bg-teal-500 ring-4 ring-teal-50 flex-shrink-0 mt-1.5" />
                      {idx < Math.min(selectedSchedules.length, 5) - 1 && (
                        <div className="w-0.5 flex-1 bg-gray-100 my-1" />
                      )}
                    </div>
                    <div className="pb-4 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-teal-600 tabular-nums">
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
            <div className="bg-gradient-to-r from-teal-500 to-teal-600 px-6 py-4">
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
                <div className="w-8 h-8 bg-teal-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
