'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Section } from '@astryxdesign/core/Section';
import { Card } from '@astryxdesign/core/Card';
import { Grid } from '@astryxdesign/core/Grid';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Heading } from '@astryxdesign/core/Heading';
import { Button } from '@astryxdesign/core/Button';
import { Icon } from '@astryxdesign/core/Icon';
import { Badge } from '@astryxdesign/core/Badge';
import Navbar from '@/components/Navbar';
import { duration } from '@/theme/motion';

interface GuideStep {
    title: string;
    items: string[];
}

interface GuideSection {
    heading: string;
    description: string;
    steps: GuideStep[];
}

/**
 * 메뉴 이름은 관리자 페이지의 실제 탭 이름(근무조정, 월간일정, 공지사항, 채팅, 전자결재,
 * 회원관리)을 그대로 쓴다. 실재하지 않는 메뉴명을 안내하지 않는다.
 */
const ADMIN_GUIDE: GuideSection[] = [
    {
        heading: '관리자 시작하기',
        description: '기관 계정을 만들고 직원을 합류시키는 첫 단계입니다.',
        steps: [
            {
                title: '1. 회원가입',
                items: [
                    '웹에서 관리자 회원가입을 시작합니다',
                    '이메일과 비밀번호(8자 이상)를 입력합니다',
                    '이름, 기관명, 기관 주소를 입력합니다',
                    '개인정보 수집 및 이용에 동의하면 가입이 완료됩니다',
                ],
            },
            {
                title: '2. 직원 합류',
                items: [
                    '직원에게 앱 설치를 안내합니다',
                    '직원이 앱에서 소속 기관을 선택해 가입을 요청합니다',
                    '관리자 페이지에서 요청을 확인하고 승인합니다',
                    '승인된 직원은 바로 앱에 로그인할 수 있습니다',
                ],
            },
        ],
    },
    {
        heading: '휴무 요청 처리하기',
        description: '근무조정 메뉴에서 직원의 휴무 신청을 확인하고 처리합니다.',
        steps: [
            {
                title: '신청 확인과 처리',
                items: [
                    '근무조정 메뉴에서 대기 중인 신청을 확인합니다',
                    '신청한 날짜와 사유를 확인합니다',
                    '승인 또는 반려를 선택합니다',
                    '여러 건은 일괄 승인·반려로 한 번에 처리할 수 있습니다',
                ],
            },
            {
                title: '일정 확인',
                items: [
                    '월간일정에서 한 달치 일정을 달력으로 봅니다',
                    '날짜별 휴무 인원을 확인해 일정이 겹치지 않게 조율합니다',
                ],
            },
        ],
    },
    {
        heading: '그 밖의 메뉴',
        description: '휴무 관리 외에 기관 운영에 쓰는 메뉴입니다.',
        steps: [
            {
                title: '소통과 문서',
                items: [
                    '공지사항 — 구성원 전체에게 알릴 내용을 등록합니다',
                    '채팅 — 구성원 간 메시지를 주고받습니다',
                    '전자결재 — 결재선을 지정해 문서 승인을 받습니다',
                    '회원관리 — 구성원 정보와 가입 요청을 관리합니다',
                ],
            },
        ],
    },
];

const EMPLOYEE_GUIDE: GuideSection[] = [
    {
        heading: '직원 시작하기',
        description: '앱을 설치하고 소속 기관에 합류합니다.',
        steps: [
            {
                title: '1. 가입 요청',
                items: [
                    'App Store 또는 Google Play에서 케어브이 앱을 설치합니다',
                    '앱에서 소속 기관을 선택합니다',
                    '가입 요청을 제출합니다',
                    '관리자가 승인할 때까지 기다립니다',
                ],
            },
            {
                title: '2. 로그인',
                items: [
                    '관리자 승인이 완료되면 앱에 로그인합니다',
                    '알림을 허용하면 처리 결과를 놓치지 않습니다',
                ],
            },
        ],
    },
    {
        heading: '휴무 신청하기',
        description: '앱 또는 웹에서 휴무를 신청하고 결과를 확인합니다.',
        steps: [
            {
                title: '신청 절차',
                items: [
                    '휴무 신청 메뉴를 엽니다',
                    '휴무 유형을 고릅니다 — 연차, 오전 반차, 오후 반차, 필수 휴무',
                    '날짜를 선택합니다',
                    '사유를 입력하고 제출합니다',
                ],
            },
            {
                title: '결과 확인',
                items: [
                    '제출한 신청은 관리자가 처리하기 전까지 대기 상태입니다',
                    '승인되면 일정에 반영됩니다',
                    '반려된 경우 사유를 확인하고 다시 신청할 수 있습니다',
                ],
            },
        ],
    },
    {
        heading: '일정 확인하기',
        description: '내 근무와 동료 일정을 확인합니다.',
        steps: [
            {
                title: '캘린더 보기',
                items: [
                    '달력에서 내 휴무 일정을 확인합니다',
                    '같은 기관 구성원의 휴무 일정도 함께 볼 수 있습니다',
                    '공지사항에서 기관의 알림을 확인합니다',
                ],
            },
        ],
    },
];

