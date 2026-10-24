/**
 * 결재선에서 기안자 본인을 뺀다.
 *
 * 양식의 기본 결재선에 든 사람이 직접 기안하면 자기 문서를 자기가 다시 결재해야 했다
 * (2026-10-24 현장 제보). 서버도 같은 규칙으로 빼지만, 화면에 미리 보이는 결재선이
 * 실제와 어긋나지 않도록 작성 화면에서도 같은 기준으로 뺀다.
 *
 * 기안자 식별자는 서버와 같은 형식이다 — 관리자 `admin_<id>`, 직원 `<id>`.
 */
export interface ApproverLike {
  approverType: string;
  approverId: number | string;
}

export function approverRequesterId(approver: ApproverLike): string {
  return approver.approverType === 'ADMIN' ? `admin_${approver.approverId}` : String(approver.approverId);
}

export function withoutDrafter<T extends ApproverLike>(line: T[], requesterId: string): T[] {
  if (!requesterId) return line;
  return line.filter((approver) => approverRequesterId(approver) !== requesterId);
}

/** 양식에 저장된 기본 결재선(JSON 문자열)을 읽어 기안자를 뺀 목록으로. 깨졌거나 없으면 빈 목록 */
export function parseDefaultApprovalLine<T extends ApproverLike>(json: string | null | undefined, requesterId: string): T[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? withoutDrafter(parsed as T[], requesterId) : [];
  } catch {
    return [];
  }
}
