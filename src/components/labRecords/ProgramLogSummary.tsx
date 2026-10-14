'use client';

/**
 * 프로그램 일지 위쪽 요약 — 이번 주 인지 프로그램 n/3회, 최근 4주 충족 여부, 참여가 적은 어르신.
 * 평가는 인지 프로그램을 주 3회 이상 운영했는지(월~일, 한국 날짜)를 본다. 이번 주는 아직 진행 중이라
 * 4주 충족 현황에는 "끝난 주"만 넣는다.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { StatRow, StatTile } from '@/components/StatTile';
import { listPrograms } from '@/lib/lab/labApi';
import type { Program } from '@/lib/lab/labTypes';
import { COGNITIVE_WEEKLY_TARGET, cognitiveWeeklyStatus, mondayOf, recentWeeklyStatuses, underParticipated, weeksMet } from '@/lib/lab/programRules';
import { Chip, ErrorBanner } from '@/components/lab/LabUi';
import { errorText, todayString, weekdayIndex } from '@/components/lab/labFormat';
import type { LabElder } from '@/components/lab/useLabElders';
import { dedupeById, daysAgo, monthsBetween } from './recordsFormat';
import { useElderAttendanceDays } from './useElderAttendance';
import styles from './labRecords.module.css';

const WINDOW_DAYS = 35;
const MAX_NAMES = 12;

const md = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;

interface SummaryProps {
  elders: LabElder[];
  /** 일지를 저장·삭제하면 올라가 요약을 다시 읽게 한다 */
  version: number;
  onWriteCognitive: () => void;
}

export default function ProgramLogSummary({ elders, version, onWriteCognitive }: SummaryProps) {
  const today = todayString();
  const monday = mondayOf(today) ?? today;
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const attendance = useElderAttendanceDays(monday, today);

  useEffect(() => {
    const n = ++seq.current;
    setLoading(true);
    setError(null);
    Promise.all(monthsBetween(daysAgo(today, WINDOW_DAYS), today).map((m) => listPrograms(m)))
      .then((lists) => {
        if (n === seq.current) setPrograms(dedupeById(lists.flat()));
      })
      .catch((e) => {
        if (n === seq.current) setError(errorText(e, '프로그램 일지를 불러오지 못했습니다'));
      })
      .finally(() => {
        if (n === seq.current) setLoading(false);
      });
    return () => {
      seq.current += 1;
    };
  }, [today, version]);

  const week = useMemo(() => cognitiveWeeklyStatus(programs, monday), [programs, monday]);
  const recent = useMemo(() => recentWeeklyStatuses(programs, today, 4), [programs, today]);
  const met = weeksMet(recent);

  // 이번 주에 한 번이라도 출석한 어르신 — 출석 정보를 못 읽으면 전체 어르신
  const weekElders = useMemo(() => {
    if (attendance.isLoading) return [];
    if (!attendance.days) return elders;
    const days = attendance.days;
    return elders.filter((e) => (days.get(e.id) ?? 0) > 0);
  }, [elders, attendance.days, attendance.isLoading]);
  const lowIds = useMemo(() => underParticipated(week.perElder, weekElders.map((e) => e.id)), [week.perElder, weekElders]);
  const low = useMemo(
    () => lowIds.map((id) => ({ elder: weekElders.find((e) => e.id === id) as LabElder, count: week.perElder[id] ?? 0 })).sort((a, b) => a.count - b.count || a.elder.name.localeCompare(b.elder.name, 'ko')),
    [lowIds, weekElders, week.perElder],
  );

  const dow = weekdayIndex(today);
  const lateInWeek = dow === 0 || dow >= 4; // 목~일
  const remaining = Math.max(0, COGNITIVE_WEEKLY_TARGET - week.count);

  return (
    <VStack gap={3}>
      <StatRow>
        <StatTile value={`${week.count}/${COGNITIVE_WEEKLY_TARGET}회`} label={`이번 주 인지 프로그램 (${md(monday)}~)`} tone={week.met ? 'success' : lateInWeek ? 'warning' : 'neutral'} />
        <StatTile value={`${met.met}/${met.total}주`} label="최근 4주 충족" tone={met.total > 0 && met.met === met.total ? 'success' : met.total > 0 && met.met < met.total ? 'warning' : 'neutral'} />
        <StatTile value={`${low.length}명`} label="이번 주 참여가 적은 어르신" tone={low.length > 0 && lateInWeek ? 'warning' : 'neutral'} />
      </StatRow>

      {error && <ErrorBanner message={error} />}

      <Card padding={4}>
        <VStack gap={3}>
          <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
            <Text type="label">최근 4주 인지 프로그램 (끝난 주, 주 {COGNITIVE_WEEKLY_TARGET}회 이상이면 충족)</Text>
            {!week.met && (
              <Button label="인지 프로그램 쓰기" variant="secondary" onClick={onWriteCognitive} />
            )}
          </HStack>
          {loading && programs.length === 0 ? (
            <Text type="supporting" color="secondary">불러오는 중...</Text>
          ) : (
            <HStack gap={2} wrap="wrap">
              {recent.map((w) => (
                <Chip key={w.weekStart} tone={w.met ? 'ok' : 'warn'} label={`${md(w.weekStart)}~${md(w.weekEnd)} ${w.count}회 ${w.met ? '충족' : '부족'}`} />
              ))}
            </HStack>
          )}
          <Text type="supporting" color="secondary">
            {week.met
              ? '이번 주 인지 프로그램은 충족했습니다.'
              : `이번 주 인지 프로그램이 ${remaining}회 더 필요합니다. 같은 날 같은 제목은 한 번으로 셉니다.`}
          </Text>
        </VStack>
      </Card>

      <Card padding={4}>
        <VStack gap={2}>
          <Text type="label">이번 주 인지 프로그램 참여가 {COGNITIVE_WEEKLY_TARGET}회 미만인 어르신</Text>
          {low.length === 0 ? (
            <Text type="supporting" color="secondary">
              {loading || attendance.isLoading ? '불러오는 중...' : weekElders.length === 0 ? '이번 주 출석한 어르신이 아직 없습니다.' : '이번 주 출석한 어르신 모두 참여 횟수를 채웠습니다.'}
            </Text>
          ) : (
            <>
              <div className={styles.chips} style={{ justifyContent: 'flex-start' }}>
                {low.slice(0, MAX_NAMES).map(({ elder, count }) => (
                  <Chip key={elder.id} tone={count === 0 ? 'danger' : 'warn'} label={`${elder.name} ${count}/${COGNITIVE_WEEKLY_TARGET}`} />
                ))}
                {low.length > MAX_NAMES && <Chip tone="neutral" label={`외 ${low.length - MAX_NAMES}명`} />}
              </div>
              <Text type="supporting" color="secondary">
                {attendance.days ? '이번 주 출석한 어르신 중 ' : '출석 정보를 읽지 못해 전체 어르신 중 '}참여가 적은 분입니다. 평가 기준은 기관이 주 3회를 운영했는지이고, 이 목록은 누구를 더 챙길지 보는 용도예요.
              </Text>
            </>
          )}
        </VStack>
      </Card>
    </VStack>
  );
}
