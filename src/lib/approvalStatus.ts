import type { ApprovalStatus } from '../types/approval';

export type ApprovalStatusVariant = 'green' | 'yellow' | 'red' | 'neutral';

/**
 * 결재 상태 꼬리표 — 결재 관리·결재 신청·결재 상세가 같은 글자와 색을 쓴다.
 * 예전에는 화면마다 따로 적어서 결재 관리만 임시저장을 'DRAFT'로 보였다(2026-10-27).
 * 색은 DESIGN.md 상태 어휘의 옅은 꼬리표(승인 green · 대기 yellow · 반려 red)다 — 진한 바탕(success·warning·error)은 쓰지 않는다.
 */
export const APPROVAL_STATUS_BADGE: Record<ApprovalStatus, { label: string; variant: ApprovalStatusVariant }> = {
  APPROVED: { label: '승인됨', variant: 'green' },
  PENDING: { label: '진행중', variant: 'yellow' },
  REJECTED: { label: '반려됨', variant: 'red' },
  DRAFT: { label: '임시저장', variant: 'neutral' },
};

export function approvalStatusBadge(status: ApprovalStatus | string | null | undefined): { label: string; variant: ApprovalStatusVariant } {
  return APPROVAL_STATUS_BADGE[status as ApprovalStatus] ?? { label: status ?? '', variant: 'neutral' };
}
