export interface ChatRoom {
    id: number;
    name: string;
    description?: string;
    /** 서버는 메시지 전체를 준다 — 미리보기에는 displayContent("사진"/"동영상"/파일명)를 쓴다 */
    lastMessage?: {
        content: string;
        senderName: string;
        createdAt: string;
        displayContent?: string;
        type?: string;
        mediaType?: string;
        mimeType?: string;
        fileName?: string;
    } | null;
    lastMessageAt?: string;
    unreadCount: number;
    participantCount: number;
}

export interface ReactionSummary {
    emoji: string;
    count: number;
    userNames: string[];
    myReaction: boolean;
}

export interface ChatMessage {
    id: number;
    chatRoomId: number;
    senderId: string;
    senderName: string;
    senderPosition?: string;
    type: "TEXT" | "IMAGE" | "FILE" | "SYSTEM";
    content: string;
    fileUrl?: string;
    /** 목록에 그릴 축소본 — 기존 메시지엔 없을 수 있어 옵셔널 (그럴 땐 원본으로 대체) */
    thumbnailUrl?: string;
    fileName?: string;
    /** 서버가 판단한 첨부 종류 — 저장된 type은 그대로 두고 파생만 내려온다 (동영상도 type은 FILE) */
    mediaType?: "IMAGE" | "VIDEO" | "FILE";
    /** 대화 밖에서 이 메시지를 가리키는 한 줄 — 서버가 정리해 준 "사진"/"동영상"/파일명 */
    displayContent?: string;
    mimeType?: string;
    fileSize?: number;
    createdAt: string;
    isDeleted: boolean;
    /** 수정된 시각 — null/undefined면 한 번도 고치지 않은 메시지 */
    editedAt?: string | null;
    readCount: number;
    reactions?: ReactionSummary[];
    // 답글 관련
    replyToId?: number;
    replyToSenderName?: string;
    replyToContent?: string;
    replyToType?: string;
    /** 답글 미리보기용 — 원본이 동영상인지 사진인지 (없으면 replyToType으로 대체 판단) */
    replyToMediaType?: string;
}

export interface WebSocketMessage {
    type: "MESSAGE" | "TYPING" | "READ" | "JOIN" | "LEAVE" | "DELETE" | "EDIT";
    roomId: number;
    senderId?: string;
    senderName?: string;
    message?: ChatMessage;
    isTyping?: boolean;
}
