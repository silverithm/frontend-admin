// 결재 상태
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

// 결재선 단계 상태
export type ApprovalStepStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED';

// 결재선 단계 역할
export type ApprovalStepRole = 'REVIEWER' | 'FINAL';

// 결재자 유형 (ADMIN=기관 관리자 계정, MEMBER=직원)
export type ApproverType = 'ADMIN' | 'MEMBER';

// 결재선 단계 (응답)
export interface ApprovalStep {
  id: number;
  stepOrder: number;            // 1-based
  approverType: ApproverType;
  approverId: string;           // legacy 문자열 (admin_<id> 또는 memberId)
  approverName: string;
  roleLabel: ApprovalStepRole;
  status: ApprovalStepStatus;
  signatureUrl?: string;        // 서명 이미지 (미서명 시 null)
  processedAt?: string;
  rejectReason?: string;
}

// 결재선 지정 항목 (생성 요청) — 리스트 순서가 결재 순서, 마지막이 최종 결재자
export interface ApprovalLineEntry {
  approverType: ApproverType;
  approverId: number;           // app_user.id 또는 members.id
}

// 결재자 후보 (결재선 지정용)
export interface ApproverCandidate {
  approverType: ApproverType;
  approverId: number;
  name: string;
  position?: string | null;
}

// 첨부파일 정보
export interface AttachmentFile {
  id: string;
  fileName: string;      // 원본 파일명
  fileKey: string;       // S3 key
  fileUrl: string;       // S3 public URL
  fileSize: number;      // 바이트
  contentType: string;   // MIME type
  uploadedAt: string;
}

// 결재 요청 (제출된 기안)
export interface ApprovalRequest {
  id: string;
  templateId: string;        // 사용한 양식 ID
  templateName: string;      // 양식명 (스냅샷)
  title: string;             // 제목
  formData: Record<string, any>;  // 양식 필드에 입력된 값들
  // 첨부파일 - 단일 필드 (백엔드 구조)
  attachmentUrl?: string;
  attachmentFileName?: string;
  attachmentFileSize?: number;
  requesterId: string;
  requesterName: string;
  status: ApprovalStatus;
  createdAt: string;
  processedAt?: string;
  processedBy?: string;
  processedByName?: string;
  rejectReason?: string;
  // 결재선/공문 확장 (백엔드 additive 필드)
  hasApprovalLine?: boolean;
  approvalLine?: ApprovalStep[];
  docNumber?: string;
  docNumberDisplay?: string;
  companySealUrl?: string;      // 최종 승인된 결재선 문서에만 존재
}

// 결재 요청 생성
export interface CreateApprovalRequest {
  templateId: string;
  title: string;
  formData: Record<string, any>;
  approvalLine?: ApprovalLineEntry[];
}

// 결재 필터
export interface ApprovalFilter {
  status?: ApprovalStatus | 'ALL';
  startDate?: string;
  endDate?: string;
  requesterId?: string;
  searchQuery?: string;
}

// 결재 목록 응답
export interface ApprovalListResponse {
  approvals: ApprovalRequest[];
  total: number;
  page: number;
  pageSize: number;
}

// 일괄 처리 요청
export interface BulkApprovalRequest {
  ids: string[];
  rejectReason?: string;  // 일괄 반려 시 사유
}
