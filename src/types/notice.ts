// 공지사항 우선순위
export type NoticePriority = 'HIGH' | 'NORMAL' | 'LOW';

// 공지사항 상태
export type NoticeStatus = 'PUBLISHED' | 'ARCHIVED';

// 공지사항 첨부파일
export interface NoticeAttachment {
  id: string;
  noticeId: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  fileType: 'IMAGE' | 'FILE'; // 이미지 또는 일반 파일
  mimeType: string;
  createdAt: string;
}

// 공지사항 댓글
export interface NoticeComment {
  id: string;
  noticeId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

// 공지사항 읽은 사람
export interface NoticeReader {
  id: string;
  noticeId: string;
  userId: string;
  userName: string;
  readAt: string;
}

// 공지사항
export interface Notice {
  id: string;
  title: string;
  content: string;
  priority: NoticePriority;
  status: NoticeStatus;
  isPinned: boolean; // 상단 고정 여부
  authorId: string;
  authorName: string;
  companyId: string;
  viewCount: number;
  commentCount: number;
  attachments: NoticeAttachment[];
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

// 공지사항 상세 (댓글, 읽은 사람 포함)
export interface NoticeDetail extends Notice {
  comments: NoticeComment[];
  readers: NoticeReader[];
}

// 공지사항 생성 요청
export interface CreateNoticeRequest {
  title: string;
  content: string;
  priority: NoticePriority;
  isPinned: boolean;
  sendPushNotification: boolean; // FCM 알림 발송 여부
  attachments?: {
    fileName: string;
    fileUrl: string;
    fileSize: number;
    fileType: 'IMAGE' | 'FILE';
    mimeType: string;
  }[];
}

// 공지사항 수정 요청
export interface UpdateNoticeRequest {
  title?: string;
  content?: string;
  priority?: NoticePriority;
  isPinned?: boolean;
  status?: NoticeStatus;
  attachments?: {
    fileName: string;
    fileUrl: string;
    fileSize: number;
    fileType: 'IMAGE' | 'FILE';
    mimeType: string;
  }[];
}

// 공지사항 필터
export interface NoticeFilter {
  status?: NoticeStatus | 'ALL';
  priority?: NoticePriority | 'ALL';
  searchQuery?: string;
  startDate?: string;
  endDate?: string;
}

// 댓글 생성 요청
export interface CreateCommentRequest {
  content: string;
}
