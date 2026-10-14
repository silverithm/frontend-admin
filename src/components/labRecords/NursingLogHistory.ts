'use client';

/** 한 어르신의 최근 간호일지(기준일 30일 전부터) — 체중 비교와 14일 추이에 쓴다. 늦게 온 응답은 버린다. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { listNursingLogsByElder } from '@/lib/lab/labApi';
import type { NursingLog } from '@/lib/lab/labTypes';
import { errorText } from '@/components/lab/labFormat';
import { VITAL_THRESHOLDS } from '@/lib/lab/vitalFlags';
import { dedupeById, daysAgo, monthsBetween } from './recordsFormat';

export function useNursingHistory(elderId: number, date: string) {
  const [logs, setLogs] = useState<NursingLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const n = ++seq.current;
    setIsLoading(true);
    setError(null);
    try {
      const months = monthsBetween(daysAgo(date, VITAL_THRESHOLDS.weightWindowDays), date);
      const lists = await Promise.all(months.map((m) => listNursingLogsByElder(elderId, m)));
      if (n !== seq.current) return;
      setLogs(dedupeById(lists.flat()).sort((a, b) => (a.logDate < b.logDate ? -1 : a.logDate > b.logDate ? 1 : 0)));
    } catch (e) {
      if (n !== seq.current) return;
      setError(errorText(e, '지난 간호일지를 불러오지 못했습니다'));
    } finally {
      if (n === seq.current) setIsLoading(false);
    }
  }, [elderId, date]);

  useEffect(() => {
    void load();
    return () => {
      seq.current += 1;
    };
  }, [load]);

  /** 저장한 기록을 목록에 반영(같은 날짜는 바꿔 넣는다) */
  const apply = useCallback((log: NursingLog) => {
    setLogs((prev) => [...prev.filter((l) => l.id !== log.id && l.logDate.slice(0, 10) !== log.logDate.slice(0, 10)), log].sort((a, b) => (a.logDate < b.logDate ? -1 : 1)));
  }, []);
  const remove = useCallback((id: number) => setLogs((prev) => prev.filter((l) => l.id !== id)), []);

  return { logs, isLoading, error, reload: load, apply, remove };
}
