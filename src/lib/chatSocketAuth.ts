/**
 * 채팅 소켓의 인증 규칙 — 순수 함수. 소켓 자체는 chatSocket.ts가 만든다.
 *
 * 왜 따로인가 — 웹은 페이지를 열 때 읽은 토큰을 연결 헤더에 박아 두고, 5초마다 그 토큰으로
 * 영원히 다시 붙었다. 토큰이 만료되면 서버는 /ws/chat에 시간당 700~900번 401을 찍었다
 * (2026-08-30부터 계속). 규칙: 붙을 때마다 토큰을 새로 읽고, 인증 실패면 갱신하고,
 * 그래도 계속 실패하면 멈춘다.
 */

/** 연달아 인증에 실패하면 이만큼에서 멈춘다 — 만료된 세션으로 서버를 두드리지 않는다. */
export const MAX_AUTH_FAILURES = 3;

/**
 * 서버가 보낸 STOMP ERROR가 인증 실패인지.
 * 서버는 "401 Unauthorized: …"를 헤더(message)와 본문 양쪽에 넣는다 — 어느 쪽을 보든 된다.
 */
export function isAuthFailure(frame: { headers?: Record<string, string>; body?: string } | null | undefined): boolean {
    if (!frame) return false;
    const text = `${frame.headers?.message ?? ""} ${frame.body ?? ""}`.toLowerCase();
    return text.includes("401") || text.includes("unauthorized") || text.includes("인증");
}

/** 인증 실패가 [failures]번 이어졌을 때 그만둘지. */
export function shouldGiveUp(failures: number): boolean {
    return failures >= MAX_AUTH_FAILURES;
}

/** CONNECT 헤더. 붙을 때마다 새로 만든다 — 다른 탭이나 REST가 갱신한 토큰을 그대로 쓴다. */
export function connectHeadersFor(token: string | null): Record<string, string> {
    return { Authorization: `Bearer ${token ?? ""}` };
}
