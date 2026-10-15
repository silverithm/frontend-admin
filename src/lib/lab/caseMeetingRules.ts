/**
 * 사례관리 회의 규칙 — 참석 직종·회의 기록 칸·반영/평가 기한·반기 판정·기한 알림. 전부 브라우저 안에서 도는 순수 함수다.
 *
 * 근거(research-10, 2026 사례관리 두 기준): 반기마다 1회 이상, 필수 칸(대상·선정 사유·직원별 의견·계획)을 갖추고,
 * 3인 이상이 시설장과 직종별(사회복지사·간호(조무)사 또는 물리(작업)치료사·요양보호사)로 참석한다. 회의 다음날부터 30일 안에 반영하고,
 * 반영일부터 30일 안에 평가하며 미해결이면 추가 조치 계획이 있어야 한다.
 * 확인 못 한 것(대조 필요): 반영 기한 30일의 산정 시작일(회의일 다음날), 대상 선정 인원 하한, 수급자·기관 단위 판정.
 */
import { addDays, daysBetween, isValidYmd } from './labDate.ts';
import type { CaseAttendee, CaseOpinion, CaseTarget } from './labTypes.ts';

export type CaseGroup = 'DIRECTOR' | 'SOCIAL_WORKER' | 'NURSING' | 'CAREGIVER';
/** 필수 직종 묶음의 표시 순서 */
export const CASE_GROUPS: readonly CaseGroup[] = ['DIRECTOR', 'SOCIAL_WORKER', 'NURSING', 'CAREGIVER'];

export const CASE_GROUP_LABEL: Readonly<Record<CaseGroup, string>> = {
  DIRECTOR: '시설장',
  SOCIAL_WORKER: '사회복지사',
  NURSING: '간호(조무)사 또는 물리(작업)치료사',
  CAREGIVER: '요양보호사',
};

/** 사례관리 회의에 참석해야 하는 직종 묶음의 최소 인원 */
export const CASE_MIN_ATTENDEES = 3;
/** 반영·평가 기한(일) */
export const CASE_FOLLOW_UP_DAYS = 30;

export interface CaseStaffProfile {
  memberId: number;
  jobType: string;
  hireDate: string;
}

/** 직종 → 묶음. 조리원·운전원·사무원 등은 필수 직종이 아니라 null */
export function caseGroupOf(jobType: string): CaseGroup | null {
  if (jobType === 'DIRECTOR') return 'DIRECTOR';
  if (jobType === 'SOCIAL_WORKER') return 'SOCIAL_WORKER';
  if (jobType === 'NURSE' || jobType === 'NURSE_AIDE' || jobType === 'THERAPIST') return 'NURSING';
  if (jobType === 'CAREGIVER') return 'CAREGIVER';
  return null;
}

export interface AttendeeCheck {
  count: number;
  /** CASE_GROUPS 순서로 빠진 묶음 */
  missing: CaseGroup[];
  /** 직원 인사 기준이 없는 참석자 수 */
  unknown: number;
  ok: boolean;
}

/**
 * 참석자 점검. 필수 묶음 = 시설장(항상) + 회의일에 재직 중(hireDate ≤ heldOn)인 직원들의 묶음 —
 * 사회복지사나 치료사가 아직 없는 기관에 없는 직종을 요구하지 않는다. 같은 직원이 두 번 들어 있어도 한 명으로 센다.
 */
export function attendeeCheck(attendeeIds: readonly number[], profiles: readonly CaseStaffProfile[], heldOn: string): AttendeeCheck {
  const ids = [...new Set(attendeeIds)];
  const byMember = new Map(profiles.map((p) => [p.memberId, p]));
  const required = new Set<CaseGroup>(['DIRECTOR']);
  for (const p of profiles) {
    if (isValidYmd(p.hireDate) && isValidYmd(heldOn) && p.hireDate.slice(0, 10) <= heldOn.slice(0, 10)) {
      const g = caseGroupOf(p.jobType);
      if (g) required.add(g);
    }
  }
  const present = new Set<CaseGroup>();
  let unknown = 0;
  for (const id of ids) {
    const p = byMember.get(id);
    if (!p) {
      unknown += 1;
      continue;
    }
    const g = caseGroupOf(p.jobType);
    if (g) present.add(g);
  }
  const missing = CASE_GROUPS.filter((g) => required.has(g) && !present.has(g));
  return { count: ids.length, missing, unknown, ok: ids.length >= CASE_MIN_ATTENDEES && missing.length === 0 };
}

