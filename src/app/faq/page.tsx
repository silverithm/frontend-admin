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
import { FAQ_CATEGORIES as CATEGORIES, FAQ_DATA } from '@/lib/faqData';
import { duration } from '@/theme/motion';

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
