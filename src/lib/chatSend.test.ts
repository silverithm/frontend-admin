import test from "node:test";
import assert from "node:assert/strict";

import {
    applyIncoming,
    canActOnServer,
    indexOfPending,
    isLocalOnly,
    newClientMessageId,
    removeLocal,
    setSendingStatus,
    socketUsable,
    type Sendable,
} from "./chatSend.ts";

interface M extends Sendable {
    content: string;
}

const pending = (key: string, content = "안녕", senderId = "admin_3"): M => ({
    id: -1789353131192,
    senderId,
    content,
    clientMessageId: key,
    sendingStatus: "sending",
});

const server = (id: number, key: string | undefined, content = "안녕", senderId = "admin_3"): M => ({
    id,
    senderId,
    content,
    clientMessageId: key,
});

test("식별자는 UUID v4 모양이고 매번 다르다 — 서버 컬럼(64자) 안", () => {
    const a = newClientMessageId();
    const b = newClientMessageId();
    assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.notEqual(a, b);
    assert.ok(a.length <= 64);
});

test("에코는 내용이 아니라 식별자로 짝맞춘다 — '네', '네'를 연달아 보내도 둘 다 남는다", () => {
    const list = [pending("k1", "네"), pending("k2", "네")];
    assert.equal(indexOfPending(list, server(10, "k2", "네")), 1);
    assert.equal(indexOfPending(list, server(11, "k1", "네")), 0);

    let next = applyIncoming(list, server(10, "k2", "네"));
    next = applyIncoming(next, server(11, "k1", "네"));
    assert.deepEqual(next.map((m) => m.id), [11, 10]);
    assert.ok(next.every((m) => !m.sendingStatus));
});

test("식별자 없는 에코(구버전·남의 메시지)는 말풍선을 바꾸지 않고 뒤에 붙는다", () => {
    const list = [pending("k1")];
    const next = applyIncoming(list, server(10, undefined));
    assert.equal(next.length, 2);
    assert.equal(next[0].sendingStatus, "sending");
});

test("남이 우연히 같은 식별자를 써도 내 말풍선에 붙지 않는다", () => {
    const list = [pending("k1")];
    assert.equal(indexOfPending(list, server(10, "k1", "안녕", "12")), -1);
});

test("이미 있는 서버 메시지가 다시 오면 목록은 그대로다(같은 참조)", () => {
    const list = [server(10, "k1")];
    assert.equal(applyIncoming(list, server(10, "k1")), list);
});

test("REST 응답이 먼저 와서 말풍선이 바뀐 뒤 소켓 에코가 와도 두 번 붙지 않는다", () => {
    let list = [pending("k1")];
    list = applyIncoming(list, server(10, "k1"));   // REST 응답
    list = applyIncoming(list, server(10, "k1"));   // 소켓 에코
    assert.equal(list.length, 1);
    assert.equal(list[0].id, 10);
});

test("실패 표시는 그 식별자의 로컬 말풍선에만 붙는다", () => {
    const list = [pending("k1"), pending("k2"), server(10, "k0")];
    const next = setSendingStatus(list, "k2", "failed");
    assert.equal(next[0].sendingStatus, "sending");
    assert.equal(next[1].sendingStatus, "failed");
    assert.equal(next[2].sendingStatus, undefined);
    assert.equal(setSendingStatus(next, "없음", "failed"), next);
});

test("보내지 않고 삭제하면 로컬 말풍선만 빠진다", () => {
    const list = [pending("k1"), server(10, "k1")];
    const next = removeLocal(list, "k1");
    assert.deepEqual(next.map((m) => m.id), [10]);
    assert.equal(removeLocal(next, "k1"), next);
});

test("전송 중·실패한 말풍선은 서버에 없으니 수정·삭제·반응을 보낼 수 없다 — 운영 500의 자리", () => {
    assert.equal(isLocalOnly(pending("k1")), true);
    assert.equal(canActOnServer(pending("k1")), false);
    assert.equal(canActOnServer({ ...pending("k1"), sendingStatus: "failed" }), false);
    assert.equal(canActOnServer(server(10, "k1")), true);
});

test("소켓은 플래그와 실제 상태가 모두 참일 때만 쓴다 — 죽은 소켓에 보내고 잊던 자리", () => {
    assert.equal(socketUsable(true, { connected: true }), true);
    assert.equal(socketUsable(true, { connected: false }), false);
    assert.equal(socketUsable(false, { connected: true }), false);
    assert.equal(socketUsable(true, null), false);
});
