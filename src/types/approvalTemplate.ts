// 양식 템플릿 (한글 파일 기반)
export interface ApprovalTemplate {
  id: string;
  name: string;              // 양식명
  description: string;       // 설명
  fileUrl: string;           // 양식 파일 URL (한글 파일 등)
  fileName: string;          // 원본 파일명
  fileSize: number;          // 파일 크기 (바이트)
  isActive: boolean;         // 활성화 여부
  createdAt: string;
  updatedAt: string;
}

// 양식 생성 요청
export interface CreateTemplateRequest {
  name: string;
  description: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
}

// 양식 수정 요청
export interface UpdateTemplateRequest {
  name?: string;
  description?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  isActive?: boolean;
}
