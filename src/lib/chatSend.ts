/**
 * 보낸 메시지가 **반드시 도착하거나 반드시 실패로 보이게** 하는 순수 규칙.
 *
 * 왜 필요한가 — 웹은 소켓으로 `publish`하고 끝이었다. publish는 "보냈다"가 아니라
 * "버퍼에 넣었다"라서, 소켓이 조용히 죽어 있으면(절전·와이파이 변경) 메시지는 아무 데도
 * 가지 않고 입력창만 비워졌다. 사용자는 보낸 줄 안다.
 *
 * 규칙
 * - 보내는 쪽이 식별자(clientMessageId)를 붙인다. 서버는 그 값을 되돌려주고, 같은 값으로
 *   다시 보내면 새로 저장하지 않는다 → 재전송이 안전하다.
 * - 보내는 즉시 '전송 중' 말풍선(음수 id)을 띄운다. 서버 에코는 이 식별자로 그 말풍선을 바꾼다.
 * - 소켓으로 보낸 뒤 ACK_TIMEOUT_MS 안에 에코가 없으면 REST로 같은 식별자로 다시 보낸다.
 * - 그것도 실패하면 '실패'로 남기고, 사용자가 다시 보내거나 지운다.
 *
 * 이 파일은 React·네트워크가 없다 — 규칙을 테스트로 못 박기 위해서다. 훅은 useReliableChatSend.ts.
 */

export type SendingStatus = "sending" | "failed";

export interface Sendable {
    id: number;
    senderId: string;
    /** 보내는 쪽이 붙인 식별자 — 서버가 그대로 되돌려준다 */
    clientMessageId?: string;
    /** 서버에 아직 없는 말풍선의 상태. 서버 메시지에는 없다 */
    sendingStatus?: SendingStatus;
}

/** 소켓으로 보낸 뒤 서버 에코를 기다리는 시간. 넘기면 REST로 다시 보낸다. */
export const ACK_TIMEOUT_MS = 5000;

/** UUID v4. 서버 컬럼은 64자, 이건 36자다. */
export function newClientMessageId(): string {
    const c = typeof crypto !== "undefined" ? crypto : undefined;
    if (c && typeof c.randomUUID === "function") return c.randomUUID();
    const bytes = new Uint8Array(16);
    if (c && typeof c.getRandomValues === "function") {
        c.getRandomValues(bytes);
    } else {
        for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** 서버에 아직 없는 말풍선인가(전송 중·실패). 수정·삭제·반응을 보낼 곳이 없다. */
export function isLocalOnly(message: Pick<Sendable, "id">): boolean {
    return message.id <= 0;
}

/** 내 '전송 중' 말풍선을 서버 에코와 짝맞춘다 — 식별자로만. 내용이 같은 다른 메시지와 섞이지 않는다. */
export function indexOfPending<M extends Sendable>(messages: M[], incoming: Sendable): number {
    const key = incoming.clientMessageId;
    if (!key) return -1;
    return messages.findIndex(
        (m) => isLocalOnly(m) && m.clientMessageId === key && String(m.senderId) === String(incoming.senderId),
    );
}

/**
 * 서버에서 온 메시지를 목록에 반영한다.
 * 내 전송 중 말풍선이면 그 자리를 바꾸고, 이미 있으면 그대로, 아니면 뒤에 붙인다.
 * 어느 경우든 목록은 서버 순서를 흐트러뜨리지 않는다.
 */
export function applyIncoming<M extends Sendable>(prev: M[], incoming: M): M[] {
    const pendingIndex = indexOfPending(prev, incoming);
    if (pendingIndex !== -1) {
        const next = prev.slice();
        next[pendingIndex] = incoming;
        return next;
    }
    if (prev.some((m) => m.id === incoming.id)) return prev;
    return [...prev, incoming];
}

/** 식별자가 가리키는 말풍선의 상태를 바꾼다. 없으면 그대로. */
export function setSendingStatus<M extends Sendable>(prev: M[], clientMessageId: string, status: SendingStatus): M[] {
    let changed = false;
    const next = prev.map((m) => {
        if (!isLocalOnly(m) || m.clientMessageId !== clientMessageId || m.sendingStatus === status) return m;
        changed = true;
        return { ...m, sendingStatus: status };
    });
    return changed ? next : prev;
}

/** 서버에 없는 말풍선을 지운다('보내지 않고 삭제'). */
export function removeLocal<M extends Sendable>(prev: M[], clientMessageId: string): M[] {
    const next = prev.filter((m) => !(isLocalOnly(m) && m.clientMessageId === clientMessageId));
    return next.length === prev.length ? prev : next;
}

/** 이 메시지를 서버에서 고치거나 지우거나 반응을 달 수 있는가. */
export function canActOnServer(message: Sendable): boolean {
    return !isLocalOnly(message) && !message.sendingStatus;
}

/** 소켓이 "붙어 있다"고 믿어도 되는가 — 상태 플래그와 클라이언트의 실제 상태가 모두 참일 때만. */
export function socketUsable(isConnected: boolean, client: { connected: boolean } | null | undefined): boolean {
    return isConnected && !!client && client.connected;
}
