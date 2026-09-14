"use client";

import { useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";

export interface MessageMenuPositionStyle extends CSSProperties {
    position: "absolute";
    visibility: "visible" | "hidden";
}

interface UseMessageMenuPositionOptions {
    /** 메뉴가 열려 있는지 — 열릴 때만 위치를 계산한다 */
    isOpen: boolean;
    /**
     * 메뉴가 옆에 붙을 기준 요소 — 말풍선만이 아니라 시간·안읽음 숫자까지 포함한 한 줄.
     * 말풍선만 기준으로 잡으면 옆에 붙은 시간을 메뉴가 덮는다.
     */
    anchorRef: RefObject<HTMLElement | null>;
    /** 메뉴 자신 — 크기를 재기 위해 필요하다 */
    menuRef: RefObject<HTMLElement | null>;
    /** 스크롤 컨테이너 — 이 경계 밖으로 메뉴가 잘리지 않게 clamp한다 */
    containerRef: RefObject<HTMLElement | null>;
    /** 내 메시지면 왼쪽을, 상대 메시지면 오른쪽을 우선한다 */
    isMyMessage: boolean;
    /** 말풍선과 메뉴 사이 간격(px) */
    gap?: number;
    /** 컨테이너 경계에서 남겨둘 여백(px) */
    edgePadding?: number;
    /**
     * 메뉴 안 내용이 늘었다 줄었다 할 때(예: 삭제 확인 문구가 펼쳐질 때)
     * 다시 계산하도록 넘기는 값 — 바뀔 때마다 재계산한다.
     */
    recalcKey?: unknown;
}

/**
 * 메시지 롱프레스/우클릭 메뉴 위치 계산.
 *
 * 예전엔 항상 말풍선 위(`bottom: 100%`)에 떴는데, 그러면 바로 위 메시지를 가리고
 * 목록 맨 위쪽 메시지에서는 스크롤 영역 밖으로 잘려 아예 안 보였다.
 *
 * 우선순위:
 * 1. 말풍선 옆(내 메시지=왼쪽, 상대 메시지=오른쪽), 세로는 말풍선 윗선에 맞춘다.
 * 2. 옆에 자리가 없으면 반대쪽 옆을 시도한다.
 * 3. 그래도 없으면 아래로, 아래가 모자라고 위가 통째로 들어가면 위로 — 대상 글은 덮지 않는다.
 *    (원래 버그는 '항상 위'라 목록 맨 위 글에서 메뉴가 잘린 것이었다.)
 * 4. 어느 경우든 스크롤 컨테이너 경계 안으로 clamp한다.
 */
export function useMessageMenuPosition({
    isOpen,
    anchorRef,
    menuRef,
    containerRef,
    isMyMessage,
    gap = 8,
    edgePadding = 8,
    recalcKey,
}: UseMessageMenuPositionOptions): MessageMenuPositionStyle {
    const [style, setStyle] = useState<MessageMenuPositionStyle>({
        position: "absolute",
        visibility: "hidden",
        top: 0,
        left: 0,
    });

    useLayoutEffect(() => {
        if (!isOpen) return;
        const anchor = anchorRef.current;
        const menu = menuRef.current;
        const container = containerRef.current;
        if (!anchor || !menu || !container) return;

        const anchorRect = anchor.getBoundingClientRect();
        const menuRect = menu.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        const spaceLeft = anchorRect.left - containerRect.left;
        const spaceRight = containerRect.right - anchorRect.right;

        const fitsLeft = spaceLeft >= menuRect.width + gap + edgePadding;
        const fitsRight = spaceRight >= menuRect.width + gap + edgePadding;

        const preferLeft = isMyMessage;
        const canGoPreferred = preferLeft ? fitsLeft : fitsRight;
        const canGoOpposite = preferLeft ? fitsRight : fitsLeft;

        let viewportLeft: number;
        let viewportTop: number;

        if (canGoPreferred || canGoOpposite) {
            const goLeft = canGoPreferred ? preferLeft : !preferLeft;
            viewportLeft = goLeft
                ? anchorRect.left - gap - menuRect.width
                : anchorRect.right + gap;
            viewportTop = anchorRect.top;
        } else {
            // 옆에 자리가 없다(좁은 플로팅 채팅) — 아래가 들어가면 아래, 아니면 위가 통째로 들어갈 때만 위.
            // 목록 맨 아래 글에서 아래만 고집하면 경계 안으로 밀려 올라와 대상 글을 덮었다.
            // 예전 버그는 '항상 위'라 맨 위 글에서 잘린 것이므로, 온전히 들어갈 때의 위는 괜찮다.
            const fitsBelow = anchorRect.bottom + gap + menuRect.height <= containerRect.bottom - edgePadding;
            const fitsAbove = anchorRect.top - gap - menuRect.height >= containerRect.top + edgePadding;
            viewportTop = fitsBelow || !fitsAbove
                ? anchorRect.bottom + gap
                : anchorRect.top - gap - menuRect.height;
            viewportLeft = isMyMessage
                ? anchorRect.right - menuRect.width
                : anchorRect.left;
        }

        // 스크롤 컨테이너 경계 안으로 clamp
        const minLeft = containerRect.left + edgePadding;
        const maxLeft = containerRect.right - edgePadding - menuRect.width;
        viewportLeft = maxLeft >= minLeft
            ? Math.min(Math.max(viewportLeft, minLeft), maxLeft)
            : minLeft;

        const minTop = containerRect.top + edgePadding;
        const maxTop = containerRect.bottom - edgePadding - menuRect.height;
        viewportTop = maxTop >= minTop
            ? Math.min(Math.max(viewportTop, minTop), maxTop)
            : minTop;

        // top/left는 메뉴의 실제 offsetParent 기준이다. 메뉴가 기준 요소의 자식이 아닐 수도 있어
        // (말풍선 바깥 줄에 그려지는 경우) 기준 요소 좌표로 빼면 이름 줄 높이만큼 어긋나
        // 메뉴가 말풍선을 덮었다 — 실제 부모의 박스(테두리·스크롤 포함)로 환산한다.
        const parent = (menu.offsetParent as HTMLElement | null) ?? anchor;
        const parentRect = parent.getBoundingClientRect();
        setStyle({
            position: "absolute",
            visibility: "visible",
            zIndex: 40,
            top: viewportTop - parentRect.top - parent.clientTop + parent.scrollTop,
            left: viewportLeft - parentRect.left - parent.clientLeft + parent.scrollLeft,
        });
        // anchorRef/menuRef/containerRef는 매 렌더 같은 ref 객체이므로 의존성에서 뺀다 —
        // 실제로 다시 계산해야 하는 시점은 열림 여부·대상·내용 크기가 바뀔 때뿐이다.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, isMyMessage, gap, edgePadding, recalcKey]);

    return style;
}
