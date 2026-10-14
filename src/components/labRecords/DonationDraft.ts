/** 후원금 입력 한 건의 초안·검증·표시 이름. 금액은 정수 원(물품은 환산액)이다. */
import { MAX_LEDGER_AMOUNT } from '@/lib/lab/ledgerRules';
import type { Donation, DonationInput, DonationKind, DonorType } from '@/lib/lab/labTypes';
import { YMD_PATTERN } from './FinanceFormat';

export const DONOR_TYPE_LABEL: Record<DonorType, string> = { INDIVIDUAL: '개인', CORPORATE: '법인·단체', GROUP: '모임' };
export const KIND_LABEL: Record<DonationKind, string> = { CASH: '현금', GOODS: '물품' };

export const DONOR_TYPE_OPTIONS: Array<{ value: string; label: string }> = (Object.keys(DONOR_TYPE_LABEL) as DonorType[]).map((k) => ({ value: k, label: DONOR_TYPE_LABEL[k] }));

export const MAX_DONATION_AMOUNT = MAX_LEDGER_AMOUNT;
export const MAX_DONOR_NAME = 50;
export const MAX_GOODS_DESCRIPTION = 200;
export const MAX_PURPOSE = 100;
export const MAX_RECEIPT_NO = 50;

export interface DonationDraft {
  /** 고치는 중인 후원금 번호(새로 적는 중이면 null) */
  id: number | null;
  receivedOn: string;
  donorName: string;
  donorType: DonorType;
  kind: DonationKind;
  amount: number | null;
  goodsDescription: string;
  /** 지정 후원 여부와 그 용도 */
  designated: boolean;
  purpose: string;
  receiptNo: string;
}

export function emptyDonationDraft(date: string): DonationDraft {
  return { id: null, receivedOn: date, donorName: '', donorType: 'INDIVIDUAL', kind: 'CASH', amount: null, goodsDescription: '', designated: false, purpose: '', receiptNo: '' };
}

export function draftOfDonation(d: Donation): DonationDraft {
  return {
    id: d.id,
    receivedOn: d.receivedOn,
    donorName: d.donorName,
    donorType: d.donorType,
    kind: d.kind,
    amount: d.amount,
    goodsDescription: d.goodsDescription ?? '',
    designated: d.designatedPurpose !== null,
    purpose: d.designatedPurpose ?? '',
    receiptNo: d.receiptNo ?? '',
  };
}

const orNull = (text: string): string | null => (text.trim() === '' ? null : text.trim());

export function inputOfDonationDraft(d: DonationDraft): DonationInput {
  return {
    receivedOn: d.receivedOn,
    donorName: d.donorName.trim(),
    donorType: d.donorType,
    kind: d.kind,
    amount: d.amount ?? 0,
    // 물품 설명은 물품일 때만, 용도는 지정 후원일 때만 보낸다
    goodsDescription: d.kind === 'GOODS' ? orNull(d.goodsDescription) : null,
    designatedPurpose: d.designated ? orNull(d.purpose) ?? '' : null,
    receiptNo: orNull(d.receiptNo),
  };
}

/** 오류 문장 목록(비어 있으면 통과) */
export function donationIssues(d: DonationDraft): string[] {
  const issues: string[] = [];
  if (!YMD_PATTERN.test(d.receivedOn)) issues.push('받은 날짜를 적어 주세요');
  if (d.donorName.trim() === '') issues.push('후원자 이름을 적어 주세요');
  if (d.amount === null || !Number.isInteger(d.amount) || d.amount < 1 || d.amount > MAX_DONATION_AMOUNT) issues.push('금액은 1원 이상 100억 원 이하의 정수여야 합니다');
  if (d.kind === 'GOODS' && d.goodsDescription.trim() === '') issues.push('물품 후원은 어떤 물품인지 적어 주세요');
  if (d.designated && d.purpose.trim() === '') issues.push('지정 후원은 쓸 용도를 적어 주세요');
  return issues;
}
