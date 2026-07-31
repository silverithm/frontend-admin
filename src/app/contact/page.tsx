'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Section } from '@astryxdesign/core/Section';
import { Card } from '@astryxdesign/core/Card';
import { Grid } from '@astryxdesign/core/Grid';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { TextInput } from '@astryxdesign/core/TextInput';
import { TextArea } from '@astryxdesign/core/TextArea';
import { Selector } from '@astryxdesign/core/Selector';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { Banner } from '@astryxdesign/core/Banner';
import { Divider } from '@astryxdesign/core/Divider';
import { Link } from '@astryxdesign/core/Link';
import Navbar from '@/components/Navbar';
import { duration } from '@/theme/motion';

const CONTACT_EMAIL = 'ggprgrkjh2@gmail.com';

const INQUIRY_OPTIONS = [
    { value: '도입 문의', label: '도입 문의' },
    { value: '기능 문의', label: '기능 문의' },
    { value: '요금 문의', label: '요금 문의' },
    { value: '기타', label: '기타' },
];

export default function ContactPage() {
    const [form, setForm] = useState({
        name: '',
        email: '',
        organization: '',
        phone: '',
        inquiryType: '도입 문의',
        message: '',
    });
    const [privacyAgreed, setPrivacyAgreed] = useState(false);
    const [error, setError] = useState('');
    const [isSubmitted, setIsSubmitted] = useState(false);

    const update = (key: keyof typeof form) => (value: string) =>
        setForm((prev) => ({ ...prev, [key]: value }));

    /**
     * 입력값을 담아 메일 작성 창을 연다.
     * 서버 발송 설정(SMTP 자격증명) 없이 바로 동작하고, 보낸 메일은
     * 방문자 본인의 메일함에도 남는다.
     */
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
            setError('이름, 이메일, 문의 내용을 모두 입력해주세요.');
            return;
        }
        if (!privacyAgreed) {
            setError('개인정보 수집 및 이용에 동의해주세요.');
            return;
        }

        const body = [
            `이름: ${form.name}`,
            `이메일: ${form.email}`,
            `기관명: ${form.organization || '-'}`,
            `연락처: ${form.phone || '-'}`,
            `문의 유형: ${form.inquiryType}`,
            '',
            form.message,
        ].join('\n');

        const subject = `[케어브이 문의] ${form.inquiryType} - ${form.name}`;
        window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
            subject,
        )}&body=${encodeURIComponent(body)}`;

        setIsSubmitted(true);
    };

    return (
        <main style={{ minHeight: '100vh', background: 'var(--color-background-surface)' }}>
            <Navbar />

            <Section variant="transparent" padding={0} paddingBlock={10}>
                <div style={{ width: '100%', maxWidth: 880, margin: '0 auto' }}>
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: duration.mediumMax }}
                    >
                        <VStack gap={8}>
                            <VStack gap={2} hAlign="center">
                                <Heading level={1} type="display-1" justify="center" textWrap="balance">
                                    문의하기
                                </Heading>
                                <Text type="large" color="secondary" justify="center" textWrap="balance">
                                    도입 상담부터 기능 문의까지, 남겨주시면 확인 후 답변드립니다
                                </Text>
                            </VStack>

                            {isSubmitted ? (
                                <Card padding={8}>
                                    <VStack gap={4} hAlign="center">
                                        <Banner
                                            status="info"
                                            title="메일 작성 창이 열렸습니다"
                                            description={`내용이 채워진 메일을 확인하시고 보내기를 눌러주세요. 창이 열리지 않았다면 ${CONTACT_EMAIL}으로 보내주시면 됩니다.`}
                                        />
                                        <HStack gap={2} hAlign="center" wrap="wrap">
                                            <Button
                                                label="다시 작성하기"
                                                variant="secondary"
                                                onClick={() => setIsSubmitted(false)}
                                            />
                                            <Button label="홈으로" variant="ghost" href="/" />
                                        </HStack>
                                    </VStack>
                                </Card>
                            ) : (
                                <Grid columns={{ minWidth: 260, repeat: 'fit', max: 2 }} gap={6} align="start">
                                    <Card padding={6}>
                                        <form onSubmit={handleSubmit}>
                                            <VStack gap={4}>
                                                <TextInput
                                                    label="이름"
                                                    type="text"
                                                    value={form.name}
                                                    onChange={update('name')}
                                                    placeholder="담당자 이름"
                                                    htmlName="name"
                                                    isRequired
                                                />
                                                <TextInput
                                                    label="이메일"
                                                    type="email"
                                                    value={form.email}
                                                    onChange={update('email')}
                                                    placeholder="답변받으실 이메일"
                                                    htmlName="email"
                                                    isRequired
                                                />
                                                <TextInput
                                                    label="기관명"
                                                    type="text"
                                                    value={form.organization}
                                                    onChange={update('organization')}
                                                    placeholder="예: OO주간보호센터"
                                                    htmlName="organization"
                                                />
                                                <TextInput
                                                    label="연락처"
                                                    type="text"
                                                    value={form.phone}
                                                    onChange={update('phone')}
                                                    placeholder="010-0000-0000"
                                                    htmlName="phone"
                                                />
                                                <Selector
                                                    label="문의 유형"
                                                    options={INQUIRY_OPTIONS}
                                                    value={form.inquiryType}
                                                    onChange={update('inquiryType')}
                                                />
                                                <TextArea
                                                    label="문의 내용"
                                                    value={form.message}
                                                    onChange={update('message')}
                                                    placeholder="궁금하신 내용을 자유롭게 남겨주세요"
                                                    rows={6}
                                                    isRequired
                                                />

                                                <Divider />

                                                <CheckboxInput
                                                    label="개인정보 수집 및 이용에 동의합니다"
                                                    value={privacyAgreed}
                                                    onChange={setPrivacyAgreed}
                                                />
                                                <Text type="supporting" color="secondary">
                                                    문의 답변 목적으로만 사용하며, 처리 후 파기합니다.{' '}
                                                    <Link
                                                        href="https://plip.kr/pcc/d9017bf3-00dc-4f8f-b750-f7668e2b7bb7/privacy/1.html"
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                    >
                                                        개인정보처리방침
                                                    </Link>
                                                </Text>

                                                {error && <Banner status="error" title={error} />}

                                                <Button
                                                    label="메일로 문의 보내기"
                                                    variant="primary"
                                                    size="lg"
                                                    type="submit"
                                                    style={{ width: '100%' }}
                                                />
                                            </VStack>
                                        </form>
                                    </Card>

                                    <VStack gap={4}>
                                        <Card padding={5}>
                                            <VStack gap={2}>
                                                <Heading level={2} type="display-3">
                                                    바로 연락하기
                                                </Heading>
                                                <VStack gap={1}>
                                                    <Text type="supporting" color="secondary">
                                                        이메일
                                                    </Text>
                                                    <Link href={`mailto:${CONTACT_EMAIL}`}>
                                                        {CONTACT_EMAIL}
                                                    </Link>
                                                </VStack>
                                                <VStack gap={1}>
                                                    <Text type="supporting" color="secondary">
                                                        전화
                                                    </Text>
                                                    <Link href="tel:010-4549-2094">010-4549-2094</Link>
                                                </VStack>
                                            </VStack>
                                        </Card>

                                        <Card padding={5} variant="muted">
                                            <VStack gap={2}>
                                                <Text weight="semibold">먼저 확인해보세요</Text>
                                                <HStack gap={3} wrap="wrap">
                                                    <Link href="/faq">자주 묻는 질문</Link>
                                                    <Link href="/guide">사용 가이드</Link>
                                                </HStack>
                                            </VStack>
                                        </Card>
                                    </VStack>
                                </Grid>
                            )}
                        </VStack>
                    </motion.div>
                </div>
            </Section>
        </main>
    );
}
