/** 직원 복지 화면 공용 — 분기 이름, 종류 선택지, 건별 인정·불인정 이유. */
import { WELFARE_KINDS, welfareEntryOk } from '@/lib/lab/welfareRules';
import type { StaffWelfare } from '@/lib/lab/labTypes';

export { wonText } from './BankReconFormat';

export const MAX_ITEM = 100;
export const MAX_NOTE = 200;
export const MAX_WELFARE_AMOUNT = 100_000_000;
export const MAX_FUND_AMOUNT = 1_000_000_000;

export const KIND_OPTIONS = WELFARE_KINDS.map((k) => ({
  value: k.key,
  label: k.recognized ? (k.check ? `${k.label} (인정 여부 대조 필요)` : k.label) : `${k.label} (불인정)`,
}));

/** '2026-Q3' → '2026년 3분기' */
export function quarterName(q: string): string {
  const m = /^(\d{4})-Q([1-4])$/.exec(q);
  return m ? `${m[1]}년 ${m[2]}분기` : q;
}

export function kindInfo(kind: string) {
  return WELFARE_KINDS.find((k) => k.key === kind) ?? null;
}

type EntryLike = Pick<StaffWelfare, 'kind' | 'signed' | 'recipientIsOwner' | 'evidenceLedgerId' | 'evidenceNote' | 'givenOn'>;

/** 분기 1회로 세어지지 않는 이유(세어지면 빈 목록) */
export function welfareReasons(e: EntryLike): string[] {
  if (welfareEntryOk(e)) return [];
  const out: string[] = [];
  const info = kindInfo(e.kind);
  if (!info) out.push('알 수 없는 종류입니다');
  else if (!info.recognized) out.push(`${info.label}은(는) 복지로 인정되지 않습니다`);
  if (!e.signed) out.push('수령인 서명이 없습니다');
  const hasEvidence = (typeof e.evidenceLedgerId === 'number' && e.evidenceLedgerId > 0) || (e.evidenceNote ?? '').trim() !== '';
  if (!hasEvidence) out.push('이체내역·영수증 증빙이 없습니다');
  if (e.recipientIsOwner) out.push('대표자 본인에게 준 것은 세지 않습니다');
  return out;
}
