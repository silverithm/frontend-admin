import type { CSSProperties } from "react";

/**
 * 2단 머리 — 페이지 안쪽 카드·패널의 머리줄 (DESIGN.md "2단 머리").
 * 옅은 틸 면 + 아래 1px 선. 면은 카드 가장자리까지 꽉 차야 하므로 카드 안쪽 padding 0 위에서 쓴다.
 * 카드(Card)가 overflow: clip + 둥근 모서리라 위쪽 모서리는 카드가 잘라 준다.
 */
export const subheaderStyle: CSSProperties = {
    background: "var(--color-subheader-background)",
    borderBottom: "1px solid var(--color-subheader-border)",
};

/** 머리줄 아래 본문의 위쪽 여백 — 선에 붙어 보이지 않게 */
export const subheaderBodyGap = "var(--spacing-3)";

