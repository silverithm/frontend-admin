"use client";

import type { ReactNode } from "react";

import { Card } from "@astryxdesign/core/Card";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/Stack";

/** 값 글자색. 배경은 건드리지 않는다 — 아래 주석 참고 */
type StatTone = "neutral" | "success" | "warning" | "danger";

const TONE_COLOR: Record<StatTone, string> = {
    neutral: "var(--color-text-primary)",
    success: "var(--color-text-green)",
    warning: "var(--color-text-yellow)",
    danger: "var(--color-text-red)",
};

interface StatTileProps {
    /** 큰 숫자 */
    value: ReactNode;
    /** 숫자 아래 이름 */
    label: string;
    /** 숫자 색. 기본은 본문색이며, 의미가 있을 때만 준다 */
    tone?: StatTone;
}

interface StatRowProps {
    /** StatTile들 */
    children: ReactNode;
}

/**
 * 숫자 몇 개를 한 줄로 보여주는 자리.
 *
 * 같은 것이 세 벌 서로 다르게 만들어져 있었다. 배차 목록은 초록·노랑·빨강·회색
 * 카드 다섯 장을 나란히 깔았고, 배차 관리는 카드 대신 맨 div에 배경·테두리를
 * 직접 적어 두 장, 대시보드는 카드 하나 안에 세로선으로 셋을 나눴다.
 *
 * 대시보드 방식으로 통일한다. 카드가 다섯 장이면 시각적 덩어리가 다섯 개가 되어
 * 화면이 알록달록한 밭이 되는데, 한 장 안의 세로선이면 덩어리는 하나고 그 안의
 * 위계만 남는다. 색은 숫자 글자에만 준다 — 큰 면적을 상태색으로 칠하지 말라는
 * 것은 Astryx의 규칙이기도 하다(상태는 Badge·Banner가 진다).
 */
export function StatRow({ children }: StatRowProps) {
    return (
        <Card padding={4} width="100%">
            {/* 칸 수는 자식 수에 맡긴다 — 배차는 5개, 관리는 2개로 서로 다르다 */}
            <div
                style={{
                    display: "grid",
                    gridAutoFlow: "column",
                    gridAutoColumns: "minmax(0, 1fr)",
                    alignItems: "center",
                }}
            >
                {children}
            </div>
        </Card>
    );
}

export function StatTile({ value, label, tone = "neutral" }: StatTileProps) {
    return (
        // 첫 칸에도 선이 붙으면 카드 왼쪽 안쪽에 줄이 하나 더 생긴다.
        // CSS 형제 선택자로 "첫 칸이 아닐 때만" 긋는다 (globals.css의 .carev-stattile).
        <div className="carev-stattile">
            <VStack gap={1} hAlign="center">
                <Text
                    type="display-3"
                    weight="semibold"
                    hasTabularNumbers
                    style={{ color: TONE_COLOR[tone] }}
                >
                    {value}
                </Text>
                <Text type="supporting" color="secondary">{label}</Text>
            </VStack>
        </div>
    );
}

export default StatTile;
