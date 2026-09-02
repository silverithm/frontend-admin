"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { fetchChatMessagesAround } from "@/lib/apiService";

/** 방을 열 때 처음 받아오는 개수 — 세 채팅 화면(관리자 탭·플로팅·도크)이 모두 이 값으로 첫 조회를 한다 */
export const CHAT_PAGE_SIZE = 50;

/**
 * 받아온 옛 메시지를 목록 앞에 붙인다 — 이미 갖고 있는 id는 뺀다.
 * 세 채팅 화면(관리자 탭·플로팅·도크)이 같은 병합 규칙을 쓰도록 한곳에 둔다.
 * (각자 적어 두면 한쪽만 고쳐진다)
 */
export function prependUniqueMessages<T extends { id: number }>(prev: T[], older: T[]): T[] {
    const known = new Set(prev.map(m => m.id));
    const fresh = older.filter(m => !known.has(m.id));
    return fresh.length > 0 ? [...fresh, ...prev] : prev;
}

/** 화면 맨 위에서 이만큼 안쪽이면 '위에 닿았다'고 본다 */
const TOP_THRESHOLD_PX = 80;

interface Options<T> {
    /** 지금 보고 있는 방 — 바뀌면 상태가 알아서 초기화된다 */
    roomId: number | null;
    /** 화면에 그려져 있는 메시지 (오래된 것이 앞) */
    messages: T[];
    /** 스크롤이 생기는 요소 */
    containerRef: RefObject<HTMLDivElement | null>;
    /** 이어 붙일 옛 메시지를 넘겨준다 — 목록 상태를 들고 있는 쪽이 앞에 붙인다 */
    onPrepend: (older: T[]) => void;
    onError?: (error: unknown) => void;
}

/**
 * 위로 스크롤해 옛 대화를 이어 붙인다. 관리자 채팅 탭과 플로팅/도크 채팅이 함께 쓴다.
 *
 * ## 왜 page 번호가 아니라 메시지 id 기준(around)인가
 * `/messages?page=N`은 최신에서 센 offset이라, 보는 동안 대화가 오가면 구간이 밀려
 * 겹치거나 **조용히 빠진다**(중복은 걸러도 누락은 안 보인다). 반면 맨 위 메시지 id를
 * 기준으로 앞뒤를 받는 `/messages/around`는 언제 불러도 같은 자리를 가리키고,
 * 검색 결과로 옛 구간에 점프해 있는 상태에서도 같은 코드가 그대로 동작한다.
 * 응답의 뒤쪽 절반은 이미 갖고 있는 메시지라 id로 걸러 버린다.
 *
 * ## 화면이 튀지 않게 하는 방법
 * 목록 위에 무언가 붙으면 보던 메시지가 그만큼 아래로 밀린다. 그래서 붙기 직전의
 * scrollHeight/scrollTop을 재두었다가, 커밋 직후(useLayoutEffect, 페인트 전) 늘어난
 * 높이만큼 scrollTop을 더해 원래 자리에 되돌린다. 로딩 줄이 나타나고 사라지는 것도
 * 같은 방식으로 보정한다.
 */
