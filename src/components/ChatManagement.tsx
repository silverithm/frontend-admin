"use client";

import { useState, useEffect, useRef, useCallback, useMemo, Fragment } from "react";
import { Client, IMessage } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { fetchChatRooms, fetchChatMessages, fetchChatMessagesAround, markChatAsRead, sendChatMessage, toggleChatReaction, createChatRoom, fetchChatParticipants, addChatParticipants, deleteChatRoom, leaveChatRoom, deleteChatMessage, uploadChatFile, updateChatRoomNotice, fetchChatSharedFiles, searchChatMessages } from '@/lib/apiService';
import ScheduleCreateDialog from '@/components/ScheduleCreateDialog';
import { openOrCreateDirectRoom } from '@/lib/directChat';
import { getMyChatUserId } from '@/lib/chatIdentity';
import { useOlderChatMessages, CHAT_PAGE_SIZE, prependUniqueMessages } from '@/lib/useOlderChatMessages';
import { useOrgPresenceStore, sortMembersByPresence } from '@/lib/orgPresenceStore';
import { MAX_CHAT_FILE_SIZE, isViewableDocument, chatListImageUrl, chatMediaType } from '@/lib/chatAttachments';
import { buildChatRenderItems, formatDateSeparator } from '@/lib/chatMessageGrouping';
import DocumentViewerModal from '@/components/DocumentViewerModal';
import { ChatPhotoGroup } from '@/components/chat/ChatPhotoGroup';
import { ChatImageLightbox, type ChatLightboxItem } from '@/components/chat/ChatImageLightbox';
import { ChatVideoBubble } from '@/components/chat/ChatVideoBubble';
import MemberItem from '@/components/MemberItem';
import ChatMemberPicker from '@/components/ChatMemberPicker';
import { Button } from '@astryxdesign/core/Button';
import { IconButton } from '@astryxdesign/core/IconButton';
import { TextInput } from '@astryxdesign/core/TextInput';
import { TextArea } from '@astryxdesign/core/TextArea';
import { Loading } from '@/components/Loading';
import { Text } from '@astryxdesign/core/Text';
import { Icon } from '@astryxdesign/core/Icon';
import { Badge } from '@astryxdesign/core/Badge';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Avatar } from '@astryxdesign/core/Avatar';
import { Item } from '@astryxdesign/core/Item';
import { Divider } from '@astryxdesign/core/Divider';
import { Spinner } from '@astryxdesign/core/Spinner';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Banner } from '@astryxdesign/core/Banner';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { Timestamp } from '@astryxdesign/core/Timestamp';
import { FiCornerUpLeft, FiPaperclip, FiMessageCircle, FiSearch, FiTrash2, FiLogOut, FiCalendar } from 'react-icons/fi';

import { useVisiblePolling } from '@/lib/useVisiblePolling';

interface ChatManagementProps {
    onNotification: (message: string, type: "success" | "error" | "info") => void;
    isAdmin?: boolean;
    /** 바깥(우측 레일 등)에서 지목한 대화방 — 열릴 때 이 방을 펴 둔다 */
    initialRoomId?: number | null;
    /**
     * 전체 안 읽은 메시지 수를 셸에 알린다 — 채팅 탭이 열려 있는 동안은 레일이
     * 내려가 있어(같은 목록 중복) 이 화면이 배지 숫자를 책임진다.
     */
    onUnreadChange?: (total: number) => void;
    /** 지금 화면에 펴 둔 방이 바뀔 때마다 알려준다 — 셸이 그 방의 새 메시지 토스트를 건너뛰는 데 쓴다 */
    onActiveRoomChange?: (roomId: number | null) => void;
}

interface ReactionSummary {
    emoji: string;
    count: number;
    userNames: string[];
    myReaction: boolean;
}

interface ChatMessage {
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
    replyToId?: number;
    replyToSenderName?: string;
    replyToContent?: string;
    replyToType?: string;
    /** 답글 미리보기용 — 원본이 동영상인지 사진인지 (없으면 replyToType으로 대체 판단) */
    replyToMediaType?: string;
}

interface ChatRoom {
    id: number;
    name: string;
    description?: string;
    lastMessage?: { content: string; senderName: string; createdAt: string } | null;
    lastMessageAt?: string;
    unreadCount: number;
    participantCount: number;
    /** 방 상단 고정 공지 (없으면 전부 null) */
    noticeMessageId?: number | null;
    noticeContent?: string | null;
    noticeByName?: string | null;
    noticeAt?: string | null;
    noticeFileName?: string | null;
    noticeFileUrl?: string | null;
}

interface WebSocketMessage {
    type: "MESSAGE" | "TYPING" | "READ" | "JOIN" | "LEAVE" | "DELETE";
    roomId: number;
    senderId?: string;
    senderName?: string;
    message?: ChatMessage;
    isTyping?: boolean;
}

interface ChatParticipant {
    userId: string;
    userName: string;
    role?: string;
    joinedAt?: string;
    profileImageUrl?: string;
    /** 이 사람이 어디까지 읽었는지 — 메시지 옆 '안 읽은 수'를 세는 근거 */
    lastReadMessageId?: number | null;
}

const BACKEND_WS_URL = process.env.NEXT_PUBLIC_API_URL || "https://silverithm.site";

/**
 * 메시지 옆 '아직 안 읽은 사람 수'.
 *
 * 숫자만 덩그러니 두면 무슨 수인지 알 수 없어 화면 낭독기용 설명을 함께 준다.
 * 모두 읽으면(0) 아무것도 그리지 않는다 — 카카오톡과 같다.
 */
function UnreadCount({ count }: { count: number | null }) {
    // null = 참가자를 아직 못 받아온 상태(모른다) — '다 읽음'과 구분해 아무것도 그리지 않는다
    if (count === null || count <= 0) return null;
    return (
        <Text type="supporting" color="accent" aria-label={`${count}명이 아직 읽지 않음`}>
            {count}
        </Text>
    );
}

// Astryx 마이그레이션: bespoke 레이아웃(스플릿 패널/메시지 버블)에서만 쓰는 잔여 색상 — 전부 디자인 토큰
const C = {
    accent: 'var(--color-accent)',
    border: 'var(--color-border)',
    // 남의 말풍선 테두리 — 흰 말풍선이 muted 배경(#f1f1f1) 위에서도 경계가 보이게 한 단계 진한 선을 쓴다
    borderStrong: 'var(--color-border-emphasized)',
    bgGray: 'var(--color-background-muted)',
    gray100: 'var(--color-background-muted)',
    gray300: 'var(--color-border-emphasized)',
    gray500: 'var(--color-text-secondary)',
    gray900: 'var(--color-text-primary)',
    card: 'var(--color-background-card)',
    onAccent: 'var(--color-on-accent)',
};

/**
 * 본문의 '@이름'을 눈에 띄게 칠한다.
 *
 * 참가자 목록과 대조하지 않고 패턴만 본다 — 이름이 바뀌거나 방을 나간 뒤에도
 * 지난 대화가 그대로 보여야 하고, 강조가 조금 넉넉한 편이 읽기에 낫다.
 */
function renderWithMentions(content: string, isMyMessage: boolean) {
    if (!content || !content.includes("@")) return content;

    const parts = content.split(/(@[^\s@]{1,20})/g);
    return parts.map((part, index) =>
        part.startsWith("@") && part.length > 1 ? (
            <strong
                key={index}
                style={{
                    fontWeight: 'var(--font-weight-semibold)',
                    color: isMyMessage ? 'var(--color-on-accent)' : 'var(--color-text-accent)',
                    background: isMyMessage ? "rgba(255,255,255,0.22)" : 'var(--color-background-teal)',
                    borderRadius: 'var(--radius-inner)',
                    padding: "0 var(--spacing-0-5)",
                }}
            >
                {part}
            </strong>
        ) : (
            <Fragment key={index}>{part}</Fragment>
        ),
    );
}

// 목록(말풍선·정보 서랍 사진 그리드) 이미지 URL 고르기는 chatListImageUrl(@/lib/chatAttachments)로
// 옮겨 플로팅 채팅(FloatingChat)과 같은 규칙을 공유한다.

// 날짜 구분선(getDateKey/formatDateSeparator)과 사진 묶음 규칙은
// @/lib/chatMessageGrouping으로 옮겨 플로팅 채팅과 같은 규칙을 공유한다.

