"use client";

import { useRef, useEffect } from "react";
import { ChatMessage } from "./floatingChatTypes";

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

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSendMessage();
        }
    };

    return (
        <div className="flex flex-col h-full">
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
                    messages.map((message) => {
                        const isMyMessage = message.senderId === userId;
                        const isSystemMessage = message.type === "SYSTEM";

                        if (isSystemMessage) {
                            return (
                                <div key={message.id} className="flex justify-center">
                                    <p className="text-[11px] text-gray-400 italic">{message.content}</p>
                                </div>
                            );
                        }

                        if (message.isDeleted) {
                            return (
                                <div
                                    key={message.id}
                                    className={`flex ${isMyMessage ? "justify-end" : "justify-start"}`}
                                >
                                    <p className="text-[11px] text-gray-400 italic px-2 py-1">
                                        삭제된 메시지입니다
                                    </p>
                                </div>
                            );
                        }

                        return (
                            <div
                                key={message.id}
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
        </div>
    );
}
