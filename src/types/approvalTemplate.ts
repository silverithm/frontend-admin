import { FormSchema } from '@/types/formSchema';
import { ApprovalViewer, ApprovalViewerEntry } from '@/types/approval';

// 양식 템플릿 (한글 파일 기반)
export interface ApprovalTemplate {
  id: string;
  name: string;              // 양식명
  description: string;       // 설명
  /** 기안 대분류 (공문/교육/인사 등) — 기관이 자유롭게 지정, 없으면 미분류 */
  category?: string | null;
  fileUrl: string;           // 양식 파일 URL (한글 파일 등)
  fileName: string;          // 원본 파일명
  fileSize: number;          // 파일 크기 (바이트)
  isActive: boolean;         // 활성화 여부
  createdAt: string;
  updatedAt: string;
  formSchema?: FormSchema;
  templateType: 'file' | 'form' | 'hybrid';
  /** 기본 결재선(JSON 문자열) — 이 양식으로 기안하면 자동으로 채워진다 */
  defaultApprovalLine?: string | null;
  /** 기본 열람 대상 — 이 양식으로 기안한 문서를 볼 수 있는 직책·개인 */
  defaultViewers?: ApprovalViewer[];
}

// 양식 생성 요청
export interface CreateTemplateRequest {
  name: string;
  description: string;
  category?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  formSchema?: string; // JSON 문자열
  templateType?: string;
  /** 기본 열람 대상 — 보내지 않으면 기존 설정을 유지한다 */
  defaultViewers?: ApprovalViewerEntry[];
}

// 양식 수정 요청
export interface UpdateTemplateRequest {
  name?: string;
  description?: string;
  category?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  isActive?: boolean;
  formSchema?: string; // JSON 문자열
  templateType?: string;
  /** 기본 열람 대상 — 보내지 않으면 기존 설정을 유지한다 */
  defaultViewers?: ApprovalViewerEntry[];
}
