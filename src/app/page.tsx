'use client';

/**
 * 랜딩 페이지.
 *
 * 구조는 엔터프라이즈 B2B SaaS 랜딩의 표준 뼈대를 따른다:
 *   1) 5초 가치 제안  2) 신뢰 시그널  3) 문제 제기  4) ROI/비교 근거
 *   5) 기능  6) 워크플로우 데모  7) 실제 화면  8) 요금제  9) 리스크 완화 + CTA
 *
 * 카피는 현재 제품 범위(근무조정·월간일정·전자결재·광장·채팅·공지·직원 앱)를 기준으로 한다.
 * 과거 마케팅 이미지는 기능이 근무표 단일이던 시절 것이라 쓰지 않고,
 * 제품 화면을 본뜬 컴포넌트 모형(장식용, aria-hidden)으로 대체한다.
 */

import React from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Section } from '@astryxdesign/core/Section';
import { Card } from '@astryxdesign/core/Card';
import { ClickableCard } from '@astryxdesign/core/ClickableCard';
import { Grid } from '@astryxdesign/core/Grid';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { Icon } from '@astryxdesign/core/Icon';
import { Divider } from '@astryxdesign/core/Divider';
import { AspectRatio } from '@astryxdesign/core/AspectRatio';
import { FiArrowRight, FiCheck } from 'react-icons/fi';
import Navbar from '@/components/Navbar';
import { duration } from '@/theme/motion';

const container = (maxWidth = 1152): React.CSSProperties => ({
    width: '100%',
    maxWidth,
    marginLeft: 'auto',
    marginRight: 'auto',
});

const imageClip: React.CSSProperties = {
    borderRadius: 'var(--radius-container)',
    overflow: 'hidden',
};

/** 실제로 확인 가능한 사실만 신뢰 시그널로 쓴다. */
const TRUST_SIGNALS = [
    'iOS · Android 앱 정식 출시',
    '토스페이먼츠 안전 결제',
    '결제 수단 등록 없이 30일 무료',
];

/** 도입 전 현실 — 페인포인트 (근무표를 넘어 기관 운영 전반) */
const PROBLEMS = [
    '근무표는 엑셀로, 휴무 신청은 전화와 단톡방으로 흩어져 누가 언제 쉬는지 파악이 어렵습니다.',
    '기안문·품의서는 출력해서 도장 받으러 다니고, 결재가 어디까지 갔는지 아무도 모릅니다.',
    '공지·일정·서식 파일이 단톡방에 묻혀서, 평가 시즌마다 자료를 처음부터 다시 찾습니다.',
];

const AFTER_POINTS = [
    '휴무 신청부터 승인, 근무표 반영까지 한 화면에서 끝나고 캘린더에 바로 나타납니다.',
    '전자결재는 결재선 따라 자동으로 흐르고, 승인 즉시 서명·직인이 찍힌 공문이 완성됩니다.',
    '공지·월간일정·자료가 한곳에 쌓여 기관 평가 준비가 기록으로 자동으로 남습니다.',
];

