'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Section } from '@astryxdesign/core/Section';
import { Card } from '@astryxdesign/core/Card';
import { Grid } from '@astryxdesign/core/Grid';
import { VStack, HStack, StackItem } from '@astryxdesign/core/Stack';
import { Center } from '@astryxdesign/core/Center';
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
import { submitContactInquiry } from '@/lib/apiService';

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
    const [isSubmitting, setIsSubmitting] = useState(false);

    const update = (key: keyof typeof form) => (value: string) =>
        setForm((prev) => ({ ...prev, [key]: value }));

    /** 서버가 바로 메일로 발송한다. 방문자가 메일 앱에서 다시 보내기를 누를 필요가 없다. */
    const handleSubmit = async (e: React.FormEvent) => {
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

        setIsSubmitting(true);
        try {
            await submitContactInquiry({
                name: form.name,
                email: form.email,
                organization: form.organization,
                phone: form.phone,
                inquiryType: form.inquiryType,
                message: form.message,
            });
            setIsSubmitted(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : '문의 접수에 실패했습니다.');
        } finally {
            setIsSubmitting(false);
        }
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
                                            status="success"
                                            title="문의가 접수되었습니다"
                                            description="확인 후 남겨주신 이메일로 답변드리겠습니다."
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
                                <Grid columns={{ minWidth: 260, repeat: 'fit', max: 2 }} gap={6}>
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
                                                    label={isSubmitting ? '보내는 중...' : '문의 보내기'}
                                                    variant="primary"
                                                    size="lg"
                                                    type="submit"
                                                    isLoading={isSubmitting}
                                                    isDisabled={isSubmitting}
                                                    style={{ width: '100%' }}
                                                />
                                            </VStack>
                                        </form>
                                    </Card>

                                    {/* Grid의 align 기본값(stretch)으로 우측 컬럼이 폼과 같은 높이가 되고,
                                        안내 카드가 남은 높이를 채운다. start로 두면 아래가 크게 빈다. */}
                                    <VStack gap={4} height="100%">
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

                                        {/* 남은 높이를 이 카드가 차지하고, 내용은 가로·세로 가운데에 둔다 */}
                                        <StackItem size="fill">
                                            <Card padding={5} variant="muted" height="100%">
                                                <Center axis="both" width="100%" height="100%">
                                                    <VStack gap={3} hAlign="center">
                                                        <Text weight="semibold" justify="center">먼저 확인해보세요</Text>
                                                        <HStack gap={3} wrap="wrap" hAlign="center">
                                                            <Link href="/faq">자주 묻는 질문</Link>
                                                            <Link href="/guide">사용 가이드</Link>
                                                        </HStack>
                                                    </VStack>
                                                </Center>
                                            </Card>
                                        </StackItem>
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
