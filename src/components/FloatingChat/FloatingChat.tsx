"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Client, IMessage } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { motion, AnimatePresence } from "framer-motion";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Card } from "@astryxdesign/core/Card";
import { Badge } from "@astryxdesign/core/Badge";
import { ChatRoom, ChatMessage, WebSocketMessage } from "./floatingChatTypes";
import { FloatingChatRoomList, FloatingChatListTab } from "./FloatingChatRoomList";
import { FloatingChatMessages } from "./FloatingChatMessages";
import { fetchChatRooms, fetchChatMessages, markChatAsRead, sendChatMessage } from '@/lib/apiService';
import { CHAT_PAGE_SIZE, prependUniqueMessages } from '@/lib/useOlderChatMessages';
import { DirectChatMember, openOrCreateDirectRoom } from '@/lib/directChat';
import { getMyChatUserId } from '@/lib/chatIdentity';
import { useOrgPresenceStore, sortMembersByPresence } from '@/lib/orgPresenceStore';
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

    // 직원 목록 — 채팅 페이지와 같은 '대화 / 직원' 구성.
    // 명단·접속 상태는 채팅 페이지와 스토어를 함께 쓴다 (같은 화면에 둘 다 떠 있을 수 있다)
    const [listTab, setListTab] = useState<FloatingChatListTab>("rooms");
    const [isOpeningDirect, setIsOpeningDirect] = useState(false);
    const [directError, setDirectError] = useState<string | null>(null);

    const orgMembers = useOrgPresenceStore(s => s.members);
    const onlineUserIds = useOrgPresenceStore(s => s.onlineUserIds);
    const membersStatus = useOrgPresenceStore(s => s.status);
    const loadOrgPresence = useOrgPresenceStore(s => s.load);
    const setPresence = useOrgPresenceStore(s => s.setPresence);

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
    // 채팅에서 나를 가리키는 값. 관리자 계정은 접두사가 붙는다 ([[chatIdentity]])
    const [userId] = useState(() => getMyChatUserId());
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
            const data = await fetchChatMessages(roomId, 0, CHAT_PAGE_SIZE);
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

                // 접속 상태 — 내가 붙었음을 알리고, 다른 사람의 상태 변화를 받는다.
                // (연결이 끊기면 서버가 알아서 오프라인 처리하므로 나갈 때 보낼 것은 없다)
                if (companyId) {
                    client.publish({
                        destination: "/app/presence/join",
                        body: JSON.stringify({ userId, companyId }),
                    });
                    client.subscribe(`/topic/presence/${companyId}`, (frame: IMessage) => {
                        try {
                            const { userId: changedId, online } = JSON.parse(frame.body) as { userId: string; online: boolean };
                            setPresence(changedId, online);
                        } catch (error) {
                            console.error("[FloatingChat Presence] 상태 수신 처리 실패:", error);
                        }
                    });
                }
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
    }, [authToken, userId, companyId, setPresence]);

    /**
     * 기관 인원 목록 + 지금 접속 중인 사람.
     *
     * 위젯은 모든 화면에 떠 있으므로 마운트 시점에 부르지 않는다 — 패널을 처음 열 때만
     * 받아오고, 이후 접속 상태 변화는 WebSocket으로 따라간다.
     * 이미 받았거나 받는 중이면 load()가 알아서 넘기므로 여러 번 불러도 된다.
     */
    useEffect(() => {
        if (!isOpen || !companyId) return;
        loadOrgPresence(companyId);
    }, [isOpen, companyId, loadOrgPresence]);

    const retryLoadMembers = useCallback(() => {
        if (companyId) loadOrgPresence(companyId, { force: true });
    }, [companyId, loadOrgPresence]);

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
                    // 누가 메시지를 지우면 그 자리를 '삭제된 메시지입니다'로 갈아끼운다.
                    // 안 보고 있는 방은 다시 열 때 서버에서 받아오므로 여기서 할 일이 없다.
                    if (wsMessage.type === "DELETE" && wsMessage.message) {
                        const deleted = wsMessage.message;
                        if (isOpenRef.current && selectedRoomIdRef.current === roomId) {
                            setMessages(prev => prev.map(m => (m.id === deleted.id ? deleted : m)));
                        }
                        return;
                    }
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

                    setRooms(prevRooms => {
                        const idx = prevRooms.findIndex(room => room.id === roomId);
                        if (idx === -1) return prevRooms;
                        const updatedRoom: ChatRoom = {
                            ...prevRooms[idx],
                            lastMessage: {
                                content: msg.content,
                                senderName: msg.senderName,
                                createdAt: msg.createdAt,
                            },
                            lastMessageAt: msg.createdAt,
                            unreadCount: isViewing || isMine ? prevRooms[idx].unreadCount : prevRooms[idx].unreadCount + 1,
                        };
                        // 새 메시지가 온 방을 맨 위로 — 서버가 내려주는 lastMessageAt 내림차순 순서를 유지한다
                        return [updatedRoom, ...prevRooms.slice(0, idx), ...prevRooms.slice(idx + 1)];
                    });

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

    /**
     * 직원 목록에서 누른 사람과의 1:1 대화를 연다.
     * 방 이름 규칙과 생성 절차는 채팅 페이지와 공유한다 (@/lib/directChat).
     */
    const openDirectChat = async (member: DirectChatMember) => {
        if (!userId || !userName || isOpeningDirect) return;

        setIsOpeningDirect(true);
        setDirectError(null);
        try {
            const { roomId, isNew } = await openOrCreateDirectRoom({ rooms, member, userId, userName });
            if (isNew) await fetchRooms();
            if (roomId) {
                setListTab("rooms");
                handleSelectRoom(roomId);
            } else {
                // 방은 만들어졌는데 id를 못 받은 경우 — 조용히 넘기면 아무 일도 안 일어난 것처럼 보인다
                setDirectError(`${member.name} 님과의 대화를 열지 못했습니다`);
            }
        } catch (error) {
            console.error("[FloatingChat] 1:1 대화 열기 실패:", error);
            setDirectError(`${member.name} 님과의 대화를 열지 못했습니다`);
        } finally {
            setIsOpeningDirect(false);
        }
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
                    // 패널 높이는 globals.css가 정한다 (좁은 화면에선 550보다 작아진다)
                    bottom: isOpen ? "calc(64px + var(--carev-fchat-panel-h) + var(--spacing-3))" : 64,
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
                            // 크기는 carev-fchat-panel이 정한다 — 좁은 화면에서 380px 고정폭이면
                            // 컨테이너의 right:24 때문에 왼쪽이 화면 밖으로 잘린다
                            className="carev-fchat-panel"
                            style={{
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
                                            listTab={listTab}
                                            onListTabChange={setListTab}
                                            members={sortedMembers}
                                            onlineUserIds={onlineUserIds}
                                            membersStatus={membersStatus}
                                            onRetryLoadMembers={retryLoadMembers}
                                            myName={userName}
                                            myProfileImageUrl={myProfileImageUrl}
                                            isOpeningDirect={isOpeningDirect}
                                            onSelectMember={openDirectChat}
                                            directError={directError}
                                            onDismissDirectError={() => setDirectError(null)}
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
                                            onPrependOlder={(older) => setMessages(prev => prependUniqueMessages(prev, older))}
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
                        background: 'var(--color-accent)',
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
