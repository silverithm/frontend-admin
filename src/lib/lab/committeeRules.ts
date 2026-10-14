/**
 * 운영위원회 규칙(순수 함수).
 *
 * 근거(research-8.md 5절)
 *  - 노인복지법 시행규칙 별표 10 제7호: 사회복지사업법 제36조·같은 법 시행규칙 제24조에 따른 운영위원회를 설치·운영해야 한다.
 *  - 사회복지사업법 시행규칙 제24조: 위원은 위원장 포함 5명 이상 15명 이하, 임기 3년(④).
 *  - 사회복지사업법 제36조③: 시설의 장은 회계·예산·결산, 후원금, 시설운영 관련 사건·사고를 운영위원회에 보고한다.
 *
 * ⚠ 대조 필요: 개최 주기(연 몇 회)·회의록 보관 기간은 법령 본문에 숫자가 없다(제24조⑤가 복지부장관 고시에 위임).
 * 화면의 '분기 1회'는 기관 기준 안내일 뿐 법정 횟수가 아니다. 같은 호 해당 위원 2명 초과 불가(제24조①)는 이 모듈이 세지 않는다.
 */
import type { CommitteeMeeting, CommitteeMember, CommitteeRole } from './labTypes.ts';
import { addDays, daysInMonth, formatYmd, parseYmd } from './labDate.ts';

export const COMMITTEE_ROLES: ReadonlyArray<{ value: CommitteeRole; label: string }> = [
  { value: 'CHAIR', label: '위원장' },
  { value: 'FACILITY_HEAD', label: '시설의 장' },
  { value: 'STAFF', label: '종사자 대표' },
  { value: 'USER', label: '이용자(거주자) 대표' },
  { value: 'GUARDIAN', label: '보호자 대표' },
  { value: 'EXPERT', label: '전문가' },
  { value: 'LOCAL', label: '후원자·지역주민' },
  { value: 'PUBLIC_OFFICIAL', label: '시·군·구 공무원' },
  { value: 'OTHER', label: '기타' },
];

export function committeeRoleLabel(role: string): string {
  return COMMITTEE_ROLES.find((r) => r.value === role)?.label ?? role;
}

export const COMMITTEE_MIN_MEMBERS = 5;
export const COMMITTEE_MAX_MEMBERS = 15;
/** 임기 3년 (시행규칙 제24조④) */
export const COMMITTEE_TERM_YEARS = 3;
/** 임기 만료 임박으로 알리는 일수 */
export const EXPIRING_SOON_DAYS = 60;
export const MAX_MEMBER_NAME = 50;
export const MAX_MEMBER_NOTE = 200;
export const MAX_MEETING_AGENDA = 2000;
export const MAX_MEETING_MINUTES = 5000;
export const MAX_MEETING_DECISIONS = 20;
export const MAX_MEETING_DECISION = 200;
export const MAX_MEETING_ATTENDEES = 30;

export type MemberTermLike = Pick<CommitteeMember, 'active' | 'termEnd'>;

export interface CommitteeStatus<T extends MemberTermLike = MemberTermLike> {
  /** 활동 중이고 임기가 끝나지 않은 위원 수 */
  active: number;
  /** 5명 이상 15명 이하 */
  sizeOk: boolean;
  /** 활동 중이고 오늘부터 60일 안에 임기가 끝나는 위원 */
  expiringSoon: T[];
  /** 활동 중으로 표시돼 있는데 임기가 이미 끝난 위원 */
  expired: T[];
}

/** 위원 명단 현황. 임기 마지막 날 당일까지는 임기 중이다 */
export function committeeStatus<T extends MemberTermLike>(members: readonly T[], today: string): CommitteeStatus<T> {
  const limit = addDays(today, EXPIRING_SOON_DAYS) ?? today;
  const marked = members.filter((m) => m.active);
  const expired = marked.filter((m) => m.termEnd < today);
  const running = marked.filter((m) => m.termEnd >= today);
  const expiringSoon = running.filter((m) => m.termEnd <= limit);
  return {
    active: running.length,
    sizeOk: running.length >= COMMITTEE_MIN_MEMBERS && running.length <= COMMITTEE_MAX_MEMBERS,
    expiringSoon,
    expired,
  };
}

/** 임기 시작일 + 3년 (2월 29일은 평년이면 2월 28일). 날짜가 올바르지 않으면 null */
export function termLimit(termStart: string): string | null {
  const p = parseYmd(termStart);
  if (!p) return null;
  const year = p.year + COMMITTEE_TERM_YEARS;
  return formatYmd(year, p.month, Math.min(p.day, daysInMonth(year, p.month)));
}

/** 임기 끝이 시작보다 뒤이고 시작 + 3년을 넘지 않는가 */
export function termWithinLimit(termStart: string, termEnd: string): boolean {
  const limit = termLimit(termStart);
  return limit !== null && parseYmd(termEnd) !== null && termEnd > termStart && termEnd <= limit;
}

/** 임기 시작일에서 3년 임기의 마지막 날(시작 + 3년 − 1일) */
export function suggestedTermEnd(termStart: string): string | null {
  const limit = termLimit(termStart);
  return limit === null ? null : addDays(limit, -1);
}

export type MeetingYearLike = Pick<CommitteeMeeting, 'heldOn' | 'kind'>;

export interface MeetingYearSummary {
  count: number;
  regular: number;
  special: number;
  lastHeldOn: string | null;
}

/** 그 해 회의 현황 */
export function meetingsInYear(meetings: readonly MeetingYearLike[], year: number): MeetingYearSummary {
  const prefix = `${year}-`;
  const inYear = meetings.filter((m) => typeof m.heldOn === 'string' && m.heldOn.startsWith(prefix));
  const dates = inYear.map((m) => m.heldOn).sort();
  return {
    count: inYear.length,
    regular: inYear.filter((m) => m.kind === 'REGULAR').length,
    special: inYear.filter((m) => m.kind === 'SPECIAL').length,
    lastHeldOn: dates.length > 0 ? dates[dates.length - 1] : null,
  };
}

/** 분기별 회의 수(1~4분기). 개최 주기는 법령에 숫자가 없어 기관 기준(분기 1회) 안내용이다 */
export function meetingsByQuarter(meetings: readonly Pick<CommitteeMeeting, 'heldOn'>[], year: number): [number, number, number, number] {
  const out: [number, number, number, number] = [0, 0, 0, 0];
  for (const m of meetings) {
    const p = parseYmd(m.heldOn);
    if (p && p.year === year) out[Math.floor((p.month - 1) / 3)] += 1;
  }
  return out;
}
