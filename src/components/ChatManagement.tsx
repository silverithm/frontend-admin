"use client";

import { useState, useEffect, useRef, useCallback, Fragment } from "react";
import { Client, IMessage } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { fetchChatRooms, fetchChatMessages, markChatAsRead, sendChatMessage, toggleChatReaction, createChatRoom, fetchChatParticipants, deleteChatRoom } from '@/lib/apiService';
import { Button } from '@astryxdesign/core/Button';
import { IconButton } from '@astryxdesign/core/IconButton';
import { TextInput } from '@astryxdesign/core/TextInput';
import { TextArea } from '@astryxdesign/core/TextArea';
import { Spinner } from '@astryxdesign/core/Spinner';
import { Text } from '@astryxdesign/core/Text';
import { Icon } from '@astryxdesign/core/Icon';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';

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
}

const BACKEND_WS_URL = process.env.NEXT_PUBLIC_API_URL || "https://silverithm.site";

// Astryx 마이그레이션: 잔여 인라인 스타일용 색상 토큰 (mintGreen 브랜드 기준)
const C = {
    accent: "#20c997",
    accentDark: "#0ca678",
    surface: 'var(--color-background-teal)',
    softBorder: "#63e6be",
    border: "var(--color-border)",
    bgGray: 'var(--color-background-muted)',
    gray100: 'var(--color-background-muted)',
    gray300: "#d1d5db",
    gray400: "#9ca3af",
    gray500: "#6b7280",
    gray700: 'var(--color-text-primary)',
    gray900: 'var(--color-text-primary)',
    white: "#ffffff",
    green: "#22c55e",
    red500: "#ef4444",
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
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeletingRoom, setIsDeletingRoom] = useState(false);
    const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
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
            reconnectDelay: 5000,
            heartbeatIncoming: 10000,
            heartbeatOutgoing: 10000,
            onConnect: () => {
                console.log("[Chat WebSocket] 연결됨");
                setIsConnected(true);
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
                height: "calc(100vh - 180px)",
                background: C.white,
                borderRadius: 12,
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                border: `1px solid ${C.border}`,
                overflow: "hidden",
            }}
        >
            {/* Left Panel - Room List */}
            <div style={{ width: "33.3333%", borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column" }}>
                {/* Header */}
                <div style={{ padding: 16, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Text type="large" weight="semibold">채팅</Text>
                        <span
                            style={{ width: 8, height: 8, borderRadius: "50%", display: "inline-block", background: isConnected ? C.green : C.gray400 }}
                            title={isConnected ? "실시간 연결됨" : "연결 중..."}
                        />
                    </div>
                    {isAdmin && (
                        <Button label="새 채팅방" variant="primary" size="sm" onClick={() => setShowCreateModal(true)} />
                    )}
                </div>

                {/* Room List */}
                <div style={{ flex: 1, overflowY: "auto" }}>
                    {isLoadingRooms ? (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 128 }}>
                            <Spinner size="lg" />
                        </div>
                    ) : rooms.length === 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 128, gap: 8 }}>
                            <svg style={{ width: 40, height: 40, color: C.gray300 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            <Text type="supporting">채팅방이 없습니다</Text>
                        </div>
                    ) : (
                        rooms.map((room) => {
                            const isSelected = selectedRoom === room.id;
                            return (
                                <button
                                    key={room.id}
                                    onClick={() => { setSelectedRoom(room.id); setShowDrawer(false); }}
                                    className="carev-chat-room-item"
                                    style={{
                                        width: "100%",
                                        padding: 12,
                                        borderBottom: `1px solid ${C.border}`,
                                        borderLeft: isSelected ? `2px solid ${C.accent}` : "2px solid transparent",
                                        background: isSelected ? C.surface : "transparent",
                                        textAlign: "left",
                                        cursor: "pointer",
                                    }}
                                >
                                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
                                        <div style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                                            <Text type="body" weight="semibold" maxLines={1}>{room.name}</Text>
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                                            {(room.lastMessageAt || room.lastMessage?.createdAt) && (
                                                <Text type="supporting" size="2xs">
                                                    {formatTimestamp(room.lastMessageAt || room.lastMessage!.createdAt)}
                                                </Text>
                                            )}
                                            {room.unreadCount > 0 && (
                                                <span
                                                    style={{
                                                        background: C.accent,
                                                        color: C.white,
                                                        fontSize: 10,
                                                        fontWeight: 700,
                                                        minWidth: 18,
                                                        height: 18,
                                                        display: "inline-flex",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        padding: "0 6px",
                                                        borderRadius: 9999,
                                                    }}
                                                >
                                                    {room.unreadCount > 99 ? "99+" : room.unreadCount}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <Text type="supporting" size="xsm" maxLines={1}>
                                            {room.lastMessage
                                                ? `${room.lastMessage.senderName}: ${room.lastMessage.content}`
                                                : "메시지가 없습니다"}
                                        </Text>
                                    </div>
                                    <div style={{ marginTop: 2 }}>
                                        <Text type="supporting" size="2xs">참여자 {room.participantCount}명</Text>
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Right Panel - Messages */}
            <div style={{ width: "66.6667%", display: "flex", flexDirection: "column", position: "relative" }}>
                {selectedRoom ? (
                    <>
                        {/* Header */}
                        <div style={{ padding: 16, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div>
                                <Text type="large" weight="semibold">
                                    {rooms.find(r => r.id === selectedRoom)?.name || "채팅방"}
                                </Text>
                                <div>
                                    <Text type="supporting" size="xsm">
                                        참여자 {rooms.find(r => r.id === selectedRoom)?.participantCount || 0}명
                                    </Text>
                                </div>
                            </div>
                            <IconButton
                                label="채팅방 정보"
                                variant="ghost"
                                icon={<Icon icon="menu" />}
                                onClick={toggleDrawer}
                            />
                        </div>

                        {/* Overlay for context menus */}
                        {contextMenuMessageId !== null && (
                            <div style={{ position: "fixed", inset: 0, zIndex: 30 }} onClick={() => setContextMenuMessageId(null)} />
                        )}

                        {/* Messages */}
                        <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12, background: C.bgGray }}>
                            {isLoadingMessages ? (
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                                    <Spinner size="lg" />
                                </div>
                            ) : messages.length === 0 ? (
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 8 }}>
                                    <svg style={{ width: 48, height: 48, color: C.gray300 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                    </svg>
                                    <Text type="supporting">메시지가 없습니다</Text>
                                </div>
                            ) : (
                                messages.map((message, index) => {
                                    const isMyMessage = message.senderId === userId;
                                    const isSystemMessage = message.type === "SYSTEM";
                                    const showDateSeparator =
                                        index === 0 ||
                                        getDateKey(message.createdAt) !== getDateKey(messages[index - 1].createdAt);

                                    const dateSeparator = showDateSeparator ? (
                                        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "12px 0" }}>
                                            <div style={{ flex: 1, height: 1, background: C.border }} />
                                            <Text type="supporting" size="xsm" weight="medium" textWrap="nowrap">
                                                {formatDateSeparator(message.createdAt)}
                                            </Text>
                                            <div style={{ flex: 1, height: 1, background: C.border }} />
                                        </div>
                                    ) : null;

                                    if (isSystemMessage) {
                                        return (
                                            <Fragment key={message.id}>
                                                {dateSeparator}
                                                <div style={{ display: "flex", justifyContent: "center" }}>
                                                    <span style={{ fontSize: 12, color: C.gray400, fontStyle: "italic" }}>{message.content}</span>
                                                </div>
                                            </Fragment>
                                        );
                                    }

                                    if (message.isDeleted) {
                                        return (
                                            <Fragment key={message.id}>
                                                {dateSeparator}
                                                <div style={{ display: "flex", justifyContent: isMyMessage ? "flex-end" : "flex-start" }}>
                                                    <span style={{ fontSize: 12, color: C.gray400, fontStyle: "italic", padding: "8px 12px" }}>
                                                        삭제된 메시지입니다
                                                    </span>
                                                </div>
                                            </Fragment>
                                        );
                                    }

                                    return (
                                        <Fragment key={message.id}>
                                            {dateSeparator}
                                            <div style={{ display: "flex", position: "relative", justifyContent: isMyMessage ? "flex-end" : "flex-start" }}>
                                                <div style={{ maxWidth: "70%", display: "flex", flexDirection: "column", alignItems: isMyMessage ? "flex-end" : "flex-start" }}>
                                                    {!isMyMessage && (
                                                        <div style={{ marginBottom: 4 }}>
                                                            <Text type="supporting" size="xsm" weight="medium" color="primary">
                                                                {message.senderName}
                                                            </Text>
                                                            {message.senderPosition && (
                                                                <Text type="supporting" size="xsm"> ({message.senderPosition})</Text>
                                                            )}
                                                        </div>
                                                    )}
                                                    <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                                                        {isMyMessage && (
                                                            <Text type="supporting" size="2xs">
                                                                {formatMessageTime(message.createdAt)}
                                                            </Text>
                                                        )}
                                                        <div
                                                            style={{
                                                                position: "relative",
                                                                padding: "8px 12px",
                                                                ...(isMyMessage
                                                                    ? { background: C.accent, color: C.white, borderRadius: "16px 4px 16px 16px" }
                                                                    : { background: C.white, border: `1px solid ${C.border}`, color: C.gray900, borderRadius: "4px 16px 16px 16px" }),
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
                                                                        fontSize: 12,
                                                                        padding: "4px 8px",
                                                                        marginBottom: 6,
                                                                        borderRadius: 6,
                                                                        borderLeft: isMyMessage ? "2px solid rgba(255,255,255,0.6)" : `2px solid ${C.gray300}`,
                                                                        background: isMyMessage ? "rgba(255,255,255,0.18)" : C.bgGray,
                                                                        color: isMyMessage ? "rgba(255,255,255,0.9)" : C.gray500,
                                                                    }}
                                                                >
                                                                    <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{message.replyToSenderName}</div>
                                                                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", opacity: 0.8 }}>
                                                                        {message.replyToType === "IMAGE" ? "📷 사진" : message.replyToType === "FILE" ? "📎 파일" : message.replyToContent}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {message.type === "IMAGE" && message.fileUrl ? (
                                                                <img
                                                                    src={message.fileUrl}
                                                                    alt={message.fileName || "이미지"}
                                                                    style={{ display: "block", maxWidth: "100%", maxHeight: 240, borderRadius: 4, cursor: "pointer" }}
                                                                    onClick={() => window.open(message.fileUrl, "_blank")}
                                                                />
                                                            ) : message.type === "FILE" && message.fileUrl ? (
                                                                <a
                                                                    href={message.fileUrl}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    style={{
                                                                        fontSize: 14,
                                                                        textDecoration: "underline",
                                                                        display: "inline-flex",
                                                                        alignItems: "center",
                                                                        gap: 4,
                                                                        color: isMyMessage ? C.white : C.accent,
                                                                    }}
                                                                >
                                                                    📎 {message.fileName || message.content}
                                                                </a>
                                                            ) : (
                                                                <span style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word", color: "inherit" }}>
                                                                    {message.content}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {!isMyMessage && (
                                                            <Text type="supporting" size="2xs">
                                                                {formatMessageTime(message.createdAt)}
                                                            </Text>
                                                        )}
                                                    </div>

                                                    {/* 리액션 표시 */}
                                                    {message.reactions && message.reactions.length > 0 && (
                                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                                                            {message.reactions.map((reaction) => (
                                                                <button
                                                                    key={reaction.emoji}
                                                                    onClick={() => handleToggleReaction(message.id, reaction.emoji)}
                                                                    className="carev-chat-reaction"
                                                                    style={{
                                                                        display: "inline-flex",
                                                                        alignItems: "center",
                                                                        gap: 2,
                                                                        padding: "2px 6px",
                                                                        borderRadius: 9999,
                                                                        fontSize: 12,
                                                                        cursor: "pointer",
                                                                        border: `1px solid ${reaction.myReaction ? C.softBorder : C.border}`,
                                                                        background: reaction.myReaction ? C.surface : C.white,
                                                                        color: reaction.myReaction ? C.accentDark : C.gray500,
                                                                    }}
                                                                    title={reaction.userNames?.join(", ")}
                                                                >
                                                                    <span>{reaction.emoji}</span>
                                                                    <span style={{ fontWeight: 500 }}>{reaction.count}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* 롱프레스 메뉴 */}
                                                    {contextMenuMessageId === message.id && (
                                                        <div style={{ position: "absolute", zIndex: 40, bottom: "100%", marginBottom: 4, ...(isMyMessage ? { right: 0 } : { left: 0 }) }}>
                                                            <div style={{ background: C.white, borderRadius: 12, boxShadow: "0 10px 25px rgba(0,0,0,0.12)", border: `1px solid ${C.border}`, overflow: "hidden" }}>
                                                                <div style={{ display: "flex", gap: 2, padding: "6px 8px", borderBottom: `1px solid ${C.gray100}` }}>
                                                                    {QUICK_EMOJIS.map((emoji) => (
                                                                        <button
                                                                            key={emoji}
                                                                            onClick={() => handleToggleReaction(message.id, emoji)}
                                                                            className="carev-chat-emoji-btn"
                                                                            style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, fontSize: 18, border: "none", background: "transparent", cursor: "pointer" }}
                                                                        >
                                                                            {emoji}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                                <button
                                                                    onClick={() => { setReplyTo(message); setContextMenuMessageId(null); }}
                                                                    className="carev-chat-menu-item"
                                                                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", fontSize: 14, color: C.gray700, border: "none", background: "transparent", cursor: "pointer", textAlign: "left" }}
                                                                >
                                                                    <svg style={{ width: 16, height: 16 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                            <div style={{ padding: "8px 16px", borderTop: `1px solid ${C.border}`, background: C.bgGray, display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ flex: 1, minWidth: 0, borderLeft: `2px solid ${C.accent}`, paddingLeft: 8 }}>
                                    <div>
                                        <Text type="supporting" size="xsm" weight="semibold" color="accent" maxLines={1}>{replyTo.senderName}</Text>
                                    </div>
                                    <div>
                                        <Text type="supporting" size="xsm" maxLines={1}>
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
                        <div style={{ padding: 16, borderTop: `1px solid ${C.border}` }}>
                            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                                <div style={{ flex: 1 }}>
                                    <TextInput
                                        label="메시지 입력"
                                        isLabelHidden
                                        type="text"
                                        value={messageInput}
                                        onChange={(value) => setMessageInput(value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder={replyTo ? `${replyTo.senderName}에게 답장...` : "메시지를 입력하세요..."}
                                        isDisabled={isSendingMessage}
                                    />
                                </div>
                                <Button
                                    label={isSendingMessage ? "전송 중..." : "전송"}
                                    variant="primary"
                                    onClick={sendMessage}
                                    isDisabled={!messageInput.trim() || isSendingMessage}
                                    isLoading={isSendingMessage}
                                />
                            </div>
                        </div>

                        {/* Info Drawer */}
                        {showDrawer && (
                            <div style={{ position: "absolute", inset: 0, background: C.white, zIndex: 20, display: "flex", flexDirection: "column" }}>
                                {/* Drawer Header */}
                                <div style={{ padding: 16, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
                                    <div style={{ padding: 16, borderBottom: `1px solid ${C.gray100}` }}>
                                        <div style={{ marginBottom: 12 }}>
                                            <Text type="label" weight="semibold">
                                                참여자 ({participants.length}명)
                                            </Text>
                                        </div>
                                        {isLoadingParticipants ? (
                                            <div style={{ display: "flex", justifyContent: "center", padding: "16px 0" }}>
                                                <Spinner size="md" />
                                            </div>
                                        ) : participants.length > 0 ? (
                                            <VStack gap={2}>
                                                {participants.map((p, i) => (
                                                    <div key={p.userId || i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0" }}>
                                                        <div style={{ width: 32, height: 32, background: C.surface, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                                            <span style={{ fontSize: 14, fontWeight: 500, color: C.accentDark }}>
                                                                {p.userName?.charAt(0) || "?"}
                                                            </span>
                                                        </div>
                                                        <Text type="body">{p.userName}</Text>
                                                    </div>
                                                ))}
                                            </VStack>
                                        ) : (
                                            <div style={{ textAlign: "center", padding: "16px 0" }}>
                                                <Text type="supporting">참여자 정보를 불러올 수 없습니다</Text>
                                            </div>
                                        )}
                                    </div>

                                    {/* 사진 */}
                                    <div style={{ padding: 16, borderBottom: `1px solid ${C.gray100}` }}>
                                        <div style={{ marginBottom: 12 }}>
                                            <Text type="label" weight="semibold">
                                                사진 ({messages.filter(m => m.type === "IMAGE" && m.fileUrl).length})
                                            </Text>
                                        </div>
                                        {messages.filter(m => m.type === "IMAGE" && m.fileUrl).length > 0 ? (
                                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                                                {messages.filter(m => m.type === "IMAGE" && m.fileUrl).map(m => (
                                                    <img
                                                        key={m.id}
                                                        src={m.fileUrl!}
                                                        alt={m.fileName || "사진"}
                                                        className="carev-chat-photo"
                                                        style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", borderRadius: 8, cursor: "pointer" }}
                                                        onClick={() => window.open(m.fileUrl, "_blank")}
                                                    />
                                                ))}
                                            </div>
                                        ) : (
                                            <div style={{ textAlign: "center", padding: "16px 0" }}>
                                                <Text type="supporting">공유된 사진이 없습니다</Text>
                                            </div>
                                        )}
                                    </div>

                                    {/* 파일 */}
                                    <div style={{ padding: 16, borderBottom: `1px solid ${C.gray100}` }}>
                                        <div style={{ marginBottom: 12 }}>
                                            <Text type="label" weight="semibold">
                                                파일 ({messages.filter(m => m.type === "FILE" && m.fileUrl).length})
                                            </Text>
                                        </div>
                                        {messages.filter(m => m.type === "FILE" && m.fileUrl).length > 0 ? (
                                            <VStack gap={2}>
                                                {messages.filter(m => m.type === "FILE" && m.fileUrl).map(m => (
                                                    <a
                                                        key={m.id}
                                                        href={m.fileUrl!}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="carev-chat-file-link"
                                                        style={{ display: "flex", alignItems: "center", gap: 12, padding: 8, borderRadius: 8, textDecoration: "none" }}
                                                    >
                                                        <div style={{ width: 32, height: 32, background: C.gray100, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                                            <svg style={{ width: 16, height: 16, color: C.gray500 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                                            </svg>
                                                        </div>
                                                        <div style={{ minWidth: 0, flex: 1 }}>
                                                            <Text type="body" size="sm" maxLines={1}>{m.fileName || m.content}</Text>
                                                            <div>
                                                                <Text type="supporting" size="2xs">{formatMessageTime(m.createdAt)}</Text>
                                                            </div>
                                                        </div>
                                                    </a>
                                                ))}
                                            </VStack>
                                        ) : (
                                            <div style={{ textAlign: "center", padding: "16px 0" }}>
                                                <Text type="supporting">공유된 파일이 없습니다</Text>
                                            </div>
                                        )}
                                    </div>

                                    {/* 채팅방 삭제 (관리자만) */}
                                    {isAdmin && (
                                        <div style={{ padding: 16 }}>
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
                            <VStack gap={2}>
                                <Text type="body">
                                    <strong>{rooms.find(r => r.id === selectedRoom)?.name}</strong> 채팅방을 삭제하시겠습니까?
                                </Text>
                                <span style={{ fontSize: 14, color: C.red500 }}>삭제된 채팅방과 메시지는 복구할 수 없습니다.</span>
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
        </div>
    );
}
