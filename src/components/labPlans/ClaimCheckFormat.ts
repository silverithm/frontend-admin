/** 공단 청구 대조 화면 공용 — 구간 글, 한 줄의 최종 상태, 저장할 줄 만들기. */
import { HOUR_BANDS } from '@/lib/ltc2026';
import type { MonthlyLimitUse, ReconcileRow } from '@/lib/lab/claimRules';
import type { ClaimReviewInput, ClaimReviewStatus, CopayBill } from '@/lib/lab/labTypes';

/** 표에 쓰는 짧은 구간 글 — 없으면 '-' */
export function bandShort(band: string | null | undefined): string {
  if (!band) return '-';
  if (band === 'under3') return '3시간 미만';
  return HOUR_BANDS.find((b) => b.id === band)?.short ?? band;
}

/** 대조한 한 줄 + 화면에 붙이는 값 */
export interface CheckedRow extends ReconcileRow {
  name: string;
  bill: CopayBill | null;
  limit: MonthlyLimitUse | null;
}

/** 일수는 모두 같고 구간만 다른 줄 — 서버는 일수만 봐서 MATCH로 저장해 버리므로 사유가 있어야 저장한다 */
export function isBandOnly(row: Pick<ReconcileRow, 'status' | 'claimedDays' | 'attendedDays' | 'billedDays'>): boolean {
  return row.status === 'MISMATCH' && row.claimedDays === row.attendedDays && (row.billedDays === null || row.billedDays === row.claimedDays);
}

/** 줄의 최종 상태: 일치면 MATCH, 차이가 있는데 사유를 적었으면 RESOLVED, 아니면 MISMATCH */
export function finalStatus(row: Pick<ReconcileRow, 'status'>, note: string): ClaimReviewStatus {
  if (row.status === 'MATCH') return 'MATCH';
  return note.trim() !== '' ? 'RESOLVED' : 'MISMATCH';
}

export const MAX_REVIEW_NOTE = 500;
export const MAX_BATCH_ROWS = 200;

export interface SavePlan {
  rows: ClaimReviewInput[];
  /** 구간만 달라 사유가 없어서 저장하지 않는 줄 수 */
  skipped: number;
  counts: { match: number; resolved: number; mismatch: number };
}

/** 저장할 줄을 만든다. 구간만 다르고 사유가 없는 줄은 뺀다(서버가 일수만 보고 MATCH로 바꿔 버리기 때문). */
export function planSave(month: string, rows: ReadonlyArray<CheckedRow>, notes: Readonly<Record<number, string>>, reviewerName: string): SavePlan {
  const out: ClaimReviewInput[] = [];
  const counts = { match: 0, resolved: 0, mismatch: 0 };
  let skipped = 0;
  for (const r of rows) {
    // 일치한 줄은 옛 사유를 끌고 가지 않는다
    const note = r.status === 'MATCH' ? '' : (notes[r.elderlyId] ?? '').trim();
    if (isBandOnly(r) && note === '') {
      skipped += 1;
      continue;
    }
    const status = finalStatus(r, note);
    if (status === 'MATCH') counts.match += 1;
    else if (status === 'RESOLVED') counts.resolved += 1;
    else counts.mismatch += 1;
    out.push({
      elderlyId: r.elderlyId,
      claimMonth: month,
      claimedDays: r.claimedDays,
      attendedDays: r.attendedDays,
      billedDays: r.billedDays,
      claimedBand: r.claimedBand,
      status,
      note: note === '' ? null : note.slice(0, MAX_REVIEW_NOTE),
      reviewerName: reviewerName.trim(),
    });
  }
  return { rows: out, skipped, counts };
}
