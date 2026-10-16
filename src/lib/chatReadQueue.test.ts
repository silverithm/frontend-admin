import test from "node:test";
import assert from "node:assert/strict";

import { createChatReadQueue } from "./chatReadQueue.ts";

type Call = { roomId: number; id: number; resolve: () => void; reject: (e: unknown) => void };

/** 보낸 요청을 기록하고, 응답 시점은 테스트가 정한다. 같은 방 동시 요청 수의 최댓값도 잰다. */
function fakeSend() {
    const calls: Call[] = [];
    const active = new Map<number, number>();
    let maxConcurrentPerRoom = 0;
    const send = (roomId: number, id: number) =>
        new Promise<void>((resolve, reject) => {
            const now = (active.get(roomId) ?? 0) + 1;
            active.set(roomId, now);
            maxConcurrentPerRoom = Math.max(maxConcurrentPerRoom, now);
            const done = () => active.set(roomId, (active.get(roomId) ?? 1) - 1);
            calls.push({
                roomId,
                id,
                resolve: () => { done(); resolve(); },
                reject: (e) => { done(); reject(e); },
            });
        });
    return { send, calls, maxConcurrent: () => maxConcurrentPerRoom };
}

const settle = () => new Promise<void>((r) => setImmediate(r));

test("짧은 사이에 9번 읽어도 가장 큰 번호로 한 번만 보낸다 (사진 10장 연속 수신)", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { send, calls } = fakeSend();
    const queue = createChatReadQueue(send, 300);

    const marks = [8901, 8902, 8903, 8904, 8905, 8906, 8907, 8908, 8909].map((id) => queue.mark(174, id));
    assert.equal(calls.length, 0);
    t.mock.timers.tick(300);
    assert.deepEqual(calls.map((c) => [c.roomId, c.id]), [[174, 8909]]);

    calls[0].resolve();
    await Promise.all(marks); // 모두 끝난다
});

test("보내는 중에 온 읽음은 기다렸다가 끝난 뒤 한 번에 보낸다 — 같은 방 요청이 겹치지 않는다", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { send, calls, maxConcurrent } = fakeSend();
    const queue = createChatReadQueue(send, 300);

    const first = queue.mark(174, 1);
    t.mock.timers.tick(300);
    assert.equal(calls.length, 1);

    const second = queue.mark(174, 2);
    const third = queue.mark(174, 3);
    t.mock.timers.tick(1000);
    assert.equal(calls.length, 1, "앞 요청이 끝나기 전에는 보내지 않는다");

    calls[0].resolve();
    await first;
    await settle();
    t.mock.timers.tick(300);
    assert.deepEqual(calls.map((c) => c.id), [1, 3]);
    calls[1].resolve();
    await Promise.all([second, third]);
    assert.equal(maxConcurrent(), 1);
});

test("이미 보내는 번호 이하를 읽었다는 호출은 그 요청에 묻어 끝나고 더 보내지 않는다", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { send, calls } = fakeSend();
    const queue = createChatReadQueue(send, 300);

    const a = queue.mark(5, 10);
    t.mock.timers.tick(300);
    const b = queue.mark(5, 9);
    calls[0].resolve();
    await Promise.all([a, b]);
    await settle();
    t.mock.timers.tick(1000);
    assert.equal(calls.length, 1);
});

test("방마다 따로 보낸다", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { send, calls } = fakeSend();
    const queue = createChatReadQueue(send, 300);

    void queue.mark(1, 100);
    void queue.mark(2, 7);
    void queue.mark(1, 101);
    t.mock.timers.tick(300);
    assert.deepEqual(calls.map((c) => [c.roomId, c.id]).sort((x, y) => x[0] - y[0]), [[1, 101], [2, 7]]);
});

test("요청이 실패하면 그 요청에 묶인 호출이 모두 실패하고, 다음 읽음은 다시 보낸다", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { send, calls } = fakeSend();
    const queue = createChatReadQueue(send, 300);

    const a = queue.mark(3, 1);
    const b = queue.mark(3, 2);
    t.mock.timers.tick(300);
    const boom = new Error("401");
    calls[0].reject(boom);
    await assert.rejects(a, boom);
    await assert.rejects(b, boom);
    await settle();

    const c = queue.mark(3, 2);
    t.mock.timers.tick(300);
    assert.deepEqual(calls.map((x) => x.id), [2, 2]);
    calls[1].resolve();
    await c;
});
