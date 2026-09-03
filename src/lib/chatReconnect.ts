/**
 * 웹소켓이 끊겼다 다시 붙었을 때를 다루는 순수 로직 — React 없음.
 *
 * 관리자 채팅 탭(ChatManagement), 직원 플로팅 채팅(FloatingChat), 사이드 채팅(ChatDock)이
 * 같은 규칙을 쓰도록 한곳에 둔다.
 *
 * ---------------------------------------------------------------------------
 * 왜 이 파일이 생겼나 (다시 같은 실수를 하지 않기 위해)
 *
 * `@stomp/stompjs`의 `onDisconnect`는 **정상 종료일 때만** 불린다 — DISCONNECT 프레임을
 * 보내고 영수증을 받는 경로다. 와이파이가 바뀌거나 노트북을 덮거나 서버가 재시작해서
 * 소켓이 툭 끊기면 `onWebSocketClose`가 불리고, `onDisconnect`는 영영 불리지 않는다.
 *
 * 그래서 `isConnected` 같은 불리언 하나로 연결을 표현하면 이렇게 된다:
 *   1. 소켓이 끊겨도 `isConnected`는 true로 남는다
 *   2. stompjs가 알아서 재연결하고 `onConnect`에서 `setIsConnected(true)`를 부른다
 *   3. 이미 true라 **React 상태가 바뀌지 않는다** → 구독 effect가 다시 돌지 않는다
 *   4. 소켓은 살아 있는데 방 구독이 없다 → 새 메시지가 안 온다
 *   5. 창을 나갔다 들어오면 다시 마운트돼서 붙는다 — "나갔다 와야 보인다"의 정체다
 *
 * 그래서 연결 상태는 불리언이 아니라 **세대 번호(epoch)**로 센다. 붙을 때마다 값이
 * 반드시 달라지므로 구독 effect가 매 연결마다 확실히 다시 돈다.
 */

/** 화면이 들고 있는 메시지 중 가장 큰 id (없으면 null) */
function maxId<M extends { id: number }>(messages: M[]): number | null {
    let max: number | null = null;
    for (const m of messages) {
        if (max === null || m.id > max) max = m.id;
    }
    return max;
}

/**
 * 끊겨 있던 사이에 온 메시지를 화면 목록에 메운다.
 *
 * @param current 지금 화면이 들고 있는 목록 (오래된 것부터)
 * @param latest  재연결 직후 서버에서 새로 받은 '최신 한 페이지' (오래된 것부터)
 *
 * 두 구간이 겹치면 id로 합친다 — 겹치는 것은 서버 쪽을 쓴다. 그래야 끊긴 사이에 일어난
 * 수정·삭제도 함께 따라온다.
 *
 * 겹치지 않으면(끊긴 사이에 한 페이지를 넘는 메시지가 쌓인 경우) 억지로 잇지 않고
 * 새로 받은 구간만 남긴다. 이어붙이면 사이에 빠진 구간이 없는 것처럼 보이는데,
 * 그건 실제 대화와 다르다 — 위로 올려 이어붙이는 기존 경로가 나머지를 채운다.
 */
export function mergeMissedMessages<M extends { id: number }>(current: M[], latest: M[]): M[] {
    if (latest.length === 0) return current;
    if (current.length === 0) return latest;

    const currentMax = maxId(current);
    const latestOldest = latest[0].id;

    // 새로 받은 구간이 통째로 더 최신이면 두 구간 사이가 비어 있다 — 잇지 않는다
    if (currentMax !== null && latestOldest > currentMax) return latest;

    const byId = new Map<number, M>();
    for (const m of current) byId.set(m.id, m);
    for (const m of latest) byId.set(m.id, m); // 서버 것이 이긴다 (수정·삭제 반영)

    return [...byId.values()].sort((a, b) => a.id - b.id);
}

/** 서버가 준 최신 목록에, 내가 아직 모르는 메시지가 있는가 */
export function hasMissedMessages<M extends { id: number }>(current: M[], latest: M[]): boolean {
    if (latest.length === 0) return false;
    const currentMax = maxId(current);
    if (currentMax === null) return true;
    const latestMax = maxId(latest);
    return latestMax !== null && latestMax > currentMax;
}

/**
 * 백엔드 응답에서 메시지 배열을 꺼내 **오래된 것부터**로 뒤집는다.
 * 서버는 createdAt DESC(최신순)로 주고, 화면 셋은 모두 오름차순을 전제한다.
 * (응답이 배열이 아니라 래퍼 객체로 온다는 것은 이 프로젝트의 오랜 규약이다)
 */
export function readAscendingMessages<M>(data: unknown): M[] {
    const payload = data as { messages?: M[]; content?: M[]; data?: M[] } | M[] | null;
    const list = Array.isArray(payload)
        ? payload
        : (payload?.messages || payload?.content || payload?.data || []);
    return [...list].reverse();
}
