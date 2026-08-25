// 회의록 — 작성 → 등록(참석자 알림) → 병렬 서명 → 완료(결재함 등록)

export type MeetingMinutesStatus = 'IN_PROGRESS' | 'REGISTERED' | 'COMPLETED';

export type AttendeeType = 'ADMIN' | 'MEMBER' | 'EXTERNAL';

/** 양식의 섹션 한 칸 */
export interface MinutesSection {
  key: string;
  label: string;
}

/** 문서에 저장되는 섹션 (양식 스냅샷 + 내용) */
export interface MinutesSectionContent extends MinutesSection {
  content: string;
}

export interface MeetingMinutesAttendee {
  id: number;
  attendeeType: AttendeeType;
  refId: number | null;
  attendeeName: string;
  /** 절대 URL — <img>로 바로 그린다 */
  signatureUrl: string | null;
  signedAt: string | null;
  notifiedAt: string | null;
  remindedAt: string | null;
}

export interface MeetingMinutesAudioChunk {
  seq: number;
  filePath: string;
  durationSec: number | null;
}

export interface MeetingMinutesAttachment {
  id: number;
  fileUrl: string;
  fileName: string;
  fileSize: number | null;
}

export interface MeetingMinutes {
  id: number;
  title: string;
  location: string | null;
  authorType: 'ADMIN' | 'MEMBER';
  authorRefId: number;
  authorName: string;
  meetingStartAt: string;
  meetingEndAt: string | null;
  status: MeetingMinutesStatus;
  sectionsJson: string | null;
  rawNotes: string | null;
  transcript: string | null;
  approvalRequestId: number | null;
  completedAt: string | null;
  createdAt: string;
  signedCount: number;
  attendeeCount: number;
  attendees?: MeetingMinutesAttendee[];
  audioChunks?: MeetingMinutesAudioChunk[];
  attachments?: MeetingMinutesAttachment[];
}

/** 생성/수정 요청의 참석자 항목 — POSITION은 서버가 그 직책 전원으로 펼친다 */
export interface MinutesAttendeeEntry {
  attendeeType: AttendeeType | 'POSITION';
  refId?: number | null;
  /** EXTERNAL만 사용 */
  name?: string;
}

export interface MinutesAttachmentEntry {
  fileUrl: string;
  fileName: string;
  fileSize?: number | null;
}

export interface CreateMeetingMinutesInput {
  title: string;
  location?: string | null;
  meetingStartAt: string;
  meetingEndAt?: string | null;
  sectionsJson?: string | null;
  rawNotes?: string | null;
  attendees: MinutesAttendeeEntry[];
  attachments?: MinutesAttachmentEntry[];
}

export const MEETING_MINUTES_STATUS_LABEL: Record<MeetingMinutesStatus, string> = {
  IN_PROGRESS: '작성 중',
  REGISTERED: '서명 수집 중',
  COMPLETED: '완료',
};
