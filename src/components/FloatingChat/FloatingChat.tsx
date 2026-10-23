"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Client, IMessage } from "@stomp/stompjs";
import { motion, AnimatePresence } from "framer-motion";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Card } from "@astryxdesign/core/Card";
import { Badge } from "@astryxdesign/core/Badge";
import { ChatRoom, ChatMessage, WebSocketMessage } from "./floatingChatTypes";
import { FloatingChatRoomList, FloatingChatListTab } from "./FloatingChatRoomList";
import { FloatingChatMessages } from "./FloatingChatMessages";
import { fetchChatRooms, fetchChatMessages, markChatAsRead } from '@/lib/apiService';
import { CHAT_PAGE_SIZE, prependUniqueMessages } from '@/lib/useOlderChatMessages';
import { mergeMissedMessages, readAscendingMessages, isConnectionStale } from '@/lib/chatReconnect';
import { DirectChatMember, OPEN_DIRECT_CHAT_EVENT, openOrCreateDirectRoom } from '@/lib/directChat';
import { getMyChatUserId } from '@/lib/chatIdentity';
import { createChatClient } from '@/lib/chatSocket';
import { applyIncoming } from '@/lib/chatSend';
import { useReliableChatSend } from '@/lib/useReliableChatSend';
import { useOrgPresenceStore, sortMembersByPresence } from '@/lib/orgPresenceStore';
import { useVisiblePolling } from '@/lib/useVisiblePolling';
import { OPEN_CHAT_ROOM_EVENT, requestNotificationsRefresh, setViewingChatRoom } from '@/lib/alertBus';
import { duration } from '@/theme/motion';


type ChatView = "rooms" | "messages";

/** 말풍선 단추 지름 — 자리 계산에 쓴다 */
const FAB_SIZE = 56;
/** 화면 가장자리에서 띄울 최소 거리 */
const FAB_EDGE = 8;
/** 이만큼 움직여야 '끌기'로 본다 — 손이 살짝 떨린 클릭이 끌기로 바뀌지 않게 */
const FAB_DRAG_THRESHOLD = 6;
const FAB_POS_KEY = "carev-fchat-pos";

type FabPos = { right: number; bottom: number };

function clampFabPos(pos: FabPos): FabPos {
    if (typeof window === "undefined") return pos;
    const maxRight = Math.max(FAB_EDGE, window.innerWidth - FAB_SIZE - FAB_EDGE);
    const maxBottom = Math.max(FAB_EDGE, window.innerHeight - FAB_SIZE - FAB_EDGE);
    return {
        right: Math.min(Math.max(pos.right, FAB_EDGE), maxRight),
        bottom: Math.min(Math.max(pos.bottom, FAB_EDGE), maxBottom),
    };
}

