"use client";

import type { ReactNode } from "react";

import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { Badge } from "@astryxdesign/core/Badge";
import { HStack, VStack } from "@astryxdesign/core/Stack";

interface SectionHeaderProps {
    /** 구역 제목 */
    title: string;
    /** 제목 아래 한 줄 설명 */
    description?: ReactNode;
    /** 제목 옆 개수 배지. 0도 표시한다(비어 있다는 사실도 정보라서) */
    count?: number;
    /** 제목 줄 오른쪽 버튼 */
    action?: ReactNode;
    /**
     * 시각 크기. 3 = 16px bold(기본, 페이지 안의 큰 구역),
     * 4 = 13px bold(카드 안 소제목).
     */
    level?: 3 | 4;
}

/**
 * 페이지 안 구역의 제목 줄.
 *
 * PageHeader가 화면당 하나라면 이쪽은 그 아래 여러 번 나온다. 지금까지 이 자리는
 * 대부분 `<Text type="body" weight="medium">`(13px)였는데, 바로 옆 본문도 13px이라
 * 제목인지 내용인지 구분이 되지 않았다. 16px bold로 한 단 올려 페이지 제목(19)과
 * 본문(13) 사이에 실제로 계단을 만든다.
 *
 * 화면 크기와 문서 구조를 분리하기 위해 accessibilityLevel을 함께 넘긴다. 페이지
 * 제목이 h2이므로 이 구역은 h3, 카드 안 소제목(level 4)은 h4로 읽힌다 — 크기를
 * 줄이려고 style로 fontSize를 덮어쓰면 스크린리더에는 구조가 그대로 남아 어긋난다.
 */
export function SectionHeader({
    title,
    description,
    count,
    action,
    level = 3,
}: SectionHeaderProps) {
    return (
        <HStack hAlign="between" vAlign="center" gap={3} wrap="wrap">
            <VStack gap={0.5}>
                <HStack gap={2} vAlign="center">
                    <Heading level={level} accessibilityLevel={level === 3 ? 3 : 4}>
                        {title}
                    </Heading>
                    {count !== undefined && (
                        <Badge variant="neutral" label={`${count}`} />
                    )}
                </HStack>
                {description && (
                    <Text type="supporting" color="secondary">
                        {description}
                    </Text>
                )}
            </VStack>
            {action}
        </HStack>
    );
}

export default SectionHeader;
