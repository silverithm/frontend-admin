"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Client, IMessage } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { motion, AnimatePresence } from "framer-motion";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Card } from "@astryxdesign/core/Card";
import { Badge } from "@astryxdesign/core/Badge";
import { ChatRoom, ChatMessage, WebSocketMessage } from "./floatingChatTypes";
import { FloatingChatRoomList } from "./FloatingChatRoomList";
import { FloatingChatMessages } from "./FloatingChatMessages";
import { fetchChatRooms, fetchChatMessages, markChatAsRead, sendChatMessage } from '@/lib/apiService';
import { useVisiblePolling } from '@/lib/useVisiblePolling';
import { duration } from '@/theme/motion';

const BACKEND_WS_URL = process.env.NEXT_PUBLIC_API_URL || "https://silverithm.site";

type ChatView = "rooms" | "messages";

interface ChatToast {
    key: number;
    roomId: number;
    roomName: string;
    senderName: string;
    content: string;
}

export function FloatingChat() {
    const [isOpen, setIsOpen] = useState(false);
    const [currentView, setCurrentView] = useState<ChatView>("rooms");
    const [rooms, setRooms] = useState<ChatRoom[]>([]);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
    const [messageInput, setMessageInput] = useState("");
    const [isLoadingRooms, setIsLoadingRooms] = useState(false);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [isSendingMessage, setIsSendingMessage] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [toasts, setToasts] = useState<ChatToast[]>([]);

    const stompClientRef = useRef<Client | null>(null);
    const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
    // WS 콜백에서 최신 상태를 참조하기 위한 ref들
    const selectedRoomIdRef = useRef<number | null>(null);
    const isOpenRef = useRef(false);
    const roomsRef = useRef<ChatRoom[]>([]);
    const toastKeyRef = useRef(0);

    useEffect(() => { selectedRoomIdRef.current = selectedRoomId; }, [selectedRoomId]);
    useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);
    useEffect(() => { roomsRef.current = rooms; }, [rooms]);

    const [companyId] = useState(() => typeof window !== "undefined" ? localStorage.getItem("companyId") : null);
    const [userId] = useState(() => typeof window !== "undefined" ? localStorage.getItem("userId") : null);
    const [userName] = useState(() => typeof window !== "undefined" ? localStorage.getItem("userName") : null);
    const [authToken] = useState(() => typeof window !== "undefined" ? localStorage.getItem("authToken") : null);

    const totalUnread = rooms.reduce((sum, room) => sum + room.unreadCount, 0);

    // --- API calls ---

    const fetchRooms = useCallback(async () => {
        if (!companyId || !userId) return;

        setIsLoadingRooms(true);
        try {
            const data = await fetchChatRooms();
            const roomList = Array.isArray(data) ? data : (data.rooms || data.content || data.data || []);
            setRooms(roomList);
        } catch (error) {
            console.error("[FloatingChat] Error fetching rooms:", error);
        } finally {
            setIsLoadingRooms(false);
        }
    }, [companyId, userId]);

    const fetchMessages = useCallback(async (roomId: number): Promise<number | null> => {
        setIsLoadingMessages(true);
        try {
            const data = await fetchChatMessages(roomId, 0, 50);
            const msgList = Array.isArray(data) ? data : (data.messages || data.content || data.data || []);
            const sorted = [...msgList].reverse();
            setMessages(sorted);
            return msgList.length > 0 ? msgList[0].id : null;
        } catch (error) {
            console.error("[FloatingChat] Error fetching messages:", error);
            return null;
        } finally {
            setIsLoadingMessages(false);
        }
    }, []);

    const markAsRead = useCallback(async (roomId: number, lastMsgId: number) => {
        if (!userId || !userName) return;

        try {
            await markChatAsRead(roomId, lastMsgId);

            setRooms(prev => prev.map(room =>
                room.id === roomId ? { ...room, unreadCount: 0 } : room
            ));
        } catch (error) {
            console.error("[FloatingChat] Error marking messages as read:", error);
        }
    }, [userId, userName]);

    // --- WebSocket ---

    useEffect(() => {
        if (!authToken || !userId) return;

        const client = new Client({
            webSocketFactory: () => new SockJS(`${BACKEND_WS_URL}/ws/chat`),
            // 서버 WS 인터셉터가 CONNECT 프레임의 Authorization 헤더를 요구한다
            connectHeaders: { Authorization: `Bearer ${authToken}` },
            reconnectDelay: 5000,
            heartbeatIncoming: 10000,
            heartbeatOutgoing: 10000,
            onConnect: () => {
                console.log("[FloatingChat WebSocket] 연결됨");
                setIsConnected(true);
            },
            onDisconnect: () => {
                console.log("[FloatingChat WebSocket] 연결 해제됨");
                setIsConnected(false);
            },
            onStompError: (frame) => {
                console.error("[FloatingChat WebSocket] STOMP 오류:", frame.headers["message"]);
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
    }, [authToken, userId]);

    // 방 목록 로드 + 30초 주기 갱신 (보고 있는 탭에서만)
    useVisiblePolling(fetchRooms, 30000);

    // Room selection or WebSocket reconnection: fetch messages + mark as read
    useEffect(() => {
        if (!selectedRoomId) return;
        (async () => {
            const lastMsgId = await fetchMessages(selectedRoomId);
            if (lastMsgId) {
                markAsRead(selectedRoomId, lastMsgId);
            }
        })();
    }, [selectedRoomId, isConnected, fetchMessages, markAsRead]);

    // 참여 중인 모든 방 구독 — 안 보고 있는 방의 새 메시지는 뱃지 증가 + 토스트 알림
    const roomIdsKey = rooms.map(r => r.id).sort((a, b) => a - b).join(",");
    useEffect(() => {
        const client = stompClientRef.current;
        if (!client || !isConnected || !roomIdsKey) return;

        const subscriptions = roomIdsKey.split(",").map(idStr => {
            const roomId = Number(idStr);
            return client.subscribe(`/topic/chat/${roomId}`, (stompMessage: IMessage) => {
                try {
                    const wsMessage: WebSocketMessage = JSON.parse(stompMessage.body);
                    if (wsMessage.type !== "MESSAGE" || !wsMessage.message) return;

                    const msg = wsMessage.message;
                    const isMine = String(msg.senderId) === String(userId);
                    const isViewing = isOpenRef.current && selectedRoomIdRef.current === roomId;

                    if (isViewing) {
                        setMessages(prev => {
                            if (prev.some(m => m.id === msg.id)) return prev;
                            return [...prev, msg];
                        });
                        if (!isMine) markAsRead(roomId, msg.id);
                    }

                    setRooms(prevRooms => prevRooms.map(room => {
                        if (room.id !== roomId) return room;
                        return {
                            ...room,
                            lastMessage: {
                                content: msg.content,
                                senderName: msg.senderName,
                                createdAt: msg.createdAt,
                            },
                            lastMessageAt: msg.createdAt,
                            unreadCount: isViewing || isMine ? room.unreadCount : room.unreadCount + 1,
                        };
                    }));

                    if (!isViewing && !isMine) {
                        const roomName = roomsRef.current.find(r => r.id === roomId)?.name || "채팅";
                        const key = ++toastKeyRef.current;
                        setToasts(prev => [...prev.slice(-2), {
                            key,
                            roomId,
                            roomName,
                            senderName: msg.senderName,
                            content: msg.type === "TEXT" ? msg.content : (msg.fileName || "파일"),
                        }]);
                        setTimeout(() => {
                            setToasts(prev => prev.filter(t => t.key !== key));
                        }, 5000);
                    }
                } catch (e) {
                    console.error("[FloatingChat WebSocket] 메시지 파싱 오류:", e);
                }
            });
        });

        return () => {
            subscriptions.forEach(s => s.unsubscribe());
        };
    }, [isConnected, roomIdsKey, userId, markAsRead]);

    // 읽음 이벤트 구독 (보고 있는 방만)
    useEffect(() => {
        if (!selectedRoomId || !stompClientRef.current || !isConnected) return;

        if (subscriptionRef.current) {
            subscriptionRef.current.unsubscribe();
            subscriptionRef.current = null;
        }

        const readSubscription = stompClientRef.current.subscribe(
            `/topic/chat/${selectedRoomId}/read`,
            (stompMessage: IMessage) => {
                try {
                    const wsMessage = JSON.parse(stompMessage.body);
                    if (wsMessage.type === "READ" && wsMessage.senderId !== userId) {
                        setMessages(prev => prev.map(msg => {
                            if (msg.id <= (wsMessage.lastReadMessageId || 0)) {
                                return { ...msg, readCount: msg.readCount + 1 };
                            }
                            return msg;
                        }));
                    }
                } catch (e) {
                    console.error("[FloatingChat WebSocket] 읽음 이벤트 파싱 오류:", e);
                }
            }
        );

        subscriptionRef.current = readSubscription;

        return () => {
            readSubscription.unsubscribe();
        };
    }, [selectedRoomId, isConnected, userId]);

    // --- Send message ---

    const sendMessage = async (replyToId?: number) => {
        if (!messageInput.trim() || !selectedRoomId || !userId || !userName) return;

        const client = stompClientRef.current;

        if (client && isConnected) {
            setIsSendingMessage(true);
            try {
                client.publish({
                    destination: `/app/chat/${selectedRoomId}/send`,
                    body: JSON.stringify({
                        senderId: userId,
                        senderName: userName,
                        type: "TEXT",
                        content: messageInput.trim(),
                        replyToId: replyToId || null,
                    }),
                });
                setMessageInput("");
            } catch (error) {
                console.error("[FloatingChat] Error sending message via WebSocket:", error);
                await sendMessageREST(replyToId);
            } finally {
                setIsSendingMessage(false);
            }
        } else {
            await sendMessageREST(replyToId);
        }
    };

    const sendMessageREST = async (replyToId?: number) => {
        if (!messageInput.trim() || !selectedRoomId || !userId || !userName) return;

        setIsSendingMessage(true);
        try {
            const response = await sendChatMessage(selectedRoomId, {
                senderId: userId,
                senderName: userName,
                type: "TEXT",
                content: messageInput.trim(),
                replyToId: replyToId || null,
            });

            // 백엔드가 { success, message } wrapper로 반환하므로 unwrap
            const newMessage = response.message || response;

            setMessages(prev => {
                if (prev.some(m => m.id === newMessage.id)) return prev;
                return [...prev, newMessage];
            });
            setMessageInput("");
            fetchRooms();
        } catch (error) {
            console.error("[FloatingChat] Error sending message:", error);
        } finally {
            setIsSendingMessage(false);
        }
    };

    // --- Handlers ---

    const handleSelectRoom = (roomId: number) => {
        setSelectedRoomId(roomId);
        setCurrentView("messages");
    };

    const handleBack = () => {
        setCurrentView("rooms");
        setSelectedRoomId(null);
        setMessages([]);
        fetchRooms();
    };

    const handleToggle = () => {
        setIsOpen(prev => !prev);
    };

    const handleToastClick = (toast: ChatToast) => {
        setToasts([]);
        setIsOpen(true);
        handleSelectRoom(toast.roomId);
    };

    // Don't render if no auth
    if (!companyId || !userId || !userName || !authToken) return null;

    const selectedRoom = rooms.find(r => r.id === selectedRoomId);

    return (
        <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 40 }}>
            {/* 새 메시지 토스트 — 패널이 열려 있으면 패널 위로 올린다 */}
            <div
                style={{
                    position: "absolute",
                    bottom: isOpen ? 64 + 550 + 12 : 64,
                    right: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 'var(--spacing-2)',
                    alignItems: "flex-end",
                }}
            >
                <AnimatePresence>
                    {toasts.map(toast => (
                        <motion.button
                            key={toast.key}
                            initial={{ opacity: 0, x: 24 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 24 }}
                            transition={{ duration: duration.fast }}
                            onClick={() => handleToastClick(toast)}
                            style={{
                                width: 300,
                                textAlign: "left",
                                cursor: "pointer",
                                border: "1px solid var(--color-border)",
                                borderRadius: "var(--radius-container)",
                                background: "var(--color-background-card)",
                                boxShadow: "var(--shadow-high)",
                                padding: "10px 14px",
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    gap: 'var(--spacing-2)',
                                    marginBottom: 'var(--spacing-0-5)',
                                    fontSize: 12,
                                    color: "var(--color-text-secondary)",
                                }}
                            >
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {toast.roomName}
                                </span>
                                <span style={{ flexShrink: 0, color: "var(--color-text-accent)" }}>새 메시지</span>
                            </div>
                            <div
                                style={{
                                    fontSize: 13,
                                    color: "var(--color-text-primary)",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                <strong>{toast.senderName}</strong>: {toast.content}
                            </div>
                        </motion.button>
                    ))}
                </AnimatePresence>
            </div>

            {/* Panel */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 16, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 16, scale: 0.95 }}
                        transition={{ duration: duration.fast, ease: "easeOut" }}
                        style={{ position: "absolute", bottom: 64, right: 0 }}
                    >
                        <Card
                            padding={0}
                            style={{
                                width: 380,
                                height: 550,
                                borderRadius: 'var(--radius-container)',
                                boxShadow: 'var(--shadow-high)',
                                overflow: "hidden",
                                display: "flex",
                                flexDirection: "column",
                            }}
                        >
                            <AnimatePresence mode="wait" initial={false}>
                                {currentView === "rooms" ? (
                                    <motion.div
                                        key="rooms"
                                        initial={{ x: -20, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                        exit={{ x: -20, opacity: 0 }}
                                        transition={{ duration: duration.fastMin }}
                                        style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
                                    >
                                        <FloatingChatRoomList
                                            rooms={rooms}
                                            isLoadingRooms={isLoadingRooms}
                                            isConnected={isConnected}
                                            onSelectRoom={handleSelectRoom}
                                        />
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="messages"
                                        initial={{ x: 20, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                        exit={{ x: 20, opacity: 0 }}
                                        transition={{ duration: duration.fastMin }}
                                        style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
                                    >
                                        <FloatingChatMessages
                                            roomId={selectedRoomId!}
                                            roomName={selectedRoom?.name || "채팅방"}
                                            participantCount={selectedRoom?.participantCount || 0}
                                            messages={messages}
                                            isLoadingMessages={isLoadingMessages}
                                            isSendingMessage={isSendingMessage}
                                            userId={userId}
                                            messageInput={messageInput}
                                            onMessageInputChange={setMessageInput}
                                            onBack={handleBack}
                                            onSendMessage={sendMessage}
                                            onMessagesUpdate={setMessages}
                                        />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* FAB Button */}
            <div style={{ position: "relative" }}>
                <IconButton
                    label={isOpen ? "채팅 닫기" : "채팅 열기"}
                    className="carev-fchat-fab"
                    onClick={handleToggle}
                    style={{
                        width: 56,
                        height: 56,
                        minWidth: 56,
                        padding: 'var(--spacing-0)',
                        borderRadius: 'var(--radius-full)',
                        background: 'var(--color-border-teal)',
                        color: 'var(--color-on-accent)',
                        boxShadow: 'var(--shadow-med)',
                        transition: 'background-color var(--duration-fast) var(--ease-standard), box-shadow var(--duration-fast) var(--ease-standard)',
                    }}
                    icon={
                        <AnimatePresence mode="wait">
                            {isOpen ? (
                                <motion.svg
                                    key="close"
                                    initial={{ rotate: -90, opacity: 0 }}
                                    animate={{ rotate: 0, opacity: 1 }}
                                    exit={{ rotate: 90, opacity: 0 }}
                                    transition={{ duration: duration.fastMin }}
                                    style={{ width: 24, height: 24, color: 'var(--color-on-accent)' }}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </motion.svg>
                            ) : (
                                <motion.svg
                                    key="chat"
                                    initial={{ rotate: 90, opacity: 0 }}
                                    animate={{ rotate: 0, opacity: 1 }}
                                    exit={{ rotate: -90, opacity: 0 }}
                                    transition={{ duration: duration.fastMin }}
                                    style={{ width: 24, height: 24, color: 'var(--color-on-accent)' }}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </motion.svg>
                            )}
                        </AnimatePresence>
                    }
                />

                {/* Unread badge */}
                {!isOpen && totalUnread > 0 && (
                    <motion.div
                        style={{ position: "absolute", top: -4, right: -4, pointerEvents: "none" }}
                        animate={{ scale: [1, 1.12, 1] }}
                        transition={{ duration: duration.slowMax, repeat: Infinity, ease: "easeInOut" }}
                    >
                        <Badge variant="error" label={totalUnread > 99 ? "99+" : totalUnread} />
                    </motion.div>
                )}
            </div>
        </div>
    );
}
