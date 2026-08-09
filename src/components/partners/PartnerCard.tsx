'use client';

import React from 'react';
import Image from 'next/image';
import { ClickableCard } from '@astryxdesign/core/ClickableCard';
import { AspectRatio } from '@astryxdesign/core/AspectRatio';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { Badge } from '@astryxdesign/core/Badge';
import { Icon } from '@astryxdesign/core/Icon';
import { FiArrowUpRight, FiPhone } from 'react-icons/fi';
import type { PartnerAd } from '@/lib/partnerAds';

const thumbClip: React.CSSProperties = {
    borderRadius: 'var(--radius-container)',
    overflow: 'hidden',
};

/**
 * 제휴 기관(광고) 카드.
 * 카드 전체가 외부 링크로 동작하며, 대표 이미지가 없으면 기관명 이니셜 썸네일로 대체한다.
 *
 * @param variant 'full'  — /partners 갤러리용(설명·태그 포함)
 *                'compact' — 랜딩 페이지 섹션용(이름·한 줄 소개만)
 */
const PartnerCard: React.FC<{ ad: PartnerAd; variant?: 'full' | 'compact' }> = ({
    ad,
    variant = 'full',
}) => {
    const isCompact = variant === 'compact';

    return (
        <ClickableCard
            label={`${ad.name} — ${ad.linkLabel}`}
            href={ad.href}
            target="_blank"
            padding={isCompact ? 4 : 5}
            height="100%"
        >
            <VStack gap={isCompact ? 3 : 4}>
                <AspectRatio ratio={isCompact ? 16 / 9 : 3 / 2} style={thumbClip}>
                    {ad.imageSrc ? (
                        // next/image의 fill은 부모가 positioned여야 하므로 래퍼로 감싼다.
                        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                            <Image
                                src={ad.imageSrc}
                                alt={`${ad.name} 대표 이미지`}
                                fill
                                style={{ objectFit: 'cover' }}
                                sizes="(max-width: 768px) 100vw, 360px"
                            />
                        </div>
                    ) : (
                        // 대표 이미지가 아직 없는 기관 — 이니셜 썸네일(장식용)
                        <div
                            aria-hidden
                            style={{
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: `linear-gradient(135deg, ${ad.accent.from} 0%, ${ad.accent.to} 100%)`,
                                color: '#FFFFFF',
                                fontSize: isCompact ? 28 : 34,
                                fontWeight: 'var(--font-weight-bold)',
                                letterSpacing: '-0.02em',
                            }}
                        >
                            {ad.initial}
                        </div>
                    )}
                </AspectRatio>

                <VStack gap={2}>
                    <HStack gap={2} vAlign="center" wrap="wrap">
                        <Heading level={3} type="display-3">
                            {ad.name}
                        </Heading>
                        {ad.region && <Badge variant="neutral" label={ad.region} />}
                    </HStack>

                    <Text type="supporting" color="secondary">
                        {ad.tagline}
                    </Text>

                    {!isCompact && <Text type="body">{ad.description}</Text>}

                    {ad.phone && (
                        // 카드 전체가 블로그 링크이므로, 전화는 중첩 링크로 따로 건다.
                        <HStack gap={1.5} vAlign="center">
                            <Icon icon={FiPhone} size="xsm" color="secondary" />
                            <a
                                href={`tel:${ad.phone}`}
                                style={{ color: 'var(--color-text-secondary)', textDecoration: 'none' }}
                            >
                                <Text type="supporting" color="inherit">
                                    상담문의 {ad.phone}
                                </Text>
                            </a>
                        </HStack>
                    )}
                </VStack>

                {!isCompact && ad.tags.length > 0 && (
                    <HStack gap={1.5} wrap="wrap">
                        {ad.tags.map((tag) => (
                            <Badge key={tag} variant="teal" label={tag} />
                        ))}
                    </HStack>
                )}

                <HStack gap={1} vAlign="center">
                    <Text type="supporting" color="accent" weight="medium">
                        {ad.linkLabel}
                    </Text>
                    <Icon icon={FiArrowUpRight} size="xsm" color="accent" />
                </HStack>
            </VStack>
        </ClickableCard>
    );
};

export default PartnerCard;
