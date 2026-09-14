import test from "node:test";
import assert from "node:assert/strict";

import {
    BASE_RECONNECT_DELAY_MS,
    connectHeadersFor,
    isAuthFailure,
    isTokenExpiringSoon,
    MAX_AUTH_FAILURES,
    MAX_RECONNECT_DELAY_MS,
    nextReconnectDelay,
    shouldGiveUp,
} from "./chatSocketAuth.ts";

test("서버 거절 문구는 헤더에 있든 본문에 있든 인증 실패로 본다", () => {
    assert.equal(isAuthFailure({ headers: { message: "401 Unauthorized: 토큰이 만료되었습니다" } }), true);
    assert.equal(isAuthFailure({ body: "401 Unauthorized: 인증이 필요합니다" }), true);
    assert.equal(isAuthFailure({ headers: { message: "인증이 필요합니다" } }), true);
});

test("인증과 무관한 오류는 인증 실패가 아니다 — 토큰을 헛되이 갱신하지 않는다", () => {
    assert.equal(isAuthFailure({ headers: { message: "Broker unavailable" } }), false);
    assert.equal(isAuthFailure(null), false);
    assert.equal(isAuthFailure({}), false);
});

test("세 번 연달아 거절되면 멈춘다 — 만료된 세션으로 5초마다 두드리던 자리", () => {
    assert.equal(shouldGiveUp(MAX_AUTH_FAILURES - 1), false);
    assert.equal(shouldGiveUp(MAX_AUTH_FAILURES), true);
});

test("연결 헤더는 매번 지금 토큰으로 만든다", () => {
    assert.deepEqual(connectHeadersFor("abc"), { Authorization: "Bearer abc" });
    assert.deepEqual(connectHeadersFor(null), { Authorization: "Bearer " });
});

test("서버 재시작으로 401 없이 끊긴 사이 토큰이 이미 만료됐으면 미리 갱신 대상으로 본다", () => {
    const now = 1_000_000;
    assert.equal(isTokenExpiringSoon(String(now - 1), now), true); // 이미 지남
    assert.equal(isTokenExpiringSoon(now + 1_000, now), true); // 버퍼(5초) 안에 곧 지남
    assert.equal(isTokenExpiringSoon(now + 60_000, now), false); // 아직 여유 있음
});

test("만료 시각을 모르면(로그인 직후 등) 갱신을 강제하지 않는다 — 401 경로에 맡긴다", () => {
    assert.equal(isTokenExpiringSoon(null, Date.now()), false);
    assert.equal(isTokenExpiringSoon(undefined, Date.now()), false);
    assert.equal(isTokenExpiringSoon("", Date.now()), false);
    assert.equal(isTokenExpiringSoon("이상한값", Date.now()), false);
});

test("재연결 지연은 실패마다 두 배로 늘고 상한에서 멈춘다 — 고정 5초로 서버를 두드리지 않는다", () => {
    let delay = BASE_RECONNECT_DELAY_MS;
    assert.equal(delay, 5_000);
    delay = nextReconnectDelay(delay);
    assert.equal(delay, 10_000);
    delay = nextReconnectDelay(delay);
    assert.equal(delay, 20_000);
    delay = nextReconnectDelay(delay);
    assert.equal(delay, MAX_RECONNECT_DELAY_MS); // 40000 → 30000으로 상한
    delay = nextReconnectDelay(delay);
    assert.equal(delay, MAX_RECONNECT_DELAY_MS); // 상한에서 더 늘지 않는다
});
