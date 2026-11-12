import type { CSSProperties } from "react";

/**
 * 카드 머리줄 — 페이지 안쪽 카드·패널의 머리줄 (DESIGN.md "카드 머리줄").
 * 카드와 같은 흰 면 + 아래 1px 중립 선. 선은 카드 가장자리까지 닿아야 하므로 카드 안쪽 padding 0 위에서 쓴다.
 * 2026-11-12까지는 옅은 틸 면(#F1F7F6)이었다 — 카드마다 띠가 하나씩 얹혀 화면이 줄무늬처럼 보인다는
 * 의견으로 면을 없앴다. 머리와 본문은 선 하나와 제목 굵기로 나눈다.
 */
export const subheaderStyle: CSSProperties = {
    background: "var(--color-background-card)",
    borderBottom: "1px solid var(--color-border)",
};

/** 머리줄 아래 본문의 위쪽 여백 — 선에 붙어 보이지 않게 */
export const subheaderBodyGap = "var(--spacing-3)";

