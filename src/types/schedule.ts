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

// 일정에 딸린 할 일 (담당자별 업무)
// 참석자(ScheduleParticipant)와는 다른 개념이다.
//   참석자 = 그 일정에 참여하는 사람
//   할 일  = 그 일정에서 실제로 수행할 업무와 담당자
export interface ScheduleTask {
  id: string;
  scheduleId: string;
  content: string;
  /** 담당자 member id. 없으면 미지정 */
  assigneeMemberId?: number | null;
  assigneeName?: string | null;
  isCompleted: boolean;
  completedAt?: string;
  completedById?: string;
  completedByName?: string;
  createdById?: string;
  createdByName?: string;
  sortOrder?: number;
  createdAt?: string;
  /** '내 할 일' 조회 시에만 채워진다 */
  scheduleTitle?: string;
  scheduleStartDate?: string;
  scheduleEndDate?: string;
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
  isCompleted?: boolean;
  completedAt?: string;
  completedById?: string;
  completedByName?: string;
  authorId: string;
  authorName: string;
  participants?: ScheduleParticipant[];
  tasks?: ScheduleTask[];
  /** 할 일 총 개수 / 완료 개수 (서버 계산값) */
  taskTotal?: number;
  taskCompleted?: number;
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

// 라벨 미지정 일정도 색이 보이도록 카테고리별 기본 색상을 부여한다.
export const SCHEDULE_CATEGORY_COLORS: Record<ScheduleCategory, string> = {
  MEETING: '#3B82F6',   // 회의 - 파랑
  EVENT: '#EC4899',     // 행사 - 분홍
  TRAINING: '#8B5CF6',  // 교육 - 보라
  OTHER: '#14B8A6',     // 기타 - 틸
};

/**
 * 일정 표시 색상. 라벨 색상이 있으면 그것을, 없으면 카테고리 기본 색상을 쓴다.
 */
export function getScheduleColor(schedule: {
  label?: { color?: string } | null;
  labelColor?: string;
  category?: string;
}): string {
  const labelColor = schedule.label?.color || schedule.labelColor;
  if (labelColor) return labelColor;
  const category = (schedule.category || 'OTHER') as ScheduleCategory;
  return SCHEDULE_CATEGORY_COLORS[category] || SCHEDULE_CATEGORY_COLORS.OTHER;
}

/**
 * 배경색 위에 얹을 반투명 톤(캘린더 칩 배경용).
 * #RRGGBB만 지원하며 파싱 실패 시 원본 색을 그대로 돌려준다.
 */
export function withAlpha(color: string, alpha: number): string {
  const hex = color.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
