// 결재 상태
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

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
}

// 결재 요청 생성
export interface CreateApprovalRequest {
  templateId: string;
  title: string;
  formData: Record<string, any>;
  attachments?: AttachmentFile[];
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
