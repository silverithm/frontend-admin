/** 통장 대사 화면 공용 도우미 — 용도 이름, 원 단위 표시, 부호 있는 금액 읽기. 금액은 모두 정수 원이다. */
import type { BankAccountPurpose } from '@/lib/lab/labTypes';

export const PURPOSE_LABEL: Record<BankAccountPurpose, string> = {
  OPERATING: '운영',
  DONATION: '후원금 전용',
  DEPOSIT: '예금',
  OTHER: '기타',
};

export const PURPOSE_OPTIONS: Array<{ value: string; label: string }> = (Object.keys(PURPOSE_LABEL) as BankAccountPurpose[]).map((k) => ({ value: k, label: PURPOSE_LABEL[k] }));

/** 통장 시작·월말 잔액 한도(서버와 같다) */
export const MAX_BANK_AMOUNT = 10_000_000_000;

/** 12,345원 · -12,345원 */
export function wonText(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return `${Math.trunc(value).toLocaleString('ko-KR')}원`;
}

/** +12,345원 · -12,345원 · 0원 (차이·거래액처럼 부호가 뜻을 가진 값) */
export function signedWonText(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  const v = Math.trunc(value);
  return `${v > 0 ? '+' : ''}${v.toLocaleString('ko-KR')}원`;
}

/** 마이너스가 들어갈 수 있는 금액 글('-1,250,000원'·'−5000')을 정수로. 비었거나 숫자가 아니거나 한도를 넘으면 null. */
export function parseWonText(text: string): number | null {
  const t = text.replace(/[\s,원₩]/g, '').replace(/^[−–]/, '-');
  if (!/^-?\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isSafeInteger(n) && Math.abs(n) <= MAX_BANK_AMOUNT ? n : null;
}

/** 입력 중인 금액 글을 숫자·맨 앞 마이너스만 남기고 세 자리마다 쉼표를 넣는다('-1250000' → '-1,250,000') */
export function cleanWonText(text: string): string {
  const neg = /^\s*[-−–]/.test(text);
  const digits = text.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 13);
  return `${neg ? '-' : ''}${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

/** 저장된 금액을 입력칸 글로 — 1250000 → '1,250,000' */
export function wonInputText(value: number): string {
  return Math.trunc(value).toLocaleString('ko-KR');
}

/** 끝 4자리 표시 — 없으면 '-' */
export function tailText(tail: string | null | undefined): string {
  return tail ? `****${tail}` : '-';
}

export function purposeName(p: BankAccountPurpose): string {
  return PURPOSE_LABEL[p] ?? p;
}
