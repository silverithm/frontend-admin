'use client';

/** 투약의뢰서 전체(진행 중 + 끝남)를 한 번에 읽는다. 오늘 투약과 의뢰서 목록이 같은 자료를 쓴다. 늦게 온 응답은 버린다. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { listMedicationRequests } from '@/lib/lab/labApi';
import type { MedicationRequest } from '@/lib/lab/labTypes';
import { errorText } from '@/components/lab/labFormat';

export function useMedicationRequests() {
  const [requests, setRequests] = useState<MedicationRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const reload = useCallback(async () => {
    const n = ++seq.current;
    setIsLoading(true);
    setError(null);
    try {
      const [active, ended] = await Promise.all([listMedicationRequests({ status: 'ACTIVE' }), listMedicationRequests({ status: 'ENDED' })]);
      if (n !== seq.current) return;
      const byId = new Map<number, MedicationRequest>();
      for (const r of [...ended, ...active]) byId.set(r.id, r);
      setRequests([...byId.values()]);
    } catch (e) {
      if (n === seq.current) {
        setRequests([]);
        setError(errorText(e, '투약의뢰서를 불러오지 못했습니다'));
      }
    } finally {
      if (n === seq.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    return () => {
      seq.current += 1;
    };
  }, [reload]);

  return { requests, isLoading, error, reload };
}
