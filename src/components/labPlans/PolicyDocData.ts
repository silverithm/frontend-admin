'use client';

/** 규정·지침 대장 읽기 — 늦게 온 응답은 버린다. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { errorText } from '@/components/lab/labFormat';
import { dedupeById, useAlive } from '@/components/labRecords/recordsFormat';
import { listPolicyDocs } from '@/lib/lab/labApi';
import type { PolicyDoc } from '@/lib/lab/labTypes';

export function usePolicyDocs() {
  const alive = useAlive();
  const seq = useRef(0);
  const [docs, setDocs] = useState<PolicyDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    const n = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const list = await listPolicyDocs();
      if (!alive.current || n !== seq.current) return;
      setDocs(dedupeById(list));
    } catch (err) {
      if (!alive.current || n !== seq.current) return;
      setError(errorText(err, '규정·지침 대장을 불러오지 못했습니다'));
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
  return { docs, loading, error, reload };
}
