/**
 * 채팅방 상단 고정의 순서·병합 규칙 — `node --test src/lib/chatRoomPin.test.ts`
 *
 * 채팅 화면과 우측 레일이 같은 함수를 쓴다. 여기서 못 박는 것:
 * - 고정한 방이 항상 먼저, 각 묶음 안의 최근 대화 순은 흐트러지지 않는다
 * - 방 하나짜리 응답·소켓 값을 합쳐도 고정이 풀리지 않는다
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
    keepLocalPins,
    mergeRoomKeepingPin,
    setRoomPinned,
    sortRoomsPinnedFirst,
    type PinnableRoom,
} from "./chatRoomPin.ts";

interface Room extends PinnableRoom {
    name: string;
    unreadCount?: number;
    lastMessageAt?: string;
    noticeContent?: string | null;
}

/** 분 단위로 최근 대화 시각을 만든다 — 숫자가 클수록 최근 */
const at = (minute: number) => new Date(Date.UTC(2026, 8, 24, 9, minute)).toISOString();

const room = (id: number, minute: number, pinned = false): Room => ({
    id,
    name: `방${id}`,
    lastMessageAt: at(minute),
    pinned,
    pinnedAt: pinned ? at(0) : null,
});

const ids = (rooms: PinnableRoom[]) => rooms.map((r) => r.id);

test("고정한 방이 고정 안 한 방보다 먼저 온다", () => {
    const rooms = [room(1, 50), room(2, 40, true), room(3, 30), room(4, 20, true)];
    const sorted = sortRoomsPinnedFirst(rooms);
    assert.deepEqual(ids(sorted), [2, 4, 1, 3]);
    const firstUnpinned = sorted.findIndex((r) => !r.pinned);
    assert.ok(sorted.slice(firstUnpinned).every((r) => !r.pinned), "고정 안 한 방 아래로 고정한 방이 내려가면 안 된다");
});

test("각 묶음 안의 순서(최근 대화 순)는 그대로 남는다", () => {
    // 받은 순서 = 서버의 최근 대화 순. 묶음을 나눠도 그 안의 앞뒤는 바뀌지 않는다
    const rooms = [room(10, 59), room(11, 58, true), room(12, 57), room(13, 56, true), room(14, 55), room(15, 54, true)];
    assert.deepEqual(ids(sortRoomsPinnedFirst(rooms)), [11, 13, 15, 10, 12, 14]);
});

test("고정 필드가 없으면(서버가 아직 모를 때) 순서를 건드리지 않는다", () => {
    const rooms: Room[] = [{ id: 1, name: "a" }, { id: 2, name: "b" }, { id: 3, name: "c" }];
    assert.deepEqual(ids(sortRoomsPinnedFirst(rooms)), [1, 2, 3]);
});

test("이미 그 순서면 같은 배열을 그대로 돌려준다 — 괜한 재렌더를 만들지 않는다", () => {
    const rooms = [room(1, 50, true), room(2, 40), room(3, 30)];
    assert.equal(sortRoomsPinnedFirst(rooms), rooms);
    assert.equal(sortRoomsPinnedFirst([]).length, 0);
});

test("고정하면 고정 묶음 안의 최근 대화 순 자리로 들어간다", () => {
    // 고정: 1(50분), 2(30분) / 나머지: 3(45분), 4(20분)
    const rooms = [room(1, 50, true), room(2, 30, true), room(3, 45), room(4, 20)];
    const next = setRoomPinned(rooms, 3, true, at(59));
    assert.deepEqual(ids(next), [1, 3, 2, 4]);
    const pinnedRoom = next.find((r) => r.id === 3)!;
    assert.equal(pinnedRoom.pinned, true);
    assert.equal(pinnedRoom.pinnedAt, at(59));
});

test("고정했다 풀면 원래 자리로 돌아간다 — 되돌리기(실패 복구)가 순서를 흐트러뜨리지 않는다", () => {
    const rooms = [room(1, 50, true), room(2, 55), room(3, 45), room(4, 20)];
    const pinned = setRoomPinned(rooms, 3, true, at(59));
    assert.deepEqual(ids(pinned), [1, 3, 2, 4]);
    const reverted = setRoomPinned(pinned, 3, false, null);
    assert.deepEqual(ids(reverted), [1, 2, 3, 4]);
    assert.equal(reverted.find((r) => r.id === 3)!.pinned, false);
    assert.equal(reverted.find((r) => r.id === 3)!.pinnedAt, null);
});

