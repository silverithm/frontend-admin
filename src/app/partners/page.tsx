'use client';

/**
 * 제휴·광고 페이지.
 *
 * 케어브이와 함께하는 기관을 갤러리로 소개하고(카테고리 탭 필터),
 * 하단에서 신규 광고 문의를 받는다. 문의는 서버 발송 설정 없이 동작하도록
 * /contact와 동일하게 mailto 방식을 쓴다.
 */

import React, { useMemo, useState } from 'react';
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
import { TabList, Tab } from '@astryxdesign/core/TabList';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import Navbar from '@/components/Navbar';
import PartnerCard from '@/components/partners/PartnerCard';
import {
    PARTNER_ADS,
    PARTNER_CATEGORIES,
    PARTNER_INQUIRY_EMAIL,
    getActiveCategories,
} from '@/lib/partnerAds';
import { duration } from '@/theme/motion';
import { submitContactInquiry } from '@/lib/apiService';
import InquirySubmittedDialog from '@/components/InquirySubmittedDialog';

const container = (maxWidth = 1152): React.CSSProperties => ({
    width: '100%',
    maxWidth,
    marginLeft: 'auto',
    marginRight: 'auto',
});

/**
 * 등록된 기관 수가 적을 때 카드가 넓은 화면 왼쪽에 치우쳐 보이지 않도록
 * 갤러리 폭 자체를 좁혀 가운데 정렬한다. (탭 전환으로 폭이 출렁이지 않게 전체 개수 기준)
 */
const galleryMaxWidth = (count: number): number => {
    if (count <= 1) return 420;
    if (count === 2) return 780;
    return 1152;
};

/** 광고 문의 폼에서 고를 수 있는 기관 유형 — 갤러리 카테고리와 동일한 분류를 쓴다. */
const ORGANIZATION_TYPE_OPTIONS = PARTNER_CATEGORIES.map((category) => ({
    value: category.label,
    label: category.label,
}));

const ALL_TAB = 'all';

