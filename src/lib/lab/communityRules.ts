/**
 * 봉사자 활동·외부기관 연계 규칙.
 *
 * 근거(research-5.md)
 *  - VMS 인증: 1일 8시간(480분) 이내만 인증, 활동일로부터 30일 이내 등록이 원칙(초과분은 활동일지로 입증하면 관리본부 판단).
 *  - 분 단위 인정·반올림 규칙은 공식 원문에서 확인하지 못했다 — 시간(hours) 환산은 화면 표시용 반올림이며 대조 필요.
 *  - 2026 평가에서 자원봉사 지표는 삭제됐다. 이 일지는 기관 자체 기록이다.
 *  - 외부기관연계(2026): 의료기관 진료 내용 기록 + 연계기록지 제공(referralGiven). 지역사회 자원 연계 전용 지표는 없다.
 */
import type { ResourceLink, ResourceType, VolunteerLog } from './labTypes.ts';
import { parseYmd } from './labDate.ts';

export const VOLUNTEER_ACTIVITY_TYPES: ReadonlyArray<{ value: VolunteerLog['activityType']; label: string }> = [
  { value: 'MEAL', label: '식사 도움' },
  { value: 'PROGRAM', label: '프로그램 보조' },
  { value: 'COMPANION', label: '말벗·산책' },
  { value: 'CLEANING', label: '청소·환경 정리' },
  { value: 'TALENT', label: '재능기부(공연·미용 등)' },
  { value: 'OTHER', label: '기타' },
];

export const RESOURCE_TYPES: ReadonlyArray<{ value: ResourceType; label: string }> = [
  { value: 'MEDICAL', label: '의료기관' },
  { value: 'HEALTH_CENTER', label: '보건소' },
  { value: 'DEMENTIA_CENTER', label: '치매안심센터' },
  { value: 'WELFARE', label: '복지관·복지서비스' },
  { value: 'COMMUNITY', label: '지역사회·주민자치' },
  { value: 'GOODS', label: '후원 물품' },
  { value: 'EDUCATION', label: '교육·강사' },
  { value: 'OTHER', label: '기타' },
];

export function resourceTypeLabel(type: string): string {
  return RESOURCE_TYPES.find((t) => t.value === type)?.label ?? type;
}

/** 한 사람 하루 인증 한도(VMS 1일 8시간) */
export const VMS_DAILY_MINUTES = 480;
/** 서버가 받는 활동 1건의 최대(720분) */
export const MAX_VOLUNTEER_MINUTES = 720;
/** 활동일로부터 VMS 등록 기한(일) */
export const VMS_REGISTER_DAYS = 30;

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** 'HH:MM' 두 시각 사이의 분. 끝 ≤ 시작이거나 형식이 틀리면 null */
export function volunteerMinutes(start: string, end: string): number | null {
  const s = typeof start === 'string' ? HHMM.exec(start) : null;
  const e = typeof end === 'string' ? HHMM.exec(end) : null;
  if (!s || !e) return null;
  const diff = Number(e[1]) * 60 + Number(e[2]) - (Number(s[1]) * 60 + Number(s[2]));
  return diff > 0 ? diff : null;
}

function dayNumber(date: string): number {
  const p = parseYmd(date);
  return p ? Date.UTC(p.year, p.month - 1, p.day) / 86_400_000 : NaN;
}

export interface VolunteerPersonSummary {
  volunteerName: string;
  count: number;
  minutes: number;
  /** minutes/60, 소수 첫째 자리 반올림(인증 반올림 규칙은 대조 필요) */
  hours: number;
  /** 한 사람 하루 합을 480분으로 자른 합 */
  certifiableMinutes: number;
}

export interface VolunteerSummary {
  byVolunteer: VolunteerPersonSummary[];
  byMonth: Record<string, number>;
  totalMinutes: number;
  /** VMS 미등록 건수 */
  vmsPending: number;
  /** 미등록이고 today가 활동일 + 30일보다 뒤인 건수 */
  vmsOverdue: number;
}

