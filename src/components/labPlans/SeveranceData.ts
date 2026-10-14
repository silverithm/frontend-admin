'use client';

/** 퇴직금 추계에 필요한 자료 읽기 — 연도별 급여대장(캐시), 직원 급여 기준, 장부 세출 115. 모두 늦게 온 응답을 버린다. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { errorText } from '@/components/lab/labFormat';
import { dedupeById, useAlive } from '@/components/labRecords/recordsFormat';
import { listLedgerEntriesByYear, listPayrollLinesByYear, listPayrollProfiles } from '@/lib/lab/labApi';
import type { LedgerEntry, PayrollLine, PayrollProfile } from '@/lib/lab/labTypes';
import { averageWageMonths } from '@/lib/lab/severanceRules';

/** 퇴직일 하나에 필요한 급여대장 연도(직전 3개월이 지난해에 걸칠 수 있다) */
export function yearsNeeded(retireDate: string): number[] {
  const months = averageWageMonths(retireDate);
  return [...new Set(months.map((m) => Number(m.slice(0, 4))))];
}

export function usePayrollYears(years: number[]) {
  const alive = useAlive();
  const cache = useRef(new Map<number, PayrollLine[]>());
  const seq = useRef(0);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = [...new Set(years)].sort().join(',');
  const wanted = useMemo(() => (key === '' ? [] : key.split(',').map(Number)), [key]);

  const run = useCallback(
    async (force: boolean) => {
      const n = ++seq.current;
      const need = wanted.filter((y) => force || !cache.current.has(y));
      if (need.length === 0) {
        setError(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      const results = await Promise.allSettled(need.map((y) => listPayrollLinesByYear(y)));
      if (!alive.current || n !== seq.current) return;
      const failed: string[] = [];
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') cache.current.set(need[i], dedupeById(r.value));
        else failed.push(`${need[i]}년`);
      });
      setVersion((v) => v + 1);
      setError(failed.length > 0 ? `${failed.join('·')} 급여대장을 불러오지 못했습니다` : null);
      setLoading(false);
    },
    [wanted, alive],
  );

  useEffect(() => {
    void run(false);
    return () => {
      seq.current += 1;
    };
  }, [run]);

  // version이 바뀔 때 캐시를 다시 읽는다
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const lines = useMemo(() => wanted.flatMap((y) => cache.current.get(y) ?? []), [wanted, version]);
  return { lines, loading, error, reload: () => void run(true) };
}

export function usePayrollProfiles() {
  const alive = useAlive();
  const seq = useRef(0);
  const [profiles, setProfiles] = useState<PayrollProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    const n = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const list = await listPayrollProfiles();
      if (!alive.current || n !== seq.current) return;
      setProfiles(dedupeById(list));
    } catch (err) {
      if (!alive.current || n !== seq.current) return;
      setError(errorText(err, '직원 급여 기준을 불러오지 못했습니다'));
    } finally {
      if (alive.current && n === seq.current) setLoading(false);
    }
  }, [alive]);
  useEffect(() => {
    void reload();
    return () => {
      seq.current += 1;
    };
  }, [reload]);
  return { profiles, loading, error, reload };
}

/** 그 해 회계 장부의 세출 115(퇴직금 및 퇴직적립금) 합계. 세입 115(이미용비)는 세지 않는다. */
export function usePensionLedger(year: number) {
  const alive = useAlive();
  const seq = useRef(0);
  const [total, setTotal] = useState<number | null>(null);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    const n = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const list: LedgerEntry[] = dedupeById(await listLedgerEntriesByYear(year));
      if (!alive.current || n !== seq.current) return;
      const mine = list.filter((e) => e.direction === 'EXPENSE' && e.accountCode.startsWith('115') && e.entryDate.startsWith(`${year}-`));
      setTotal(mine.reduce((sum, e) => sum + (Number.isFinite(e.amount) ? e.amount : 0), 0));
      setCount(mine.length);
    } catch (err) {
      if (!alive.current || n !== seq.current) return;
      setTotal(null);
      setError(errorText(err, '회계 장부를 불러오지 못했습니다'));
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
  return { total, count, loading, error, reload };
}
