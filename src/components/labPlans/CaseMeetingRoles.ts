/** 참석자 이름·직종 — 직원 목록과 직원 인사 기준(직종)을 맞춰 보는 도우미. */
import { staffJobTypeLabel } from '@/lib/lab/staffingRules';
import type { LabStaff, StaffProfile } from '@/lib/lab/labTypes';

export interface Person {
  id: number;
  name: string;
}

/** 직원 id → 이름. 직원 목록에 없으면 저장된 회의에 적힌 이름 */
export function nameLookup(staff: readonly LabStaff[], saved: Record<number, string>): (id: number) => string {
  const map = new Map<number, string>(staff.map((s) => [s.id, s.name]));
  return (id) => map.get(id) ?? saved[id] ?? `직원 ${id}`;
}

/** 직원 id → 직종 이름(직원 인사 기준이 없으면 null) */
export function jobLookup(profiles: readonly StaffProfile[]): (id: number) => string | null {
  const map = new Map<number, string>(profiles.map((p) => [p.memberId, staffJobTypeLabel(p.jobType)]));
  return (id) => map.get(id) ?? null;
}

/** 참석자의 직종 이름 묶음(AI로 보내는 것은 이 이름뿐) — 직종 이름 → 그 직종 참석자 */
export function rolesOf(attendeeIds: readonly number[], nameOf: (id: number) => string, jobOf: (id: number) => string | null): Map<string, Person[]> {
  const map = new Map<string, Person[]>();
  for (const id of new Set(attendeeIds)) {
    const job = jobOf(id);
    if (!job) continue;
    map.set(job, [...(map.get(job) ?? []), { id, name: nameOf(id) }]);
  }
  return map;
}
