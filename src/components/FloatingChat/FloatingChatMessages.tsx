"use client";

import { Fragment, useRef, useEffect, useState, useCallback, useMemo, type ReactNode } from "react";
import { FiSend, FiCornerUpLeft, FiPaperclip, FiTrash2, FiEdit2, FiCheck } from "react-icons/fi";
import { Text } from "@astryxdesign/core/Text";
import { Icon } from "@astryxdesign/core/Icon";
import { Button } from "@astryxdesign/core/Button";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Avatar } from "@astryxdesign/core/Avatar";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Loading } from "@/components/Loading";
import DocumentViewerModal from "@/components/DocumentViewerModal";
import { ChatPhotoGroup } from "@/components/chat/ChatPhotoGroup";
import { ChatImageLightbox, type ChatLightboxItem } from "@/components/chat/ChatImageLightbox";
import { ChatVideoBubble } from "@/components/chat/ChatVideoBubble";
import { ChatMessage, ReactionSummary } from "./floatingChatTypes";
import { fetchChatParticipants, toggleChatReaction, uploadChatFile, deleteChatMessage, editChatMessage } from '@/lib/apiService';
import { MAX_CHAT_FILE_SIZE, isViewableDocument, chatListImageUrl, chatMediaType } from '@/lib/chatAttachments';
import { buildChatRenderItems, formatDateSeparator } from '@/lib/chatMessageGrouping';
import { ChatMessageText } from "@/components/chat/ChatMessageText";
import { ChatScrollDateBadge, chatDateMarkerProps, useChatScrollDateBadge } from '@/components/chat/ChatScrollDateBadge';
import { useOlderChatMessages } from '@/lib/useOlderChatMessages';

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
    borderStrong: 'var(--color-border-emphasized)', // 남의 말풍선 경계선
    borderLight: 'var(--color-border)',  // gray-100
    bgGray50: 'var(--color-background-muted)',     // gray-50
    bubbleMine: 'var(--color-icon-teal)',   // teal-600
    bubbleOther: 'var(--color-background-muted)',  // gray-100
    accent: 'var(--color-icon-teal)',       // teal-600
};

