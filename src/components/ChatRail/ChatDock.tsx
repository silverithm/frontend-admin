"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Client, IMessage } from "@stomp/stompjs";
import { motion } from "framer-motion";

import { IconButton } from "@astryxdesign/core/IconButton";
import { Icon } from "@astryxdesign/core/Icon";

import { FiMaximize2 } from "react-icons/fi";
import { FloatingChatMessages } from "@/components/FloatingChat/FloatingChatMessages";
import { ChatMessage, WebSocketMessage } from "@/components/FloatingChat/floatingChatTypes";
import { fetchChatMessages, markChatAsRead } from "@/lib/apiService";
import { CHAT_PAGE_SIZE, prependUniqueMessages } from "@/lib/useOlderChatMessages";
import { mergeMissedMessages, readAscendingMessages } from "@/lib/chatReconnect";
import { getMyChatUserId } from "@/lib/chatIdentity";
import { createChatClient } from "@/lib/chatSocket";
import { applyIncoming } from "@/lib/chatSend";
import { useReliableChatSend } from "@/lib/useReliableChatSend";
import { duration } from "@/theme/motion";

interface ChatDockProps {
    roomId: number;
    roomName: string;
    participantCount: number;
    onClose: () => void;
    /** 좁은 창으로는 부족할 때 채팅 탭에서 이어 본다 */
    onExpand: () => void;
    /** 이 방을 읽었음을 레일에 알려 안 읽음 뱃지를 지운다 */
    onRead?: (roomId: number) => void;
}

/**
 * 레일 안에서 열리는 작은 대화창 — 목록 자리를 그대로 대화가 차지한다.
 *
 * 방을 열자고 보던 화면(대시보드·근무조정 등)을 떠나면, 하려던 일과 대화가 번갈아
 * 끊긴다. 그래서 탭을 옮기지 않는다. 레일 밖에 별도 창으로 띄워봤더니 "새 채팅방이
 * 열렸다"로 읽혀서, 레일 안에 넣어 같은 메뉴의 한 단계로 보이게 했다.
 * 길게 볼 대화는 머리의 확대 버튼으로 채팅 탭에 넘긴다.
 *
 * 연결은 이 창이 직접 잡는다 — 레일의 STOMP 연결은 접속 상태·안 읽음만 보고,
 * 메시지 송수신까지 얹으면 레일이 대화 상태를 들고 있어야 해서 역할이 섞인다.
 */
