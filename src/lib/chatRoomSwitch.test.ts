import test from "node:test";
import assert from "node:assert/strict";

import { createRoomBoundState, isStaleRoomResponse } from "./chatRoomSwitch.ts";

test("방이 바뀌면 답장·검색·파일함·패널이 모두 비어 있다", () => {
    const s = createRoomBoundState<{ id: number }>();
    assert.equal(s.replyTo, null);
    assert.equal(s.sidePanel, null);
    assert.equal(s.searchKeyword, "");
    assert.equal(s.searchResults, null);
    assert.equal(s.jumpToDate, "");
    assert.deepEqual(s.sharedFiles, []);
    assert.equal(s.isJumpedToOlder, false);
    assert.equal(s.highlightedMessageId, null);
});

test("호출마다 새 배열이라 한 방의 파일함이 다른 방과 섞이지 않는다", () => {
    const a = createRoomBoundState<number>();
    const b = createRoomBoundState<number>();
    a.sharedFiles.push(1);
    assert.deepEqual(b.sharedFiles, []);
});

test("다른 방에 대한 늦은 응답은 버린다", () => {
    assert.equal(isStaleRoomResponse(1, 2), true);
    assert.equal(isStaleRoomResponse(1, null), true);
    assert.equal(isStaleRoomResponse(1, 1), false);
});
