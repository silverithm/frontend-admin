/** 운영위원회 입력 초안 — 위원·회의 두 가지. 저장 전에 막을 것과 서버 입력 모양으로의 변환을 모은다. */
import { isValidYmd } from '@/lib/lab/labDate';
import type { CommitteeMeeting, CommitteeMeetingInput, CommitteeMeetingKind, CommitteeMember, CommitteeMemberInput, CommitteeRole } from '@/lib/lab/labTypes';
import {
  MAX_MEETING_AGENDA,
  MAX_MEETING_ATTENDEES,
  MAX_MEETING_DECISION,
  MAX_MEETING_DECISIONS,
  MAX_MEETING_MINUTES,
  MAX_MEMBER_NAME,
  MAX_MEMBER_NOTE,
  suggestedTermEnd,
  termLimit,
  termWithinLimit,
} from '@/lib/lab/committeeRules';

// ---------- 위원 ----------

export interface MemberDraft {
  id: number | null;
  name: string;
  role: CommitteeRole;
  termStart: string;
  termEnd: string;
  active: boolean;
  note: string;
}

export function emptyMemberDraft(today: string): MemberDraft {
  return { id: null, name: '', role: 'STAFF', termStart: today, termEnd: suggestedTermEnd(today) ?? '', active: true, note: '' };
}

export const draftOfMember = (m: CommitteeMember): MemberDraft => ({ id: m.id, name: m.name, role: m.role, termStart: m.termStart, termEnd: m.termEnd, active: m.active, note: m.note ?? '' });

export const inputOfMember = (d: MemberDraft): CommitteeMemberInput => ({
  name: d.name.trim(),
  role: d.role,
  termStart: d.termStart,
  termEnd: d.termEnd,
  active: d.active,
  note: d.note.trim() === '' ? null : d.note.trim(),
});

export const memberFingerprint = (d: MemberDraft): string => JSON.stringify([d.id, d.name, d.role, d.termStart, d.termEnd, d.active, d.note]);

/** 임기가 3년을 넘으면 저장 전에 막는다(시행규칙 제24조④) */
export function memberBlockers(d: MemberDraft): string[] {
  const out: string[] = [];
  if (d.name.trim() === '') out.push('위원 이름을 적어 주세요');
  if (d.name.trim().length > MAX_MEMBER_NAME) out.push(`이름은 ${MAX_MEMBER_NAME}자 안에서 적어 주세요`);
  if (!isValidYmd(d.termStart)) out.push('임기 시작일을 골라 주세요');
  if (!isValidYmd(d.termEnd)) out.push('임기 끝일을 골라 주세요');
  if (isValidYmd(d.termStart) && isValidYmd(d.termEnd)) {
    if (d.termEnd <= d.termStart) out.push('임기 끝일은 시작일보다 뒤여야 합니다');
    else if (!termWithinLimit(d.termStart, d.termEnd)) out.push(`임기는 3년을 넘을 수 없습니다 — 시작일 ${d.termStart} 기준 ${termLimit(d.termStart) ?? ''} 이전으로 줄여 주세요`);
  }
  if (d.note.length > MAX_MEMBER_NOTE) out.push(`비고는 ${MAX_MEMBER_NOTE}자 안에서 적어 주세요`);
  return out;
}

// ---------- 회의 ----------

export interface DecisionRow {
  key: string;
  text: string;
}

export interface MeetingDraft {
  id: number | null;
  heldOn: string;
  kind: CommitteeMeetingKind;
  attendeeIds: number[];
  agenda: string;
  minutes: string;
  decisions: DecisionRow[];
  nextOn: string;
  writerName: string;
  aiAssisted: boolean;
}

let seq = 0;
export const newDecisionKey = (): string => {
  seq += 1;
  return `d${seq}`;
};

export const decisionRows = (texts: string[]): DecisionRow[] => texts.map((text) => ({ key: newDecisionKey(), text }));

export function emptyMeetingDraft(today: string, writerName: string): MeetingDraft {
  return { id: null, heldOn: today, kind: 'REGULAR', attendeeIds: [], agenda: '', minutes: '', decisions: [], nextOn: '', writerName, aiAssisted: false };
}

export const draftOfMeeting = (m: CommitteeMeeting): MeetingDraft => ({
  id: m.id,
  heldOn: m.heldOn,
  kind: m.kind,
  attendeeIds: [...m.attendeeIds],
  agenda: m.agenda,
  minutes: m.minutes,
  decisions: decisionRows(m.decisions),
  nextOn: m.nextOn ?? '',
  writerName: m.writerName,
  aiAssisted: m.aiAssisted,
});

export const inputOfMeeting = (d: MeetingDraft): CommitteeMeetingInput => ({
  heldOn: d.heldOn,
  kind: d.kind,
  attendeeIds: [...d.attendeeIds],
  agenda: d.agenda.trim(),
  minutes: d.minutes.trim(),
  decisions: d.decisions.map((r) => r.text.trim()).filter((t) => t !== ''),
  nextOn: d.nextOn === '' ? null : d.nextOn,
  writerName: d.writerName.trim(),
  aiAssisted: d.aiAssisted,
});

export const meetingFingerprint = (d: MeetingDraft): string =>
  JSON.stringify([d.id, d.heldOn, d.kind, [...d.attendeeIds].sort(), d.agenda, d.minutes, d.decisions.map((r) => r.text), d.nextOn, d.writerName, d.aiAssisted]);

export function meetingBlockers(d: MeetingDraft): string[] {
  const out: string[] = [];
  if (!isValidYmd(d.heldOn)) out.push('회의 날짜를 골라 주세요');
  if (d.agenda.trim() === '') out.push('안건을 적어 주세요');
  if (d.agenda.length > MAX_MEETING_AGENDA) out.push(`안건은 ${MAX_MEETING_AGENDA}자 안에서 적어 주세요`);
  if (d.minutes.length > MAX_MEETING_MINUTES) out.push(`회의록은 ${MAX_MEETING_MINUTES}자 안에서 적어 주세요`);
  const decisions = d.decisions.map((r) => r.text.trim()).filter((t) => t !== '');
  if (decisions.length > MAX_MEETING_DECISIONS) out.push(`결정 사항은 ${MAX_MEETING_DECISIONS}개까지 적을 수 있습니다`);
  if (decisions.some((t) => t.length > MAX_MEETING_DECISION)) out.push(`결정 사항은 한 줄에 ${MAX_MEETING_DECISION}자 안에서 적어 주세요`);
  if (d.attendeeIds.length > MAX_MEETING_ATTENDEES) out.push(`참석 위원은 ${MAX_MEETING_ATTENDEES}명까지 고를 수 있습니다`);
  if (d.nextOn !== '' && isValidYmd(d.heldOn) && d.nextOn <= d.heldOn) out.push('다음 회의일은 이번 회의일보다 뒤여야 합니다');
  if (d.writerName.trim() === '') out.push('작성자 이름을 적어 주세요');
  return out;
}
