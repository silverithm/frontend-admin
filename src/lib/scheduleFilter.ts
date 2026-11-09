/**
 * 월간일정 '일정 필터' 규칙 — `node --test src/lib/scheduleFilter.test.ts`
 *
 * 월간일정 탭(ScheduleCalendar)과 대시보드 달력(AdminDashboard)이 같은 필터를 쓴다.
 * 고른 값은 기관별 localStorage(carev.scheduleFilter.<companyId>)에 문자열 배열로 저장된다.
 *   일정 구분 — 'label:<id>' · 'noLabel'
 *   담당자    — 'myTasks'(나) · 'person:MEMBER:9' · 'person:ADMIN:3'
 *
 * 같은 묶음 안에서는 하나라도 맞으면 보이고(OR), 두 묶음을 다 골랐으면 둘 다 맞아야 보인다(AND).
 * '김요양 + 목욕'은 김요양이 맡은 목욕 일정이다 — 전부 OR이던 때는 둘을 같이 고르면
 * 오히려 더 많이 보였다(2026-11-09, 원장 요청 "담당자별로 월간업무 점검").
 */

export interface FilterableSchedule {
  isCompleted?: boolean;
  label?: { id?: string | number | null } | null;
  managerId?: number | string | null;
  managerType?: string | null;
  managerName?: string | null;
  tasks?: { assigneeMemberId?: number | string | null; assigneeName?: string | null }[] | null;
}

export const MY_SCHEDULES_FILTER = 'myTasks';
export const NO_LABEL_FILTER = 'noLabel';
const LABEL_PREFIX = 'label:';
const PERSON_PREFIX = 'person:';

export const labelFilterValue = (labelId: string | number) => `${LABEL_PREFIX}${labelId}`;
export const personFilterValue = (personKey: string) => `${PERSON_PREFIX}${personKey}`;

export const isKindFilterValue = (value: string) =>
  value === NO_LABEL_FILTER || value.startsWith(LABEL_PREFIX);
export const isPersonFilterValue = (value: string) =>
  value === MY_SCHEDULES_FILTER || value.startsWith(PERSON_PREFIX);

const isBlank = (value: unknown) => value == null || value === '';

/**
 * 사람 키 "MEMBER:9" / "ADMIN:3".
 * 담당자 id는 종류에 따라 members.id 또는 app_user.id라 숫자만으로는 겹칠 수 있다(V1.88 사고).
 */
export function managerPersonKey(schedule: FilterableSchedule): string | null {
  if (isBlank(schedule.managerId)) return null;
  return `${schedule.managerType === 'ADMIN' ? 'ADMIN' : 'MEMBER'}:${schedule.managerId}`;
}

/**
 * 이 일정을 맡은 사람들(키 → 이름) — 일정 담당자와 할 일 담당자.
 * 할 일 담당자는 늘 직원(members.id)이다. 참석자는 '맡은 사람'이 아니라 넣지 않는다.
 */
export function schedulePeople(schedule: FilterableSchedule): Map<string, string> {
  const people = new Map<string, string>();
  const managerKey = managerPersonKey(schedule);
  if (managerKey) people.set(managerKey, schedule.managerName?.trim() || '');
  for (const task of schedule.tasks ?? []) {
    if (isBlank(task.assigneeMemberId)) continue;
    const key = `MEMBER:${task.assigneeMemberId}`;
    const name = task.assigneeName?.trim() || '';
    if (!people.get(key)) people.set(key, name);
  }
  return people;
}

/**
 * 구분이 없는 일정인지.
 * 서버는 구분 없는 일정에도 빈 label({ id: null, name: '' })을 실어 보낸다(옛 앱이 label.color만
 * 읽어서다) — 객체가 있는지로 보던 때는 '구분 없음'을 골라도 아무 일정도 잡히지 않았다.
 */
export const hasNoLabel = (schedule: FilterableSchedule) => isBlank(schedule.label?.id);

/** 일정 구분 묶음만 따진다. 이 묶음에서 아무것도 안 골랐으면 통과. */
export function matchesKindFilter(schedule: FilterableSchedule, values: string[]): boolean {
  const kindValues = values.filter(isKindFilterValue);
  if (kindValues.length === 0) return true;
  return kindValues.some((value) =>
    value === NO_LABEL_FILTER
      ? hasNoLabel(schedule)
      : !hasNoLabel(schedule) && String(schedule.label?.id) === value.slice(LABEL_PREFIX.length),
  );
}

/** 담당자 묶음만 따진다. 'myTasks'는 화면마다 '내 일정' 판정이 달라 isMine으로 받는다. */
export function matchesPersonFilter(
  schedule: FilterableSchedule,
  values: string[],
  isMine: (schedule: FilterableSchedule) => boolean,
): boolean {
  const personValues = values.filter(isPersonFilterValue);
  if (personValues.length === 0) return true;
  const people = schedulePeople(schedule);
  return personValues.some((value) =>
    value === MY_SCHEDULES_FILTER ? isMine(schedule) : people.has(value.slice(PERSON_PREFIX.length)),
  );
}

export function matchesScheduleFilter(
  schedule: FilterableSchedule,
  values: string[],
  isMine: (schedule: FilterableSchedule) => boolean,
): boolean {
  if (values.length === 0) return true;
  return matchesKindFilter(schedule, values) && matchesPersonFilter(schedule, values, isMine);
}

export interface SchedulePersonOption {
  /** "MEMBER:9" / "ADMIN:3" */
  key: string;
  name: string;
  /** 이 사람이 맡은 일정 수 / 그중 수행완료된 수 */
  total: number;
  done: number;
}

/**
 * 필터에 띄울 담당자 목록 — 넘겨받은 일정(보고 있는 달)에 담당으로 걸린 사람만, 이름순.
 * 기관 직원 전부를 늘어놓지 않는다: 숲속은 직원 27명 중 한 달 담당자가 5~6명이다.
 * 이미 골라 둔 사람은 이번 달에 맡은 일정이 없어도 남긴다 — 사라지면 선택을 풀 길이 없다.
 * 완료 수는 일정 단위다(달력 막대·상단 진행도와 같은 기준).
 */
export function collectPersonOptions(
  schedules: FilterableSchedule[],
  selectedValues: string[],
  fallbackName: (personKey: string) => string | undefined = () => undefined,
): SchedulePersonOption[] {
  const byKey = new Map<string, SchedulePersonOption>();
  for (const schedule of schedules) {
    schedulePeople(schedule).forEach((name, key) => {
      const option = byKey.get(key) ?? { key, name: '', total: 0, done: 0 };
      option.total += 1;
      if (schedule.isCompleted) option.done += 1;
      if (!option.name && name) option.name = name;
      byKey.set(key, option);
    });
  }
  for (const value of selectedValues) {
    if (!value.startsWith(PERSON_PREFIX)) continue;
    const key = value.slice(PERSON_PREFIX.length);
    if (!byKey.has(key)) byKey.set(key, { key, name: '', total: 0, done: 0 });
  }
  return Array.from(byKey.values())
    .map((option) => ({ ...option, name: option.name || fallbackName(option.key) || '이름 없음' }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko') || a.key.localeCompare(b.key));
}
