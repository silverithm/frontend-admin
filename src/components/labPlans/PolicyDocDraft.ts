/** 규정·지침 입력 초안 — 화면 상태, 서버 입력 모양, 저장 전에 막을 것. */
import { isValidYmd } from '@/lib/lab/labDate';
import type { PolicyDoc, PolicyDocInput, PolicyDocKind } from '@/lib/lab/labTypes';
import { kindName } from './PolicyDocKinds';

export const MAX_TITLE = 100;
export const MAX_LOCATION = 100;
export const MAX_NOTE = 300;

export interface PolicyDraft {
  id: number | null;
  kind: PolicyDocKind;
  guideNo: number | null;
  title: string;
  revisedOn: string;
  location: string;
  trainedOn: string;
  note: string;
  checks: Record<string, boolean>;
  /** AI 제안으로 체크한 항목 키(사람이 바꾸면 사라진다) */
  ai: Record<string, true>;
}

export function emptyPolicyDraft(kind: PolicyDocKind, guideNo: number | null): PolicyDraft {
  return { id: null, kind, guideNo, title: kind === 'OTHER' ? '' : kindName(kind, guideNo), revisedOn: '', location: '', trainedOn: '', note: '', checks: {}, ai: {} };
}

export const draftOfPolicy = (d: PolicyDoc): PolicyDraft => ({
  id: d.id,
  kind: d.kind,
  guideNo: d.guideNo,
  title: d.title,
  revisedOn: d.revisedOn ?? '',
  location: d.location ?? '',
  trainedOn: d.trainedOn ?? '',
  note: d.note ?? '',
  checks: { ...d.checks },
  ai: {},
});

const orNull = (s: string): string | null => (s.trim() === '' ? null : s.trim());

export const inputOfPolicy = (d: PolicyDraft): PolicyDocInput => ({
  kind: d.kind,
  guideNo: d.kind === 'CARE_GUIDE' ? d.guideNo : null,
  title: d.title.trim(),
  revisedOn: d.revisedOn === '' ? null : d.revisedOn,
  location: orNull(d.location),
  checks: { ...d.checks },
  trainedOn: d.trainedOn === '' ? null : d.trainedOn,
  note: orNull(d.note),
});

export const policyFingerprint = (d: PolicyDraft): string =>
  JSON.stringify([d.id, d.kind, d.guideNo, d.title, d.revisedOn, d.location, d.trainedOn, d.note, Object.entries(d.checks).sort(([a], [b]) => (a < b ? -1 : 1))]);

export function policyBlockers(d: PolicyDraft, today: string, duplicate: boolean): string[] {
  const out: string[] = [];
  if (d.title.trim() === '') out.push('문서 제목을 적어 주세요');
  if (d.title.length > MAX_TITLE) out.push(`제목은 ${MAX_TITLE}자 안에서 적어 주세요`);
  if (d.kind === 'CARE_GUIDE' && d.guideNo === null) out.push('급여제공지침 번호를 골라 주세요');
  if (duplicate) out.push('같은 종류의 문서가 이미 있습니다. 목록에서 그 문서를 열어 고쳐 주세요');
  if (d.revisedOn !== '' && (!isValidYmd(d.revisedOn) || d.revisedOn > today)) out.push('개정일은 오늘보다 뒤일 수 없습니다');
  if (d.trainedOn !== '' && (!isValidYmd(d.trainedOn) || d.trainedOn > today)) out.push('교육일은 오늘보다 뒤일 수 없습니다');
  if (d.location.length > MAX_LOCATION) out.push(`비치 장소는 ${MAX_LOCATION}자 안에서 적어 주세요`);
  if (d.note.length > MAX_NOTE) out.push(`메모는 ${MAX_NOTE}자 안에서 적어 주세요`);
  return out;
}
