"use client";

import { useState, useEffect, useRef, useCallback, useMemo, Fragment } from "react";
import { Client, IMessage } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { fetchChatRooms, fetchChatMessages, markChatAsRead, sendChatMessage, toggleChatReaction, createChatRoom, fetchChatParticipants, deleteChatRoom, uploadChatFile, updateChatRoomNotice, fetchChatSharedFiles, searchChatMessages, fetchOnlineUserIds, getApproverCandidates } from '@/lib/apiService';
import DocumentViewerModal from '@/components/DocumentViewerModal';
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
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Banner } from '@astryxdesign/core/Banner';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { FiCornerUpLeft, FiPaperclip, FiMessageCircle, FiSearch } from 'react-icons/fi';

interface ChatManagementProps {
    onNotification: (message: string, type: "success" | "error" | "info") => void;
    isAdmin?: boolean;
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
    fileName?: string;
    createdAt: string;
    isDeleted: boolean;
    readCount: number;
    reactions?: ReactionSummary[];
    replyToId?: number;
    replyToSenderName?: string;
    replyToContent?: string;
    replyToType?: string;
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
}

interface WebSocketMessage {
    type: "MESSAGE" | "TYPING" | "READ" | "JOIN" | "LEAVE";
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
}

const BACKEND_WS_URL = process.env.NEXT_PUBLIC_API_URL || "https://silverithm.site";

/** 채팅 첨부 상한 — S3 업로드와 모바일 데이터 사용을 감안한 값 */
const MAX_CHAT_FILE_SIZE = 20 * 1024 * 1024;

/** 브라우저에서 바로 열어볼 수 있는 문서 (그 외는 다운로드로 안내) */
const VIEWABLE_DOC_EXTENSIONS = ['pdf', 'hwp', 'hwpx', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'];

const isViewableDocument = (fileName?: string) => {
    if (!fileName) return false;
    const ext = fileName.split('.').pop()?.toLowerCase();
    return !!ext && VIEWABLE_DOC_EXTENSIONS.includes(ext);
};

// Astryx 마이그레이션: bespoke 레이아웃(스플릿 패널/메시지 버블)에서만 쓰는 잔여 색상 — 전부 디자인 토큰
const C = {
    accent: 'var(--color-accent)',
    border: 'var(--color-border)',
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
                    background: isMyMessage ? "rgba(255,255,255,0.22)" : 'var(--color-background-teal, rgba(20,184,134,0.12))',
                    borderRadius: 'var(--radius-inner)',
                    padding: "0 2px",
                }}
            >
                {part}
            </strong>
        ) : (
            <Fragment key={index}>{part}</Fragment>
        ),
    );
}