export default function PartnersPage() {
    const activeCategories = useMemo(() => getActiveCategories(), []);
    const [tab, setTab] = useState(ALL_TAB);

    const visibleAds = useMemo(
        () => (tab === ALL_TAB ? PARTNER_ADS : PARTNER_ADS.filter((ad) => ad.category === tab)),
        [tab],
    );

    const [form, setForm] = useState({
        organization: '',
        name: '',
        email: '',
        phone: '',
        website: '',
        organizationType: ORGANIZATION_TYPE_OPTIONS[0]?.value ?? '',
        message: '',
    });
    const [privacyAgreed, setPrivacyAgreed] = useState(false);
    const [error, setError] = useState('');
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const update = (key: keyof typeof form) => (value: string) =>
        setForm((prev) => ({ ...prev, [key]: value }));

    /** 입력값을 담아 메일 작성 창을 연다. (/contact와 동일한 방식) */
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!form.organization.trim() || !form.name.trim() || !form.email.trim()) {
            setError('기관명, 담당자 이름, 이메일을 모두 입력해주세요.');
            return;
        }
        if (!privacyAgreed) {
            setError('개인정보 수집 및 이용에 동의해주세요.');
            return;
        }

        const message = [
            `기관 유형: ${form.organizationType}`,
            `홈페이지/블로그: ${form.website || '-'}`,
            '',
            form.message || '(추가 내용 없음)',
        ].join('\n');

        setIsSubmitting(true);
        try {
            await submitContactInquiry({
                name: form.name,
                email: form.email,
                organization: form.organization,
                phone: form.phone,
                inquiryType: '광고 문의',
                message,
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

            {/* ── 히어로 ── */}
            <Section variant="transparent" padding={0} paddingBlock={10}>
                <div style={container(720)}>
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: duration.mediumMax }}
                    >
                        <VStack gap={3} hAlign="center">
                            <Heading level={1} type="display-1" justify="center" textWrap="balance">
                                케어브이와 함께하는 기관
                            </Heading>
                            <Text type="large" color="secondary" justify="center" textWrap="balance">
                                현장에서 어르신을 돌보는 기관들을 소개합니다. 기관 소식과 프로그램을
                                직접 확인해보세요.
                            </Text>
                        </VStack>
                    </motion.div>
                </div>
            </Section>

            {/* ── 갤러리 ── */}
            <Section variant="muted" padding={0} paddingBlock={10}>
                <div style={container(galleryMaxWidth(PARTNER_ADS.length))}>
                    <VStack gap={6}>
                        {activeCategories.length > 1 && (
                            <TabList value={tab} onChange={setTab} hasDivider>
                                <Tab value={ALL_TAB} label={`전체 (${PARTNER_ADS.length})`} />
                                {activeCategories.map((category) => (
                                    <Tab
                                        key={category.id}
                                        value={category.id}
                                        label={`${category.label} (${
                                            PARTNER_ADS.filter((ad) => ad.category === category.id).length
                                        })`}
                                    />
                                ))}
                            </TabList>
                        )}

                        {visibleAds.length > 0 ? (
                            <Grid columns={{ minWidth: 300, repeat: 'fit', max: 3 }} gap={5} align="start">
                                {visibleAds.map((ad) => (
                                    <PartnerCard key={ad.id} ad={ad} />
                                ))}
                            </Grid>
                        ) : (
                            <EmptyState
                                title="아직 등록된 기관이 없습니다"
                                description="이 자리에서 기관을 소개하고 싶으시다면 아래 광고 문의를 남겨주세요."
                            />
                        )}
                    </VStack>
                </div>
            </Section>

            {/* ── 광고 문의 ── */}
            <Section id="inquiry" variant="transparent" padding={0} paddingBlock={10}>
                <div style={container(880)}>
                    <VStack gap={8}>
                        <VStack gap={2} hAlign="center">
                            <Heading level={2} type="display-2" justify="center" textWrap="balance">
                                광고 문의
                            </Heading>
                            <Text type="large" color="secondary" justify="center" textWrap="balance">
                                기관을 이 페이지에 소개하고 싶으시다면 남겨주세요. 확인 후 안내드립니다.
                            </Text>
                        </VStack>

                        {/* 폼과 안내를 세로로 쌓는다. 좌우 2단으로 두면 폼이 훨씬 길어
                            오른쪽 컬럼 아래가 크게 비어 보인다. */}
                            <VStack gap={6}>
                                <Card padding={6}>
                                    <form onSubmit={handleSubmit}>
                                        <VStack gap={4}>
                                            {/* 짧은 입력은 2열로 묶는다. 좁은 화면에서는 자동으로 1열로 내려간다. */}
                                            <Grid columns={{ minWidth: 240, repeat: 'fit', max: 2 }} gap={4}>
                                                <TextInput
                                                    label="기관명"
                                                    type="text"
                                                    value={form.organization}
                                                    onChange={update('organization')}
                                                    placeholder="예: OO재활어르신학교"
                                                    htmlName="organization"
                                                    isRequired
                                                />
                                                <Selector
                                                    label="기관 유형"
                                                    options={ORGANIZATION_TYPE_OPTIONS}
                                                    value={form.organizationType}
                                                    onChange={update('organizationType')}
                                                />
                                                <TextInput
                                                    label="담당자 이름"
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
                                                    label="연락처"
                                                    type="text"
                                                    value={form.phone}
                                                    onChange={update('phone')}
                                                    placeholder="010-0000-0000"
                                                    htmlName="phone"
                                                />
                                                <TextInput
                                                    label="홈페이지 · 블로그 주소"
                                                    type="text"
                                                    value={form.website}
                                                    onChange={update('website')}
                                                    placeholder="https://blog.naver.com/..."
                                                    htmlName="website"
                                                />
                                            </Grid>
                                            <TextArea
                                                label="소개하고 싶은 내용"
                                                value={form.message}
                                                onChange={update('message')}
                                                placeholder="기관 소개, 강조하고 싶은 프로그램 등을 자유롭게 남겨주세요"
                                                rows={5}
                                            />

                                            <Divider />

                                            <CheckboxInput
                                                label="개인정보 수집 및 이용에 동의합니다"
                                                value={privacyAgreed}
                                                onChange={setPrivacyAgreed}
                                            />
                                            <Text type="supporting" color="secondary">
                                                광고 문의 답변 목적으로만 사용하며, 처리 후 파기합니다.{' '}
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
                                                label={isSubmitting ? '보내는 중...' : '광고 문의 보내기'}
                                                variant="primary"
                                                size="lg"
                                                isLoading={isSubmitting}
                                                isDisabled={isSubmitting}
                                                type="submit"
                                                style={{ width: '100%' }}
                                            />
                                        </VStack>
                                    </form>
                                </Card>

                                <Grid columns={{ minWidth: 240, repeat: 'fit', max: 3 }} gap={4} align="stretch">
                                    <Card padding={5} height="100%">
                                        <VStack gap={3}>
                                            <Heading level={3} type="display-3">
                                                이렇게 소개됩니다
                                            </Heading>
                                            <VStack gap={2}>
                                                <Text type="supporting" color="secondary">
                                                    · 제휴·광고 페이지 갤러리에 기관 카드로 노출
                                                </Text>
                                                <Text type="supporting" color="secondary">
                                                    · 기관 홈페이지 또는 블로그로 바로 연결
                                                </Text>
                                                <Text type="supporting" color="secondary">
                                                    · 케어브이 홈 화면 &lsquo;함께하고 있는 기관&rsquo; 섹션에 함께 노출
                                                </Text>
                                            </VStack>
                                        </VStack>
                                    </Card>

                                    <Card padding={5} height="100%">
                                        <VStack gap={2}>
                                            <Heading level={3} type="display-3">
                                                바로 연락하기
                                            </Heading>
                                            <VStack gap={1}>
                                                <Text type="supporting" color="secondary">
                                                    이메일
                                                </Text>
                                                <Link href={`mailto:${PARTNER_INQUIRY_EMAIL}`}>
                                                    {PARTNER_INQUIRY_EMAIL}
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

                                    <Card padding={5} variant="muted" height="100%">
                                        <VStack gap={2}>
                                            <Heading level={3} type="display-3">
                                                제품 문의를 찾으셨나요?
                                            </Heading>
                                            <Text type="supporting" color="secondary">
                                                도입·기능·요금 문의는 문의하기에서 남겨주세요.
                                            </Text>
                                            <HStack gap={3} wrap="wrap">
                                                <Link href="/contact">문의하기</Link>
                                                <Link href="/faq">자주 묻는 질문</Link>
                                            </HStack>
                                        </VStack>
                                    </Card>
                                </Grid>
                            </VStack>
                    </VStack>
                </div>
            </Section>

            {/* 접수 완료 — 폼 자리를 배너로 바꾸는 대신 화면 위에 모달로 알린다 */}
            <InquirySubmittedDialog
                isOpen={isSubmitted}
                title="광고 문의가 접수되었습니다"
                description="확인 후 남겨주신 이메일로 답변드리겠습니다."
                onWriteAgain={() => {
                    setIsSubmitted(false);
                    setForm({ organization: '', organizationType: '', name: '', email: '', phone: '', website: '', message: '' });
                    setPrivacyAgreed(false);
                }}
            />
        </main>
    );
}
