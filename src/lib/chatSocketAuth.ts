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

/**
 * 토큰이 이미 만료됐거나 [bufferMs] 안에 만료될지.
 *
 * 서버 재시작으로 소켓이 끊긴 경우(401이 아니라 onWebSocketClose) 그 사이 토큰이 이미
 * 만료돼 있을 수 있다. 그때까지는 authFailures(401을 실제로 받은 횟수)가 0이라 갱신을
 * 하지 않고 옛 토큰으로 한 번 더 붙어 헛되이 401을 한 번 더 받았다 — 이 함수로 붙기 전에
 * 미리 판단해 그 한 번을 없앤다.
 *
 * 값을 모르거나(로그인 직후 등) 형식이 이상하면 false — 모른다고 갱신을 강제하지 않고
 * 기존의 '401을 받으면 갱신' 경로에 맡긴다.
 */
export function isTokenExpiringSoon(
    expirationTime: string | number | null | undefined,
    now: number,
    bufferMs = 5_000,
): boolean {
    if (expirationTime === null || expirationTime === undefined || expirationTime === "") return false;
    const expiresAt = typeof expirationTime === "string" ? Number(expirationTime) : expirationTime;
    if (!Number.isFinite(expiresAt) || expiresAt <= 0) return false;
    return expiresAt - bufferMs <= now;
}

/** 재연결 지연의 기준값(ms) — 첫 재시도는 이만큼 기다린다. `chatSocket.ts`의 `reconnectDelay`로 쓴다. */
export const BASE_RECONNECT_DELAY_MS = 5_000;

/**
 * 재연결 지연의 위 한계(ms) — 서버가 오래 내려가 있어도 이 이상 기다리게 하지 않는다.
 * `chatSocket.ts`의 `maxReconnectDelay`로 쓴다.
 */
export const MAX_RECONNECT_DELAY_MS = 30_000;

/**
 * 재연결 지연이 실패 한 번마다 어떻게 늘어나는지 — stompjs의 `ReconnectionTimeMode.EXPONENTIAL`이
 * 내부에서 하는 계산(`_nextReconnectDelay *= 2`, 그 뒤 상한 적용)과 같은 식이다.
 *
 * stompjs가 실제로 이 계산을 돌리므로 이 함수를 직접 호출하는 코드는 없다 — 대신
 * [BASE_RECONNECT_DELAY_MS]/[MAX_RECONNECT_DELAY_MS]로 설정한 값이 정확히 이 식대로
 * 동작하는지를 테스트로 고정해 둔다(고정 5초로 되돌아가는 회귀를 잡기 위해).
 */
export function nextReconnectDelay(current: number, max: number = MAX_RECONNECT_DELAY_MS): number {
    return Math.min(current * 2, max);
}
