'use client';

/**
 * 이번 달 "상태변화 기록이 빠진 주" — 2026 평가(급여제공 결과평가): 상태변화를 주 1회 이상 기록해야 한다.
 * 출석한 주만 따지고(출결), 급여제공기록의 특이사항(형식적 문구 제외)이나 사고·상태변화 기록이 있으면 채운 주로 본다.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { conditionWeeklyGaps } from '@/lib/lab/careEventRules';
import { listCareRecordsByElder } from '@/lib/lab/labApi';
import type { CareEvent, CareRecord } from '@/lib/lab/labTypes';
import { getElderAttendanceRange } from '@/lib/apiService';
import { Chip } from '@/components/lab/LabUi';
import { monthLabel, monthRange, todayString } from '@/components/lab/labFormat';
import type { LabElder } from '@/components/lab/useLabElders';
import { addDays } from '@/lib/lab/programRules';
import { presentDatesOf } from './useElderAttendance';
import styles from './labRecords.module.css';

interface Props {
  month: string;
  elders: LabElder[];
  events: CareEvent[];
  onWrite: (elderId: number) => void;
}

interface Loaded {
  month: string;
  careRecords: CareRecord[];
  attendance: Record<number, string[]> | null;
  failedElders: number;
}

const POOL = 6;
const weekText = (monday: string) => `${Number(monday.slice(5, 7))}/${Number(monday.slice(8, 10))}일 주`;

export default function CareEventGaps({ month, elders, events, onWrite }: Props) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [retry, setRetry] = useState(0);
  const seq = useRef(0);
  const elderKey = elders.map((e) => e.id).join(',');

  useEffect(() => {
    if (elders.length === 0) {
      setLoading(false);
      return;
    }
    const n = ++seq.current;
    setLoading(true);
    const { start, end } = monthRange(month);
    (async () => {
      const attendanceTask = getElderAttendanceRange(start, end)
        .then((data) => presentDatesOf(data))
        .catch(() => null);
      const records: CareRecord[] = [];
      let failed = 0;
      let next = 0;
      const worker = async () => {
        while (next < elders.length) {
          const elder = elders[next++];
          try {
            records.push(...(await listCareRecordsByElder(elder.id, month)));
          } catch {
            failed += 1;
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(POOL, elders.length) }, worker));
      const attendance = await attendanceTask;
      if (n === seq.current) {
        setLoaded({ month, careRecords: records, attendance, failedElders: failed });
        setLoading(false);
      }
    })();
    return () => {
      seq.current += 1;
    };
    // elders 배열 자체가 아니라 id 목록이 바뀔 때만 다시 읽는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, elderKey, retry]);

  const gaps = useMemo(() => {
    if (!loaded || loaded.month !== month) return [];
    return conditionWeeklyGaps({
      elderIds: elders.map((e) => e.id),
      month,
      careRecords: loaded.careRecords,
      events,
      attendance: loaded.attendance ?? undefined,
    });
  }, [loaded, month, elders, events]);

  // 출결은 읽었는데 이번 달 출석이 한 건도 없으면 따질 주가 없다 — '빠진 주 없음'으로 보이면 다 채운 것처럼 오해한다
  const noAttendance = useMemo(() => {
    if (!loaded || loaded.month !== month || loaded.attendance === null) return false;
    return !Object.values(loaded.attendance).some((dates) => dates.some((d) => d.startsWith(month)));
  }, [loaded, month]);

  const today = todayString();
  const nameOf = (id: number) => elders.find((e) => e.id === id)?.name ?? `어르신 ${id}`;
  const inProgress = (monday: string) => (addDays(monday, 6) ?? monday) >= today;
  const ready = loaded !== null && loaded.month === month && !loading;

  return (
    <Card padding={4}>
      <VStack gap={2}>
        <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
          <Text type="label">{monthLabel(month)} 상태변화 기록이 빠진 주</Text>
          {loading ? (
            <Chip tone="neutral" label="확인하는 중" />
          ) : ready && noAttendance ? (
            <Chip tone="neutral" label="출석 기록 없음" />
          ) : ready && gaps.length === 0 ? (
            <Chip tone="ok" label="빠진 주 없음" />
          ) : ready ? (
            <Chip tone="warn" label={`${gaps.length}명`} />
          ) : null}
        </HStack>
        <Text type="supporting" color="secondary">
          2026 평가(급여제공 결과평가): 상태변화를 주 1회 이상 기록해야 합니다. “특이사항 없음”·“양호함”·“지난주와 동일” 같은 문구만으로는 인정되지 않습니다.
        </Text>
        {ready && noAttendance && (
          <Text type="supporting" color="secondary">
            이번 달 출석 기록이 아직 없어 따질 주가 없습니다. 출결이 쌓이면 출석한 주마다 확인합니다.
          </Text>
        )}
        {ready && loaded.attendance === null && (
          <Text type="supporting" color="secondary">
            출결을 불러오지 못해 달 전체의 주를 모두 따졌습니다.
          </Text>
        )}
        {ready && loaded.failedElders > 0 && (
          <span className={styles.warnText}>
            <Text type="supporting" color="inherit">
              어르신 {loaded.failedElders}명의 급여제공기록을 읽지 못해 실제보다 빠진 주가 많아 보일 수 있습니다.{' '}
            </Text>
            <Button label="다시 확인" size="sm" variant="ghost" onClick={() => setRetry((v) => v + 1)} />
          </span>
        )}
        {ready && gaps.length > 0 && (
          <>
            <div>
              <Button label={open ? '목록 접기' : `빠진 어르신 ${gaps.length}명 보기`} variant="ghost" onClick={() => setOpen((v) => !v)} />
            </div>
            {open && (
              <div role="list">
                {gaps.map((g) => (
                  <div className={styles.rowBlock} role="listitem" key={g.elderlyId}>
                    <div className={styles.rowHead}>
                      <VStack gap={0.5}>
                        <Text type="body" weight="medium">
                          {nameOf(g.elderlyId)}
                        </Text>
                        <Text type="supporting" color="secondary">
                          {g.missingWeeks.map((w) => (inProgress(w) ? `${weekText(w)}(이번 주 진행 중)` : weekText(w))).join(', ')}
                        </Text>
                      </VStack>
                      <Button label="상태변화 쓰기" size="sm" variant="secondary" onClick={() => onWrite(g.elderlyId)} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </VStack>
    </Card>
  );
}
