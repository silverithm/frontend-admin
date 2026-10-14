/** 저장 기록 한 달의 점검 결과 — 월 입소자 수·월 기준 근무시간·staffingCheck. 지난달 위반 여부는 호출하는 쪽이 넣는다. */
import { monthlyUsers, staffingCheck, standardMonthlyHours } from '@/lib/lab/staffingRules';
import type { StaffingCheck } from '@/lib/lab/staffingRules';
import type { StaffingMonth } from '@/lib/lab/labTypes';

export function checkOfRecord(r: StaffingMonth, previousViolated?: boolean): { users: number; standardHours: number; check: StaffingCheck } {
  const users = monthlyUsers(r.usersSum, r.serviceDays);
  const standardHours = standardMonthlyHours(r.staffingMonth, r.holidays);
  return { users, standardHours, check: staffingCheck({ users, staff: r.staff, standardHours, previousViolated }) };
}
