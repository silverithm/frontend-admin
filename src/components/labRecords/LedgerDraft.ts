/** 회계 장부 입력 한 줄의 초안·검증·표시 이름. 계정은 ledgerRules의 계정표에서 읽는다(코드를 직접 적지 않는다). */
import { MAX_COUNTERPARTY, MAX_LEDGER_AMOUNT, MAX_LEDGER_DESCRIPTION, ledgerEntryIssues } from '@/lib/lab/ledgerRules';
import type { LedgerDirection, LedgerEntry, LedgerEntryInput, LedgerEvidenceType } from '@/lib/lab/labTypes';

export const DIRECTION_LABEL: Record<LedgerDirection, string> = { INCOME: '수입', EXPENSE: '지출' };

export const EVIDENCE_LABEL: Record<LedgerEvidenceType, string> = {
  RECEIPT: '영수증',
  CARD: '카드 전표',
  TAX_INVOICE: '세금계산서',
  TRANSFER: '계좌이체 내역',
  OTHER: '기타',
};

export const EVIDENCE_OPTIONS: Array<{ value: string; label: string }> = [
  ...(Object.keys(EVIDENCE_LABEL) as LedgerEvidenceType[]).map((k) => ({ value: k, label: EVIDENCE_LABEL[k] })),
];

export { MAX_COUNTERPARTY, MAX_LEDGER_AMOUNT, MAX_LEDGER_DESCRIPTION };

export interface EntryDraft {
  /** 고치는 중인 장부 줄 번호(새로 적는 중이면 null) */
  id: number | null;
  date: string;
  direction: LedgerDirection;
  accountCode: string;
  description: string;
  amount: number | null;
  counterparty: string;
  evidence: LedgerEvidenceType | '';
  donationId: number | null;
  aiAssisted: boolean;
}

export function emptyDraft(date: string, direction: LedgerDirection = 'EXPENSE'): EntryDraft {
  return { id: null, date, direction, accountCode: '', description: '', amount: null, counterparty: '', evidence: '', donationId: null, aiAssisted: false };
}

export function draftOfEntry(e: LedgerEntry): EntryDraft {
  return {
    id: e.id,
    date: e.entryDate,
    direction: e.direction,
    accountCode: e.accountCode,
    description: e.description,
    amount: e.amount,
    counterparty: e.counterparty ?? '',
    evidence: e.evidenceType ?? '',
    donationId: e.donationId,
    aiAssisted: e.aiAssisted,
  };
}

export function inputOfDraft(d: EntryDraft): LedgerEntryInput {
  return {
    entryDate: d.date,
    direction: d.direction,
    accountCode: d.accountCode,
    description: d.description.trim(),
    amount: d.amount ?? 0,
    counterparty: d.counterparty.trim() === '' ? null : d.counterparty.trim(),
    evidenceType: d.evidence === '' ? null : d.evidence,
    // 후원금 연결은 지출에만 있다
    donationId: d.direction === 'EXPENSE' ? d.donationId : null,
    aiAssisted: d.aiAssisted,
  };
}

export function draftIssues(d: EntryDraft): string[] {
  return ledgerEntryIssues(inputOfDraft(d));
}
