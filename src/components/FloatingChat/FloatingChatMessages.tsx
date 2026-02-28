"use client";

import { Fragment, useRef, useEffect, useState, useCallback } from "react";
import { ChatMessage } from "./floatingChatTypes";

interface ChatParticipant {
    userId: string;
    userName: string;
    role?: string;
    joinedAt?: string;
}

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
    onSendMessage: () => void;
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
}: FloatingChatMessagesProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [showDrawer, setShowDrawer] = useState(false);
    const [participants, setParticipants] = useState<ChatParticipant[]>([]);
    const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);

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

    // 방이 바뀌면 드로어 닫기
    useEffect(() => {
        setShowDrawer(false);
    }, [roomId]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSendMessage();
        }
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

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
                {isLoadingMessages ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
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
                                    className={`flex ${isMyMessage ? "justify-end" : "justify-start"}`}
                                >
                                    <div className={`max-w-[75%] ${isMyMessage ? "items-end" : "items-start"} flex flex-col`}>
                                        {!isMyMessage && (
                                            <p className="text-[11px] text-gray-500 mb-0.5 ml-1">{message.senderName}</p>
                                        )}
                                        <div className="flex items-end gap-1">
                                            {isMyMessage && (
                                                <span className="text-[10px] text-gray-400">
                                                    {formatMessageTime(message.createdAt)}
                                                </span>
                                            )}
                                            <div
                                                className={`px-3 py-1.5 rounded-xl text-sm ${
                                                    isMyMessage
                                                        ? "bg-blue-600 text-white rounded-br-sm"
                                                        : "bg-gray-100 text-gray-900 rounded-bl-sm"
                                                }`}
                                            >
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
                                                            isMyMessage ? "text-white" : "text-blue-600"
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
                                    </div>
                                </div>
                            </Fragment>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="px-3 py-2 border-t border-gray-200 flex-shrink-0">
                <div className="flex gap-2 items-end">
                    <input
                        type="text"
                        value={messageInput}
                        onChange={(e) => onMessageInputChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="메시지를 입력하세요..."
                        disabled={isSendingMessage}
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
                    />
                    <button
                        onClick={onSendMessage}
                        disabled={!messageInput.trim() || isSendingMessage}
                        className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex-shrink-0"
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
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                                </div>
                            ) : participants.length > 0 ? (
                                <div className="space-y-1">
                                    {participants.map((p, i) => (
                                        <div key={p.userId || i} className="flex items-center gap-2 py-1.5">
                                            <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                                <span className="text-xs font-medium text-blue-600">
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
