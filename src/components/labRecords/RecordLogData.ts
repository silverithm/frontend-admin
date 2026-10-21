'use client';

/** 종류별 기록 화면이 읽는 것 — 그 달 목록, 올해 전체(안전관리 설명 현황·현금영수증 연 합계용). 따로 불러와 하나가 실패해도 나머지는 보인다. */
import { useCallback } from 'react';
import { listRecordLogs } from '@/lib/lab/labApi';
import type { RecordLog, RecordLogKind } from '@/lib/lab/labTypes';
import { useRecordsLoader } from './useRecordsLoader';

const NONE: RecordLog[] = [];

export function useRecordLogData(kind: RecordLogKind, month: string, year: number, withYear: boolean) {
  const loadMonth = useCallback(() => listRecordLogs(kind, { month }), [kind, month]);
  const loadYear = useCallback(() => (withYear ? listRecordLogs(kind, { year }) : Promise.resolve(NONE)), [kind, year, withYear]);
  const monthData = useRecordsLoader(loadMonth, '기록을 불러오지 못했습니다', NONE);
  const yearData = useRecordsLoader(loadYear, '올해 기록을 불러오지 못했습니다', NONE);
  const reloadAll = useCallback(() => {
    void monthData.reload();
    if (withYear) void yearData.reload();
  }, [monthData, yearData, withYear]);
  return { monthData, yearData, reloadAll };
}
