"use client";

import { Fragment, useRef, useEffect, useState, useCallback } from "react";
import { ChatMessage, ReactionSummary } from "./floatingChatTypes";

interface ChatParticipant {
    userId: string;
    userName: string;
    role?: string;
    joinedAt?: string;
}

const QUICK_EMOJIS = ["❤️", "👍", "😂", "😮", "😢", "✅"];

function getDateKey(dateStr: string): string {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateSeparator(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.round((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "오늘";
    if (diffDays === 1) return "어제";
    if (date.getFullYear() === now.getFullYear()) {
        return `${date.getMonth() + 1}월 ${date.getDate()}일`;
    }
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

interface FloatingChatMessagesProps {
    roomId: number;
    roomName: string;
    participantCount: number;
    messages: ChatMessage[];
    isLoadingMessages: boolean;
    isSendingMessage: boolean;
    userId: string;
    messageInput: string;
    onMessageInputChange: (value: string) => void;
    onBack: () => void;
    onSendMessage: (replyToId?: number) => void;
    onToggleReaction?: (messageId: number, emoji: string) => void;
    onMessagesUpdate?: (messages: ChatMessage[]) => void;
}

function formatMessageTime(timestamp: string) {
    const date = new Date(timestamp);
    const hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "오후" : "오전";
    const displayHours = hours % 12 || 12;
    return `${ampm} ${displayHours}:${minutes}`;
}

export function FloatingChatMessages({
    roomId,
    roomName,
    participantCount,
    messages,
    isLoadingMessages,
    isSendingMessage,
    userId,
    messageInput,
    onMessageInputChange,
    onBack,
    onSendMessage,
    onToggleReaction,
    onMessagesUpdate,
}: FloatingChatMessagesProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [showDrawer, setShowDrawer] = useState(false);
    const [participants, setParticipants] = useState<ChatParticipant[]>([]);
    const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);

    // 리액션 관련
    const [activeEmojiPickerMessageId, setActiveEmojiPickerMessageId] = useState<number | null>(null);

    // 답글 관련
    const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);

    // 꾹 누르기(롱프레스) 관련
    const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
    const [longPressMenuMessageId, setLongPressMenuMessageId] = useState<number | null>(null);

    const authToken = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;

    const fetchParticipants = useCallback(async () => {
        if (!authToken || !roomId) return;
        setIsLoadingParticipants(true);
        try {
            const response = await fetch(`/api/v1/chat/rooms/${roomId}/participants`, {
                headers: { Authorization: `Bearer ${authToken}` },
            });
            if (!response.ok) throw new Error("Failed to fetch participants");
            const data = await response.json();
            const list = Array.isArray(data) ? data : (data.participants || data.content || data.data || []);
            setParticipants(list);
        } catch (error) {
            console.error("[FloatingChat] Error fetching participants:", error);
        } finally {
            setIsLoadingParticipants(false);
        }
    }, [authToken, roomId]);

    const toggleDrawer = () => {
        if (!showDrawer) {
            fetchParticipants();
        }
        setShowDrawer(!showDrawer);
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        setShowDrawer(false);
        setReplyTo(null);
        setLongPressMenuMessageId(null);
        setActiveEmojiPickerMessageId(null);
    }, [roomId]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleSendMessage = () => {
        onSendMessage(replyTo?.id);
        setReplyTo(null);
    };

    // 리액션 토글 (로컬 + API)
    const handleToggleReaction = async (messageId: number, emoji: string) => {
        if (!authToken || !userId) return;
        const userName = typeof window !== "undefined" ? localStorage.getItem("userName") : null;

        setActiveEmojiPickerMessageId(null);
        setLongPressMenuMessageId(null);

        // 낙관적 업데이트
        if (onMessagesUpdate) {
            const updated = messages.map(msg => {
                if (msg.id !== messageId) return msg;
                const reactions = [...(msg.reactions || [])];
                const existing = reactions.find(r => r.emoji === emoji);
                if (existing?.myReaction) {
                    if (existing.count <= 1) {
                        return { ...msg, reactions: reactions.filter(r => r.emoji !== emoji) };
                    }
                    return {
                        ...msg,
                        reactions: reactions.map(r =>
                            r.emoji === emoji ? { ...r, count: r.count - 1, myReaction: false } : r
                        ),
                    };
                } else if (existing) {
                    return {
                        ...msg,
                        reactions: reactions.map(r =>
                            r.emoji === emoji ? { ...r, count: r.count + 1, myReaction: true } : r
                        ),
                    };
                } else {
                    return {
                        ...msg,
                        reactions: [...reactions, { emoji, count: 1, userNames: [userName || ""], myReaction: true }],
                    };
                }
            });
            onMessagesUpdate(updated);
        }

        // API 호출
        try {
            await fetch(`/api/v1/chat/rooms/${roomId}/messages/${messageId}/reactions`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${authToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ userId, userName, emoji }),
            });
        } catch (error) {
            console.error("[FloatingChat] Error toggling reaction:", error);
        }

        if (onToggleReaction) {
            onToggleReaction(messageId, emoji);
        }
    };

    // 롱프레스 핸들러
    const handleTouchStart = (messageId: number) => {
        longPressTimerRef.current = setTimeout(() => {
            setLongPressMenuMessageId(messageId);
        }, 500);
    };

    const handleTouchEnd = () => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    };

    const handleReply = (message: ChatMessage) => {
        setReplyTo(message);
        setLongPressMenuMessageId(null);
    };

    // 메뉴 외부 클릭 시 닫기
    const handleBackdropClick = () => {
        setLongPressMenuMessageId(null);
        setActiveEmojiPickerMessageId(null);
    };

    // 리액션 렌더링
    const renderReactions = (message: ChatMessage) => {
        if (!message.reactions || message.reactions.length === 0) return null;
        return (
            <div className="flex flex-wrap gap-1 mt-1">
                {message.reactions.map((reaction) => (
                    <button
                        key={reaction.emoji}
                        onClick={() => handleToggleReaction(message.id, reaction.emoji)}
                        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] border transition-colors ${
                            reaction.myReaction
                                ? "bg-blue-50 border-teal-300 text-blue-700"
                                : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                        }`}
                        title={reaction.userNames?.join(", ")}
                    >
                        <span>{reaction.emoji}</span>
                        <span className="font-medium">{reaction.count}</span>
                    </button>
                ))}
            </div>
        );
    };

    // 답글 미리보기 (메시지 버블 안)
    const renderReplyPreview = (message: ChatMessage) => {
        if (!message.replyToId) return null;
        const isMyMessage = message.senderId === userId;
        return (
            <div
                className={`text-[11px] px-2 py-1 mb-1 rounded border-l-2 ${
                    isMyMessage
                        ? "bg-teal-500/30 border-teal-300 text-teal-100"
                        : "bg-gray-200 border-gray-400 text-gray-600"
                }`}
            >
                <p className="font-semibold truncate">{message.replyToSenderName}</p>
                <p className="truncate opacity-80">
                    {message.replyToType === "IMAGE" ? "📷 사진" : message.replyToType === "FILE" ? "📎 파일" : message.replyToContent}
                </p>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full relative">
            {/* Header */}
            <div className="px-3 py-2.5 border-b border-gray-200 flex items-center gap-2 flex-shrink-0">
                <button
                    onClick={onBack}
                    className="p-1 rounded-md hover:bg-gray-100 transition-colors"
                    aria-label="뒤로가기"
                >
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900 truncate">{roomName}</h3>
                    <p className="text-[11px] text-gray-400">참여자 {participantCount}명</p>
                </div>
                <button
                    onClick={toggleDrawer}
                    className="p-1 rounded-md hover:bg-gray-100 transition-colors"
                    aria-label="채팅방 정보"
                >
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                </button>
            </div>

            {/* Overlay for menus */}
            {(longPressMenuMessageId !== null || activeEmojiPickerMessageId !== null) && (
                <div className="fixed inset-0 z-30" onClick={handleBackdropClick} />
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
                {isLoadingMessages ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-500" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                        메시지가 없습니다
                    </div>
                ) : (
                    messages.map((message, index) => {
                        const isMyMessage = message.senderId === userId;
                        const isSystemMessage = message.type === "SYSTEM";
                        const showDateSeparator =
                            index === 0 ||
                            getDateKey(message.createdAt) !== getDateKey(messages[index - 1].createdAt);

                        const dateSeparator = showDateSeparator ? (
                            <div className="flex items-center gap-3 my-3">
                                <div className="flex-1 h-px bg-gray-200" />
                                <span className="text-xs text-gray-400 font-medium whitespace-nowrap">
                                    {formatDateSeparator(message.createdAt)}
                                </span>
                                <div className="flex-1 h-px bg-gray-200" />
                            </div>
                        ) : null;

                        if (isSystemMessage) {
                            return (
                                <Fragment key={message.id}>
                                    {dateSeparator}
                                    <div className="flex justify-center">
                                        <p className="text-[11px] text-gray-400 italic">{message.content}</p>
                                    </div>
                                </Fragment>
                            );
                        }

                        if (message.isDeleted) {
                            return (
                                <Fragment key={message.id}>
                                    {dateSeparator}
                                    <div
                                        className={`flex ${isMyMessage ? "justify-end" : "justify-start"}`}
                                    >
                                        <p className="text-[11px] text-gray-400 italic px-2 py-1">
                                            삭제된 메시지입니다
                                        </p>
                                    </div>
                                </Fragment>
                            );
                        }

                        return (
                            <Fragment key={message.id}>
                                {dateSeparator}
                                <div
                                    className={`flex ${isMyMessage ? "justify-end" : "justify-start"} relative`}
                                >
                                    <div className={`max-w-[75%] ${isMyMessage ? "items-end" : "items-start"} flex flex-col`}>
                                        {!isMyMessage && (
                                            <p className="text-[11px] text-gray-500 mb-0.5 ml-1">
                                                {message.senderName}
                                                {message.senderPosition && (
                                                    <span className="text-gray-400 ml-1">({message.senderPosition})</span>
                                                )}
                                            </p>
                                        )}
                                        <div className="flex items-end gap-1">
                                            {isMyMessage && (
                                                <span className="text-[10px] text-gray-400">
                                                    {formatMessageTime(message.createdAt)}
                                                </span>
                                            )}
                                            <div
                                                className={`relative px-3 py-1.5 rounded-xl text-sm ${
                                                    isMyMessage
                                                        ? "bg-teal-600 text-white rounded-br-sm"
                                                        : "bg-gray-100 text-gray-900 rounded-bl-sm"
                                                }`}
                                                onTouchStart={() => handleTouchStart(message.id)}
                                                onTouchEnd={handleTouchEnd}
                                                onTouchCancel={handleTouchEnd}
                                                onContextMenu={(e) => {
                                                    e.preventDefault();
                                                    setLongPressMenuMessageId(message.id);
                                                }}
                                            >
                                                {/* 답글 원본 미리보기 */}
                                                {renderReplyPreview(message)}

                                                {message.type === "IMAGE" && message.fileUrl ? (
                                                    <img
                                                        src={message.fileUrl}
                                                        alt={message.fileName || "이미지"}
                                                        className="max-w-full max-h-40 rounded cursor-pointer"
                                                        style={{ display: "block" }}
                                                        onClick={() => window.open(message.fileUrl, "_blank")}
                                                    />
                                                ) : message.type === "FILE" && message.fileUrl ? (
                                                    <a
                                                        href={message.fileUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className={`text-xs underline flex items-center gap-1 ${
                                                            isMyMessage ? "text-white" : "text-teal-600"
                                                        }`}
                                                    >
                                                        <span>📎</span> {message.fileName || message.content}
                                                    </a>
                                                ) : (
                                                    <p className="text-[13px] whitespace-pre-wrap break-words leading-relaxed">
                                                        {message.content}
                                                    </p>
                                                )}
                                            </div>
                                            {!isMyMessage && (
                                                <span className="text-[10px] text-gray-400">
                                                    {formatMessageTime(message.createdAt)}
                                                </span>
                                            )}
                                        </div>

                                        {/* 리액션 표시 */}
                                        {renderReactions(message)}

                                        {/* 롱프레스 메뉴 (답글 + 이모지) */}
                                        {longPressMenuMessageId === message.id && (
                                            <div
                                                className={`absolute z-40 ${
                                                    isMyMessage ? "right-0" : "left-0"
                                                } bottom-full mb-1`}
                                            >
                                                <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                                                    {/* 이모지 바 */}
                                                    <div className="flex gap-0.5 px-2 py-1.5 border-b border-gray-100">
                                                        {QUICK_EMOJIS.map((emoji) => (
                                                            <button
                                                                key={emoji}
                                                                onClick={() => handleToggleReaction(message.id, emoji)}
                                                                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-lg"
                                                            >
                                                                {emoji}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    {/* 답글 버튼 */}
                                                    <button
                                                        onClick={() => handleReply(message)}
                                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                                        </svg>
                                                        답장
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Fragment>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* 답글 미리보기 바 */}
            {replyTo && (
                <div className="px-3 py-2 border-t border-gray-100 bg-gray-50 flex items-center gap-2">
                    <div className="flex-1 min-w-0 border-l-2 border-teal-500 pl-2">
                        <p className="text-[11px] font-semibold text-teal-600 truncate">{replyTo.senderName}</p>
                        <p className="text-[11px] text-gray-500 truncate">
                            {replyTo.type === "IMAGE" ? "📷 사진" : replyTo.type === "FILE" ? "📎 파일" : replyTo.content}
                        </p>
                    </div>
                    <button
                        onClick={() => setReplyTo(null)}
                        className="p-1 rounded hover:bg-gray-200 transition-colors flex-shrink-0"
                        aria-label="답장 취소"
                    >
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            )}

            {/* Input Area */}
            <div className="px-3 py-2 border-t border-gray-200 flex-shrink-0">
                <div className="flex gap-2 items-end">
                    <input
                        type="text"
                        value={messageInput}
                        onChange={(e) => onMessageInputChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={replyTo ? `${replyTo.senderName}에게 답장...` : "메시지를 입력하세요..."}
                        disabled={isSendingMessage}
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50"
                    />
                    <button
                        onClick={handleSendMessage}
                        disabled={!messageInput.trim() || isSendingMessage}
                        className="p-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                        aria-label="전송"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Info Drawer */}
            {showDrawer && (
                <div className="absolute inset-0 bg-white z-20 flex flex-col">
                    {/* Drawer Header */}
                    <div className="px-3 py-2.5 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
                        <h3 className="text-sm font-semibold text-gray-900">채팅방 정보</h3>
                        <button
                            onClick={() => setShowDrawer(false)}
                            className="p-1 rounded-md hover:bg-gray-100 transition-colors"
                            aria-label="닫기"
                        >
                            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {/* 참여자 */}
                        <div className="p-3 border-b border-gray-100">
                            <h4 className="text-xs font-semibold text-gray-700 mb-2">
                                참여자 ({participants.length}명)
                            </h4>
                            {isLoadingParticipants ? (
                                <div className="flex justify-center py-3">
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-teal-500"></div>
                                </div>
                            ) : participants.length > 0 ? (
                                <div className="space-y-1">
                                    {participants.map((p, i) => (
                                        <div key={p.userId || i} className="flex items-center gap-2 py-1.5">
                                            <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                                <span className="text-xs font-medium text-teal-600">
                                                    {p.userName?.charAt(0) || "?"}
                                                </span>
                                            </div>
                                            <span className="text-sm text-gray-900">{p.userName}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-gray-400 text-center py-3">참여자 정보를 불러올 수 없습니다</p>
                            )}
                        </div>

                        {/* 사진 */}
                        <div className="p-3 border-b border-gray-100">
                            <h4 className="text-xs font-semibold text-gray-700 mb-2">
                                사진 ({messages.filter(m => m.type === "IMAGE" && m.fileUrl).length})
                            </h4>
                            {messages.filter(m => m.type === "IMAGE" && m.fileUrl).length > 0 ? (
                                <div className="grid grid-cols-3 gap-1.5">
                                    {messages.filter(m => m.type === "IMAGE" && m.fileUrl).map(m => (
                                        <img
                                            key={m.id}
                                            src={m.fileUrl!}
                                            alt={m.fileName || "사진"}
                                            className="w-full aspect-square object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                                            onClick={() => window.open(m.fileUrl, "_blank")}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-gray-400 text-center py-3">공유된 사진이 없습니다</p>
                            )}
                        </div>

                        {/* 파일 */}
                        <div className="p-3">
                            <h4 className="text-xs font-semibold text-gray-700 mb-2">
                                파일 ({messages.filter(m => m.type === "FILE" && m.fileUrl).length})
                            </h4>
                            {messages.filter(m => m.type === "FILE" && m.fileUrl).length > 0 ? (
                                <div className="space-y-1">
                                    {messages.filter(m => m.type === "FILE" && m.fileUrl).map(m => (
                                        <a
                                            key={m.id}
                                            href={m.fileUrl!}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                                        >
                                            <div className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                                <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                                </svg>
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs text-gray-900 truncate">{m.fileName || m.content}</p>
                                                <p className="text-[10px] text-gray-400">{formatMessageTime(m.createdAt)}</p>
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-gray-400 text-center py-3">공유된 파일이 없습니다</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
