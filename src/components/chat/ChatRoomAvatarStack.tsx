"use client";

import { Avatar } from "@astryxdesign/core/Avatar";

/** 목록에서 방 아이콘 자리에 겹쳐 그릴 참여자 한 명 */
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

/**
 * 채팅방 아이콘 — 참여자 얼굴을 모아 하나의 원으로 보여준다 (카카오톡과 같은 방식, 앱과 같은 규칙).
 *
 * 사람 수에 따라 칸을 다르게 나눈다. 넷을 넘으면 앞의 넷만 —
 * 더 넣으면 한 칸이 너무 작아져 누가 누군지 알아볼 수 없다.
 *
 * ```
 *   1명        2명          3명            4명 이상
 *  ┌────┐    ┌──┬──┐    ┌────┬───┐     ┌──┬──┐
 *  │ 얼 │    │얼│얼│    │ 얼 ├───┤     │얼│얼│
 *  │ 굴 │    │  │  │    │    │얼 │     ├──┼──┤
 *  └────┘    └──┴──┘    └────┴───┘     │얼│얼│
 * ```
 * 참여자를 못 받았으면 방 이름 첫 글자로 그린다 — 빈 원을 두지 않는다.
 */
export function ChatRoomAvatarStack({ roomName, people, size = 32 }: Props) {
    const shown = (people || []).slice(0, 4);

    if (shown.length === 0) {
        return <Avatar name={roomName || "?"} size="xsmall" />;
    }
    if (shown.length === 1) {
        return (
            <Avatar
                name={shown[0].userName || roomName || "?"}
                src={shown[0].profileImageUrl || undefined}
                size="xsmall"
            />
        );
    }

    /* 얼굴끼리 맞붙으면 한 사람처럼 보인다 — 얇은 선으로 가른다 */
    const gap = 1.5;

    return (
        <div
            aria-hidden
            style={{
                width: size,
                height: size,
                borderRadius: "50%",
                overflow: "hidden",
                flexShrink: 0,
                display: "grid",
                gap,
                background: "var(--color-border)",
                ...gridFor(shown.length),
            }}
        >
            {shown.map((person, index) => (
                <Face key={`${person.userId}-${index}`} person={person} index={index} count={shown.length} />
            ))}
        </div>
    );
}

/** 사람 수별 칸 나누기 — 3명은 왼쪽 한 명이 크고 오른쪽에 둘이 위아래로 */
function gridFor(count: number): React.CSSProperties {
    if (count === 2) return { gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr" };
    if (count === 3) {
        return {
            gridTemplateColumns: "1fr 1fr",
            gridTemplateRows: "1fr 1fr",
            gridTemplateAreas: `"a b" "a c"`,
        };
    }
    return { gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr" };
}

function Face({ person, index, count }: { person: ChatRoomAvatarPerson; index: number; count: number }) {
    const area = count === 3 ? ["a", "b", "c"][index] : undefined;
    const url = (person.profileImageUrl || "").trim();
    const initial = (person.userName || "").trim().slice(0, 1) || "?";

    if (!url) {
        return (
            <div
                style={{
                    gridArea: area,
                    background: "var(--color-background-teal)",
                    color: "var(--color-text-accent)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: count >= 4 ? 9 : 11,
                    fontWeight: 600,
                    lineHeight: 1,
                }}
            >
                {initial}
            </div>
        );
    }

    return (
        <img
            src={url}
            alt=""
            style={{ gridArea: area, width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            /* 사진이 안 열려도 칸이 비어 보이지 않게 첫 글자로 되돌린다 */
            onError={(e) => {
                const img = e.currentTarget;
                const box = document.createElement("div");
                box.textContent = initial;
                box.setAttribute(
                    "style",
                    `grid-area:${area ?? "auto"};background:var(--color-background-teal);color:var(--color-text-accent);` +
                        `display:flex;align-items:center;justify-content:center;font-size:${count >= 4 ? 9 : 11}px;font-weight:600;line-height:1`,
                );
                img.replaceWith(box);
            }}
        />
    );
}