// 날짜 구분선(getDateKey/formatDateSeparator)과 사진 묶음 규칙은
// @/lib/chatMessageGrouping으로 옮겨 관리자 채팅 탭과 같은 규칙을 공유한다.

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
     * 위로 스크롤해 받아온 옛 메시지를 목록 앞에 붙여 달라는 요청.
     * 목록 상태는 부모(플로팅 채팅 / 도크)가 들고 있으므로 여기서 직접 못 붙인다.
     * 안 넘기면 '이전 대화 더 불러오기'가 꺼진다.
     */
    onPrependOlder?: (older: ChatMessage[]) => void;
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
    onPrependOlder,
    headerAction,
}: FloatingChatMessagesProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    /** 스크롤 영역 — 위로 올려 옛 대화를 이어 붙일 때 기준이 된다 */
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const [showDrawer, setShowDrawer] = useState(false);
    const [participants, setParticipants] = useState<ChatParticipant[]>([]);
    const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);

    // 리액션 관련
    const [activeEmojiPickerMessageId, setActiveEmojiPickerMessageId] = useState<number | null>(null);

    // 답글 관련
    const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);

    /** 삭제를 누른 메시지 — 같은 메뉴 안에서 한 번 더 확인받는다 */
    const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

    /** 지금 고치고 있는 메시지 — null이면 평소의 새 메시지 입력 상태 */
    const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
    const [isSavingEdit, setIsSavingEdit] = useState(false);
    /** 방이 바뀔 때 '수정 중이었는지'만 보기 위한 참조 (effect 의존성을 늘리지 않는다) */
    const editingMessageRef = useRef<ChatMessage | null>(null);
    /** 입력창 비우기도 같은 이유로 참조로 부른다 — 부모가 매번 새 함수를 넘겨도 effect가 다시 돌면 안 된다 */
    const onMessageInputChangeRef = useRef(onMessageInputChange);
    /** 수정 실패 안내 — 이 패널엔 토스트가 없어 입력창 위에 한 줄로 띄운다 (업로드 오류와 같은 자리) */
    const [editError, setEditError] = useState<string | null>(null);

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
    /** 사진 크게 보기 — 묶음에서 열면 그 묶음 전체가 들어와 좌우로 넘길 수 있다 (한 장이면 길이 1) */
    const [imagePreview, setImagePreview] = useState<{ items: ChatLightboxItem[]; index: number } | null>(null);
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

    /**
     * 옛 대화 이어 붙이기 — 관리자 채팅 탭과 같은 훅을 쓴다. [[useOlderChatMessages]]
     * 목록 상태는 부모가 들고 있어서 받아온 메시지는 onPrependOlder로 넘긴다.
     */
    const { isLoadingOlder, hasMoreOlder, scrollAreaProps: olderScrollProps } = useOlderChatMessages<ChatMessage>({
        roomId: onPrependOlder ? roomId : null,
        messages,
        containerRef: messagesContainerRef,
        onPrepend: (older) => onPrependOlder?.(older),
    });

    /** 위로 올릴 때 "지금 며칠 대화인지" 알려주는 떠 있는 배지 [[ChatScrollDateBadge]] */
    const { dateBadgeLabel, updateDateBadge } = useChatScrollDateBadge(messagesContainerRef);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // 맨 아래로 따라가는 것은 '새 메시지가 끝에 붙었을 때'만이다.
    // messages 전체를 보면 위에 옛 대화를 이어 붙일 때도 끝으로 튕겨 나간다.
    const lastMessageId = messages.length > 0 ? messages[messages.length - 1].id : null;
    useEffect(() => {
        scrollToBottom();
    }, [lastMessageId, roomId]);

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
        // 방을 옮기면 수정 중이던 상태는 의미가 없다 — 남겨두면 다른 방 메시지를 고치게 된다.
        // 수정 중이 아니었다면 입력창은 손대지 않는다 (쓰던 새 메시지 초안이 사라지면 안 된다)
        setEditError(null);
        if (editingMessageRef.current) {
            setEditingMessage(null);
            onMessageInputChangeRef.current("");
        }
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
        // 수정 중이면 새로 보내는 대신 그 메시지를 고친다
        if (editingMessage) {
            void submitEditingMessage();
            return;
        }
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
    const sendFileMessage = async (file: File, batch?: { id: string; size: number }) => {
        if (!roomId || !userId) return;
        if (file.size > MAX_CHAT_FILE_SIZE) {
            setUploadError(`파일은 ${MAX_CHAT_FILE_SIZE / (1024 * 1024)}MB까지 보낼 수 있습니다`);
            return;
        }

        const userName = (typeof window !== "undefined" ? localStorage.getItem("userName") : null) || "";
        setUploadError(null);
        setIsUploadingFile(true);
        try {
            const response = await uploadChatFile(roomId, file, userId, userName, batch);
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

    /**
     * 여러 개를 한 번에 떨어뜨려도 보낸 순서가 뒤섞이지 않게 하나씩 올린다.
     * 한 번의 동작으로 보낸 것이므로 같은 묶음 표시를 달아 알림도 한 번만 가게 한다.
     */
    const sendFiles = async (files: File[]) => {
        const batch = files.length > 1
            ? { id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`, size: files.length }
            : undefined;
        for (const file of files) {
            await sendFileMessage(file, batch);
        }
    };

    /**
     * 첨부 버튼으로 고른 파일들을 보낸다.
     * 관리자 채팅 탭과 같이 한 번에 여러 개를 고를 수 있고, 그 경우 알림도 한 번만 간다.
     */
    const handleFilePick = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files ?? []);
        // 같은 파일을 연달아 보낼 수 있게 값을 비운다
        event.target.value = "";
        if (files.length > 0) sendFiles(files);
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

    /** 받은 첨부 열기 — 사진은 확대 보기, 동영상은 새 탭, 열람 가능한 문서는 뷰어, 나머지는 새 탭 */
    const openAttachment = (message: ChatMessage) => {
        if (!message.fileUrl) return;
        const media = chatMediaType(message);
        if (media === "IMAGE") {
            setImagePreview({ items: [{ fileUrl: message.fileUrl, fileName: message.fileName || "이미지" }], index: 0 });
        } else if (media === "VIDEO") {
            // 문서 뷰어는 동영상을 그릴 줄 모른다 — 브라우저 기본 재생기에 넘긴다
            window.open(message.fileUrl, "_blank", "noopener");
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

        // 낙관적 업데이트 — 왕복을 기다리는 동안 눌린 게 반영 안 된 것처럼 보이지 않게
        onMessagesUpdate?.(messages.map(msg => (msg.id === messageId ? { ...msg, isDeleted: true } : msg)));
        try {
            await deleteChatMessage(roomId, messageId);
        } catch (error) {
            console.error("[FloatingChat] 메시지 삭제 실패:", error);
            // 되돌릴 때 목록을 통째로 되돌리면, 그 사이 도착한 새 메시지가 사라진다.
            // 건드린 한 건만 원래대로 돌린다.
            onMessagesUpdate?.(messages.map(msg => (msg.id === messageId ? { ...msg, isDeleted: false } : msg)));
        }
    };

    /**
     * 메시지 수정 시작 — 입력창에 원래 내용을 담고 '수정 중' 상태로 바꾼다.
     * 답장과는 동시에 성립하지 않으므로(답장은 새 메시지를 만드는 일이다) 답장 상태는 접는다.
     */
    const startEditingMessage = (message: ChatMessage) => {
        setLongPressMenuMessageId(null);
        setPendingDeleteId(null);
        setReplyTo(null);
        setEditError(null);
        setEditingMessage(message);
        onMessageInputChange(message.content ?? "");
    };

    /** 수정 취소 — 입력창을 비우고 평소 상태로 되돌린다 */
    const cancelEditingMessage = () => {
        setEditingMessage(null);
        setEditError(null);
        onMessageInputChange("");
    };

    /**
     * 수정 저장. 서버가 본인 여부·삭제 여부·텍스트 여부를 다시 확인하므로
     * 화면의 조건은 편의일 뿐이고, 실패하면 원래 내용으로 되돌린다.
     */
    const submitEditingMessage = async () => {
        if (!editingMessage) return;
        const next = messageInput.trim();
        // 빈 내용은 '삭제'와 다른 일이다 — 지우고 싶으면 삭제를 쓰게 한다
        if (!next) {
            setEditError("수정할 내용을 입력해주세요. 지우려면 삭제를 사용해주세요");
            return;
        }
        // 그대로면 서버를 부르지 않는다 — 괜히 '수정됨' 표시만 남는다
        if (next === (editingMessage.content ?? "")) {
            cancelEditingMessage();
            return;
        }

        const targetId = editingMessage.id;
        const previous = editingMessage;
        setIsSavingEdit(true);
        setEditError(null);
        // 낙관적 업데이트 — 왕복을 기다리는 동안 눌린 게 반영 안 된 것처럼 보이지 않게.
        // 업로드와 같은 이유로 항상 '지금의' 최신 목록에 적용한다 (그 사이 소켓으로 새 메시지가 들어올 수 있다)
        onMessagesUpdate?.(messagesRef.current.map(msg => (msg.id === targetId ? { ...msg, content: next, editedAt: new Date().toISOString() } : msg)));
        cancelEditingMessage();
        try {
            const response = await editChatMessage(roomId, targetId, next);
            const saved = response?.message || response;
            if (saved && typeof saved === "object" && "id" in saved) {
                onMessagesUpdate?.(messagesRef.current.map(msg => (msg.id === targetId ? saved : msg)));
            }
        } catch (error) {
            console.error("[FloatingChat] 메시지 수정 실패:", error);
            // 건드린 한 건만 원래대로 돌린다 (목록을 통째로 되돌리면 그 사이 온 메시지가 사라진다)
            onMessagesUpdate?.(messagesRef.current.map(msg => (msg.id === targetId ? { ...msg, content: previous.content, editedAt: previous.editedAt ?? null } : msg)));
            setEditError("메시지를 수정하지 못했습니다. 잠시 후 다시 시도해주세요");
        } finally {
            setIsSavingEdit(false);
        }
    };

    useEffect(() => { editingMessageRef.current = editingMessage; }, [editingMessage]);
    useEffect(() => { onMessageInputChangeRef.current = onMessageInputChange; }, [onMessageInputChange]);

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
                            padding: "2px var(--spacing-2)",
                            borderRadius: 'var(--radius-full)',
                            fontSize: 'var(--font-size-xs)',
                            cursor: "pointer",
                            transition: 'background-color var(--duration-fast-min) var(--ease-standard)',
                            border: reaction.myReaction ? "1px solid var(--color-accent)" : `1px solid ${C.border}`,
                            background: reaction.myReaction ? 'var(--color-accent-muted)' : 'var(--color-background-surface)',
                            color: reaction.myReaction ? 'var(--color-text-accent, var(--color-accent))' : 'var(--color-text-primary)',
                            boxShadow: 'var(--shadow-low)',
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
                        {/* 동영상은 저장된 type이 FILE이라 파생 필드(replyToMediaType)로만 구분된다 */}
                        {message.replyToMediaType === "VIDEO" ? "🎬 동영상"
                            : message.replyToType === "IMAGE" || message.replyToMediaType === "IMAGE" ? "📷 사진"
                                : message.replyToType === "FILE" ? "📎 파일" : message.replyToContent}
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
                ref={messagesContainerRef}
                {...olderScrollProps}
                onScroll={() => { olderScrollProps.onScroll(); updateDateBadge(); }}
                style={{
                    flex: 1,
                    overflowY: "auto",
                    padding: "var(--spacing-2) var(--spacing-3)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 'var(--spacing-2)',
                }}
            >
                {/* 위로 올리는 동안 "며칠 대화인지" 알려주는 떠 있는 배지 (멈추면 사라진다) */}
                <ChatScrollDateBadge label={dateBadgeLabel} listGap="var(--spacing-2)" />
                {/* 위로 더 올라갈 대화가 있는지 알려주는 줄 — 불러오는 중이면 로딩, 끝이면 시작 안내 */}
                {onPrependOlder && !isLoadingMessages && messages.length > 0 && (
                    isLoadingOlder ? (
                        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 'var(--spacing-2)', padding: "var(--spacing-1) 0", flexShrink: 0 }}>
                            <Spinner size="sm" aria-label="이전 대화를 불러오는 중" />
                            <Text type="supporting" color="secondary">이전 대화를 불러오는 중...</Text>
                        </div>
                    ) : !hasMoreOlder ? (
                        <div style={{ display: "flex", justifyContent: "center", padding: "var(--spacing-1) 0", flexShrink: 0 }}>
                            <Text type="supporting" color="disabled">대화의 시작입니다</Text>
                        </div>
                    ) : null
                )}
                {isLoadingMessages ? (
                    <Loading height="100%" label="메시지를 불러오는 중..." />
                ) : messages.length === 0 ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                        <Text type="body" color="secondary">메시지가 없습니다</Text>
                    </div>
                ) : (
                    buildChatRenderItems(messages).map((item) => {
                        // 연달아 온 사진은 한 말풍선(격자)으로 접힌다.
                        // 대표 메시지는 묶음의 '마지막(가장 최신)' 장 — 시각 표시가 묶음이 끝난 시각이어야 하고,
                        // 답장·반응 메뉴도 이 메시지를 대상으로 삼는다.
                        // (이 화면은 원래 '안 읽은 수'를 그리지 않으므로 묶음에도 새로 넣지 않는다)
                        const message = item.kind === "photos" ? item.messages[item.messages.length - 1] : item.message;
                        const photoGroup = item.kind === "photos" ? item.messages : null;
                        const isMyMessage = message.senderId === userId;
                        const isSystemMessage = message.type === "SYSTEM";
                        const showDateSeparator = item.showDateSeparator;
                        // 아바타와 이름줄은 보낸 사람이 바뀌는 지점에만 그린다(앱·관리자 채팅탭과 같은 규칙).
                        const isGroupStart = item.showSenderHeader;
                        const mediaType = chatMediaType(message);

                        // 구분선에 문구를 표시로 달아 둔다 — 떠 있는 날짜 배지가 이걸 읽는다
                        const separatorLabel = showDateSeparator ? formatDateSeparator(message.createdAt) : null;
                        const dateSeparator = separatorLabel ? (
                            <div
                                style={{ display: "flex", alignItems: "center", gap: 'var(--spacing-3)', margin: "var(--spacing-3) 0" }}
                                {...chatDateMarkerProps(separatorLabel)}
                            >
                                <div style={{ flex: 1, height: 1, background: C.border }} />
                                <div style={{ whiteSpace: "nowrap" }}>
                                    <Text type="supporting" color="secondary" weight="medium">
                                        {separatorLabel}
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
                                        alignItems: "flex-start",
                                        gap: 'var(--spacing-1-5)',
                                        position: "relative",
                                    }}
                                >
                                    {/* 아바타는 묶음의 첫 메시지에만. 이어지는 메시지는 같은 폭을 빈 자리로
                                        차지해 말풍선이 세로로 가지런히 선다. */}
                                    {!isMyMessage && (
                                        isGroupStart ? (
                                            <Avatar
                                                src={participantAvatarMap.get(message.senderId)}
                                                name={message.senderName || "?"}
                                                size="xsmall"
                                            />
                                        ) : (
                                            <div style={{ width: 24, flexShrink: 0 }} aria-hidden />
                                        )
                                    )}
                                    <div
                                        style={{
                                            maxWidth: "75%",
                                            display: "flex",
                                            flexDirection: "column",
                                            alignItems: isMyMessage ? "flex-end" : "flex-start",
                                        }}
                                    >
                                        {/* 이름과 직종은 한 문단으로 — 둘로 나누면 가로폭을 반씩 나눠 갖느라
                                            "주간보호센터장" 같은 긴 직종이 먼저 잘린다. */}
                                        {!isMyMessage && isGroupStart && (
                                            <div style={{ marginBottom: 'var(--spacing-0-5)', marginLeft: 'var(--spacing-1)' }}>
                                                <Text type="supporting" color="secondary">
                                                    {message.senderName}
                                                    {message.senderPosition ? ` (${message.senderPosition})` : ""}
                                                </Text>
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
                                                className={isMyMessage ? "carev-selection-on-accent" : undefined}
                                                style={{
                                                    position: "relative",
                                                    padding: "var(--spacing-1-5) var(--spacing-3)",
                                                    borderRadius: 'var(--radius-element)',
                                                    borderBottomRightRadius: isMyMessage ? 2 : 12,
                                                    borderBottomLeftRadius: isMyMessage ? 12 : 2,
                                                    whiteSpace: "pre-wrap",
                                                    wordBreak: "break-word",
                                                    background: isMyMessage ? C.bubbleMine : C.bubbleOther,
                                                    // 남의 말풍선은 흰 배경 위에 muted 배경만으로는 경계가 안 보여 한 단계 진한 테두리를 준다
                                                    border: isMyMessage ? "1px solid transparent" : `1px solid ${C.borderStrong}`,
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

                                                {photoGroup ? (
                                                    // 연달아 온 사진 묶음 — 격자로 그리고, 누르면 그 묶음 안에서 좌우로 넘길 수 있다
                                                    <ChatPhotoGroup
                                                        messages={photoGroup}
                                                        maxWidth={240}
                                                        onOpen={(openIndex) => setImagePreview({
                                                            items: photoGroup.map(m => ({ fileUrl: m.fileUrl!, fileName: m.fileName || "이미지" })),
                                                            index: openIndex,
                                                        })}
                                                    />
                                                ) : mediaType === "IMAGE" && message.fileUrl ? (
                                                    // img는 네이티브로 포커스를 못 받으므로 button으로 감싸 키보드로도 크게 보기를 열 수 있게 한다
                                                    <button
                                                        type="button"
                                                        onClick={() => openAttachment(message)}
                                                        aria-label={`${message.fileName || "이미지"} 크게 보기`}
                                                        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "block" }}
                                                    >
                                                        <img
                                                            className="carev-chat-image"
                                                            src={chatListImageUrl(message)}
                                                            alt={message.fileName || "이미지"}
                                                            style={{ maxWidth: "100%", maxHeight: 160, borderRadius: 'var(--radius-none)', display: "block" }}
                                                        />
                                                    </button>
                                                ) : mediaType === "VIDEO" && message.fileUrl ? (
                                                    <ChatVideoBubble
                                                        fileUrl={message.fileUrl}
                                                        fileName={message.fileName || message.content}
                                                        posterUrl={message.thumbnailUrl}
                                                        maxHeight={160}
                                                    />
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
                                                    <Text color="inherit">
                                                        <ChatMessageText
                                                            content={message.content ?? ""}
                                                            isMyMessage={isMyMessage}
                                                        />
                                                        {/* 고쳐진 대화라는 사실은 기록으로 남아야 한다 — 말풍선 색이 달라도 읽히도록
                                                            글자색은 말풍선 글자색을 물려받고 흐리기만 한다 */}
                                                        {message.editedAt && (
                                                            <span style={{ marginLeft: 'var(--spacing-1)', fontSize: 'var(--font-size-sm)', opacity: 0.7 }}>
                                                                수정됨
                                                            </span>
                                                        )}
                                                    </Text>
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
                                                        {/* 수정은 내가 보낸 '글' 메시지만. 사진·파일은 고칠 내용이 없고,
                                                            지워진 메시지는 되살리는 일이 되므로 대상이 아니다. */}
                                                        {isMyMessage && !message.isDeleted && message.type === "TEXT" && (
                                                            <Button
                                                                label="수정"
                                                                variant="ghost"
                                                                size="sm"
                                                                icon={<Icon icon={FiEdit2} size="sm" />}
                                                                onClick={() => startEditingMessage(message)}
                                                            />
                                                        )}
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

            {/* 수정 중 안내 — 지금 입력창에 있는 글이 '새 메시지'가 아니라
                '이미 보낸 메시지를 고치는 중'임을 분명히 알린다 */}
            {editingMessage && (
                <div
                    style={{
                        padding: "var(--spacing-2) var(--spacing-3)",
                        borderTop: `1px solid ${C.border}`,
                        background: 'var(--color-background-muted)',
                        display: "flex",
                        alignItems: "center",
                        gap: 'var(--spacing-2)',
                        flexShrink: 0,
                    }}
                >
                    <Icon icon={FiEdit2} size="sm" color="accent" />
                    <div style={{ flex: 1, minWidth: 0, borderLeft: `2px solid ${C.accent}`, paddingLeft: 'var(--spacing-2)' }}>
                        <Text type="supporting" weight="semibold" color="accent" maxLines={1}>메시지 수정 중</Text>
                        <div>
                            <Text type="supporting" color="secondary" maxLines={1}>{editingMessage.content}</Text>
                        </div>
                    </div>
                    <Button
                        label="수정 취소"
                        isIconOnly
                        variant="ghost"
                        size="sm"
                        icon={<Icon icon="close" size="sm" />}
                        onClick={cancelEditingMessage}
                    />
                </div>
            )}

            {/* Input Area */}
            <div style={{ padding: "var(--spacing-2) var(--spacing-3)", borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
                {editError && (
                    <div style={{ paddingBottom: 'var(--spacing-1)', color: 'var(--color-error)' }}>
                        <Text type="supporting" color="inherit">{editError}</Text>
                    </div>
                )}
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
                        multiple
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
                                editingMessage ? "메시지를 고친 뒤 저장하세요"
                                    : isUploadingFile ? "파일을 보내는 중..."
                                    : replyTo ? `${replyTo.senderName}에게 답장...`
                                    : "메시지 입력 (사진 붙여넣기 가능)"
                            }
                            isDisabled={isSendingMessage || isUploadingFile || isSavingEdit}
                        />
                    </div>
                    <Button
                        label={editingMessage ? "수정 저장" : "전송"}
                        isIconOnly
                        variant="primary"
                        icon={<Icon icon={editingMessage ? FiCheck : FiSend} size="sm" />}
                        onClick={handleSendMessage}
                        isDisabled={!messageInput.trim() || isSendingMessage || isUploadingFile || isSavingEdit}
                        isLoading={isSavingEdit}
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
                                                src={chatListImageUrl(m)}
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

            {/* 사진 크게 보기 — 묶음에서 열면 좌우 화살표로 넘긴다 */}
            {imagePreview && (
                <ChatImageLightbox
                    items={imagePreview.items}
                    index={imagePreview.index}
                    onIndexChange={(next) => setImagePreview(prev => (prev ? { ...prev, index: next } : prev))}
                    onClose={() => setImagePreview(null)}
                    width={720}
                />
            )}
        </div>
    );
}
