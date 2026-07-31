'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Card } from '@astryxdesign/core/Card';
import { Text } from '@astryxdesign/core/Text';
import { Heading } from '@astryxdesign/core/Heading';
import { Badge } from '@astryxdesign/core/Badge';
import { Icon } from '@astryxdesign/core/Icon';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { IconNews, IconUsersGroup } from '@tabler/icons-react';
import { MOCK_NEWS, loadNews, getNewsCategoryMeta, type NewsItem } from './newsMock';
import PlazaBoard from './PlazaBoard';
import PlazaLibrary from './PlazaLibrary';
import { duration } from '@/theme/motion';

/**
 * 케어브이 광장 — 한 화면 통합 레이아웃.
 * 좌측: 게시판(핵심), 우측: 요양 소식·자료실 사이드 카드. 모바일에서는 세로 스택.
 */
export default function PlazaManagement() {
  const [newsItems, setNewsItems] = useState<NewsItem[]>(MOCK_NEWS);

  useEffect(() => {
    let cancelled = false;
    loadNews().then((items) => {
      if (!cancelled) setNewsItems(items);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <VStack gap={4}>
      {/* 페이지 헤더 */}
      <HStack gap={3} vAlign="center">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            borderRadius: 'var(--radius-element)',
            background: 'var(--color-background-teal)',
            color: 'var(--color-text-teal)',
            flexShrink: 0,
          }}
        >
          <Icon icon={IconUsersGroup} size="md" color="inherit" />
        </div>
        <VStack gap={0} align="start">
          <Heading level={2}>케어브이 광장</Heading>
          <Text type="supporting" color="secondary">전국 요양 현장의 소식·자료·이야기를 한곳에서</Text>
        </VStack>
      </HStack>

      {/* 통합 레이아웃: 게시판(메인) + 소식·자료실(사이드) */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: duration.fast }}
        className="carev-plaza-layout"
      >
        <div style={{ minWidth: 0 }}>
          <PlazaBoard />
        </div>

        <VStack gap={3}>
          {/* 요양 소식 카드 */}
          <Card padding={0}>
            <VStack gap={0}>
              <div style={{ padding: '12px 16px 8px' }}>
                <HStack gap={2} vAlign="center">
                  <Icon icon={IconNews} size="sm" color="secondary" />
                  <VStack gap={0} align="start">
                    <Text type="body" weight="bold" color="primary">요양 소식</Text>
                    <Text type="supporting" color="secondary">노인학대·제도·평가 업계 뉴스</Text>
                  </VStack>
                </HStack>
              </div>
              <div style={{ padding: '0 8px 8px', maxHeight: 420, overflowY: 'auto' }}>
                {newsItems.length === 0 ? (
                  <div style={{ padding: 'var(--spacing-4)' }}>
                    <EmptyState isCompact title="표시할 소식이 없습니다" icon={<Icon icon={IconNews} size="lg" color="secondary" />} />
                  </div>
                ) : (
                  <VStack gap={0}>
                    {newsItems.map((news) => {
                      const meta = getNewsCategoryMeta(news.category);
                      return (
                        <div
                          key={news.id}
                          className="carev-dash-row"
                          style={{ padding: 'var(--spacing-2)', borderRadius: 'var(--radius-element)' }}
                          onClick={() => window.open(news.url, '_blank', 'noopener,noreferrer')}
                        >
                          <VStack gap={0.5}>
                            <HStack gap={2} vAlign="center">
                              <div style={{ flexShrink: 0 }}>
                                <Badge variant={meta.badgeVariant} label={meta.label} />
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <Text type="body" weight="medium" color="primary" maxLines={1}>{news.title}</Text>
                              </div>
                            </HStack>
                            <Text type="supporting" color="secondary">
                              {news.source} · {formatDistanceToNow(news.publishedAt, { addSuffix: true, locale: ko })}
                            </Text>
                          </VStack>
                        </div>
                      );
                    })}
                  </VStack>
                )}
              </div>
            </VStack>
          </Card>

          {/* 자료실 카드 */}
          <PlazaLibrary variant="compact" />
        </VStack>
      </motion.div>
    </VStack>
  );
}