function loadFabPos(): FabPos | null {
    try {
        const raw = window.localStorage.getItem(FAB_POS_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<FabPos>;
        return typeof parsed.right === "number" && typeof parsed.bottom === "number"
            ? { right: parsed.right, bottom: parsed.bottom }
            : null;
    } catch {
        return null;
    }
}

function saveFabPos(pos: FabPos): void {
    try {
        window.localStorage.setItem(FAB_POS_KEY, JSON.stringify(pos));
    } catch {
        // 저장할 수 없는 환경이어도 이번 화면에서는 옮긴 자리에 있다
    }
}

export function FloatingChat() {
    const [isOpen, setIsOpen] = useState(false);
    /** 끌어서 옮긴 자리(오른쪽·아래에서 떨어진 px). null이면 CSS 기본 자리 */
    const [fabPos, setFabPos] = useState<FabPos | null>(null);
    const rootRef = useRef<HTMLDivElement | null>(null);
    const suppressClickRef = useRef(false);
    const [currentView, setCurrentView] = useState<ChatView>("rooms");
    const [rooms, setRooms] = useState<ChatRoom[]>([]);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
    const [messageInput, setMessageInput] = useState("");
    const [isLoadingRooms, setIsLoadingRooms] = useState(false);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    /**
     * 연결 '세대' 번호 — 소켓이 붙을 때마다 1씩 오른다.
     * 구독 effect를 불리언 isConnected에 매달면 끊겼다 다시 붙어도 값이 true 그대로라
     * effect가 안 돌고 방 구독이 영영 안 붙는다(= 새 메시지가 안 온다). [[chatReconnect]]
     */
    const [connectionEpoch, setConnectionEpoch] = useState(0);
    /** 인증이 연달아 거절돼 소켓이 재연결을 포기했다 — "연결 중..."이 아니라 재로그인 안내가 나가야 한다 */
    const [authExhausted, setAuthExhausted] = useState(false);
    /** 끊긴 시각 — 오래(30초+) 끊겨 있으면 새로고침을 안내한다. 붙어 있으면 null. */
    const [disconnectedAt, setDisconnectedAt] = useState<number | null>(null);
    const [connectionIsStale, setConnectionIsStale] = useState(false);

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

    const { send, ack, retry, discard } = useReliableChatSend<ChatMessage>({
        label: "FloatingChat",
        clientRef: stompClientRef,
        isConnected,
        userId,
        userName,
        setMessages,
        makePending: (seed) => ({
            id: seed.id,
            chatRoomId: seed.roomId,
            senderId: seed.senderId,
            senderName: seed.senderName,
            type: "TEXT",
            content: seed.content,
            createdAt: seed.createdAt,
            isDeleted: false,
            readCount: 1,
            clientMessageId: seed.clientMessageId,
            sendingStatus: "sending",
            replyToId: seed.replyToId || undefined,
        }),
        onSent: () => fetchRooms(),
    });

    // --- WebSocket ---

    useEffect(() => {
        if (!authToken || !userId) return;

        // 토큰 재읽기·401 갱신·하트비트는 chatSocket.ts가 한다 — 네 화면이 같은 규칙으로 붙는다
        const client = createChatClient({
            label: "FloatingChat",
            onConnect: (client) => {
                console.log("[FloatingChat WebSocket] 연결됨");
                setIsConnected(true);
                setAuthExhausted(false);
                setDisconnectedAt(null);
                // 붙을 때마다 반드시 값이 달라져야 구독 effect가 다시 돈다 (재연결 포함)
                setConnectionEpoch(n => n + 1);

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
                setIsConnected(false);
                setDisconnectedAt((prev) => prev ?? Date.now());
            },
            onAuthExhausted: () => {
                // 401이 계속돼 chatSocket.ts가 재연결을 완전히 멈췄다 — 세션이 끝난 것이다.
                setAuthExhausted(true);
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

    // 끊긴 지 30초가 넘으면 "연결 중..."을 새로고침 안내로 바꾼다 — 짧은 끊김까지 소란 떨지 않는다
    useEffect(() => {
        if (disconnectedAt === null) {
            setConnectionIsStale(false);
            return;
        }
        const check = () => setConnectionIsStale(isConnectionStale(disconnectedAt, Date.now()));
        check();
        const timer = setInterval(check, 5_000);
        return () => clearInterval(timer);
    }, [disconnectedAt]);

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

    // 방 선택 시 메시지 로드 + 읽음 처리
    useEffect(() => {
        if (!selectedRoomId) return;
        (async () => {
            const lastMsgId = await fetchMessages(selectedRoomId);
            if (lastMsgId) {
                markAsRead(selectedRoomId, lastMsgId);
            }
        })();
    }, [selectedRoomId, fetchMessages, markAsRead]);

    /**
     * 끊겼다 다시 붙은 순간, 끊겨 있던 사이에 온 메시지를 메운다.
     * 아래 구독 effect가 구독을 새로 붙이지만 그것은 '앞으로 올 것'만 받는다.
     * 첫 연결(1세대)은 위 '방 선택' 경로가 이미 불러왔으므로 건너뛴다.
     */
    useEffect(() => {
        if (connectionEpoch < 2) return;
        let cancelled = false;
        (async () => {
            // 방 목록의 안 읽음 수·마지막 메시지도 끊긴 사이에 밀렸으므로 함께 되맞춘다
            fetchRooms();
            const roomId = selectedRoomIdRef.current;
            if (!roomId) return;
            try {
                const data = await fetchChatMessages(roomId, 0, CHAT_PAGE_SIZE);
                if (cancelled) return;
                const latest = readAscendingMessages<ChatMessage>(data);
                if (latest.length === 0) return;
                setMessages(prev => mergeMissedMessages(prev, latest));
                markAsRead(roomId, latest[latest.length - 1].id);
            } catch (error) {
                console.error("[FloatingChat WebSocket] 재연결 후 놓친 메시지 보충 실패:", error);
            }
        })();
        return () => { cancelled = true; };
    }, [connectionEpoch, fetchRooms, markAsRead]);

    // 참여 중인 모든 방 구독 — 안 보고 있는 방의 새 메시지는 뱃지 증가 + 토스트 알림
    const roomIdsKey = rooms.map(r => r.id).sort((a, b) => a - b).join(",");
    useEffect(() => {
        const client = stompClientRef.current;
        if (!client || connectionEpoch === 0 || !roomIdsKey) return;

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
                    // 누가 메시지를 고치면 그 자리만 새 내용으로 갈아끼운다 (삭제와 같은 방식).
                    // 안 보고 있는 방은 다시 열 때 서버에서 받아오므로 여기서 할 일이 없다.
                    if (wsMessage.type === "EDIT" && wsMessage.message) {
                        const edited = wsMessage.message;
                        if (isOpenRef.current && selectedRoomIdRef.current === roomId) {
                            setMessages(prev => prev.map(m => (m.id === edited.id ? edited : m)));
                        }
                        return;
                    }
                    if (wsMessage.type !== "MESSAGE" || !wsMessage.message) return;

                    const msg = wsMessage.message;
                    const isMine = String(msg.senderId) === String(userId);
                    const isViewing = isOpenRef.current && selectedRoomIdRef.current === roomId;

                    // 내가 보낸 것의 에코면 재전송 시계를 멈춘다 (방을 나가 있어도)
                    if (isMine) ack(msg.clientMessageId);
                    if (isViewing) {
                        setMessages(prev => applyIncoming(prev, msg));
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
                                // 없으면 사진을 받는 순간 목록만 파일 이름으로 되돌아간다
                                displayContent: msg.displayContent,
                                type: msg.type,
                                mediaType: msg.mediaType,
                                mimeType: msg.mimeType,
                                fileName: msg.fileName,
                            },
                            lastMessageAt: msg.createdAt,
                            unreadCount: isViewing || isMine ? prevRooms[idx].unreadCount : prevRooms[idx].unreadCount + 1,
                        };
                        // 새 메시지가 온 방을 맨 위로 — 서버가 내려주는 lastMessageAt 내림차순 순서를 유지한다
                        return [updatedRoom, ...prevRooms.slice(0, idx), ...prevRooms.slice(idx + 1)];
                    });

                    // 새 메시지 알림은 오른쪽 위 알림 카드가 맡는다(채팅·결재·일정 … 한 줄기, 2026-10-22 원장).
                    // 서버가 알림함에 쓰는 일이 방송 직후 뒤에서 돌아가므로 잠깐 기다렸다가 다시 받게 한다.
                    if (!isViewing && !isMine) {
                        window.setTimeout(requestNotificationsRefresh, 1500);
                    }
                } catch (e) {
                    console.error("[FloatingChat WebSocket] 메시지 파싱 오류:", e);
                }
            });
        });

        return () => {
            subscriptions.forEach(s => s.unsubscribe());
        };
    }, [connectionEpoch, roomIdsKey, userId, markAsRead, ack]);

    // 읽음 이벤트 구독 (보고 있는 방만)
    useEffect(() => {
        if (!selectedRoomId || !stompClientRef.current || connectionEpoch === 0) return;

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
    }, [selectedRoomId, connectionEpoch, userId]);

    // --- Send message ---

    // 보내는 즉시 '전송 중' 말풍선이 뜨고, 에코가 없으면 REST로 다시 보내며, 그래도 안 되면 '실패'로 남는다.
    const sendMessage = (replyToId?: number) => {
        if (!messageInput.trim() || !selectedRoomId) return;
        void send({ roomId: selectedRoomId, content: messageInput, replyToId: replyToId || null });
        setMessageInput("");
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

    // 지금 펼쳐 보고 있는 방 — 알림 카드가 이 방의 새 메시지는 띄우지 않는다
    useEffect(() => {
        setViewingChatRoom("floating", isOpen && currentView === "messages" ? selectedRoomId : null);
    }, [isOpen, currentView, selectedRoomId]);
    useEffect(() => () => setViewingChatRoom("floating", null), []);

    // 채팅 알림 카드의 '열기' — 이 창을 열고 그 방으로 간다
    useEffect(() => {
        const onOpenRoom = (event: Event) => {
            const roomId = (event as CustomEvent<{ roomId: number }>).detail?.roomId;
            if (!roomId) return;
            setIsOpen(true);
            setListTab("rooms");
            setSelectedRoomId(roomId);
            setCurrentView("messages");
        };
        window.addEventListener(OPEN_CHAT_ROOM_EVENT, onOpenRoom);
        return () => window.removeEventListener(OPEN_CHAT_ROOM_EVENT, onOpenRoom);
    }, []);

    // 오른쪽 패널에서 직원을 누르면 이 창을 열고 그 사람과의 1:1 대화로 간다 ([[requestDirectChat]]).
    // 리스너는 한 번만 달고, 최신 방 목록을 쥔 함수는 ref로 넘긴다.
    const openDirectChatRef = useRef(openDirectChat);
    openDirectChatRef.current = openDirectChat;
    useEffect(() => {
        const onOpenDirect = (event: Event) => {
            const member = (event as CustomEvent<DirectChatMember>).detail;
            if (!member) return;
            setIsOpen(true);
            void openDirectChatRef.current(member);
        };
        window.addEventListener(OPEN_DIRECT_CHAT_EVENT, onOpenDirect);
        return () => window.removeEventListener(OPEN_DIRECT_CHAT_EVENT, onOpenDirect);
    }, []);

    // 저장된 자리는 마운트 뒤에 읽는다(서버 렌더와 다를 수 있다). 창 크기가 바뀌면 화면 안으로 당긴다.
    useEffect(() => {
        const saved = loadFabPos();
        if (saved) setFabPos(clampFabPos(saved));
        const onResize = () => setFabPos((current) => (current ? clampFabPos(current) : current));
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    /**
     * 옮긴 말풍선에서 창을 펼칠 자리 — 위·아래 중 넓은 쪽으로 펼치되, 어느 자리든 창 전체가 화면 안에 들어오게 민다.
     * 창 크기는 globals.css(.carev-fchat-panel)와 같은 식으로 센다. 옮기지 않았으면 예전처럼 단추 위, 오른쪽 맞춤.
     */
    const panelStyle = useMemo((): React.CSSProperties => {
        if (!fabPos || typeof window === "undefined") return { bottom: 64, right: 0 };
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const panelW = Math.min(380, vw - 48);
        const panelH = Math.min(550, vh - 140);
        const fabLeft = vw - fabPos.right - FAB_SIZE;
        const fabTop = vh - fabPos.bottom - FAB_SIZE;
        const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));
        // 가로: 화면 오른쪽 절반이면 단추 오른쪽 끝에, 왼쪽 절반이면 왼쪽 끝에 맞추고 화면 밖으로는 안 나가게
        const wantLeft = fabLeft + FAB_SIZE / 2 > vw / 2 ? FAB_SIZE - panelW : 0;
        const left = clamp(wantLeft, FAB_EDGE - fabLeft, vw - FAB_EDGE - panelW - fabLeft);
        const spaceAbove = fabTop - FAB_EDGE;
        const spaceBelow = fabPos.bottom - FAB_EDGE;
        const need = panelH + 8;
        if (spaceAbove >= need && spaceAbove >= spaceBelow) {
            // 위로 — 창 아래 끝을 단추 위에 둔다
            const bottom = clamp(64, FAB_EDGE - fabPos.bottom, fabTop + FAB_SIZE - FAB_EDGE - panelH);
            return { left, bottom };
        }
        if (spaceBelow >= need) {
            // 아래로 — 창 위 끝을 단추 아래에 둔다
            const top = clamp(64, FAB_EDGE - fabTop, vh - FAB_EDGE - panelH - fabTop);
            return { left, top };
        }
        // 위아래 어느 쪽에도 다 안 들어간다(화면 한가운데 등) — 단추를 덮지 않게 옆으로 펼친다
        const besideLeft = fabLeft + FAB_SIZE / 2 > vw / 2 ? -(panelW + 8) : FAB_SIZE + 8;
        const sideLeft = clamp(besideLeft, FAB_EDGE - fabLeft, vw - FAB_EDGE - panelW - fabLeft);
        const sideTop = clamp(FAB_SIZE / 2 - panelH / 2, FAB_EDGE - fabTop, vh - FAB_EDGE - panelH - fabTop);
        return { left: sideLeft, top: sideTop };
    }, [fabPos]);

    const handleToggle = () => {
        // 끌어서 옮긴 직후의 '놓기'는 누른 것이 아니다 — 창을 여닫지 않는다
        if (suppressClickRef.current) {
            suppressClickRef.current = false;
            return;
        }
        setIsOpen(prev => !prev);
    };

    /**
     * 말풍선을 끌어 화면 어디로든 옮긴다(2026-10-22 원장 "채팅 문양을 끌고 다니면서 원하는 위치에").
     * 자리는 오른쪽·아래에서 떨어진 거리로 이 브라우저에 기억한다 — 창 크기가 바뀌어도 모서리 기준으로 남는다.
     * 한 번도 옮기지 않았으면 CSS 기본 자리(오른쪽 패널 왼쪽 옆)를 따른다.
     */
    const onFabPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0) return;
        const rect = rootRef.current?.getBoundingClientRect();
        if (!rect) return;
        const pointerId = e.pointerId;
        const start = {
            x: e.clientX,
            y: e.clientY,
            right: window.innerWidth - rect.right,
            bottom: window.innerHeight - rect.bottom,
        };
        let moved = false;
        let last: FabPos | null = null;

        // 움직임은 화면 전체에서 받는다 — 빠르게 끌면 첫 움직임부터 단추 밖이라 단추에 붙인 처리로는 놓친다.
        // 포인터를 붙잡지(capture) 않는 것은, 붙잡으면 끌지 않고 누르기만 해도 단추의 클릭이 오지 않아서다.
        const onMove = (ev: PointerEvent) => {
            if (ev.pointerId !== pointerId) return;
            const dx = ev.clientX - start.x;
            const dy = ev.clientY - start.y;
            if (!moved && Math.hypot(dx, dy) < FAB_DRAG_THRESHOLD) return;
            moved = true;
            last = clampFabPos({ right: start.right - dx, bottom: start.bottom - dy });
            setFabPos(last);
        };
        const onUp = (ev: PointerEvent) => {
            if (ev.pointerId !== pointerId) return;
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
            window.removeEventListener("pointercancel", onUp);
            if (!moved || !last) return;
            saveFabPos(last);
            // 놓은 자리가 단추 위면 곧이어 클릭이 온다 — 그 한 번만 무시하고, 안 오면 다음 차례에 풀어 준다
            suppressClickRef.current = true;
            window.setTimeout(() => { suppressClickRef.current = false; }, 0);
        };
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        window.addEventListener("pointercancel", onUp);
    };

    // Don't render if no auth
    if (!companyId || !userId || !userName || !authToken) return null;

    const selectedRoom = rooms.find(r => r.id === selectedRoomId);

    return (
        // 자리는 carev-fchat-root가 정한다 — 오른쪽 패널이 떠 있으면 그 왼쪽 옆으로 비켜 선다
        // (원장 그림 2026-10-22: 채팅 말풍선은 패널과 안 겹치게 옆에)
        <div
            ref={rootRef}
            className="carev-fchat-root"
            style={fabPos ? { right: fabPos.right, bottom: fabPos.bottom } : undefined}
        >
            {/* Panel */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 16, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 16, scale: 0.95 }}
                        transition={{ duration: duration.fast, ease: "easeOut" }}
                        // 말풍선이 화면 어디에 있든 창이 화면 안에 펼쳐지게 — 위아래·좌우 중 넓은 쪽으로
                        style={{ position: "absolute", ...panelStyle }}
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
                                            authExhausted={authExhausted}
                                            connectionIsStale={connectionIsStale}
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
                                            isSendingMessage={false}
                                            userId={userId}
                                            messageInput={messageInput}
                                            onMessageInputChange={setMessageInput}
                                            onBack={handleBack}
                                            onSendMessage={sendMessage}
                                            onRetryMessage={retry}
                                            onDiscardMessage={discard}
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

            {/* FAB Button — 끌어서 옮길 수 있다 */}
            <div
                style={{ position: "relative", touchAction: "none", userSelect: "none", cursor: "grab" }}
                onPointerDown={onFabPointerDown}
            >
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
