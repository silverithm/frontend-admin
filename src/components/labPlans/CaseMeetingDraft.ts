/** 사례관리 회의 입력 초안 — 화면 상태, 서버 입력 모양으로의 변환, 저장 전에 막을 것, AI 제안 합치기. */
import { mergeAiSuggestions } from '@/components/labRecords/recordsFormat';
import { isValidYmd } from '@/lib/lab/labDate';
import type { CaseFollowTarget, MeetingRecordShape } from '@/lib/lab/caseMeetingRules';
import type { CaseMeeting, CaseMeetingInput, CaseReflectMethod, CaseTargetInput } from '@/lib/lab/labTypes';

export const MAX_REASON = 300;
export const MAX_PLAN = 500;
export const MAX_OPINION = 300;
export const MAX_MINUTES = 3000;
export const MAX_NOTE = 300;
export const MAX_NAME = 50;
export const MAX_TARGETS = 10;
export const MAX_ATTENDEES = 30;

export const REFLECT_METHODS: ReadonlyArray<{ value: CaseReflectMethod; label: string }> = [
  { value: 'CARE_PLAN', label: '급여제공계획 변경' },
  { value: 'CARE_RECORD', label: '급여제공기록지' },
  { value: 'RESOURCE', label: '지역사회자원 선정 결과' },
  { value: 'INTERNAL', label: '기관 내부 문서·내용' },
];

export interface OpinionDraft {
  text: string;
  /** '의견 없음'으로 기록 */
  none: boolean;
}

export interface TargetDraft {
  key: string;
  elderlyId: number | null;
  elderlyName: string;
  reason: string;
  plan: string;
  ownerMemberId: number | null;
  reflectedOn: string;
  reflectMethod: CaseReflectMethod | '';
  reflectNote: string;
  evaluatedOn: string;
  evaluatorName: string;
  resolved: '' | 'YES' | 'NO';
  nextAction: string;
}

export interface MeetingDraft {
  id: number | null;
  heldOn: string;
  attendeeIds: number[];
  /** 저장된 회의의 참석자 이름 — 지금 직원 목록에 없는 사람도 이름을 보이려고 */
  names: Record<number, string>;
  opinions: Record<number, OpinionDraft>;
  targets: TargetDraft[];
  minutes: string;
  aiAssisted: boolean;
  /** AI 제안이 들어 있는 칸: 'reason'·'plan'(첫 대상), 'minutes', 'op:<직원 id>' */
  ai: Record<string, true>;
}

let seq = 0;
export const newTargetKey = (): string => {
  seq += 1;
  return `t${seq}`;
};

export function emptyTarget(): TargetDraft {
  return { key: newTargetKey(), elderlyId: null, elderlyName: '', reason: '', plan: '', ownerMemberId: null, reflectedOn: '', reflectMethod: '', reflectNote: '', evaluatedOn: '', evaluatorName: '', resolved: '', nextAction: '' };
}

export function emptyMeetingDraft(today: string): MeetingDraft {
  return { id: null, heldOn: today, attendeeIds: [], names: {}, opinions: {}, targets: [emptyTarget()], minutes: '', aiAssisted: false, ai: {} };
}

export function draftOfMeeting(m: CaseMeeting): MeetingDraft {
  const opinions: Record<number, OpinionDraft> = {};
  for (const o of m.opinions) opinions[o.memberId] = o.opinion === null ? { text: '', none: true } : { text: o.opinion, none: false };
  const names: Record<number, string> = {};
  for (const a of m.attendees) names[a.memberId] = a.memberName;
  return {
    id: m.id,
    heldOn: m.heldOn,
    attendeeIds: m.attendees.map((a) => a.memberId),
    names,
    opinions,
    targets: m.targets.map((t) => ({
      key: newTargetKey(),
      elderlyId: t.elderlyId,
      elderlyName: t.elderlyName,
      reason: t.reason,
      plan: t.plan,
      ownerMemberId: t.ownerMemberId,
      reflectedOn: t.reflectedOn ?? '',
      reflectMethod: t.reflectMethod ?? '',
      reflectNote: t.reflectNote ?? '',
      evaluatedOn: t.evaluatedOn ?? '',
      evaluatorName: t.evaluatorName ?? '',
      resolved: t.resolved === null ? '' : t.resolved ? 'YES' : 'NO',
      nextAction: t.nextAction ?? '',
    })),
    minutes: m.minutes ?? '',
    aiAssisted: m.aiAssisted,
    ai: {},
  };
}

const orNull = (s: string): string | null => (s.trim() === '' ? null : s.trim());

