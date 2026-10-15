'use client';

/** 사례관리 회의 읽기 — 회의 목록(여러 해), 직원·직원 인사 기준. 늦게 온 응답은 버린다. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { errorText } from '@/components/lab/labFormat';
import { dedupeById, useAlive } from '@/components/labRecords/recordsFormat';
import { listCaseMeetings, listLabStaff, listStaffProfiles } from '@/lib/lab/labApi';
import type { CaseMeeting, LabStaff, StaffProfile } from '@/lib/lab/labTypes';

/** years의 회의를 모두 읽는다. refreshKey가 바뀌면 다시 읽는다 */
export function useCaseMeetings(years: number[], refreshKey: number) {
  const alive = useAlive();
  const seq = useRef(0);
  const yearKey = years.join(',');
  const [meetings, setMeetings] = useState<CaseMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const n = ++seq.current;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const lists = await Promise.all(yearKey.split(',').map((y) => listCaseMeetings(Number(y))));
        if (!alive.current || n !== seq.current) return;
        setMeetings(dedupeById(lists.flat()));
      } catch (err) {
        if (!alive.current || n !== seq.current) return;
        setError(errorText(err, '사례관리 회의 기록을 불러오지 못했습니다'));
      } finally {
        if (alive.current && n === seq.current) setLoading(false);
      }
    })();
    return () => {
      seq.current += 1;
    };
  }, [yearKey, refreshKey, retry, alive]);
  const reload = useCallback(() => setRetry((r) => r + 1), []);
  return { meetings, loading, error, reload };
}

/** 참석자 후보(같은 기관 직원)와 직원 인사 기준(직종·입사일) */
export function useCaseRoster() {
  const alive = useAlive();
  const seq = useRef(0);
  const [staff, setStaff] = useState<LabStaff[]>([]);
  const [profiles, setProfiles] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    const n = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const [s, p] = await Promise.all([listLabStaff(), listStaffProfiles()]);
      if (!alive.current || n !== seq.current) return;
      setStaff(s);
      setProfiles(p);
    } catch (err) {
      if (!alive.current || n !== seq.current) return;
      setError(errorText(err, '직원 목록을 불러오지 못했습니다'));
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
  return { staff, profiles, loading, error, reload };
}