test("이미 그 상태면 순서는 그대로 — 같은 값이면 같은 배열", () => {
    const rooms = [room(1, 50, true), room(2, 40)];
    assert.equal(setRoomPinned(rooms, 1, true, at(0)), rooms);
    assert.equal(setRoomPinned(rooms, 2, false), rooms);
    assert.equal(setRoomPinned(rooms, 999, true), rooms, "없는 방이면 아무것도 안 바꾼다");
});

test("최근 대화 시각을 모르면 그 묶음 맨 위에 둔다", () => {
    const rooms: Room[] = [room(1, 50, true), room(2, 40), { id: 3, name: "새 방" }];
    assert.deepEqual(ids(setRoomPinned(rooms, 3, true, at(1))), [3, 1, 2]);
});

test("방 하나짜리 응답을 합쳐도 고정 값은 목록 것을 지킨다", () => {
    const existing: Room = { ...room(7, 30, true), pinnedAt: "2026-09-24T09:00:00", noticeContent: null };

    // 1) 고정 필드가 아예 없는 값(소켓 이벤트)
    const fromSocket = mergeRoomKeepingPin(existing, { lastMessageAt: at(59), unreadCount: 2 });
    assert.equal(fromSocket.pinned, true);
    assert.equal(fromSocket.pinnedAt, "2026-09-24T09:00:00");
    assert.equal(fromSocket.lastMessageAt, at(59), "다른 값은 그대로 받는다");
    assert.equal(fromSocket.unreadCount, 2);

    // 2) 같은 DTO라 기본값 pinned:false·pinnedAt:null이 실려 온 값(공지 변경 응답)
    const fromDetail = mergeRoomKeepingPin(existing, { noticeContent: "내일 회의", pinned: false, pinnedAt: null });
    assert.equal(fromDetail.pinned, true);
    assert.equal(fromDetail.pinnedAt, "2026-09-24T09:00:00");
    assert.equal(fromDetail.noticeContent, "내일 회의");

    // 3) undefined가 명시된 값 — 펼치기(...)만 쓰면 이게 고정을 지운다
    const explicitUndefined = mergeRoomKeepingPin(existing, { pinned: undefined, pinnedAt: undefined });
    assert.equal(explicitUndefined.pinned, true);
    assert.equal(explicitUndefined.pinnedAt, "2026-09-24T09:00:00");

    // 4) 응답이 비어 있어도 목록의 방이 그대로 남는다
    assert.deepEqual(mergeRoomKeepingPin(existing, undefined), existing);
});

test("고정 안 한 방은 합쳐도 고정되지 않는다", () => {
    const existing = room(8, 30);
    const merged = mergeRoomKeepingPin(existing, { pinned: true, pinnedAt: at(1) } as Partial<Room>);
    assert.equal(merged.pinned, false);
    assert.equal(merged.pinnedAt, null);
});

test("고정을 바꾸기 전에 출발한 목록 응답은 고정만 화면 값을 지킨다", () => {
    // 화면: 방금 3을 고정했다. 서버 응답은 그 전에 출발해 3이 아직 고정 안 됨이다(안읽음은 새 값)
    const local = [room(3, 45, true), room(1, 50), room(2, 30)];
    const server: Room[] = [
        { ...room(1, 50), unreadCount: 1 },
        { ...room(3, 45), unreadCount: 4 },
        { ...room(2, 30), unreadCount: 0 },
    ];
    const kept = keepLocalPins(server, local);
    assert.deepEqual(ids(kept), [3, 1, 2]);
    assert.equal(kept[0].pinned, true);
    assert.equal(kept[0].unreadCount, 4, "고정 말고 다른 값은 서버 것을 받는다");

    // 고정 상태가 같으면 서버 응답 그대로(이미 고정 먼저 순서)
    assert.deepEqual(ids(keepLocalPins(server, server)), [1, 3, 2]);
});
