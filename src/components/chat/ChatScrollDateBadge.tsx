"use client";

import { RefObject, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { Text } from "@astryxdesign/core/Text";

import { duration } from "@/theme/motion";

/**
 * 위로 한참 올렸을 때 "지금 보는 게 며칠 대화인지" 알려주는 떠 있는 배지.
 * (카톡의 그것 — 스크롤하는 동안만 보이고 멈추면 사라진다)
 *
 * 날짜 규칙을 새로 만들지 않는다. 화면에 이미 그려진 **날짜 구분선**에 표시를 달아 두고,
 * 그중 화면 위 경계를 지나간 마지막 것을 읽을 뿐이다. 그래서 구분선과 배지가 어긋날 수 없다.
 * 문구는 `formatDateSeparator`(오늘/어제/N월 N일)가 만든 것을 그대로 쓴다. [[chatMessageGrouping]]
 */

/** 날짜 구분선에 다는 표시의 속성 이름 */
const DATE_MARKER_ATTR = "data-chat-date-label";

/**
 * 날짜 구분선 요소에 펼쳐 넣는다 — `<div {...chatDateMarkerProps(label)}>`.
 * 구분선에 쓰는 문구를 그대로 넘기면 된다.
 */
export function chatDateMarkerProps(label: string): Record<string, string> {
    return { [DATE_MARKER_ATTR]: label };
}

/**
 * 스크롤 위치에서 '지금 화면 맨 위의 날짜'를 읽어 주는 훅.
 *
 * @returns `dateBadgeLabel` 배지에 띄울 문구(없으면 null),
 *          `updateDateBadge` 스크롤 핸들러에서 불러 줄 갱신 함수
 */
export function useChatScrollDateBadge(containerRef: RefObject<HTMLDivElement | null>) {
    const [dateBadgeLabel, setDateBadgeLabel] = useState<string | null>(null);
    const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const updateDateBadge = useCallback(() => {
        const container = containerRef.current;
        if (!container) return;

        const markers = container.querySelectorAll<HTMLElement>(`[${DATE_MARKER_ATTR}]`);
        const containerTop = container.getBoundingClientRect().top;

        // 위에서부터 훑어, 화면 위 경계를 이미 지나간 마지막 구분선을 찾는다.
        // 그 구분선 아래의 대화가 지금 보이는 것이므로 그 날짜가 답이다.
        let current: string | null = null;
        for (const marker of markers) {
            if (marker.getBoundingClientRect().bottom > containerTop) break;
            current = marker.getAttribute(DATE_MARKER_ATTR);
        }

        // 첫 구분선조차 아직 안 지나갔다면 그 구분선이 화면에 그대로 보인다 — 배지는 군더더기다
        setDateBadgeLabel(current);

        // 멈추면 사라진다
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => setDateBadgeLabel(null), 1200);
    }, [containerRef]);

    useEffect(() => () => {
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    }, []);

    return { dateBadgeLabel, updateDateBadge };
}

interface ChatScrollDateBadgeProps {
    /** `useChatScrollDateBadge`가 준 문구 */
    label: string | null;
    /**
     * 스크롤 영역 위쪽에서 얼마나 떨어져 붙을지.
     * 위에 다른 sticky 안내(예: '지난 대화 구간을 보고 있습니다')가 있을 때 그만큼 내린다.
     */
    offsetTop?: string;
    /** 목록의 flex gap 토큰 — 이 빈 줄이 만드는 간격을 그만큼 되돌린다 */
    listGap?: string;
}

/**
 * 메시지 스크롤 영역의 **첫 자식**으로 넣는다. 높이를 차지하지 않도록(height 0) 만들어,
 * 대화 사이 간격이 벌어지지 않게 flex gap만큼 되돌려 놓는다.
 */
export function ChatScrollDateBadge({ label, offsetTop = "0px", listGap = "var(--spacing-3)" }: ChatScrollDateBadgeProps) {
    return (
        <div
            style={{
                position: "sticky",
                top: offsetTop,
                zIndex: 11,
                height: 0,
                // 목록의 flex gap이 이 빈 줄에도 붙으므로 그만큼 되돌린다
                marginBottom: `calc(-1 * ${listGap})`,
                display: "flex",
                justifyContent: "center",
                // 부모 높이가 0이라 stretch면 알약이 납작하게 눌린다 — 제 높이를 갖게 둔다
                alignItems: "flex-start",
                // 대화를 가리기만 할 뿐 누를 수 있으면 안 된다 (드래그 선택도 막지 않는다)
                pointerEvents: "none",
            }}
        >
            <AnimatePresence>
                {label && (
                    <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: duration.fastMin }}
                        style={{
                            marginTop: "var(--spacing-1)",
                            padding: "var(--spacing-1) var(--spacing-3)",
                            borderRadius: "var(--radius-full)",
                            background: "var(--color-background)",
                            border: "1px solid var(--color-border)",
                            boxShadow: "var(--shadow-low)",
                            whiteSpace: "nowrap",
                        }}
                    >
                        <Text type="supporting" color="secondary">{label}</Text>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
