"use client";

import type { ReactNode } from "react";

import { Badge } from "@astryxdesign/core/Badge";
import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";

import { IconPinFilled } from "@tabler/icons-react";

import { formatRoomTime } from "@/lib/chatRoomTime";

/**
 * 대화방 목록 줄의 글자 — 채팅 화면·말풍선 채팅·레일이 한 규칙을 쓴다(앱 목록과 같다).
 *
 *   줄 1: 방 이름(안 읽음이면 600, 아니면 400) · 참여자 수(보조 글자)   ……  시간(보조 글자)
 *   줄 2: 미리보기(secondary, 한 줄)                                    ……  안 읽은 수 배지
 *
 * 시간과 배지는 열을 나누지 않고 줄 1·줄 2의 오른쪽 끝에 고정한다.
 * Item의 label·description 자리에 그대로 넣고, endContent는 쓰지 않는다.
 */

interface RowRoom {
    name: string;
    pinned?: boolean | null;
    participantCount?: number;
    unreadCount: number;
    lastMessageAt?: string | null;
    lastMessage?: { createdAt?: string } | null;
}

const ELLIPSIS: React.CSSProperties = { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

export function chatRoomRowLabel(room: RowRoom): ReactNode {
    const time = room.lastMessageAt || room.lastMessage?.createdAt;
    const unread = room.unreadCount > 0;
    return (
        <span style={{ display: "flex", alignItems: "baseline", gap: "var(--spacing-1-5)", minWidth: 0 }}>
            <span
                style={{
                    ...ELLIPSIS,
                    flexShrink: 1,
                    fontWeight: unread ? "var(--font-weight-semibold)" : "var(--font-weight-normal)",
                }}
            >
                {room.name}
            </span>
            {room.pinned && (
                <span role="img" aria-label="상단 고정" style={{ display: "inline-flex", flexShrink: 0, alignSelf: "center" }}>
                    <Icon icon={IconPinFilled} size="xsm" color="secondary" />
                </span>
            )}
            {typeof room.participantCount === "number" && room.participantCount > 2 && (
                <span style={{ flexShrink: 0 }}>
                    <Text as="span" type="supporting" color="secondary" weight="normal">{room.participantCount}</Text>
                </span>
            )}
            <span style={{ flex: 1 }} />
            {time && (
                <span className="carev-chat-roomrow-time" style={{ flexShrink: 0, whiteSpace: "nowrap" }}>
                    <Text as="span" type="supporting" color="secondary" weight="normal">{formatRoomTime(time)}</Text>
                </span>
            )}
        </span>
    );
}

export function chatRoomRowDescription(room: RowRoom, preview: string): ReactNode {
    return (
        <span style={{ display: "flex", alignItems: "center", gap: "var(--spacing-2)", minWidth: 0 }}>
            <span style={{ ...ELLIPSIS, flex: 1 }}>
                <Text as="span" type="supporting" color="secondary" weight="normal">{preview}</Text>
            </span>
            {room.unreadCount > 0 && (
                <span style={{ flexShrink: 0, display: "inline-flex" }}>
                    <Badge variant="error" label={room.unreadCount > 99 ? "99+" : String(room.unreadCount)} />
                </span>
            )}
        </span>
    );
}
