/**
 * 채팅방 상단 고정 — 목록 순서와 병합의 순수 규칙.
 *
 * 고정은 사람마다 다르다(서버는 방이 아니라 내 참가 정보에 pinned_at을 둔다). 그래서
 * **목록 조회(`GET /chat/rooms`)만** pinned·pinnedAt을 제대로 채워 준다. 방 하나를 돌려주는
 * 응답(공지 변경 등)은 같은 ChatRoomDTO라 `pinned: false`가 기본값으로 실려 오고, 소켓 이벤트엔
 * 아예 없다 — 그대로 덮으면 고정이 조용히 풀린다. 합칠 때는 mergeRoomKeepingPin을 쓴다.
 *
 * 순서 규칙
 * - 고정한 방이 먼저, 그다음 나머지. 각 묶음 안의 순서는 받은 그대로(서버의 최근 대화 순)다.
 *   서버도 같은 규칙(안정 정렬)으로 내려주므로 첫 목록은 이미 이 순서다.
 * - 방이 다른 묶음으로 넘어갈 때(고정/해제)만 자리를 새로 찾는다 — 최근 대화 시각으로 그 묶음
 *   안의 제자리에 꽂는다. 묶음 맨 끝에 붙이면 다음 목록 갱신 때 방이 또 튀고, 고정했다 풀면
 *   원래 자리가 아닌 곳으로 돌아간다.
 *
 * 채팅 화면(ChatManagement)과 우측 레일(ChatRail)이 이 파일 하나를 같이 쓴다.
 * 이 파일은 React·네트워크가 없다 — 규칙을 테스트로 못 박기 위해서다.
 */

export interface PinnableRoom {
    id: number;
    /** 내 목록 상단 고정 여부. 서버가 아직 모르는 필드면 비어 있다 — 고정 안 함으로 본다 */
    pinned?: boolean | null;
    pinnedAt?: string | null;
}

/** 고정/해제를 다른 화면에 알리는 창 이벤트 — 채팅 화면에서 바꾸면 숨어 있던 레일도 바로 따라간다 */
export const CHAT_ROOM_PIN_EVENT = "carev:chat-room-pin-changed";

export interface ChatRoomPinChange {
    roomId: number;
    pinned: boolean;
    pinnedAt: string | null;
}

/**
 * 최근 대화 시각(ms). 서버 정렬 기준인 COALESCE(lastMessageAt, createdAt)과 같은 순서로 본다.
 * 모르면 null — 비교에서 빠진다.
 */
function activityTime(room: PinnableRoom): number | null {
    const r = room as PinnableRoom & {
        lastMessageAt?: unknown;
        createdAt?: unknown;
        lastMessage?: { createdAt?: unknown } | null;
    };
    for (const value of [r.lastMessageAt, r.lastMessage?.createdAt, r.createdAt]) {
        if (typeof value !== "string" || !value) continue;
        const time = Date.parse(value);
        if (!Number.isNaN(time)) return time;
    }
    return null;
}

/**
 * 고정한 방을 앞으로. 각 묶음 안의 순서는 건드리지 않는다(안정 분할).
 *
 * 이미 그 순서면 **같은 배열을 그대로** 돌려준다 — 바뀐 게 없는데 새 배열을 주면 그 배열을
 * 의존하는 effect가 괜히 다시 돈다(레일 작은 창의 읽음 처리가 그걸로 재로딩 루프를 돈 적이 있다).
 */
export function sortRoomsPinnedFirst<T extends PinnableRoom>(rooms: T[]): T[] {
    let seenUnpinned = false;
    let ordered = true;
    for (const room of rooms) {
        if (!room.pinned) {
            seenUnpinned = true;
        } else if (seenUnpinned) {
            ordered = false;
            break;
        }
    }
    if (ordered) return rooms;
    return [...rooms.filter((room) => room.pinned), ...rooms.filter((room) => !room.pinned)];
}

/**
 * 한 방의 고정 여부를 바꾸고 제자리로 옮긴다.
 *
 * 넘어간 묶음 안에서 최근 대화 시각으로 자리를 찾는다(같은 시각이면 기존 방들 뒤).
 * 시각을 모르면 묶음 맨 위에 둔다 — 방금 누른 방이 눈앞에 보이는 편이 낫다.
 * 이미 그 상태면 순서는 그대로 두고 pinnedAt만 맞춘다.
 */
export function setRoomPinned<T extends PinnableRoom>(
    rooms: T[],
    roomId: number,
    pinned: boolean,
    pinnedAt: string | null = null,
): T[] {
    const target = rooms.find((room) => room.id === roomId);
    if (!target) return rooms;

    const nextPinnedAt = pinned ? (pinnedAt ?? target.pinnedAt ?? null) : null;

    if (Boolean(target.pinned) === pinned) {
        if ((target.pinnedAt ?? null) === nextPinnedAt) return rooms;
        return rooms.map((room) => (room.id === roomId ? { ...room, pinnedAt: nextPinnedAt } : room));
    }

    const updated: T = { ...target, pinned, pinnedAt: nextPinnedAt };
    const others = sortRoomsPinnedFirst(rooms.filter((room) => room.id !== roomId));
    const pinnedCount = others.filter((room) => room.pinned).length;
    const groupStart = pinned ? 0 : pinnedCount;
    const groupEnd = pinned ? pinnedCount : others.length;

    const time = activityTime(updated);
    let insertAt = groupStart;
    if (time !== null) {
        insertAt = groupEnd;
        for (let i = groupStart; i < groupEnd; i++) {
            const other = activityTime(others[i]);
            if (other !== null && other < time) {
                insertAt = i;
                break;
            }
        }
    }

    return [...others.slice(0, insertAt), updated, ...others.slice(insertAt)];
}

/**
 * 방 하나짜리 응답·소켓 값을 목록의 방에 합친다. 고정 값만은 목록 것을 지킨다.
 *
 * 들어오는 값에 pinned가 없거나(소켓), `pinned: false`가 기본값으로 실려 있거나(방 하나짜리 응답),
 * `pinned: undefined`가 명시돼 있어도 결과는 같다 — 고정은 목록 조회와 고정 API만 바꾼다.
 */
export function mergeRoomKeepingPin<T extends PinnableRoom>(existing: T, incoming: Partial<T> | null | undefined): T {
    return { ...existing, ...(incoming || {}), pinned: existing.pinned, pinnedAt: existing.pinnedAt };
}

/**
 * 고정을 바꾸기 전에 출발했을 수 있는 목록 응답을 받을 때 — 응답의 다른 값(안읽음·마지막 메시지)은
 * 받되, 고정 여부만은 지금 화면 값을 지킨다. 안 그러면 방금 고정한 방이 다음 갱신(30초)까지 풀려 보이고,
 * 그걸 보고 한 번 더 누르면 정말로 풀린다.
 */
export function keepLocalPins<T extends PinnableRoom>(serverRooms: T[], localRooms: T[]): T[] {
    const local = new Map(localRooms.map((room) => [room.id, room]));
    let result = sortRoomsPinnedFirst(serverRooms);
    for (const room of serverRooms) {
        const mine = local.get(room.id);
        if (mine && Boolean(mine.pinned) !== Boolean(room.pinned)) {
            result = setRoomPinned(result, room.id, Boolean(mine.pinned), mine.pinnedAt ?? null);
        }
    }
    return result;
}
