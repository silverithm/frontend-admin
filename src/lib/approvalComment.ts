/**
 * 결재 승인 의견(코멘트) 정리 규칙 — 서버 계약과 같다.
 * 앞뒤 공백 제거, 비면 보내지 않음, 최대 1000자.
 */
export const APPROVAL_COMMENT_MAX_LENGTH = 1000;

/** 보낼 값으로 정리한다. 비어 있으면 undefined(본문에서 생략). */
export function normalizeApprovalComment(raw: string | null | undefined): string | undefined {
  const trimmed = (raw ?? '').trim();
  return trimmed ? trimmed : undefined;
}

/** 정리한 뒤 길이가 한도를 넘는지 */
export function isApprovalCommentTooLong(raw: string | null | undefined): boolean {
  return (normalizeApprovalComment(raw)?.length ?? 0) > APPROVAL_COMMENT_MAX_LENGTH;
}

/** 승인 요청 본문. 서명·의견이 모두 없으면 undefined(본문 없이 전송). */
export function buildApproveBody(options?: {
  signatureBase64?: string;
  comment?: string | null;
}): { signatureBase64?: string; comment?: string } | undefined {
  const comment = normalizeApprovalComment(options?.comment);
  const signatureBase64 = options?.signatureBase64;
  if (!signatureBase64 && !comment) return undefined;
  return {
    ...(signatureBase64 ? { signatureBase64 } : {}),
    ...(comment ? { comment } : {}),
  };
}
