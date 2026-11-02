"use client";

import type { ReactNode } from "react";

import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { HStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";

interface StandaloneTopBarProps {
    /** 화면 제목 — 이 화면의 유일한 <h1> */
    title: string;
    /** 뒤로 단추의 접근성 이름 ("뒤로", "관리자 홈으로") */
    backLabel: string;
    onBack: () => void;
    /** 오른쪽 끝 단추들 */
    actions?: ReactNode;
    /** 본문과 같은 폭으로 맞춘다 — 제목과 카드의 왼쪽 선이 이어지게 */
    maxWidth: number;
}

/**
 * 셸 밖에서 따로 열리는 화면(기관 프로필·공지 작성·공지 상세)의 맨 위 띠.
 *
 * 세 곳이 따로 적혀 높이 90·64·64, 제목 20·16·16, 왼쪽은 로고 또는 뒤로 단추로 제각각이었다.
 * 높이 64 · 뒤로 단추 + 제목(large 굵게) · 오른쪽 동작으로 여기서 한 번만 정한다.
 * 띠 색과 안쪽 글씨·단추 색은 .carev-header-band 규칙을 그대로 따른다.
 */
export function StandaloneTopBar({ title, backLabel, onBack, actions, maxWidth }: StandaloneTopBarProps) {
    return (
        <header
            className="carev-header-band"
            style={{
                background: 'var(--color-header-background)',
                borderBottom: '1px solid var(--color-header-border)',
                position: 'sticky',
                top: 0,
                zIndex: 10,
            }}
        >
            <div
                style={{
                    maxWidth,
                    margin: '0 auto',
                    padding: '0 var(--spacing-6)',
                    height: 64,
                    display: 'flex',
                    alignItems: 'center',
                }}
            >
                <HStack hAlign="between" vAlign="center" gap={4} width="100%">
                    <HStack gap={2} vAlign="center">
                        <Button
                            label={backLabel}
                            variant="ghost"
                            size="sm"
                            isIconOnly
                            icon={<Icon icon="chevronLeft" size="md" />}
                            onClick={onBack}
                        />
                        <Text type="large" as="h1" weight="bold" maxLines={1}>{title}</Text>
                    </HStack>
                    {actions && <HStack gap={2} vAlign="center">{actions}</HStack>}
                </HStack>
            </div>
        </header>
    );
}