export function useOlderChatMessages<T extends { id: number }>({
    roomId,
    messages,
    containerRef,
    onPrepend,
    onError,
}: Options<T>) {
    /**
     * 서버가 알려준 '더 있음' — 아직 한 번도 안 불러왔으면 null이고, 그때는 처음 받아온
     * 개수로 짐작한다(서버의 hasMore도 '요청한 만큼 꽉 찼는가'라 같은 계산이다).
     */
    const [hasBefore, setHasBefore] = useState<boolean | null>(null);
    const [isLoadingOlder, setIsLoadingOlder] = useState(false);
    // 스크롤 이벤트는 상태 반영보다 훨씬 빨리 연달아 오므로 중복 호출은 ref로 막는다
    const isLoadingOlderRef = useRef(false);
    /**
     * 방을 연 직후엔 목록이 맨 위(scrollTop 0)에서 시작해 맨 아래로 내려간다 — 그 사이의
     * 스크롤을 '위로 올렸다'로 오해하면 열자마자 한 페이지를 더 불러온다. 그래서 사용자가
     * 실제로 스크롤을 건드릴 때까지는 잠가 둔다.
     */
    const lockedRef = useRef(true);
    /** 목록 위에 무언가 붙기(또는 로딩 줄이 뜨고 지기) 직전의 스크롤 기준점 */
    const anchorRef = useRef<{ scrollHeight: number; scrollTop: number } | null>(null);

    // 콜백/목록은 렌더마다 새로 오므로 ref로 최신값을 들고 있는다 (핸들러를 다시 만들지 않기 위해)
    const messagesRef = useRef(messages);
    messagesRef.current = messages;
    const onPrependRef = useRef(onPrepend);
    onPrependRef.current = onPrepend;
    const onErrorRef = useRef(onError);
    onErrorRef.current = onError;

    const hasMoreOlder = hasBefore ?? messages.length >= CHAT_PAGE_SIZE;

    // 방이 바뀌면 처음 상태로
    useEffect(() => {
        setHasBefore(null);
        lockedRef.current = true;
        anchorRef.current = null;
    }, [roomId]);

    /**
     * 목록을 통째로 다른 구간으로 갈아끼운 직후 알려준다 (검색 결과로 점프 등).
     * hasMore를 알고 있으면 넘기고, 모르면 비워 둔다(개수로 짐작한다).
     */
    const resetWindow = useCallback((nextHasMore?: boolean | null) => {
        setHasBefore(nextHasMore ?? null);
        lockedRef.current = true;
        anchorRef.current = null;
    }, []);

    const loadOlder = useCallback(async () => {
        const el = containerRef.current;
        if (!el || !roomId) return;
        if (lockedRef.current || isLoadingOlderRef.current) return;
        const oldest = messagesRef.current[0];
        if (!oldest) return;
        // 남은 게 없다고 이미 알고 있으면 부르지 않는다 (아직 모르면 개수로 짐작한다)
        if (!(hasBefore ?? messagesRef.current.length >= CHAT_PAGE_SIZE)) return;

        isLoadingOlderRef.current = true;
        // 로딩 줄이 위에 생기면서 밀리는 것부터 잡는다
        anchorRef.current = { scrollHeight: el.scrollHeight, scrollTop: el.scrollTop };
        setIsLoadingOlder(true);

        try {
            // around는 요청 size의 절반씩 앞뒤로 주므로, 옛 대화 50건을 받으려면 두 배로 요청한다
            const data = await fetchChatMessagesAround(roomId, oldest.id, CHAT_PAGE_SIZE * 2);
            const list: T[] = Array.isArray(data) ? data : (data.messages || []);
            // 최신순(DESC)으로 오므로 뒤집어야 오래된 메시지가 위로 온다
            const sorted = [...list].reverse();
            const known = new Set(messagesRef.current.map(m => m.id));
            const older = sorted.filter(m => m.id < oldest.id && !known.has(m.id));

            // 붙이기 직전에 다시 잰다 — 이 값이 화면 튐을 막는 기준이 된다
            const target = containerRef.current;
            if (target) anchorRef.current = { scrollHeight: target.scrollHeight, scrollTop: target.scrollTop };

            setHasBefore(Boolean(data?.hasBefore));
            if (older.length > 0) onPrependRef.current(older);
        } catch (error) {
            console.error("옛 메시지 조회 실패:", error);
            anchorRef.current = null;
            onErrorRef.current?.(error);
        } finally {
            // onPrepend로 인한 setState와 같은 커밋에 묶여야 위 기준점 보정이 한 번에 맞는다
            setIsLoadingOlder(false);
            isLoadingOlderRef.current = false;
        }
    }, [containerRef, roomId, hasBefore]);

    /** 목록 위에 내용이 붙은(또는 로딩 줄이 뜨고 진) 직후, 늘어난 만큼 스크롤을 밀어 화면을 고정한다 */
    useLayoutEffect(() => {
        const el = containerRef.current;
        const anchor = anchorRef.current;
        if (!el || !anchor) return;
        anchorRef.current = null;
        const delta = el.scrollHeight - anchor.scrollHeight;
        if (delta !== 0) el.scrollTop = anchor.scrollTop + delta;
    }, [containerRef, messages, isLoadingOlder]);

    const handleScroll = useCallback(() => {
        const el = containerRef.current;
        if (el && el.scrollTop < TOP_THRESHOLD_PX) loadOlder();
    }, [containerRef, loadOlder]);

    /**
     * 이미 맨 위(scrollTop 0)에 붙어 있으면 아무리 더 올려도 브라우저가 scroll 이벤트를
     * 주지 않는다 — 그래서 휠·터치 자체에서도 한 번 더 확인해 이어 붙인다.
     */
    const handleWheel = useCallback((event: { deltaY: number }) => {
        lockedRef.current = false;
        if (event.deltaY >= 0) return; // 아래로 굴리는 중이면 둔다
        handleScroll();
    }, [handleScroll]);

    const handleTouchMove = useCallback(() => {
        lockedRef.current = false;
        handleScroll();
    }, [handleScroll]);

    /** 스크롤 영역 요소에 그대로 펼쳐 넣는다 */
    const scrollAreaProps = {
        onScroll: handleScroll,
        onWheel: handleWheel,
        onTouchMove: handleTouchMove,
        // 스크롤바를 끌거나 키보드로 움직이는 것도 '사용자가 건드렸다'로 친다
        onMouseDown: () => { lockedRef.current = false; },
        onKeyDown: () => { lockedRef.current = false; },
    };

    return { isLoadingOlder, hasMoreOlder, resetWindow, scrollAreaProps };
}
