"use client";

import type { CSSProperties, KeyboardEvent, ReactNode } from "react";

interface ClickableRowProps {
    /** 행 전체를 눌렀을 때 */
    onClick: () => void;
    /** 스크린리더가 읽을 이름. "김영희 공지 열기"처럼 무엇을 여는지까지 담는다 */
    label: string;
    className?: string;
    style?: CSSProperties;
    children: ReactNode;
}

/**
 * 목록에서 "행 전체가 클릭 대상"인 자리에 쓴다.
 *
 * 여태 이런 행은 전부 `<div onClick>`이었다. div는 포커스를 받지 못해서 Tab 순서에
 * 아예 들어가지 않고, 그래서 마우스 없이 쓰는 사람은 공지도 게시글도 열 수 없었다.
 * 전역 포커스 링(globals.css)도 포커스를 받을 수 있는 요소에만 걸리므로 소용이 없었다.
 *
 * 여기서는 실제 `<button>`을 쓴다. Tab으로 도달하고 Enter/Space로 열리며 포커스 링도
 * 자동으로 붙는다. 버튼 기본 스타일(테두리·배경·가운데 정렬)은 전부 지워 기존 행 모양을
 * 그대로 유지하므로, 넘겨받은 style/className은 예전 div에 주던 것을 그대로 쓰면 된다.
 *
 * 안에 또 다른 버튼을 넣지 말 것 — 버튼 안의 버튼은 중첩이 금지돼 있다.
 * 그런 자리(수정·삭제가 함께 있는 행)는 이 컴포넌트 대신 행 안의 제목만 버튼으로 만든다.
 */
export function ClickableRow({
    onClick,
    label,
    className,
    style,
    children,
}: ClickableRowProps) {
    // Enter/Space는 button이 알아서 처리하지만, 부모가 키 이벤트를 가로채는 자리가 있어
    // 여기서 한 번 더 막아 스크롤이 튀는 것(Space)만 방지한다.
    const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
        if (event.key === " ") event.preventDefault();
    };

    return (
        <button
            type="button"
            aria-label={label}
            onClick={onClick}
            onKeyDown={handleKeyDown}
            className={className}
            style={{
                // 버튼 기본값 제거 — 겉모습은 기존 행 그대로 둔다
                appearance: "none",
                background: "none",
                border: "none",
                margin: 0,
                font: "inherit",
                color: "inherit",
                textAlign: "left",
                width: "100%",
                display: "block",
                cursor: "pointer",
                ...style,
            }}
        >
            {children}
        </button>
    );
}

export default ClickableRow;
