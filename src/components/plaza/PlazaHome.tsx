'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Card } from '@astryxdesign/core/Card';
import { Text } from '@astryxdesign/core/Text';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { Icon } from '@astryxdesign/core/Icon';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { IconClock, IconDownload, IconFlame, IconFolder, IconNews, IconPinned } from '@tabler/icons-react';
import type { TablerIcon } from '@tabler/icons-react';
import { getBoardMeta, getLibraryMeta, formatFileSize } from './plazaStore';
import { getNewsCategoryMeta, type NewsItem } from './newsMock';
import { fetchLibraryItems, fetchPosts, type ApiLibraryItem, type ApiPostSummary } from './plazaApi';
import { duration } from '@/theme/motion';

export type PlazaMenu = 'home' | 'all' | 'qna' | 'review' | 'free' | 'news' | 'library';

interface PlazaHomeProps {
  newsItems: NewsItem[];
  onNavigate: (menu: PlazaMenu) => void;
  onOpenPost: (postId: number) => void;
}

const timeAgo = (iso: string) => formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ko });

function WidgetHeader({ icon, title, onMore }: { icon: TablerIcon; title: string; onMore: () => void }) {
  return (
    <div style={{ padding: '12px 16px 8px' }}>
      <HStack hAlign="between" vAlign="center">
        <HStack gap={2} vAlign="center">
          <Icon icon={icon} size="sm" color="secondary" />
          <Text type="body" weight="bold" color="primary">{title}</Text>
        </HStack>
        <Button variant="ghost" size="sm" label="더보기" endContent={<Icon icon="chevronRight" size="xsm" />} onClick={onMore} />
      </HStack>
    </div>
  );
}