function hoursOf(minutes: number): number {
  // 정수로 반올림(부동소수 .5 오차 방지)
  return Math.floor((minutes * 10 + 30) / 60) / 10;
}

/** 그 해 봉사 실적 요약. 이름은 앞뒤 공백을 지운 뒤 같으면 같은 사람. */
export function volunteerSummary(logs: ReadonlyArray<Pick<VolunteerLog, 'activityDate' | 'volunteerName' | 'minutes' | 'vmsRegistered'>>, year: number, today: string): VolunteerSummary {
  const people = new Map<string, { count: number; minutes: number; days: Map<string, number> }>();
  const byMonth: Record<string, number> = {};
  let totalMinutes = 0;
  let vmsPending = 0;
  let vmsOverdue = 0;
  const todayNo = dayNumber(today);
  for (const log of logs) {
    if (typeof log.activityDate !== 'string' || log.activityDate.slice(0, 4) !== String(year)) continue;
    const minutes = Number.isFinite(log.minutes) && log.minutes > 0 ? Math.trunc(log.minutes) : 0;
    const name = (log.volunteerName ?? '').trim();
    let person = people.get(name);
    if (!person) people.set(name, (person = { count: 0, minutes: 0, days: new Map() }));
    person.count += 1;
    person.minutes += minutes;
    person.days.set(log.activityDate, (person.days.get(log.activityDate) ?? 0) + minutes);
    const month = log.activityDate.slice(0, 7);
    byMonth[month] = (byMonth[month] ?? 0) + minutes;
    totalMinutes += minutes;
    if (!log.vmsRegistered) {
      vmsPending += 1;
      if (todayNo > dayNumber(log.activityDate) + VMS_REGISTER_DAYS) vmsOverdue += 1;
    }
  }
  const byVolunteer = [...people.entries()]
    .map(([volunteerName, p]) => ({
      volunteerName,
      count: p.count,
      minutes: p.minutes,
      hours: hoursOf(p.minutes),
      certifiableMinutes: [...p.days.values()].reduce((n, m) => n + Math.min(m, VMS_DAILY_MINUTES), 0),
    }))
    .sort((a, b) => a.volunteerName.localeCompare(b.volunteerName, 'ko'));
  return { byVolunteer, byMonth, totalMinutes, vmsPending, vmsOverdue };
}

export interface ResourceSummary<T> {
  total: number;
  byType: Record<ResourceType, number>;
  /** 연계 대상 어르신 수(기관 전체 연계는 세지 않는다) */
  eldersLinked: number;
  /** 후속 확인 예정일이 오늘 이전이고 결과가 비어 있는 연계 */
  followUpsDue: T[];
}

/** 그 해 자원연계 요약 */
export function resourceSummary<T extends Pick<ResourceLink, 'elderlyId' | 'linkedOn' | 'resourceType' | 'followUpOn' | 'outcome'>>(links: ReadonlyArray<T>, year: number, today: string): ResourceSummary<T> {
  const byType = Object.fromEntries(RESOURCE_TYPES.map((t) => [t.value, 0])) as Record<ResourceType, number>;
  const elders = new Set<number>();
  const due: T[] = [];
  let total = 0;
  for (const l of links) {
    if (typeof l.linkedOn !== 'string' || l.linkedOn.slice(0, 4) !== String(year)) continue;
    total += 1;
    if (l.resourceType in byType) byType[l.resourceType] += 1;
    if (l.elderlyId !== null && l.elderlyId !== undefined) elders.add(l.elderlyId);
    if (typeof l.followUpOn === 'string' && l.followUpOn !== '' && l.followUpOn <= today && (l.outcome ?? '').trim() === '') due.push(l);
  }
  due.sort((a, b) => ((a.followUpOn ?? '') < (b.followUpOn ?? '') ? -1 : (a.followUpOn ?? '') > (b.followUpOn ?? '') ? 1 : 0));
  return { total, byType, eldersLinked: elders.size, followUpsDue: due };
}
