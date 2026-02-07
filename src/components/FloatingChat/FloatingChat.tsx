"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Client, IMessage } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { motion, AnimatePresence } from "framer-motion";
import { ChatRoom, ChatMessage, WebSocketMessage } from "./floatingChatTypes";
import { FloatingChatRoomList } from "./FloatingChatRoomList";
import { FloatingChatMessages } from "./FloatingChatMessages";

const BACKEND_WS_URL = process.env.NEXT_PUBLIC_API_URL || "https://silverithm.site";

type ChatView = "rooms" | "messages";

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

    const stompClientRef = useRef<Client | null>(null);
    const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
    const pollingRef = useRef<NodeJS.Timeout | null>(null);

    const companyId = typeof window !== "undefined" ? localStorage.getItem("companyId") : null;
    const userId = typeof window !== "undefined" ? localStorage.getItem("userId") : null;
    const userName = typeof window !== "undefined" ? localStorage.getItem("userName") : null;
    const authToken = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;

    const totalUnread = rooms.reduce((sum, room) => sum + room.unreadCount, 0);

    // --- API calls ---

    const fetchRooms = useCallback(async () => {
        if (!companyId || !userId || !authToken) return;

        setIsLoadingRooms(true);
        try {
            const response = await fetch(`/api/v1/chat/rooms?companyId=${companyId}&userId=${userId}`, {
                headers: {
                    Authorization: `Bearer ${authToken}`,
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) throw new Error("Failed to fetch chat rooms");

            const data = await response.json();
            const roomList = Array.isArray(data) ? data : (data.rooms || data.content || data.data || []);
            setRooms(roomList);
        } catch (error) {
            console.error("[FloatingChat] Error fetching rooms:", error);
        } finally {
            setIsLoadingRooms(false);
        }
    }, [companyId, userId, authToken]);

    const fetchMessages = useCallback(async (roomId: number): Promise<number | null> => {
        if (!authToken) return null;

        setIsLoadingMessages(true);
        try {
            const response = await fetch(`/api/v1/chat/rooms/${roomId}/messages?page=0&size=50`, {
                headers: {
                    Authorization: `Bearer ${authToken}`,
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) throw new Error("Failed to fetch messages");

            const data = await response.json();
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
    }, [authToken]);

    const markAsRead = useCallback(async (roomId: number, lastMsgId: number) => {
        if (!authToken || !userId || !userName) return;

        try {
            await fetch(`/api/v1/chat/rooms/${roomId}/read`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${authToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ userId, userName, lastMessageId: lastMsgId }),
            });

            setRooms(prev => prev.map(room =>
                room.id === roomId ? { ...room, unreadCount: 0 } : room
            ));
        } catch (error) {
            console.error("[FloatingChat] Error marking messages as read:", error);
        }
    }, [authToken, userId, userName]);

    // --- WebSocket ---

    useEffect(() => {
        if (!authToken || !userId) return;

        const client = new Client({
            webSocketFactory: () => new SockJS(`${BACKEND_WS_URL}/ws/chat`),
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

    // Fetch rooms on mount + polling every 30s
    useEffect(() => {
        fetchRooms();

        pollingRef.current = setInterval(() => {
            fetchRooms();
        }, 30000);

        return () => {
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
        };
    }, [fetchRooms]);

    // Room selection: fetch messages + mark as read
    useEffect(() => {
        if (!selectedRoomId) return;
        (async () => {
            const lastMsgId = await fetchMessages(selectedRoomId);
            if (lastMsgId) {
                markAsRead(selectedRoomId, lastMsgId);
            }
        })();
    }, [selectedRoomId, fetchMessages, markAsRead]);

    // WebSocket subscription when room changes
    useEffect(() => {
        if (!selectedRoomId || !stompClientRef.current || !isConnected) return;

        if (subscriptionRef.current) {
            subscriptionRef.current.unsubscribe();
            subscriptionRef.current = null;
        }

        const subscription = stompClientRef.current.subscribe(
            `/topic/chat/${selectedRoomId}`,
            (stompMessage: IMessage) => {
                try {
                    const wsMessage: WebSocketMessage = JSON.parse(stompMessage.body);

                    if (wsMessage.type === "MESSAGE" && wsMessage.message) {
                        setMessages(prev => {
                            if (prev.some(m => m.id === wsMessage.message!.id)) return prev;
                            return [...prev, wsMessage.message!];
                        });

                        markAsRead(wsMessage.roomId, wsMessage.message.id);

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
                    console.error("[FloatingChat WebSocket] 메시지 파싱 오류:", e);
                }
            }
        );

        subscriptionRef.current = subscription;

        return () => {
            subscription.unsubscribe();
        };
    }, [selectedRoomId, isConnected, markAsRead]);

    // --- Send message ---

    const sendMessage = async () => {
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
                    }),
                });
                setMessageInput("");
            } catch (error) {
                console.error("[FloatingChat] Error sending message via WebSocket:", error);
                await sendMessageREST();
            } finally {
                setIsSendingMessage(false);
            }
        } else {
            await sendMessageREST();
        }
    };

    const sendMessageREST = async () => {
        if (!messageInput.trim() || !selectedRoomId || !userId || !userName || !authToken) return;

        setIsSendingMessage(true);
        try {
            const response = await fetch(`/api/v1/chat/rooms/${selectedRoomId}/messages`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${authToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    senderId: userId,
                    senderName: userName,
                    type: "TEXT",
                    content: messageInput.trim(),
                }),
            });

            if (!response.ok) throw new Error("Failed to send message");

            const newMessage = await response.json();
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

    // Don't render if no auth
    if (!companyId || !userId || !userName || !authToken) return null;

    const selectedRoom = rooms.find(r => r.id === selectedRoomId);

    return (
        <div className="fixed bottom-6 right-6 z-[30]">
            {/* Panel */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 16, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 16, scale: 0.95 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="absolute bottom-16 right-0 w-[380px] h-[550px] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col"
                    >
                        <AnimatePresence mode="wait" initial={false}>
                            {currentView === "rooms" ? (
                                <motion.div
                                    key="rooms"
                                    initial={{ x: -20, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    exit={{ x: -20, opacity: 0 }}
                                    transition={{ duration: 0.15 }}
                                    className="flex-1 flex flex-col min-h-0"
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
                                    transition={{ duration: 0.15 }}
                                    className="flex-1 flex flex-col min-h-0"
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
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* FAB Button */}
            <button
                onClick={handleToggle}
                className="w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center relative"
                aria-label={isOpen ? "채팅 닫기" : "채팅 열기"}
            >
                <AnimatePresence mode="wait">
                    {isOpen ? (
                        <motion.svg
                            key="close"
                            initial={{ rotate: -90, opacity: 0 }}
                            animate={{ rotate: 0, opacity: 1 }}
                            exit={{ rotate: 90, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="w-6 h-6"
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
                            transition={{ duration: 0.15 }}
                            className="w-6 h-6"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </motion.svg>
                    )}
                </AnimatePresence>

                {/* Unread badge */}
                {!isOpen && totalUnread > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold min-w-[20px] h-[20px] flex items-center justify-center px-1 rounded-full animate-pulse">
                        {totalUnread > 99 ? "99+" : totalUnread}
                    </span>
                )}
            </button>
        </div>
    );
}
