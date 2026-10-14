'use client';

/**
 * 대조에 쓸 자료 읽기 — 그 달 출석(기존 출결 API, 출석한 날짜)과 본인부담금 청구서(listCopayBills).
 * 둘 중 하나라도 못 읽으면 잘못된 비교가 나가므로 통째로 실패로 본다.
 */
import { getElderAttendanceRange } from '@/lib/apiService';
import { monthRange } from '@/components/lab/labFormat';
import { presentDatesOf } from '@/components/labRecords/useElderAttendance';
import { listCopayBills } from '@/lib/lab/labApi';
import type { CopayBill } from '@/lib/lab/labTypes';

export interface ClaimData {
  month: string;
  /** 어르신별 출석한 날짜 */
  attendance: Record<number, string[]>;
  bills: CopayBill[];
}

export async function loadClaimData(month: string): Promise<ClaimData> {
  const { start, end } = monthRange(month);
  const [attendance, bills] = await Promise.all([getElderAttendanceRange(start, end).then(presentDatesOf), listCopayBills(month)]);
  return { month, attendance, bills };
}
