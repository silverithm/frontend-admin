'use client';

/** 그날 출석한 어르신(하루)과 기간 동안 출석한 일수(어르신별)를 읽는다. 늦게 온 응답은 버린다. */
import { useEffect, useRef, useState } from 'react';
import { getElderAttendanceList, getElderAttendanceRange } from '@/lib/apiService';

interface RawAttendance {
  elderlyId?: unknown;
  status?: unknown;
  date?: unknown;
}

function rowsOf(data: unknown): RawAttendance[] {
  const box = data as { attendances?: unknown; records?: unknown; content?: unknown } | null;
  const raw = Array.isArray(data) ? data : box?.attendances ?? box?.records ?? box?.content ?? [];
  return Array.isArray(raw) ? (raw as RawAttendance[]) : [];
}

const isPresent = (status: unknown) => status === 'PRESENT' || status === '출석';

/** 응답 전체에서 출석한 어르신 id 집합과 기록이 한 줄이라도 있었는지 */
export function presentIdsOf(data: unknown): { present: Set<number>; hasData: boolean } {
  const rows = rowsOf(data);
  const present = new Set<number>();
  for (const r of rows) {
    const id = Number(r.elderlyId);
    if (Number.isInteger(id) && isPresent(r.status)) present.add(id);
  }
  return { present, hasData: rows.length > 0 };
}

/** 기간 응답에서 어르신별 출석 일수(같은 날 중복은 하루) */
export function presentDaysOf(data: unknown): Map<number, number> {
  const days = new Map<number, Set<string>>();
  rowsOf(data).forEach((r, index) => {
    const id = Number(r.elderlyId);
    if (!Number.isInteger(id) || !isPresent(r.status)) return;
    const set = days.get(id) ?? new Set<string>();
    set.add(typeof r.date === 'string' ? r.date.slice(0, 10) : `row-${index}`);
    days.set(id, set);
  });
  return new Map([...days].map(([id, set]) => [id, set.size]));
}

export interface DayAttendance {
  present: Set<number>;
  /** 출결 기록이 그날 한 줄이라도 있는지(없으면 아직 출석을 안 찍은 날이라 "출석한 분만"으로 거르지 않는다) */
  hasData: boolean;
  isLoading: boolean;
  error: string | null;
}

const EMPTY: Set<number> = new Set();

export function useElderAttendance(date: string): DayAttendance {
  const [state, setState] = useState<DayAttendance>({ present: EMPTY, hasData: false, isLoading: true, error: null });
  const seq = useRef(0);

  useEffect(() => {
    const n = ++seq.current;
    // 날짜가 바뀌면 앞 날짜의 출석 정보는 버린다(잠깐이라도 다른 날 기준으로 거르지 않게)
    setState({ present: EMPTY, hasData: false, isLoading: true, error: null });
    getElderAttendanceList(date)
      .then((data) => {
        if (n !== seq.current) return;
        const { present, hasData } = presentIdsOf(data);
        setState({ present, hasData, isLoading: false, error: null });
      })
      .catch(() => {
        if (n !== seq.current) return;
        setState({ present: EMPTY, hasData: false, isLoading: false, error: '출석 정보를 불러오지 못해 모든 어르신을 보여 드립니다' });
      });
    return () => {
      seq.current += 1;
    };
  }, [date]);

  return state;
}

/** 기간(start~end) 출석 일수. 실패하면 null — 호출한 쪽이 "전체 어르신" 같은 대체 값을 쓴다. */
export function useElderAttendanceDays(start: string, end: string): { days: Map<number, number> | null; isLoading: boolean } {
  const [state, setState] = useState<{ days: Map<number, number> | null; isLoading: boolean }>({ days: null, isLoading: true });
  const seq = useRef(0);

  useEffect(() => {
    const n = ++seq.current;
    setState((s) => ({ ...s, isLoading: true }));
    getElderAttendanceRange(start, end)
      .then((data) => {
        if (n === seq.current) setState({ days: presentDaysOf(data), isLoading: false });
      })
      .catch(() => {
        if (n === seq.current) setState({ days: null, isLoading: false });
      });
    return () => {
      seq.current += 1;
    };
  }, [start, end]);

  return state;
}
