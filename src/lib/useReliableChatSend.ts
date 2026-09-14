"use client";

import { useCallback, useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { Client } from "@stomp/stompjs";

import { sendChatMessage } from "@/lib/apiService";
import {
    ACK_TIMEOUT_MS,
    applyIncoming,
    newClientMessageId,
    removeLocal,
    setSendingStatus,
    socketUsable,
    type Sendable,
} from "@/lib/chatSend";

/** 보내려는 내용. 말풍선 모양은 화면마다 달라 [makePending]이 만든다. */
export interface ChatDraft {
    roomId: number;
    content: string;
    replyToId?: number | null;
}

export interface PendingSeed extends ChatDraft {
    /** 음수 임시 id — 서버 id와 겹치지 않는다 */
    id: number;
    clientMessageId: string;
    senderId: string;
    senderName: string;
    createdAt: string;
}

export interface ReliableChatSendOptions<M extends Sendable> {
    label: string;
    clientRef: RefObject<Client | null>;
    isConnected: boolean;
    userId: string | null;
    userName: string | null;
    setMessages: Dispatch<SetStateAction<M[]>>;
    /** 화면의 메시지 모양으로 '전송 중' 말풍선을 만든다 */
    makePending: (seed: PendingSeed) => M;
    /** 서버가 저장을 확인했을 때(REST 응답) — 방 목록 갱신 등 */
    onSent?: (message: M) => void;
    /** 끝내 실패했을 때 — 알림 띄우기 등 */
    onFailed?: (draft: ChatDraft, error: unknown) => void;
}

interface InFlight {
    draft: ChatDraft;
    timer?: ReturnType<typeof setTimeout>;
}

/**
 * "보낸 메시지는 반드시 도착하거나 반드시 실패로 보인다"를 화면에 붙이는 훅. 규칙은 chatSend.ts.
 *
 * 화면은 세 가지만 하면 된다 — send()로 보내고, 소켓 에코가 오면 ack()와 applyIncoming을,
 * 실패 말풍선의 버튼에 retry()/discard()를 잇는다.
 */
export function useReliableChatSend<M extends Sendable>({
    label,
    clientRef,
    isConnected,
    userId,
    userName,
    setMessages,
    makePending,
    onSent,
    onFailed,
}: ReliableChatSendOptions<M>) {
    const inFlightRef = useRef<Map<string, InFlight>>(new Map());
    const isConnectedRef = useRef(isConnected);
    isConnectedRef.current = isConnected;
    const callbacksRef = useRef({ makePending, onSent, onFailed });
    callbacksRef.current = { makePending, onSent, onFailed };

    useEffect(() => {
        const inFlight = inFlightRef.current;
        return () => {
            inFlight.forEach((entry) => entry.timer && clearTimeout(entry.timer));
            inFlight.clear();
        };
    }, []);

    const clearTimer = useCallback((clientMessageId: string) => {
        const entry = inFlightRef.current.get(clientMessageId);
        if (entry?.timer) {
            clearTimeout(entry.timer);
            entry.timer = undefined;
        }
    }, []);

    /** REST로 보낸다(같은 식별자). 성공이면 말풍선을 서버 메시지로, 실패면 '실패'로. */
    const sendViaRest = useCallback(async (clientMessageId: string) => {
        const entry = inFlightRef.current.get(clientMessageId);
        if (!entry || !userId || !userName) return false;
        const { draft } = entry;
        try {
            const response = await sendChatMessage(draft.roomId, {
                senderId: userId,
                senderName: userName,
                type: "TEXT",
                content: draft.content,
                replyToId: draft.replyToId || null,
                clientMessageId,
            });
            // 백엔드가 { success, message } wrapper로 반환하므로 unwrap
            const saved = (response.message || response) as M;
            inFlightRef.current.delete(clientMessageId);
            setMessages((prev) => applyIncoming(prev, saved));
            callbacksRef.current.onSent?.(saved);
            return true;
        } catch (error) {
            console.error(`[${label}] 메시지 전송 실패(REST):`, error);
            setMessages((prev) => setSendingStatus(prev, clientMessageId, "failed"));
            callbacksRef.current.onFailed?.(draft, error);
            return false;
        }
    }, [label, userId, userName, setMessages]);

    /** 보낸다. 화면에는 즉시 '전송 중' 말풍선이 뜬다. */
    const send = useCallback(async (draft: ChatDraft) => {
        if (!draft.content.trim() || !userId || !userName) return false;
        const clientMessageId = newClientMessageId();
        const now = new Date();
        const pending = callbacksRef.current.makePending({
            ...draft,
            content: draft.content.trim(),
            id: -now.getTime(),
            clientMessageId,
            senderId: userId,
            senderName: userName,
            createdAt: now.toISOString(),
        });
        setMessages((prev) => [...prev, pending]);
        inFlightRef.current.set(clientMessageId, { draft: { ...draft, content: draft.content.trim() } });

        const client = clientRef.current;
        if (socketUsable(isConnectedRef.current, client)) {
            try {
                client!.publish({
                    destination: `/app/chat/${draft.roomId}/send`,
                    body: JSON.stringify({
                        senderId: userId,
                        senderName: userName,
                        type: "TEXT",
                        content: draft.content.trim(),
                        replyToId: draft.replyToId || null,
                        clientMessageId,
                    }),
                });
                // 에코가 제때 오면 ack()가 이 시계를 멈춘다. 안 오면 REST로 같은 식별자로 다시 보낸다.
                const entry = inFlightRef.current.get(clientMessageId);
                if (entry) {
                    entry.timer = setTimeout(() => {
                        if (!inFlightRef.current.has(clientMessageId)) return;
                        console.warn(`[${label}] ${ACK_TIMEOUT_MS / 1000}초 안에 서버 에코 없음 — REST로 다시 보낸다`);
                        void sendViaRest(clientMessageId);
                    }, ACK_TIMEOUT_MS);
                }
                return true;
            } catch (error) {
                console.error(`[${label}] 소켓 전송 실패, REST로 보낸다:`, error);
            }
        }
        return sendViaRest(clientMessageId);
    }, [userId, userName, clientRef, setMessages, label, sendViaRest]);

    /** 소켓 에코가 왔다 — 그 식별자의 재전송 시계를 멈춘다. 목록 반영은 화면이 applyIncoming으로. */
    const ack = useCallback((clientMessageId: string | undefined) => {
        if (!clientMessageId) return;
        clearTimer(clientMessageId);
        inFlightRef.current.delete(clientMessageId);
    }, [clearTimer]);

    /** '다시 보내기' — 같은 식별자로 REST. */
    const retry = useCallback(async (clientMessageId: string) => {
        if (!inFlightRef.current.has(clientMessageId)) return false;
        setMessages((prev) => setSendingStatus(prev, clientMessageId, "sending"));
        return sendViaRest(clientMessageId);
    }, [setMessages, sendViaRest]);

    /** '보내지 않고 삭제'. */
    const discard = useCallback((clientMessageId: string) => {
        clearTimer(clientMessageId);
        inFlightRef.current.delete(clientMessageId);
        setMessages((prev) => removeLocal(prev, clientMessageId));
    }, [clearTimer, setMessages]);

    return { send, ack, retry, discard };
}