export function ChatManagement({ onNotification, isAdmin = true, initialRoomId = null, onUnreadChange, onActiveRoomChange }: ChatManagementProps) {
    const [rooms, setRooms] = useState<ChatRoom[]>([]);
    const [selectedRoom, setSelectedRoom] = useState<number | null>(initialRoomId);

    // 방을 읽어 unreadCount가 줄면 셸의 채팅 탭 배지도 바로 줄어든다.
    // 첫 목록을 받기 전의 빈 배열은 보고하지 않는다 — '아직 모른다'를 '0건'으로
    // 올리면 탭을 오갈 때마다 배지가 사라졌다 되살아난다 (UserManagement와 같은 가드)
    const hasLoadedRoomsRef = useRef(false);
    useEffect(() => {
        if (!hasLoadedRoomsRef.current) return;
        onUnreadChange?.(rooms.reduce((sum, room) => sum + (room.unreadCount || 0), 0));
    }, [rooms, onUnreadChange]);

    // 우측 레일에서 사람이나 방을 눌러 들어온 경우 그 방을 펴 준다.
    // 같은 방을 다시 눌렀을 때도 반응해야 하므로 값이 같아도 무시하지 않는다.
    useEffect(() => {
        if (initialRoomId != null) setSelectedRoom(initialRoomId);
    }, [initialRoomId]);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [messageInput, setMessageInput] = useState("");
    const [isLoadingRooms, setIsLoadingRooms] = useState(false);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [isSendingMessage, setIsSendingMessage] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newRoomName, setNewRoomName] = useState("");
    const [newRoomDescription, setNewRoomDescription] = useState("");
    /** 새 방에 함께 넣을 사람들 (나는 항상 들어가므로 목록에 없다) */
    const [newRoomParticipantIds, setNewRoomParticipantIds] = useState<string[]>([]);
    const [isCreatingRoom, setIsCreatingRoom] = useState(false);
    /** 이미 있는 방에 사람 부르기 */
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteIds, setInviteIds] = useState<string[]>([]);
    const [isInviting, setIsInviting] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [showDrawer, setShowDrawer] = useState(false);
    const [participants, setParticipants] = useState<ChatParticipant[]>([]);
    const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);
    /** 지금 방의 참가자를 한 번이라도 받아왔는지 — '아직 모른다'와 '읽음 0명'을 가르는 값 */
    const [participantsReady, setParticipantsReady] = useState(false);

    // 메시지 발신자 아바타 표시용 — 참여자의 profileImageUrl을 미리 조회해둔다
    const participantAvatarMap = useMemo(() => {
        const map = new Map<string, string | undefined>();
        participants.forEach((p) => map.set(p.userId, p.profileImageUrl));
        return map;
    }, [participants]);

    /**
     * 메시지 옆에 붙는 '아직 안 읽은 사람 수' (카카오톡과 같은 규칙).
     *
     * 참가자마다 어디까지 읽었는지(lastReadMessageId)를 들고 있으므로, 그 값이 이 메시지보다
     * 앞이면 아직 안 읽은 것이다. 보낸 사람 자신은 언제나 읽은 것으로 친다 —
     * 서버는 전송 시 읽음 행만 남기고 참가자 포인터는 옮기지 않는다.
     * 0이면 모두 읽었다는 뜻이라 숫자를 지운다.
     */
    const countUnreadReaders = useCallback((message: ChatMessage): number | null => {
        // 참가자를 아직 못 받아온 상태('모른다')와 '정말 다 읽음'(0)을 구분한다.
        // 구분하지 않으면 탭 재진입 직후 participants가 빈 배열로 시작해 잠깐 모두 읽은 것처럼 보인다.
        if (!participantsReady) return null;
        return participants.filter(p =>
            p.userId !== String(message.senderId) && (p.lastReadMessageId ?? 0) < message.id
        ).length;
    }, [participants, participantsReady]);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeletingRoom, setIsDeletingRoom] = useState(false);
    const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
    const [isUploadingFile, setIsUploadingFile] = useState(false);
    const [isUpdatingNotice, setIsUpdatingNotice] = useState(false);
    /** 헤더 아래로 펼치는 보조 패널 — 검색 / 파일함 (동시에 하나만) */
    const [sidePanel, setSidePanel] = useState<'search' | 'files' | null>(null);
    const [searchKeyword, setSearchKeyword] = useState("");
    /** null = 아직 검색 안 함 (빈 배열은 '결과 없음') */
    const [searchResults, setSearchResults] = useState<ChatMessage[] | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    /** 검색 결과를 눌러 이동한 메시지 — 잠깐 배경을 강조했다가 지운다 */
    const [highlightedMessageId, setHighlightedMessageId] = useState<number | null>(null);
    /**
     * 검색 결과를 눌러 오래된 구간으로 점프한 상태 — 이 상태에선 messages가 최신 대화의
     * 꼬리가 아니라 그 메시지 주변 구간이므로, 웹소켓으로 오는 새 메시지를 이어붙이면
     * 안 되고(사이 구간이 비어 대화가 끊겨 보인다) "최신으로 돌아가기"로만 벗어난다.
     */
    const [isJumpedToOlder, setIsJumpedToOlder] = useState(false);
    // 웹소켓 구독 콜백(아래)이 매번 재구독되지 않도록 최신 값을 ref로도 들고 있는다
    const isJumpedToOlderRef = useRef(false);
    useEffect(() => { isJumpedToOlderRef.current = isJumpedToOlder; }, [isJumpedToOlder]);
    const [sharedFiles, setSharedFiles] = useState<ChatMessage[]>([]);
    const [isLoadingFiles, setIsLoadingFiles] = useState(false);
    /** @를 입력하면 뜨는 참가자 추천 — null이면 닫힘 */
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    /** 왼쪽 목록 전환 — 대화방 / 직원 */
    const [listTab, setListTab] = useState<'rooms' | 'people'>('rooms');
    const [isOpeningDirect, setIsOpeningDirect] = useState(false);
    // 기관 인원 명단과 접속 상태는 플로팅 채팅과 스토어를 함께 쓴다 (둘 다 떠 있을 수 있다)
    const orgMembers = useOrgPresenceStore(s => s.members);
    const onlineUserIds = useOrgPresenceStore(s => s.onlineUserIds);
    const loadOrgPresence = useOrgPresenceStore(s => s.load);
    const setPresence = useOrgPresenceStore(s => s.setPresence);
    /** 공지가 길면 두 줄만 보여주고 필요할 때 펼친다 */
    const [isNoticeExpanded, setIsNoticeExpanded] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    /** 파일을 대화 영역 위로 끌어왔을 때만 안내를 띄운다 */
    const [isDraggingFile, setIsDraggingFile] = useState(false);
    /** 자식 위를 지날 때마다 dragleave가 튀어서, 진입 횟수를 세어 상쇄한다 */
    const dragDepthRef = useRef(0);
    /** 채팅에서 받은 문서를 앱 안에서 바로 여는 뷰어 (이미지는 자체 확대 보기로 처리) */
    const [viewerFile, setViewerFile] = useState<{ fileUrl: string; fileName: string } | null>(null);
    /** 사진 크게 보기 — 묶음에서 열면 그 묶음 전체가 들어와 좌우로 넘길 수 있다 (한 장이면 길이 1) */
    const [imagePreview, setImagePreview] = useState<{ items: ChatLightboxItem[]; index: number } | null>(null);
    const [contextMenuMessageId, setContextMenuMessageId] = useState<number | null>(null);
    /** 삭제를 누른 메시지 — 같은 메뉴 안에서 한 번 더 확인받는다 */
    const [pendingDeleteMessageId, setPendingDeleteMessageId] = useState<number | null>(null);
    /** 메시지 우클릭 → 일정 등록 — 이 메시지의 내용을 제목 초기값으로 다이얼로그를 연다 */
    const [scheduleSourceMessage, setScheduleSourceMessage] = useState<ChatMessage | null>(null);

    /** 헤더 우측 더보기(⋯) 메뉴 — 앱의 채팅방 ⋮ 메뉴와 같은 자리다 */
    const [showRoomMenu, setShowRoomMenu] = useState(false);
    /** 채팅방 나가기 확인 */
    const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
    const [isLeavingRoom, setIsLeavingRoom] = useState(false);

    // 열린 메시지 메뉴는 Escape로 닫는다.
    // 메뉴 요소에 onKeyDown을 붙이면 안 된다 — 메뉴를 연 직후 포커스는 그것을 연 버튼에 남아 있어
    // (키보드 사용자의 정상 경로) 메뉴로 이벤트가 오지 않는다.
    useEffect(() => {
        if (contextMenuMessageId === null) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setContextMenuMessageId(null);
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [contextMenuMessageId]);

    // 메뉴가 닫히면 삭제 확인도 푼다 — 안 그러면 다음에 연 메뉴가 확인 상태로 시작한다
    useEffect(() => {
        if (contextMenuMessageId === null) setPendingDeleteMessageId(null);
    }, [contextMenuMessageId]);

    // 헤더 더보기 메뉴도 Escape와 바깥 클릭으로 닫는다 (메시지 메뉴와 같은 이유로 document에 건다)
    useEffect(() => {
        if (!showRoomMenu) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setShowRoomMenu(false);
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [showRoomMenu]);

    // 방을 옮기면 열려 있던 메뉴는 닫는다
    useEffect(() => { setShowRoomMenu(false); }, [selectedRoom]);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    /** 메시지 스크롤 영역 — 지금 맨 아래 근처를 보고 있는지 판단하는 데 쓴다 */
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    /** 남이 보낸 메시지가 왔는데 내가 위쪽을 보고 있을 때 띄우는 배지 */
    const [showNewMessageBadge, setShowNewMessageBadge] = useState(false);
    /**
     * 위로 올려 옛 대화를 이어 붙이는 일은 플로팅 채팅과 공유하는 훅이 맡는다
     * (id 기준 around 조회 + 화면 튐 보정). [[useOlderChatMessages]]
     */
    const { isLoadingOlder, hasMoreOlder, resetWindow: resetOlderWindow, scrollAreaProps: olderScrollProps } =
        useOlderChatMessages<ChatMessage>({
            roomId: selectedRoom,
            messages,
            containerRef: messagesContainerRef,
            onPrepend: (older) => setMessages(prev => prependUniqueMessages(prev, older)),
            onError: () => onNotification("이전 대화를 불러오지 못했습니다. 잠시 후 다시 시도해주세요", "error"),
        });
    const stompClientRef = useRef<Client | null>(null);
    const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
    const longPressTimerRef2 = useRef<NodeJS.Timeout | null>(null);

    const [companyId] = useState(() => typeof window !== "undefined" ? localStorage.getItem("companyId") : null);
    // 채팅에서 나를 가리키는 값. 관리자 계정은 접두사가 붙는다 — localStorage의 원시 userId와 다르다
    const [userId] = useState(() => getMyChatUserId());
    const [userName] = useState(() => typeof window !== "undefined" ? localStorage.getItem("userName") : null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        setShowNewMessageBadge(false);
    };

    /** 지금 스크롤이 맨 아래에서 120px 이내인지 — 이 안쪽일 때만 새 메시지를 따라 내려간다 */
    const isNearBottom = () => {
        const el = messagesContainerRef.current;
        if (!el) return true;
        return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    };

    /** 끝까지 내리면 새 메시지 배지를 치운다 (맨 위에서 옛 대화를 잇는 것은 훅이 맡는다) */
    const handleMessagesScroll = () => {
        if (showNewMessageBadge && isNearBottom()) setShowNewMessageBadge(false);
    };

    // 읽음 처리 API 호출 (lastMsgId는 반드시 인자로 전달)
    const markAsRead = useCallback(async (roomId: number, lastMsgId: number) => {
        if (!userId || !userName) return;

        try {
            await markChatAsRead(roomId, lastMsgId);

            // 로컬 unreadCount 즉시 0으로 갱신
            setRooms(prev => prev.map(room =>
                room.id === roomId ? { ...room, unreadCount: 0 } : room
            ));
            // 내 읽음 위치도 함께 옮긴다 — 안 그러면 남이 보낸 메시지 옆 숫자에
            // 내가 계속 '안 읽은 사람'으로 남는다 (서버는 내 읽음 이벤트를 나에게 되돌려주지 않는다)
            setParticipants(prev => prev.map(p =>
                p.userId === String(userId)
                    ? { ...p, lastReadMessageId: Math.max(p.lastReadMessageId ?? 0, lastMsgId) }
                    : p
            ));
        } catch (error) {
            console.error("Error marking messages as read:", error);
        }
    }, [userId, userName]);

    const fetchRooms = useCallback(async () => {
        if (!companyId || !userId) return;

        setIsLoadingRooms(true);
        try {
            const data = await fetchChatRooms();
            const roomList = Array.isArray(data) ? data : (data.rooms || data.content || data.data || []);
            hasLoadedRoomsRef.current = true; // setRooms로 인한 재렌더에서 배지 보고가 열리도록 먼저 세운다
            setRooms(roomList);
        } catch (error) {
            console.error("Error fetching rooms:", error);
            onNotification("채팅방 목록을 불러오지 못했습니다. 네트워크 연결을 확인해주세요", "error");
        } finally {
            setIsLoadingRooms(false);
        }
    }, [companyId, userId, onNotification]);

    // 메시지 로드 후 마지막 메시지 ID 반환 — 항상 '최신 대화'를 불러오는 경로이므로
    // 검색으로 오래된 구간에 점프해 있던 상태(isJumpedToOlder)도 여기서 함께 벗어난다
    const fetchMessages = useCallback(async (roomId: number): Promise<number | null> => {
        setIsLoadingMessages(true);
        resetOlderWindow();
        try {
            const data = await fetchChatMessages(roomId, 0, CHAT_PAGE_SIZE);
            const msgList = Array.isArray(data) ? data : (data.messages || data.content || data.data || []);
            // 백엔드가 createdAt DESC(최신순)로 반환하므로 뒤집어서 오래된 메시지가 위로
            const sorted = [...msgList].reverse();
            setMessages(sorted);
            // 요청한 만큼 꽉 찼으면 더 있다고 본다 (서버의 hasMore와 같은 관례)
            resetOlderWindow(data?.hasMore !== undefined ? Boolean(data.hasMore) : null);
            setIsJumpedToOlder(false);
            setTimeout(scrollToBottom, 100);
            // DESC 기준 첫 번째(= 가장 최신) 메시지의 ID 반환
            return msgList.length > 0 ? msgList[0].id : null;
        } catch (error) {
            console.error("Error fetching messages:", error);
            onNotification("메시지를 불러오지 못했습니다. 채팅방을 다시 선택해주세요", "error");
            return null;
        } finally {
            setIsLoadingMessages(false);
        }
    }, [onNotification]);

    // WebSocket 연결
    useEffect(() => {
        if (!userId) return;

        const client = new Client({
            webSocketFactory: () => new SockJS(`${BACKEND_WS_URL}/ws/chat`),
            // 서버 WS 인터셉터가 CONNECT 프레임의 Authorization 헤더를 요구한다
            connectHeaders: { Authorization: `Bearer ${localStorage.getItem("authToken") || ""}` },
            reconnectDelay: 5000,
            heartbeatIncoming: 10000,
            heartbeatOutgoing: 10000,
            onConnect: () => {
                // 연결 상태는 isConnected로 화면에 이미 드러나므로 콘솔 로그는 남기지 않는다
                setIsConnected(true);

                // 접속 상태 — 내가 붙었음을 알리고, 다른 사람의 상태 변화를 받는다.
                // (연결이 끊기면 서버가 알아서 오프라인 처리하므로 나갈 때 보낼 것은 없다)
                if (userId && companyId) {
                    client.publish({
                        destination: "/app/presence/join",
                        body: JSON.stringify({ userId, companyId }),
                    });
                    client.subscribe(`/topic/presence/${companyId}`, (frame: IMessage) => {
                        try {
                            const { userId: changedId, online } = JSON.parse(frame.body) as { userId: string; online: boolean };
                            setPresence(changedId, online);
                        } catch (error) {
                            console.error("[Presence] 상태 수신 처리 실패:", error);
                        }
                    });
                }
            },
            onDisconnect: () => {
                setIsConnected(false);
            },
            onStompError: (frame) => {
                console.error("[Chat WebSocket] STOMP 오류:", frame.headers["message"]);
            },
        });

        client.activate();
        stompClientRef.current = client;

        return () => {
            if (subscriptionRef.current) {
                subscriptionRef.current.unsubscribe();
                subscriptionRef.current = null;
            }
            client.deactivate();
            stompClientRef.current = null;
        };
    }, [userId, companyId, setPresence]);

    // 방 선택 시 또는 WebSocket 재연결 시 메시지 로드 → 읽음 처리
    useEffect(() => {
        if (!selectedRoom) return;
        (async () => {
            const lastMsgId = await fetchMessages(selectedRoom);
            if (lastMsgId) {
                markAsRead(selectedRoom, lastMsgId);
            }
        })();
    }, [selectedRoom, isConnected, fetchMessages, markAsRead]);

    // 기관 인원 목록 + 지금 접속 중인 사람 (첫 화면용 — 이후 변화는 WebSocket으로 받는다).
    // 이미 받았거나 받는 중이면 load()가 알아서 넘긴다
    useEffect(() => {
        if (!companyId) return;
        loadOrgPresence(companyId);
    }, [companyId, loadOrgPresence]);

    // 방 선택 시 WebSocket 구독 변경
    useEffect(() => {
        if (!selectedRoom || !stompClientRef.current || !isConnected) return;

        // 이전 구독 해제
        if (subscriptionRef.current) {
            subscriptionRef.current.unsubscribe();
            subscriptionRef.current = null;
        }

        // 새 방 구독
        const subscription = stompClientRef.current.subscribe(
            `/topic/chat/${selectedRoom}`,
            (stompMessage: IMessage) => {
                try {
                    const wsMessage: WebSocketMessage = JSON.parse(stompMessage.body);

                    // 누가 메시지를 지우면 그 자리를 '삭제된 메시지입니다'로 갈아끼운다
                    if (wsMessage.type === "DELETE" && wsMessage.message) {
                        const deleted = wsMessage.message;
                        setMessages(prev => prev.map(m => (m.id === deleted.id ? deleted : m)));
                        return;
                    }

                    if (wsMessage.type === "MESSAGE" && wsMessage.message) {
                        // 메시지가 목록에 붙기 전, 지금 스크롤 위치를 먼저 봐둔다
                        // (붙인 뒤에 재면 스크롤 높이가 이미 늘어나 있어 판단이 어긋난다)
                        const isMine = wsMessage.message.senderId === userId;
                        const wasNearBottom = isNearBottom();

                        // 남이 보낸 메시지는, 내가 옛 구간에 점프해 있는 동안은 이어붙이지 않는다
                        // (붙이면 그 사이 구간이 빠진 채 이어져 보인다) — 배지로만 알리고 끝낸다.
                        if (!isMine && isJumpedToOlderRef.current) {
                            setShowNewMessageBadge(true);
                            markAsRead(wsMessage.roomId, wsMessage.message.id);
                            return;
                        }

                        // 내가 보낸 메시지는 절대 놓치지 않는다. sendMessage/sendFileMessage가
                        // 보내기 전에 미리 최신으로 돌아가 두지만, 경합으로 그 복귀가 아직
                        // 끝나지 않은 채 이 메시지가 먼저 도착했을 수 있다 — 그때는 옛 구간
                        // 위에 내 메시지만 덜렁 붙이는 대신, 최신 목록을 통째로 다시 받아
                        // (이미 서버에 저장돼 있으니 그 안에 포함돼 있다) 자연스럽게 잇는다.
                        if (isMine && isJumpedToOlderRef.current) {
                            markAsRead(wsMessage.roomId, wsMessage.message.id);
                            fetchMessages(wsMessage.roomId);
                        } else {
                            setMessages(prev => {
                                // 중복 방지
                                if (prev.some(m => m.id === wsMessage.message!.id)) return prev;
                                return [...prev, wsMessage.message!];
                            });

                            // 내가 보낸 메시지는 항상 따라 내려간다. 남이 보낸 메시지는 내가 이미
                            // 맨 아래 근처를 보고 있을 때만 따라 내려가고, 아니면 배지로만 알린다
                            // (위쪽 대화를 읽던 중에 화면이 갑자기 끝으로 튀는 것을 막는다)
                            if (isMine || wasNearBottom) {
                                setTimeout(scrollToBottom, 100);
                            } else {
                                setShowNewMessageBadge(true);
                            }

                            // 현재 보고 있는 방이면 바로 읽음 처리
                            markAsRead(wsMessage.roomId, wsMessage.message.id);
                        }

                        // 방 목록의 마지막 메시지도 업데이트
                        setRooms(prevRooms => prevRooms.map(room => {
                            if (room.id === wsMessage.roomId && wsMessage.message) {
                                return {
                                    ...room,
                                    lastMessage: {
                                        content: wsMessage.message.content,
                                        senderName: wsMessage.message.senderName,
                                        createdAt: wsMessage.message.createdAt,
                                    },
                                    lastMessageAt: wsMessage.message.createdAt,
                                };
                            }
                            return room;
                        }));
                    }
                } catch (e) {
                    console.error("[Chat WebSocket] 메시지 파싱 오류:", e);
                }
            }
        );

        // 읽음 이벤트 구독
        const readSubscription = stompClientRef.current.subscribe(
            `/topic/chat/${selectedRoom}/read`,
            (stompMessage: IMessage) => {
                try {
                    const wsMessage = JSON.parse(stompMessage.body);
                    if (wsMessage.type === "READ" && wsMessage.senderId !== userId) {
                        // 그 사람이 '어디까지 읽었는지'만 옮긴다.
                        // 메시지마다 readCount를 올리는 방식은 같은 사람이 두 번 읽을 때
                        // 이전 메시지가 또 올라가 참가자 수를 넘어버린다.
                        setParticipants(prev => prev.map(p =>
                            p.userId === String(wsMessage.senderId)
                                ? { ...p, lastReadMessageId: wsMessage.lastReadMessageId ?? p.lastReadMessageId }
                                : p
                        ));
                    }
                } catch (e) {
                    console.error("[Chat WebSocket] 읽음 이벤트 파싱 오류:", e);
                }
            }
        );

        subscriptionRef.current = subscription;

        return () => {
            subscription.unsubscribe();
            readSubscription.unsubscribe();
        };
    }, [selectedRoom, isConnected, fetchMessages, markAsRead, userId]);

    const QUICK_EMOJIS = ["❤️", "👍", "😂", "😮", "😢", "✅"];

    /**
     * 내 메시지 삭제. 서버는 지우지 않고 '삭제됨'으로만 바꾸므로(소프트 삭제)
     * 화면에서도 지우지 않고 그 자리에 "삭제된 메시지입니다"를 남긴다.
     */
    const handleDeleteMessage = async (messageId: number) => {
        if (!selectedRoom) return;
        setContextMenuMessageId(null);
        setPendingDeleteMessageId(null);

        // 낙관적 업데이트 — 왕복을 기다리는 동안 눌린 게 반영 안 된 것처럼 보이지 않게
        setMessages(prev => prev.map(msg => (msg.id === messageId ? { ...msg, isDeleted: true } : msg)));
        try {
            await deleteChatMessage(selectedRoom, messageId);
        } catch (error) {
            console.error('[ChatManagement] 메시지 삭제 실패:', error);
            // 되돌릴 때 목록을 통째로 되돌리면, 그 사이 도착한 새 메시지가 사라진다.
            // 건드린 한 건만 원래대로 돌린다.
            setMessages(prev => prev.map(msg => (msg.id === messageId ? { ...msg, isDeleted: false } : msg)));
            onNotification('메시지를 삭제하지 못했습니다. 잠시 후 다시 시도해주세요', 'error');
        }
    };

    const handleToggleReaction = async (messageId: number, emoji: string) => {
        if (!userId || !selectedRoom) return;
        setContextMenuMessageId(null);

        // 낙관적 업데이트
        setMessages(prev => prev.map(msg => {
            if (msg.id !== messageId) return msg;
            const reactions = [...(msg.reactions || [])];
            const existing = reactions.find(r => r.emoji === emoji);
            if (existing?.myReaction) {
                if (existing.count <= 1) return { ...msg, reactions: reactions.filter(r => r.emoji !== emoji) };
                return { ...msg, reactions: reactions.map(r => r.emoji === emoji ? { ...r, count: r.count - 1, myReaction: false } : r) };
            } else if (existing) {
                return { ...msg, reactions: reactions.map(r => r.emoji === emoji ? { ...r, count: r.count + 1, myReaction: true } : r) };
            }
            return { ...msg, reactions: [...reactions, { emoji, count: 1, userNames: [userName || ""], myReaction: true }] };
        }));

        try {
            await toggleChatReaction(selectedRoom, messageId, emoji);
        } catch (error) {
            console.error("Error toggling reaction:", error);
        }
    };

    const sendMessage = async () => {
        if (!messageInput.trim() || !selectedRoom || !userId || !userName) return;

        // 옛 대화 구간에 점프해 있는 채로 보내면 카톡처럼 자동으로 최신 대화로 돌아간다.
        // (발행 전에 미리 돌아가 둔다 — 아래 웹소켓 핸들러도 내 메시지는 안전망으로
        // 절대 버리지 않지만, 그것만 믿으면 옛 구간 위에 내 메시지만 덜렁 붙어 그 사이
        // 구간이 빠진 채로 보이게 된다)
        if (isJumpedToOlderRef.current) {
            await returnToLatestMessages();
        }

        const replyToId = replyTo?.id || null;
        const client = stompClientRef.current;

        if (client && isConnected) {
            setIsSendingMessage(true);
            try {
                client.publish({
                    destination: `/app/chat/${selectedRoom}/send`,
                    body: JSON.stringify({
                        senderId: userId,
                        senderName: userName,
                        type: "TEXT",
                        content: messageInput.trim(),
                        replyToId,
                    }),
                });
                setMessageInput("");
                setReplyTo(null);
            } catch (error) {
                console.error("Error sending message via WebSocket:", error);
                await sendMessageREST();
            } finally {
                setIsSendingMessage(false);
            }
        } else {
            await sendMessageREST();
        }
    };

    const sendMessageREST = async () => {
        if (!messageInput.trim() || !selectedRoom || !userId || !userName) return;

        const replyToId = replyTo?.id || null;
        setIsSendingMessage(true);
        try {
            const response = await sendChatMessage(selectedRoom, {
                senderId: userId,
                senderName: userName,
                type: "TEXT",
                content: messageInput.trim(),
                replyToId,
            });

            // 백엔드가 { success, message } wrapper로 반환하므로 unwrap
            const newMessage = response.message || response;

            setMessages(prev => {
                if (prev.some(m => m.id === newMessage.id)) return prev;
                return [...prev, newMessage];
            });
            setMessageInput("");
            setReplyTo(null);
            setTimeout(scrollToBottom, 100);
            fetchRooms();
        } catch (error) {
            console.error("Error sending message:", error);
            onNotification("메시지 전송에 실패했습니다. 다시 시도해주세요", "error");
        } finally {
            setIsSendingMessage(false);
        }
    };

    /**
     * 파일·사진 전송.
     *
     * 앱과 같은 채팅 전용 업로드 엔드포인트를 쓴다 — 서버가 S3 저장부터 메시지 생성,
     * 열람 가능한 절대 URL 변환까지 한 번에 처리해서 웹·앱이 같은 형식을 갖는다.
     * (일반 파일 업로드 API는 상대 경로를 돌려줘 이미지가 그대로 뜨지 않는다)
     */
    const sendFileMessage = async (file: File) => {
        if (!selectedRoom || !userId || !userName) return;
        if (file.size > MAX_CHAT_FILE_SIZE) {
            onNotification(`파일은 ${MAX_CHAT_FILE_SIZE / (1024 * 1024)}MB까지 보낼 수 있습니다`, "error");
            return;
        }

        // 텍스트 전송과 같은 이유로, 옛 대화 구간에서 파일을 보내도 최신 대화로 돌아간다
        if (isJumpedToOlderRef.current) {
            await returnToLatestMessages();
        }

        setIsUploadingFile(true);
        try {
            const response = await uploadChatFile(selectedRoom, file, userId, userName);
            const newMessage = response.message || response;
            setMessages(prev => (prev.some(m => m.id === newMessage.id) ? prev : [...prev, newMessage]));
            setReplyTo(null);
            setTimeout(scrollToBottom, 100);
            fetchRooms();
        } catch (error) {
            console.error("파일 전송 실패:", error);
            onNotification("파일 전송에 실패했습니다. 파일을 다시 첨부해주세요", "error");
        } finally {
            setIsUploadingFile(false);
        }
    };

    /**
     * 입력값이 바뀔 때 @호출 후보를 띄운다.
     * 마지막 '@' 뒤에 공백이 없을 때만 (문장 중간의 이메일 등은 걸리지 않게 앞이 공백/처음일 때만).
     */
    const handleMessageInputChange = (value: string) => {
        setMessageInput(value);

        const atIndex = value.lastIndexOf("@");
        if (atIndex < 0) {
            setMentionQuery(null);
            return;
        }
        const charBefore = atIndex === 0 ? " " : value[atIndex - 1];
        const after = value.slice(atIndex + 1);
        if (/\s/.test(charBefore) && !/\s/.test(after)) {
            setMentionQuery(after);
        } else {
            setMentionQuery(null);
        }
    };

    /** 추천에서 고른 사람을 '@이름 '으로 바꿔 넣는다 */
    const applyMention = (name: string) => {
        const atIndex = messageInput.lastIndexOf("@");
        if (atIndex < 0) return;
        setMessageInput(`${messageInput.slice(0, atIndex)}@${name} `);
        setMentionQuery(null);
    };

    /** 호출 후보 — 나를 뺀 참가자 중 입력한 글자로 시작하는 사람 */
    const mentionCandidates = useMemo(() => {
        if (mentionQuery === null) return [];
        const q = mentionQuery.trim().toLowerCase();
        return participants
            .filter((p) => p.userId !== userId)
            .filter((p) => !q || p.userName.toLowerCase().includes(q))
            .slice(0, 6);
    }, [mentionQuery, participants, userId]);

    /**
     * 1:1 대화 열기.
     *
     * 같은 사람과의 방이 이미 있으면 새로 만들지 않고 그 방을 연다 — 매번 새 방이 생기면
     * 대화가 흩어져 쓸모가 없어진다. 판별은 '나와 상대 둘만 있는 방' 기준.
     */
    const openDirectChat = async (member: { id: string; name: string }) => {
        if (!userId || !userName || isOpeningDirect) return;

        setIsOpeningDirect(true);
        try {
            const { roomId, isNew } = await openOrCreateDirectRoom({ rooms, member, userId, userName });
            // 새로 만들었을 때만 목록을 다시 받아야 방이 목록에 나타난다
            if (isNew) await fetchRooms();
            if (roomId) setSelectedRoom(roomId);
            setListTab('rooms');
        } catch (error) {
            console.error("1:1 대화 열기 실패:", error);
            onNotification("대화를 열지 못했습니다. 잠시 후 다시 시도해주세요", "error");
        } finally {
            setIsOpeningDirect(false);
        }
    };

    /** 내 프로필 사진 — 인원 목록에 내가 섞여 있으므로 거기서 꺼낸다 */
    const myProfileImageUrl = useMemo(
        () => orgMembers.find(m => m.id === userId)?.profileImageUrl ?? null,
        [orgMembers, userId],
    );

    /** 온라인인 사람을 위로 올리고, 그 안에서는 이름순 */
    const sortedMembers = useMemo(
        () => sortMembersByPresence(orgMembers, onlineUserIds, userId),
        [orgMembers, onlineUserIds, userId],
    );

    /** 정보 서랍의 사진/파일 섹션 — 렌더마다 messages.filter가 6번씩 돌던 것을 한 번씩만 계산 */
    const drawerImageMessages = useMemo(
        () => messages.filter(m => m.type === "IMAGE" && m.fileUrl),
        [messages],
    );
    const drawerFileMessages = useMemo(
        () => messages.filter(m => m.type === "FILE" && m.fileUrl),
        [messages],
    );

    /** 방 안 메시지 검색 */
    const runSearch = async () => {
        if (!selectedRoom || !searchKeyword.trim()) return;
        setIsSearching(true);
        try {
            const response = await searchChatMessages(selectedRoom, searchKeyword.trim());
            setSearchResults(response.messages || []);
        } catch (error) {
            console.error("메시지 검색 실패:", error);
            onNotification("검색에 실패했습니다. 잠시 후 다시 시도해주세요", "error");
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    /** 메시지 하나로 스크롤 + 잠깐 강조 (검색 패널이 접히는 레이아웃 변화가 끝난 뒤 스크롤한다) */
    const scrollToMessageAndHighlight = (messageId: number) => {
        setTimeout(() => {
            document.getElementById(`chat-message-${messageId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 50);
        setHighlightedMessageId(messageId);
        setTimeout(() => setHighlightedMessageId(null), 2000);
    };

    /**
     * 검색 결과를 눌러 그 메시지로 이동한다.
     *
     * 지금 로드된 목록(최근 50건)에 있으면 그냥 스크롤해서 보여주고 잠깐 강조한다.
     * 더 오래된 메시지라 목록에 없으면, 그 메시지를 중심으로 앞뒤를 불러오는
     * `/messages/around` API로 목록을 통째로 그 구간으로 바꿔치기한다.
     * 그 구간 뒤로 더 최신 메시지가 남아 있으면(hasAfter) 지금 화면이 대화의 꼬리가
     * 아니라는 뜻이라 '최신 대화로 돌아가기'를 띄운다.
     */
    const handleSearchResultClick = async (message: ChatMessage) => {
        setSidePanel(null);

        if (messages.some(m => m.id === message.id)) {
            scrollToMessageAndHighlight(message.id);
            return;
        }

        if (!selectedRoom) return;
        setIsLoadingMessages(true);
        resetOlderWindow();
        try {
            const data = await fetchChatMessagesAround(selectedRoom, message.id, CHAT_PAGE_SIZE);
            const msgList: ChatMessage[] = Array.isArray(data) ? data : (data.messages || []);
            if (msgList.length === 0) throw new Error("빈 응답");
            // 기존 /messages와 같은 최신순(DESC) 정렬 — 뒤집어야 오래된 메시지가 위로 온다
            const sorted = [...msgList].reverse();
            setMessages(sorted);
            resetOlderWindow(Boolean(data?.hasBefore));
            setIsJumpedToOlder(Boolean(data?.hasAfter));
            scrollToMessageAndHighlight(message.id);
        } catch (error) {
            console.error("메시지 주변 조회 실패:", error);
            // 403(참가자 아님)·404(지운 메시지 등)·네트워크 오류 모두 같은 안내로 폴백한다
            onNotification("더 오래된 대화에 있는 메시지라 지금은 이동할 수 없습니다. 잠시 후 다시 시도해주세요", "error");
        } finally {
            setIsLoadingMessages(false);
        }
    };

    /**
     * 점프해 있던 구간을 접고 최신 대화로 돌아간다.
     * 메시지 전송 앞에서 이 완료를 기다려 쓰기도 하므로(끝난 뒤에야 isJumpedToOlder가
     * false가 됨을 보장) Promise를 그대로 반환한다.
     */
    const returnToLatestMessages = () => {
        if (!selectedRoom) return Promise.resolve(null);
        setHighlightedMessageId(null);
        return fetchMessages(selectedRoom); // 내부에서 isJumpedToOlder도 false로 되돌리고 맨 아래로 스크롤한다
    };

    /** 방에서 주고받은 파일 모아보기 */
    const loadSharedFiles = async () => {
        if (!selectedRoom) return;
        setIsLoadingFiles(true);
        try {
            const response = await fetchChatSharedFiles(selectedRoom);
            setSharedFiles(response.files || []);
        } catch (error) {
            console.error("파일 목록 로드 실패:", error);
            onNotification("파일 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요", "error");
            setSharedFiles([]);
        } finally {
            setIsLoadingFiles(false);
        }
    };

    /** 방 공지 등록/해제 — messageId가 null이면 내린다 */
    const changeNotice = async (messageId: number | null) => {
        if (!selectedRoom) return;
        setIsUpdatingNotice(true);
        try {
            const response = await updateChatRoomNotice(selectedRoom, messageId, userName || "");
            const updated = response.room;
            // 목록 쪽 방 정보에 공지를 반영해야 상단 바가 바로 갱신된다
            setRooms(prev => prev.map(r => (r.id === selectedRoom ? { ...r, ...updated } : r)));
            setContextMenuMessageId(null);
            setIsNoticeExpanded(false);
            onNotification(messageId === null ? "공지를 내렸습니다" : "공지로 등록했습니다", "success");
        } catch (error) {
            console.error("공지 변경 실패:", error);
            onNotification("공지 변경에 실패했습니다. 잠시 후 다시 시도해주세요", "error");
        } finally {
            setIsUpdatingNotice(false);
        }
    };

    const handleFilePick = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        // 같은 파일을 연달아 보낼 수 있게 값을 비운다
        event.target.value = "";
        if (file) sendFileMessage(file);
    };

    /** 여러 개를 한 번에 떨어뜨려도 보낸 순서가 뒤섞이지 않게 하나씩 올린다 */
    const sendFiles = async (files: File[]) => {
        for (const file of files) {
            await sendFileMessage(file);
        }
    };

    /** 대화 영역에 파일을 떨어뜨려 보내기 */
    const handleDragEnter = (event: React.DragEvent) => {
        if (!selectedRoom || !event.dataTransfer.types.includes("Files")) return;
        dragDepthRef.current += 1;
        setIsDraggingFile(true);
    };

    const handleDragOver = (event: React.DragEvent) => {
        if (!selectedRoom || !event.dataTransfer.types.includes("Files")) return;
        // 막지 않으면 브라우저가 파일을 새 탭으로 열어버린다
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
    };

    const handleDragLeave = () => {
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
        if (dragDepthRef.current === 0) setIsDraggingFile(false);
    };

    const handleDrop = (event: React.DragEvent) => {
        if (!selectedRoom || !event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        dragDepthRef.current = 0;
        setIsDraggingFile(false);
        const files = Array.from(event.dataTransfer.files);
        if (files.length > 0) sendFiles(files);
    };

    /** 캡쳐한 화면을 Cmd+V로 바로 보내기 — 클립보드에 이미지가 있을 때만 가로챈다 */
    const handlePaste = (event: React.ClipboardEvent) => {
        if (!selectedRoom) return;
        const files = Array.from(event.clipboardData.files);
        if (files.length === 0) return;
        // 글자와 이미지가 함께 담긴 경우가 있어, 이미지가 있을 때만 붙여넣기를 가로챈다
        event.preventDefault();
        sendFiles(files);
    };

    const closeCreateModal = () => {
        setShowCreateModal(false);
        setNewRoomName("");
        setNewRoomDescription("");
        setNewRoomParticipantIds([]);
    };

    const toggleNewRoomParticipant = (id: string) => {
        setNewRoomParticipantIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const createRoom = async () => {
        if (!newRoomName.trim() || !companyId || !userId || !userName || isCreatingRoom) return;

        setIsCreatingRoom(true);
        try {
            const response = await createChatRoom({
                name: newRoomName.trim(),
                description: newRoomDescription.trim() || undefined,
                creatorId: userId,
                creatorName: userName,
                // 서버는 만든 사람을 자동으로 넣어주지 않는다 — 내가 빠지면 내 목록에 안 보인다
                participantIds: [userId, ...newRoomParticipantIds],
            });

            onNotification("채팅방이 생성되었습니다", "success");
            closeCreateModal();
            await fetchRooms();

            // 만들자마자 그 방을 펴 준다 (목록에서 다시 찾게 하지 않는다)
            const createdId = (response?.room ?? response)?.id;
            if (typeof createdId === "number") setSelectedRoom(createdId);
        } catch (error) {
            console.error("Error creating room:", error);
            onNotification(error instanceof Error ? error.message : "채팅방 생성에 실패했습니다. 잠시 후 다시 시도해주세요", "error");
        } finally {
            setIsCreatingRoom(false);
        }
    };

    /** 열려 있는 방에 고른 사람들을 부른다 */
    const inviteToRoom = async () => {
        if (!selectedRoom || inviteIds.length === 0 || isInviting) return;

        setIsInviting(true);
        try {
            await addChatParticipants(selectedRoom, inviteIds);
            onNotification(`${inviteIds.length}명을 초대했습니다`, "success");
            setShowInviteModal(false);
            setInviteIds([]);
            // 참가자 수는 방 목록에도 붙어 있어 둘 다 다시 받는다
            await Promise.all([fetchParticipants(selectedRoom), fetchRooms()]);
        } catch (error) {
            console.error("Error inviting participants:", error);
            onNotification(error instanceof Error ? error.message : "초대에 실패했습니다. 잠시 후 다시 시도해주세요", "error");
        } finally {
            setIsInviting(false);
        }
    };

    const fetchParticipants = useCallback(async (roomId: number) => {
        setIsLoadingParticipants(true);
        try {
            const data = await fetchChatParticipants(roomId);
            const list = Array.isArray(data) ? data : (data.participants || data.content || data.data || []);
            setParticipants(list);
            setParticipantsReady(true);
        } catch (error) {
            console.error("Error fetching participants:", error);
        } finally {
            setIsLoadingParticipants(false);
        }
    }, []);

    // 방을 열면 참가자를 받아둔다 — 메시지 옆 '안 읽은 수'를 참가자별 읽음 위치로 세므로
    // 참가자 서랍을 열지 않아도 필요하다
    useEffect(() => {
        // 방을 바꾸는 순간부터는 이전 방의 참가자 값이라 '모른다' 상태로 되돌린다
        // (재조회가 끝나기 전까지 이전 방 기준 안읽음 수가 잘못 보이는 것을 막는다)
        setParticipantsReady(false);
        if (selectedRoom) fetchParticipants(selectedRoom);
    }, [selectedRoom, fetchParticipants]);

    // 셸에 지금 보고 있는 방을 알린다 — 우측 레일의 새 메시지 토스트가 이 방만 건너뛴다
    useEffect(() => {
        onActiveRoomChange?.(selectedRoom);
        return () => onActiveRoomChange?.(null);
    }, [selectedRoom, onActiveRoomChange]);

    const deleteRoom = async () => {
        if (!selectedRoom) return;

        setIsDeletingRoom(true);
        try {
            await deleteChatRoom(selectedRoom);

            onNotification("채팅방이 삭제되었습니다", "success");
            setShowDeleteConfirm(false);
            setShowDrawer(false);
            setSelectedRoom(null);
            setMessages([]);
            fetchRooms();
        } catch (error) {
            console.error("Error deleting room:", error);
            onNotification("채팅방 삭제에 실패했습니다. 잠시 후 다시 시도해주세요", "error");
        } finally {
            setIsDeletingRoom(false);
        }
    };

    /** 나가기 — 방은 그대로 남고 나만 참가자 목록에서 빠진다. 삭제와 달리 되돌릴 수 없다는 문구를 확인받는다 */
    const leaveRoom = async () => {
        if (!selectedRoom) return;

        setIsLeavingRoom(true);
        try {
            await leaveChatRoom(selectedRoom);

            onNotification("채팅방에서 나갔습니다", "success");
            setShowLeaveConfirm(false);
            setShowDrawer(false);
            setSelectedRoom(null);
            setMessages([]);
            fetchRooms();
        } catch (error) {
            console.error("Error leaving room:", error);
            onNotification("채팅방 나가기에 실패했습니다. 잠시 후 다시 시도해주세요", "error");
        } finally {
            setIsLeavingRoom(false);
        }
    };

    const toggleDrawer = () => {
        // 서랍을 열 때마다 다시 받아 이름·프로필이 최신이 되게 한다 (읽음 위치는 아래 effect가 이미 채워둔다)
        if (!showDrawer && selectedRoom) {
            fetchParticipants(selectedRoom);
        }
        setShowDrawer(!showDrawer);
    };

    const formatMessageTime = (timestamp: string) => {
        const date = new Date(timestamp);
        const hours = date.getHours();
        const minutes = String(date.getMinutes()).padStart(2, "0");
        const ampm = hours >= 12 ? "오후" : "오전";
        const displayHours = hours % 12 || 12;

        return `${ampm} ${displayHours}:${minutes}`;
    };

    // 초기 방 목록 로드 + 30초 주기 갱신 (보고 있는 탭에서만)
    // 소켓은 지금 열어둔 방만 구독하므로, 다른 방의 새 메시지·안읽음 수는 이 갱신으로 받는다.
    useVisiblePolling(fetchRooms, 30000);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        // 한글 조합 중의 Enter는 '조합 확정'이지 전송이 아니다.
        // 거르지 않으면 "알림"을 치고 Enter를 눌렀을 때 조합 중인 값으로 한 번 보내고,
        // 입력창이 비워진 뒤 확정된 "림"이 들어가 두 번째 Enter에 또 나간다.
        // 확정 뒤 브라우저가 Enter keydown을 한 번 더 주므로 이걸 걸러도 Enter 한 번에 전송된다.
        if (e.nativeEvent.isComposing) return;
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    if (!companyId || !userId || !userName) {
        return (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 384 }}>
                <Text type="body" color="secondary">로그인 정보를 확인할 수 없습니다</Text>
            </div>
        );
    }

    return (
        <div
            style={{
                display: "flex",
                flex: 1,
                minHeight: 0,
                background: C.card,
                borderRadius: 'var(--radius-element)',
                boxShadow: 'var(--shadow-low)',
                border: `1px solid ${C.border}`,
                overflow: "hidden",
            }}
        >
            {/* Left Panel - Room List */}
            <div style={{ width: "33.3333%", borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column" }}>
                {/* Header */}
                <div style={{ padding: 'var(--spacing-4)', borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <HStack gap={2} vAlign="center">
                        <Text type="large" weight="semibold">채팅</Text>
                        <StatusDot
                            variant={isConnected ? "success" : "neutral"}
                            label={isConnected ? "실시간 연결됨" : "연결 중..."}
                            tooltip={isConnected ? "실시간 연결됨" : "연결 중..."}
                            isPulsing={isConnected}
                        />
                    </HStack>
                    {isAdmin && (
                        <Button label="새 채팅방" variant="primary" size="sm" onClick={() => setShowCreateModal(true)} />
                    )}
                </div>

                {/* 대화 / 직원 전환 */}
                <div style={{ padding: 'var(--spacing-2) var(--spacing-3)', borderBottom: `1px solid ${C.border}` }}>
                    <SegmentedControl
                        label="목록 전환"
                        value={listTab}
                        onChange={(value) => setListTab(value as 'rooms' | 'people')}
                        layout="fill"
                    >
                        <SegmentedControlItem value="rooms" label={`대화 (${rooms.length})`} />
                        <SegmentedControlItem value="people" label={`직원 (${sortedMembers.length})`} />
                    </SegmentedControl>
                </div>

                {/* 직원 목록 — 온라인이 위, 누르면 1:1 대화 */}
                {listTab === 'people' && (
                    <div style={{ flex: 1, overflowY: "auto" }}>
                        {/* 맨 위는 내 프로필 — 이 화면을 보고 있다는 것 자체가 접속 중이라는 뜻 */}
                        <div style={{ borderBottom: `1px solid ${C.border}`, background: C.bgGray }}>
                            <MemberItem
                                name={userName || "나"}
                                suffix="나"
                                imageUrl={myProfileImageUrl}
                                presence="online"
                            />
                        </div>

                        {sortedMembers.length === 0 ? (
                            <div style={{ padding: 'var(--spacing-6)' }}>
                                <EmptyState isCompact title="등록된 직원이 없습니다" />
                            </div>
                        ) : (
                            sortedMembers.map((member) => (
                                <div key={member.id} style={{ borderBottom: `1px solid ${C.gray100}` }}>
                                    <MemberItem
                                        name={member.name}
                                        role={member.position}
                                        imageUrl={member.profileImageUrl}
                                        presence={onlineUserIds.has(member.id) ? 'online' : 'offline'}
                                        isDisabled={isOpeningDirect}
                                        onClick={() => openDirectChat(member)}
                                        endContent={<Icon icon={FiMessageCircle} size="sm" color="tertiary" />}
                                    />
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* Room List */}
                {listTab === 'rooms' && (
                <div style={{ flex: 1, overflowY: "auto" }}>
                    {isLoadingRooms ? (
                        <Loading size="inline" height={128} label="채팅방을 불러오는 중..." />
                    ) : rooms.length === 0 ? (
                        <div style={{ padding: 'var(--spacing-6)' }}>
                            <EmptyState
                                isCompact
                                icon={<Icon icon={FiMessageCircle} size="lg" color="tertiary" />}
                                title="채팅방이 없습니다"
                            />
                        </div>
                    ) : (
                        rooms.map((room) => {
                            const isSelected = selectedRoom === room.id;
                            const roomTime = room.lastMessageAt || room.lastMessage?.createdAt;
                            return (
                                <Item
                                    key={room.id}
                                    onClick={() => { setSelectedRoom(room.id); setShowDrawer(false); }}
                                    isSelected={isSelected}
                                    align="start"
                                    label={room.name}
                                    labelLines={1}
                                    description={
                                        <VStack gap={0.5}>
                                            <Text type="supporting" maxLines={1}>
                                                {room.lastMessage
                                                    ? `${room.lastMessage.senderName}: ${room.lastMessage.content}`
                                                    : "메시지가 없습니다"}
                                            </Text>
                                            <Text type="supporting">참여자 {room.participantCount}명</Text>
                                        </VStack>
                                    }
                                    endContent={
                                        <VStack gap={1} hAlign="end">
                                            {roomTime && (
                                                <Timestamp value={roomTime} format="auto" hasTooltip type="supporting" />
                                            )}
                                            {room.unreadCount > 0 && (
                                                <Badge
                                                    variant="error"
                                                    label={room.unreadCount > 99 ? "99+" : String(room.unreadCount)}
                                                />
                                            )}
                                        </VStack>
                                    }
                                />
                            );
                        })
                    )}
                </div>
                )}
            </div>

            {/* Right Panel - Messages */}
            <div
                style={{ width: "66.6667%", display: "flex", flexDirection: "column", position: "relative" }}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onPaste={handlePaste}
            >
                {/* 파일을 끌어온 동안만 덮는 안내 — 마우스 이벤트는 통과시켜 drop이 아래 영역에서 잡히게 둔다 */}
                {isDraggingFile && (
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            zIndex: 20,
                            pointerEvents: "none",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: 'var(--color-background-teal)',
                            border: `2px dashed ${C.accent}`,
                            borderRadius: 'var(--radius-container)',
                        }}
                    >
                        <div style={{ background: C.card, padding: 'var(--spacing-4) var(--spacing-6)', borderRadius: 'var(--radius-container)', boxShadow: 'var(--shadow-high)' }}>
                            <HStack gap={2} vAlign="center">
                                <Icon icon={FiPaperclip} size="md" color="accent" />
                                <Text type="large" weight="semibold">여기에 놓으면 바로 보냅니다</Text>
                            </HStack>
                        </div>
                    </div>
                )}
                {selectedRoom ? (
                    <>
                        {/* Header */}
                        <div style={{ padding: 'var(--spacing-4)', borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div>
                                <Text type="large" weight="semibold">
                                    {rooms.find(r => r.id === selectedRoom)?.name || "채팅방"}
                                </Text>
                                <div>
                                    <Text type="supporting">
                                        참여자 {rooms.find(r => r.id === selectedRoom)?.participantCount || 0}명
                                    </Text>
                                </div>
                            </div>
                            <HStack gap={1}>
                                <IconButton
                                    label="메시지 검색"
                                    tooltip="이 방에서 검색"
                                    variant={sidePanel === 'search' ? 'secondary' : 'ghost'}
                                    icon={<Icon icon="search" />}
                                    onClick={() => setSidePanel(sidePanel === 'search' ? null : 'search')}
                                />
                                <IconButton
                                    label="파일 모아보기"
                                    tooltip="주고받은 파일"
                                    variant={sidePanel === 'files' ? 'secondary' : 'ghost'}
                                    icon={<Icon icon={FiPaperclip} />}
                                    onClick={() => { setSidePanel(sidePanel === 'files' ? null : 'files'); if (sidePanel !== 'files') loadSharedFiles(); }}
                                />
                                <IconButton
                                    label="채팅방 정보"
                                    variant="ghost"
                                    icon={<Icon icon="menu" />}
                                    onClick={toggleDrawer}
                                />
                                {/*
                                  더보기 — 앱 채팅방 헤더의 ⋮ 메뉴와 같은 자리에 같은 항목을 둔다.
                                  검색·파일·정보는 웹에선 화면이 넓어 아이콘으로 바로 꺼내 두고,
                                  되돌릴 수 없는 삭제만 이 메뉴 안에 넣는다.
                                */}
                                <div style={{ position: "relative" }}>
                                    <IconButton
                                        label="더보기"
                                        variant={showRoomMenu ? 'secondary' : 'ghost'}
                                        icon={<Icon icon="moreHorizontal" />}
                                        onClick={() => setShowRoomMenu(!showRoomMenu)}
                                    />
                                    {showRoomMenu && (
                                        <>
                                            {/* 바깥 아무 데나 누르면 닫힌다 */}
                                            <div
                                                style={{ position: "fixed", inset: 0, zIndex: 30 }}
                                                onClick={() => setShowRoomMenu(false)}
                                            />
                                            <div
                                                style={{
                                                    position: "absolute",
                                                    zIndex: 40,
                                                    top: "100%",
                                                    right: 0,
                                                    marginTop: 'var(--spacing-1)',
                                                    minWidth: 160,
                                                    background: C.card,
                                                    border: `1px solid ${C.border}`,
                                                    borderRadius: 'var(--radius-element)',
                                                    boxShadow: 'var(--shadow-high)',
                                                    overflow: "hidden",
                                                }}
                                            >
                                                {/* 나가기 — 나만 방에서 빠진다. 방·메시지는 그대로 남는다 (삭제와 다르다) */}
                                                <Button
                                                    label="채팅방 나가기"
                                                    variant="ghost"
                                                    size="sm"
                                                    icon={<Icon icon={FiLogOut} size="sm" />}
                                                    onClick={() => { setShowRoomMenu(false); setShowLeaveConfirm(true); }}
                                                    style={{ width: "100%", justifyContent: "flex-start" }}
                                                />
                                                {isAdmin && (
                                                    <Button
                                                        label="채팅 삭제"
                                                        variant="ghost"
                                                        size="sm"
                                                        icon={<Icon icon={FiTrash2} size="sm" color="error" />}
                                                        onClick={() => { setShowRoomMenu(false); setShowDeleteConfirm(true); }}
                                                        style={{ width: "100%", justifyContent: "flex-start" }}
                                                    />
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </HStack>
                        </div>

                        {/* 검색 / 파일함 패널 — 대화 위에 얹지 않고 헤더 아래 한 줄로 펼친다 */}
                        {sidePanel && (
                            <div style={{ borderBottom: `1px solid ${C.border}`, background: C.bgGray, maxHeight: 280, overflowY: "auto" }}>
                                {sidePanel === 'search' ? (
                                    <div style={{ padding: 'var(--spacing-3)' }}>
                                        <VStack gap={2}>
                                            <TextInput
                                                label="메시지 검색"
                                                isLabelHidden
                                                startIcon={FiSearch}
                                                value={searchKeyword}
                                                onChange={setSearchKeyword}
                                                onKeyDown={(e: React.KeyboardEvent) => {
                                                    // 조합 중 Enter는 글자를 확정하는 것이지 검색이 아니다
                                                    // (거르지 않으면 덜 완성된 말로 검색된다)
                                                    if (e.nativeEvent.isComposing) return;
                                                    if (e.key === 'Enter') runSearch();
                                                }}
                                                placeholder="찾을 말을 입력하고 Enter"
                                                hasClear
                                            />
                                            {isSearching ? (
                                                <Text type="supporting" color="secondary">검색 중...</Text>
                                            ) : searchResults === null ? (
                                                <Text type="supporting" color="secondary">이 방의 대화에서 찾습니다.</Text>
                                            ) : searchResults.length === 0 ? (
                                                <Text type="supporting" color="secondary">일치하는 메시지가 없습니다.</Text>
                                            ) : (
                                                <VStack gap={1}>
                                                    <Text type="supporting" color="secondary">{searchResults.length}건</Text>
                                                    {searchResults.map((m) => (
                                                        <button
                                                            key={m.id}
                                                            type="button"
                                                            onClick={() => handleSearchResultClick(m)}
                                                            style={{
                                                                display: "block", width: "100%", textAlign: "left",
                                                                padding: 'var(--spacing-2)', background: C.card,
                                                                border: `1px solid ${C.border}`, borderRadius: 'var(--radius-inner)',
                                                                cursor: "pointer",
                                                            }}
                                                        >
                                                            <Text type="supporting" weight="semibold" color="primary">
                                                                {m.senderName} · {formatMessageTime(m.createdAt)}
                                                            </Text>
                                                            <Text type="supporting" color="primary" maxLines={2}>{m.content}</Text>
                                                        </button>
                                                    ))}
                                                </VStack>
                                            )}
                                        </VStack>
                                    </div>
                                ) : (
                                    <div style={{ padding: 'var(--spacing-3)' }}>
                                        {isLoadingFiles ? (
                                            <Text type="supporting" color="secondary">불러오는 중...</Text>
                                        ) : sharedFiles.length === 0 ? (
                                            <Text type="supporting" color="secondary">주고받은 파일이 없습니다.</Text>
                                        ) : (
                                            <VStack gap={1}>
                                                {sharedFiles.map((m) => (
                                                    <button
                                                        key={m.id}
                                                        type="button"
                                                        onClick={() => {
                                                            if (!m.fileUrl) return;
                                                            const media = chatMediaType(m);
                                                            if (media === "IMAGE") setImagePreview({ items: [{ fileUrl: m.fileUrl, fileName: m.fileName || "이미지" }], index: 0 });
                                                            // 동영상은 뷰어가 그릴 줄 모른다 — 새 탭에서 브라우저 기본 재생기로 연다
                                                            else if (media === "VIDEO") window.open(m.fileUrl, "_blank", "noopener");
                                                            else if (isViewableDocument(m.fileName)) setViewerFile({ fileUrl: m.fileUrl, fileName: m.fileName || "문서" });
                                                            else window.open(m.fileUrl, "_blank", "noopener");
                                                        }}
                                                        style={{
                                                            display: "flex", alignItems: "center", gap: 'var(--spacing-2)', width: "100%",
                                                            padding: 'var(--spacing-2)', background: C.card, border: `1px solid ${C.border}`,
                                                            borderRadius: 'var(--radius-inner)', cursor: "pointer", textAlign: "left",
                                                        }}
                                                    >
                                                        <span>{chatMediaType(m) === "IMAGE" ? "📷" : chatMediaType(m) === "VIDEO" ? "🎬" : "📎"}</span>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <Text type="supporting" weight="semibold" color="primary" maxLines={1}>
                                                                {m.fileName || m.content}
                                                            </Text>
                                                            <Text type="supporting" color="secondary">
                                                                {m.senderName} · {formatMessageTime(m.createdAt)}
                                                            </Text>
                                                        </div>
                                                    </button>
                                                ))}
                                            </VStack>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 고정 공지 — 방에 들어오면 대화보다 먼저 눈에 들어와야 한다 */}
                        {(() => {
                            const room = rooms.find(r => r.id === selectedRoom);
                            if (!room?.noticeContent) return null;
                            return (
                                <div style={{
                                    display: "flex",
                                    alignItems: "flex-start",
                                    gap: 'var(--spacing-2)',
                                    padding: "var(--spacing-2) var(--spacing-4)",
                                    background: 'var(--color-background-yellow)',
                                    borderBottom: `1px solid ${C.border}`,
                                }}>
                                    <span style={{ flexShrink: 0, marginTop: 'var(--spacing-0-5)' }}>📌</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <Text type="supporting" weight="semibold" color="primary">공지</Text>
                                        <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                                            <Text type="supporting" color="primary" maxLines={isNoticeExpanded ? undefined : 2}>
                                                {room.noticeContent}
                                            </Text>
                                        </div>
                                        {room.noticeByName && (
                                            <Text type="supporting" color="secondary">{room.noticeByName} 등록</Text>
                                        )}
                                        {room.noticeFileUrl && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (isViewableDocument(room.noticeFileName ?? undefined)) {
                                                        setViewerFile({ fileUrl: room.noticeFileUrl!, fileName: room.noticeFileName || "문서" });
                                                    } else {
                                                        window.open(room.noticeFileUrl!, "_blank", "noopener");
                                                    }
                                                }}
                                                style={{
                                                    fontSize: 'var(--font-size-sm)',
                                                    textDecoration: "underline",
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: 'var(--spacing-1)',
                                                    color: C.accent,
                                                    background: "none",
                                                    border: "none",
                                                    padding: 0,
                                                    cursor: "pointer",
                                                    textAlign: "left",
                                                }}
                                            >
                                                📎 {room.noticeFileName || "첨부 파일"}
                                            </button>
                                        )}
                                    </div>
                                    <HStack gap={1}>
                                        <Button
                                            label={isNoticeExpanded ? "접기" : "펼치기"}
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setIsNoticeExpanded(v => !v)}
                                        />
                                        <Button
                                            label="내리기"
                                            variant="ghost"
                                            size="sm"
                                            isLoading={isUpdatingNotice}
                                            onClick={() => changeNotice(null)}
                                        />
                                    </HStack>
                                </div>
                            );
                        })()}

                        {/* Overlay for context menus */}
                        {contextMenuMessageId !== null && (
                            <div style={{ position: "fixed", inset: 0, zIndex: 30 }} onClick={() => setContextMenuMessageId(null)} />
                        )}

                        {/* Messages */}
                        <div
                            ref={messagesContainerRef}
                            {...olderScrollProps}
                            onScroll={() => { handleMessagesScroll(); olderScrollProps.onScroll(); }}
                            style={{ flex: 1, overflowY: "auto", padding: 'var(--spacing-4)', display: "flex", flexDirection: "column", gap: 'var(--spacing-3)', background: C.bgGray, position: "relative" }}
                        >
                            {/* 검색으로 오래된 구간에 점프해 있는 동안의 안내 — 스크롤 맨 위에 붙어(sticky) 계속 보인다 */}
                            {isJumpedToOlder && (
                                <div style={{ position: "sticky", top: 0, zIndex: 10, display: "flex", justifyContent: "center", marginBottom: 'var(--spacing-1)' }}>
                                    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-full)', boxShadow: 'var(--shadow-low)', padding: "var(--spacing-1) var(--spacing-1) var(--spacing-1) var(--spacing-3)", display: "flex", alignItems: "center", gap: 'var(--spacing-2)' }}>
                                        <Text type="supporting" color="secondary">지난 대화 구간을 보고 있습니다</Text>
                                        <Button label="최신 대화로 돌아가기" variant="secondary" size="sm" onClick={returnToLatestMessages} />
                                    </div>
                                </div>
                            )}
                            {/* 위로 더 올라갈 대화가 있는지 알려주는 줄 — 불러오는 중이면 로딩, 끝이면 시작 안내 */}
                            {!isLoadingMessages && messages.length > 0 && (
                                isLoadingOlder ? (
                                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 'var(--spacing-2)', padding: "var(--spacing-2) 0", flexShrink: 0 }}>
                                        <Spinner size="sm" aria-label="이전 대화를 불러오는 중" />
                                        <Text type="supporting" color="secondary">이전 대화를 불러오는 중...</Text>
                                    </div>
                                ) : !hasMoreOlder ? (
                                    <div style={{ display: "flex", justifyContent: "center", padding: "var(--spacing-2) 0", flexShrink: 0 }}>
                                        <Text type="supporting" color="disabled">대화의 시작입니다</Text>
                                    </div>
                                ) : null
                            )}
                            {isLoadingMessages ? (
                                <Loading height="100%" label="메시지를 불러오는 중..." />
                            ) : messages.length === 0 ? (
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                                    <EmptyState
                                        icon={<Icon icon={FiMessageCircle} size="lg" color="tertiary" />}
                                        title="메시지가 없습니다"
                                    />
                                </div>
                            ) : (
                                buildChatRenderItems(messages).map((item) => {
                                    // 연달아 온 사진은 한 말풍선(격자)으로 접힌다.
                                    // 대표 메시지는 묶음의 '마지막(가장 최신)' 장 — 시각 표시가 묶음이 끝난 시각이어야 하고,
                                    // 답장·반응·공지 등 메뉴도 이 메시지를 대상으로 삼는다.
                                    const message = item.kind === "photos" ? item.messages[item.messages.length - 1] : item.message;
                                    const photoGroup = item.kind === "photos" ? item.messages : null;
                                    const isMyMessage = message.senderId === userId;
                                    const isSystemMessage = message.type === "SYSTEM";
                                    const showDateSeparator = item.showDateSeparator;
                                    // 묶음의 '안 읽은 사람 수'는 가장 덜 읽힌 장 기준(최댓값) — 넉넉하게 잡는 쪽이 정직하다.
                                    // 참가자를 아직 못 받아온 장이 하나라도 있으면(null = 모른다) 0으로 눌러 쓰지 않고 그대로 null을 넘긴다.
                                    const groupUnread: number | null = photoGroup
                                        ? photoGroup.reduce<number | null>((acc, m) => {
                                            if (acc === null) return null;
                                            const each = countUnreadReaders(m);
                                            return each === null ? null : Math.max(acc, each);
                                        }, 0)
                                        : countUnreadReaders(message);
                                    const mediaType = chatMediaType(message);

                                    const dateSeparator = showDateSeparator ? (
                                        <div style={{ margin: "var(--spacing-3) 0" }}>
                                            <Divider label={formatDateSeparator(message.createdAt)} />
                                        </div>
                                    ) : null;

                                    if (isSystemMessage) {
                                        return (
                                            <Fragment key={message.id}>
                                                {dateSeparator}
                                                <div style={{ display: "flex", justifyContent: "center", fontStyle: "italic" }}>
                                                    <Text type="supporting" color="disabled">{message.content}</Text>
                                                </div>
                                            </Fragment>
                                        );
                                    }

                                    if (message.isDeleted) {
                                        return (
                                            <Fragment key={message.id}>
                                                {dateSeparator}
                                                <div style={{ display: "flex", justifyContent: isMyMessage ? "flex-end" : "flex-start", padding: "var(--spacing-2) var(--spacing-3)", fontStyle: "italic" }}>
                                                    <Text type="supporting" color="disabled">
                                                        삭제된 메시지입니다
                                                    </Text>
                                                </div>
                                            </Fragment>
                                        );
                                    }

                                    return (
                                        <Fragment key={message.id}>
                                            {dateSeparator}
                                            <div
                                                id={`chat-message-${message.id}`}
                                                style={{
                                                    display: "flex", position: "relative", justifyContent: isMyMessage ? "flex-end" : "flex-start", alignItems: "flex-end", gap: 'var(--spacing-2)',
                                                    borderRadius: 'var(--radius-container)',
                                                    transition: "background-color 0.3s ease",
                                                    // 검색 결과에서 찾아온 메시지를 잠깐 배경으로 알려준다
                                                    backgroundColor: highlightedMessageId === message.id ? 'var(--color-background-yellow)' : "transparent",
                                                }}
                                            >
                                                {!isMyMessage && (
                                                    <Avatar
                                                        src={participantAvatarMap.get(message.senderId || '') || undefined}
                                                        name={message.senderName || "?"}
                                                        size="small"
                                                    />
                                                )}
                                                <div style={{ maxWidth: "70%", display: "flex", flexDirection: "column", alignItems: isMyMessage ? "flex-end" : "flex-start" }}>
                                                    {!isMyMessage && (
                                                        <div style={{ marginBottom: 'var(--spacing-1)' }}>
                                                            <Text type="supporting" weight="medium" color="primary">
                                                                {message.senderName}
                                                            </Text>
                                                            {message.senderPosition && (
                                                                <Text type="supporting"> ({message.senderPosition})</Text>
                                                            )}
                                                        </div>
                                                    )}
                                                    <div className="carev-chat-msgrow" style={{ display: "flex", alignItems: "flex-end", gap: 'var(--spacing-2)' }}>
                                                        {isMyMessage && (
                                                            <>
                                                                {/* 롱프레스·우클릭의 유일한 대안 — 키보드로 답장/공지 메뉴에 닿을 수 있어야 한다 */}
                                                                {/* 평소엔 숨어 있다가 마우스를 올리거나 키보드 포커스가 오면 나타난다.
                                                                    아주 지워버리면 꾹 누르기·우클릭을 못 하는 키보드 사용자가
                                                                    답장·리액션·공지등록에 닿을 방법이 없어진다. */}
                                                                <span className="carev-chat-msgactions">
                                                                    <IconButton
                                                                        label="메시지 옵션"
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        icon={<Icon icon="moreHorizontal" size="sm" />}
                                                                        onClick={() => setContextMenuMessageId(contextMenuMessageId === message.id ? null : message.id)}
                                                                    />
                                                                </span>
                                                                <UnreadCount count={groupUnread} />
                                                                <Text type="supporting">
                                                                    {formatMessageTime(message.createdAt)}
                                                                </Text>
                                                            </>
                                                        )}
                                                        <div
                                                            style={{
                                                                position: "relative",
                                                                padding: "var(--spacing-2) var(--spacing-3)",
                                                                ...(isMyMessage
                                                                    // 저대비로 기각된 하드코딩 색 대신 테마 accent 토큰 사용 (AA 대비 확보)
                                                                    ? { background: C.accent, color: 'var(--color-on-accent)', borderRadius: 'var(--radius-container) var(--radius-inner) var(--radius-container) var(--radius-container)' }
                                                                    : { background: C.card, border: `1px solid ${C.borderStrong}`, color: C.gray900, borderRadius: 'var(--radius-inner) var(--radius-container) var(--radius-container) var(--radius-container)' }),
                                                            }}
                                                            onTouchStart={() => {
                                                                longPressTimerRef2.current = setTimeout(() => setContextMenuMessageId(message.id), 500);
                                                            }}
                                                            onTouchEnd={() => {
                                                                if (longPressTimerRef2.current) { clearTimeout(longPressTimerRef2.current); longPressTimerRef2.current = null; }
                                                            }}
                                                            onTouchCancel={() => {
                                                                if (longPressTimerRef2.current) { clearTimeout(longPressTimerRef2.current); longPressTimerRef2.current = null; }
                                                            }}
                                                            onContextMenu={(e) => { e.preventDefault(); setContextMenuMessageId(message.id); }}
                                                        >
                                                            {/* 답글 원본 미리보기 */}
                                                            {message.replyToId && (
                                                                <div
                                                                    style={{
                                                                        fontSize: 'var(--font-size-sm)',
                                                                        padding: "var(--spacing-1) var(--spacing-2)",
                                                                        marginBottom: 'var(--spacing-1-5)',
                                                                        borderRadius: 'var(--radius-inner)',
                                                                        borderLeft: isMyMessage ? "2px solid rgba(255,255,255,0.6)" : `2px solid ${C.gray300}`,
                                                                        background: isMyMessage ? "rgba(255,255,255,0.18)" : C.bgGray,
                                                                        color: isMyMessage ? "rgba(255,255,255,0.9)" : C.gray500,
                                                                    }}
                                                                >
                                                                    <div style={{ fontWeight: 'var(--font-weight-semibold)', overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{message.replyToSenderName}</div>
                                                                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", opacity: 0.8 }}>
                                                                        {/* 동영상은 저장된 type이 FILE이라 파생 필드(replyToMediaType)로만 구분된다 */}
                                                                        {message.replyToMediaType === "VIDEO" ? "🎬 동영상"
                                                                            : message.replyToType === "IMAGE" || message.replyToMediaType === "IMAGE" ? "📷 사진"
                                                                                : message.replyToType === "FILE" ? "📎 파일" : message.replyToContent}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {photoGroup ? (
                                                                // 연달아 온 사진 묶음 — 격자로 그리고, 누르면 그 묶음 안에서 좌우로 넘길 수 있다
                                                                <ChatPhotoGroup
                                                                    messages={photoGroup}
                                                                    maxWidth={360}
                                                                    onOpen={(openIndex) => setImagePreview({
                                                                        items: photoGroup.map(m => ({ fileUrl: m.fileUrl!, fileName: m.fileName || "이미지" })),
                                                                        index: openIndex,
                                                                    })}
                                                                />
                                                            ) : mediaType === "IMAGE" && message.fileUrl ? (
                                                                // img는 네이티브로 포커스를 못 받으므로 button으로 감싸 키보드로도 크게 보기를 열 수 있게 한다
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setImagePreview({ items: [{ fileUrl: message.fileUrl!, fileName: message.fileName || "이미지" }], index: 0 })}
                                                                    aria-label={`${message.fileName || "이미지"} 크게 보기`}
                                                                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "block" }}
                                                                >
                                                                    <img
                                                                        className="carev-chat-image"
                                                                        src={chatListImageUrl(message)}
                                                                        alt={message.fileName || "이미지"}
                                                                        style={{ display: "block", maxWidth: "100%", maxHeight: 240, borderRadius: 'var(--radius-none)' }}
                                                                    />
                                                                </button>
                                                            ) : mediaType === "VIDEO" && message.fileUrl ? (
                                                                <ChatVideoBubble
                                                                    fileUrl={message.fileUrl}
                                                                    fileName={message.fileName || message.content}
                                                                    posterUrl={message.thumbnailUrl}
                                                                    maxHeight={240}
                                                                />
                                                            ) : message.type === "FILE" && message.fileUrl ? (
                                                                // 문서는 새 탭으로 내보내지 않고 화면 안에서 바로 연다
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        if (isViewableDocument(message.fileName)) {
                                                                            setViewerFile({ fileUrl: message.fileUrl!, fileName: message.fileName || "문서" });
                                                                        } else {
                                                                            window.open(message.fileUrl, "_blank", "noopener");
                                                                        }
                                                                    }}
                                                                    style={{
                                                                        fontSize: 'var(--font-size-base)',
                                                                        textDecoration: "underline",
                                                                        display: "inline-flex",
                                                                        alignItems: "center",
                                                                        gap: 'var(--spacing-1)',
                                                                        color: isMyMessage ? C.onAccent : C.accent,
                                                                        background: "none",
                                                                        border: "none",
                                                                        padding: 0,
                                                                        cursor: "pointer",
                                                                        textAlign: "left",
                                                                    }}
                                                                >
                                                                    📎 {message.fileName || message.content}
                                                                </button>
                                                            ) : (
                                                                <span style={{ fontSize: 'var(--font-size-base)', lineHeight: 'var(--text-body-leading)', whiteSpace: "pre-wrap", wordBreak: "break-word", color: "inherit" }}>
                                                                    {renderWithMentions(message.content, isMyMessage)}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {!isMyMessage && (
                                                            <>
                                                                <UnreadCount count={groupUnread} />
                                                                <Text type="supporting">
                                                                    {formatMessageTime(message.createdAt)}
                                                                </Text>
                                                                {/* 평소엔 숨어 있다가 마우스를 올리거나 키보드 포커스가 오면 나타난다.
                                                                    아주 지워버리면 꾹 누르기·우클릭을 못 하는 키보드 사용자가
                                                                    답장·리액션·공지등록에 닿을 방법이 없어진다. */}
                                                                <span className="carev-chat-msgactions">
                                                                    <IconButton
                                                                        label="메시지 옵션"
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        icon={<Icon icon="moreHorizontal" size="sm" />}
                                                                        onClick={() => setContextMenuMessageId(contextMenuMessageId === message.id ? null : message.id)}
                                                                    />
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>

                                                    {/* 리액션 표시 — 흰 배경 알약으로 감싸고, 내가 단 반응은 브랜드색으로 강조한다.
                                                        여러 개면 줄바꿈되도록 flexWrap을 둔다. */}
                                                    {message.reactions && message.reactions.length > 0 && (
                                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 'var(--spacing-1)', marginTop: 'var(--spacing-1)' }}>
                                                            {message.reactions.map((reaction) => (
                                                                <button
                                                                    key={reaction.emoji}
                                                                    type="button"
                                                                    className="carev-reaction-badge"
                                                                    title={reaction.userNames?.join(", ")}
                                                                    onClick={() => handleToggleReaction(message.id, reaction.emoji)}
                                                                    style={{
                                                                        display: "inline-flex",
                                                                        alignItems: "center",
                                                                        gap: 'var(--spacing-1)',
                                                                        padding: "2px var(--spacing-2)",
                                                                        borderRadius: 'var(--radius-full)',
                                                                        fontSize: 'var(--font-size-xs)',
                                                                        lineHeight: 1.4,
                                                                        cursor: "pointer",
                                                                        background: reaction.myReaction ? 'var(--color-accent-muted)' : 'var(--color-background-surface)',
                                                                        border: reaction.myReaction ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
                                                                        color: reaction.myReaction ? 'var(--color-text-accent, var(--color-accent))' : 'var(--color-text-primary)',
                                                                        boxShadow: 'var(--shadow-low)',
                                                                    }}
                                                                >
                                                                    <span>{reaction.emoji}</span>
                                                                    <span style={{ fontWeight: 'var(--font-weight-medium)' }}>{reaction.count}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* 롱프레스 메뉴 */}
                                                    {contextMenuMessageId === message.id && (
                                                        <div style={{ position: "absolute", zIndex: 40, bottom: "100%", marginBottom: 'var(--spacing-1)', ...(isMyMessage ? { right: 0 } : { left: 0 }) }}>
                                                            <div style={{ background: C.card, borderRadius: 'var(--radius-element)', boxShadow: 'var(--shadow-high)', border: `1px solid ${C.border}`, overflow: "hidden" }}>
                                                                <div style={{ padding: "var(--spacing-1-5) var(--spacing-2)", borderBottom: `1px solid ${C.gray100}` }}>
                                                                    <HStack gap={0.5}>
                                                                        {QUICK_EMOJIS.map((emoji) => (
                                                                            <IconButton
                                                                                key={emoji}
                                                                                label={`${emoji} 반응`}
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                icon={<span>{emoji}</span>}
                                                                                onClick={() => handleToggleReaction(message.id, emoji)}
                                                                            />
                                                                        ))}
                                                                    </HStack>
                                                                </div>
                                                                <Button
                                                                    label="답장"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    icon={<Icon icon={FiCornerUpLeft} size="sm" />}
                                                                    onClick={() => { setReplyTo(message); setContextMenuMessageId(null); }}
                                                                    style={{ width: "100%", justifyContent: "flex-start" }}
                                                                />
                                                                <Button
                                                                    label="공지로 등록"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    icon={<span>📌</span>}
                                                                    isLoading={isUpdatingNotice}
                                                                    onClick={() => changeNotice(message.id)}
                                                                    style={{ width: "100%", justifyContent: "flex-start" }}
                                                                />
                                                                {/* 메시지 내용을 제목 초기값으로 넘겨 일정 등록 다이얼로그를 연다 — 제목은 그 안에서 자유롭게 수정 가능 */}
                                                                {!message.isDeleted && (
                                                                    <Button
                                                                        label="일정 등록"
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        icon={<Icon icon={FiCalendar} size="sm" />}
                                                                        onClick={() => { setScheduleSourceMessage(message); setContextMenuMessageId(null); }}
                                                                        style={{ width: "100%", justifyContent: "flex-start" }}
                                                                    />
                                                                )}
                                                                {/* 삭제는 내가 보낸 것만. 지우면 그 자리에 '삭제된 메시지입니다'가 남는다 */}
                                                                {isMyMessage && !message.isDeleted && (
                                                                    pendingDeleteMessageId === message.id ? (
                                                                        <div style={{ padding: 'var(--spacing-2)', borderTop: `1px solid ${C.gray100}` }}>
                                                                            <VStack gap={1.5} align="start">
                                                                                <Text type="supporting" color="secondary">
                                                                                    상대에게는 &lsquo;삭제된 메시지입니다&rsquo;로 남습니다
                                                                                </Text>
                                                                                <HStack gap={1}>
                                                                                    <Button
                                                                                        label="삭제할게요"
                                                                                        variant="destructive"
                                                                                        size="sm"
                                                                                        onClick={() => handleDeleteMessage(message.id)}
                                                                                    />
                                                                                    <Button
                                                                                        label="그대로 두기"
                                                                                        variant="secondary"
                                                                                        size="sm"
                                                                                        onClick={() => setPendingDeleteMessageId(null)}
                                                                                    />
                                                                                </HStack>
                                                                            </VStack>
                                                                        </div>
                                                                    ) : (
                                                                        <Button
                                                                            label="삭제"
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            icon={<Icon icon={FiTrash2} size="sm" color="error" />}
                                                                            onClick={() => setPendingDeleteMessageId(message.id)}
                                                                            style={{ width: "100%", justifyContent: "flex-start" }}
                                                                        />
                                                                    )
                                                                )}
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
                            {/* 새 메시지 배지 — 스크롤 컨테이너 하단에 붙어(sticky) 늘 보이는 자리에 뜬다.
                                남이 보낸 메시지가 왔는데 내가 위쪽을 보고 있을 때만 나타난다 */}
                            {showNewMessageBadge && (
                                <div style={{ position: "sticky", bottom: 'var(--spacing-1)', display: "flex", justifyContent: "center", pointerEvents: "none" }}>
                                    <div style={{ pointerEvents: "auto" }}>
                                        <Button
                                            label="새 메시지 ↓"
                                            variant="primary"
                                            size="sm"
                                            onClick={scrollToBottom}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 답글 미리보기 바 */}
                        {replyTo && (
                            <div style={{ padding: "var(--spacing-2) var(--spacing-4)", borderTop: `1px solid ${C.border}`, background: C.bgGray, display: "flex", alignItems: "center", gap: 'var(--spacing-2)' }}>
                                <div style={{ flex: 1, minWidth: 0, borderLeft: `2px solid ${C.accent}`, paddingLeft: 'var(--spacing-2)' }}>
                                    <div>
                                        <Text type="supporting" weight="semibold" color="accent" maxLines={1}>{replyTo.senderName}</Text>
                                    </div>
                                    <div>
                                        <Text type="supporting" maxLines={1}>
                                            {chatMediaType(replyTo) === "IMAGE" ? "📷 사진" : chatMediaType(replyTo) === "VIDEO" ? "🎬 동영상" : replyTo.type === "FILE" ? "📎 파일" : replyTo.content}
                                        </Text>
                                    </div>
                                </div>
                                <IconButton
                                    label="답장 취소"
                                    variant="ghost"
                                    size="sm"
                                    icon={<Icon icon="close" />}
                                    onClick={() => setReplyTo(null)}
                                />
                            </div>
                        )}

                        {/* Input Area */}
                        <div style={{ padding: 'var(--spacing-4)', borderTop: `1px solid ${C.border}`, position: "relative" }}>
                            {/* @호출 추천 — 입력창 바로 위에 띄운다 */}
                            {mentionCandidates.length > 0 && (
                                <div style={{
                                    position: "absolute", bottom: "100%", left: 'var(--spacing-4)', right: 'var(--spacing-4)',
                                    marginBottom: 'var(--spacing-1)', zIndex: 40, background: C.card,
                                    border: `1px solid ${C.border}`, borderRadius: 'var(--radius-element)',
                                    boxShadow: 'var(--shadow-high)', overflow: "hidden",
                                }}>
                                    {mentionCandidates.map((p) => (
                                        <button
                                            key={p.userId}
                                            type="button"
                                            onClick={() => applyMention(p.userName)}
                                            style={{
                                                display: "flex", alignItems: "center", gap: 'var(--spacing-2)', width: "100%",
                                                padding: 'var(--spacing-2) var(--spacing-3)', background: "none", border: "none",
                                                cursor: "pointer", textAlign: "left",
                                            }}
                                        >
                                            <Avatar name={p.userName} src={p.profileImageUrl} size="small" />
                                            <Text type="supporting" color="primary">{p.userName}</Text>
                                            {p.role && <Text type="supporting" color="secondary">{p.role}</Text>}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <div style={{ display: "flex", gap: 'var(--spacing-2)', alignItems: "flex-start" }}>
                                {/* 파일·사진 첨부 — 숨은 input을 아이콘 버튼으로 대신 연다 */}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    onChange={handleFilePick}
                                    style={{ display: "none" }}
                                />
                                <IconButton
                                    label="파일 첨부"
                                    tooltip="사진·파일 보내기"
                                    variant="ghost"
                                    icon={<Icon icon={FiPaperclip} />}
                                    isLoading={isUploadingFile}
                                    isDisabled={isUploadingFile || isSendingMessage}
                                    onClick={() => fileInputRef.current?.click()}
                                />
                                {/*
                                  Astryx TextArea는 onKeyDown을 지원하지 않아(docs.mjs 확인) 래퍼 div에 건다 —
                                  keydown은 textarea에서 이 div까지 그대로 버블링된다.
                                  줄 수(rows)는 입력된 줄바꿈 수만큼 최대 5줄까지 늘어난다.
                                */}
                                <div style={{ flex: 1 }} onKeyDown={handleKeyDown}>
                                    <TextArea
                                        label="메시지 입력"
                                        isLabelHidden
                                        value={messageInput}
                                        onChange={handleMessageInputChange}
                                        rows={Math.min(5, Math.max(1, messageInput.split("\n").length))}
                                        placeholder={
                                            isUploadingFile ? "파일을 보내는 중..."
                                                : replyTo ? `${replyTo.senderName}에게 답장... (Shift+Enter로 줄바꿈)`
                                                : "메시지 입력 (Shift+Enter로 줄바꿈, 사진은 붙여넣기·끌어놓기로도 보낼 수 있어요)"
                                        }
                                        isDisabled={isSendingMessage || isUploadingFile}
                                    />
                                </div>
                                <Button
                                    label={isSendingMessage ? "전송 중..." : "전송"}
                                    variant="primary"
                                    onClick={sendMessage}
                                    isDisabled={!messageInput.trim() || isSendingMessage || isUploadingFile}
                                    isLoading={isSendingMessage}
                                />
                            </div>
                        </div>

                        {/* Info Drawer */}
                        {showDrawer && (
                            <div style={{ position: "absolute", inset: 0, background: C.card, zIndex: 20, display: "flex", flexDirection: "column" }}>
                                {/* Drawer Header */}
                                <div style={{ padding: 'var(--spacing-4)', borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                    <Text type="large" weight="semibold">채팅방 정보</Text>
                                    <IconButton
                                        label="닫기"
                                        variant="ghost"
                                        icon={<Icon icon="close" />}
                                        onClick={() => setShowDrawer(false)}
                                    />
                                </div>

                                <div style={{ flex: 1, overflowY: "auto" }}>
                                    {/* 참여자 */}
                                    <div style={{ padding: 'var(--spacing-4)', borderBottom: `1px solid ${C.gray100}` }}>
                                        <div style={{ marginBottom: 'var(--spacing-3)' }}>
                                            <HStack gap={2} vAlign="center" hAlign="between">
                                                <Text type="label" weight="semibold">
                                                    참여자 ({participants.length}명)
                                                </Text>
                                                <Button
                                                    label="초대"
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => { setInviteIds([]); setShowInviteModal(true); }}
                                                />
                                            </HStack>
                                        </div>
                                        {isLoadingParticipants ? (
                                            <Loading size="inline" label="참여자를 불러오는 중..." />
                                        ) : participants.length > 0 ? (
                                            <VStack gap={1}>
                                                {participants.map((p, i) => (
                                                    <Item
                                                        key={p.userId || i}
                                                        density="compact"
                                                        startContent={<Avatar src={p.profileImageUrl || undefined} name={p.userName} size="small" />}
                                                        label={p.userName}
                                                    />
                                                ))}
                                            </VStack>
                                        ) : (
                                            <div style={{ textAlign: "center", padding: "var(--spacing-4) 0" }}>
                                                <Text type="supporting">참여자 정보를 불러올 수 없습니다</Text>
                                            </div>
                                        )}
                                    </div>

                                    {/* 사진 */}
                                    <div style={{ padding: 'var(--spacing-4)', borderBottom: `1px solid ${C.gray100}` }}>
                                        <div style={{ marginBottom: 'var(--spacing-3)' }}>
                                            <Text type="label" weight="semibold">
                                                사진 ({drawerImageMessages.length})
                                            </Text>
                                        </div>
                                        {drawerImageMessages.length > 0 ? (
                                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 'var(--spacing-2)' }}>
                                                {drawerImageMessages.map(m => (
                                                    <button
                                                        key={m.id}
                                                        type="button"
                                                        onClick={() => window.open(m.fileUrl, "_blank")}
                                                        aria-label={`${m.fileName || "사진"} 크게 보기`}
                                                        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "block", width: "100%" }}
                                                    >
                                                        <img
                                                            src={chatListImageUrl(m)}
                                                            alt={m.fileName || "사진"}
                                                            className="carev-chat-photo"
                                                            style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", borderRadius: 'var(--radius-inner)' }}
                                                        />
                                                    </button>
                                                ))}
                                            </div>
                                        ) : (
                                            <div style={{ textAlign: "center", padding: "var(--spacing-4) 0" }}>
                                                <Text type="supporting">공유된 사진이 없습니다</Text>
                                            </div>
                                        )}
                                    </div>

                                    {/* 파일 */}
                                    <div style={{ padding: 'var(--spacing-4)', borderBottom: `1px solid ${C.gray100}` }}>
                                        <div style={{ marginBottom: 'var(--spacing-3)' }}>
                                            <Text type="label" weight="semibold">
                                                파일 ({drawerFileMessages.length})
                                            </Text>
                                        </div>
                                        {drawerFileMessages.length > 0 ? (
                                            <VStack gap={1}>
                                                {drawerFileMessages.map(m => (
                                                    <Item
                                                        key={m.id}
                                                        href={m.fileUrl!}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        density="compact"
                                                        startContent={<Icon icon={FiPaperclip} size="sm" color="secondary" />}
                                                        label={m.fileName || m.content}
                                                        labelLines={1}
                                                        description={<Text type="supporting">{formatMessageTime(m.createdAt)}</Text>}
                                                    />
                                                ))}
                                            </VStack>
                                        ) : (
                                            <div style={{ textAlign: "center", padding: "var(--spacing-4) 0" }}>
                                                <Text type="supporting">공유된 파일이 없습니다</Text>
                                            </div>
                                        )}
                                    </div>

                                    {/* 삭제는 헤더 더보기(⋯) 메뉴로 옮겼다 — 앱과 같은 자리에서 찾도록 */}
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                        <Text type="body" color="secondary">채팅방을 선택하세요</Text>
                    </div>
                )}
            </div>

            {/* Create Room Modal */}
            <Dialog
                isOpen={showCreateModal}
                onOpenChange={(open) => { if (!open) closeCreateModal(); }}
                purpose="form"
                width={480}
            >
                <Layout
                    header={
                        <DialogHeader
                            title="새 채팅방 만들기"
                            onOpenChange={(open) => { if (!open) closeCreateModal(); }}
                        />
                    }
                    content={
                        <LayoutContent>
                            <VStack gap={4}>
                                <TextInput
                                    label="채팅방 이름"
                                    type="text"
                                    value={newRoomName}
                                    onChange={(value) => setNewRoomName(value)}
                                    placeholder="채팅방 이름을 입력하세요"
                                    isRequired
                                />
                                <TextArea
                                    label="설명"
                                    value={newRoomDescription}
                                    onChange={(value) => setNewRoomDescription(value)}
                                    placeholder="채팅방 설명을 입력하세요"
                                    rows={3}
                                    isOptional
                                />
                                <ChatMemberPicker
                                    members={sortedMembers}
                                    onlineUserIds={onlineUserIds}
                                    selectedIds={newRoomParticipantIds}
                                    onToggle={toggleNewRoomParticipant}
                                />
                                <Text type="supporting">
                                    지금 고르지 않아도 방을 만든 뒤 채팅방 정보에서 부를 수 있습니다.
                                </Text>
                            </VStack>
                        </LayoutContent>
                    }
                    footer={
                        <LayoutFooter hasDivider>
                            <HStack gap={2} hAlign="end">
                                <Button
                                    label="취소"
                                    variant="ghost"
                                    onClick={closeCreateModal}
                                    isDisabled={isCreatingRoom}
                                />
                                <Button
                                    label={isCreatingRoom ? "만드는 중..." : "생성"}
                                    variant="primary"
                                    onClick={createRoom}
                                    isLoading={isCreatingRoom}
                                    isDisabled={!newRoomName.trim() || isCreatingRoom}
                                />
                            </HStack>
                        </LayoutFooter>
                    }
                />
            </Dialog>

            {/* 기존 방에 사람 부르기 */}
            <Dialog
                isOpen={showInviteModal}
                onOpenChange={(open) => { if (!open) { setShowInviteModal(false); setInviteIds([]); } }}
                purpose="form"
                width={480}
            >
                <Layout
                    header={
                        <DialogHeader
                            title="구성원 초대"
                            onOpenChange={(open) => { if (!open) { setShowInviteModal(false); setInviteIds([]); } }}
                        />
                    }
                    content={
                        <LayoutContent>
                            <ChatMemberPicker
                                members={sortedMembers}
                                onlineUserIds={onlineUserIds}
                                selectedIds={inviteIds}
                                onToggle={(id) => setInviteIds(prev =>
                                    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
                                )}
                                excludeIds={participants.map(p => p.userId)}
                                emptyLabel="이미 모두 이 방에 있습니다"
                                maxListHeight={320}
                            />
                        </LayoutContent>
                    }
                    footer={
                        <LayoutFooter hasDivider>
                            <HStack gap={2} hAlign="end">
                                <Button
                                    label="취소"
                                    variant="ghost"
                                    onClick={() => { setShowInviteModal(false); setInviteIds([]); }}
                                    isDisabled={isInviting}
                                />
                                <Button
                                    label={isInviting ? "초대 중..." : "초대"}
                                    variant="primary"
                                    onClick={inviteToRoom}
                                    isLoading={isInviting}
                                    isDisabled={inviteIds.length === 0 || isInviting}
                                />
                            </HStack>
                        </LayoutFooter>
                    }
                />
            </Dialog>

            {/* Delete Room Confirm Modal */}
            <Dialog
                isOpen={showDeleteConfirm}
                onOpenChange={(open) => { if (!open) setShowDeleteConfirm(false); }}
                purpose="required"
                width={400}
            >
                <Layout
                    header={
                        <DialogHeader
                            title="채팅방 삭제"
                            onOpenChange={(open) => { if (!open) setShowDeleteConfirm(false); }}
                        />
                    }
                    content={
                        <LayoutContent>
                            <VStack gap={3}>
                                <Text type="body">
                                    <strong>{rooms.find(r => r.id === selectedRoom)?.name}</strong> 채팅방을 삭제하시겠습니까?
                                </Text>
                                <Banner status="warning" title="삭제된 채팅방과 메시지는 복구할 수 없습니다." />
                            </VStack>
                        </LayoutContent>
                    }
                    footer={
                        <LayoutFooter hasDivider>
                            <HStack gap={2} hAlign="end">
                                <Button
                                    label="취소"
                                    variant="ghost"
                                    onClick={() => setShowDeleteConfirm(false)}
                                    isDisabled={isDeletingRoom}
                                />
                                <Button
                                    label={isDeletingRoom ? "삭제 중..." : "삭제"}
                                    variant="destructive"
                                    onClick={deleteRoom}
                                    isLoading={isDeletingRoom}
                                    isDisabled={isDeletingRoom}
                                />
                            </HStack>
                        </LayoutFooter>
                    }
                />
            </Dialog>

            {/* Leave Room Confirm Modal — 삭제와 달리 방은 그대로 남고 나만 빠진다 */}
            <Dialog
                isOpen={showLeaveConfirm}
                onOpenChange={(open) => { if (!open) setShowLeaveConfirm(false); }}
                purpose="required"
                width={400}
            >
                <Layout
                    header={
                        <DialogHeader
                            title="채팅방 나가기"
                            onOpenChange={(open) => { if (!open) setShowLeaveConfirm(false); }}
                        />
                    }
                    content={
                        <LayoutContent>
                            <VStack gap={3}>
                                <Text type="body">
                                    <strong>{rooms.find(r => r.id === selectedRoom)?.name}</strong> 채팅방에서 나가시겠습니까?
                                </Text>
                                <Banner status="warning" title="나가면 대화 내용을 더 볼 수 없고, 되돌릴 수 없습니다. (방과 메시지 자체는 삭제되지 않습니다)" />
                            </VStack>
                        </LayoutContent>
                    }
                    footer={
                        <LayoutFooter hasDivider>
                            <HStack gap={2} hAlign="end">
                                <Button
                                    label="취소"
                                    variant="ghost"
                                    onClick={() => setShowLeaveConfirm(false)}
                                    isDisabled={isLeavingRoom}
                                />
                                <Button
                                    label={isLeavingRoom ? "나가는 중..." : "나가기"}
                                    variant="destructive"
                                    onClick={leaveRoom}
                                    isLoading={isLeavingRoom}
                                    isDisabled={isLeavingRoom}
                                />
                            </HStack>
                        </LayoutFooter>
                    }
                />
            </Dialog>

            {/* 메시지 우클릭 → 일정 등록 — 기존 등록 다이얼로그를 그대로 재사용하고 제목만 메시지 내용으로 초기화한다 */}
            {scheduleSourceMessage && (
                <ScheduleCreateDialog
                    isOpen
                    initialDate={new Date()}
                    initialTitle={scheduleSourceMessage.content}
                    onClose={() => setScheduleSourceMessage(null)}
                    onCreated={() => {
                        setScheduleSourceMessage(null);
                        onNotification("일정이 등록되었습니다", "success");
                    }}
                />
            )}

            {/* 받은 문서 바로 보기 — 결재 첨부와 같은 뷰어를 재사용한다 */}
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
                    width={900}
                    showOpenInNewTab
                />
            )}
        </div>
    );
}