export default function ChatDock({
    roomId,
    roomName,
    participantCount,
    onClose,
    onExpand,
    onRead,
}: ChatDockProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [messageInput, setMessageInput] = useState("");
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    /**
     * 연결 '세대' 번호 — 소켓이 붙을 때마다 1씩 오른다.
     * 불리언 isConnected는 갑작스러운 끊김에서 true로 남아(onDisconnect가 안 불린다)
     * 재연결을 알아챌 수 없다. [[chatReconnect]]
     */
    const [connectionEpoch, setConnectionEpoch] = useState(0);

    const stompClientRef = useRef<Client | null>(null);

    const [userId] = useState(() => getMyChatUserId());
    const [userName] = useState(() => (typeof window !== "undefined" ? localStorage.getItem("userName") : null));
    const [authToken] = useState(() => (typeof window !== "undefined" ? localStorage.getItem("authToken") : null));

    // onRead는 ref로 들고 markAsRead의 의존성에서 뺀다. 부모가 인라인 함수로 넘기면
    // 렌더마다 markAsRead가 재생성 → 메시지 로드 effect 재실행 → 읽음 처리 → 부모
    // setState → 재렌더 … 로 무한 재로딩이 됐던 실제 버그의 차단 지점이다.
    const onReadRef = useRef(onRead);
    onReadRef.current = onRead;

    const markAsRead = useCallback(async (lastMsgId: number) => {
        try {
            await markChatAsRead(roomId, lastMsgId);
            onReadRef.current?.(roomId);
        } catch (error) {
            console.error("[ChatDock] 읽음 처리 실패:", error);
        }
    }, [roomId]);

    const { send, ack, retry, discard } = useReliableChatSend<ChatMessage>({
        label: "ChatDock",
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
    });

    // 방을 열면 최근 대화를 받아오고 읽음 처리한다
    useEffect(() => {
        let cancelled = false;
        setIsLoadingMessages(true);
        fetchChatMessages(roomId, 0, CHAT_PAGE_SIZE)
            .then((data) => {
                if (cancelled) return;
                const list = Array.isArray(data) ? data : (data.messages || data.content || data.data || []);
                setMessages([...list].reverse());
                if (list.length > 0) markAsRead(list[0].id);
            })
            .catch((error) => {
                console.error("[ChatDock] 메시지 로드 실패:", error);
                if (!cancelled) setMessages([]);
            })
            .finally(() => {
                if (!cancelled) setIsLoadingMessages(false);
            });
        return () => {
            cancelled = true;
        };
    }, [roomId, markAsRead]);

    /**
     * 끊겼다 다시 붙은 순간, 끊겨 있던 사이에 온 메시지를 메운다.
     * 구독은 onConnect가 새로 붙이지만 그것은 '앞으로 올 것'만 받는다.
     * 첫 연결(1세대)은 위 '방 열기' 경로가 이미 불러왔으므로 건너뛴다.
     * 위로 올려 이어붙인 옛 대화가 날아가지 않도록 갈아끼우지 않고 합친다.
     */
    useEffect(() => {
        if (connectionEpoch < 2) return;
        let cancelled = false;
        fetchChatMessages(roomId, 0, CHAT_PAGE_SIZE)
            .then((data) => {
                if (cancelled) return;
                const latest = readAscendingMessages<ChatMessage>(data);
                if (latest.length === 0) return;
                setMessages((prev) => mergeMissedMessages(prev, latest));
                markAsRead(latest[latest.length - 1].id);
            })
            .catch((error) => {
                console.error("[ChatDock] 재연결 후 놓친 메시지 보충 실패:", error);
            });
        return () => {
            cancelled = true;
        };
    }, [connectionEpoch, roomId, markAsRead]);

    // 이 방 하나만 구독한다
    useEffect(() => {
        if (!authToken || !userId) return;

        // 토큰 재읽기·401 갱신·하트비트는 chatSocket.ts가 한다 — 네 화면이 같은 규칙으로 붙는다
        const client = createChatClient({
            label: "ChatDock",
            onConnect: (client) => {
                setIsConnected(true);
                setConnectionEpoch((n) => n + 1);
                client.subscribe(`/topic/chat/${roomId}`, (frame: IMessage) => {
                    try {
                        const wsMessage: WebSocketMessage = JSON.parse(frame.body);
                        // 누가 메시지를 지우면 그 자리를 '삭제된 메시지입니다'로 갈아끼운다
                        if (wsMessage.type === "DELETE" && wsMessage.message) {
                            const deleted = wsMessage.message;
                            setMessages((prev) => prev.map((m) => (m.id === deleted.id ? deleted : m)));
                            return;
                        }
                        // 누가 메시지를 고치면 그 자리만 새 내용으로 갈아끼운다 (삭제와 같은 방식)
                        if (wsMessage.type === "EDIT" && wsMessage.message) {
                            const edited = wsMessage.message;
                            setMessages((prev) => prev.map((m) => (m.id === edited.id ? edited : m)));
                            return;
                        }
                        if (wsMessage.type !== "MESSAGE" || !wsMessage.message) return;
                        const msg = wsMessage.message;
                        // 내가 보낸 것의 에코면 재전송 시계를 멈추고 '전송 중' 말풍선을 이 메시지로 바꾼다
                        ack(msg.clientMessageId);
                        setMessages((prev) => applyIncoming(prev, msg));
                        // 창이 열려 있는 동안 온 메시지는 바로 읽은 것으로 둔다
                        if (String(msg.senderId) !== String(userId)) markAsRead(msg.id);
                    } catch (error) {
                        console.error("[ChatDock] 메시지 파싱 실패:", error);
                    }
                });
                client.subscribe(`/topic/chat/${roomId}/read`, (frame: IMessage) => {
                    try {
                        const wsMessage = JSON.parse(frame.body);
                        if (wsMessage.type === "READ" && wsMessage.senderId !== userId) {
                            setMessages((prev) =>
                                prev.map((msg) =>
                                    msg.id <= (wsMessage.lastReadMessageId || 0)
                                        ? { ...msg, readCount: msg.readCount + 1 }
                                        : msg,
                                ),
                            );
                        }
                    } catch (error) {
                        console.error("[ChatDock] 읽음 이벤트 파싱 실패:", error);
                    }
                });
            },
            onDisconnect: () => setIsConnected(false),
        });

        client.activate();
        stompClientRef.current = client;

        return () => {
            client.deactivate();
            stompClientRef.current = null;
            setIsConnected(false);
        };
        // markAsRead는 roomId에만 의존한다 — 넣으면 방마다 연결을 다시 잡는다
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authToken, userId, roomId]);

    // 보내는 즉시 '전송 중' 말풍선이 뜨고, 에코가 없으면 REST로 다시 보내며, 그래도 안 되면 '실패'로 남는다.
    const sendMessage = (replyToId?: number) => {
        if (!messageInput.trim()) return;
        void send({ roomId, content: messageInput, replyToId: replyToId || null });
        setMessageInput("");
    };

    if (!userId || !userName) return null;

    return (
        <motion.div
            className="carev-chat-dock"
            // 레일 안에서 목록을 밀어내며 들어오므로 옆에서 스미는 움직임이 맞다
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: duration.fast, ease: "easeOut" }}
            aria-label={`${roomName} 대화`}
        >
            <FloatingChatMessages
                /* 확대 버튼은 머리줄 안에 넣는다 — 예전처럼 머리 위에 절대좌표로 얹으면
                   뒤로가기·채팅방 정보 버튼과 높이가 어긋나 보인다 */
                headerAction={
                    <IconButton
                        label="채팅 탭에서 크게 보기"
                        tooltip="크게 보기"
                        variant="ghost"
                        size="sm"
                        icon={<Icon icon={FiMaximize2} size="sm" />}
                        onClick={onExpand}
                    />
                }
                roomId={roomId}
                roomName={roomName}
                participantCount={participantCount}
                messages={messages}
                isLoadingMessages={isLoadingMessages}
                isSendingMessage={false}
                onRetryMessage={retry}
                onDiscardMessage={discard}
                userId={userId}
                messageInput={messageInput}
                onMessageInputChange={setMessageInput}
                onBack={onClose}
                onSendMessage={sendMessage}
                onMessagesUpdate={setMessages}
                onPrependOlder={(older) => setMessages(prev => prependUniqueMessages(prev, older))}
            />
        </motion.div>
    );
}
