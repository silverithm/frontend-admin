'use client';

/** 시설 관리 대장이 읽는 자료 — 늦게 온 응답은 버리고, 읽는 중·실패를 따로 알려 준다. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { errorText } from '@/components/lab/labFormat';
import { dedupeById, useAlive } from '@/components/labRecords/recordsFormat';
import { getFacilityProfile, listFacilityLogs } from '@/lib/lab/labApi';
import type { FacilityItemCode, FacilityLog, FacilityProfile } from '@/lib/lab/labTypes';
import { LOG_YEARS } from './FacilityLedgerFormat';

export interface Loaded<T> {
  data: T;
  setData: (next: T) => void;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/** load는 useCallback으로 안정된 함수여야 한다 */
function useAsync<T>(load: () => Promise<T>, initial: T, message: string): Loaded<T> {
  const alive = useAlive();
  const seq = useRef(0);
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    const n = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const result = await load();
      if (!alive.current || n !== seq.current) return;
      setData(result);
    } catch (err) {
      if (!alive.current || n !== seq.current) return;
      setError(errorText(err, message));
    } finally {
      if (alive.current && n === seq.current) setLoading(false);
    }
  }, [alive, load, message]);
  useEffect(() => {
    void reload();
    return () => {
      seq.current += 1;
    };
  }, [reload]);
  return { data, setData, loading, error, reload };
}

export function useFacilityProfile() {
  const load = useCallback(() => getFacilityProfile(), []);
  return useAsync<FacilityProfile | null>(load, null, '시설 정보를 불러오지 못했습니다');
}

/** 올해와 지난 몇 해의 모든 항목 기록 — 마지막 실시일과 다음 기한을 계산하는 데 쓴다 */
export function useYearLogs(thisYear: number) {
  const load = useCallback(async (): Promise<FacilityLog[]> => {
    const years = Array.from({ length: LOG_YEARS }, (_, i) => thisYear - i);
    return dedupeById((await Promise.all(years.map((y) => listFacilityLogs({ year: y })))).flat());
  }, [thisYear]);
  return useAsync<FacilityLog[]>(load, [], '시설 점검 기록을 불러오지 못했습니다');
}

/** 한 항목의 기록 전체(오래된 것 포함) */
export function useItemLogs(code: FacilityItemCode) {
  const load = useCallback(() => listFacilityLogs({ itemCode: code }), [code]);
  return useAsync<FacilityLog[]>(load, [], '이 항목의 실시 기록을 불러오지 못했습니다');
}
