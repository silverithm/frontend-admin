'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Section } from '@astryxdesign/core/Section';
import { Card } from '@astryxdesign/core/Card';
import { Collapsible, CollapsibleGroup } from '@astryxdesign/core/Collapsible';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import Navbar from '@/components/Navbar';
import { duration } from '@/theme/motion';

interface FAQItem {
    question: string;
    answer: string;
    category: string;
}

const CATEGORIES = [
    { id: 'all', name: '전체' },
    { id: 'start', name: '시작하기' },
    { id: 'vacation', name: '휴무 관리' },
    { id: 'pricing', name: '요금·결제' },
];

/**
 * 답변은 실제 구현으로 확인된 내용만 담는다.
 * 보관 기간·백업 주기·상담 운영시간처럼 근거를 확인하지 못한 약속은 싣지 않는다.
 */
const FAQ_DATA: FAQItem[] = [
    {
        question: '관리자와 직원은 각각 어떻게 가입하나요?',
        answer:
            '먼저 기관 관리자가 웹에서 기관 정보(기관명, 주소, 담당자)를 입력해 회원가입합니다. 이후 직원이 모바일 앱에서 소속 기관을 선택해 가입을 요청하면, 관리자가 관리자 페이지에서 요청을 확인하고 승인합니다. 승인된 직원은 바로 앱에 로그인할 수 있습니다.',
        category: 'start',
    },
    {
        question: '모바일에서도 사용할 수 있나요?',
        answer:
            'iOS와 Android 앱을 제공합니다. App Store와 Google Play에서 내려받을 수 있고, 모바일 웹브라우저에서도 이용할 수 있습니다.',
        category: 'start',
    },
    {
        question: '휴무 신청은 어떻게 하나요?',
        answer:
            '직원이 앱 또는 웹의 휴무 신청 메뉴에서 신청합니다. 휴무 유형은 연차, 오전 반차, 오후 반차, 필수 휴무 중에서 선택하고 날짜와 사유를 입력합니다. 관리자가 승인하면 일정에 반영됩니다.',
        category: 'vacation',
    },
    {
        question: '관리자는 휴무 요청을 어디서 처리하나요?',
        answer:
            '관리자 페이지의 근무조정 메뉴에서 신청 내역을 확인하고 승인 또는 반려할 수 있습니다. 여러 건을 한 번에 처리하는 일괄 승인·반려도 지원합니다.',
        category: 'vacation',
    },
    {
        question: '동료의 휴무 일정도 볼 수 있나요?',
        answer:
            '휴무 캘린더에서 같은 기관 구성원의 휴무 일정을 함께 확인할 수 있습니다. 날짜별 휴무 인원을 볼 수 있어 일정이 겹치지 않게 조율하는 데 활용할 수 있습니다.',
        category: 'vacation',
    },
    {
        question: '무료로 먼저 사용해볼 수 있나요?',
        answer:
            '30일 무료 체험을 제공합니다. 결제 수단을 등록하지 않아도 바로 시작할 수 있고, 체험 기간이 끝나면 Basic 플랜으로 전환해 계속 이용할 수 있습니다.',
        category: 'pricing',
    },
    {
        question: '결제는 어떻게 이뤄지나요?',
        answer:
            '토스페이먼츠를 통해 결제되며 월간 또는 연간 주기를 선택할 수 있습니다. 구독은 해지하지 않으면 주기에 맞춰 자동 갱신됩니다.',
        category: 'pricing',
    },
    {
        question: '문의는 어디로 하나요?',
        answer: '홈페이지의 문의하기에서 남겨주시거나, ggprgrkjh2@gmail.com으로 메일을 보내주시면 확인 후 답변드립니다.',
        category: 'start',
    },
];

export default function FAQPage() {
    const [selectedCategory, setSelectedCategory] = useState<string>('all');

    const filteredFAQ =
        selectedCategory === 'all'
            ? FAQ_DATA
            : FAQ_DATA.filter((item) => item.category === selectedCategory);

    return (
        <main style={{ minHeight: '100vh', background: 'var(--color-background-surface)' }}>
            <Navbar />

            {/* 헤더 */}
            <Section variant="transparent" padding={0} paddingBlock={10}>
                <div style={{ width: '100%', maxWidth: 800, margin: '0 auto' }}>
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: duration.mediumMax }}
                    >
                        <VStack gap={5} hAlign="center">
                            <VStack gap={2} hAlign="center">
                                <Heading level={1} type="display-1" justify="center">
                                    자주 묻는 질문
                                </Heading>
                                <Text type="large" color="secondary" justify="center">
                                    케어브이 사용에 대한 궁금증을 해결해드립니다
                                </Text>
                            </VStack>

                            <SegmentedControl
                                value={selectedCategory}
                                onChange={(value) => setSelectedCategory(value)}
                                label="질문 분류"
                            >
                                {CATEGORIES.map((category) => (
                                    <SegmentedControlItem
                                        key={category.id}
                                        value={category.id}
                                        label={category.name}
                                    />
                                ))}
                            </SegmentedControl>
                        </VStack>
                    </motion.div>
                </div>
            </Section>

            {/* 목록 */}
            <Section variant="transparent" padding={0} paddingBlock={6}>
                <div style={{ width: '100%', maxWidth: 800, margin: '0 auto' }}>
                    {filteredFAQ.length === 0 ? (
                        <EmptyState
                            title="해당 분류의 질문이 없습니다"
                            description="다른 분류를 선택해보세요."
                        />
                    ) : (
                        <CollapsibleGroup type="single">
                            <VStack gap={2}>
                                {filteredFAQ.map((item) => (
                                    <Section key={item.question}>
                                        <Collapsible
                                            value={item.question}
                                            defaultIsOpen={false}
                                            trigger={item.question}
                                        >
                                            <Text color="secondary">{item.answer}</Text>
                                        </Collapsible>
                                    </Section>
                                ))}
                            </VStack>
                        </CollapsibleGroup>
                    )}
                </div>
            </Section>

            {/* 문의 CTA */}
            <Section variant="transparent" padding={0} paddingBlock={10}>
                <div style={{ width: '100%', maxWidth: 800, margin: '0 auto' }}>
                    <Card padding={8} variant="teal">
                        <VStack gap={4} hAlign="center">
                            <VStack gap={2} hAlign="center">
                                <Heading level={2} type="display-2" justify="center">
                                    더 궁금하신 점이 있으신가요?
                                </Heading>
                                <Text color="secondary" justify="center">
                                    이메일로 문의를 보내주시면 확인 후 답변드립니다
                                </Text>
                            </VStack>
                            <HStack gap={3} hAlign="center" wrap="wrap">
                                <Button
                                    label="문의하기"
                                    href="/contact"
                                    variant="primary"
                                    size="lg"
                                />
                                <Button
                                    label="사용 가이드 보기"
                                    href="/guide"
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