/** 현재 제품 기준 기능 목록 */
const FEATURES = [
    {
        title: '근무조정·휴무 관리',
        description:
            '요양보호사, 사회복지사, 간호조무사 등 기관이 만든 역할 그대로 휴무를 신청받고 승인합니다. 날짜별 인원 현황이 캘린더에 바로 보여 인력 배치 기준 충족 여부를 놓치지 않습니다.',
    },
    {
        title: '월간일정과 할 일 관리',
        description:
            '기관 일정마다 담당자를 지정하고 세부 할 일을 나눠 맡깁니다. 담당자가 직접 수행완료를 체크하니 프로그램 운영·평가 준비가 기록으로 남습니다.',
    },
    {
        title: '전자결재 — 공문·결재선·서명',
        description:
            '표준 기안문 양식으로 문서가 만들어지고, 검토자→결재자 순서의 결재선을 지정할 수 있습니다. 승인 시 등록된 서명과 기관 직인이 자동 날인되고 문서번호가 발급됩니다.',
    },
    {
        title: '공지사항과 실시간 채팅',
        description:
            '전 직원 공지를 한 번에 전달하고, 관리자와 직원이 실시간 채팅으로 소통합니다. 단톡방에 묻히던 업무 연락이 기관 계정 안에서 정리됩니다.',
    },
    {
        title: '케어브이 광장 — 뉴스·커뮤니티·자료실',
        description:
            '장기요양 정책·평가 뉴스를 모아 보고, 다른 기관 종사자들과 커뮤니티에서 정보를 나눕니다. 서식·평가 자료는 자료실에서 바로 내려받습니다.',
    },
    {
        title: '직원 전용 앱 (iOS·Android)',
        description:
            '직원은 앱에서 휴무 신청, 일정·할 일 확인, 전자결재, 광장까지 모두 처리합니다. 관리자는 웹에서, 직원은 앱에서 — 각자 편한 곳에서 일합니다.',
    },
];

const PROCESS = [
    {
        step: '01',
        role: '관리자',
        title: '웹사이트 가입',
        description: '장기요양기관 시설장 또는 사무장이 먼저 기관 정보를 등록하며 가입을 완료합니다.',
    },
    {
        step: '02',
        role: '직원',
        title: '앱 가입 요청',
        description: '요양보호사, 사회복지사 등 직원이 앱에서 소속 기관으로 회원가입을 요청합니다.',
    },
    {
        step: '03',
        role: '관리자',
        title: '가입 승인',
        description: '관리자는 요양보호사, 사회복지사 등 직원의 가입 요청을 확인하고 승인합니다.',
    },
    {
        step: '04',
        role: '직원',
        title: '앱 로그인',
        description: '승인 완료 후 요양보호사, 사회복지사 등 모든 직원이 앱에 로그인할 수 있습니다.',
    },
];

const PLAN_FEATURES = [
    '휴무 신청·승인과 근무조정 캘린더',
    '월간일정·담당자·할 일 관리',
    '전자결재 (공문 양식·결재선·서명·직인)',
    '공지사항·실시간 채팅·케어브이 광장',
    '직원용 iOS·Android 앱',
];

const PLANS = [
    {
        name: '30일 무료 체험',
        price: '무료',
        priceNote: '',
        description: '결제 수단 등록 없이 30일간 모든 기능을 사용해보세요',
        features: PLAN_FEATURES,
        isRecommended: false,
    },
    {
        name: 'Basic 플랜',
        price: '₩9,900',
        priceNote: '/월',
        description: '무료 체험 이후 모든 기능을 계속 이용하세요',
        features: PLAN_FEATURES,
        isRecommended: true,
    },
];

const RESOURCES = [
    { href: '/guide', title: '사용 가이드', description: '관리자와 직원의 사용 방법을 단계별로 안내합니다.' },
    { href: '/faq', title: '자주 묻는 질문', description: '가입·휴무·요금에 대한 궁금증을 정리했습니다.' },
    { href: '/blog', title: '블로그', description: '케어브이 사용법과 기능 안내를 글로 정리했습니다.' },
];

const fadeUp = {
    initial: { opacity: 0, y: 16 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-80px' },
    transition: { duration: duration.mediumMax },
};

/* ─────────────────────────── 제품 화면 모형 (장식용) ───────────────────────────
   과거 마케팅 이미지는 근무표 단일 기능 시절 것이라 폐기했다.
   실제 제품 UI를 본뜬 경량 모형을 코드로 그려 기능 범위를 시각적으로 전달한다. */

const mockFrame: React.CSSProperties = {
    background: 'var(--color-background-card)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-container)',
    boxShadow: 'var(--shadow-low)',
    overflow: 'hidden',
};

const mockTitlebar: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '10px 14px',
    borderBottom: '1px solid var(--color-border)',
    background: 'var(--color-background-muted)',
};