/** 광장 홈 — 카페 홈처럼 인기글·최신글·요양소식·새 자료 위젯 모음 */
export default function PlazaHome({ newsItems, onNavigate, onOpenPost }: PlazaHomeProps) {
  const [popular, setPopular] = useState<ApiPostSummary[]>([]);
  const [latest, setLatest] = useState<ApiPostSummary[]>([]);
  const [library, setLibrary] = useState<ApiLibraryItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [popularRes, latestRes, libraryRes] = await Promise.allSettled([
        fetchPosts({ sort: 'popular', size: 5 }),
        fetchPosts({ sort: 'latest', size: 8 }),
        fetchLibraryItems({ size: 5 }),
      ]);
      if (cancelled) return;
      if (popularRes.status === 'fulfilled') setPopular(popularRes.value.content ?? []);
      if (latestRes.status === 'fulfilled') setLatest(latestRes.value.content ?? []);
      if (libraryRes.status === 'fulfilled') setLibrary(libraryRes.value.content ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const renderPostRow = (post: ApiPostSummary) => {
    const meta = getBoardMeta(post.board);
    return (
      <div
        key={post.id}
        className="carev-dash-row"
        style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', padding: 'var(--spacing-1) var(--spacing-2)', borderRadius: 'var(--radius-element)' }}
        onClick={() => onOpenPost(post.id)}
      >
        <div style={{ flexShrink: 0 }}>
          {post.isPinned ? <Icon icon={IconPinned} size="xsm" color="secondary" /> : <Badge variant={meta.badgeVariant} label={meta.label} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text type="body" color="primary" maxLines={1}>{post.title}</Text>
        </div>
        {post.commentCount > 0 && (
          <span style={{ flexShrink: 0, color: 'var(--color-text-accent)' }}>
            <Text type="supporting" weight="bold" color="inherit">[{post.commentCount}]</Text>
          </span>
        )}
        <div style={{ flexShrink: 0 }}>
          <Text type="supporting" color="secondary">{timeAgo(post.createdAt)}</Text>
        </div>
      </div>
    );
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: duration.fast }} style={{ height: '100%' }}>
      <div className="carev-plaza-home">
        {/* 인기글 */}
        <Card padding={0} height="100%">
          <VStack gap={0} height="100%">
            <WidgetHeader icon={IconFlame} title="인기글" onMore={() => onNavigate('all')} />
            <div style={{ padding: '0 8px 8px', flex: 1, minHeight: 0, overflowY: 'auto' }}>
              {popular.length === 0 ? (
                <div style={{ padding: 'var(--spacing-3)' }}>
                  <Text type="supporting" color="secondary">아직 인기글이 없습니다. 첫 글의 주인공이 되어보세요!</Text>
                </div>
              ) : (
                <VStack gap={0}>{popular.map(renderPostRow)}</VStack>
              )}
            </div>
          </VStack>
        </Card>

        {/* 요양 소식 */}
        <Card padding={0} height="100%">
          <VStack gap={0} height="100%">
            <WidgetHeader icon={IconNews} title="요양 소식" onMore={() => onNavigate('news')} />
            <div style={{ padding: '0 8px 8px', flex: 1, minHeight: 0, overflowY: 'auto' }}>
              <VStack gap={0}>
                {newsItems.slice(0, 5).map((news) => {
                  const meta = getNewsCategoryMeta(news.category);
                  return (
                    <div
                      key={news.id}
                      className="carev-dash-row"
                      style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', padding: 'var(--spacing-1) var(--spacing-2)', borderRadius: 'var(--radius-element)' }}
                      onClick={() => window.open(news.url, '_blank', 'noopener,noreferrer')}
                    >
                      <div style={{ flexShrink: 0 }}>
                        <Badge variant={meta.badgeVariant} label={meta.label} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text type="body" color="primary" maxLines={1}>{news.title}</Text>
                      </div>
                      <div style={{ flexShrink: 0 }}>
                        <Text type="supporting" color="secondary">{formatDistanceToNow(news.publishedAt, { addSuffix: true, locale: ko })}</Text>
                      </div>
                    </div>
                  );
                })}
              </VStack>
            </div>
          </VStack>
        </Card>

        {/* 최신글 */}
        <Card padding={0} height="100%">
          <VStack gap={0} height="100%">
            <WidgetHeader icon={IconClock} title="최신글" onMore={() => onNavigate('all')} />
            <div style={{ padding: '0 8px 8px', flex: 1, minHeight: 0, overflowY: 'auto' }}>
              {latest.length === 0 ? (
                <div style={{ padding: 'var(--spacing-3)' }}>
                  <Text type="supporting" color="secondary">아직 게시글이 없습니다.</Text>
                </div>
              ) : (
                <VStack gap={0}>{latest.map(renderPostRow)}</VStack>
              )}
            </div>
          </VStack>
        </Card>

        {/* 새 자료 */}
        <Card padding={0} height="100%">
          <VStack gap={0} height="100%">
            <WidgetHeader icon={IconFolder} title="새 자료" onMore={() => onNavigate('library')} />
            <div style={{ padding: '0 8px 8px', flex: 1, minHeight: 0, overflowY: 'auto' }}>
              {library.length === 0 ? (
                <div style={{ padding: 'var(--spacing-3)' }}>
                  <Text type="supporting" color="secondary">아직 자료가 없습니다. 첫 자료를 올려보세요!</Text>
                </div>
              ) : (
                <VStack gap={0}>
                  {library.map((item) => {
                    const meta = getLibraryMeta(item.category);
                    return (
                      <div
                        key={item.id}
                        className="carev-dash-row"
                        style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', padding: 'var(--spacing-1) var(--spacing-2)', borderRadius: 'var(--radius-element)' }}
                        onClick={() => onNavigate('library')}
                      >
                        <div style={{ flexShrink: 0 }}>
                          <Badge variant={meta.badgeVariant} label={meta.label} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Text type="body" color="primary" maxLines={1}>{item.title}</Text>
                        </div>
                        <HStack gap={1} vAlign="center">
                          <Icon icon={IconDownload} size="xsm" color="secondary" />
                          <Text type="supporting" color="secondary">{item.downloadCount}</Text>
                        </HStack>
                        <div style={{ flexShrink: 0 }}>
                          <Text type="supporting" color="secondary">{formatFileSize(item.fileSize)}</Text>
                        </div>
                      </div>
                    );
                  })}
                </VStack>
              )}
            </div>
          </VStack>
        </Card>
      </div>
    </motion.div>
  );
}
