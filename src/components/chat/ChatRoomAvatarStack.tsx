"use client";

import { chatAvatarLayout, MAX_AVATAR_CELLS, type AvatarCellSize } from "@/lib/chatAvatarLayout";

/** 목록에서 방 아이콘 자리에 쓰는 참여자 한 명 */
export interface ChatRoomAvatarPerson {
    userId: string;
    userName: string;
    profileImageUrl?: string | null;
}

interface Props {
    roomName: string;
    people: ChatRoomAvatarPerson[];
    /** 원 지름(px) */
    size?: number;
}

/** 칸 크기별 첫 글자 크기 — 칸이 작을수록 한 단계씩 작게 */
const INITIAL_FONT: Record<AvatarCellSize, string> = {
    whole: "var(--font-size-base)",
    half: "var(--font-size-sm)",
    quarter: "var(--font-size-xs)",
};

/** 칸 사이 흰 선 — 얼굴끼리 맞붙으면 한 사람처럼 보인다 */
const GAP = 1.5;

/**
 * 채팅방 아이콘 — 항상 지름 `size`의 원 하나다 (목록 36 / 대화방·말풍선 채팅 28).
 *
 * 참여자 얼굴을 한 원에 나눠 담는다(카카오톡과 같은 방식, 칸 규칙은 chatAvatarLayout·앱과 같다).
 * 한동안 '사람들 아이콘 하나'로 줄였는데 단체방이 다 똑같아 보여 어느 방인지 얼굴로 찾을 수
 * 없었다 — 사용자 요청(2026-11-03 "카톡처럼 4명 잘라서")으로 되돌린다.
 * 참여자를 못 받았으면 방 이름 첫 글자 — 빈 원을 두지 않는다.
 */
export function ChatRoomAvatarStack({ roomName, people, size = 36 }: Props) {
    const shown = (people || []).slice(0, MAX_AVATAR_CELLS);
    const layout = chatAvatarLayout(shown.length);

    if (layout.grid === null) {
        const person = shown[0];
        const label = (person?.userName || roomName || "?").trim();
        return (
            <span aria-hidden style={circleStyle(size)}>
                <Cell name={label} url={person?.profileImageUrl} cellSize="whole" />
            </span>
        );
    }

    return (
        <span
            aria-hidden
            style={{
                ...circleStyle(size),
                display: "inline-grid",
                gap: GAP,
                background: "var(--color-background-surface)",
                gridTemplateColumns: layout.grid.columns,
                gridTemplateRows: layout.grid.rows,
                gridTemplateAreas: layout.grid.areas,
            }}
        >
            {layout.cells.map((cell, i) => (
                <Cell
                    key={`${shown[i].userId}-${i}`}
                    name={shown[i].userName}
                    url={shown[i].profileImageUrl}
                    cellSize={cell.size}
                    area={cell.area}
                />
            ))}
        </span>
    );
}

function circleStyle(size: number): React.CSSProperties {
    return {
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-background-teal)",
        color: "var(--color-text-accent)",
    };
}

function initialStyle(cellSize: AvatarCellSize, area?: string): React.CSSProperties {
    return {
        gridArea: area,
        width: "100%",
        height: "100%",
        minWidth: 0,
        minHeight: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-background-teal)",
        color: "var(--color-text-accent)",
        fontSize: INITIAL_FONT[cellSize],
        fontWeight: "var(--font-weight-semibold)",
        lineHeight: 1,
    };
}

/** 한 칸 — 사진이 있으면 칸을 꽉 채우고, 없으면(또는 안 열리면) 이름 첫 글자 */
function Cell({ name, url, cellSize, area }: { name: string; url?: string | null; cellSize: AvatarCellSize; area?: string }) {
    const src = (url || "").trim();
    const initial = (name || "").trim().slice(0, 1) || "?";

    if (!src) {
        return <span style={initialStyle(cellSize, area)}>{initial}</span>;
    }

    return (
        <img
            src={src}
            alt=""
            style={{ gridArea: area, width: "100%", height: "100%", minWidth: 0, minHeight: 0, objectFit: "cover", display: "block" }}
            /* 사진이 안 열려도 칸이 비어 보이지 않게 첫 글자로 되돌린다 */
            onError={(e) => {
                const img = e.currentTarget;
                const box = document.createElement("span");
                box.textContent = initial;
                const s = initialStyle(cellSize, area);
                box.setAttribute(
                    "style",
                    `grid-area:${area ?? "auto"};width:100%;height:100%;display:flex;align-items:center;justify-content:center;` +
                        `background:${s.background};color:${s.color};font-size:${s.fontSize};font-weight:${s.fontWeight};line-height:1`,
                );
                img.replaceWith(box);
            }}
        />
    );
}
