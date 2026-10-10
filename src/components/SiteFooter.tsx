'use client';

import React from 'react';
import Image from 'next/image';
import { Section } from '@astryxdesign/core/Section';
import { Grid } from '@astryxdesign/core/Grid';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Divider } from '@astryxdesign/core/Divider';
import { BUSINESS_INFO, LEGAL_LINKS } from '@/lib/businessInfo';

const linkStyle: React.CSSProperties = { color: 'var(--color-text-accent)', textDecoration: 'none' };
const contactLinkStyle: React.CSSProperties = { color: 'var(--color-text-secondary)', textDecoration: 'none' };

/**
 * 공개 페이지 하단 — 사업자 정보와 약관·환불 정책 링크.
 *
 * PG 심사는 사이트 첫 화면뿐 아니라 결제 화면에서도 판매자 정보와 환불 정책을 찾을 수 있는지 본다.
 * 랜딩·결제·요금 정책 화면이 같은 푸터를 쓴다.
 */
export default function SiteFooter() {
    return (
        <Section id="contact" variant="transparent" padding={0} paddingBlock={8} dividers={['top']}>
            <div style={{ width: '100%', maxWidth: 1152, marginInline: 'auto' }}>
                <VStack gap={6}>
                    <Grid columns={{ minWidth: 260, repeat: 'fit' }} gap={6}>
                        <VStack gap={3}>
                            <Image src="/images/logo-text-dark.png" alt="케어브이" width={120} height={40} />
                            <Text type="supporting" color="secondary">
                                장기요양기관을 위한 올인원 운영 플랫폼
                            </Text>
                        </VStack>

                        <VStack gap={2}>
                            <Text weight="semibold">사업자 정보</Text>
                            <Text type="supporting" color="secondary">상호: {BUSINESS_INFO.companyName}</Text>
                            <Text type="supporting" color="secondary">대표자: {BUSINESS_INFO.representative}</Text>
                            <Text type="supporting" color="secondary">
                                사업자등록번호: {BUSINESS_INFO.registrationNumber}
                            </Text>
                            {BUSINESS_INFO.mailOrderNumber && (
                                <Text type="supporting" color="secondary">
                                    통신판매업 신고번호: {BUSINESS_INFO.mailOrderNumber}
                                </Text>
                            )}
                            <Text type="supporting" color="secondary">주소: {BUSINESS_INFO.address}</Text>
                        </VStack>

                        <VStack gap={2}>
                            <Text weight="semibold">고객센터</Text>
                            <a href={`tel:${BUSINESS_INFO.phone}`} style={contactLinkStyle}>
                                <Text type="supporting" color="inherit">전화: {BUSINESS_INFO.phone}</Text>
                            </a>
                            <a href={`mailto:${BUSINESS_INFO.email}`} style={contactLinkStyle}>
                                <Text type="supporting" color="inherit">이메일: {BUSINESS_INFO.email}</Text>
                            </a>
                        </VStack>
                    </Grid>

                    <Divider />

                    <div className="carev-admin-footer-row">
                        <Text type="supporting" color="secondary">
                            © 2025 {BUSINESS_INFO.serviceName}. 모든 권리 보유.
                        </Text>
                        <HStack gap={3} vAlign="center" wrap="wrap">
                            <a href={LEGAL_LINKS.privacy} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                                <Text type="supporting" color="inherit">개인정보처리방침</Text>
                            </a>
                            <Text type="supporting" color="disabled">|</Text>
                            <a href={LEGAL_LINKS.terms} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                                <Text type="supporting" color="inherit">이용약관</Text>
                            </a>
                            <Text type="supporting" color="disabled">|</Text>
                            <a href={LEGAL_LINKS.refund} style={linkStyle}>
                                <Text type="supporting" color="inherit">요금·환불 정책</Text>
                            </a>
                        </HStack>
                    </div>
                </VStack>
            </div>
        </Section>
    );
}
