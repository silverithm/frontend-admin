"use client";

import { Fragment, useRef, useEffect, useState, useCallback, useMemo, type ReactNode } from "react";
import { FiSend, FiCornerUpLeft, FiPaperclip, FiTrash2 } from "react-icons/fi";
import { Text } from "@astryxdesign/core/Text";
import { Icon } from "@astryxdesign/core/Icon";
import { Button } from "@astryxdesign/core/Button";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Avatar } from "@astryxdesign/core/Avatar";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Layout, LayoutContent } from "@astryxdesign/core/Layout";
import { Loading } from "@/components/Loading";
import DocumentViewerModal from "@/components/DocumentViewerModal";
import { ChatMessage, ReactionSummary } from "./floatingChatTypes";
import { fetchChatParticipants, toggleChatReaction, uploadChatFile, deleteChatMessage } from '@/lib/apiService';
import { MAX_CHAT_FILE_SIZE, isViewableDocument } from '@/lib/chatAttachments';

interface ChatParticipant {
    userId: string;
    userName: string;
    role?: string;
    joinedAt?: string;
    profileImageUrl?: string;
}

const QUICK_EMOJIS = ["❤️", "👍", "😂", "😮", "😢", "✅"];

// 잔여 스타일용 색상 상수 (Astryx 컴포넌트로 표현 불가한 레이아웃/버블 색상)
const C = {
    border: "var(--color-border)",       // gray-200
    borderLight: 'var(--color-border)',  // gray-100
    bgGray50: 'var(--color-background-muted)',     // gray-50
    bubbleMine: 'var(--color-icon-teal)',   // teal-600
    bubbleOther: 'var(--color-background-muted)',  // gray-100
    accent: 'var(--color-icon-teal)',       // teal-600
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
    /**
     * 머리줄 오른쪽, '채팅방 정보' 왼쪽에 끼워 넣을 버튼.
     * 관리자 셸의 도크는 여기에 '크게 보기'를 넣는다 — 예전처럼 머리 위에 절대좌표로 얹으면
     * 다른 버튼들과 높이가 어긋난다. 안 넘기면 아무것도 안 그린다(직원 플로팅 채팅).
     */
    headerAction?: ReactNode;
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
    headerAction,
}: FloatingChatMessagesProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [showDrawer, setShowDrawer] = useState(false);
    const [participants, setParticipants] = useState<ChatParticipant[]>([]);
    const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);

    // 리액션 관련
    const [activeEmojiPickerMessageId, setActiveEmojiPickerMessageId] = useState<number | null>(null);

    // 답글 관련
    const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);

    /** 삭제를 누른 메시지 — 같은 메뉴 안에서 한 번 더 확인받는다 */
    const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

    // 꾹 누르기(롱프레스) 관련
    const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
    const [longPressMenuMessageId, setLongPressMenuMessageId] = useState<number | null>(null);

    // 파일·사진 첨부 관련 — 관리자 채팅 탭과 같은 업로드·뷰어를 쓴다
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploadingFile, setIsUploadingFile] = useState(false);
    /** 전송 실패 안내 — 이 패널엔 토스트가 없어 입력창 위에 한 줄로 띄운다 */
    const [uploadError, setUploadError] = useState<string | null>(null);
    /** 문서는 이 창 안에서 바로 열어본다 (이미지는 아래 확대 보기로) */
    const [viewerFile, setViewerFile] = useState<{ fileUrl: string; fileName: string } | null>(null);
    const [imagePreview, setImagePreview] = useState<{ fileUrl: string; fileName: string } | null>(null);
    /** 파일을 창 위로 끌어왔을 때만 안내를 띄운다 */
    const [isDraggingFile, setIsDraggingFile] = useState(false);
    /** 자식 위를 지날 때마다 dragleave가 튀어서, 진입 횟수를 세어 상쇄한다 */
    const dragDepthRef = useRef(0);

    // 열린 메시지 메뉴는 Escape로 닫는다.
    // 메뉴 요소에 onKeyDown을 붙이면 안 된다 — 메뉴를 연 직후 포커스는 그것을 연 버튼에 남아 있어
    // (키보드 사용자의 정상 경로) 메뉴로 이벤트가 오지 않는다.
    useEffect(() => {
        if (longPressMenuMessageId === null) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setLongPressMenuMessageId(null);
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [longPressMenuMessageId]);

    // 메뉴가 닫히면 삭제 확인도 푼다 — 안 그러면 다음에 연 메뉴가 확인 상태로 시작한다
    useEffect(() => {
        if (longPressMenuMessageId === null) setPendingDeleteId(null);
    }, [longPressMenuMessageId]);

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

    // 메시지 발신자 아바타 표시용 — 참여자의 profileImageUrl을 미리 조회해둔다
    useEffect(() => {
        fetchParticipants();
    }, [fetchParticipants]);

    const participantAvatarMap = useMemo(() => {
        const map = new Map<string, string | undefined>();
        participants.forEach((p) => map.set(p.userId, p.profileImageUrl));
        return map;
    }, [participants]);

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
        setUploadError(null);
        setViewerFile(null);
        setImagePreview(null);
        setIsDraggingFile(false);
        dragDepthRef.current = 0;
    }, [roomId]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        // 한글 조합 중의 Enter는 '조합 확정'이지 전송이 아니다 (거르지 않으면 마지막 글자가 또 나간다)
        if (e.nativeEvent.isComposing) return;
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleSendMessage = () => {
        onSendMessage(replyTo?.id);
        setReplyTo(null);
    };

    // 업로드는 비동기라 그 사이 소켓으로 새 메시지가 들어올 수 있다 — 항상 최신 목록에 이어 붙인다
    const messagesRef = useRef(messages);
    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    /**
     * 파일·사진 전송.
     * 관리자 채팅 탭과 같은 채팅 전용 업로드 엔드포인트를 쓴다 — 서버가 S3 저장부터
     * 메시지 생성, 열람 가능한 절대 URL 변환까지 처리해 웹·앱이 같은 형식을 갖는다.
     */
    const sendFileMessage = async (file: File) => {
        if (!roomId || !userId) return;
        if (file.size > MAX_CHAT_FILE_SIZE) {
            setUploadError(`파일은 ${MAX_CHAT_FILE_SIZE / (1024 * 1024)}MB까지 보낼 수 있습니다`);
            return;
        }

        const userName = (typeof window !== "undefined" ? localStorage.getItem("userName") : null) || "";
        setUploadError(null);
        setIsUploadingFile(true);
        try {
            const response = await uploadChatFile(roomId, file, userId, userName);
            const newMessage: ChatMessage = response.message || response;
            if (onMessagesUpdate) {
                const current = messagesRef.current;
                if (!current.some(m => m.id === newMessage.id)) {
                    onMessagesUpdate([...current, newMessage]);
                }
            }
            setReplyTo(null);
            setTimeout(scrollToBottom, 100);
        } catch (error) {
            console.error("[FloatingChat] 파일 전송 실패:", error);
            setUploadError("파일 전송에 실패했습니다. 다시 시도해주세요");
        } finally {
            setIsUploadingFile(false);
        }
    };

    /** 여러 개를 한 번에 떨어뜨려도 보낸 순서가 뒤섞이지 않게 하나씩 올린다 */
    const sendFiles = async (files: File[]) => {
        for (const file of files) {
            await sendFileMessage(file);
        }
    };

    const handleFilePick = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        // 같은 파일을 연달아 보낼 수 있게 값을 비운다
        event.target.value = "";
        if (file) sendFileMessage(file);
    };

    /** 창 위에 파일을 떨어뜨려 보내기 */
    const handleDragEnter = (event: React.DragEvent) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        dragDepthRef.current += 1;
        setIsDraggingFile(true);
    };

    const handleDragOver = (event: React.DragEvent) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        // 막지 않으면 브라우저가 파일을 새 탭으로 열어버린다
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
    };

    const handleDragLeave = () => {
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
        if (dragDepthRef.current === 0) setIsDraggingFile(false);
    };

    const handleDrop = (event: React.DragEvent) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        dragDepthRef.current = 0;
        setIsDraggingFile(false);
        const files = Array.from(event.dataTransfer.files);
        if (files.length > 0) sendFiles(files);
    };

    /** 캡쳐한 화면을 Cmd+V로 바로 보내기 — 클립보드에 파일이 있을 때만 가로챈다 */
    const handlePaste = (event: React.ClipboardEvent) => {
        const files = Array.from(event.clipboardData.files);
        if (files.length === 0) return;
        event.preventDefault();
        sendFiles(files);
    };

    /** 받은 첨부 열기 — 사진은 확대 보기, 열람 가능한 문서는 뷰어, 나머지는 새 탭 */
    const openAttachment = (message: ChatMessage) => {
        if (!message.fileUrl) return;
        if (message.type === "IMAGE") {
            setImagePreview({ fileUrl: message.fileUrl, fileName: message.fileName || "이미지" });
        } else if (isViewableDocument(message.fileName)) {
            setViewerFile({ fileUrl: message.fileUrl, fileName: message.fileName || "문서" });
        } else {
            window.open(message.fileUrl, "_blank", "noopener");
        }
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

    /**
     * 내 메시지 삭제. 서버는 지우지 않고 '삭제됨'으로만 바꾸므로(소프트 삭제)
     * 화면에서도 지우지 않고 그 자리에 "삭제된 메시지입니다"를 남긴다.
     */
    const handleDeleteMessage = async (messageId: number) => {
        setLongPressMenuMessageId(null);
        setPendingDeleteId(null);

        const before = messages;
        // 낙관적 업데이트 — 왕복을 기다리는 동안 눌린 게 반영 안 된 것처럼 보이지 않게
        onMessagesUpdate?.(messages.map(msg => (msg.id === messageId ? { ...msg, isDeleted: true } : msg)));
        try {
            await deleteChatMessage(roomId, messageId);
        } catch (error) {
            console.error("[FloatingChat] 메시지 삭제 실패:", error);
            onMessagesUpdate?.(before);
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
                        className="carev-reaction-badge"
                        onClick={() => handleToggleReaction(message.id, reaction.emoji)}
                        title={reaction.userNames?.join(", ")}
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 'var(--spacing-0-5)',
                            padding: "1px var(--spacing-1-5)",
                            borderRadius: 'var(--radius-full)',
                            fontSize: 'var(--font-size-xs)',
                            cursor: "pointer",
                            transition: 'background-color var(--duration-fast-min) var(--ease-standard)',
                            border: reaction.myReaction ? "1px solid var(--color-border-teal)" : `1px solid ${C.border}`,
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
                    padding: "var(--spacing-1) var(--spacing-2)",
                    marginBottom: 'var(--spacing-1)',
                    borderRadius: 'var(--radius-none)',
                    borderLeft: isMyMessage ? "2px solid var(--color-border-teal)" : `2px solid var(--color-border-emphasized)`,
                    background: isMyMessage ? 'var(--color-background-teal)' : 'var(--color-border)',
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
        <div
            style={{ display: "flex", flexDirection: "column", height: "100%", position: "relative" }}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onPaste={handlePaste}
        >
            {/* 파일을 끌어온 동안만 덮는 안내 — 마우스 이벤트는 통과시켜 drop이 아래에서 잡히게 둔다 */}
            {isDraggingFile && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        zIndex: 40,
                        pointerEvents: "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 'var(--spacing-3)',
                        textAlign: "center",
                        background: 'var(--color-background-teal)',
                        border: `2px dashed ${C.accent}`,
                        borderRadius: 'var(--radius-container)',
                    }}
                >
                    <Text type="body" weight="semibold" color="accent">여기에 놓으면 바로 보냅니다</Text>
                </div>
            )}

            {/* Header */}
            <div
                style={{
                    padding: "10px var(--spacing-3)",
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
                {headerAction}
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
                    padding: "var(--spacing-2) var(--spacing-3)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 'var(--spacing-2)',
                }}
            >
                {isLoadingMessages ? (
                    <Loading height="100%" label="메시지를 불러오는 중..." />
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
                            <div style={{ display: "flex", alignItems: "center", gap: 'var(--spacing-3)', margin: "var(--spacing-3) 0" }}>
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
                                        <div style={{ padding: "var(--spacing-1) var(--spacing-2)" }}>
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
                                        alignItems: "flex-end",
                                        gap: 'var(--spacing-1-5)',
                                        position: "relative",
                                    }}
                                >
                                    {!isMyMessage && (
                                        <Avatar
                                            src={participantAvatarMap.get(message.senderId)}
                                            name={message.senderName || "?"}
                                            size="xsmall"
                                        />
                                    )}
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
                                                <>
                                                    {/* 롱프레스·우클릭의 유일한 대안 — 키보드로 답장/반응 메뉴에 닿을 수 있어야 한다 */}
                                                    <Button
                                                        label="메시지 옵션"
                                                        isIconOnly
                                                        variant="ghost"
                                                        size="sm"
                                                        icon={<Icon icon="moreHorizontal" size="sm" />}
                                                        onClick={() => setLongPressMenuMessageId(longPressMenuMessageId === message.id ? null : message.id)}
                                                    />
                                                    <Text type="supporting" color="secondary">
                                                        {formatMessageTime(message.createdAt)}
                                                    </Text>
                                                </>
                                            )}
                                            <div
                                                style={{
                                                    position: "relative",
                                                    padding: "var(--spacing-1-5) var(--spacing-3)",
                                                    borderRadius: 'var(--radius-element)',
                                                    borderBottomRightRadius: isMyMessage ? 2 : 12,
                                                    borderBottomLeftRadius: isMyMessage ? 12 : 2,
                                                    whiteSpace: "pre-wrap",
                                                    wordBreak: "break-word",
                                                    background: isMyMessage ? C.bubbleMine : C.bubbleOther,
                                                    color: isMyMessage ? 'var(--color-on-accent)' : 'var(--color-text-primary)',
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
                                                    // img는 네이티브로 포커스를 못 받으므로 button으로 감싸 키보드로도 크게 보기를 열 수 있게 한다
                                                    <button
                                                        type="button"
                                                        onClick={() => openAttachment(message)}
                                                        aria-label={`${message.fileName || "이미지"} 크게 보기`}
                                                        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "block" }}
                                                    >
                                                        <img
                                                            className="carev-chat-image"
                                                            src={message.fileUrl}
                                                            alt={message.fileName || "이미지"}
                                                            style={{ maxWidth: "100%", maxHeight: 160, borderRadius: 'var(--radius-none)', display: "block" }}
                                                        />
                                                    </button>
                                                ) : message.type === "FILE" && message.fileUrl ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => openAttachment(message)}
                                                        style={{
                                                            display: "inline-flex",
                                                            alignItems: "center",
                                                            gap: 'var(--spacing-1)',
                                                            background: "none",
                                                            border: "none",
                                                            padding: 0,
                                                            cursor: "pointer",
                                                            textAlign: "left",
                                                            textDecoration: "underline",
                                                            color: isMyMessage ? 'var(--color-on-accent)' : C.accent,
                                                        }}
                                                    >
                                                        <Icon icon={FiPaperclip} size="xsm" color="inherit" />
                                                        <Text type="supporting" color="inherit">{message.fileName || message.content}</Text>
                                                    </button>
                                                ) : (
                                                    <Text color="inherit">{message.content}</Text>
                                                )}
                                            </div>
                                            {!isMyMessage && (
                                                <>
                                                    <Text type="supporting" color="secondary">
                                                        {formatMessageTime(message.createdAt)}
                                                    </Text>
                                                    <Button
                                                        label="메시지 옵션"
                                                        isIconOnly
                                                        variant="ghost"
                                                        size="sm"
                                                        icon={<Icon icon="moreHorizontal" size="sm" />}
                                                        onClick={() => setLongPressMenuMessageId(longPressMenuMessageId === message.id ? null : message.id)}
                                                    />
                                                </>
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
                                                        boxShadow: 'var(--shadow-med)',
                                                        border: `1px solid ${C.border}`,
                                                        overflow: "hidden",
                                                    }}
                                                >
                                                    {/* 이모지 바 */}
                                                    <div style={{ display: "flex", gap: 'var(--spacing-0-5)', padding: "var(--spacing-1-5) var(--spacing-2)", borderBottom: `1px solid ${C.borderLight}` }}>
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
                                                    {/* 답글 · 삭제 — 삭제는 내가 보낸 것만 */}
                                                    <div style={{ padding: 'var(--spacing-1)', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
                                                        <Button
                                                            label="답장"
                                                            variant="ghost"
                                                            size="sm"
                                                            icon={<Icon icon={FiCornerUpLeft} size="sm" />}
                                                            onClick={() => handleReply(message)}
                                                        />
                                                        {isMyMessage && !message.isDeleted && (
                                                            pendingDeleteId === message.id ? (
                                                                <>
                                                                    <div style={{ padding: "var(--spacing-1) var(--spacing-2) 0" }}>
                                                                        <Text type="supporting" color="secondary">
                                                                            상대에게는 &lsquo;삭제된 메시지입니다&rsquo;로 남습니다
                                                                        </Text>
                                                                    </div>
                                                                    <Button
                                                                        label="삭제할게요"
                                                                        variant="destructive"
                                                                        size="sm"
                                                                        onClick={() => handleDeleteMessage(message.id)}
                                                                    />
                                                                    <Button
                                                                        label="그대로 두기"
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => setPendingDeleteId(null)}
                                                                    />
                                                                </>
                                                            ) : (
                                                                <Button
                                                                    label="삭제"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    icon={<Icon icon={FiTrash2} size="sm" color="error" />}
                                                                    onClick={() => setPendingDeleteId(message.id)}
                                                                />
                                                            )
                                                        )}
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
                        padding: "var(--spacing-2) var(--spacing-3)",
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
            <div style={{ padding: "var(--spacing-2) var(--spacing-3)", borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
                {uploadError && (
                    <div style={{ paddingBottom: 'var(--spacing-1)', color: 'var(--color-error)' }}>
                        <Text type="supporting" color="inherit">{uploadError}</Text>
                    </div>
                )}
                <div style={{ display: "flex", gap: 'var(--spacing-2)', alignItems: "flex-end" }}>
                    {/* 파일·사진 첨부 — 숨은 input을 아이콘 버튼으로 대신 연다 */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        onChange={handleFilePick}
                        style={{ display: "none" }}
                    />
                    <Button
                        label="파일 첨부"
                        isIconOnly
                        variant="ghost"
                        icon={<Icon icon={FiPaperclip} size="sm" />}
                        isLoading={isUploadingFile}
                        isDisabled={isUploadingFile || isSendingMessage}
                        onClick={() => fileInputRef.current?.click()}
                    />
                    <div style={{ flex: 1 }} onKeyDown={handleKeyDown}>
                        <TextInput
                            label="메시지 입력"
                            isLabelHidden
                            type="text"
                            value={messageInput}
                            onChange={(value) => onMessageInputChange(value)}
                            placeholder={
                                isUploadingFile ? "파일을 보내는 중..."
                                    : replyTo ? `${replyTo.senderName}에게 답장...`
                                    : "메시지 입력 (사진 붙여넣기 가능)"
                            }
                            isDisabled={isSendingMessage || isUploadingFile}
                        />
                    </div>
                    <Button
                        label="전송"
                        isIconOnly
                        variant="primary"
                        icon={<Icon icon={FiSend} size="sm" />}
                        onClick={handleSendMessage}
                        isDisabled={!messageInput.trim() || isSendingMessage || isUploadingFile}
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
                            padding: "10px var(--spacing-3)",
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
                                <Loading size="inline" label="참여자를 불러오는 중..." />
                            ) : participants.length > 0 ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 'var(--spacing-1)' }}>
                                    {participants.map((p, i) => (
                                        <div key={p.userId || i} style={{ display: "flex", alignItems: "center", gap: 'var(--spacing-2)', padding: "var(--spacing-1-5) 0" }}>
                                            <Avatar src={p.profileImageUrl} name={p.userName || "?"} size="small" />
                                            <Text type="body" color="primary">{p.userName}</Text>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ textAlign: "center", padding: "var(--spacing-3) 0" }}>
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
                                        <button
                                            key={m.id}
                                            type="button"
                                            onClick={() => { setShowDrawer(false); openAttachment(m); }}
                                            aria-label={`${m.fileName || "사진"} 크게 보기`}
                                            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "block", width: "100%" }}
                                        >
                                            <img
                                                className="carev-chat-image"
                                                src={m.fileUrl!}
                                                alt={m.fileName || "사진"}
                                                style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", borderRadius: 'var(--radius-inner)' }}
                                            />
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ textAlign: "center", padding: "var(--spacing-3) 0" }}>
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
                                        <button
                                            key={m.id}
                                            type="button"
                                            onClick={() => { setShowDrawer(false); openAttachment(m); }}
                                            style={{ display: "flex", alignItems: "center", gap: 'var(--spacing-2)', padding: 'var(--spacing-2)', borderRadius: 'var(--radius-inner)', background: "none", border: "none", cursor: "pointer", textAlign: "left", width: "100%" }}
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
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ textAlign: "center", padding: "var(--spacing-3) 0" }}>
                                    <Text type="supporting" color="secondary">공유된 파일이 없습니다</Text>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 받은 문서 바로 보기 — 관리자 채팅 탭·전자결재와 같은 뷰어를 재사용한다 */}
            {viewerFile && (
                <DocumentViewerModal
                    fileUrl={viewerFile.fileUrl}
                    fileName={viewerFile.fileName}
                    onClose={() => setViewerFile(null)}
                />
            )}

            {/* 사진 크게 보기 */}
            {imagePreview && (
                <Dialog isOpen onOpenChange={(open) => { if (!open) setImagePreview(null); }} purpose="info" width={720}>
                    <Layout
                        header={<DialogHeader title={imagePreview.fileName} onOpenChange={(open) => { if (!open) setImagePreview(null); }} />}
                        content={
                            <LayoutContent>
                                <img
                                    src={imagePreview.fileUrl}
                                    alt={imagePreview.fileName}
                                    style={{ width: "100%", height: "auto", display: "block", borderRadius: 'var(--radius-inner)' }}
                                />
                            </LayoutContent>
                        }
                    />
                </Dialog>
            )}
        </div>
    );
}
