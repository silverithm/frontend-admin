/**
 * 채팅 방을 옮길 때 비워야 하는 '방에 묶인' 화면 상태 — `node --test src/lib/chatRoomSwitch.test.ts`
 *
 * 남겨 두면 생기는 문제:
 * - 답장 대기(replyTo)가 남으면 다른 방 메시지에 이전 방 메시지 id가 replyToId로 실린다
 * - 검색 결과·파일함이 남으면 눌렀을 때 다른 방 id로 around 조회를 해서 실패한다
 * 입력창 초안(messageInput)은 여기 없다 — 쓰던 새 메시지가 사라지면 안 되기 때문이다.
 */
export interface RoomBoundState<M> {
    replyTo: M | null;
    sidePanel: 'search' | 'files' | null;
    searchKeyword: string;
    searchResults: M[] | null;
    jumpToDate: string;
    sharedFiles: M[];
    highlightedMessageId: number | null;
    isJumpedToOlder: boolean;
    mentionQuery: string | null;
    isNoticeExpanded: boolean;
    contextMenuMessageId: number | null;
    pendingDeleteMessageId: number | null;
}

/** 방이 바뀐 직후의 깨끗한 값 — 배열은 매번 새로 만든다 */
export const createRoomBoundState = <M,>(): RoomBoundState<M> => ({
    replyTo: null,
    sidePanel: null,
    searchKeyword: '',
    searchResults: null,
    jumpToDate: '',
    sharedFiles: [],
    highlightedMessageId: null,
    isJumpedToOlder: false,
    mentionQuery: null,
    isNoticeExpanded: false,
    contextMenuMessageId: null,
    pendingDeleteMessageId: null,
});

/** 늦게 도착한 응답이 지금 보는 방의 것인지 — 아니면 버린다 */
export const isStaleRoomResponse = (requestedRoomId: number, currentRoomId: number | null) =>
    requestedRoomId !== currentRoomId;
