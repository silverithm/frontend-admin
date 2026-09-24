"use client";

import type { ReactNode } from "react";

import { HStack } from "@astryxdesign/core/Stack";
import { Icon } from "@astryxdesign/core/Icon";

import { IconPinFilled } from "@tabler/icons-react";

/**
 * 목록의 방 이름 — 고정한 방이면 이름 옆에 핀을 붙인다.
 * 채팅 화면(ChatManagement)과 우측 레일(ChatRail)이 같은 모양을 쓴다.
 *
 * Item의 label 자리에 그대로 넣는다. 고정 안 한 방은 문자열을 그대로 돌려줘 Item의 기본
 * 말줄임이 전과 똑같이 돈다. 고정한 방은 이름만 말줄임되고 핀은 잘리지 않는다 — 이름이 길어도
 * 고정했다는 표시가 사라지면 안 된다.
 */
export function chatRoomLabel(name: string, pinned?: boolean | null): ReactNode {
    if (!pinned) return name;
    return (
        <HStack as="span" gap={1} vAlign="center">
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {name}
            </span>
            {/* 아이콘은 화면 낭독기에서 숨겨지므로 '상단 고정'을 이름으로 준다 */}
            <span role="img" aria-label="상단 고정" style={{ display: "inline-flex", flexShrink: 0 }}>
                <Icon icon={IconPinFilled} size="xsm" color="secondary" />
            </span>
        </HStack>
    );
}
