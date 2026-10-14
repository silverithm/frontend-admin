/** 퇴직금 추계 화면 공용 — 직원별 급여대장 묶기, 표 한 줄 만들기, 계산식 글자. */
import { num } from '@/components/labRecords/FinanceFormat';
import { severanceEstimate } from '@/lib/lab/severanceRules';
import type { SeveranceEstimate } from '@/lib/lab/severanceRules';
import type { PayrollLine, PayrollProfile } from '@/lib/lab/labTypes';

export function groupLines(lines: ReadonlyArray<PayrollLine>): Record<number, PayrollLine[]> {
  const out: Record<number, PayrollLine[]> = {};
  for (const l of lines) (out[l.memberId] ??= []).push(l);
  return out;
}

export interface SeveranceRow {
  profile: PayrollProfile;
  name: string;
  estimate: SeveranceEstimate;
}

export function rowsOf(profiles: ReadonlyArray<PayrollProfile>, byMember: Readonly<Record<number, PayrollLine[]>>, asOf: string): SeveranceRow[] {
  return profiles
    .map((profile) => ({
      profile,
      name: profile.memberName ?? `직원 ${profile.memberId}`,
      estimate: severanceEstimate(profile, byMember[profile.memberId] ?? [], asOf, 0),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}

export const wonText = (v: number): string => `${num(v)}원`;

/** 근속일수를 '2년 3개월 (840일)'처럼 읽기 쉽게 — 정확한 법정 기간 계산이 아니라 표시용 */
export function serviceText(days: number): string {
  if (days <= 0) return '0일';
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  const head = years > 0 ? `${years}년 ${months}개월` : months > 0 ? `${months}개월` : '';
  return head ? `${head} (${num(days)}일)` : `${num(days)}일`;
}

/** 대상이 아닌 직원의 짧은 사유(표 칸용) */
export function shortReason(e: SeveranceEstimate, weeklyHours: number): string {
  if (e.eligible) return '';
  if (weeklyHours < 15) return '주 15시간 미만';
  if (e.serviceDays < 365) return '1년 미만';
  return e.reason ?? '';
}
