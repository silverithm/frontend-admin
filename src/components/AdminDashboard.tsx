'use client';

import { useState, useEffect, useMemo, type CSSProperties } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isToday } from 'date-fns';
import { ko } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { Text } from '@astryxdesign/core/Text';
import { Card } from '@astryxdesign/core/Card';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Skeleton } from '@astryxdesign/core/Skeleton';
import { ClickableCard } from '@astryxdesign/core/ClickableCard';
import { VStack, HStack } from '@astryxdesign/core/Stack';
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
  participants?: { id: number; memberName: string; userName?: string; status?: string }[];
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

const iconBox = (background: string, size = 32, radius = 8): CSSProperties => ({
  width: size,
  height: size,
  borderRadius: radius,
  background,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
});

const viewAllStyle = (color: string): CSSProperties => ({
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color,
  fontSize: 12,
  fontWeight: 600,
  padding: 0,
});

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
  const [showDaySchedules, setShowDaySchedules] = useState(false);
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

      // 직원은 기본 데이터만 로드, 관리자는 전체 데이터 로드
      const apiCalls = isAdmin
        ? [
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
          ]
        : [
            getAllMembers(),
            Promise.resolve({ requests: [] }),
            Promise.resolve({ approvals: [] }),
            Promise.resolve([]),
            getSchedules(todayStr, todayStr),
            Promise.resolve({ dates: {} }),
            getNotices(),
            getSchedules(monthStartStr, monthEndStr),
            Promise.resolve({ count: 0 }),
            Promise.resolve({ total: 0, present: 0, absent: 0, vacation: 0 }),
            Promise.resolve({ total: 0, present: 0, absent: 0 }),
          ];
      const results = await Promise.allSettled(apiCalls);

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
        const raw = results[7].value;
        console.log('[Dashboard] 월간일정 raw:', JSON.stringify(raw).substring(0, 500));
        const arr = extractArray(raw, 'schedules', 'content', 'data');
        console.log('[Dashboard] 월간일정 parsed:', arr.length, '건');
        setMonthlySchedules(arr as ScheduleItem[]);
      } else {
        console.error('[Dashboard] 월간일정 API 실패:', results[7]);
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
  }, [isAdmin]);

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

  const monthlySchedulesByDay = useMemo(() => {
    const dayMap = new Map<string, ScheduleItem[]>();
    const push = (key: string, schedule: ScheduleItem) => {
      const list = dayMap.get(key);
      if (list) list.push(schedule);
      else dayMap.set(key, [schedule]);
    };

    monthlySchedules.forEach((schedule) => {
      const start = schedule.startDate?.substring(0, 10);
      const end = schedule.endDate?.substring(0, 10);

      if (!start) return;

      if (!end || end < start) {
        push(start, schedule);
        return;
      }

      const cursor = new Date(`${start}T00:00:00`);
      const endDate = new Date(`${end}T00:00:00`);

      while (cursor <= endDate) {
        push(format(cursor, 'yyyy-MM-dd'), schedule);
        cursor.setDate(cursor.getDate() + 1);
      }
    });

    return dayMap;
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
        const daySchedules = monthlySchedulesByDay.get(dayStr) || [];

        return {
          date: day,
          dayStr,
          inMonth: isSameMonth(day, today),
          todayFlag: isToday(day),
          dayOfWeek: day.getDay(),
          scheduleCount: daySchedules.length,
          daySchedules,
        };
      }),
    };
  }, [monthlySchedulesByDay]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', minHeight: 0, flex: 1, flexDirection: 'column', gap: 20, paddingBottom: 16 }}>
        <div style={{ height: 56 }} />
        <div className={isAdmin ? 'carev-dash-stats' : 'carev-dash-stats-emp'} style={{ display: 'grid', gap: 12 }}>
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} height={96} radius={3} index={i} />
          ))}
        </div>
        <div className="carev-dash-panels" style={{ display: 'grid', gap: 12, flex: 1 }}>
          <Skeleton height={340} radius={3} />
          <Skeleton height={340} radius={3} />
          <div className="carev-dash-panel-full">
            <Skeleton height={480} radius={3} />
          </div>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      label: '총 직원',
      value: visibleMembersCount,
      subtitle: '명',
      iconBg: '#f0fdfa',
      iconColor: '#14b8a6',
      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
      tab: isAdmin ? 'members' : 'work',
      change: null as string | null,
      adminOnly: false,
    },
    {
      label: '오늘 일정',
      value: schedules.length,
      subtitle: '건',
      iconBg: '#eff6ff',
      iconColor: '#3b82f6',
      icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
      tab: 'schedule',
      change: null as string | null,
      employeeOnly: true,
      adminOnly: false,
    },
    {
      label: '공지사항',
      value: notices.length,
      subtitle: '건',
      iconBg: '#eef2ff',
      iconColor: '#6366f1',
      icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
      tab: 'notice',
      change: null as string | null,
      employeeOnly: true,
      adminOnly: false,
    },
    {
      label: '출근',
      value: todayWorkingCount,
      subtitle: '명',
      iconBg: '#ecfdf5',
      iconColor: '#10b981',
      icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
      tab: 'members',
      change: employeeAttendanceBase > 0 ? `${Math.round((todayWorkingCount / employeeAttendanceBase) * 100)}%` : null,
      adminOnly: true,
    },
    {
      label: '오늘 휴무',
      value: todayVacationCount,
      subtitle: '명',
      iconBg: '#fffbeb',
      iconColor: '#f59e0b',
      icon: 'M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z',
      tab: 'work',
      change: employeeAttendanceBase > 0 ? `${Math.round((todayVacationCount / employeeAttendanceBase) * 100)}%` : null,
      adminOnly: true,
    },
    {
      label: '총 어르신',
      value: elderCount,
      subtitle: '명',
      iconBg: '#fff1f2',
      iconColor: '#f43f5e',
      icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
      tab: 'members',
      change: null as string | null,
      adminOnly: true,
    },
    {
      label: '등원',
      value: elderAttendance.present,
      subtitle: '명',
      iconBg: '#f5f3ff',
      iconColor: '#8b5cf6',
      icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
      tab: 'members',
      change: elderAttendanceBase > 0 ? `${Math.round((elderAttendance.present / elderAttendanceBase) * 100)}%` : null,
      adminOnly: true,
    },
    {
      label: '결석',
      value: elderAttendance.absent,
      subtitle: '명',
      iconBg: '#f9fafb',
      iconColor: '#9ca3af',
      icon: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636',
      tab: 'members',
      change: null as string | null,
      adminOnly: true,
    },
  ];

  const visibleStatCards = statCards.filter((card) => {
    if (isAdmin) return !(card as { employeeOnly?: boolean }).employeeOnly;
    return !card.adminOnly;
  });

  return (
    <div style={{ display: 'flex', minHeight: 0, flex: 1, flexDirection: 'column', gap: 20, paddingBottom: 16 }}>
      {/* 1. Header Bar */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <VStack gap={0.5} align="start">
          <Text type="large" weight="bold" color="primary">
            {(() => { const h = new Date().getHours(); return h < 12 ? '좋은 아침이에요' : h < 18 ? '좋은 오후예요' : '좋은 저녁이에요'; })()}
          </Text>
          <Text type="supporting" color="secondary">
            {format(new Date(), 'yyyy년 M월 d일 (EEEE)', { locale: ko })}
          </Text>
        </VStack>
        <div className="carev-dash-clock" style={{ textAlign: 'right' }}>
          <Text type="display-3" weight="bold" color="primary" hasTabularNumbers>{currentTime}</Text>
        </div>
      </motion.div>

      {/* 2. Stat Cards */}
      <div className={isAdmin ? 'carev-dash-stats' : 'carev-dash-stats-emp'} style={{ display: 'grid', gap: 12 }}>
        {visibleStatCards.map((card, idx) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.03 + idx * 0.03 }}
          >
            <ClickableCard label={card.label} onClick={() => onTabChange(card.tab)} padding={4} height="100%">
              <VStack gap={3} align="stretch">
                <HStack hAlign="between" vAlign="center">
                  <div style={iconBox(card.iconBg, 40, 12)}>
                    <svg width={20} height={20} fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: card.iconColor }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={card.icon} />
                    </svg>
                  </div>
                  {card.change && <Badge variant="teal" label={card.change} />}
                </HStack>
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <Text type="large" weight="bold" color="primary" hasTabularNumbers>{card.value}</Text>
                    <Text type="supporting" color="secondary">{card.subtitle}</Text>
                  </div>
                  <Text as="p" type="supporting" color="secondary">{card.label}</Text>
                </div>
              </VStack>
            </ClickableCard>
          </motion.div>
        ))}
      </div>

      {/* 3. Three-panel grid: 공지사항, 전자결재, 월간일정(하단 전체) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
        className="carev-dash-panels"
        style={{ display: 'grid', minHeight: 0, flex: 1, gap: 12 }}
      >
        {/* Top-Left: 공지사항 */}
        <Card padding={0} height="100%" minHeight={340}>
          <VStack gap={0} height="100%">
            <div style={{ padding: '16px 16px 8px' }}>
              <HStack hAlign="between" vAlign="center">
                <HStack gap={2} vAlign="center">
                  <div style={iconBox('#fef3c7')}>
                    <svg width={16} height={16} fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#d97706' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                    </svg>
                  </div>
                  <VStack gap={0} align="start">
                    <Text type="body" weight="bold" color="primary">공지사항</Text>
                    <Text type="supporting" color="secondary">{notices.length}개</Text>
                  </VStack>
                </HStack>
                <button
                  onClick={() => onTabChange('notice')}
                  className="carev-dash-viewall"
                  style={viewAllStyle('#d97706')}
                >
                  전체보기 →
                </button>
              </HStack>
            </div>

            <div style={{ padding: '0 16px 16px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
              {notices.length === 0 ? (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <EmptyState
                    isCompact
                    title="공지사항이 없습니다"
                    icon={
                      <svg width={24} height={24} fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#d1d5db' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                      </svg>
                    }
                  />
                </div>
              ) : (
                <VStack gap={1}>
                  {notices.slice(0, 5).map((notice) => (
                    <div
                      key={notice.id}
                      className="carev-dash-row"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 10, borderRadius: 12 }}
                      onClick={() => onTabChange('notice')}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <HStack gap={2} vAlign="center">
                          {notice.priority === 'HIGH' && <Badge variant="red" label="중요" />}
                          <Text type="body" weight="medium" color="primary" maxLines={1}>{notice.title}</Text>
                        </HStack>
                        <Text type="supporting" color="secondary">
                          {notice.authorName && `${notice.authorName} · `}
                          {notice.createdAt ? format(new Date(notice.createdAt), 'M.d') : ''}
                        </Text>
                      </div>
                    </div>
                  ))}
                </VStack>
              )}
            </div>
          </VStack>
        </Card>

        {/* Top-Right: 전자결재 */}
        <Card padding={0} height="100%" minHeight={340}>
          <VStack gap={0} height="100%">
            <div style={{ padding: '16px 16px 8px' }}>
              <HStack hAlign="between" vAlign="center">
                <HStack gap={2} vAlign="center">
                  <div style={iconBox('#ede9fe')}>
                    <svg width={16} height={16} fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#7c3aed' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <VStack gap={0} align="start">
                    <Text type="body" weight="bold" color="primary">전자결재</Text>
                    <Text type="supporting" color="secondary">대기 {approvalRequests.length}건</Text>
                  </VStack>
                </HStack>
                <button
                  onClick={() => onTabChange('approval')}
                  className="carev-dash-viewall"
                  style={viewAllStyle('#7c3aed')}
                >
                  전체보기 →
                </button>
              </HStack>
            </div>

            <div style={{ padding: '0 16px 16px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
              {approvalRequests.length === 0 ? (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <EmptyState
                    isCompact
                    title="대기 중인 결재가 없습니다"
                    icon={
                      <svg width={24} height={24} fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#d1d5db' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    }
                  />
                </div>
              ) : (
                <VStack gap={1}>
                  {approvalRequests.slice(0, 5).map((approval) => (
                    <div
                      key={approval.id}
                      className="carev-dash-row"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 10, borderRadius: 12 }}
                      onClick={() => onTabChange('approval')}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text as="p" type="body" weight="medium" color="primary" maxLines={1}>
                          {approval.title || approval.templateName || '결재 요청'}
                        </Text>
                        <Text type="supporting" color="secondary">
                          {approval.requesterName && `${approval.requesterName} · `}
                          {approval.createdAt ? format(new Date(approval.createdAt), 'M.d') : ''}
                        </Text>
                      </div>
                      <div style={{ flexShrink: 0 }}>
                        <Badge variant="orange" label="대기" />
                      </div>
                    </div>
                  ))}
                </VStack>
              )}
            </div>
          </VStack>
        </Card>

        {/* Bottom: 월간일정 (하단 전체 폭) */}
        <div className="carev-dash-panel-full">
          <Card padding={0} height="100%" minHeight={480}>
            <VStack gap={0} height="100%">
              <div style={{ padding: '16px 16px 8px' }}>
                <HStack hAlign="between" vAlign="center">
                  <HStack gap={2} vAlign="center">
                    <div style={iconBox('#d1fae5')}>
                      <svg width={16} height={16} fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#059669' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <VStack gap={0} align="start">
                      <Text type="body" weight="bold" color="primary">월간일정</Text>
                      <Text type="supporting" color="secondary">
                        {format(new Date(), 'yyyy년 M월', { locale: ko })} · {monthlySchedules.length}건
                      </Text>
                    </VStack>
                  </HStack>
                  <button
                    onClick={() => onTabChange('schedule')}
                    className="carev-dash-viewall"
                    style={viewAllStyle('#059669')}
                  >
                    전체보기 →
                  </button>
                </HStack>
              </div>

              <div style={{ padding: '0 16px 12px', flex: 1, minHeight: 0 }}>
                <div
                  style={{ display: 'grid', height: '100%', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4, gridTemplateRows: `auto repeat(${monthlyCalendarDays.weeksCount}, minmax(0, 1fr))` }}
                >
                  {['일','월','화','수','목','금','토'].map((d) => (
                    <div key={d} style={{ display: 'flex', height: 28, alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontSize: 12, fontWeight: 500, color: d === '일' ? '#f87171' : d === '토' ? '#60a5fa' : '#9ca3af' }}>{d}</div>
                  ))}
                  {monthlyCalendarDays.days.map(({ date, dayStr, inMonth, todayFlag, dayOfWeek, scheduleCount, daySchedules }) => {
                    const maxChips = 2;

                    return (
                      <button
                        key={date.toISOString()}
                        type="button"
                        onClick={() => {
                          if (!inMonth) return;
                          setSelectedDate(date);
                          setShowDaySchedules(true);
                        }}
                        className={!inMonth ? undefined : todayFlag ? 'carev-dash-cal-cell carev-dash-cal-cell-today' : 'carev-dash-cal-cell carev-dash-cal-cell-day'}
                        style={{
                          position: 'relative', display: 'flex', height: '100%', minHeight: 60,
                          flexDirection: 'column', alignItems: 'stretch', gap: 2, borderRadius: 8, padding: 4, textAlign: 'left',
                          background: !inMonth ? 'transparent' : todayFlag ? 'rgba(16, 185, 129, 0.06)' : 'transparent',
                          border: `1px solid ${!inMonth ? 'transparent' : todayFlag ? '#a7f3d0' : 'transparent'}`,
                          cursor: !inMonth ? 'default' : 'pointer',
                        }}
                        disabled={!inMonth}
                      >
                        <span
                          style={{
                            display: 'flex', height: 24, width: 24, flexShrink: 0, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', borderRadius: '9999px', fontSize: 12,
                            ...(
                              !inMonth ? { color: '#d1d5db' } :
                              todayFlag ? { background: '#10b981', fontWeight: 700, color: '#fff' } :
                              dayOfWeek === 0 ? { fontWeight: 500, color: '#ef4444' } :
                              dayOfWeek === 6 ? { fontWeight: 500, color: '#3b82f6' } :
                              { fontWeight: 500, color: 'var(--color-text-gray)' }
                            ),
                          }}
                        >
                          {format(date, 'd')}
                        </span>
                        {scheduleCount > 0 && inMonth && (
                          <>
                            {/* 모바일: 도트 표시 */}
                            <div className="carev-dash-cal-dots" style={{ alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                              {Array.from({ length: Math.min(scheduleCount, 3) }).map((_, i) => (
                                <div key={i} style={{ height: 4, width: 4, borderRadius: '9999px', background: '#34d399' }} />
                              ))}
                              {scheduleCount > 3 && (
                                <span style={{ fontSize: 7, fontWeight: 700, lineHeight: 1, color: '#10b981' }}>+{scheduleCount - 3}</span>
                              )}
                            </div>
                            {/* 데스크탑: 일정 제목 칩 표시 */}
                            <div className="carev-dash-cal-chips" style={{ minHeight: 0, flexDirection: 'column', gap: 2, overflow: 'hidden' }}>
                              {daySchedules.slice(0, maxChips).map((schedule, i) => (
                                <span
                                  key={`${schedule.id}-${i}`}
                                  style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderRadius: 4, background: 'rgba(16, 185, 129, 0.12)', padding: '1px 4px', fontSize: 10, fontWeight: 500, lineHeight: '16px', color: '#047857' }}
                                >
                                  {schedule.title}
                                </span>
                              ))}
                              {scheduleCount > maxChips && (
                                <span style={{ padding: '0 4px', fontSize: 9, fontWeight: 600, lineHeight: '12px', color: '#9ca3af' }}>
                                  +{scheduleCount - maxChips}개 더보기
                                </span>
                              )}
                            </div>
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </VStack>
          </Card>
        </div>
      </motion.div>

      {/* 날짜별 일정 목록 팝업 */}
      {showDaySchedules && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setShowDaySchedules(false)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(4px)' }} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            style={{ position: 'relative', background: 'var(--color-background-card)', borderRadius: 16, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)', width: '100%', maxWidth: 448, overflow: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ background: 'linear-gradient(90deg, #10b981, #14b8a6)', padding: '16px 24px', color: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text type="large" weight="bold" color="inherit">
                  {isToday(selectedDate) ? '오늘의 일정' : format(selectedDate, 'M월 d일 (EEEE)', { locale: ko })}
                </Text>
                <button
                  onClick={() => setShowDaySchedules(false)}
                  aria-label="닫기"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', display: 'flex' }}
                >
                  <svg width={20} height={20} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div style={{ marginTop: 4 }}>
                <Text type="supporting" color="inherit">총 {selectedSchedules.length}개의 일정</Text>
              </div>
            </div>

            <div style={{ padding: '16px 24px', maxHeight: '50vh', overflowY: 'auto' }}>
              {selectedSchedules.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '32px 0' }}>
                  <EmptyState
                    isCompact
                    title={`${format(selectedDate, 'M월 d일')} 일정이 없습니다`}
                    icon={
                      <svg width={24} height={24} fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#d1d5db' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    }
                  />
                </div>
              ) : (
                <VStack gap={0}>
                  {selectedSchedules.map((schedule, idx) => (
                    <div
                      key={schedule.id}
                      className="carev-dash-timeline"
                      style={{ display: 'flex', gap: 12, borderRadius: 8, padding: '0 8px', margin: '0 -8px' }}
                      onClick={() => {
                        setShowDaySchedules(false);
                        setSelectedSchedule(schedule);
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '9999px', background: '#14b8a6', boxShadow: '0 0 0 4px #f0fdfa', flexShrink: 0, marginTop: 6 }} />
                        {idx < selectedSchedules.length - 1 && (
                          <div style={{ width: 2, flex: 1, background: 'var(--color-background-muted)', margin: '4px 0' }} />
                        )}
                      </div>
                      <div style={{ paddingBottom: 16, flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Text type="supporting" weight="semibold" color="accent" hasTabularNumbers>
                            {schedule.isAllDay ? '종일' : (schedule.startTime || '')}
                          </Text>
                          {schedule.category && <Badge variant="neutral" label={schedule.category} />}
                        </div>
                        <div style={{ marginTop: 2 }}>
                          <Text as="p" type="body" weight="medium" color="primary" maxLines={1}>{schedule.title}</Text>
                        </div>
                        {schedule.location && (
                          <Text as="p" type="supporting" color="secondary" maxLines={1}>{schedule.location}</Text>
                        )}
                      </div>
                      <svg width={16} height={16} fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#d1d5db', flexShrink: 0, alignSelf: 'center' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  ))}
                </VStack>
              )}
            </div>

            <div style={{ padding: '12px 24px', background: 'var(--color-background-muted)', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Button
                label="월간일정 전체보기"
                variant="ghost"
                onClick={() => {
                  setShowDaySchedules(false);
                  onTabChange('schedule');
                }}
              />
              <Button
                label="닫기"
                variant="secondary"
                onClick={() => setShowDaySchedules(false)}
              />
            </div>
          </motion.div>
        </div>
      )}

      {/* 일정 상세 모달 */}
      {selectedSchedule && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setSelectedSchedule(null)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(4px)' }} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            style={{ position: 'relative', background: 'var(--color-background-card)', borderRadius: 16, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)', width: '100%', maxWidth: 448, overflow: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div style={{ background: 'linear-gradient(90deg, #14b8a6, #0d9488)', padding: '16px 24px', color: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {selectedSchedule.category && (
                    <span style={{ fontSize: 12, padding: '2px 8px', background: 'rgba(255,255,255,0.2)', color: '#fff', borderRadius: 9999, fontWeight: 500 }}>
                      {selectedSchedule.category}
                    </span>
                  )}
                  {selectedSchedule.isAllDay && (
                    <span style={{ fontSize: 12, padding: '2px 8px', background: 'rgba(255,255,255,0.2)', color: '#fff', borderRadius: 9999, fontWeight: 500 }}>
                      종일
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setSelectedSchedule(null)}
                  aria-label="닫기"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', display: 'flex' }}
                >
                  <svg width={20} height={20} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div style={{ marginTop: 8 }}>
                <Text type="large" weight="bold" color="inherit">{selectedSchedule.title}</Text>
              </div>
            </div>

            {/* 내용 */}
            <div style={{ padding: '16px 24px' }}>
              <VStack gap={4} align="stretch">
                {/* 날짜 */}
                <HStack gap={3} vAlign="start">
                  <div style={{ ...iconBox('#f0fdfa'), marginTop: 2 }}>
                    <svg width={16} height={16} fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#14b8a6' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <VStack gap={0} align="start">
                    <Text type="supporting" weight="medium" color="secondary">날짜</Text>
                    <Text type="body" weight="medium" color="primary">
                      {selectedSchedule.startDate ? format(new Date(selectedSchedule.startDate), 'yyyy년 M월 d일 (EEEE)', { locale: ko }) : '-'}
                      {selectedSchedule.endDate && selectedSchedule.startDate !== selectedSchedule.endDate && (
                        <> ~ {format(new Date(selectedSchedule.endDate), 'M월 d일 (EEEE)', { locale: ko })}</>
                      )}
                    </Text>
                  </VStack>
                </HStack>

                {/* 시간 */}
                {!selectedSchedule.isAllDay && (selectedSchedule.startTime || selectedSchedule.endTime) && (
                  <HStack gap={3} vAlign="start">
                    <div style={{ ...iconBox('#f5f3ff'), marginTop: 2 }}>
                      <svg width={16} height={16} fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#8b5cf6' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <VStack gap={0} align="start">
                      <Text type="supporting" weight="medium" color="secondary">시간</Text>
                      <Text type="body" weight="medium" color="primary">
                        {selectedSchedule.startTime || ''}
                        {selectedSchedule.endTime && ` ~ ${selectedSchedule.endTime}`}
                      </Text>
                    </VStack>
                  </HStack>
                )}

                {/* 장소 */}
                {selectedSchedule.location && (
                  <HStack gap={3} vAlign="start">
                    <div style={{ ...iconBox('#ecfdf5'), marginTop: 2 }}>
                      <svg width={16} height={16} fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#10b981' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <VStack gap={0} align="start">
                      <Text type="supporting" weight="medium" color="secondary">장소</Text>
                      <Text type="body" weight="medium" color="primary">{selectedSchedule.location}</Text>
                    </VStack>
                  </HStack>
                )}

                {/* 설명 */}
                {selectedSchedule.description && (
                  <HStack gap={3} vAlign="start">
                    <div style={{ ...iconBox('#fffbeb'), marginTop: 2 }}>
                      <svg width={16} height={16} fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#f59e0b' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                      </svg>
                    </div>
                    <VStack gap={0} align="start">
                      <Text type="supporting" weight="medium" color="secondary">설명</Text>
                      <Text type="body" color="primary"><span style={{ whiteSpace: 'pre-wrap' }}>{selectedSchedule.description}</span></Text>
                    </VStack>
                  </HStack>
                )}

                {/* 참석자 */}
                {selectedSchedule.participants && selectedSchedule.participants.length > 0 && (
                  <HStack gap={3} vAlign="start">
                    <div style={{ ...iconBox('#fff1f2'), marginTop: 2 }}>
                      <svg width={16} height={16} fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#f43f5e' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <VStack gap={1} align="start">
                      <Text type="supporting" weight="medium" color="secondary">참석자</Text>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {selectedSchedule.participants.map((p, i) => (
                          <Badge key={i} variant="neutral" label={p.memberName || p.userName || '참석자'} />
                        ))}
                      </div>
                    </VStack>
                  </HStack>
                )}
              </VStack>
            </div>

            {/* 하단 */}
            <div style={{ padding: '12px 24px', background: 'var(--color-background-muted)', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                label="닫기"
                variant="secondary"
                onClick={() => setSelectedSchedule(null)}
              />
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
