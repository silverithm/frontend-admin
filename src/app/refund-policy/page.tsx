'use client';

/**
 * 요금·환불 정책.
 *
 * PG 심사는 비실물(디지털) 상품에 '제공 기간과 환불 정책'이 사이트에 적혀 있기를 요구한다.
 * 그동안 환불 규정은 외부(노션) 이용약관 제20조와 결제 화면 접이식 약관에만 있었고,
 * 둘의 내용도 서로 달랐다. 여기 내용은 이용약관 제20조(환불)를 기준으로 맞춘 것이다.
 * 결제·해지 동작은 실제 서버 동작을 그대로 적는다:
 *   - 카드 등록과 동시에 첫 달 요금 결제, 종료일 = 결제 시점 + 1개월
 *   - 종료일이 지나면 매일 06시 정기결제 배치가 다음 달 요금을 결제
 *   - 구독 취소 시 상태만 CANCELLED가 되고 종료일까지 이용, 이후 자동결제 없음
 */

import React from 'react';
import { Section } from '@astryxdesign/core/Section';
import { VStack } from '@astryxdesign/core/Stack';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { Card } from '@astryxdesign/core/Card';
import { Button } from '@astryxdesign/core/Button';
import Navbar from '@/components/Navbar';
import SiteFooter from '@/components/SiteFooter';
import { BUSINESS_INFO, LEGAL_LINKS } from '@/lib/businessInfo';
import { BASIC_PLAN, FREE_TRIAL_DAYS } from '@/lib/pricing';

interface PolicySection {
    title: string;
    items: string[];
}

const POLICY_SECTIONS: PolicySection[] = [
    {
        title: '1. 판매 상품과 요금',
        items: [
            `${BASIC_PLAN.name}: ${BASIC_PLAN.amountLabel}. 등록하는 직원 수에 따라 요금이 늘지 않습니다.`,
            '케어브이 웹(관리자)과 iOS·Android 앱(직원)의 모든 기능을 이용할 수 있는 온라인 서비스 이용권입니다. 배송되는 상품은 없습니다.',
            `${FREE_TRIAL_DAYS}일 무료 체험: 가입 후 결제 수단 등록 없이 ${FREE_TRIAL_DAYS}일 동안 모든 기능을 쓸 수 있습니다. 체험이 끝나도 자동으로 결제되지 않습니다.`,
        ],
    },
    {
        title: '2. 서비스 제공 기간과 정기결제',
        items: [
            '결제 화면에서 카드를 등록하면 첫 달 요금이 결제되고 바로 이용할 수 있습니다. 로그인하기 전에 카드를 등록했다면 관리자 계정으로 로그인해 결제를 완료할 때 결제되며, 그 전에는 요금이 나가지 않습니다.',
            '이용 기간은 결제일부터 1개월이며, 해지하지 않으면 이용 기간이 끝날 때마다 등록한 카드로 다음 1개월 요금이 자동 결제됩니다.',
            '결제는 토스페이먼츠를 통해 처리되며, 케어브이는 카드 번호를 직접 저장하지 않습니다.',
            '자동 결제가 실패하면 서비스 이용이 제한될 수 있으며, 카드를 확인한 뒤 관리자 화면에서 바로 다시 결제할 수 있습니다.',
        ],
    },
    {
        title: '3. 해지(자동결제 중단)',
        items: [
            '관리자 계정으로 로그인한 뒤 왼쪽 메뉴의 [기관 프로필] → 구독 정보에서 [구독 취소]를 누르면 언제든 해지할 수 있습니다.',
            '해지하면 다음 자동 결제가 이뤄지지 않으며, 이미 결제한 이용 기간이 끝나는 날까지는 계속 이용할 수 있습니다.',
            '이용 기간이 끝나기 전에는 같은 화면에서 해지를 취소하고 구독을 다시 활성화할 수 있습니다.',
        ],
    },
    {
        title: '4. 청약철회와 환불',
        items: [
            '결제일로부터 7일 이내이고 결제 후 서비스를 이용한 내역이 없으면 결제 금액 전액을 환불합니다.',
            '이용 내역이 있는 경우에는 이용약관 제20조에 따라 이용한 일수에 해당하는 금액을 뺀 나머지를 환불합니다.',
            '서비스 장애 등 회사 책임으로 서비스를 이용하지 못했거나, 제공된 서비스가 안내·광고와 현저히 다른 경우에는 전액 환불합니다.',
            '환불은 결제한 수단(카드 결제 취소)으로 진행하며, 환불 의무가 생긴 날부터 3영업일 안에 처리합니다.',
        ],
    },
    {
        title: '5. 환불 신청 방법',
        items: [
            `고객센터 이메일(${BUSINESS_INFO.email}) 또는 전화(${BUSINESS_INFO.phone})로 기관명, 관리자 이메일, 결제일을 알려주시면 확인 후 처리해 드립니다.`,
        ],
    },
];

export default function RefundPolicyPage() {
    return (
        <main style={{ minHeight: '100vh', background: 'var(--color-background-surface)' }}>
            <Navbar />

            <Section variant="transparent" padding={0} paddingBlock={10}>
                <div style={{ width: '100%', maxWidth: 760, marginInline: 'auto' }}>
                    <VStack gap={8}>
                        <VStack gap={2}>
                            <Heading level={1} type="display-2">
                                요금·환불 정책
                            </Heading>
                            <Text color="secondary">
                                케어브이 유료 구독의 요금, 결제 방식, 해지와 환불 기준입니다. 이 정책에 없는 내용은{' '}
                                <a
                                    href={LEGAL_LINKS.terms}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color: 'var(--color-text-accent)' }}
                                >
                                    이용약관
                                </a>
                                을 따릅니다.
                            </Text>
                        </VStack>

                        <Card variant="teal" padding={5}>
                            <VStack gap={3}>
                                <Text weight="semibold">{BASIC_PLAN.name}</Text>
                                <Text type="display-2" weight="bold">
                                    {BASIC_PLAN.amountLabel}
                                </Text>
                                <Text color="secondary">
                                    매월 자동 결제 · 언제든 해지 · 해지해도 결제한 기간까지 이용
                                </Text>
                                <div>
                                    <Button label="결제 화면으로" variant="primary" href="/payment" />
                                </div>
                            </VStack>
                        </Card>

                        {POLICY_SECTIONS.map((section) => (
                            <VStack key={section.title} gap={3}>
                                <Heading level={2} type="display-3">
                                    {section.title}
                                </Heading>
                                <ul style={{ margin: 0, paddingLeft: 'var(--spacing-5)' }}>
                                    {section.items.map((item) => (
                                        <li key={item} style={{ marginBottom: 'var(--spacing-2)' }}>
                                            <Text color="secondary">{item}</Text>
                                        </li>
                                    ))}
                                </ul>
                            </VStack>
                        ))}
                    </VStack>
                </div>
            </Section>

            <SiteFooter />
        </main>
    );
}