export default function GuidePage() {
    const [activeTab, setActiveTab] = useState('admin');
    const sections = activeTab === 'admin' ? ADMIN_GUIDE : EMPLOYEE_GUIDE;

    return (
        <main style={{ minHeight: '100vh', background: 'var(--color-background-surface)' }}>
            <Navbar />

            {/* 헤더 */}
            <Section variant="transparent" padding={0} paddingBlock={10}>
                <div style={{ width: '100%', maxWidth: 960, margin: '0 auto' }}>
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: duration.mediumMax }}
                    >
                        <VStack gap={5} hAlign="center">
                            <VStack gap={2} hAlign="center">
                                <Heading level={1} type="display-1" justify="center">
                                    케어브이 사용 가이드
                                </Heading>
                                <Text type="large" color="secondary" justify="center">
                                    장기요양기관 관리자와 직원을 위한 사용 방법
                                </Text>
                            </VStack>

                            <SegmentedControl
                                value={activeTab}
                                onChange={(value) => setActiveTab(value)}
                                label="가이드 종류"
                            >
                                <SegmentedControlItem value="admin" label="관리자 가이드" />
                                <SegmentedControlItem value="employee" label="직원 가이드" />
                            </SegmentedControl>
                        </VStack>
                    </motion.div>
                </div>
            </Section>

            {/* 본문 */}
            <Section variant="transparent" padding={0} paddingBlock={4}>
                <div style={{ width: '100%', maxWidth: 960, margin: '0 auto' }}>
                    <VStack gap={10}>
                        {sections.map((section, sectionIndex) => (
                            <motion.div
                                key={`${activeTab}-${section.heading}`}
                                initial={{ opacity: 0, y: 16 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: '-80px' }}
                                transition={{ duration: duration.medium, delay: sectionIndex * 0.05 }}
                            >
                                <VStack gap={5}>
                                    <VStack gap={2}>
                                        <HStack gap={2} vAlign="center" wrap="wrap">
                                            <Heading level={2} type="display-2">
                                                {section.heading}
                                            </Heading>
                                            <Badge
                                                variant="teal"
                                                label={activeTab === 'admin' ? '관리자' : '직원'}
                                            />
                                        </HStack>
                                        <Text color="secondary">{section.description}</Text>
                                    </VStack>

                                    <Grid columns={{ minWidth: 320, repeat: 'fit' }} gap={5}>
                                        {section.steps.map((step) => (
                                            <Card key={step.title} padding={6} height="100%">
                                                <VStack gap={4}>
                                                    <Heading level={3} type="display-3">
                                                        {step.title}
                                                    </Heading>
                                                    <VStack gap={3}>
                                                        {step.items.map((item) => (
                                                            <HStack key={item} gap={2} vAlign="start">
                                                                <span style={{ paddingTop: 'var(--spacing-0-5)' }}>
                                                                    <Icon icon="check" size="sm" color="accent" />
                                                                </span>
                                                                <Text color="secondary">{item}</Text>
                                                            </HStack>
                                                        ))}
                                                    </VStack>
                                                </VStack>
                                            </Card>
                                        ))}
                                    </Grid>
                                </VStack>
                            </motion.div>
                        ))}
                    </VStack>
                </div>
            </Section>

            {/* CTA */}
            <Section variant="transparent" padding={0} paddingBlock={10}>
                <div style={{ width: '100%', maxWidth: 960, margin: '0 auto' }}>
                    <Card padding={8} variant="teal">
                        <VStack gap={4} hAlign="center">
                            <VStack gap={2} hAlign="center">
                                <Heading level={2} type="display-2" justify="center">
                                    아직 궁금한 점이 있으신가요?
                                </Heading>
                                <Text color="secondary" justify="center">
                                    자주 묻는 질문을 확인하거나 이메일로 문의해주세요
                                </Text>
                            </VStack>
                            <HStack gap={3} hAlign="center" wrap="wrap">
                                <Button label="자주 묻는 질문" href="/faq" variant="primary" size="lg" />
                                <Button
                                    label="문의하기"
                                    href="/contact"
                                    variant="secondary"
                                    size="lg"
                                />
                            </HStack>
                        </VStack>
                    </Card>
                </div>
            </Section>
        </main>
    );
}
