'use client';

/** 직원 복지 화면이 읽는 자료들 — 늦게 온 응답은 버리고, 읽는 중·실패를 따로 알려 준다. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { errorText } from '@/components/lab/labFormat';
import { dedupeById, useAlive } from '@/components/labRecords/recordsFormat';
import { getGrievanceSummary, listBonusFunds, listLabStaff, listLedgerEntriesByYear, listPayrollProfiles, listPolicyDocs, listStaffWelfare } from '@/lib/lab/labApi';
import type { BonusFund, GrievanceSummary, LabStaff, LedgerEntry, PayrollProfile, PolicyDoc, StaffWelfare } from '@/lib/lab/labTypes';

/** 제공대장은 2026년부터 본다 */
export const FIRST_YEAR = 2026;

export function yearsFrom(thisYear: number): number[] {
  const out: number[] = [];
  for (let y = FIRST_YEAR; y <= Math.max(thisYear, FIRST_YEAR); y += 1) out.push(y);
  return out;
}

interface Loaded<T> {
  data: T;
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
  return { data, loading, error, reload };
}

/** 2026년부터 올해까지의 복지 제공대장(분기 판정이 해를 넘어 이어지므로 한꺼번에 읽는다) */
export function useWelfareEntries(thisYear: number) {
  const load = useCallback(async (): Promise<StaffWelfare[]> => dedupeById((await Promise.all(yearsFrom(thisYear).map((y) => listStaffWelfare(y)))).flat()), [thisYear]);
  return useAsync<StaffWelfare[]>(load, [], '직원 복지 제공대장을 불러오지 못했습니다');
}

export function useBonusFunds(thisYear: number) {
  const load = useCallback(async (): Promise<BonusFund[]> => dedupeById((await Promise.all(yearsFrom(thisYear).map((y) => listBonusFunds(y)))).flat()), [thisYear]);
  return useAsync<BonusFund[]>(load, [], '가산금 기록을 불러오지 못했습니다');
}

export function useGrievance(year: number) {
  const load = useCallback(() => getGrievanceSummary(year), [year]);
  return useAsync<GrievanceSummary | null>(load, null, '고충 처리 현황을 불러오지 못했습니다');
}

export function usePayrollProfiles() {
  const load = useCallback(() => listPayrollProfiles(), []);
  return useAsync<PayrollProfile[]>(load, [], '직원 급여 기준을 불러오지 못했습니다');
}

export function useStaffList() {
  const load = useCallback(() => listLabStaff(), []);
  return useAsync<LabStaff[]>(load, [], '직원 목록을 불러오지 못했습니다');
}

export function useLedgerYear(year: number) {
  const load = useCallback(() => listLedgerEntriesByYear(year), [year]);
  return useAsync<LedgerEntry[]>(load, [], '회계 장부를 불러오지 못했습니다');
}

/** 규정·지침 대장 — 고충처리지침의 세 요소 확인에 쓴다 */
export function usePolicyDocList() {
  const load = useCallback(async (): Promise<PolicyDoc[]> => dedupeById(await listPolicyDocs()), []);
  return useAsync<PolicyDoc[]>(load, [], '규정·지침 대장을 불러오지 못했습니다');
}
