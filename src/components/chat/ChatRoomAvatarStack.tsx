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
 * 3명 이상은 얼굴 3~4개를 한 원에 욱여넣지 않는다 — 칸이 너무 작아져 이니셜이 안
 * 읽혔다. 대신 첫 사람 얼굴 하나 + 나머지 인원수로 보여준다(최대 2칸이라 항상 읽힌다).
 *
 * ```
 *   1명        2명          3명 이상
 *  ┌────┐    ┌──┬──┐    ┌────┬───┐
 *  │ 얼 │    │얼│얼│    │ 얼 │+2 │
 *  │ 굴 │    │  │  │    │ 굴 │   │
 *  └────┘    └──┴──┘    └────┴───┘
 * ```
 * 참여자를 못 받았으면 방 이름 첫 글자로 그린다 — 빈 원을 두지 않는다.
 */
export function ChatRoomAvatarStack({ roomName, people, size = 32 }: Props) {
    const list = people || [];

    if (list.length === 0) {
        return <Avatar name={roomName || "?"} size="xsmall" />;
    }
    if (list.length === 1) {
        return (
            <Avatar
                name={list[0].userName || roomName || "?"}
                src={list[0].profileImageUrl || undefined}
                size="xsmall"
            />
        );
    }

    /* 얼굴끼리 맞붙으면 한 사람처럼 보인다 — 얇은 선으로 가른다 */
    const gap = 1.5;
    const secondCell =
        list.length === 2 ? (
            <Face person={list[1]} />
        ) : (
            <div
                style={{
                    background: "var(--color-background-teal)",
                    color: "var(--color-text-accent)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 600,
                    lineHeight: 1,
                }}
            >
                {`+${list.length - 1}`}
            </div>
        );

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
                gridTemplateColumns: "1fr 1fr",
                gap,
                background: "var(--color-border)",
            }}
        >
            <Face person={list[0]} />
            {secondCell}
        </div>
    );
}

function Face({ person }: { person: ChatRoomAvatarPerson }) {
    const url = (person.profileImageUrl || "").trim();
    const initial = (person.userName || "").trim().slice(0, 1) || "?";

    if (!url) {
        return (
            <div
                style={{
                    background: "var(--color-background-teal)",
                    color: "var(--color-text-accent)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
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
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            /* 사진이 안 열려도 칸이 비어 보이지 않게 첫 글자로 되돌린다 */
            onError={(e) => {
                const img = e.currentTarget;
                const box = document.createElement("div");
                box.textContent = initial;
                box.setAttribute(
                    "style",
                    "background:var(--color-background-teal);color:var(--color-text-accent);" +
                        "display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;line-height:1",
                );
                img.replaceWith(box);
            }}
        />
    );
}
