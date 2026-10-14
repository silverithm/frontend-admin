'use client';

/** 진료 동행 화면이 읽는 것 — 그 달 목록, 후속 확인 예정, 올해 전체(통계용). 서로 따로 불러와 하나가 실패해도 나머지는 보인다. */
import { useCallback } from 'react';
import { listMedicalVisits } from '@/lib/lab/labApi';
import type { MedicalVisit } from '@/lib/lab/labTypes';
import { useRecordsLoader } from './useRecordsLoader';

const NONE: MedicalVisit[] = [];

export function useMedicalVisitData(month: string, year: number) {
  const loadMonth = useCallback(() => listMedicalVisits({ month }), [month]);
  const loadDue = useCallback(() => listMedicalVisits({ followUpDue: true }), []);
  // 서버는 조건 하나가 꼭 있어야 하므로 올해는 열두 달을 한꺼번에 읽는다
  const loadYear = useCallback(async () => {
    const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
    const parts = await Promise.all(months.map((m) => listMedicalVisits({ month: m })));
    return parts.flat();
  }, [year]);

  const monthData = useRecordsLoader(loadMonth, '진료 동행 기록을 불러오지 못했습니다', NONE);
  const dueData = useRecordsLoader(loadDue, '후속 확인 예정을 불러오지 못했습니다', NONE);
  const yearData = useRecordsLoader(loadYear, '올해 통계를 불러오지 못했습니다', NONE);

  const reloadAll = useCallback(() => {
    void monthData.reload();
    void dueData.reload();
    void yearData.reload();
  }, [monthData, dueData, yearData]);

  return { monthData, dueData, yearData, reloadAll };
}