/** 히어로: 실제 관리자 대시보드 캡처 (시연 데이터, 기관명은 가명) */
function DashboardPreview() {
    return (
        <div style={{ ...mockFrame, maxWidth: 960, marginInline: 'auto', width: '100%' }}>
            <div style={mockTitlebar}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f87171', display: 'inline-block' }} />
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fbbf24', display: 'inline-block' }} />
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399', display: 'inline-block' }} />
                <span style={{ marginLeft: 8 }}>
                    <Text type="supporting" color="secondary">carev.kr — 관리자 대시보드</Text>
                </span>
            </div>
            <Image
                src="/images/dashboard-preview.jpg"
                alt="케어브이 관리자 대시보드 실제 화면 — 출근·휴무 현황, 공지사항, 전자결재, 요양 소식, 월간일정이 한 화면에 보인다"
                width={1720}
                height={940}
                sizes="(max-width: 1024px) 100vw, 960px"
                style={{ width: '100%', height: 'auto', display: 'block' }}
                priority
            />
        </div>
    );
}

/** 비교 카드: 수기 운영 → 케어브이 */
function BeforeAfterMock() {
    return (
        <div style={{ ...mockFrame, padding: 'var(--spacing-6)' }} aria-hidden="true">
            <VStack gap={4}>
                <VStack gap={1}>
                    <Text type="supporting" color="secondary">지금까지</Text>
                    <Text type="large" color="secondary" hasStrikethrough>
                        엑셀 근무표 · 종이 결재 · 단톡방 공지
                    </Text>
                </VStack>
                <HStack gap={2} vAlign="center">
                    <Icon icon="arrowDown" size="sm" color="accent" />
                    <Text type="supporting" color="secondary">케어브이로 바꾸면</Text>
                </HStack>
                <VStack gap={1}>
                    <Text type="display-2" weight="bold" color="accent">한 곳에서, 5분이면</Text>
                    <Text color="secondary">
                        휴무 승인·전자결재·공지·일정이 웹과 앱으로 이어집니다.
                    </Text>
                </VStack>
            </VStack>
        </div>
    );
}

