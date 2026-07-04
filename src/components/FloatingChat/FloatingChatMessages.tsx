"use client";

import { Fragment, useRef, useEffect, useState, useCallback } from "react";
import { FiSend, FiCornerUpLeft, FiPaperclip } from "react-icons/fi";
import { Text } from "@astryxdesign/core/Text";
import { Icon } from "@astryxdesign/core/Icon";
import { Button } from "@astryxdesign/core/Button";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Avatar } from "@astryxdesign/core/Avatar";
import { Spinner } from "@astryxdesign/core/Spinner";
import { ChatMessage, ReactionSummary } from "./floatingChatTypes";
import { fetchChatParticipants, toggleChatReaction } from '@/lib/apiService';

interface ChatParticipant {
    userId: string;
    userName: string;
    role?: string;
    joinedAt?: string;
}

const QUICK_EMOJIS = ["❤️", "👍", "😂", "😮", "😢", "✅"];

// 잔여 스타일용 색상 상수 (Astryx 컴포넌트로 표현 불가한 레이아웃/버블 색상)
const C = {
    border: "var(--color-border)",       // gray-200
    borderLight: 'var(--color-border)',  // gray-100
    bgGray50: 'var(--color-background-muted)',     // gray-50
    bubbleMine: "#0d9488",   // teal-600
    bubbleOther: 'var(--color-background-muted)',  // gray-100
    accent: "#0d9488",       // teal-600
};

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

    const fetchParticipants = useCallback(async () => {
        if (!roomId) return;
        setIsLoadingParticipants(true);
        try {
            const data = await fetchChatParticipants(roomId);
            const list = Array.isArray(data) ? data : (data.participants || data.content || data.data || []);
            setParticipants(list);
        } catch (error) {
            console.error("[FloatingChat] Error fetching participants:", error);
        } finally {
            setIsLoadingParticipants(false);
        }
    }, [roomId]);

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
        if (!userId) return;
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
            await toggleChatReaction(roomId, messageId, emoji);
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
            <div style={{ display: "flex", flexWrap: "wrap", gap: 'var(--spacing-1)', marginTop: 'var(--spacing-1)' }}>
                {message.reactions.map((reaction) => (
                    <button
                        key={reaction.emoji}
                        onClick={() => handleToggleReaction(message.id, reaction.emoji)}
                        title={reaction.userNames?.join(", ")}
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 'var(--spacing-0-5)',
                            padding: "1px 6px",
                            borderRadius: 'var(--radius-full)',
                            fontSize: 'var(--font-size-xs)',
                            cursor: "pointer",
                            transition: "background-color 150ms ease",
                            border: reaction.myReaction ? "1px solid #5eead4" : `1px solid ${C.border}`,
                            background: reaction.myReaction ? 'var(--color-background-blue)' : C.bgGray50,
                            color: reaction.myReaction ? 'var(--color-text-blue)' : 'var(--color-text-primary)',
                        }}
                    >
                        <span>{reaction.emoji}</span>
                        <span style={{ fontWeight: 'var(--font-weight-medium)' }}>{reaction.count}</span>
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
                style={{
                    padding: "4px 8px",
                    marginBottom: 'var(--spacing-1)',
                    borderRadius: 'var(--radius-none)',
                    borderLeft: isMyMessage ? "2px solid #5eead4" : `2px solid #9ca3af`,
                    background: isMyMessage ? "rgba(20,184,166,0.3)" : "#e5e7eb",
                    color: isMyMessage ? 'var(--color-text-teal)' : 'var(--color-text-primary)',
                }}
            >
                <Text type="supporting" color="inherit" weight="semibold" maxLines={1}>
                    {message.replyToSenderName}
                </Text>
                <div style={{ opacity: 0.8 }}>
                    <Text type="supporting" color="inherit" maxLines={1}>
                        {message.replyToType === "IMAGE" ? "📷 사진" : message.replyToType === "FILE" ? "📎 파일" : message.replyToContent}
                    </Text>
                </div>
            </div>
        );
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", position: "relative" }}>
            {/* Header */}
            <div
                style={{
                    padding: "10px 12px",
                    borderBottom: `1px solid ${C.border}`,
                    display: "flex",
                    alignItems: "center",
                    gap: 'var(--spacing-2)',
                    flexShrink: 0,
                }}
            >
                <Button
                    label="뒤로가기"
                    isIconOnly
                    variant="ghost"
                    size="sm"
                    icon={<Icon icon="chevronLeft" size="md" />}
                    onClick={onBack}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <Text type="body" weight="semibold" color="primary" maxLines={1}>{roomName}</Text>
                    <Text type="supporting" color="secondary">참여자 {participantCount}명</Text>
                </div>
                <Button
                    label="채팅방 정보"
                    isIconOnly
                    variant="ghost"
                    size="sm"
                    icon={<Icon icon="menu" size="md" />}
                    onClick={toggleDrawer}
                />
            </div>

            {/* Overlay for menus */}
            {(longPressMenuMessageId !== null || activeEmojiPickerMessageId !== null) && (
                <div style={{ position: "fixed", inset: 0, zIndex: 30 }} onClick={handleBackdropClick} />
            )}

            {/* Messages */}
            <div
                style={{
                    flex: 1,
                    overflowY: "auto",
                    padding: "8px 12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 'var(--spacing-2)',
                }}
            >
                {isLoadingMessages ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                        <Spinner aria-label="메시지 불러오는 중" />
                    </div>
                ) : messages.length === 0 ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                        <Text type="body" color="secondary">메시지가 없습니다</Text>
                    </div>
                ) : (
                    messages.map((message, index) => {
                        const isMyMessage = message.senderId === userId;
                        const isSystemMessage = message.type === "SYSTEM";
                        const showDateSeparator =
                            index === 0 ||
                            getDateKey(message.createdAt) !== getDateKey(messages[index - 1].createdAt);

                        const dateSeparator = showDateSeparator ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 'var(--spacing-3)', margin: "12px 0" }}>
                                <div style={{ flex: 1, height: 1, background: C.border }} />
                                <div style={{ whiteSpace: "nowrap" }}>
                                    <Text type="supporting" color="secondary" weight="medium">
                                        {formatDateSeparator(message.createdAt)}
                                    </Text>
                                </div>
                                <div style={{ flex: 1, height: 1, background: C.border }} />
                            </div>
                        ) : null;

                        if (isSystemMessage) {
                            return (
                                <Fragment key={message.id}>
                                    {dateSeparator}
                                    <div style={{ display: "flex", justifyContent: "center", fontStyle: "italic" }}>
                                        <Text type="supporting" color="secondary">{message.content}</Text>
                                    </div>
                                </Fragment>
                            );
                        }

                        if (message.isDeleted) {
                            return (
                                <Fragment key={message.id}>
                                    {dateSeparator}
                                    <div
                                        style={{
                                            display: "flex",
                                            justifyContent: isMyMessage ? "flex-end" : "flex-start",
                                            fontStyle: "italic",
                                        }}
                                    >
                                        <div style={{ padding: "4px 8px" }}>
                                            <Text type="supporting" color="secondary">삭제된 메시지입니다</Text>
                                        </div>
                                    </div>
                                </Fragment>
                            );
                        }

                        return (
                            <Fragment key={message.id}>
                                {dateSeparator}
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: isMyMessage ? "flex-end" : "flex-start",
                                        position: "relative",
                                    }}
                                >
                                    <div
                                        style={{
                                            maxWidth: "75%",
                                            display: "flex",
                                            flexDirection: "column",
                                            alignItems: isMyMessage ? "flex-end" : "flex-start",
                                        }}
                                    >
                                        {!isMyMessage && (
                                            <div style={{ marginBottom: 'var(--spacing-0-5)', marginLeft: 'var(--spacing-1)' }}>
                                                <Text type="supporting" color="secondary">{message.senderName}</Text>
                                                {message.senderPosition && (
                                                    <Text type="supporting" color="disabled">{` (${message.senderPosition})`}</Text>
                                                )}
                                            </div>
                                        )}
                                        <div style={{ display: "flex", alignItems: "flex-end", gap: 'var(--spacing-1)' }}>
                                            {isMyMessage && (
                                                <Text type="supporting" color="secondary">
                                                    {formatMessageTime(message.createdAt)}
                                                </Text>
                                            )}
                                            <div
                                                style={{
                                                    position: "relative",
                                                    padding: "6px 12px",
                                                    borderRadius: 'var(--radius-element)',
                                                    borderBottomRightRadius: isMyMessage ? 2 : 12,
                                                    borderBottomLeftRadius: isMyMessage ? 12 : 2,
                                                    whiteSpace: "pre-wrap",
                                                    wordBreak: "break-word",
                                                    background: isMyMessage ? C.bubbleMine : C.bubbleOther,
                                                    color: isMyMessage ? "#ffffff" : 'var(--color-text-primary)',
                                                }}
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
                                                        style={{ maxWidth: "100%", maxHeight: 160, borderRadius: 'var(--radius-none)', cursor: "pointer", display: "block" }}
                                                        onClick={() => window.open(message.fileUrl, "_blank")}
                                                    />
                                                ) : message.type === "FILE" && message.fileUrl ? (
                                                    <a
                                                        href={message.fileUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{
                                                            display: "inline-flex",
                                                            alignItems: "center",
                                                            gap: 'var(--spacing-1)',
                                                            textDecoration: "underline",
                                                            color: isMyMessage ? "#ffffff" : C.accent,
                                                        }}
                                                    >
                                                        <Icon icon={FiPaperclip} size="xsm" color="inherit" />
                                                        <Text type="supporting" color="inherit">{message.fileName || message.content}</Text>
                                                    </a>
                                                ) : (
                                                    <Text color="inherit">{message.content}</Text>
                                                )}
                                            </div>
                                            {!isMyMessage && (
                                                <Text type="supporting" color="secondary">
                                                    {formatMessageTime(message.createdAt)}
                                                </Text>
                                            )}
                                        </div>

                                        {/* 리액션 표시 */}
                                        {renderReactions(message)}

                                        {/* 롱프레스 메뉴 (답글 + 이모지) */}
                                        {longPressMenuMessageId === message.id && (
                                            <div
                                                style={{
                                                    position: "absolute",
                                                    zIndex: 40,
                                                    bottom: "100%",
                                                    marginBottom: 'var(--spacing-1)',
                                                    ...(isMyMessage ? { right: 0 } : { left: 0 }),
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        background: 'var(--color-background-card)',
                                                        borderRadius: 'var(--radius-element)',
                                                        boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)",
                                                        border: `1px solid ${C.border}`,
                                                        overflow: "hidden",
                                                    }}
                                                >
                                                    {/* 이모지 바 */}
                                                    <div style={{ display: "flex", gap: 'var(--spacing-0-5)', padding: "6px 8px", borderBottom: `1px solid ${C.borderLight}` }}>
                                                        {QUICK_EMOJIS.map((emoji) => (
                                                            <Button
                                                                key={emoji}
                                                                label={`${emoji} 반응 추가`}
                                                                isIconOnly
                                                                variant="ghost"
                                                                size="sm"
                                                                icon={<span style={{ fontSize: 'var(--font-size-lg)' }}>{emoji}</span>}
                                                                onClick={() => handleToggleReaction(message.id, emoji)}
                                                            />
                                                        ))}
                                                    </div>
                                                    {/* 답글 버튼 */}
                                                    <div style={{ padding: 'var(--spacing-1)' }}>
                                                        <Button
                                                            label="답장"
                                                            variant="ghost"
                                                            size="sm"
                                                            icon={<Icon icon={FiCornerUpLeft} size="sm" />}
                                                            onClick={() => handleReply(message)}
                                                        />
                                                    </div>
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
                <div
                    style={{
                        padding: "8px 12px",
                        borderTop: `1px solid ${C.borderLight}`,
                        background: C.bgGray50,
                        display: "flex",
                        alignItems: "center",
                        gap: 'var(--spacing-2)',
                    }}
                >
                    <div style={{ flex: 1, minWidth: 0, borderLeft: `2px solid ${C.accent}`, paddingLeft: 'var(--spacing-2)' }}>
                        <Text type="supporting" weight="semibold" color="accent" maxLines={1}>{replyTo.senderName}</Text>
                        <div>
                            <Text type="supporting" color="secondary" maxLines={1}>
                                {replyTo.type === "IMAGE" ? "📷 사진" : replyTo.type === "FILE" ? "📎 파일" : replyTo.content}
                            </Text>
                        </div>
                    </div>
                    <Button
                        label="답장 취소"
                        isIconOnly
                        variant="ghost"
                        size="sm"
                        icon={<Icon icon="close" size="sm" />}
                        onClick={() => setReplyTo(null)}
                    />
                </div>
            )}

            {/* Input Area */}
            <div style={{ padding: "8px 12px", borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
                <div style={{ display: "flex", gap: 'var(--spacing-2)', alignItems: "flex-end" }}>
                    <div style={{ flex: 1 }} onKeyDown={handleKeyDown}>
                        <TextInput
                            label="메시지 입력"
                            isLabelHidden
                            type="text"
                            value={messageInput}
                            onChange={(value) => onMessageInputChange(value)}
                            placeholder={replyTo ? `${replyTo.senderName}에게 답장...` : "메시지를 입력하세요..."}
                            isDisabled={isSendingMessage}
                        />
                    </div>
                    <Button
                        label="전송"
                        isIconOnly
                        variant="primary"
                        icon={<Icon icon={FiSend} size="sm" />}
                        onClick={handleSendMessage}
                        isDisabled={!messageInput.trim() || isSendingMessage}
                    />
                </div>
            </div>

            {/* Info Drawer */}
            {showDrawer && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        background: 'var(--color-background-card)',
                        zIndex: 20,
                        display: "flex",
                        flexDirection: "column",
                    }}
                >
                    {/* Drawer Header */}
                    <div
                        style={{
                            padding: "10px 12px",
                            borderBottom: `1px solid ${C.border}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            flexShrink: 0,
                        }}
                    >
                        <Text type="body" weight="semibold" color="primary">채팅방 정보</Text>
                        <Button
                            label="닫기"
                            isIconOnly
                            variant="ghost"
                            size="sm"
                            icon={<Icon icon="close" size="md" />}
                            onClick={() => setShowDrawer(false)}
                        />
                    </div>

                    <div style={{ flex: 1, overflowY: "auto" }}>
                        {/* 참여자 */}
                        <div style={{ padding: 'var(--spacing-3)', borderBottom: `1px solid ${C.borderLight}` }}>
                            <div style={{ marginBottom: 'var(--spacing-2)' }}>
                                <Text type="label" weight="semibold" color="primary">
                                    참여자 ({participants.length}명)
                                </Text>
                            </div>
                            {isLoadingParticipants ? (
                                <div style={{ display: "flex", justifyContent: "center", padding: "12px 0" }}>
                                    <Spinner size="sm" aria-label="참여자 불러오는 중" />
                                </div>
                            ) : participants.length > 0 ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 'var(--spacing-1)' }}>
                                    {participants.map((p, i) => (
                                        <div key={p.userId || i} style={{ display: "flex", alignItems: "center", gap: 'var(--spacing-2)', padding: "6px 0" }}>
                                            <Avatar name={p.userName || "?"} size="small" />
                                            <Text type="body" color="primary">{p.userName}</Text>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ textAlign: "center", padding: "12px 0" }}>
                                    <Text type="supporting" color="secondary">참여자 정보를 불러올 수 없습니다</Text>
                                </div>
                            )}
                        </div>

                        {/* 사진 */}
                        <div style={{ padding: 'var(--spacing-3)', borderBottom: `1px solid ${C.borderLight}` }}>
                            <div style={{ marginBottom: 'var(--spacing-2)' }}>
                                <Text type="label" weight="semibold" color="primary">
                                    사진 ({messages.filter(m => m.type === "IMAGE" && m.fileUrl).length})
                                </Text>
                            </div>
                            {messages.filter(m => m.type === "IMAGE" && m.fileUrl).length > 0 ? (
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 'var(--spacing-1-5)' }}>
                                    {messages.filter(m => m.type === "IMAGE" && m.fileUrl).map(m => (
                                        <img
                                            key={m.id}
                                            src={m.fileUrl!}
                                            alt={m.fileName || "사진"}
                                            style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", borderRadius: 'var(--radius-inner)', cursor: "pointer" }}
                                            onClick={() => window.open(m.fileUrl, "_blank")}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div style={{ textAlign: "center", padding: "12px 0" }}>
                                    <Text type="supporting" color="secondary">공유된 사진이 없습니다</Text>
                                </div>
                            )}
                        </div>

                        {/* 파일 */}
                        <div style={{ padding: 'var(--spacing-3)' }}>
                            <div style={{ marginBottom: 'var(--spacing-2)' }}>
                                <Text type="label" weight="semibold" color="primary">
                                    파일 ({messages.filter(m => m.type === "FILE" && m.fileUrl).length})
                                </Text>
                            </div>
                            {messages.filter(m => m.type === "FILE" && m.fileUrl).length > 0 ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 'var(--spacing-1)' }}>
                                    {messages.filter(m => m.type === "FILE" && m.fileUrl).map(m => (
                                        <a
                                            key={m.id}
                                            href={m.fileUrl!}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{ display: "flex", alignItems: "center", gap: 'var(--spacing-2)', padding: 'var(--spacing-2)', borderRadius: 'var(--radius-inner)', textDecoration: "none" }}
                                        >
                                            <div
                                                style={{
                                                    width: 28,
                                                    height: 28,
                                                    background: C.borderLight,
                                                    borderRadius: 'var(--radius-inner)',
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    flexShrink: 0,
                                                }}
                                            >
                                                <Icon icon={FiPaperclip} size="sm" color="secondary" />
                                            </div>
                                            <div style={{ minWidth: 0, flex: 1 }}>
                                                <Text type="supporting" color="primary" maxLines={1}>{m.fileName || m.content}</Text>
                                                <Text type="supporting" color="secondary">{formatMessageTime(m.createdAt)}</Text>
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ textAlign: "center", padding: "12px 0" }}>
                                    <Text type="supporting" color="secondary">공유된 파일이 없습니다</Text>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
