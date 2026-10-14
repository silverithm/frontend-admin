'use client';

/** 운영위원 명단과 한 해 회의 기록 읽기 — 늦게 온 응답은 버린다. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { errorText } from '@/components/lab/labFormat';
import { dedupeById, useAlive } from '@/components/labRecords/recordsFormat';
import { listCommitteeMeetings, listCommitteeMembers } from '@/lib/lab/labApi';
import type { CommitteeMeeting, CommitteeMember } from '@/lib/lab/labTypes';

export function useCommitteeMembers() {
  const alive = useAlive();
  const seq = useRef(0);
  const [members, setMembers] = useState<CommitteeMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    const n = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const list = await listCommitteeMembers();
      if (!alive.current || n !== seq.current) return;
      setMembers(dedupeById(list));
    } catch (err) {
      if (!alive.current || n !== seq.current) return;
      setError(errorText(err, '운영위원 명단을 불러오지 못했습니다'));
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
  return { members, loading, error, reload };
}

export function useCommitteeMeetings(year: number) {
  const alive = useAlive();
  const seq = useRef(0);
  const [meetings, setMeetings] = useState<CommitteeMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    const n = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const list = await listCommitteeMeetings(year);
      if (!alive.current || n !== seq.current) return;
      setMeetings(dedupeById(list));
    } catch (err) {
      if (!alive.current || n !== seq.current) return;
      setError(errorText(err, '회의 기록을 불러오지 못했습니다'));
    } finally {
      if (alive.current && n === seq.current) setLoading(false);
    }
  }, [year, alive]);
  useEffect(() => {
    void reload();
    return () => {
      seq.current += 1;
    };
  }, [reload]);
  return { meetings, loading, error, reload };
}