/** 실제 화면 미리보기 1 — 휴무 캘린더 */
function VacationCalendarMock() {
    const names = [
        [null, '김요양', null], [null, null, null], ['이복지', null, null],
        [null, null, null], [null, '박간호', '최요양'], [null, null, null], [null, null, null],
    ];
    return (
        <div style={mockFrame} aria-hidden="true">
            <div style={mockTitlebar}>
                <Text type="supporting" weight="semibold">근무조정 · 2026년 8월</Text>
            </div>
            <div style={{ padding: 12, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                {names.map((col, i) => (
                    <div
                        key={i}
                        style={{
                            minHeight: 96,
                            borderRadius: 6,
                            border: '1px solid var(--color-border)',
                            background: 'var(--color-background-surface)',
                            padding: 4,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 3,
                        }}
                    >
                        <span style={{ fontSize: 9, color: 'var(--color-text-secondary)' }}>{i + 10}</span>
                        {col.map(
                            (name) =>
                                name && (
                                    <span
                                        key={name}
                                        style={{
                                            fontSize: 9,
                                            lineHeight: '15px',
                                            padding: '0 4px',
                                            borderRadius: 4,
                                            background: 'var(--color-background-teal)',
                                            color: 'var(--color-text-teal)',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                        }}
                                    >
                                        {name} 휴무
                                    </span>
                                )
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

/** 실제 화면 미리보기 2 — 전자결재 공문 */
function ApprovalDocMock() {
    const stampBox: React.CSSProperties = {
        flex: 1,
        border: '1px solid var(--color-border)',
        textAlign: 'center',
        padding: '4px 0',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        alignItems: 'center',
    };
    return (
        <div style={mockFrame} aria-hidden="true">
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ textAlign: 'center', borderBottom: '2px solid var(--color-text-primary)', paddingBottom: 6 }}>
                    <Text type="body" weight="bold">행복 주간보호센터</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <div>
                        <Text type="supporting" color="secondary" display="block">제 2026-12 호</Text>
                        <Text type="supporting" color="secondary" display="block">시행일: 2026. 08. 03.</Text>
                    </div>
                    <div style={{ display: 'flex', width: 150 }}>
                        {[
                            { role: '기안', done: true },
                            { role: '검토', done: true },
                            { role: '결재', done: false },
                        ].map((s) => (
                            <div key={s.role} style={stampBox}>
                                <span style={{ fontSize: 8, color: 'var(--color-text-secondary)' }}>{s.role}</span>
                                <span
                                    style={{
                                        width: 22,
                                        height: 22,
                                        borderRadius: '50%',
                                        border: s.done ? '1.5px solid var(--color-text-teal)' : '1px dashed var(--color-border)',
                                        color: 'var(--color-text-teal)',
                                        fontSize: 10,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    {s.done ? '印' : ''}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
                <Text type="body" weight="semibold" justify="center">연차 휴가 신청서</Text>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {[86, 100, 94, 62].map((w, i) => (
                        <div key={i} style={{ width: `${w}%`, height: 7, borderRadius: 4, background: 'var(--color-background-muted)' }} />
                    ))}
                </div>
                <div style={{ textAlign: 'center', position: 'relative', paddingTop: 4 }}>
                    <Text type="body" weight="bold">행복 주간보호센터장</Text>
                    <span
                        style={{
                            position: 'absolute',
                            right: '18%',
                            top: -4,
                            width: 34,
                            height: 34,
                            borderRadius: '50%',
                            border: '2px solid rgba(220, 38, 38, 0.55)',
                            color: 'rgba(220, 38, 38, 0.65)',
                            fontSize: 9,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transform: 'rotate(-8deg)',
                        }}
                    >
                        직인
                    </span>
                </div>
            </div>
        </div>
    );
}

/** 실제 화면 미리보기 3 — 직원 앱 (광장·일정) */
function EmployeeAppMock() {
    return (
        <div style={{ display: 'flex', justifyContent: 'center' }} aria-hidden="true">
            <div
                style={{
                    width: 210,
                    border: '1px solid var(--color-border)',
                    borderRadius: 24,
                    background: 'var(--color-background-card)',
                    boxShadow: 'var(--shadow-low)',
                    padding: '14px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                }}
            >
                <div style={{ width: 60, height: 5, borderRadius: 999, background: 'var(--color-background-muted)', alignSelf: 'center' }} />
                <Text type="supporting" weight="semibold">케어브이 광장</Text>
                <div style={{ padding: '7px 9px', borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-background-surface)' }}>
                    <Text type="supporting" color="secondary" display="block">요양 뉴스</Text>
                    <Text type="supporting" display="block" maxLines={2}>
                        2026년 장기요양기관 평가 지표 개정안 발표
                    </Text>
                </div>
                <div style={{ padding: '7px 9px', borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-background-surface)' }}>
                    <Text type="supporting" color="secondary" display="block">자료실</Text>
                    <Text type="supporting" display="block">📄 프로그램 운영일지 서식.hwp</Text>
                </div>
                <Text type="supporting" weight="semibold">오늘 할 일</Text>
                {['인지활동 프로그램 준비', '차량 운행 일지 작성'].map((t, i) => (
                    <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span
                            style={{
                                width: 13,
                                height: 13,
                                borderRadius: 4,
                                border: i === 0 ? 'none' : '1.5px solid var(--color-border)',
                                background: i === 0 ? 'var(--color-background-teal)' : 'transparent',
                                color: 'var(--color-text-teal)',
                                fontSize: 9,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            {i === 0 ? '✓' : ''}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--color-text-primary)', textDecoration: i === 0 ? 'line-through' : 'none', opacity: i === 0 ? 0.55 : 1 }}>
                            {t}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

const PREVIEWS = [
    {
        title: '근무조정 캘린더',
        description: '역할별 휴무 현황이 달력에 바로 보입니다',
        mock: <VacationCalendarMock />,
    },
    {
        title: '전자결재 공문',
        description: '결재선 승인마다 서명이, 최종 승인에 직인이 찍힙니다',
        mock: <ApprovalDocMock />,
    },
    {
        title: '직원 전용 앱',
        description: '광장 뉴스·자료실과 오늘의 할 일까지 앱에서',
        mock: <EmployeeAppMock />,
    },
];

export default function LandingPage() {
    const router = useRouter();

    return (
        <main style={{ minHeight: '100vh', background: 'var(--color-background-surface)' }}>
            <Navbar />

            {/* ── 1. 5초 가치 제안 ── */}
            <Section variant="transparent" padding={0} paddingBlock={10}>
                <div style={container(1100)}>
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: duration.mediumMax }}
                    >
                        <VStack gap={10}>
                            <VStack gap={6} hAlign="center">
                                <VStack gap={3} hAlign="center">
                                    <Heading level={1} type="display-1" justify="center" textWrap="balance">
                                        장기요양기관 운영, 케어브이 하나로
                                    </Heading>
                                    <div style={{ maxWidth: 680 }}>
                                        <Text
                                            type="large"
                                            color="secondary"
                                            justify="center"
                                            textWrap="balance"
                                            display="block"
                                        >
                                            근무표·휴무 관리부터 월간일정, 전자결재, 공지·채팅, 기관 커뮤니티까지.
                                            관리자는 웹에서, 직원은 앱에서 일합니다.
                                        </Text>
                                    </div>
                                </VStack>

                                <VStack gap={3} hAlign="center">
                                    <HStack gap={3} wrap="wrap" hAlign="center">
                                        <Button
                                            label="30일 무료로 시작하기"
                                            variant="primary"
                                            size="lg"
                                            onClick={() => router.push('/signup')}
                                            endContent={<Icon icon={FiArrowRight} size="sm" color="inherit" />}
                                        />
                                        <Button
                                            label="로그인"
                                            variant="secondary"
                                            size="lg"
                                            onClick={() => router.push('/login')}
                                        />
                                        <Button
                                            label="광장 둘러보기"
                                            variant="ghost"
                                            size="lg"
                                            onClick={() => router.push('/plaza')}
                                        />
                                    </HStack>

                                    {/* 2. 신뢰 시그널 — CTA 바로 아래에서 망설임을 줄인다 */}
                                    <HStack gap={4} wrap="wrap" hAlign="center">
                                        {TRUST_SIGNALS.map((signal) => (
                                            <HStack key={signal} gap={1} vAlign="center">
                                                <Icon icon={FiCheck} size="xsm" color="accent" />
                                                <Text type="supporting" color="secondary">
                                                    {signal}
                                                </Text>
                                            </HStack>
                                        ))}
                                    </HStack>
                                </VStack>
                            </VStack>

                            <DashboardPreview />
                        </VStack>
                    </motion.div>
                </div>
            </Section>

            {/* ── 3~4. 문제 제기 + ROI 근거 ── */}
            <Section variant="muted" padding={0} paddingBlock={10}>
                <div style={container(1100)}>
                    <motion.div {...fadeUp}>
                        <Grid columns={{ minWidth: 320, repeat: 'fit', max: 2 }} gap={8} align="center">
                            <VStack gap={5}>
                                <VStack gap={2}>
                                    <Heading level={2} type="display-2" textWrap="balance">
                                        아직 엑셀과 단톡방으로 기관을 운영하고 계신가요?
                                    </Heading>
                                    <Text type="large" color="secondary" textWrap="balance">
                                        근무표·결재·공지가 흩어져 있으면, 바뀔 때마다 처음부터 다시 맞춰야 합니다.
                                    </Text>
                                </VStack>

                                <VStack gap={3}>
                                    {PROBLEMS.map((problem) => (
                                        <HStack key={problem} gap={2} vAlign="start">
                                            <span style={{ paddingTop: 'var(--spacing-1)' }}>
                                                <Icon icon="close" size="xsm" color="error" />
                                            </span>
                                            <Text color="secondary">{problem}</Text>
                                        </HStack>
                                    ))}
                                </VStack>

                                <Divider />

                                <VStack gap={3}>
                                    <Text weight="semibold">케어브이로 바꾸면</Text>
                                    {AFTER_POINTS.map((point) => (
                                        <HStack key={point} gap={2} vAlign="start">
                                            <span style={{ paddingTop: 'var(--spacing-1)' }}>
                                                <Icon icon={FiCheck} size="xsm" color="accent" />
                                            </span>
                                            <Text color="secondary">{point}</Text>
                                        </HStack>
                                    ))}
                                </VStack>
                            </VStack>

                            <BeforeAfterMock />
                        </Grid>
                    </motion.div>
                </div>
            </Section>

            {/* ── 5. 기능 ── */}
            <Section id="features" variant="transparent" padding={0} paddingBlock={10}>
                <div style={container(1000)}>
                    <VStack gap={8}>
                        <VStack gap={2}>
                            <Heading level={2} type="display-2" textWrap="balance">
                                장기요양기관 운영에 필요한 기능
                            </Heading>
                            <Text type="large" color="secondary">
                                기관 평가 대비까지 고려해 설계했습니다
                            </Text>
                        </VStack>

                        {/* Section의 full-bleed 구분선(음수 마진)이 위 부제와 겹치는 문제가 있어
                            일반 행 + Divider 조합으로 그린다. */}
                        <VStack gap={0}>
                            <Divider />
                            {FEATURES.map((feature) => (
                                <div key={feature.title}>
                                    <div style={{ paddingBlock: 'var(--spacing-5)' }}>
                                        <motion.div {...fadeUp}>
                                            <Grid columns={{ minWidth: 260, repeat: 'fit', max: 2 }} gap={4}>
                                                <Heading level={3} type="display-3">
                                                    {feature.title}
                                                </Heading>
                                                <Text color="secondary">{feature.description}</Text>
                                            </Grid>
                                        </motion.div>
                                    </div>
                                    <Divider />
                                </div>
                            ))}
                        </VStack>
                    </VStack>
                </div>
            </Section>

            {/* ── 6. 워크플로우 데모 ── */}
            <Section id="process" variant="muted" padding={0} paddingBlock={10}>
                <div style={container(1000)}>
                    <VStack gap={8}>
                        <VStack gap={2}>
                            <Heading level={2} type="display-2" textWrap="balance">
                                도입은 4단계면 끝납니다
                            </Heading>
                            <Text type="large" color="secondary">
                                관리자가 먼저 가입하고, 직원이 합류합니다
                            </Text>
                        </VStack>

                        <Grid columns={{ minWidth: 220, repeat: 'fit' }} gap={4}>
                            {PROCESS.map((item) => (
                                <motion.div key={item.step} {...fadeUp} style={{ height: '100%' }}>
                                    <Card padding={5} height="100%">
                                        <VStack gap={3}>
                                            <HStack gap={2} vAlign="center">
                                                <Text type="display-3" weight="bold" color="accent">
                                                    {item.step}
                                                </Text>
                                                <Text type="supporting" color="secondary">
                                                    {item.role}
                                                </Text>
                                            </HStack>
                                            <VStack gap={1}>
                                                <Heading level={3} type="display-3">
                                                    {item.title}
                                                </Heading>
                                                <Text type="supporting" color="secondary">
                                                    {item.description}
                                                </Text>
                                            </VStack>
                                        </VStack>
                                    </Card>
                                </motion.div>
                            ))}
                        </Grid>

                        <VStack gap={3}>
                            <AspectRatio ratio={16 / 9} style={imageClip}>
                                <iframe
                                    style={{ width: '100%', height: '100%', border: 0 }}
                                    src="https://www.youtube.com/embed/x2cJedS6vaU"
                                    title="케어브이 가입 및 승인 절차 안내"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                    allowFullScreen
                                />
                            </AspectRatio>
                            <Text type="supporting" color="secondary" justify="center">
                                가입부터 승인까지 영상으로 확인해보세요
                            </Text>
                        </VStack>
                    </VStack>
                </div>
            </Section>

            {/* ── 7. 실제 화면 ── */}
            <Section variant="transparent" padding={0} paddingBlock={10}>
                <div style={container(1100)}>
                    <VStack gap={6}>
                        <VStack gap={2}>
                            <Heading level={2} type="display-2" textWrap="balance">
                                주요 화면 미리보기
                            </Heading>
                            <Text type="large" color="secondary">
                                근무·결재·소통이 실제로 이렇게 흘러갑니다
                            </Text>
                        </VStack>
                        <Grid columns={{ minWidth: 280, repeat: 'fit' }} gap={4}>
                            {PREVIEWS.map((preview) => (
                                <motion.div key={preview.title} {...fadeUp} style={{ height: '100%' }}>
                                    <VStack gap={3} height="100%">
                                        {preview.mock}
                                        <VStack gap={0.5}>
                                            <Text weight="semibold">{preview.title}</Text>
                                            <Text type="supporting" color="secondary">
                                                {preview.description}
                                            </Text>
                                        </VStack>
                                    </VStack>
                                </motion.div>
                            ))}
                        </Grid>
                    </VStack>
                </div>
            </Section>

            {/* ── 8. 요금제 ── */}
            <Section id="pricing" variant="muted" padding={0} paddingBlock={10}>
                <div style={container(880)}>
                    <VStack gap={8}>
                        <VStack gap={2} hAlign="center">
                            <Heading level={2} type="display-2" justify="center" textWrap="balance">
                                합리적인 요금제
                            </Heading>
                            <Text type="large" color="secondary" justify="center">
                                30일 무료 체험 후 결정하세요
                            </Text>
                        </VStack>

                        <Grid columns={{ minWidth: 280, repeat: 'fit' }} gap={4}>
                            {PLANS.map((plan) => (
                                <Card
                                    key={plan.name}
                                    padding={6}
                                    height="100%"
                                    variant={plan.isRecommended ? 'teal' : 'default'}
                                >
                                    <VStack gap={4} height="100%">
                                        <VStack gap={1}>
                                            <Text type="supporting" color="secondary">
                                                {plan.name}
                                            </Text>
                                            <HStack gap={1} vAlign="end">
                                                <Text type="display-1" weight="bold">
                                                    {plan.price}
                                                </Text>
                                                {plan.priceNote && (
                                                    <Text color="secondary">{plan.priceNote}</Text>
                                                )}
                                            </HStack>
                                        </VStack>

                                        <Text color="secondary">{plan.description}</Text>

                                        <Divider />

                                        <VStack gap={2}>
                                            {plan.features.map((feature) => (
                                                <HStack key={feature} gap={2} vAlign="center">
                                                    <Icon icon={FiCheck} size="sm" color="accent" />
                                                    <Text color="secondary">{feature}</Text>
                                                </HStack>
                                            ))}
                                        </VStack>
                                    </VStack>
                                </Card>
                            ))}
                        </Grid>
                    </VStack>
                </div>
            </Section>

            {/* ── 9. 리스크 완화 + 최종 CTA ── */}
            <Section variant="transparent" padding={0} paddingBlock={10}>
                <div style={container(720)}>
                    <VStack gap={5} hAlign="center">
                        <VStack gap={2} hAlign="center">
                            <Heading level={2} type="display-2" justify="center" textWrap="balance">
                                오늘 가입하고, 이번 달 운영부터 바꿔보세요
                            </Heading>
                            <Text type="large" color="secondary" justify="center" textWrap="balance">
                                결제 수단을 등록하지 않아도 30일 동안 모든 기능을 쓸 수 있습니다.
                            </Text>
                        </VStack>
                        <HStack gap={3} wrap="wrap" hAlign="center">
                            <Button
                                label="30일 무료로 시작하기"
                                variant="primary"
                                size="lg"
                                onClick={() => router.push('/signup')}
                                endContent={<Icon icon={FiArrowRight} size="sm" color="inherit" />}
                            />
                            <Button
                                label="문의하기"
                                variant="secondary"
                                size="lg"
                                href="/contact"
                            />
                        </HStack>
                    </VStack>
                </div>
            </Section>

            {/* ── 더 알아보기 ── */}
            <Section variant="muted" padding={0} paddingBlock={8}>
                <div style={container(1000)}>
                    <Grid columns={{ minWidth: 260, repeat: 'fit' }} gap={4}>
                        {RESOURCES.map((item) => (
                            <ClickableCard
                                key={item.href}
                                label={item.title}
                                href={item.href}
                                padding={5}
                                height="100%"
                            >
                                <VStack gap={2}>
                                    <Heading level={3} type="display-3">
                                        {item.title}
                                    </Heading>
                                    <Text type="supporting" color="secondary">
                                        {item.description}
                                    </Text>
                                </VStack>
                            </ClickableCard>
                        ))}
                    </Grid>
                </div>
            </Section>

            {/* ── 푸터 ── */}
            <Section id="contact" variant="transparent" padding={0} paddingBlock={8} dividers={['top']}>
                <div style={container()}>
                    <VStack gap={6}>
                        <Grid columns={{ minWidth: 260, repeat: 'fit' }} gap={6}>
                            <VStack gap={3}>
                                <Image
                                    src="/images/logo-text-dark.png"
                                    alt="케어브이"
                                    width={120}
                                    height={40}
                                />
                                <Text type="supporting" color="secondary">
                                    장기요양기관을 위한 올인원 운영 플랫폼
                                </Text>
                            </VStack>

                            <VStack gap={2}>
                                <Text weight="semibold">회사 정보</Text>
                                <Text type="supporting" color="secondary">회사명: silverithm</Text>
                                <Text type="supporting" color="secondary">대표자: 김준형</Text>
                                <Text type="supporting" color="secondary">사업자등록번호: 107-21-26475</Text>
                                <Text type="supporting" color="secondary">주소: 서울특별시 신림동 1547-10</Text>
                            </VStack>

                            <VStack gap={2}>
                                <Text weight="semibold">연락처</Text>
                                <a
                                    href="mailto:ggprgrkjh2@gmail.com"
                                    style={{ color: 'var(--color-text-secondary)', textDecoration: 'none' }}
                                >
                                    <Text type="supporting" color="inherit">ggprgrkjh2@gmail.com</Text>
                                </a>
                                <a
                                    href="tel:010-4549-2094"
                                    style={{ color: 'var(--color-text-secondary)', textDecoration: 'none' }}
                                >
                                    <Text type="supporting" color="inherit">010-4549-2094</Text>
                                </a>
                            </VStack>
                        </Grid>

                        <Divider />

                        <div className="carev-admin-footer-row">
                            <Text type="supporting" color="secondary">
                                © 2025 케어브이. 모든 권리 보유.
                            </Text>
                            <HStack gap={3} vAlign="center">
                                <a
                                    href="https://plip.kr/pcc/d9017bf3-00dc-4f8f-b750-f7668e2b7bb7/privacy/1.html"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color: 'var(--color-text-accent)', textDecoration: 'none' }}
                                >
                                    <Text type="supporting" color="inherit">개인정보처리방침</Text>
                                </a>
                                <Text type="supporting" color="disabled">|</Text>
                                <a
                                    href="https://relic-baboon-412.notion.site/silverithm-13c766a8bb468082b91ddbd2dd6ce45d"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color: 'var(--color-text-accent)', textDecoration: 'none' }}
                                >
                                    <Text type="supporting" color="inherit">이용약관</Text>
                                </a>
                            </HStack>
                        </div>
                    </VStack>
                </div>
            </Section>
        </main>
    );
}
