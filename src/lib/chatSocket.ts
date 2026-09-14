"use client";

import { Client, ReconnectionTimeMode } from "@stomp/stompjs";
import SockJS from "sockjs-client";

import { refreshAuthTokenForSocket } from "@/lib/apiService";
import {
    BASE_RECONNECT_DELAY_MS,
    connectHeadersFor,
    isAuthFailure,
    isJwtExpiringSoon,
    MAX_RECONNECT_DELAY_MS,
    shouldGiveUp,
} from "@/lib/chatSocketAuth";

export const BACKEND_WS_URL = process.env.NEXT_PUBLIC_API_URL || "https://silverithm.site";

/** 앱·서버와 같은 10초. 죽은 소켓을 이 안에 알아챈다. */
const HEARTBEAT_MS = 10_000;

export interface ChatSocketOptions {
    /** 로그에 붙는 이름 — 어느 화면의 연결인지 */
    label: string;
    /** 붙을 때마다(재연결 포함) 불린다. 구독과 접속 등록은 여기서 다시 건다. */
    onConnect: (client: Client) => void;
    /** 정상 종료든 갑작스러운 끊김이든 한 곳으로 온다 */
    onDisconnect?: () => void;
    /**
     * 인증이 연달아 거절돼 재연결을 완전히 멈췄을 때 온다 (onDisconnect와 별도).
     * 화면은 이걸 받으면 "연결 중..."이 아니라 "다시 로그인해주세요"를 보여줘야 한다 —
     * 그대로 두면 세션이 끝났는데도 곧 붙을 것처럼 보인다.
     */
    onAuthExhausted?: () => void;
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
export function createChatClient({ label, onConnect, onDisconnect, onAuthExhausted }: ChatSocketOptions): Client {
    let authFailures = 0;

    const client = new Client({
        webSocketFactory: () => new SockJS(`${BACKEND_WS_URL}/ws/chat`),
        // 실패할 때마다 지연을 두 배로 늘리고(BASE_RECONNECT_DELAY_MS에서 시작) 상한을 둔다.
        // 고정 5초 간격이었을 때는 블루그린 전환처럼 소켓이 한꺼번에 끊기면 막 재기동한
        // 서버를 모든 클라이언트가 같은 박자로 계속 두드렸다. 성공하면 stompjs가 다음 끊김을
        // 위해 이 값을 다시 기준값으로 되돌린다.
        reconnectDelay: BASE_RECONNECT_DELAY_MS,
        reconnectTimeMode: ReconnectionTimeMode.EXPONENTIAL,
        maxReconnectDelay: MAX_RECONNECT_DELAY_MS,
        heartbeatIncoming: HEARTBEAT_MS,
        heartbeatOutgoing: HEARTBEAT_MS,
        beforeConnect: async () => {
            // 401을 실제로 받은 적이 있으면 당연히 갱신한다. 그게 아니어도(서버 재시작 등으로
            // 끊긴 경우) 토큰이 이미 만료돼 있을 수 있다 — 그때까지 기다리면 옛 토큰으로
            // 붙어 봤자 401을 한 번 더 받고서야 갱신하게 된다. 미리 판단해 그 왕복을 없앤다.
            // 만료 판단은 토큰 안의 exp로 한다 — localStorage의 tokenExpirationTime은 만료 시각이
            // 아니라 30분이라는 길이가 저장돼 있어 늘 '만료'로 읽혔다(isJwtExpiringSoon 주석 참고).
            const currentToken = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
            const shouldRefresh = authFailures > 0 || isJwtExpiringSoon(currentToken, Date.now());
            if (shouldRefresh) {
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
                    onAuthExhausted?.();
                }
                return;
            }
            console.error(`[${label}] STOMP 오류:`, frame.headers["message"]);
        },
    });

    return client;
}