export interface MeetingRecordShape {
  attendees: ReadonlyArray<Pick<CaseAttendee, 'memberId'>>;
  opinions: ReadonlyArray<Pick<CaseOpinion, 'memberId' | 'opinion'>>;
  targets: ReadonlyArray<Pick<CaseTarget, 'reason' | 'plan'>>;
}

export interface MeetingRecordCheck {
  /** 의견 칸이 없는 참석자 id — opinion이 null이면 '의견 없음'으로 기록된 것이라 빠진 게 아니다 */
  opinionsMissing: number[];
  /** 선정 사유·계획이 빈 대상 수 */
  targetsIncomplete: number;
  ok: boolean;
}

const blank = (value: string | null | undefined): boolean => typeof value !== 'string' || value.trim() === '';

export function meetingRecordCheck(meeting: MeetingRecordShape): MeetingRecordCheck {
  // 의견 칸이 있고 (null = 의견 없음) 이거나 글이 있어야 한다. 빈 글자("")만 있는 칸은 빠진 것으로 본다.
  const filled = new Set<number>();
  for (const o of meeting.opinions) if (o.opinion === null || !blank(o.opinion)) filled.add(o.memberId);
  const opinionsMissing = [...new Set(meeting.attendees.map((a) => a.memberId))].filter((id) => !filled.has(id));
  const targetsIncomplete = meeting.targets.filter((t) => blank(t.reason) || blank(t.plan)).length;
  return { opinionsMissing, targetsIncomplete, ok: opinionsMissing.length === 0 && targetsIncomplete === 0 };
}

export type ReflectState = 'DONE' | 'LATE' | 'PENDING' | 'OVERDUE';
export type EvalState = 'WAITING' | 'PENDING' | 'OVERDUE' | 'LATE' | 'INCOMPLETE' | 'DONE';

export interface FollowUp {
  reflectDue: string;
  reflectState: ReflectState;
  evalDue: string | null;
  evalState: EvalState;
}

export type CaseFollowTarget = Pick<CaseTarget, 'reflectedOn' | 'evaluatedOn' | 'evaluatorName' | 'resolved' | 'nextAction'>;

/**
 * 반영·평가 기한 판정. 기한은 회의일 + 30일(반영), 반영일 + 30일(평가) — 당일이 마지막 날이다.
 * 회의일보다 앞선 반영일은 인정하지 않고 미반영으로 본다(서버가 막는 값이라 오류 데이터).
 */
export function targetFollowUp(heldOn: string, target: CaseFollowTarget, asOfInput: string): FollowUp {
  const asOf = asOfInput.slice(0, 10);
  const reflectDue = addDays(heldOn, CASE_FOLLOW_UP_DAYS) ?? heldOn;
  const reflectedOn = target.reflectedOn && isValidYmd(target.reflectedOn) && target.reflectedOn.slice(0, 10) >= heldOn.slice(0, 10) ? target.reflectedOn.slice(0, 10) : null;

  let reflectState: ReflectState;
  if (reflectedOn) reflectState = reflectedOn <= reflectDue ? 'DONE' : 'LATE';
  else reflectState = asOf <= reflectDue ? 'PENDING' : 'OVERDUE';

  if (!reflectedOn) return { reflectDue, reflectState, evalDue: null, evalState: 'WAITING' };
  const evalDue = addDays(reflectedOn, CASE_FOLLOW_UP_DAYS);
  if (evalDue === null) return { reflectDue, reflectState, evalDue: null, evalState: 'WAITING' };

  const evaluatedOn = target.evaluatedOn && isValidYmd(target.evaluatedOn) ? target.evaluatedOn.slice(0, 10) : null;
  let evalState: EvalState;
  if (!evaluatedOn) evalState = asOf <= evalDue ? 'PENDING' : 'OVERDUE';
  else if (evaluatedOn > evalDue) evalState = 'LATE';
  else if (blank(target.evaluatorName) || target.resolved === null || target.resolved === undefined || (target.resolved === false && blank(target.nextAction))) evalState = 'INCOMPLETE';
  else evalState = 'DONE';
  return { reflectDue, reflectState, evalDue, evalState };
}

