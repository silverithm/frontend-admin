'use client';

/** 인력배치 점검에 필요한 자료 읽기 — 그 달·지난달 저장 기록, 올해 저장한 달 목록, 그 달 출결 합계. 늦게 온 응답은 버린다. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { errorText, monthRange } from '@/components/lab/labFormat';
import { dedupeById, useAlive } from '@/components/labRecords/recordsFormat';
import { presentDatesOf } from '@/components/labRecords/useElderAttendance';
import { getElderAttendanceRange } from '@/lib/apiService';
import { getStaffingMonth, listStaffingMonths } from '@/lib/lab/labApi';
import type { StaffingMonth } from '@/lib/lab/labTypes';
import { previousMonth } from '@/lib/lab/staffingRules';

export interface MonthRecords {
  saved: StaffingMonth | null;
  previous: StaffingMonth | null;
  /** 지난달 기록을 못 읽었는지(읽지 못하면 연속 위반 여부를 알 수 없다) */
  previousFailed: boolean;
}

/** 그 달과 지난달의 저장 기록. 그 달을 못 읽으면 error — 빈 화면에 새로 적다가 덮어쓰지 않게 한다. */
export function useMonthRecords(month: string) {
  const alive = useAlive();
  const seq = useRef(0);
  const [data, setData] = useState<MonthRecords | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const n = ++seq.current;
    setLoading(true);
    setError(null);
    setData(null);
    const prev = previousMonth(month);
    const [cur, before] = await Promise.allSettled([getStaffingMonth(month), prev ? getStaffingMonth(prev) : Promise.resolve(null)]);
    if (!alive.current || n !== seq.current) return;
    if (cur.status === 'rejected') {
      setError(errorText(cur.reason, '인력배치 점검을 불러오지 못했습니다'));
    } else {
      setData({ saved: cur.value, previous: before.status === 'fulfilled' ? before.value : null, previousFailed: before.status === 'rejected' });
    }
    setLoading(false);
  }, [month, alive]);

  useEffect(() => {
    void load();
    return () => {
      seq.current += 1;
    };
  }, [load]);

  return { data, loading, error, reload: load };
}

/** 그 해 저장한 달 목록 */
export function useStaffingYear(year: number) {
  const alive = useAlive();
  const seq = useRef(0);
  const [rows, setRows] = useState<StaffingMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    const n = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const list = await listStaffingMonths(year);
      if (!alive.current || n !== seq.current) return;
      setRows(dedupeById(list).sort((a, b) => (a.staffingMonth < b.staffingMonth ? -1 : 1)));
    } catch (err) {
      if (!alive.current || n !== seq.current) return;
      setError(errorText(err, '저장한 달 목록을 불러오지 못했습니다'));
    } finally {
      if (alive.current && n === seq.current) setLoading(false);
    }
  }, [year, alive]);
  useEffect(() => {
    void reload();
    return () => {
      seq.current += 1;
    };
  }, [reload]);
  return { rows, loading, error, reload };
}

export interface AttendanceFill {
  /** 출석한 어르신이 한 명이라도 있는 날 수 */
  serviceDays: number;
  /** 날짜별 출석 인원의 합 */
  usersSum: number;
}

/** 그 달 출결을 읽어 급여제공일수와 일자별 입소자 합을 센다. 출석 기록이 하나도 없으면 null. */
export async function fetchAttendanceFill(month: string): Promise<AttendanceFill | null> {
  const { start, end } = monthRange(month);
  const data = await getElderAttendanceRange(start, end);
  const byElder = presentDatesOf(data);
  const perDay = new Map<string, number>();
  for (const dates of Object.values(byElder)) {
    for (const d of dates) if (d.startsWith(`${month}-`)) perDay.set(d, (perDay.get(d) ?? 0) + 1);
  }
  if (perDay.size === 0) return null;
  let usersSum = 0;
  perDay.forEach((count) => {
    usersSum += count;
  });
  return { serviceDays: perDay.size, usersSum };
}
