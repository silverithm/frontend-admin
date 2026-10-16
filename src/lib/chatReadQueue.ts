/**
 * 채팅 읽음 처리를 방마다 묶어서, 한 번에 하나씩 보낸다.
 *
 * 화면은 남의 메시지가 올 때마다 읽음을 보낸다. 앱에서 사진 10장을 4초 사이에 올리면 웹이 같은 방에
 * 읽음 요청을 3초에 9번 쏘았고(운영 2026-10-16 11:06), 그중 둘이 겹쳐 서버에서 같은 읽음 기록을 두 번
 * 넣으려다 중복 키 에러가 났다. 서버가 흡수해 응답은 200이었지만 에러 로그가 남고 요청도 헛되이 많았다.
 *
 * - 짧은 시간(delayMs) 안에 온 요청은 가장 큰 메시지 번호 하나로 합친다.
 * - 같은 방 요청이 날아가는 동안에는 다음 것을 보내지 않는다 — 끝나면 그 사이 모인 것을 한 번에 보낸다.
 * - 이미 보내고 있는 번호 이하를 읽었다는 호출은 그 요청이 끝날 때 함께 끝난다.
 * - 각 호출의 Promise는 자기 번호까지 서버에 반영되면 끝나고, 그 요청이 실패하면 함께 실패한다.
 */

type Waiter = { resolve: () => void; reject: (error: unknown) => void };

interface RoomState {
    /** 아직 보내지 않은 가장 큰 메시지 번호 */
    want: number;
    /** 아직 보내지 않은 호출들 */
    waiting: Waiter[];
    timer: ReturnType<typeof setTimeout> | null;
    /** 날아가는 중인 요청 — 그 번호와 그 요청에 묶인 호출들 */
    inFlight: { upTo: number; waiters: Waiter[] } | null;
}

export interface ChatReadQueue {
    mark(roomId: number, lastMessageId: number): Promise<void>;
}

export const CHAT_READ_COALESCE_MS = 300;

export function createChatReadQueue(
    send: (roomId: number, lastMessageId: number) => Promise<unknown>,
    delayMs: number = CHAT_READ_COALESCE_MS,
): ChatReadQueue {
    const rooms = new Map<number, RoomState>();

    const schedule = (roomId: number, state: RoomState) => {
        if (state.timer || state.inFlight) return; // 날아가는 중이면 끝난 뒤에 다시 잡는다
        state.timer = setTimeout(() => flush(roomId, state), delayMs);
    };

    const flush = (roomId: number, state: RoomState) => {
        state.timer = null;
        if (state.waiting.length === 0) {
            rooms.delete(roomId);
            return;
        }
        const batch = { upTo: state.want, waiters: state.waiting };
        state.inFlight = batch;
        state.waiting = [];
        state.want = 0;

        send(roomId, batch.upTo).then(
            () => batch.waiters.forEach((w) => w.resolve()),
            (error) => batch.waiters.forEach((w) => w.reject(error)),
        ).finally(() => {
            state.inFlight = null;
            if (state.waiting.length > 0) schedule(roomId, state);
            else if (!state.timer) rooms.delete(roomId);
        });
    };

    return {
        mark(roomId, lastMessageId) {
            let state = rooms.get(roomId);
            if (!state) {
                state = { want: 0, waiting: [], timer: null, inFlight: null };
                rooms.set(roomId, state);
            }
            const target = state;
            return new Promise<void>((resolve, reject) => {
                if (target.inFlight && lastMessageId <= target.inFlight.upTo) {
                    target.inFlight.waiters.push({ resolve, reject });
                    return;
                }
                target.want = Math.max(target.want, lastMessageId);
                target.waiting.push({ resolve, reject });
                schedule(roomId, target);
            });
        },
    };
}
