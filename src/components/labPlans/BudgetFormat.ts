/** 예산 화면 공용 표시 — 집행률, 줄 이름. */
import { accountLabel } from '@/lib/lab/ledgerRules';
import type { LedgerDirection } from '@/lib/lab/labTypes';

export function rateText(rate: number | null): string {
  return rate === null ? '-' : `${rate.toLocaleString('ko-KR')}%`;
}

export function accountText(direction: LedgerDirection, code: string): string {
  return accountLabel(direction, code);
}

/** 금액 차이를 부호와 함께: +1,000원 / -1,000원 / 0원 */
export function signedWon(value: number): string {
  const v = Math.trunc(value);
  return `${v > 0 ? '+' : ''}${v.toLocaleString('ko-KR')}원`;
}
