export interface ChatRoom {
    id: number;
    name: string;
    description?: string;
    lastMessage?: { content: string; senderName: string; createdAt: string } | null;
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
    mimeType?: string;
    fileSize?: number;
    createdAt: string;
    isDeleted: boolean;
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
    type: "MESSAGE" | "TYPING" | "READ" | "JOIN" | "LEAVE" | "DELETE";
    roomId: number;
    senderId?: string;
    senderName?: string;
    message?: ChatMessage;
    isTyping?: boolean;
}
