"use client";

import type { ReactNode } from "react";

import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { HStack, VStack } from "@astryxdesign/core/Stack";

interface PageHeaderProps {
    /** 탭/페이지 제목. 화면당 하나만 둔다 (실제 <h2>로 렌더된다) */
    title: string;
    /** 제목 아래 한 줄 설명 */
    description?: ReactNode;
    /** 제목 바로 옆에 붙는 배지 — "운영자", "NEW"처럼 제목의 성격을 규정하는 것만 */
    titleBadge?: ReactNode;
    /** 제목 줄 오른쪽 끝 버튼들 */
    actions?: ReactNode;
}

/**
 * 탭 본문 맨 윗줄 — 제목 + 설명 + 우측 액션.
 *
 * 여태 이 세 줄짜리 묶음이 화면마다 따로 적혀 있었다(9곳). 그 사이에 제목 태그가
 * 세 종류로 갈라졌고(Heading level=2 19px / Text display-3 27px / Text large 16px),
 * 제목과 설명 사이 간격도 0·0.5·1로 제각각이라 탭을 옮길 때마다 글자 크기가 널뛰었다.
 * 여기서 한 번만 정한다.
 *
 * 크기를 19px로 모은 이유: 관리자 화면은 목록이 길어 세로 공간이 아깝다. 27px은 두
 * 화면만 혼자 크던 값이라 맞춰 내렸고, 16px 하나는 올렸다. 대신 제목(19)과 설명(11)의
 * 차이를 벌려, 예전처럼 13px과 11px이 붙어 뭉개지던 상태를 깬다.
 *
 * 바깥 여백은 갖지 않는다 — 본문과의 간격은 감싸는 쪽의 gap이 정한다(관례: gap={4}).
 */
export function PageHeader({
    title,
    description,
    titleBadge,
    actions,
}: PageHeaderProps) {
    return (
        // 액션이 둘 이상인 화면(결재 신청·양식 관리)은 좁은 폭에서 제목 줄이 넘치므로
        // 줄바꿈을 항상 허용한다. 넘치지 않으면 한 줄 그대로다.
        <HStack hAlign="between" vAlign="center" gap={3} wrap="wrap">
            <VStack gap={0.5}>
                <HStack gap={2} vAlign="center">
                    <Heading level={2}>{title}</Heading>
                    {titleBadge}
                </HStack>
                {description && (
                    <Text type="supporting" color="secondary">
                        {description}
                    </Text>
                )}
            </VStack>
            {actions}
        </HStack>
    );
}

export default PageHeader;
