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
    fileName?: string;
    createdAt: string;
    isDeleted: boolean;
    readCount: number;
    reactions?: ReactionSummary[];
    // 답글 관련
    replyToId?: number;
    replyToSenderName?: string;
    replyToContent?: string;
    replyToType?: string;
}

export interface WebSocketMessage {
    type: "MESSAGE" | "TYPING" | "READ" | "JOIN" | "LEAVE";
    roomId: number;
    senderId?: string;
    senderName?: string;
    message?: ChatMessage;
    isTyping?: boolean;
}
