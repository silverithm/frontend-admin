// 결재 상태
/** DRAFT는 아직 상신하지 않은 임시저장 — 기안자 본인에게만 보이고 결재함에는 뜨지 않는다 */
export type ApprovalStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED';

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
  /** 프로필 사진 — 없으면 화면에서 이니셜로 대체한다 */
  profileImageUrl?: string | null;
}

// 열람 대상 지정 단위 — 직책(POSITION)이면 그 직책 전원, 개인이면 그 사람만
export type ApprovalViewerType = 'POSITION' | 'MEMBER' | 'ADMIN';

// 열람 대상 한 줄 (조회 응답 — 이름은 지정 시점 스냅샷)
export interface ApprovalViewer {
  viewerType: ApprovalViewerType;
  refId: number;
  viewerName: string;
}

// 열람 대상 지정 항목 (생성/수정 요청 — 이름은 서버가 채운다)
export interface ApprovalViewerEntry {
  viewerType: ApprovalViewerType;
  refId: number;
}

// 열람 대상 후보 중 직책
export interface ViewerPositionCandidate {
  id: number;
  name: string;
  description?: string | null;
  /** 이 직책을 가진 재직 직원 수 — 몇 명이 보게 되는지 확인용 */
  memberCount: number;
}

// ── 과거 문서 이관 ──

/** 이관 색인 한 줄 (미리보기 응답 = 등록 요청) */
export interface ApprovalImportRow {
  rowNumber: number;
  externalDocNumber?: string | null;
  title?: string | null;
  requesterName?: string | null;
  draftedAt?: string | null;      // yyyy-MM-dd
  status?: string | null;         // APPROVED | REJECTED (그 외는 읽은 원문)
  category?: string | null;
  approvers: ApprovalImportApprover[];
  fileNames: string[];
  /** 있으면 이 줄은 등록되지 않는다 */
  errors: string[];
  /** 등록은 되지만 알고 넘어가야 하는 것 */
  warnings: string[];
}

export interface ApprovalImportApprover {
  name: string;
  approvedAt?: string | null;
  matchedType?: ApproverType | null;
  matchedRefId?: number | null;
}

export interface ApprovalImportPreview {
  columnMappings?: { header: string; field: string }[];
  unmappedColumns?: string[];
  rows: ApprovalImportRow[];
  totalCount: number;
  errorCount: number;
  missingFileNames?: string[];
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
  documentFooter?: DocumentFooter;
  /** 열람 대상 — 관리자·기안자·결재선 참여자는 여기에 없어도 볼 수 있다 */
  viewers?: ApprovalViewer[];
  /** 다른 시스템에서 옮겨온 완료 문서인지 — 참이면 결재를 다시 진행하지 않는다 */
  isImported?: boolean;
  importedSource?: string | null;
  externalDocNumber?: string | null;
  /** 대표 첨부 외의 딸린 파일들 */
  extraAttachments?: { fileUrl: string; fileName: string; fileSize?: number | null }[];
}

/**
 * 공문 하단 발신부에 찍히는 기관 정보.
 * 전부 기관 단위 값이라 값이 비면 그 줄만 빠진다 (지금은 DB에 직접 넣고, 다음에 기관 프로필에서 편집).
 */
export interface DocumentFooter {
  postalCode?: string;
  address?: string;
  homepageUrl?: string;
  phoneNumber?: string;
  faxNumber?: string;
  contactEmail?: string;
  /** 공개 / 부분공개 / 비공개. 비어 있으면 "공개"로 본다 */
  disclosureType?: string;
}

// 결재 요청 생성
export interface CreateApprovalRequest {
  templateId: string;
  title: string;
  formData: Record<string, any>;
  approvalLine?: ApprovalLineEntry[];
  /** 보내지 않으면 양식의 기본 열람 대상이 그대로 적용된다 */
  viewers?: ApprovalViewerEntry[];
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
