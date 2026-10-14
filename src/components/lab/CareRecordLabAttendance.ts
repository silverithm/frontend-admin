'use client';

/**
 * 그날 어르신 출석 — 하루 기록 목록에 출석·결석 표시를 붙이고 "출석한 어르신만" 보기를 거르는 데 쓴다.
 * 출석 정보는 곁가지다: 불러오지 못해도 기록 화면은 멈추지 않고, 표시만 생략한다(error 문구만 남긴다).
 * 날짜를 빨리 넘길 때 늦게 도착한 응답은 버린다.
 */
import { useEffect, useRef, useState } from 'react';
import { getElderAttendanceList } from '@/lib/apiService';

export type DayStatus = 'PRESENT' | 'ABSENT';

export interface DayAttendance {
  /** 어르신 id → 그날 출석·결석(기록이 있는 분만) */
  statuses: Map<number, DayStatus>;
  /** 그날 출결 기록이 한 줄이라도 있는지. 없으면 아직 출석을 안 찍은 날이라 "출석한 분만"으로 거르지 않는다. */
  hasData: boolean;
  isLoading: boolean;
  /** 불러오지 못했을 때 안내 문구(표시만 생략한다) */
  error: string | null;
}

interface RawRow {
  elderlyId?: unknown;
  status?: unknown;
}

/** 응답 모양이 둘 이상이라 느슨하게 읽는다. 같은 어르신이 두 줄이면 나중 줄이 이긴다. */
export function dayStatusesOf(data: unknown): Map<number, DayStatus> {
  const box = data as { attendances?: unknown; records?: unknown; content?: unknown } | null;
  const raw = Array.isArray(data) ? data : box?.attendances ?? box?.records ?? box?.content ?? [];
  const map = new Map<number, DayStatus>();
  if (!Array.isArray(raw)) return map;
  for (const row of raw as RawRow[]) {
    const id = Number(row?.elderlyId);
    if (!Number.isInteger(id)) continue;
    if (row.status === 'PRESENT' || row.status === '출석') map.set(id, 'PRESENT');
    else if (row.status === 'ABSENT' || row.status === '결석') map.set(id, 'ABSENT');
  }
  return map;
}

const EMPTY = new Map<number, DayStatus>();

export function useDayAttendance(date: string): DayAttendance {
  const [state, setState] = useState<DayAttendance>({ statuses: EMPTY, hasData: false, isLoading: true, error: null });
  const seq = useRef(0);

  useEffect(() => {
    const n = ++seq.current;
    setState({ statuses: EMPTY, hasData: false, isLoading: true, error: null });
    getElderAttendanceList(date)
      .then((data) => {
        if (n !== seq.current) return;
        const statuses = dayStatusesOf(data);
        setState({ statuses, hasData: statuses.size > 0, isLoading: false, error: null });
      })
      .catch(() => {
        if (n !== seq.current) return;
        setState({ statuses: EMPTY, hasData: false, isLoading: false, error: '출석 정보를 불러오지 못해 출석 표시 없이 모든 어르신을 보여 드립니다' });
      });
    return () => {
      seq.current += 1;
    };
  }, [date]);

  return state;
}