/** 참석자마다 적힌 의견 칸 — 글이 있으면 글, '의견 없음'이면 null, 아무것도 없으면 칸 없음 */
function opinionList(d: MeetingDraft): Array<{ memberId: number; opinion: string | null }> {
  const out: Array<{ memberId: number; opinion: string | null }> = [];
  for (const id of d.attendeeIds) {
    const o = d.opinions[id];
    if (!o) continue;
    if (o.none) out.push({ memberId: id, opinion: null });
    else if (o.text.trim() !== '') out.push({ memberId: id, opinion: o.text.trim() });
  }
  return out;
}

/** meetingRecordCheck가 읽는 모양 */
export function recordShapeOf(d: MeetingDraft): MeetingRecordShape {
  return { attendees: d.attendeeIds.map((memberId) => ({ memberId })), opinions: opinionList(d), targets: d.targets.map((t) => ({ reason: t.reason, plan: t.plan })) };
}

export function followTargetOf(t: TargetDraft): CaseFollowTarget {
  return {
    reflectedOn: t.reflectedOn === '' ? null : t.reflectedOn,
    evaluatedOn: t.evaluatedOn === '' ? null : t.evaluatedOn,
    evaluatorName: t.evaluatorName,
    resolved: t.resolved === '' ? null : t.resolved === 'YES',
    nextAction: t.nextAction,
  };
}

export function inputOfMeeting(d: MeetingDraft): CaseMeetingInput {
  const targets: CaseTargetInput[] = d.targets.map((t) => ({
    elderlyId: t.elderlyId ?? 0,
    reason: t.reason.trim(),
    plan: t.plan.trim(),
    ownerMemberId: t.ownerMemberId,
    reflectedOn: t.reflectedOn === '' ? null : t.reflectedOn,
    reflectMethod: t.reflectMethod === '' ? null : t.reflectMethod,
    reflectNote: orNull(t.reflectNote),
    evaluatedOn: t.evaluatedOn === '' ? null : t.evaluatedOn,
    evaluatorName: orNull(t.evaluatorName),
    resolved: t.resolved === '' ? null : t.resolved === 'YES',
    nextAction: t.resolved === 'NO' ? orNull(t.nextAction) : null,
  }));
  return { heldOn: d.heldOn, attendeeIds: [...new Set(d.attendeeIds)], opinions: opinionList(d), targets, minutes: orNull(d.minutes), aiAssisted: d.aiAssisted };
}

export const meetingFingerprint = (d: MeetingDraft): string => JSON.stringify([d.id, d.heldOn, [...d.attendeeIds].sort(), d.attendeeIds.map((id) => d.opinions[id] ?? null), d.targets.map((t) => [t.elderlyId, t.reason, t.plan, t.ownerMemberId, t.reflectedOn, t.reflectMethod, t.reflectNote, t.evaluatedOn, t.evaluatorName, t.resolved, t.nextAction]), d.minutes, d.aiAssisted]);

