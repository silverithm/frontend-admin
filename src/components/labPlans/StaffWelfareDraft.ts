/** 복지 제공 한 건·가산금 한 건의 입력 상태와 저장 전 확인. */
import { isValidYmd } from '@/lib/lab/labDate';
import { orNull } from '@/components/labRecords/recordsFormat';
import type { BonusFund, BonusFundInput, BonusFundKind, StaffWelfare, StaffWelfareInput, WelfareKind } from '@/lib/lab/labTypes';
import { MAX_FUND_AMOUNT, MAX_ITEM, MAX_WELFARE_AMOUNT } from './StaffWelfareFormat';

export interface EntryDraft {
  id: number | null;
  givenOn: string;
  memberId: string;
  kind: string;
  item: string;
  amount: number | null;
  signed: boolean;
  recipientIsOwner: boolean;
  evidenceLedgerId: number | null;
  evidenceNote: string;
  note: string;
}

export const emptyEntry = (): EntryDraft => ({ id: null, givenOn: '', memberId: '', kind: '', item: '', amount: null, signed: false, recipientIsOwner: false, evidenceLedgerId: null, evidenceNote: '', note: '' });

export const entryToDraft = (e: StaffWelfare): EntryDraft => ({
  id: e.id,
  givenOn: e.givenOn,
  memberId: String(e.memberId),
  kind: e.kind,
  item: e.item,
  amount: e.amount,
  signed: e.signed,
  recipientIsOwner: e.recipientIsOwner,
  evidenceLedgerId: e.evidenceLedgerId,
  evidenceNote: e.evidenceNote ?? '',
  note: e.note ?? '',
});

export function entryInput(d: EntryDraft): StaffWelfareInput {
  return {
    givenOn: d.givenOn,
    memberId: Number(d.memberId),
    kind: d.kind as WelfareKind,
    item: d.item.trim(),
    amount: d.amount ?? 0,
    signed: d.signed,
    recipientIsOwner: d.recipientIsOwner,
    evidenceLedgerId: d.evidenceLedgerId,
    evidenceNote: orNull(d.evidenceNote),
    note: orNull(d.note),
  };
}

/** 저장을 막는 빠진 칸 */
export function entryBlockers(d: EntryDraft, today: string): string[] {
  const out: string[] = [];
  if (!isValidYmd(d.givenOn)) out.push('제공일을 골라 주세요');
  else if (d.givenOn > today) out.push('제공일은 오늘보다 뒤일 수 없습니다');
  if (d.memberId === '') out.push('받은 직원을 골라 주세요');
  if (d.kind === '') out.push('종류를 골라 주세요');
  if (d.item.trim() === '') out.push('내용(포상품)을 적어 주세요');
  if (d.amount === null) out.push('금액을 적어 주세요 (포상휴가처럼 금액이 없으면 0)');
  else if (d.amount > MAX_WELFARE_AMOUNT) out.push('금액이 너무 큽니다');
  return out;
}

export interface FundDraft {
  id: number | null;
  kind: BonusFundKind;
  occurredOn: string;
  amount: number | null;
  memberId: string;
  purpose: string;
  ownerUse: boolean;
  evidenceLedgerId: number | null;
  note: string;
}

export const emptyFund = (): FundDraft => ({ id: null, kind: 'SPENT', occurredOn: '', amount: null, memberId: '', purpose: '', ownerUse: false, evidenceLedgerId: null, note: '' });

export const fundToDraft = (f: BonusFund): FundDraft => ({
  id: f.id,
  kind: f.kind,
  occurredOn: f.occurredOn,
  amount: f.amount,
  memberId: f.memberId === null ? '' : String(f.memberId),
  purpose: f.purpose,
  ownerUse: f.ownerUse,
  evidenceLedgerId: f.evidenceLedgerId,
  note: f.note ?? '',
});

/** 받음에는 직원·대표자 사용 표시가 없다(서버가 400으로 막는다) */
export function fundInput(d: FundDraft): BonusFundInput {
  const spent = d.kind === 'SPENT';
  return {
    kind: d.kind,
    occurredOn: d.occurredOn,
    amount: d.amount ?? 0,
    memberId: spent && d.memberId !== '' ? Number(d.memberId) : null,
    purpose: d.purpose.trim(),
    ownerUse: spent && d.ownerUse,
    evidenceLedgerId: d.evidenceLedgerId,
    note: orNull(d.note),
  };
}

export function fundBlockers(d: FundDraft, today: string): string[] {
  const out: string[] = [];
  if (!isValidYmd(d.occurredOn)) out.push('날짜를 골라 주세요');
  else if (d.occurredOn > today) out.push('날짜는 오늘보다 뒤일 수 없습니다');
  if (d.amount === null || d.amount < 1) out.push('금액을 1원 이상으로 적어 주세요');
  else if (d.amount > MAX_FUND_AMOUNT) out.push('금액이 너무 큽니다');
  if (d.purpose.trim() === '') out.push(d.kind === 'RECEIVED' ? '받은 가산금의 출처(평가 연도 등)를 적어 주세요' : '쓴 용도를 적어 주세요');
  else if (d.purpose.trim().length > MAX_ITEM) out.push('용도가 너무 깁니다');
  return out;
}
