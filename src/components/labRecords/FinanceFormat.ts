'use client';

/**
 * 4차 재무 화면(급여대장·회계 장부·후원금) 공용 도우미 — 원 단위 표시, 이름 가리기, CSV 내려받기, 계정 고르기 목록.
 * 금액은 모두 정수 원이다. 입력은 쉼표·원·공백이 섞여도 숫자만 읽는다(NumField).
 */
import type { LedgerAccount } from '@/lib/lab/ledgerRules';
import { accountsFor } from '@/lib/lab/ledgerRules';
import type { LedgerDirection } from '@/lib/lab/labTypes';

/** 12,345원. 음수는 -12,345원 */
export function won(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return `${Math.trunc(value).toLocaleString('ko-KR')}원`;
}

/** 표 안에서 쓰는 쉼표 숫자(단위 없음) */
export function num(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value).toLocaleString('ko-KR') : '';
}

/**
 * 이름 가운데 가리기 — 홍길동 → 홍○동, 홍길 → 홍○, 남궁민수 → 남○○수.
 * 한 글자는 그대로 둔다(가릴 가운데가 없다). 공백은 지우고 센다.
 */
export function maskName(name: string | null | undefined): string {
  const chars = Array.from((name ?? '').replace(/\s+/g, ''));
  if (chars.length <= 1) return chars.join('');
  if (chars.length === 2) return `${chars[0]}○`;
  return `${chars[0]}${'○'.repeat(Math.min(chars.length - 2, 6))}${chars[chars.length - 1]}`;
}

/** 브라우저가 CSV 파일을 내려받게 한다. 주소는 곧바로 풀어 메모리를 돌려준다. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface AccountSection {
  type: 'section';
  title: string;
  options: Array<{ value: string; label: string }>;
}

/** 계정 고르기 목록 — 관·항별 묶음 아래에 목. 코드는 하드코딩하지 않고 계정표에서 읽는다. */
export function accountOptions(direction: LedgerDirection): AccountSection[] {
  const sections: AccountSection[] = [];
  const index = new Map<string, AccountSection>();
  for (const a of accountsFor(direction) as ReadonlyArray<LedgerAccount>) {
    const key = `${a.groupCode}/${a.sectionCode}`;
    let section = index.get(key);
    if (!section) {
      section = { type: 'section', title: `${a.group} › ${a.section}`, options: [] };
      index.set(key, section);
      sections.push(section);
    }
    section.options.push({ value: a.code, label: `${a.code} ${a.name}` });
  }
  return sections;
}

/** 'YYYY-MM-DD' 모양(달력에 있는 날짜인지는 parseYmd가 따로 본다) */
export const YMD_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
