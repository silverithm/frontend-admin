/** 수급자 서류 한 건 편집 칸 모양과 점검, 만료 임박 판단 — 화면과 따로 둔다. */
import { daysBetween, isValidYmd } from '@/lib/lab/labDate';
import type { ElderDocType, ElderDocument, ElderDocumentInput } from '@/lib/lab/labTypes';
import { MAX_DOC_LOCATION, MAX_DOC_NOTE, MAX_DOC_TITLE, elderDocTypeLabel, isDocExpired } from '@/lib/lab/elderDocRules';
import { orNull } from './recordsFormat';

export const DOC_LIMITS = { title: MAX_DOC_TITLE, location: MAX_DOC_LOCATION, note: MAX_DOC_NOTE } as const;

/** 만료가 이 일수 안으로 다가오면 "곧 만료"로 강조한다 */
export const SOON_DAYS = 30;

export interface DocDraft {
  docType: ElderDocType;
  title: string;
  issuedOn: string;
  expiresOn: string;
  location: string;
  checkedOn: string;
  note: string;
}

export function newDocDraft(docType: ElderDocType): DocDraft {
  return { docType, title: elderDocTypeLabel(docType), issuedOn: '', expiresOn: '', location: '', checkedOn: '', note: '' };
}

export function draftFromDoc(d: ElderDocument): DocDraft {
  return {
    docType: d.docType,
    title: d.title,
    issuedOn: d.issuedOn ?? '',
    expiresOn: d.expiresOn ?? '',
    location: d.location ?? '',
    checkedOn: d.checkedOn ?? '',
    note: d.note ?? '',
  };
}

export function docInput(elderlyId: number, d: DocDraft): ElderDocumentInput {
  return {
    elderlyId,
    docType: d.docType,
    title: d.title.trim(),
    issuedOn: orNull(d.issuedOn),
    expiresOn: orNull(d.expiresOn),
    location: orNull(d.location),
    checkedOn: orNull(d.checkedOn),
    note: orNull(d.note),
  };
}

export function docProblems(d: DocDraft): string[] {
  const out: string[] = [];
  if (d.title.trim() === '') out.push('서류 제목을 적어 주세요');
  if (d.issuedOn !== '' && d.expiresOn !== '' && d.expiresOn < d.issuedOn) out.push('만료일은 발급일보다 앞설 수 없습니다');
  return out;
}

export type ExpiryState = { kind: 'EXPIRED'; days: number } | { kind: 'SOON'; days: number } | null;

/** 만료일이 지났으면 EXPIRED(며칠 지났는지), 30일 안이면 SOON(며칠 남았는지) */
export function expiryState(expiresOn: string | null | undefined, today: string): ExpiryState {
  if (!isValidYmd(expiresOn)) return null;
  if (isDocExpired(expiresOn, today)) return { kind: 'EXPIRED', days: daysBetween(expiresOn, today) ?? 0 };
  const left = daysBetween(today, expiresOn);
  return left !== null && left <= SOON_DAYS ? { kind: 'SOON', days: left } : null;
}

export function expiryText(state: ExpiryState): string {
  if (!state) return '';
  if (state.kind === 'EXPIRED') return `만료 ${state.days}일 지남`;
  return state.days === 0 ? '오늘 만료' : `${state.days}일 뒤 만료`;
}
