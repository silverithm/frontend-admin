'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { motion } from 'framer-motion';
import {
  getAllMembers,
  getAllVacationRequests,
  getApprovalRequests,
  getPendingJoinRequests,
  getSchedules,
  getVacationCalendar,
} from '@/lib/apiService';

interface AdminDashboardProps {
  onTabChange: (tab: string) => void;
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

interface ApprovalItem {
  id: string;
  status?: string;
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
}

interface VacationCalendarItem {
  id: string;
  userName?: string;
  memberName?: string;
  name?: string;
  vacationType?: string;
  duration?: string;
}

export default function AdminDashboard({ onTabChange }: AdminDashboardProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [members, setMembers] = useState<unknown[]>([]);
  const [vacationRequests, setVacationRequests] = useState<VacationItem[]>([]);
  const [approvalRequests, setApprovalRequests] = useState<ApprovalItem[]>([]);
  const [pendingJoinRequests, setPendingJoinRequests] = useState<unknown[]>([]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [vacationCalendar, setVacationCalendar] = useState<VacationCalendarItem[]>([]);
  const [currentTime, setCurrentTime] = useState(format(new Date(), 'HH:mm:ss'));

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

      const results = await Promise.allSettled([
        getAllMembers(),
        getAllVacationRequests(),
        getApprovalRequests({ status: 'PENDING' }),
        getPendingJoinRequests(),
        getSchedules(todayStr, todayStr),
        getVacationCalendar(todayStr, todayStr),
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

      setIsLoading(false);
    };

    loadData();
  }, []);

  const pendingVacationCount = vacationRequests.filter(
    (v) => v.status === 'pending' || v.status === 'PENDING'
  ).length;

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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" style={{ gridAutoRows: '5.5rem' }}>
        {statCards.map((card, idx) => (
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

      {/* 3. Two-column: 오늘의 일정 + 오늘 휴무자 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-3"
      >
        {/* Left: 오늘의 일정 (Timeline) */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden h-80">
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">오늘의 일정</h2>
                <p className="text-xs text-gray-400">{schedules.length}개</p>
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
            {schedules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-400">오늘 일정이 없습니다</p>
                  <p className="text-xs text-gray-300 mt-0.5">월간일정에서 일정을 추가해보세요</p>
                </div>
              </div>
            ) : (
              <div className="space-y-0">
                {schedules.slice(0, 6).map((schedule, idx) => (
                  <div key={schedule.id} className="flex gap-3 group">
                    {/* Timeline line + dot */}
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-blue-50 flex-shrink-0 mt-1.5" />
                      {idx < Math.min(schedules.length, 6) - 1 && (
                        <div className="w-0.5 flex-1 bg-gray-100 my-1" />
                      )}
                    </div>

                    {/* Content */}
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

        {/* Right: 오늘 휴무자 */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden h-80">
          <div className="px-4 pt-4 pb-2 flex items-center gap-2.5">
            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m8.66-9h-1M4.34 12h-1m14.95-6.95l-.7.7M6.41 17.59l-.7.7m12.02 0l-.7-.7M6.41 6.41l-.7-.7M12 7a5 5 0 100 10A5 5 0 0012 7z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">오늘 휴무자</h2>
              <p className="text-xs text-gray-400">{vacationCalendar.length}명</p>
            </div>
          </div>

          <div className="px-4 pb-4 overflow-y-auto flex-1">
            {vacationCalendar.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-400">오늘 휴무자가 없습니다</p>
                  <p className="text-xs text-gray-300 mt-0.5">전원 근무 중입니다</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {vacationCalendar.slice(0, 3).map((item) => {
                  const name = item.userName || item.memberName || item.name || '?';
                  const colorIdx = name.charCodeAt(0) % avatarColors.length;
                  const typeText = [item.vacationType, item.duration].filter(Boolean).join(' · ') || '휴무';

                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className={`w-9 h-9 rounded-full ${avatarColors[colorIdx]} flex items-center justify-center flex-shrink-0`}>
                        <span className="text-xs font-bold text-white">{name.charAt(0)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800">{name}</p>
                        <p className="text-xs text-gray-400">{typeText}</p>
                      </div>
                      <div className="px-2 py-0.5 bg-orange-100 text-orange-600 text-[10px] font-semibold rounded-full flex-shrink-0">
                        휴무
                      </div>
                    </div>
                  );
                })}
                {vacationCalendar.length > 3 && (
                  <p className="text-xs text-gray-400 text-center pt-1">외 {vacationCalendar.length - 3}명</p>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
