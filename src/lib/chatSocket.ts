"use client";

import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

import { refreshAuthTokenForSocket } from "@/lib/apiService";
import { connectHeadersFor, isAuthFailure, shouldGiveUp } from "@/lib/chatSocketAuth";

export const BACKEND_WS_URL = process.env.NEXT_PUBLIC_API_URL || "https://silverithm.site";

/** 앱·서버와 같은 10초. 죽은 소켓을 이 안에 알아챈다. */
const HEARTBEAT_MS = 10_000;
const RECONNECT_DELAY_MS = 5_000;

export interface ChatSocketOptions {
    /** 로그에 붙는 이름 — 어느 화면의 연결인지 */
    label: string;
    /** 붙을 때마다(재연결 포함) 불린다. 구독과 접속 등록은 여기서 다시 건다. */
    onConnect: (client: Client) => void;
    /** 정상 종료든 갑작스러운 끊김이든 한 곳으로 온다 */
    onDisconnect?: () => void;
}

/**
 * 채팅 STOMP 연결 하나. 네 화면(채팅 탭·플로팅·레일·도크)이 같은 규칙으로 붙는다.
 *
 * - 붙을 때마다 토큰을 **새로 읽는다**. 전에는 페이지를 열 때 읽은 토큰을 헤더에 박아 두고
 *   만료된 뒤에도 5초마다 그걸로 다시 붙어 서버에 401을 시간당 수백 번 찍었다.
 * - 서버가 인증 실패(401)로 거절하면 다음 시도 전에 토큰을 갱신한다.
 * - 그래도 연달아 실패하면 멈춘다 — 세션이 끝난 것이다. REST 쪽이 곧 로그아웃시킨다.
 * - 하트비트 10초: 화면이 꺼지거나 망이 바뀌어 조용히 죽은 소켓을 알아챈다.
 */
export function createChatClient({ label, onConnect, onDisconnect }: ChatSocketOptions): Client {
    let authFailures = 0;

    const client = new Client({
        webSocketFactory: () => new SockJS(`${BACKEND_WS_URL}/ws/chat`),
        reconnectDelay: RECONNECT_DELAY_MS,
        heartbeatIncoming: HEARTBEAT_MS,
        heartbeatOutgoing: HEARTBEAT_MS,
        beforeConnect: async () => {
            if (authFailures > 0) {
                try {
                    await refreshAuthTokenForSocket();
                } catch (error) {
                    console.warn(`[${label}] 소켓 토큰 갱신 실패 — 지금 토큰으로 한 번 더 붙어 본다:`, error);
                }
            }
            // 서버 WS 인터셉터가 CONNECT 프레임의 Authorization 헤더를 요구한다
            client.connectHeaders = connectHeadersFor(
                typeof window !== "undefined" ? localStorage.getItem("authToken") : null,
            );
        },
        onConnect: () => {
            authFailures = 0;
            onConnect(client);
        },
        onDisconnect: () => onDisconnect?.(),
        // 정상 종료가 아닌 끊김(와이파이 변경·절전·서버 재시작)은 onDisconnect가 아니라
        // 여기로 온다. 이걸 안 받으면 소켓이 죽어도 '연결됨'으로 남는다. [[chatReconnect]]
        onWebSocketClose: () => onDisconnect?.(),
        onStompError: (frame) => {
            if (isAuthFailure(frame)) {
                authFailures += 1;
                console.warn(`[${label}] 소켓 인증 거절 ${authFailures}회:`, frame.headers["message"]);
                if (shouldGiveUp(authFailures)) {
                    console.warn(`[${label}] 인증이 계속 거절돼 소켓 재연결을 멈춘다`);
                    void client.deactivate();
                }
                return;
            }
            console.error(`[${label}] STOMP 오류:`, frame.headers["message"]);
        },
    });

    return client;
}
