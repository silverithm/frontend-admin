'use client';

/**
 * 안내에 쓸 사실의 원재료 — 그 달 급여제공기록·간호일지·프로그램·기능회복훈련·사고·본인부담금 청구서를 기존 API로 읽는다.
 * 하나라도 읽지 못하면 일부만 담긴 안내가 나가므로 통째로 실패로 본다(다시 읽기).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  listCareEvents,
  listCareRecordsByElder,
  listCopayBills,
  listNursingLogsByElder,
  listPrograms,
  listRehabSessions,
} from '@/lib/lab/labApi';
import type { CareEvent, CareRecord, CopayBill, NursingLog, Program, RehabSession } from '@/lib/lab/labTypes';
import { errorText } from '@/components/lab/labFormat';

export interface NoticeSources {
  careRecords: CareRecord[];
  nursingLogs: NursingLog[];
  programs: Program[];
  rehabSessions: RehabSession[];
  events: CareEvent[];
  copayBill: CopayBill | null;
}

export function useNoticeSources(elderId: number, month: string, enabled: boolean) {
  const [sources, setSources] = useState<NoticeSources | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const n = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const [careRecords, nursingLogs, programs, rehabSessions, events, bills] = await Promise.all([
        listCareRecordsByElder(elderId, month),
        listNursingLogsByElder(elderId, month),
        listPrograms(month),
        listRehabSessions({ elderlyId: elderId, month }),
        listCareEvents({ elderlyId: elderId }),
        listCopayBills(month),
      ]);
      if (n !== seq.current) return;
      setSources({ careRecords, nursingLogs, programs, rehabSessions, events, copayBill: bills.find((b) => b.elderlyId === elderId) ?? null });
    } catch (e) {
      if (n !== seq.current) return;
      setSources(null);
      setError(errorText(e, '이 달의 기록을 모으지 못했습니다'));
    } finally {
      if (n === seq.current) setLoading(false);
    }
  }, [elderId, month]);

  useEffect(() => {
    if (!enabled) return;
    void load();
    return () => {
      seq.current += 1;
    };
  }, [enabled, load]);

  return { sources, loading, error, reload: load };
}
