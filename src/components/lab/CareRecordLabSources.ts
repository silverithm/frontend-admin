'use client';

/**
 * 급여제공기록 화면이 서식 칸을 위해 따로 불러오는 두 가지 — 제공 직원 후보(직원 목록)와 그 달 프로그램 일지(인지활동형 제안·점검).
 * 둘 다 곁가지라서 실패해도 기록 화면은 멈추지 않고, 실패 문구만 남긴다. 달을 빨리 넘길 때 늦게 온 응답은 버린다.
 */
import { useEffect, useRef, useState } from 'react';
import { listLabStaff, listPrograms } from '@/lib/lab/labApi';
import type { LabStaff, Program } from '@/lib/lab/labTypes';
import { errorText } from './labFormat';

export function useCareStaff(): { staff: LabStaff[]; error: string | null } {
  const [state, setState] = useState<{ staff: LabStaff[]; error: string | null }>({ staff: [], error: null });
  useEffect(() => {
    let alive = true;
    listLabStaff()
      .then((staff) => {
        if (alive) setState({ staff: [...staff].sort((a, b) => a.name.localeCompare(b.name, 'ko')), error: null });
      })
      .catch((e) => {
        if (alive) setState({ staff: [], error: errorText(e, '직원 목록을 불러오지 못했습니다') });
      });
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

/** date가 든 달의 프로그램 일지. 불러오는 중이거나 실패하면 programs는 null이다(점검을 건너뛴다). */
export function useDayPrograms(date: string): { programs: Program[] | null; error: string | null } {
  const month = date.slice(0, 7);
  const [state, setState] = useState<{ month: string; programs: Program[] | null; error: string | null }>({ month, programs: null, error: null });
  const seq = useRef(0);
  useEffect(() => {
    const n = ++seq.current;
    listPrograms(month)
      .then((programs) => {
        if (n === seq.current) setState({ month, programs, error: null });
      })
      .catch((e) => {
        if (n === seq.current) setState({ month, programs: null, error: errorText(e, '프로그램 일지를 불러오지 못했습니다') });
      });
    return () => {
      seq.current += 1;
    };
  }, [month]);
  // 달이 바뀐 직후 한 번은 지난달 값이 남아 있으므로 달이 맞을 때만 내준다
  return state.month === month ? { programs: state.programs, error: state.error } : { programs: null, error: null };
}
