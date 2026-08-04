'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Card } from '@astryxdesign/core/Card';
import { Text } from '@astryxdesign/core/Text';
import { Badge } from '@astryxdesign/core/Badge';
import { Icon } from '@astryxdesign/core/Icon';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { IconNews } from '@tabler/icons-react';
import { NEWS_CATEGORIES, getNewsCategoryMeta, type NewsCategory, type NewsItem } from './newsMock';
import { clusterNews } from './newsDedup';
import { duration } from '@/theme/motion';

type CategoryFilter = 'all' | NewsCategory;

/** 요양 소식 보드 — 카테고리 필터 + 뉴스 전체 리스트 */
export default function PlazaNews({ newsItems }: { newsItems: NewsItem[] }) {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');

  // 같은 보도자료를 여러 매체가 받아쓴 기사는 하나로 묶어 보여준다
  const clusters = useMemo(() => clusterNews(newsItems), [newsItems]);

  const filteredClusters = useMemo(
    () => (categoryFilter === 'all' ? clusters : clusters.filter((c) => c.lead.category === categoryFilter)),
    [clusters, categoryFilter],
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: duration.fast }} style={{ height: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)', height: '100%' }}>
        <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
          <SegmentedControl value={categoryFilter} onChange={(v) => setCategoryFilter(v as CategoryFilter)} label="뉴스 카테고리" size="sm">
            <SegmentedControlItem value="all" label={`전체 (${clusters.length})`} />
            {NEWS_CATEGORIES.map((cat) => (
              <SegmentedControlItem
                key={cat.value}
                value={cat.value}
                label={`${cat.label} (${clusters.filter((c) => c.lead.category === cat.value).length})`}
              />
            ))}
          </SegmentedControl>
          <Text type="supporting" color="secondary">클릭하면 기사 원문을 새 탭에서 볼 수 있어요</Text>
        </HStack>

        <div style={{ flex: 1, minHeight: 0 }}>
        <Card padding={0} height="100%">
          <div className="carev-plaza-scroll" style={{ height: '100%', overflowY: 'auto' }}>
          {filteredClusters.length === 0 ? (
            <div style={{ padding: 'var(--spacing-8)' }}>
              <EmptyState isCompact title="해당 카테고리의 소식이 없습니다" icon={<Icon icon={IconNews} size="lg" color="secondary" />} />
            </div>
          ) : (
            <VStack gap={0}>
              {filteredClusters.map((cluster, idx) => {
                const news = cluster.lead;
                const meta = getNewsCategoryMeta(news.category);
                return (
                  <div
                    key={news.id}
                    className="carev-dash-row"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--spacing-2)',
                      padding: 'var(--spacing-2) var(--spacing-3)',
                      borderTop: idx === 0 ? 'none' : '1px solid var(--color-border)',
                    }}
                    onClick={() => window.open(news.url, '_blank', 'noopener,noreferrer')}
                  >
                    <div style={{ flexShrink: 0 }}>
                      <Badge variant={meta.badgeVariant} label={meta.label} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text type="body" weight="medium" color="primary" maxLines={1}>{news.title}</Text>
                    </div>
                    {/* 같은 사안을 다룬 다른 매체 기사 수 — 목록이 같은 기사로 도배되지 않게 접어둔다 */}
                    {cluster.duplicates.length > 0 && (
                      <div style={{ flexShrink: 0 }}>
                        <Badge variant="neutral" label={`외 ${cluster.duplicates.length}개 매체`} />
                      </div>
                    )}
                    <div style={{ flexShrink: 0 }}>
                      <Text type="supporting" color="secondary">
                        {news.source} · {formatDistanceToNow(news.publishedAt, { addSuffix: true, locale: ko })}
                      </Text>
                    </div>
                  </div>
                );
              })}
            </VStack>
          )}
          </div>
        </Card>
        </div>
      </div>
    </motion.div>
  );
}
