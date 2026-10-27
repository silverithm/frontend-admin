"use client";

import { FiUsers } from "react-icons/fi";

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

/**
 * 채팅방 아이콘 — 항상 지름 `size`의 원 하나다 (목록 36 / 대화방·말풍선 채팅 28).
 *
 * - 1:1 대화(또는 참여자 1명): 상대 얼굴, 사진이 없으면 이름 첫 글자
 * - 3명 이상·2명 모임방: 틸 원 + 사람들 아이콘. 이니셜 두 개를 나란히 두면
 *   사람 이름처럼 읽혀서(`김 박`) 글자를 쓰지 않는다.
 * - 참여자를 못 받았으면 방 이름 첫 글자 — 빈 원을 두지 않는다.
 *
 * 글자는 11/600 한 가지였던 것을 Text 역할 표(supporting + semibold)와 같은 토큰으로 맞춘다.
 */
export function ChatRoomAvatarStack({ roomName, people, size = 36 }: Props) {
    const list = people || [];

    if (list.length >= 2) {
        return (
            <span aria-hidden style={circleStyle(size)}>
                <FiUsers size={Math.round(size * 0.5)} />
            </span>
        );
    }

    const person = list[0];
    const label = (person?.userName || roomName || "?").trim();
    return <Face name={label} url={person?.profileImageUrl} size={size} />;
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

function Face({ name, url, size }: { name: string; url?: string | null; size: number }) {
    const src = (url || "").trim();
    const initial = name.slice(0, 1) || "?";

    if (!src) {
        return (
            <span
                aria-hidden
                style={{
                    ...circleStyle(size),
                    fontSize: "var(--font-size-base)",
                    fontWeight: "var(--font-weight-semibold)",
                    lineHeight: 1,
                }}
            >
                {initial}
            </span>
        );
    }

    return (
        <span aria-hidden style={circleStyle(size)}>
            <img
                src={src}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                /* 사진이 안 열려도 원이 비어 보이지 않게 첫 글자로 되돌린다 */
                onError={(e) => {
                    const img = e.currentTarget;
                    const box = document.createElement("span");
                    box.textContent = initial;
                    box.setAttribute(
                        "style",
                        "font-size:var(--font-size-base);font-weight:var(--font-weight-semibold);line-height:1",
                    );
                    img.replaceWith(box);
                }}
            />
        </span>
    );
}
