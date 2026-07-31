'use client';

/**
 * 랜딩 페이지.
 *
 * 구조는 엔터프라이즈 B2B SaaS 랜딩의 표준 뼈대를 따른다:
 *   1) 5초 가치 제안  2) 신뢰 시그널  3) 문제 제기  4) ROI/비교 근거
 *   5) 기능  6) 워크플로우 데모  7) 사회적 증거  8) 요금제  9) 리스크 완화 + CTA
 *
 * 이전 구조는 "제목 + 카드 그리드"의 반복이라 구매 근거(문제·ROI)가 빠져 있었다.
 * 문구와 수치는 실제 보유 자산(스토어 출시, 결제 수단, 마케팅 이미지)에서만 가져온다.
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

// AspectRatio에 objectFit/radius prop이 없어 인라인으로 처리한다
// (astryx gallery-hero 템플릿도 동일, 업스트림 이슈 #2582).
const fillImage: React.CSSProperties = { objectFit: 'cover' };
const imageClip: React.CSSProperties = {
    borderRadius: 'var(--radius-container)',
    overflow: 'hidden',
};

const APP_STORE_LINK =
    'https://apps.apple.com/kr/app/%EC%BC%80%EC%96%B4%EB%B8%8C%EC%9D%B4/id6747028185';
const GOOGLE_PLAY_LINK =
    'https://play.google.com/store/apps/details?id=com.silverithm.carev.app';

/** 실제로 확인 가능한 사실만 신뢰 시그널로 쓴다. */
const TRUST_SIGNALS = [
    'iOS · Android 앱 정식 출시',
    '토스페이먼츠 안전 결제',
    '결제 수단 등록 없이 30일 무료',
];

/** 도입 전 현실 — 페인포인트 */
const PROBLEMS = [
    '엑셀과 종이로 근무표를 만들고, 수정될 때마다 처음부터 다시 그립니다.',
    '휴무 신청이 전화·메신저·구두로 흩어져 누가 언제 쉬는지 파악이 어렵습니다.',
    '같은 날에 휴무가 몰린 걸 뒤늦게 발견해 급하게 인력을 다시 맞춥니다.',
];

const FEATURES = [
    {
        title: '장기요양기관 맞춤 일정 관리',
        description:
            '요양보호사, 사회복지사, 간호조무사, 물리치료사 등 전 직원의 휴무 현황을 캘린더로 한눈에 파악하고 관리합니다.',
    },
    {
        title: '시설급여·재가급여 통합 관리',
        description:
            '주간보호센터, 요양원, 재가노인복지센터 등 모든 장기요양기관의 휴무 요청을 실시간으로 확인하고 승인 처리합니다.',
    },
    {
        title: '장기요양 인력 기준 충족',
        description:
            '요양보호사, 사회복지사 배치 기준 충족 여부를 실시간으로 확인하여 장기요양기관 평가에 완벽 대비합니다.',
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

const SCREENS = [
    { src: '/images/desigin 3.png', alt: '관리자 전용 페이지에서 휴무를 승인하는 화면' },
    { src: '/images/design 4.png', alt: '직원 전용 앱에서 휴무를 신청하는 화면' },
    { src: '/images/design 5.png', alt: '케어브이 이용 후기' },
];

const PLANS = [
    {
        name: '30일 무료 체험',
        price: '무료',
        priceNote: '',
        description: '결제 수단 등록 없이 30일간 사용해보세요',
        features: ['휴무 신청 및 승인', '직원 등록 및 관리', '일정 캘린더', '이메일 문의 지원'],
        isRecommended: false,
    },
    {
        name: 'Basic 플랜',
        price: '₩9,900',
        priceNote: '/월',
        description: '무료 체험 이후 모든 기능을 계속 이용하세요',
        features: ['휴무 신청 및 승인', '직원 등록 및 관리', '일정 캘린더', '이메일 문의 지원'],
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
                                        근무표 작성, 일주일에서 5분으로
                                    </Heading>
                                    <div style={{ maxWidth: 620 }}>
                                        <Text
                                            type="large"
                                            color="secondary"
                                            justify="center"
                                            textWrap="balance"
                                            display="block"
                                        >
                                            주간보호센터·요양원·재가노인복지센터의 휴무 신청과 승인을 한곳에서.
                                            직원은 앱에서 신청하고, 관리자는 클릭 한 번으로 승인합니다.
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

                            <AspectRatio ratio={1} style={{ ...imageClip, maxWidth: 520, marginInline: 'auto' }}>
                                <Image
                                    src="/images/design 1.png"
                                    alt="주간보호 근무표를 작성하는 케어브이 앱 화면"
                                    fill
                                    sizes="(max-width: 768px) 100vw, 520px"
                                    style={fillImage}
                                    priority
                                />
                            </AspectRatio>
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
                                        아직 엑셀과 전화로 근무표를 맞추고 계신가요?
                                    </Heading>
                                    <Text type="large" color="secondary" textWrap="balance">
                                        수기 근무표는 한 번 바뀔 때마다 처음부터 다시 그려야 합니다.
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

                                <VStack gap={2}>
                                    <Text weight="semibold">케어브이로 바꾸면</Text>
                                    <HStack gap={2} vAlign="start">
                                        <span style={{ paddingTop: 'var(--spacing-1)' }}>
                                            <Icon icon={FiCheck} size="xsm" color="accent" />
                                        </span>
                                        <Text color="secondary">
                                            신청부터 승인까지 한 화면에서 처리되고, 변경 사항은 캘린더에 바로
                                            반영됩니다.
                                        </Text>
                                    </HStack>
                                </VStack>
                            </VStack>

                            <AspectRatio ratio={1} style={imageClip}>
                                <Image
                                    src="/images/desigin 2.png"
                                    alt="수기 작성은 일주일 이상, 케어브이는 5분이 걸린다는 비교 이미지"
                                    fill
                                    sizes="(max-width: 768px) 100vw, 500px"
                                    style={fillImage}
                                />
                            </AspectRatio>
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

                        <VStack gap={0}>
                            {FEATURES.map((feature, index) => (
                                <motion.div key={feature.title} {...fadeUp}>
                                    <Section
                                        variant="transparent"
                                        padding={0}
                                        paddingBlock={5}
                                        dividers={index === 0 ? ['top', 'bottom'] : ['bottom']}
                                    >
                                        <Grid columns={{ minWidth: 260, repeat: 'fit', max: 2 }} gap={4}>
                                            <Heading level={3} type="display-3">
                                                {feature.title}
                                            </Heading>
                                            <Text color="secondary">{feature.description}</Text>
                                        </Grid>
                                    </Section>
                                </motion.div>
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
                        <Heading level={2} type="display-2" textWrap="balance">
                            실제 화면 살펴보기
                        </Heading>
                        <Grid columns={{ minWidth: 260, repeat: 'fit' }} gap={4}>
                            {SCREENS.map((image) => (
                                <motion.div key={image.src} {...fadeUp}>
                                    <AspectRatio ratio={1} style={imageClip}>
                                        <Image
                                            src={image.src}
                                            alt={image.alt}
                                            fill
                                            sizes="(max-width: 768px) 100vw, 360px"
                                            style={fillImage}
                                        />
                                    </AspectRatio>
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
                                오늘 가입하고, 이번 달 근무표부터 바꿔보세요
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
                                    장기요양기관을 위한 스마트 근무 관리 솔루션
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
