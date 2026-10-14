'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getCompanyElders } from '@/lib/apiService';
import { errorText } from './labFormat';

/** 실험실 화면이 쓰는 어르신 최소 정보. 케어 프로필의 등급만 가져온다. */
export interface LabElder {
  id: number;
  name: string;
  careGrade: string | null;
}

export async function fetchLabElders(): Promise<LabElder[]> {
  const data: unknown = await getCompanyElders();
  const record = data as { elders?: unknown; content?: unknown; data?: unknown } | null;
  const raw = Array.isArray(data) ? data : record?.elders ?? record?.content ?? record?.data ?? [];
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((e: { id?: unknown; name?: unknown; careProfile?: { careGrade?: unknown } | null }) => ({
      id: Number(e.id),
      name: typeof e.name === 'string' ? e.name : '',
      careGrade: typeof e.careProfile?.careGrade === 'string' ? e.careProfile.careGrade : null,
    }))
    .filter((e) => Number.isInteger(e.id) && e.id > 0 && e.name !== '')
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}

export function useLabElders() {
  const [elders, setElders] = useState<LabElder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const reload = useCallback(async () => {
    const id = ++seq.current;
    setIsLoading(true);
    setError(null);
    try {
      const list = await fetchLabElders();
      if (id !== seq.current) return;
      setElders(list);
    } catch (e) {
      if (id !== seq.current) return;
      setError(errorText(e, '어르신 목록을 불러오지 못했습니다'));
    } finally {
      if (id === seq.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    return () => {
      seq.current += 1;
    };
  }, [reload]);

  return { elders, isLoading, error, reload };
}
