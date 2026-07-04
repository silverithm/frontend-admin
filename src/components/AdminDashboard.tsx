'use client';

import { useState, useEffect, useMemo, type CSSProperties } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isToday } from 'date-fns';
import { ko } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { Text } from '@astryxdesign/core/Text';
import { Card } from '@astryxdesign/core/Card';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Icon } from '@astryxdesign/core/Icon';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Skeleton } from '@astryxdesign/core/Skeleton';
import { ClickableCard } from '@astryxdesign/core/ClickableCard';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import {
  IconUsers,
  IconCalendar,
  IconBell,
  IconCircleCheck,
  IconMoon,
  IconHeart,
  IconHome,
  IconBan,
  IconSpeakerphone,
  IconFileText,
  IconClock,
  IconMapPin,
  IconAlignLeft,
  IconChevronRight,
  IconX,
  type TablerIcon,
} from '@tabler/icons-react';
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

// 아이콘 칩 배경 제거(투명) — 아이콘은 중립 단색으로 통일(너무 튀지 않게)
const iconBox = (_background: string, size = 32, _radius = 8): CSSProperties => ({
  width: size,
  height: size,
  background: 'transparent',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  color: 'var(--color-icon-secondary)',
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
      <div style={{ display: 'flex', minHeight: 0, flex: 1, flexDirection: 'column', gap: 'var(--spacing-5)', paddingBottom: 'var(--spacing-4)' }}>
        <div style={{ height: 56 }} />
        <div className={isAdmin ? 'carev-dash-stats' : 'carev-dash-stats-emp'} style={{ display: 'grid', gap: 'var(--spacing-3)' }}>
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} height={96} radius={3} index={i} />
          ))}
        </div>
        <div className="carev-dash-panels" style={{ display: 'grid', gap: 'var(--spacing-3)', flex: 1 }}>
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
      iconBg: 'var(--color-background-teal)',
      iconColor: 'var(--color-text-teal)',
      icon: IconUsers as TablerIcon,
      tab: isAdmin ? 'members' : 'work',
      change: null as string | null,
      adminOnly: false,
    },
    {
      label: '오늘 일정',
      value: schedules.length,
      subtitle: '건',
      iconBg: 'var(--color-background-blue)',
      iconColor: 'var(--color-text-blue)',
      icon: IconCalendar as TablerIcon,
      tab: 'schedule',
      change: null as string | null,
      employeeOnly: true,
      adminOnly: false,
    },
    {
      label: '공지사항',
      value: notices.length,
      subtitle: '건',
      iconBg: 'var(--color-background-purple)',
      iconColor: 'var(--color-text-purple)',
      icon: IconBell as TablerIcon,
      tab: 'notice',
      change: null as string | null,
      employeeOnly: true,
      adminOnly: false,
    },
    {
      label: '출근',
      value: todayWorkingCount,
      subtitle: '명',
      iconBg: 'var(--color-background-green)',
      iconColor: 'var(--color-text-green)',
      icon: IconCircleCheck as TablerIcon,
      tab: 'members',
      change: employeeAttendanceBase > 0 ? `${Math.round((todayWorkingCount / employeeAttendanceBase) * 100)}%` : null,
      adminOnly: true,
    },
    {
      label: '오늘 휴무',
      value: todayVacationCount,
      subtitle: '명',
      iconBg: 'var(--color-background-yellow)',
      iconColor: 'var(--color-text-yellow)',
      icon: IconMoon as TablerIcon,
      tab: 'work',
      change: employeeAttendanceBase > 0 ? `${Math.round((todayVacationCount / employeeAttendanceBase) * 100)}%` : null,
      adminOnly: true,
    },
    {
      label: '총 어르신',
      value: elderCount,
      subtitle: '명',
      iconBg: 'var(--color-background-red)',
      iconColor: 'var(--color-text-red)',
      icon: IconHeart as TablerIcon,
      tab: 'members',
      change: null as string | null,
      adminOnly: true,
    },
    {
      label: '등원',
      value: elderAttendance.present,
      subtitle: '명',
      iconBg: 'var(--color-background-purple)',
      iconColor: 'var(--color-text-purple)',
      icon: IconHome as TablerIcon,
      tab: 'members',
      change: elderAttendanceBase > 0 ? `${Math.round((elderAttendance.present / elderAttendanceBase) * 100)}%` : null,
      adminOnly: true,
    },
    {
      label: '결석',
      value: elderAttendance.absent,
      subtitle: '명',
      iconBg: 'var(--color-background-muted)',
      iconColor: 'var(--color-text-gray)',
      icon: IconBan as TablerIcon,
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
    <div style={{ display: 'flex', minHeight: 0, flex: 1, flexDirection: 'column', gap: 'var(--spacing-5)', paddingBottom: 'var(--spacing-4)' }}>
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
      <div className={isAdmin ? 'carev-dash-stats' : 'carev-dash-stats-emp'} style={{ display: 'grid', gap: 'var(--spacing-3)' }}>
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
                  <div style={{ ...iconBox(card.iconBg, 40, 12) }}>
                    <Icon icon={card.icon} size="md" color="inherit" />
                  </div>
                  {card.change && <Badge variant="teal" label={card.change} />}
                </HStack>
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--spacing-1)' }}>
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
        style={{ display: 'grid', minHeight: 0, flex: 1, gap: 'var(--spacing-3)' }}
      >
        {/* Top-Left: 공지사항 */}
        <Card padding={0} height="100%" minHeight={340}>
          <VStack gap={0} height="100%">
            <div style={{ padding: '16px 16px 8px' }}>
              <HStack hAlign="between" vAlign="center">
                <HStack gap={2} vAlign="center">
                  <div style={{ ...iconBox('var(--color-background-yellow)'), color: 'var(--color-text-yellow)' }}>
                    <Icon icon={IconSpeakerphone} size="sm" color="inherit" />
                  </div>
                  <VStack gap={0} align="start">
                    <Text type="body" weight="bold" color="primary">공지사항</Text>
                    <Text type="supporting" color="secondary">{notices.length}개</Text>
                  </VStack>
                </HStack>
                <Button
                  variant="ghost"
                  size="sm"
                  label="전체보기"
                  endContent={<Icon icon={IconChevronRight} size="xsm" />}
                  onClick={() => onTabChange('notice')}
                />
              </HStack>
            </div>

            <div style={{ padding: '0 16px 16px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
              {notices.length === 0 ? (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <EmptyState
                    isCompact
                    title="공지사항이 없습니다"
                    icon={<Icon icon={IconSpeakerphone} size="lg" color="secondary" />}
                  />
                </div>
              ) : (
                <VStack gap={1}>
                  {notices.slice(0, 5).map((notice) => (
                    <div
                      key={notice.id}
                      className="carev-dash-row"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--spacing-2)', borderRadius: 'var(--radius-element)' }}
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
                  <div style={{ ...iconBox('var(--color-background-purple)'), color: 'var(--color-text-purple)' }}>
                    <Icon icon={IconFileText} size="sm" color="inherit" />
                  </div>
                  <VStack gap={0} align="start">
                    <Text type="body" weight="bold" color="primary">전자결재</Text>
                    <Text type="supporting" color="secondary">대기 {approvalRequests.length}건</Text>
                  </VStack>
                </HStack>
                <Button
                  variant="ghost"
                  size="sm"
                  label="전체보기"
                  endContent={<Icon icon={IconChevronRight} size="xsm" />}
                  onClick={() => onTabChange('approval')}
                />
              </HStack>
            </div>

            <div style={{ padding: '0 16px 16px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
              {approvalRequests.length === 0 ? (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <EmptyState
                    isCompact
                    title="대기 중인 결재가 없습니다"
                    icon={<Icon icon={IconCircleCheck} size="lg" color="secondary" />}
                  />
                </div>
              ) : (
                <VStack gap={1}>
                  {approvalRequests.slice(0, 5).map((approval) => (
                    <div
                      key={approval.id}
                      className="carev-dash-row"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--spacing-2)', borderRadius: 'var(--radius-element)' }}
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
                    <div style={{ ...iconBox('var(--color-background-green)'), color: 'var(--color-text-green)' }}>
                      <Icon icon={IconCalendar} size="sm" color="inherit" />
                    </div>
                    <VStack gap={0} align="start">
                      <Text type="body" weight="bold" color="primary">월간일정</Text>
                      <Text type="supporting" color="secondary">
                        {format(new Date(), 'yyyy년 M월', { locale: ko })} · {monthlySchedules.length}건
                      </Text>
                    </VStack>
                  </HStack>
                  <Button
                    variant="ghost"
                    size="sm"
                    label="전체보기"
                    endContent={<Icon icon={IconChevronRight} size="xsm" />}
                    onClick={() => onTabChange('schedule')}
                  />
                </HStack>
              </div>

              <div style={{ padding: '0 16px 12px', flex: 1, minHeight: 0 }}>
                <div
                  style={{ display: 'grid', height: '100%', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 'var(--spacing-1)', gridTemplateRows: `auto repeat(${monthlyCalendarDays.weeksCount}, minmax(0, 1fr))` }}
                >
                  {['일','월','화','수','목','금','토'].map((d) => (
                    <div key={d} style={{ display: 'flex', height: 28, alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: d === '일' ? 'var(--color-text-red)' : d === '토' ? 'var(--color-text-blue)' : 'var(--color-text-primary)' }}>{d}</div>
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
                          flexDirection: 'column', alignItems: 'stretch', gap: 'var(--spacing-0-5)', borderRadius: 'var(--radius-inner)', padding: 'var(--spacing-1)', textAlign: 'left',
                          background: !inMonth ? 'transparent' : todayFlag ? 'rgba(16, 185, 129, 0.06)' : 'transparent',
                          border: `1px solid ${!inMonth ? 'transparent' : todayFlag ? 'var(--color-border-green)' : 'transparent'}`,
                          cursor: !inMonth ? 'default' : 'pointer',
                        }}
                        disabled={!inMonth}
                      >
                        <span
                          style={{
                            display: 'flex', height: 24, width: 24, flexShrink: 0, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', borderRadius: 'var(--radius-full)', fontSize: 'var(--font-size-sm)',
                            ...(
                              !inMonth ? { color: 'var(--color-text-gray)' } :
                              todayFlag ? { background: 'var(--color-background-green)', fontWeight: 'var(--font-weight-bold)', color: '#fff' } :
                              dayOfWeek === 0 ? { fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-red)' } :
                              dayOfWeek === 6 ? { fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-blue)' } :
                              { fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-gray)' }
                            ),
                          }}
                        >
                          {format(date, 'd')}
                        </span>
                        {scheduleCount > 0 && inMonth && (
                          <>
                            {/* 모바일: 도트 표시 */}
                            <div className="carev-dash-cal-dots" style={{ alignItems: 'center', justifyContent: 'center', gap: 'var(--spacing-0)' }}>
                              {Array.from({ length: Math.min(scheduleCount, 3) }).map((_, i) => (
                                <div key={i} style={{ height: 4, width: 4, borderRadius: 'var(--radius-full)', background: 'var(--color-background-green)' }} />
                              ))}
                              {scheduleCount > 3 && (
                                <span style={{ fontSize: 'var(--font-size-3xs)', fontWeight: 'var(--font-weight-bold)', lineHeight: 1, color: 'var(--color-text-green)' }}>+{scheduleCount - 3}</span>
                              )}
                            </div>
                            {/* 데스크탑: 일정 제목 칩 표시 */}
                            <div className="carev-dash-cal-chips" style={{ minHeight: 0, flexDirection: 'column', gap: 'var(--spacing-0-5)', overflow: 'hidden' }}>
                              {daySchedules.slice(0, maxChips).map((schedule, i) => (
                                <span
                                  key={`${schedule.id}-${i}`}
                                  style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderRadius: 'var(--radius-none)', background: 'rgba(16, 185, 129, 0.12)', padding: '1px 4px', fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)', lineHeight: '16px', color: 'var(--color-text-green)' }}
                                >
                                  {schedule.title}
                                </span>
                              ))}
                              {scheduleCount > maxChips && (
                                <span style={{ padding: '0 4px', fontSize: 'var(--font-size-2xs)', fontWeight: 'var(--font-weight-semibold)', lineHeight: '12px', color: 'var(--color-text-gray)' }}>
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
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--spacing-4)' }} onClick={() => setShowDaySchedules(false)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(4px)' }} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            style={{ position: 'relative', background: 'var(--color-background-card)', borderRadius: 'var(--radius-container)', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)', width: '100%', maxWidth: 448, overflow: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ background: 'linear-gradient(90deg, #10b981, #14b8a6)', padding: '16px 24px', color: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text type="large" weight="bold" color="inherit">
                  {isToday(selectedDate) ? '오늘의 일정' : format(selectedDate, 'M월 d일 (EEEE)', { locale: ko })}
                </Text>
                <IconButton
                  label="닫기"
                  variant="ghost"
                  size="sm"
                  icon={<Icon icon={IconX} size="md" color="inherit" />}
                  onClick={() => setShowDaySchedules(false)}
                  style={{ color: '#fff' }}
                />
              </div>
              <div style={{ marginTop: 'var(--spacing-1)' }}>
                <Text type="supporting" color="inherit">총 {selectedSchedules.length}개의 일정</Text>
              </div>
            </div>

            <div style={{ padding: '16px 24px', maxHeight: '50vh', overflowY: 'auto' }}>
              {selectedSchedules.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--spacing-3)', padding: '32px 0' }}>
                  <EmptyState
                    isCompact
                    title={`${format(selectedDate, 'M월 d일')} 일정이 없습니다`}
                    icon={<Icon icon={IconClock} size="lg" color="secondary" />}
                  />
                </div>
              ) : (
                <VStack gap={0}>
                  {selectedSchedules.map((schedule, idx) => (
                    <div
                      key={schedule.id}
                      className="carev-dash-timeline"
                      style={{ display: 'flex', gap: 'var(--spacing-3)', borderRadius: 'var(--radius-inner)', padding: '0 8px', margin: '0 -8px' }}
                      onClick={() => {
                        setShowDaySchedules(false);
                        setSelectedSchedule(schedule);
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 'var(--radius-full)', background: 'var(--color-background-teal)', boxShadow: '0 0 0 4px #f0fdfa', flexShrink: 0, marginTop: 'var(--spacing-1-5)' }} />
                        {idx < selectedSchedules.length - 1 && (
                          <div style={{ width: 2, flex: 1, background: 'var(--color-background-muted)', margin: '4px 0' }} />
                        )}
                      </div>
                      <div style={{ paddingBottom: 'var(--spacing-4)', flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                          <Text type="supporting" weight="semibold" color="accent" hasTabularNumbers>
                            {schedule.isAllDay ? '종일' : (schedule.startTime || '')}
                          </Text>
                          {schedule.category && <Badge variant="neutral" label={schedule.category} />}
                        </div>
                        <div style={{ marginTop: 'var(--spacing-0-5)' }}>
                          <Text as="p" type="body" weight="medium" color="primary" maxLines={1}>{schedule.title}</Text>
                        </div>
                        {schedule.location && (
                          <Text as="p" type="supporting" color="secondary" maxLines={1}>{schedule.location}</Text>
                        )}
                      </div>
                      <div style={{ flexShrink: 0, alignSelf: 'center', display: 'flex' }}>
                        <Icon icon={IconChevronRight} size="sm" color="secondary" />
                      </div>
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
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--spacing-4)' }} onClick={() => setSelectedSchedule(null)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(4px)' }} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            style={{ position: 'relative', background: 'var(--color-background-card)', borderRadius: 'var(--radius-container)', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)', width: '100%', maxWidth: 448, overflow: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div style={{ background: 'linear-gradient(90deg, #14b8a6, #0d9488)', padding: '16px 24px', color: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                  {selectedSchedule.category && (
                    <Badge variant="neutral" label={selectedSchedule.category} />
                  )}
                  {selectedSchedule.isAllDay && (
                    <Badge variant="neutral" label="종일" />
                  )}
                </div>
                <IconButton
                  label="닫기"
                  variant="ghost"
                  size="sm"
                  icon={<Icon icon={IconX} size="md" color="inherit" />}
                  onClick={() => setSelectedSchedule(null)}
                  style={{ color: '#fff' }}
                />
              </div>
              <div style={{ marginTop: 'var(--spacing-2)' }}>
                <Text type="large" weight="bold" color="inherit">{selectedSchedule.title}</Text>
              </div>
            </div>

            {/* 내용 */}
            <div style={{ padding: '16px 24px' }}>
              <VStack gap={4} align="stretch">
                {/* 날짜 */}
                <HStack gap={3} vAlign="start">
                  <div style={{ ...iconBox('var(--color-background-teal)'), color: 'var(--color-text-teal)', marginTop: 'var(--spacing-0-5)' }}>
                    <Icon icon={IconCalendar} size="sm" color="inherit" />
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
                    <div style={{ ...iconBox('var(--color-background-purple)'), color: 'var(--color-text-purple)', marginTop: 'var(--spacing-0-5)' }}>
                      <Icon icon={IconClock} size="sm" color="inherit" />
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
                    <div style={{ ...iconBox('var(--color-background-green)'), color: 'var(--color-text-green)', marginTop: 'var(--spacing-0-5)' }}>
                      <Icon icon={IconMapPin} size="sm" color="inherit" />
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
                    <div style={{ ...iconBox('var(--color-background-yellow)'), color: 'var(--color-text-yellow)', marginTop: 'var(--spacing-0-5)' }}>
                      <Icon icon={IconAlignLeft} size="sm" color="inherit" />
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
                    <div style={{ ...iconBox('var(--color-background-red)'), color: 'var(--color-text-red)', marginTop: 'var(--spacing-0-5)' }}>
                      <Icon icon={IconUsers} size="sm" color="inherit" />
                    </div>
                    <VStack gap={1} align="start">
                      <Text type="supporting" weight="medium" color="secondary">참석자</Text>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-1-5)' }}>
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
