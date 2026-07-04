'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import Navbar from '@/components/Navbar';
import { Text, Heading } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { Icon } from '@astryxdesign/core/Icon';
import { HStack, VStack } from '@astryxdesign/core/Stack';

interface FAQItem {
    question: string;
    answer: string;
    category: string;
}

export default function FAQPage() {
    const [activeIndex, setActiveIndex] = useState<number | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string>('all');

    const categories = [
        { id: 'all', name: '전체' },
        { id: 'service', name: '서비스 이용' },
        { id: 'schedule', name: '근무표 관리' },
        { id: 'vacation', name: '휴무 관리' },
        { id: 'pricing', name: '요금제' },
        { id: 'tech', name: '기술 지원' },
    ];

    const faqData: FAQItem[] = [
        {
            question: "모바일에서도 사용할 수 있나요?",
            answer: "물론입니다! iOS와 Android 전용 앱을 제공하며, 앱스토어와 구글 플레이에서 '케어브이'로 검색하여 다운로드할 수 있습니다. 모바일 웹브라우저에서도 완벽하게 동작하므로 앱 설치 없이도 사용 가능합니다.",
            category: "service"
        },
        {
            question: "근무표는 얼마나 미리 작성할 수 있나요?",
            answer: "최대 3개월 후까지 근무표를 미리 작성할 수 있습니다. 월간, 주간, 일간 단위로 유연하게 작성 가능하며, 작성한 근무표는 언제든지 수정할 수 있습니다. 과거 근무표는 2년간 보관되어 언제든 조회 가능합니다.",
            category: "schedule"
        },
        {
            question: "휴무 신청은 어떻게 하나요?",
            answer: "직원은 모바일 앱이나 웹에서 '휴무 신청' 메뉴를 통해 간단히 신청할 수 있습니다. 연차, 반차 등 다양한 휴무 유형을 선택할 수 있으며, 관리자가 승인하면 자동으로 근무표에 반영됩니다. 팀 캘린더에서 동료들의 휴무 일정도 확인 가능합니다.",
            category: "vacation"
        },
        {
            question: "데이터는 안전하게 보관되나요?",
            answer: "모든 데이터는 클라우드에 암호화되어 안전하게 저장됩니다. 매일 자동 백업되며, SSL 보안 프로토콜을 사용하여 모든 통신이 암호화됩니다.",
            category: "tech"
        },
        {
            question: "무료 체험 기간이 있나요?",
            answer: "프리미엄 기능은 30일 무료 체험이 가능합니다. 신용카드 등록 없이 바로 시작할 수 있으며, 체험 기간 종료 후 자동 결제되지 않으니 안심하고 사용해보세요.",
            category: "pricing"
        },
        {
            question: "고객 지원은 어떻게 받나요?",
            answer: "평일 09:00-18:00 실시간 채팅 상담을 제공하며, ggprgrkjh@naver.com로 이메일 문의도 가능합니다. 프리미엄 고객에게는 전담 매니저와 우선 지원 서비스를 제공합니다. 자세한 사용 가이드와 동영상 튜토리얼도 준비되어 있습니다.",
            category: "service"
        }
    ];

    const filteredFAQ = selectedCategory === 'all'
        ? faqData
        : faqData.filter(item => item.category === selectedCategory);

    return (
        <main
            style={{
                minHeight: '100vh',
                background: 'linear-gradient(180deg, #0f1115 0%, #16181d 55%, #0f1115 100%)',
                color: '#fff',
            }}
        >
            <Navbar />

            {/* 헤더 섹션 */}
            <section style={{ position: 'relative', padding: '128px 16px 64px' }}>
                <div style={{ maxWidth: 1152, margin: '0 auto' }}>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        style={{ textAlign: 'center', marginBottom: 'var(--spacing-12)' }}
                    >
                        <Heading
                            level={1}
                            type="display-1"
                            color="inherit"
                            style={{
                                marginBottom: 'var(--spacing-6)',
                                fontWeight: 'var(--font-weight-bold)',
                                backgroundImage: 'linear-gradient(to right, #ffffff, #a5e3d6)',
                                WebkitBackgroundClip: 'text',
                                backgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                            }}
                        >
                            자주 묻는 질문
                        </Heading>
                        <Text
                            type="large"
                            color="inherit"
                            display="block"
                            style={{ color: 'rgba(219, 234, 254, 0.9)', maxWidth: 768, margin: '0 auto' }}
                        >
                            케어브이 사용에 대한 궁금증을 해결해드립니다
                        </Text>
                    </motion.div>

                    {/* 카테고리 필터 */}
                    <HStack wrap="wrap" hAlign="center" gap={3}>
                        {categories.map((category) => (
                            <Button
                                key={category.id}
                                label={category.name}
                                onClick={() => setSelectedCategory(category.id)}
                                variant={selectedCategory === category.id ? 'primary' : 'secondary'}
                            />
                        ))}
                    </HStack>
                </div>
            </section>

            {/* FAQ 리스트 */}
            <section style={{ padding: '64px 16px' }}>
                <div style={{ maxWidth: 896, margin: '0 auto' }}>
                    <VStack gap={4}>
                        {filteredFAQ.map((item, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: index * 0.05 }}
                            >
                                <div
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.1)',
                                        backdropFilter: 'blur(16px)',
                                        WebkitBackdropFilter: 'blur(16px)',
                                        borderRadius: 'var(--radius-container)',
                                        border: '1px solid rgba(96, 165, 250, 0.2)',
                                        overflow: 'hidden',
                                    }}
                                >
                                    <button
                                        className="carev-faq-trigger"
                                        style={{
                                            width: '100%',
                                            padding: '20px 24px',
                                            textAlign: 'left',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            background: 'transparent',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: 'inherit',
                                        }}
                                        onClick={() => setActiveIndex(activeIndex === index ? null : index)}
                                    >
                                        <div style={{ flex: 1 }}>
                                            <Text
                                                type="large"
                                                weight="semibold"
                                                color="inherit"
                                                style={{ color: '#fff', paddingRight: 'var(--spacing-4)' }}
                                            >
                                                {item.question}
                                            </Text>
                                        </div>
                                        <span
                                            style={{
                                                display: 'inline-flex',
                                                color: 'var(--color-text-blue)',
                                                transform: activeIndex === index ? 'rotate(180deg)' : 'rotate(0deg)',
                                                transition: 'transform 200ms ease',
                                            }}
                                        >
                                            <Icon icon="chevronDown" size="md" color="inherit" />
                                        </span>
                                    </button>
                                    {activeIndex === index && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            transition={{ duration: 0.3 }}
                                            style={{ padding: '0 24px 20px' }}
                                        >
                                            <Text
                                                color="inherit"
                                                display="block"
                                                style={{ color: 'rgba(219, 234, 254, 0.8)', lineHeight: 1.625 }}
                                            >
                                                {item.answer}
                                            </Text>
                                        </motion.div>
                                    )}
                                </div>
                            </motion.div>
                        ))}
                    </VStack>
                </div>
            </section>

            {/* CTA 섹션 */}
            <section style={{ padding: '80px 16px' }}>
                <div style={{ maxWidth: 896, margin: '0 auto', textAlign: 'center' }}>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        style={{
                            background: 'linear-gradient(to right, #2563eb, #4f46e5)',
                            borderRadius: 'var(--radius-chat)',
                            padding: 'var(--spacing-12)',
                        }}
                    >
                        <Heading
                            level={2}
                            type="display-2"
                            color="inherit"
                            style={{ marginBottom: 'var(--spacing-4)', fontWeight: 'var(--font-weight-bold)', color: '#fff' }}
                        >
                            더 궁금하신 점이 있으신가요?
                        </Heading>
                        <Text
                            type="large"
                            color="inherit"
                            display="block"
                            style={{ marginBottom: 'var(--spacing-8)', color: 'rgba(219, 234, 254, 1)' }}
                        >
                            고객센터에서 친절하게 답변해드립니다
                        </Text>
                        <HStack wrap="wrap" hAlign="center" gap={4}>
                            <Button
                                label="이메일 문의하기"
                                href="mailto:ggprgrkjh@naver.com"
                                variant="secondary"
                                size="lg"
                            />
                            <Button
                                label="카카오톡 실시간 상담"
                                href="https://open.kakao.com/o/gvK6Okag"
                                target="_blank"
                                rel="noopener noreferrer"
                                variant="ghost"
                                size="lg"
                            />
                        </HStack>
                    </motion.div>
                </div>
            </section>
        </main>
    );
}
