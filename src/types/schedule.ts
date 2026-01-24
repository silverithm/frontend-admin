// 일정 관련 타입 정의

// 일정 카테고리
export type ScheduleCategory = 'MEETING' | 'EVENT' | 'TRAINING' | 'OTHER';

export const SCHEDULE_CATEGORIES: { value: ScheduleCategory; label: string }[] = [
  { value: 'MEETING', label: '회의' },
  { value: 'EVENT', label: '행사' },
  { value: 'TRAINING', label: '교육' },
  { value: 'OTHER', label: '기타' },
];

// 일정 라벨
export interface ScheduleLabel {
  id: string;
  companyId: string;
  name: string;
  color: string;
  createdAt: string;
}

// 일정 참석자
export interface ScheduleParticipant {
  id: string;
  scheduleId: string;
  userId: string;
  userName: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  respondedAt?: string;
}

// 일정 첨부파일
export interface ScheduleAttachment {
  id: string;
  scheduleId: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}

// 일정 메인 타입
export interface Schedule {
  id: string;
  companyId: string;
  title: string;
  content?: string;
  category: ScheduleCategory;
  labelId?: string;
  label?: ScheduleLabel;
  location?: string;
  startDate: string;
  startTime?: string;
  endDate: string;
  endTime?: string;
  isAllDay: boolean;
  sendNotification: boolean;
  authorId: string;
  authorName: string;
  participants?: ScheduleParticipant[];
  attachments?: ScheduleAttachment[];
  createdAt: string;
  updatedAt: string;
}

// 달력 뷰용 일정 요약
export interface ScheduleSummary {
  id: string;
  title: string;
  category: ScheduleCategory;
  labelColor?: string;
  startDate: string;
  endDate: string;
  isAllDay: boolean;
}

// 일정 생성 요청
export interface CreateScheduleRequest {
  title: string;
  content?: string;
  category: ScheduleCategory;
  labelId?: string;
  location?: string;
  startDate: string;
  startTime?: string;
  endDate: string;
  endTime?: string;
  isAllDay: boolean;
  sendNotification: boolean;
  participantIds?: string[];
  attachments?: {
    fileName: string;
    fileUrl: string;
    fileSize: number;
    mimeType: string;
  }[];
}

// 일정 수정 요청
export interface UpdateScheduleRequest {
  title?: string;
  content?: string;
  category?: ScheduleCategory;
  labelId?: string;
  location?: string;
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  isAllDay?: boolean;
  sendNotification?: boolean;
  participantIds?: string[];
  attachments?: {
    fileName: string;
    fileUrl: string;
    fileSize: number;
    mimeType: string;
  }[];
}

// 라벨 생성 요청
export interface CreateLabelRequest {
  name: string;
  color: string;
}

// 라벨 색상 옵션
export const LABEL_COLORS = [
  { value: '#EF4444', label: '빨강' },
  { value: '#F97316', label: '주황' },
  { value: '#EAB308', label: '노랑' },
  { value: '#22C55E', label: '초록' },
  { value: '#3B82F6', label: '파랑' },
  { value: '#8B5CF6', label: '보라' },
  { value: '#EC4899', label: '분홍' },
  { value: '#6B7280', label: '회색' },
];
