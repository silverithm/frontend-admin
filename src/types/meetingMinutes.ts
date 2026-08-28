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
  /** 호출자 본인의 참석자 행 id — 참석자가 아니면 null (목록/상세 공통) */
  myAttendeeId: number | null;
  /** 호출자 본인의 서명 시각 — null이면 아직 미서명 */
  mySignedAt: string | null;
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

/**
 * 회의록 양식 — 섹션 구성 + AI 자동 정리가 따라갈 지시·형식 예시를 함께 담는다.
 * 회사당 여러 개를 만들어 회의 성격별로(전체회의용/사례회의용 등) 골라 쓴다.
 * id가 null이면 저장된 적 없는 애플리케이션 기본 양식(폴백)이다.
 */
export interface MinutesTemplate {
  id: number | null;
  name: string;
  sections: MinutesSection[];
  /** AI 자동 정리가 따라갈 추가 지시 — 말투·관점 등 */
  aiInstruction: string | null;
  /** AI 자동 정리가 따라갈 출력 형식 예시 (few-shot) */
  formatExample: string | null;
  isDefault: boolean;
  sortOrder: number;
}

/** 서버가 sectionsJson(문자열)으로 내려주는 원시 양식 응답을 파싱해 MinutesTemplate으로 만든다 */
export function parseTemplateResponse(raw: {
  id: number | null;
  name: string;
  sectionsJson: string;
  aiInstruction: string | null;
  formatExample: string | null;
  isDefault: boolean;
  sortOrder: number;
}): MinutesTemplate {
  let sections: MinutesSection[] = [];
  try {
    const parsed = JSON.parse(raw.sectionsJson);
    if (Array.isArray(parsed)) sections = parsed;
  } catch { /* 깨진 값이면 빈 섹션으로 */ }
  return {
    id: raw.id,
    name: raw.name,
    sections,
    aiInstruction: raw.aiInstruction,
    formatExample: raw.formatExample,
    isDefault: raw.isDefault,
    sortOrder: raw.sortOrder,
  };
}
