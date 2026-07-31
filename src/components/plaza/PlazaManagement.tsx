'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Card } from '@astryxdesign/core/Card';
import { Text } from '@astryxdesign/core/Text';
import { Heading } from '@astryxdesign/core/Heading';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Icon } from '@astryxdesign/core/Icon';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { IconNews, IconFolder, IconMessages, IconUsersGroup } from '@tabler/icons-react';
import { MOCK_NEWS, NEWS_CATEGORIES, loadNews, getNewsCategoryMeta, type NewsCategory, type NewsItem } from './newsMock';
import PlazaBoard from './PlazaBoard';
import PlazaLibrary from './PlazaLibrary';
import { duration } from '@/theme/motion';

type PlazaTab = 'news' | 'library' | 'board';
type CategoryFilter = 'all' | NewsCategory;

export default function PlazaManagement() {
  const [activeTab, setActiveTab] = useState<PlazaTab>('news');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
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

  const filteredNews = useMemo(
    () => (categoryFilter === 'all' ? newsItems : newsItems.filter((n) => n.category === categoryFilter)),
    [newsItems, categoryFilter],
  );

  return (
    <VStack gap={4}>
      {/* 페이지 헤더 */}
      <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
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
            <Text type="supporting" color="secondary">요양 현장의 소식과 자료를 한곳에서 확인하세요</Text>
          </VStack>
        </HStack>
        <SegmentedControl value={activeTab} onChange={(v) => setActiveTab(v as PlazaTab)} label="광장 메뉴">
          <SegmentedControlItem value="news" label="요양 소식" icon={<Icon icon={IconNews} size="sm" />} />
          <SegmentedControlItem value="library" label="자료실" icon={<Icon icon={IconFolder} size="sm" />} />
          <SegmentedControlItem value="board" label="게시판" icon={<Icon icon={IconMessages} size="sm" />} />
        </SegmentedControl>
      </HStack>

      {activeTab === 'news' && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: duration.fast }}>
          <VStack gap={3}>
            <Banner
              status="info"
              container="section"
              title="장기요양·주간보호 관련 뉴스를 모아서 보여드려요"
              description="노인학대, 제도·수가, 기관 평가 등 실무에 필요한 소식이 자동으로 수집됩니다."
            />

            {/* 카테고리 필터 */}
            <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
              <SegmentedControl
                value={categoryFilter}
                onChange={(v) => setCategoryFilter(v as CategoryFilter)}
                label="뉴스 카테고리"
                size="sm"
              >
                <SegmentedControlItem value="all" label={`전체 (${newsItems.length})`} />
                {NEWS_CATEGORIES.map((cat) => (
                  <SegmentedControlItem
                    key={cat.value}
                    value={cat.value}
                    label={`${cat.label} (${newsItems.filter((n) => n.category === cat.value).length})`}
                  />
                ))}
              </SegmentedControl>
              <Text type="supporting" color="secondary">클릭하면 관련 기사를 새 탭에서 볼 수 있어요</Text>
            </HStack>

            {/* 뉴스 리스트 */}
            <Card padding={0}>
              {filteredNews.length === 0 ? (
                <div style={{ padding: 'var(--spacing-8)' }}>
                  <EmptyState
                    isCompact
                    title="해당 카테고리의 소식이 없습니다"
                    icon={<Icon icon={IconNews} size="lg" color="secondary" />}
                  />
                </div>
              ) : (
                <VStack gap={0}>
                  {filteredNews.map((news, idx) => {
                    const meta = getNewsCategoryMeta(news.category);
                    return (
                      <div
                        key={news.id}
                        className="carev-dash-row"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--spacing-3)',
                          padding: 'var(--spacing-3) var(--spacing-4)',
                          borderTop: idx === 0 ? 'none' : '1px solid var(--color-border)',
                        }}
                        onClick={() => window.open(news.url, '_blank', 'noopener,noreferrer')}
                      >
                        <div style={{ flexShrink: 0 }}>
                          <Badge variant={meta.badgeVariant} label={meta.label} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Text as="p" type="body" weight="medium" color="primary" maxLines={1}>{news.title}</Text>
                          <Text type="supporting" color="secondary">
                            {news.source} · {formatDistanceToNow(news.publishedAt, { addSuffix: true, locale: ko })}
                          </Text>
                        </div>
                        <div style={{ flexShrink: 0 }}>
                          <Icon icon="externalLink" size="sm" color="secondary" />
                        </div>
                      </div>
                    );
                  })}
                </VStack>
              )}
            </Card>
          </VStack>
        </motion.div>
      )}

      {activeTab === 'library' && <PlazaLibrary />}

      {activeTab === 'board' && <PlazaBoard newsItems={newsItems} onGoToNews={() => setActiveTab('news')} />}
    </VStack>
  );
}