/** 저장 전에 막을 것 — 서버가 400으로 돌려주는 값을 미리 알려 준다 */
export function meetingBlockers(d: MeetingDraft, today: string): string[] {
  const out: string[] = [];
  if (!isValidYmd(d.heldOn)) out.push('회의 날짜를 골라 주세요');
  else if (d.heldOn > today) out.push('회의 날짜는 오늘보다 뒤일 수 없습니다');
  if (d.attendeeIds.length === 0) out.push('참석자를 한 명 이상 골라 주세요');
  if (d.attendeeIds.length > MAX_ATTENDEES) out.push(`참석자는 ${MAX_ATTENDEES}명까지 고를 수 있습니다`);
  if (d.targets.length === 0) out.push('대상 어르신을 한 명 이상 넣어 주세요');
  if (d.targets.length > MAX_TARGETS) out.push(`대상 어르신은 ${MAX_TARGETS}명까지 넣을 수 있습니다`);
  if (d.minutes.length > MAX_MINUTES) out.push(`회의록은 ${MAX_MINUTES}자 안에서 적어 주세요`);
  for (const id of d.attendeeIds) {
    const o = d.opinions[id];
    if (o && o.text.length > MAX_OPINION) out.push(`참석자 의견은 ${MAX_OPINION}자 안에서 적어 주세요`);
  }
  const seen = new Set<number>();
  d.targets.forEach((t, i) => {
    const n = `대상 ${i + 1}`;
    if (t.elderlyId === null) out.push(`${n}: 어르신을 골라 주세요`);
    else if (seen.has(t.elderlyId)) out.push(`${n}: 같은 어르신을 두 번 넣을 수 없습니다`);
    else seen.add(t.elderlyId);
    if (t.reason.trim() === '') out.push(`${n}: 선정 사유를 적어 주세요`);
    if (t.plan.trim() === '') out.push(`${n}: 사례관리 계획을 적어 주세요`);
    if (t.reason.length > MAX_REASON) out.push(`${n}: 선정 사유는 ${MAX_REASON}자 안에서 적어 주세요`);
    if (t.plan.length > MAX_PLAN) out.push(`${n}: 사례관리 계획은 ${MAX_PLAN}자 안에서 적어 주세요`);
    if (t.reflectedOn !== '') {
      if (isValidYmd(d.heldOn) && t.reflectedOn < d.heldOn) out.push(`${n}: 반영일은 회의일 이후여야 합니다`);
      if (t.reflectedOn > today) out.push(`${n}: 반영일은 오늘보다 뒤일 수 없습니다`);
      if (t.reflectMethod === '') out.push(`${n}: 반영 방식을 골라 주세요`);
    }
    if (t.reflectNote.length > MAX_NOTE) out.push(`${n}: 반영 내용은 ${MAX_NOTE}자 안에서 적어 주세요`);
    if (t.evaluatedOn !== '') {
      if (t.reflectedOn === '') out.push(`${n}: 반영일을 먼저 적어야 평가를 기록할 수 있습니다`);
      else if (t.evaluatedOn < t.reflectedOn) out.push(`${n}: 평가일은 반영일 이후여야 합니다`);
      if (t.evaluatedOn > today) out.push(`${n}: 평가일은 오늘보다 뒤일 수 없습니다`);
      if (t.evaluatorName.trim() === '') out.push(`${n}: 평가 작성자를 적어 주세요`);
      if (t.resolved === '') out.push(`${n}: 선정 사유가 해결됐는지 골라 주세요`);
    }
    if (t.evaluatorName.length > MAX_NAME) out.push(`${n}: 작성자 이름은 ${MAX_NAME}자 안에서 적어 주세요`);
    if (t.evaluatedOn !== '' && t.resolved === 'NO' && t.nextAction.trim() === '') out.push(`${n}: 해결되지 않았다면 추가 조치 계획을 적어 주세요`);
    if (t.nextAction.length > MAX_NOTE) out.push(`${n}: 추가 조치는 ${MAX_NOTE}자 안에서 적어 주세요`);
  });
  return out;
}

const AI_LIMITS: Record<string, number> = { reason: MAX_REASON, plan: MAX_PLAN, minutes: MAX_MINUTES };

/**
 * AI 제안을 칸에 합친다. 비었거나 이전 AI 제안인 칸만 채우고 직접 쓴 칸은 덮어쓰지 않는다.
 * suggestions 키: 'reason'·'plan'(첫 대상), 'minutes', 'op:<직원 id>'. 합쳐진 칸 이름(filled)과 직접 쓴 칸이라 그대로 둔 수(kept)를 함께 낸다.
 */
export function mergeCaseAi(d: MeetingDraft, suggestions: Record<string, string | null | undefined>): { next: MeetingDraft; filled: string[]; kept: number } {
  const first = d.targets[0];
  const current: Record<string, string> = { reason: first?.reason ?? '', plan: first?.plan ?? '', minutes: d.minutes };
  const limits: Record<string, number> = { ...AI_LIMITS };
  const usable: Record<string, string | null | undefined> = {};
  for (const [key, value] of Object.entries(suggestions)) {
    if (key === 'reason' || key === 'plan') {
      if (!first) continue;
    } else if (key.startsWith('op:')) {
      const id = Number(key.slice(3));
      if (!d.attendeeIds.includes(id)) continue;
      current[key] = d.opinions[id]?.text ?? '';
      limits[key] = MAX_OPINION;
    }
    usable[key] = value;
  }
  const marks: Partial<Record<string, true>> = { ...d.ai };
  const merged = mergeAiSuggestions<string>(current, marks, usable, Object.fromEntries(Object.keys(usable).map((k) => [k, limits[k] ?? MAX_NOTE])));
  const filled: string[] = [];
  const next: MeetingDraft = { ...d, opinions: { ...d.opinions }, ai: { ...d.ai } };
  for (const key of Object.keys(usable)) {
    if (merged.fields[key] === current[key]) continue;
    if (key === 'reason' || key === 'plan') next.targets = next.targets.map((t, i) => (i === 0 ? { ...t, [key]: merged.fields[key] } : t));
    else if (key === 'minutes') next.minutes = merged.fields[key];
    else next.opinions[Number(key.slice(3))] = { text: merged.fields[key], none: false };
    next.ai[key] = true;
    filled.push(key);
  }
  if (filled.length > 0) next.aiAssisted = true;
  return { next, filled, kept: merged.kept };
}