/** 1:1 방 이름 규칙 — 같은 상대와 두 번 만들지 않으려면 이름이 일정해야 한다 */
function directRoomName(memberName: string): string {
    return `${memberName} 님과의 대화`;
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

export function ChatManagement({ onNotification, isAdmin = true }: ChatManagementProps) {
    const [rooms, setRooms] = useState<ChatRoom[]>([]);
    const [selectedRoom, setSelectedRoom] = useState<number | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [messageInput, setMessageInput] = useState("");
    const [isLoadingRooms, setIsLoadingRooms] = useState(false);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [isSendingMessage, setIsSendingMessage] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newRoomName, setNewRoomName] = useState("");
    const [newRoomDescription, setNewRoomDescription] = useState("");
    const [isConnected, setIsConnected] = useState(false);
    const [showDrawer, setShowDrawer] = useState(false);
    const [participants, setParticipants] = useState<ChatParticipant[]>([]);
    const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);

    // 메시지 발신자 아바타 표시용 — 참여자의 profileImageUrl을 미리 조회해둔다
    const participantAvatarMap = useMemo(() => {
        const map = new Map<string, string | undefined>();
        participants.forEach((p) => map.set(p.userId, p.profileImageUrl));
        return map;
    }, [participants]);
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
    const [sharedFiles, setSharedFiles] = useState<ChatMessage[]>([]);
    const [isLoadingFiles, setIsLoadingFiles] = useState(false);
    /** @를 입력하면 뜨는 참가자 추천 — null이면 닫힘 */
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    /** 왼쪽 목록 전환 — 대화방 / 직원 */
    const [listTab, setListTab] = useState<'rooms' | 'people'>('rooms');
    /** 기관 전 인원 (이름 + 직책) */
    const [orgMembers, setOrgMembers] = useState<{ id: string; name: string; position?: string | null }[]>([]);
    /** 지금 접속 중인 사람들의 userId */
    const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
    const [isOpeningDirect, setIsOpeningDirect] = useState(false);
    /** 공지가 길면 두 줄만 보여주고 필요할 때 펼친다 */
    const [isNoticeExpanded, setIsNoticeExpanded] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    /** 채팅에서 받은 문서를 앱 안에서 바로 여는 뷰어 (이미지는 자체 확대 보기로 처리) */
    const [viewerFile, setViewerFile] = useState<{ fileUrl: string; fileName: string } | null>(null);
    const [imagePreview, setImagePreview] = useState<{ fileUrl: string; fileName: string } | null>(null);
    const [contextMenuMessageId, setContextMenuMessageId] = useState<number | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const stompClientRef = useRef<Client | null>(null);
    const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
    const longPressTimerRef2 = useRef<NodeJS.Timeout | null>(null);

    const [companyId] = useState(() => typeof window !== "undefined" ? localStorage.getItem("companyId") : null);
    const [userId] = useState(() => typeof window !== "undefined" ? localStorage.getItem("userId") : null);
    const [userName] = useState(() => typeof window !== "undefined" ? localStorage.getItem("userName") : null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
            setRooms(roomList);
        } catch (error) {
            console.error("Error fetching rooms:", error);
            onNotification("채팅방 목록을 불러오는데 실패했습니다", "error");
        } finally {
            setIsLoadingRooms(false);
        }
    }, [companyId, userId, onNotification]);

    // 메시지 로드 후 마지막 메시지 ID 반환
    const fetchMessages = useCallback(async (roomId: number): Promise<number | null> => {
        setIsLoadingMessages(true);
        try {
            const data = await fetchChatMessages(roomId, 0, 50);
            const msgList = Array.isArray(data) ? data : (data.messages || data.content || data.data || []);
            // 백엔드가 createdAt DESC(최신순)로 반환하므로 뒤집어서 오래된 메시지가 위로
            const sorted = [...msgList].reverse();
            setMessages(sorted);
            setTimeout(scrollToBottom, 100);
            // DESC 기준 첫 번째(= 가장 최신) 메시지의 ID 반환
            return msgList.length > 0 ? msgList[0].id : null;
        } catch (error) {
            console.error("Error fetching messages:", error);
            onNotification("메시지를 불러오는데 실패했습니다", "error");
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
                console.log("[Chat WebSocket] 연결됨");
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
                            setOnlineUserIds(prev => {
                                const next = new Set(prev);
                                if (online) next.add(String(changedId));
                                else next.delete(String(changedId));
                                return next;
                            });
                        } catch (error) {
                            console.error("[Presence] 상태 수신 처리 실패:", error);
                        }
                    });
                }
            },
            onDisconnect: () => {
                console.log("[Chat WebSocket] 연결 해제됨");
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
    }, [userId]);

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

    // 기관 인원 목록 + 지금 접속 중인 사람 (첫 화면용 — 이후 변화는 WebSocket으로 받는다)
    useEffect(() => {
        if (!companyId) return;
        (async () => {
            try {
                const [candidateResponse, presenceResponse] = await Promise.all([
                    getApproverCandidates(),
                    fetchOnlineUserIds().catch(() => ({ onlineUserIds: [] })),
                ]);
                const candidates = Array.isArray(candidateResponse?.candidates) ? candidateResponse.candidates : [];
                setOrgMembers(candidates.map((c: { approverId: number | string; name: string; position?: string | null }) => ({
                    id: String(c.approverId),
                    name: c.name,
                    position: c.position,
                })));
                setOnlineUserIds(new Set((presenceResponse?.onlineUserIds || []).map(String)));
            } catch (error) {
                console.error("인원 목록 로드 실패:", error);
            }
        })();
    }, [companyId]);

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

                    if (wsMessage.type === "MESSAGE" && wsMessage.message) {
                        setMessages(prev => {
                            // 중복 방지
                            if (prev.some(m => m.id === wsMessage.message!.id)) return prev;
                            return [...prev, wsMessage.message!];
                        });
                        setTimeout(scrollToBottom, 100);

                        // 현재 보고 있는 방이면 바로 읽음 처리
                        markAsRead(wsMessage.roomId, wsMessage.message.id);

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
                        // 다른 사용자가 읽었으므로 메시지 readCount 업데이트
                        setMessages(prev => prev.map(msg => {
                            if (msg.id <= (wsMessage.lastReadMessageId || 0)) {
                                return { ...msg, readCount: msg.readCount + 1 };
                            }
                            return msg;
                        }));
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
            onNotification("메시지 전송에 실패했습니다", "error");
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
            onNotification("파일 전송에 실패했습니다", "error");
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

        const existing = rooms.find(r => r.participantCount === 2 && r.name === directRoomName(member.name));
        if (existing) {
            setSelectedRoom(existing.id);
            setListTab('rooms');
            return;
        }

        setIsOpeningDirect(true);
        try {
            const response = await createChatRoom({
                name: directRoomName(member.name),
                description: "1:1 대화",
                creatorId: userId,
                creatorName: userName,
                participantIds: [member.id],
            });
            const created = response.room || response;
            await fetchRooms();
            if (created?.id) setSelectedRoom(created.id);
            setListTab('rooms');
        } catch (error) {
            console.error("1:1 대화 열기 실패:", error);
            onNotification("대화를 열지 못했습니다", "error");
        } finally {
            setIsOpeningDirect(false);
        }
    };

    /** 온라인인 사람을 위로 올리고, 그 안에서는 이름순 */
    const sortedMembers = useMemo(() => {
        return [...orgMembers]
            .filter(m => m.id !== userId)
            .sort((a, b) => {
                const aOn = onlineUserIds.has(a.id) ? 0 : 1;
                const bOn = onlineUserIds.has(b.id) ? 0 : 1;
                if (aOn !== bOn) return aOn - bOn;
                return a.name.localeCompare(b.name, 'ko');
            });
    }, [orgMembers, onlineUserIds, userId]);

    /** 방 안 메시지 검색 */
    const runSearch = async () => {
        if (!selectedRoom || !searchKeyword.trim()) return;
        setIsSearching(true);
        try {
            const response = await searchChatMessages(selectedRoom, searchKeyword.trim());
            setSearchResults(response.messages || []);
        } catch (error) {
            console.error("메시지 검색 실패:", error);
            onNotification("검색에 실패했습니다", "error");
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
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
            onNotification("파일 목록을 불러오지 못했습니다", "error");
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
            onNotification("공지 변경에 실패했습니다", "error");
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

    const createRoom = async () => {
        if (!newRoomName.trim() || !companyId || !userId || !userName) return;

        try {
            await createChatRoom({
                name: newRoomName.trim(),
                description: newRoomDescription.trim() || undefined,
                creatorId: userId,
                creatorName: userName,
                participantIds: [userId],
            });

            onNotification("채팅방이 생성되었습니다", "success");
            setShowCreateModal(false);
            setNewRoomName("");
            setNewRoomDescription("");
            fetchRooms();
        } catch (error) {
            console.error("Error creating room:", error);
            onNotification(error instanceof Error ? error.message : "채팅방 생성에 실패했습니다", "error");
        }
    };

    const fetchParticipants = useCallback(async (roomId: number) => {
        setIsLoadingParticipants(true);
        try {
            const data = await fetchChatParticipants(roomId);
            const list = Array.isArray(data) ? data : (data.participants || data.content || data.data || []);
            setParticipants(list);
        } catch (error) {
            console.error("Error fetching participants:", error);
        } finally {
            setIsLoadingParticipants(false);
        }
    }, []);

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
            onNotification("채팅방 삭제에 실패했습니다", "error");
        } finally {
            setIsDeletingRoom(false);
        }
    };

    const toggleDrawer = () => {
        if (!showDrawer && selectedRoom) {
            fetchParticipants(selectedRoom);
        }
        setShowDrawer(!showDrawer);
    };

    const formatTimestamp = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);

        if (diffMins < 1) return "방금";
        if (diffMins < 60) return `${diffMins}분 전`;
        if (diffHours < 24) return `${diffHours}시간 전`;

        return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
    };

    const formatMessageTime = (timestamp: string) => {
        const date = new Date(timestamp);
        const hours = date.getHours();
        const minutes = String(date.getMinutes()).padStart(2, "0");
        const ampm = hours >= 12 ? "오후" : "오전";
        const displayHours = hours % 12 || 12;

        return `${ampm} ${displayHours}:${minutes}`;
    };

    // 초기 방 목록 로드 + 30초 주기 polling
    useEffect(() => {
        fetchRooms();

        const pollingInterval = setInterval(() => {
            fetchRooms();
        }, 30000);

        return () => clearInterval(pollingInterval);
    }, [fetchRooms]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
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
                        {/* 맨 위는 내 프로필 */}
                        <div style={{ display: "flex", alignItems: "center", gap: 'var(--spacing-2)', padding: 'var(--spacing-3)', borderBottom: `1px solid ${C.border}`, background: C.bgGray }}>
                            <div style={{ position: "relative" }}>
                                <Avatar name={userName || "나"} size="small" />
                                <span style={{
                                    position: "absolute", right: -1, bottom: -1, width: 10, height: 10, borderRadius: "50%",
                                    background: 'var(--color-background-success-bold, #16a34a)', border: `2px solid ${C.bgGray}`,
                                }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <Text type="supporting" weight="semibold" color="primary" maxLines={1}>{userName || "나"}</Text>
                                <Text type="supporting" color="secondary">나</Text>
                            </div>
                        </div>

                        {sortedMembers.length === 0 ? (
                            <div style={{ padding: 'var(--spacing-6)' }}>
                                <EmptyState isCompact title="등록된 직원이 없습니다" />
                            </div>
                        ) : (
                            sortedMembers.map((member) => {
                                const isOnline = onlineUserIds.has(member.id);
                                return (
                                    <button
                                        key={member.id}
                                        type="button"
                                        onClick={() => openDirectChat(member)}
                                        disabled={isOpeningDirect}
                                        style={{
                                            display: "flex", alignItems: "center", gap: 'var(--spacing-2)', width: "100%",
                                            padding: 'var(--spacing-3)', background: "none", border: "none",
                                            borderBottom: `1px solid ${C.gray100}`, cursor: "pointer", textAlign: "left",
                                        }}
                                    >
                                        <div style={{ position: "relative" }}>
                                            <Avatar name={member.name} size="small" />
                                            {/* 온라인 초록 / 오프라인 회색 */}
                                            <span style={{
                                                position: "absolute", right: -1, bottom: -1, width: 10, height: 10, borderRadius: "50%",
                                                background: isOnline ? 'var(--color-background-success-bold, #16a34a)' : 'var(--color-border-emphasized, #cbd5e1)',
                                                border: `2px solid ${C.card}`,
                                            }} />
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <Text type="supporting" weight="semibold" color="primary" maxLines={1}>
                                                {member.name}{member.position ? ` ${member.position}` : ""}
                                            </Text>
                                            <Text type="supporting" color="secondary">{isOnline ? "접속 중" : "오프라인"}</Text>
                                        </div>
                                    </button>
                                );
                            })
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
                                                <Text type="supporting">
                                                    {formatTimestamp(roomTime)}
                                                </Text>
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
            <div style={{ width: "66.6667%", display: "flex", flexDirection: "column", position: "relative" }}>
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
                                                onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') runSearch(); }}
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
                                                        <div key={m.id} style={{ padding: 'var(--spacing-2)', background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-inner)' }}>
                                                            <Text type="supporting" weight="semibold" color="primary">
                                                                {m.senderName} · {formatMessageTime(m.createdAt)}
                                                            </Text>
                                                            <Text type="supporting" color="primary" maxLines={2}>{m.content}</Text>
                                                        </div>
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
                                                            if (m.type === "IMAGE") setImagePreview({ fileUrl: m.fileUrl, fileName: m.fileName || "이미지" });
                                                            else if (isViewableDocument(m.fileName)) setViewerFile({ fileUrl: m.fileUrl, fileName: m.fileName || "문서" });
                                                            else window.open(m.fileUrl, "_blank", "noopener");
                                                        }}
                                                        style={{
                                                            display: "flex", alignItems: "center", gap: 'var(--spacing-2)', width: "100%",
                                                            padding: 'var(--spacing-2)', background: C.card, border: `1px solid ${C.border}`,
                                                            borderRadius: 'var(--radius-inner)', cursor: "pointer", textAlign: "left",
                                                        }}
                                                    >
                                                        <span>{m.type === "IMAGE" ? "📷" : "📎"}</span>
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
                                    background: 'var(--color-background-yellow, #fefce8)',
                                    borderBottom: `1px solid ${C.border}`,
                                }}>
                                    <span style={{ flexShrink: 0, marginTop: 2 }}>📌</span>
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
                        <div style={{ flex: 1, overflowY: "auto", padding: 'var(--spacing-4)', display: "flex", flexDirection: "column", gap: 'var(--spacing-3)', background: C.bgGray }}>
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
                                messages.map((message, index) => {
                                    const isMyMessage = message.senderId === userId;
                                    const isSystemMessage = message.type === "SYSTEM";
                                    const showDateSeparator =
                                        index === 0 ||
                                        getDateKey(message.createdAt) !== getDateKey(messages[index - 1].createdAt);

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
                                            <div style={{ display: "flex", position: "relative", justifyContent: isMyMessage ? "flex-end" : "flex-start", alignItems: "flex-end", gap: 'var(--spacing-2)' }}>
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
                                                    <div style={{ display: "flex", alignItems: "flex-end", gap: 'var(--spacing-2)' }}>
                                                        {isMyMessage && (
                                                            <Text type="supporting">
                                                                {formatMessageTime(message.createdAt)}
                                                            </Text>
                                                        )}
                                                        <div
                                                            style={{
                                                                position: "relative",
                                                                padding: "var(--spacing-2) var(--spacing-3)",
                                                                ...(isMyMessage
                                                                    ? { background: '#0d9488', color: 'var(--color-on-accent)', borderRadius: 'var(--radius-container) var(--radius-inner) var(--radius-container) var(--radius-container)' }
                                                                    : { background: C.card, border: `1px solid ${C.border}`, color: C.gray900, borderRadius: 'var(--radius-inner) var(--radius-container) var(--radius-container) var(--radius-container)' }),
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
                                                                        {message.replyToType === "IMAGE" ? "📷 사진" : message.replyToType === "FILE" ? "📎 파일" : message.replyToContent}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {message.type === "IMAGE" && message.fileUrl ? (
                                                                <img
                                                                    className="carev-chat-image"
                                                                    src={message.fileUrl}
                                                                    alt={message.fileName || "이미지"}
                                                                    style={{ display: "block", maxWidth: "100%", maxHeight: 240, borderRadius: 'var(--radius-none)', cursor: "pointer" }}
                                                                    onClick={() => setImagePreview({ fileUrl: message.fileUrl!, fileName: message.fileName || "이미지" })}
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
                                                            <Text type="supporting">
                                                                {formatMessageTime(message.createdAt)}
                                                            </Text>
                                                        )}
                                                    </div>

                                                    {/* 리액션 표시 */}
                                                    {message.reactions && message.reactions.length > 0 && (
                                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 'var(--spacing-1)', marginTop: 'var(--spacing-1)' }}>
                                                            {message.reactions.map((reaction) => (
                                                                <Button
                                                                    key={reaction.emoji}
                                                                    size="sm"
                                                                    variant={reaction.myReaction ? "secondary" : "ghost"}
                                                                    label={`${reaction.emoji} ${reaction.count}`}
                                                                    tooltip={reaction.userNames?.join(", ")}
                                                                    onClick={() => handleToggleReaction(message.id, reaction.emoji)}
                                                                />
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
                            <div style={{ padding: "var(--spacing-2) var(--spacing-4)", borderTop: `1px solid ${C.border}`, background: C.bgGray, display: "flex", alignItems: "center", gap: 'var(--spacing-2)' }}>
                                <div style={{ flex: 1, minWidth: 0, borderLeft: `2px solid ${C.accent}`, paddingLeft: 'var(--spacing-2)' }}>
                                    <div>
                                        <Text type="supporting" weight="semibold" color="accent" maxLines={1}>{replyTo.senderName}</Text>
                                    </div>
                                    <div>
                                        <Text type="supporting" maxLines={1}>
                                            {replyTo.type === "IMAGE" ? "📷 사진" : replyTo.type === "FILE" ? "📎 파일" : replyTo.content}
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
                                <div style={{ flex: 1 }}>
                                    <TextInput
                                        label="메시지 입력"
                                        isLabelHidden
                                        type="text"
                                        value={messageInput}
                                        onChange={handleMessageInputChange}
                                        onKeyDown={handleKeyDown}
                                        placeholder={
                                            isUploadingFile ? "파일을 보내는 중..."
                                                : replyTo ? `${replyTo.senderName}에게 답장...`
                                                : "메시지를 입력하세요..."
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
                                            <Text type="label" weight="semibold">
                                                참여자 ({participants.length}명)
                                            </Text>
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
                                                사진 ({messages.filter(m => m.type === "IMAGE" && m.fileUrl).length})
                                            </Text>
                                        </div>
                                        {messages.filter(m => m.type === "IMAGE" && m.fileUrl).length > 0 ? (
                                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 'var(--spacing-2)' }}>
                                                {messages.filter(m => m.type === "IMAGE" && m.fileUrl).map(m => (
                                                    <img
                                                        key={m.id}
                                                        src={m.fileUrl!}
                                                        alt={m.fileName || "사진"}
                                                        className="carev-chat-photo"
                                                        style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", borderRadius: 'var(--radius-inner)', cursor: "pointer" }}
                                                        onClick={() => window.open(m.fileUrl, "_blank")}
                                                    />
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
                                                파일 ({messages.filter(m => m.type === "FILE" && m.fileUrl).length})
                                            </Text>
                                        </div>
                                        {messages.filter(m => m.type === "FILE" && m.fileUrl).length > 0 ? (
                                            <VStack gap={1}>
                                                {messages.filter(m => m.type === "FILE" && m.fileUrl).map(m => (
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

                                    {/* 채팅방 삭제 (관리자만) */}
                                    {isAdmin && (
                                        <div style={{ padding: 'var(--spacing-4)' }}>
                                            <Button
                                                label="채팅방 삭제"
                                                variant="destructive"
                                                onClick={() => setShowDeleteConfirm(true)}
                                            />
                                        </div>
                                    )}
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
                onOpenChange={(open) => {
                    if (!open) {
                        setShowCreateModal(false);
                        setNewRoomName("");
                        setNewRoomDescription("");
                    }
                }}
                purpose="form"
                width={440}
            >
                <Layout
                    header={
                        <DialogHeader
                            title="새 채팅방 만들기"
                            onOpenChange={(open) => { if (!open) setShowCreateModal(false); }}
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
                            </VStack>
                        </LayoutContent>
                    }
                    footer={
                        <LayoutFooter hasDivider>
                            <HStack gap={2} hAlign="end">
                                <Button
                                    label="취소"
                                    variant="ghost"
                                    onClick={() => {
                                        setShowCreateModal(false);
                                        setNewRoomName("");
                                        setNewRoomDescription("");
                                    }}
                                />
                                <Button
                                    label="생성"
                                    variant="primary"
                                    onClick={createRoom}
                                    isDisabled={!newRoomName.trim()}
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

            {/* 받은 문서 바로 보기 — 결재 첨부와 같은 뷰어를 재사용한다 */}
            {viewerFile && (
                <DocumentViewerModal
                    fileUrl={viewerFile.fileUrl}
                    fileName={viewerFile.fileName}
                    onClose={() => setViewerFile(null)}
                />
            )}

            {/* 사진 크게 보기 */}
            {imagePreview && (
                <Dialog isOpen onOpenChange={(open) => { if (!open) setImagePreview(null); }} purpose="info" width={900}>
                    <Layout
                        header={<DialogHeader title={imagePreview.fileName} onOpenChange={(open) => { if (!open) setImagePreview(null); }} />}
                        content={
                            <LayoutContent>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={imagePreview.fileUrl}
                                    alt={imagePreview.fileName}
                                    style={{ display: "block", width: "100%", height: "auto", objectFit: "contain", borderRadius: 'var(--radius-inner)' }}
                                />
                            </LayoutContent>
                        }
                        footer={
                            <LayoutFooter hasDivider>
                                <HStack gap={2} hAlign="end">
                                    <Button
                                        label="새 창에서 열기"
                                        variant="secondary"
                                        onClick={() => window.open(imagePreview.fileUrl, "_blank", "noopener")}
                                    />
                                    <Button label="닫기" variant="ghost" onClick={() => setImagePreview(null)} />
                                </HStack>
                            </LayoutFooter>
                        }
                    />
                </Dialog>
            )}
        </div>
    );
}
