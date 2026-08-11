/**
 * 달력 칸에 얹을 "그날 휴무자" 명단.
 *
 * 근무조정 탭(VacationCalendar)이 쓰는 /api/vacation/calendar를 그대로 쓰되,
 * 달력 칸에 필요한 최소 정보(이름·종류 배지)만 남겨 날짜별 Map으로 돌려준다.
 * 월간일정 탭과 대시보드 달력이 같은 함수를 쓴다.
 */

import type { CSSProperties } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { getVacationCalendar } from '@/lib/apiService';
import { resolveVacationKind } from '@/types/vacation';

export interface VacationPerson {
  id: string;
  name: string;
  /** 셀 배지 한 글자 (연/반/필/대/일) */
  short: string;
  /** 배지 색 (CSS 변수) */
  color: string;
  /** 툴팁용 종류 이름 */
  kindLabel: string;
}

/**
 * 휴무 종류 배지(색 원 안에 연/반/필/대/일).
 * 근무조정 달력(VacationCalendar)의 circleBadgeStyle과 같은 모양·색이어야 한다 —
 * 두 화면에서 같은 휴무가 다르게 보이면 색을 외운 의미가 없다.
 */
export const vacationKindBadgeStyle = (background: string, size = 12): CSSProperties => ({
  width: size,
  height: size,
  borderRadius: 'var(--radius-full)',
  background,
  color: 'var(--color-on-accent)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  fontSize: size <= 12 ? 'var(--font-size-2xs)' : 'var(--font-size-xs)',
  fontWeight: 'var(--font-weight-bold)',
  lineHeight: 1,
});

interface RawPerson {
  id?: string | number;
  userName?: string;
  memberName?: string;
  name?: string;
  status?: string;
  type?: string;
  vacationType?: string;
  duration?: string;
}

const toPerson = (raw: RawPerson, index: number): VacationPerson | null => {
  // 이름은 근무조정 달력(VacationCalendar)과 같은 필드를 같은 순서로 본다 —
  // 두 화면에 다른 이름이 뜨면 같은 사람인지 알 수 없다.
  const name = (raw.userName || raw.memberName || raw.name || '').trim();
  if (!name) return null;
  const kind = resolveVacationKind(raw.type || raw.vacationType, raw.duration);
  return {
    id: String(raw.id ?? `${name}-${index}`),
    name,
    short: kind.short,
    color: kind.color,
    kindLabel: kind.label,
  };
};

/**
 * 한 달치 휴무자를 날짜별로 모은다.
 * 반려된 신청은 근무에 영향이 없으므로 뺀다 (근무조정 달력과 같은 규칙).
 */
export async function fetchMonthVacations(monthDate: Date): Promise<Map<string, VacationPerson[]>> {
  const startDate = format(startOfMonth(monthDate), 'yyyy-MM-dd');
  const endDate = format(endOfMonth(monthDate), 'yyyy-MM-dd');
  const data = await getVacationCalendar(startDate, endDate);

  const result = new Map<string, VacationPerson[]>();
  const dates = (data && typeof data === 'object' ? (data as Record<string, unknown>).dates : null) as
    | Record<string, { vacations?: RawPerson[]; people?: RawPerson[] }>
    | null;
  if (!dates || typeof dates !== 'object') return result;

  Object.entries(dates).forEach(([dateKey, dayData]) => {
    const raw = dayData?.vacations || dayData?.people || [];
    if (!Array.isArray(raw)) return;
    const people = raw
      .filter((person) => person && person.status !== 'rejected')
      .map(toPerson)
      .filter((person): person is VacationPerson => person !== null);
    if (people.length > 0) result.set(dateKey, people);
  });

  return result;
}
