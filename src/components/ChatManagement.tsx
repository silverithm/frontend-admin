"use client";

import { useState, useEffect, useRef, useCallback, Fragment } from "react";
import { Client, IMessage } from "@stomp/stompjs";
import SockJS from "sockjs-client";

interface ChatManagementProps {
    onNotification: (message: string, type: "success" | "error" | "info") => void;
}

interface ChatMessage {
    id: number;
    chatRoomId: number;
    senderId: string;
    senderName: string;
    type: "TEXT" | "IMAGE" | "FILE" | "SYSTEM";
    content: string;
    fileUrl?: string;
    fileName?: string;
    createdAt: string;
    isDeleted: boolean;
    readCount: number;
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

export function ChatManagement({ onNotification }: ChatManagementProps) {
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

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const stompClientRef = useRef<Client | null>(null);
    const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);

    const companyId = typeof window !== "undefined" ? localStorage.getItem("companyId") : null;
    const userId = typeof window !== "undefined" ? localStorage.getItem("userId") : null;
    const userName = typeof window !== "undefined" ? localStorage.getItem("userName") : null;
    const authToken = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // 읽음 처리 API 호출 (lastMsgId는 반드시 인자로 전달)
    const markAsRead = useCallback(async (roomId: number, lastMsgId: number) => {
        if (!authToken || !userId || !userName) return;

        try {
            await fetch(`/api/v1/chat/rooms/${roomId}/read`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${authToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ userId, userName, lastMessageId: lastMsgId }),
            });

            // 로컬 unreadCount 즉시 0으로 갱신
            setRooms(prev => prev.map(room =>
                room.id === roomId ? { ...room, unreadCount: 0 } : room
            ));
        } catch (error) {
            console.error("Error marking messages as read:", error);
        }
    }, [authToken, userId, userName]);

    const fetchRooms = useCallback(async () => {
        if (!companyId || !userId || !authToken) return;

        setIsLoadingRooms(true);
        try {
            const response = await fetch(`/api/v1/chat/rooms?companyId=${companyId}&userId=${userId}`, {
                headers: {
                    "Authorization": `Bearer ${authToken}`,
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) throw new Error("Failed to fetch chat rooms");

            const data = await response.json();
            const roomList = Array.isArray(data) ? data : (data.rooms || data.content || data.data || []);
            setRooms(roomList);
        } catch (error) {
            console.error("Error fetching rooms:", error);
            onNotification("채팅방 목록을 불러오는데 실패했습니다", "error");
        } finally {
            setIsLoadingRooms(false);
        }
    }, [companyId, userId, authToken, onNotification]);

    // 메시지 로드 후 마지막 메시지 ID 반환
    const fetchMessages = useCallback(async (roomId: number): Promise<number | null> => {
        if (!authToken) return null;

        setIsLoadingMessages(true);
        try {
            const response = await fetch(`/api/v1/chat/rooms/${roomId}/messages?page=0&size=50`, {
                headers: {
                    "Authorization": `Bearer ${authToken}`,
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) throw new Error("Failed to fetch messages");

            const data = await response.json();
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
    }, [authToken, onNotification]);

    // WebSocket 연결
    useEffect(() => {
        if (!authToken || !userId) return;

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
    }, [authToken, userId]);

    // 방 선택 시 메시지 로드 → 읽음 처리 (WebSocket 연결과 무관)
    useEffect(() => {
        if (!selectedRoom) return;
        (async () => {
            const lastMsgId = await fetchMessages(selectedRoom);
            if (lastMsgId) {
                markAsRead(selectedRoom, lastMsgId);
            }
        })();
    }, [selectedRoom, fetchMessages, markAsRead]);

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

        subscriptionRef.current = subscription;

        return () => {
            subscription.unsubscribe();
        };
    }, [selectedRoom, isConnected, fetchMessages, markAsRead]);

    const sendMessage = async () => {
        if (!messageInput.trim() || !selectedRoom || !userId || !userName) return;

        const client = stompClientRef.current;

        // WebSocket으로 전송 (연결 시)
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
                    }),
                });
                setMessageInput("");
            } catch (error) {
                console.error("Error sending message via WebSocket:", error);
                // WebSocket 실패 시 REST 폴백
                await sendMessageREST();
            } finally {
                setIsSendingMessage(false);
            }
        } else {
            // WebSocket 미연결 시 REST 폴백
            await sendMessageREST();
        }
    };

    const sendMessageREST = async () => {
        if (!messageInput.trim() || !selectedRoom || !userId || !userName || !authToken) return;

        setIsSendingMessage(true);
        try {
            const response = await fetch(`/api/v1/chat/rooms/${selectedRoom}/messages`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${authToken}`,
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
        if (!newRoomName.trim() || !companyId || !userId || !userName || !authToken) return;

        try {
            const response = await fetch(`/api/v1/chat/rooms?companyId=${companyId}`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${authToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name: newRoomName.trim(),
                    description: newRoomDescription.trim() || undefined,
                    creatorId: userId,
                    creatorName: userName,
                    participantIds: [userId],
                }),
            });

            if (!response.ok) throw new Error("Failed to create room");

            onNotification("채팅방이 생성되었습니다", "success");
            setShowCreateModal(false);
            setNewRoomName("");
            setNewRoomDescription("");
            fetchRooms();
        } catch (error) {
            console.error("Error creating room:", error);
            onNotification("채팅방 생성에 실패했습니다", "error");
        }
    };

    const fetchParticipants = useCallback(async (roomId: number) => {
        if (!authToken) return;
        setIsLoadingParticipants(true);
        try {
            const response = await fetch(`/api/v1/chat/rooms/${roomId}/participants`, {
                headers: { "Authorization": `Bearer ${authToken}` },
            });
            if (!response.ok) throw new Error("Failed to fetch participants");
            const data = await response.json();
            const list = Array.isArray(data) ? data : (data.participants || data.content || data.data || []);
            setParticipants(list);
        } catch (error) {
            console.error("Error fetching participants:", error);
        } finally {
            setIsLoadingParticipants(false);
        }
    }, [authToken]);

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

    // 초기 방 목록 로드 (한 번만)
    useEffect(() => {
        fetchRooms();
    }, [fetchRooms]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    if (!companyId || !userId || !userName || !authToken) {
        return (
            <div className="flex items-center justify-center h-96">
                <p className="text-gray-500">로그인 정보를 확인할 수 없습니다</p>
            </div>
        );
    }

    return (
        <div className="flex h-[calc(100vh-200px)] bg-white rounded-lg shadow-sm border border-gray-200">
            {/* Left Panel - Room List */}
            <div className="w-1/3 border-r border-gray-200 flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold text-gray-900">채팅</h2>
                        <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-gray-400"}`}
                              title={isConnected ? "실시간 연결됨" : "연결 중..."} />
                    </div>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        새 채팅방
                    </button>
                </div>

                {/* Room List */}
                <div className="flex-1 overflow-y-auto">
                    {isLoadingRooms ? (
                        <div className="flex items-center justify-center h-32">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                    ) : rooms.length === 0 ? (
                        <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
                            채팅방이 없습니다
                        </div>
                    ) : (
                        rooms.map((room) => (
                            <button
                                key={room.id}
                                onClick={() => { setSelectedRoom(room.id); setShowDrawer(false); }}
                                className={`w-full p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors text-left ${
                                    selectedRoom === room.id ? "bg-blue-50" : ""
                                }`}
                            >
                                <div className="flex items-start justify-between mb-1">
                                    <h3 className="font-semibold text-gray-900 text-sm">{room.name}</h3>
                                    {room.unreadCount > 0 && (
                                        <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                                            {room.unreadCount}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center justify-between">
                                    <p className="text-xs text-gray-600 truncate flex-1">
                                        {room.lastMessage?.content || "메시지가 없습니다"}
                                    </p>
                                    {room.lastMessageAt && (
                                        <span className="text-xs text-gray-400 ml-2">
                                            {formatTimestamp(room.lastMessageAt)}
                                        </span>
                                    )}
                                </div>
                                <div className="text-xs text-gray-400 mt-1">
                                    참여자 {room.participantCount}명
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* Right Panel - Messages */}
            <div className="w-2/3 flex flex-col relative">
                {selectedRoom ? (
                    <>
                        {/* Header */}
                        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900">
                                    {rooms.find(r => r.id === selectedRoom)?.name || "채팅방"}
                                </h2>
                                <p className="text-xs text-gray-500">
                                    참여자 {rooms.find(r => r.id === selectedRoom)?.participantCount || 0}명
                                </p>
                            </div>
                            <button
                                onClick={toggleDrawer}
                                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                                aria-label="채팅방 정보"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                            </button>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {isLoadingMessages ? (
                                <div className="flex items-center justify-center h-full">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="flex items-center justify-center h-full text-gray-500 text-sm">
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
                                                    <p className="text-xs text-gray-400 italic">{message.content}</p>
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
                                                    <p className="text-xs text-gray-400 italic px-3 py-2">
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
                                                <div className={`max-w-[70%] ${isMyMessage ? "items-end" : "items-start"} flex flex-col`}>
                                                    {!isMyMessage && (
                                                        <p className="text-xs text-gray-600 mb-1">{message.senderName}</p>
                                                    )}
                                                    <div className="flex items-end gap-2">
                                                        {isMyMessage && (
                                                            <span className="text-xs text-gray-400">
                                                                {formatMessageTime(message.createdAt)}
                                                            </span>
                                                        )}
                                                        <div
                                                            className={`px-3 py-2 rounded-lg ${
                                                                isMyMessage
                                                                    ? "bg-blue-600 text-white"
                                                                    : "bg-gray-100 text-gray-900"
                                                            }`}
                                                        >
                                                            {message.type === "IMAGE" && message.fileUrl ? (
                                                                <img
                                                                    src={message.fileUrl}
                                                                    alt={message.fileName || "이미지"}
                                                                    className="max-w-full max-h-60 rounded cursor-pointer"
                                                                    style={{ display: "block" }}
                                                                    onClick={() => window.open(message.fileUrl, "_blank")}
                                                                />
                                                            ) : message.type === "FILE" && message.fileUrl ? (
                                                                <a
                                                                    href={message.fileUrl}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className={`text-sm underline flex items-center gap-1 ${
                                                                        isMyMessage ? "text-white" : "text-blue-600"
                                                                    }`}
                                                                >
                                                                    📎 {message.fileName || message.content}
                                                                </a>
                                                            ) : (
                                                                <p className="text-sm whitespace-pre-wrap break-words">
                                                                    {message.content}
                                                                </p>
                                                            )}
                                                        </div>
                                                        {!isMyMessage && (
                                                            <span className="text-xs text-gray-400">
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
                        <div className="p-4 border-t border-gray-200">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={messageInput}
                                    onChange={(e) => setMessageInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="메시지를 입력하세요..."
                                    disabled={isSendingMessage}
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                                <button
                                    onClick={sendMessage}
                                    disabled={!messageInput.trim() || isSendingMessage}
                                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                                >
                                    {isSendingMessage ? "전송 중..." : "전송"}
                                </button>
                            </div>
                        </div>

                        {/* Info Drawer */}
                        {showDrawer && (
                            <div className="absolute inset-0 bg-white z-20 flex flex-col">
                                {/* Drawer Header */}
                                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                                    <h3 className="text-lg font-semibold text-gray-900">채팅방 정보</h3>
                                    <button
                                        onClick={() => setShowDrawer(false)}
                                        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                                        aria-label="닫기"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto">
                                    {/* 참여자 */}
                                    <div className="p-4 border-b border-gray-100">
                                        <h4 className="text-sm font-semibold text-gray-700 mb-3">
                                            참여자 ({participants.length}명)
                                        </h4>
                                        {isLoadingParticipants ? (
                                            <div className="flex justify-center py-4">
                                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                                            </div>
                                        ) : participants.length > 0 ? (
                                            <div className="space-y-2">
                                                {participants.map((p, i) => (
                                                    <div key={p.userId || i} className="flex items-center gap-3 py-2">
                                                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                                            <span className="text-sm font-medium text-blue-600">
                                                                {p.userName?.charAt(0) || "?"}
                                                            </span>
                                                        </div>
                                                        <span className="text-sm text-gray-900">{p.userName}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-gray-400 text-center py-4">참여자 정보를 불러올 수 없습니다</p>
                                        )}
                                    </div>

                                    {/* 사진 */}
                                    <div className="p-4 border-b border-gray-100">
                                        <h4 className="text-sm font-semibold text-gray-700 mb-3">
                                            사진 ({messages.filter(m => m.type === "IMAGE" && m.fileUrl).length})
                                        </h4>
                                        {messages.filter(m => m.type === "IMAGE" && m.fileUrl).length > 0 ? (
                                            <div className="grid grid-cols-3 gap-2">
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
                                            <p className="text-sm text-gray-400 text-center py-4">공유된 사진이 없습니다</p>
                                        )}
                                    </div>

                                    {/* 파일 */}
                                    <div className="p-4">
                                        <h4 className="text-sm font-semibold text-gray-700 mb-3">
                                            파일 ({messages.filter(m => m.type === "FILE" && m.fileUrl).length})
                                        </h4>
                                        {messages.filter(m => m.type === "FILE" && m.fileUrl).length > 0 ? (
                                            <div className="space-y-2">
                                                {messages.filter(m => m.type === "FILE" && m.fileUrl).map(m => (
                                                    <a
                                                        key={m.id}
                                                        href={m.fileUrl!}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                                                    >
                                                        <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                                            </svg>
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-sm text-gray-900 truncate">{m.fileName || m.content}</p>
                                                            <p className="text-xs text-gray-400">{formatMessageTime(m.createdAt)}</p>
                                                        </div>
                                                    </a>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-gray-400 text-center py-4">공유된 파일이 없습니다</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                        채팅방을 선택하세요
                    </div>
                )}
            </div>

            {/* Create Room Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">새 채팅방 만들기</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    채팅방 이름 *
                                </label>
                                <input
                                    type="text"
                                    value={newRoomName}
                                    onChange={(e) => setNewRoomName(e.target.value)}
                                    placeholder="채팅방 이름을 입력하세요"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    설명 (선택)
                                </label>
                                <textarea
                                    value={newRoomDescription}
                                    onChange={(e) => setNewRoomDescription(e.target.value)}
                                    placeholder="채팅방 설명을 입력하세요"
                                    rows={3}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                        </div>
                        <div className="flex gap-2 justify-end mt-6">
                            <button
                                onClick={() => {
                                    setShowCreateModal(false);
                                    setNewRoomName("");
                                    setNewRoomDescription("");
                                }}
                                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                            >
                                취소
                            </button>
                            <button
                                onClick={createRoom}
                                disabled={!newRoomName.trim()}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                            >
                                생성
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
