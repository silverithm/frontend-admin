/** 통장 한 건 입력 초안·검증. 계좌번호는 끝 4자리만 받는다. */
import { isValidYmd } from '@/lib/lab/labDate';
import type { BankAccount, BankAccountInput, BankAccountPurpose } from '@/lib/lab/labTypes';
import { parseWonText } from './BankReconFormat';

export const MAX_ACCOUNT_NAME = 50;
export const MAX_BANK_NAME = 30;

export interface AccountDraft {
  /** 고치는 중인 통장 번호(새로 적는 중이면 null) */
  id: number | null;
  name: string;
  purpose: BankAccountPurpose | '';
  bankName: string;
  tail: string;
  /** 마이너스가 있을 수 있어 글로 둔다 */
  openingText: string;
  openingDate: string;
  active: boolean;
}

export function emptyAccountDraft(today: string): AccountDraft {
  return { id: null, name: '', purpose: '', bankName: '', tail: '', openingText: '', openingDate: today, active: true };
}

export function draftOfAccount(a: BankAccount): AccountDraft {
  return { id: a.id, name: a.name, purpose: a.purpose, bankName: a.bankName, tail: a.accountTail ?? '', openingText: String(a.openingBalance), openingDate: a.openingDate, active: a.active };
}

export function accountIssues(d: AccountDraft): string[] {
  const out: string[] = [];
  if (d.name.trim() === '') out.push('통장 이름을 적어 주세요');
  if (d.purpose === '') out.push('용도를 골라 주세요');
  if (d.bankName.trim() === '') out.push('은행 이름을 적어 주세요');
  if (d.tail !== '' && !/^\d{4}$/.test(d.tail)) out.push('계좌번호는 끝 4자리 숫자만 적어 주세요');
  if (d.openingText.trim() === '') out.push('시작 잔액을 적어 주세요(없으면 0)');
  else if (parseWonText(d.openingText) === null) out.push('시작 잔액은 100억 원 이내의 숫자로 적어 주세요');
  if (!isValidYmd(d.openingDate)) out.push('시작일을 골라 주세요');
  return out;
}

/** 검증을 통과한 초안만 부른다 */
export function inputOfAccount(d: AccountDraft): BankAccountInput {
  return {
    name: d.name.trim(),
    purpose: (d.purpose || 'OPERATING') as BankAccountPurpose,
    bankName: d.bankName.trim(),
    accountTail: d.tail === '' ? null : d.tail,
    openingBalance: parseWonText(d.openingText) ?? 0,
    openingDate: d.openingDate,
    active: d.active,
  };
}