export interface CaseMeetingShape extends MeetingRecordShape {
  id: number;
  heldOn: string;
  targets: ReadonlyArray<Pick<CaseTarget, 'elderlyId' | 'reason' | 'plan'> & CaseFollowTarget>;
}

export interface HalfYearStatus {
  count: number;
  okCount: number;
  /** 기준①: 필수 칸·참석 직종을 갖춘 회의가 반기에 1건 이상 */
  c1: boolean;
  /** 기준②: 갖춘 회의 대상의 반영·평가 */
  c2: 'NA' | 'NOT_MET' | 'MET' | 'IN_PROGRESS';
}

/** half 1 = 1~6월, 2 = 7~12월 */
export function halfYearStatus(meetings: readonly CaseMeetingShape[], profiles: readonly CaseStaffProfile[], year: number, half: 1 | 2, asOf: string): HalfYearStatus {
  const from = `${String(year).padStart(4, '0')}-${half === 1 ? '01-01' : '07-01'}`;
  const to = `${String(year).padStart(4, '0')}-${half === 1 ? '06-30' : '12-31'}`;
  const inHalf = meetings.filter((m) => isValidYmd(m.heldOn) && m.heldOn.slice(0, 10) >= from && m.heldOn.slice(0, 10) <= to);
  const complete = inHalf.filter((m) => attendeeCheck(m.attendees.map((a) => a.memberId), profiles, m.heldOn).ok && meetingRecordCheck(m).ok);

  let targets = 0;
  let bad = false;
  let allDone = true;
  for (const m of complete) {
    for (const t of m.targets) {
      targets += 1;
      const f = targetFollowUp(m.heldOn, t, asOf);
      if (f.reflectState === 'LATE' || f.reflectState === 'OVERDUE' || f.evalState === 'LATE' || f.evalState === 'OVERDUE' || f.evalState === 'INCOMPLETE') bad = true;
      if (f.reflectState !== 'DONE' || f.evalState !== 'DONE') allDone = false;
    }
  }
  const c2 = targets === 0 ? 'NA' : bad ? 'NOT_MET' : allDone ? 'MET' : 'IN_PROGRESS';
  return { count: inHalf.length, okCount: complete.length, c1: complete.length >= 1, c2 };
}

export interface FollowUpAlert {
  meetingId: number;
  elderlyId: number;
  kind: 'REFLECT' | 'EVAL';
  dueOn: string;
  /** asOf부터 기한까지 남은 일수. 지났으면 음수 */
  daysLeft: number;
}

/** 아직 못 한 반영·평가 중 기한이 leadDays일 안으로 다가왔거나 이미 지난 것. 기한이 이른 순. */
export function followUpAlerts(meetings: ReadonlyArray<CaseMeetingShape & { id: number }>, asOf: string, leadDays = 5): FollowUpAlert[] {
  const out: FollowUpAlert[] = [];
  for (const m of meetings) {
    for (const t of m.targets) {
      const f = targetFollowUp(m.heldOn, t, asOf);
      const push = (kind: 'REFLECT' | 'EVAL', dueOn: string | null, state: ReflectState | EvalState) => {
        if (dueOn === null || (state !== 'PENDING' && state !== 'OVERDUE')) return;
        const daysLeft = daysBetween(asOf, dueOn);
        if (daysLeft === null) return;
        if (state === 'OVERDUE' || daysLeft <= leadDays) out.push({ meetingId: m.id, elderlyId: t.elderlyId, kind, dueOn, daysLeft });
      };
      push('REFLECT', f.reflectDue, f.reflectState);
      push('EVAL', f.evalDue, f.evalState);
    }
  }
  return out.sort((a, b) => (a.dueOn < b.dueOn ? -1 : a.dueOn > b.dueOn ? 1 : a.meetingId - b.meetingId || a.elderlyId - b.elderlyId));
}
