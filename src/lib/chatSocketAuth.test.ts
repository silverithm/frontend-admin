import test from "node:test";
import assert from "node:assert/strict";

import { connectHeadersFor, isAuthFailure, MAX_AUTH_FAILURES, shouldGiveUp } from "./chatSocketAuth.ts";

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
