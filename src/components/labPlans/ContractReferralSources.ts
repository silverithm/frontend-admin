'use client';

/**
 * 퇴소 연계기록지 초안의 근거 모으기 — 퇴소일 앞 3개월의 급여제공기록·간호일지·프로그램·기능회복훈련·사고·목욕을 기존 API로 읽어 사실 묶음(buildDischargeFacts)으로 만든다.
 * 기록 하나라도 읽지 못하면 일부만 담긴 초안이 나가므로 통째로 실패로 본다. 출석 일수는 참고라서 못 읽어도 null로 둔다.
 */
import { getElderAttendanceRange } from '@/lib/apiService';
import { buildDischargeFacts } from '@/lib/lab/dischargeRules';
import { listBathLogs, listCareEvents, listCareRecordsByElder, listNursingLogsByElder, listPrograms, listRehabSessions } from '@/lib/lab/labApi';
import type { DischargeFacts } from '@/lib/lab/labTypes';
import { monthsBetween } from '@/components/labRecords/recordsFormat';
import { presentDaysOf } from '@/components/labRecords/useElderAttendance';

export interface CollectedFacts {
  facts: DischargeFacts;
  /** 사실을 모은 기간(화면에 보여 줄 때 쓴다) */
  from: string;
  to: string;
}

export async function collectDischargeFacts(elderlyId: number, from: string, to: string): Promise<CollectedFacts> {
  const months = monthsBetween(from, to);
  const perMonth = await Promise.all(
    months.map((month) =>
      Promise.all([listCareRecordsByElder(elderlyId, month), listNursingLogsByElder(elderlyId, month), listPrograms(month), listRehabSessions({ elderlyId, month }), listBathLogs({ elderlyId, month })]),
    ),
  );
  const events = await listCareEvents({ elderlyId });
  const attendanceDays = await getElderAttendanceRange(from, to)
    .then((data) => presentDaysOf(data).get(elderlyId) ?? 0)
    .catch(() => null);
  const facts = buildDischargeFacts({
    elderlyId,
    from,
    to,
    careRecords: perMonth.flatMap((m) => m[0]),
    nursingLogs: perMonth.flatMap((m) => m[1]),
    programs: perMonth.flatMap((m) => m[2]),
    rehabSessions: perMonth.flatMap((m) => m[3]),
    events,
    bathLogs: perMonth.flatMap((m) => m[4]),
    attendanceDays,
  });
  return { facts, from, to };
}
