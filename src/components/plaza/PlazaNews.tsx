'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { getNewsCategoryMeta, type NewsItem } from './newsMock';
import { clusterNews } from './newsDedup';
import { fetchExternalNotices, type ExternalNotice } from '@/lib/externalNoticeApi';
import { duration } from '@/theme/motion';

/** 상단 출처 필터 — 공단 게시판 4종은 각각, 언론 기사는 하나로 묶는다 */
const SOURCE_FILTERS = [
  { value: 'all', label: '전체' },
  { value: 'LTC_NOTICE', label: '공단 공지' },
  { value: 'LTC_LAW', label: '법령' },
  { value: 'LTC_EVAL', label: '평가' },
  { value: 'LTC_EDU', label: '교육' },
  { value: 'press', label: '언론 보도' },
] as const;

type SourceFilter = (typeof SOURCE_FILTERS)[number]['value'];

/** 공단 자료와 언론 기사를 같은 줄 모양으로 다루기 위한 표시용 타입 */
interface FeedRow {
  key: string;
  /** 필터 매칭용 — 공단은 source 코드, 언론은 'press' */
  filterKey: string;
  title: string;
  url: string;
  date: Date;
  badgeLabel: string;
  badgeVariant: 'red' | 'blue' | 'yellow' | 'teal' | 'neutral';
  /** 언론 기사에만 있는 매체명 */
  sourceName?: string;
  /** 같은 사안을 다룬 다른 매체 기사 수 */
  duplicateCount: number;
}

/** 공단 게시판별 뱃지 색 — 공지/법령/평가/교육을 한눈에 구분한다 */
const LTC_BADGE_VARIANT: Record<string, FeedRow['badgeVariant']> = {
  LTC_NOTICE: 'blue',
  LTC_LAW: 'neutral',
  LTC_EVAL: 'yellow',
  LTC_EDU: 'teal',
};

/** 공단 자료는 초기에 넉넉히 받아 언론 기사와 날짜순으로 섞는다 */
const LTC_PAGE_SIZE = 50;

/**
 * 요양 소식 보드 — 노인장기요양보험 공단 자료(공지·법령·평가·교육)와
 * 언론 보도를 한 목록에 날짜순으로 합쳐 보여준다.
 * 두 출처는 독립적으로 로드하므로 한쪽이 실패해도 다른 쪽은 그대로 보인다.
 */
export default function PlazaNews({ newsItems }: { newsItems: NewsItem[] }) {
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [ltcNotices, setLtcNotices] = useState<ExternalNotice[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchExternalNotices(0, LTC_PAGE_SIZE)
      .then((page) => {
        if (!cancelled) setLtcNotices(page.content);
      })
      // 공단 자료를 못 받아도 언론 기사는 그대로 보여준다
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // 같은 보도자료를 여러 매체가 받아쓴 기사는 하나로 묶는다 (언론 기사에만 적용)
  const clusters = useMemo(() => clusterNews(newsItems), [newsItems]);

  const rows = useMemo<FeedRow[]>(() => {
    const pressRows: FeedRow[] = clusters.map((cluster) => {
      const news = cluster.lead;
      const meta = getNewsCategoryMeta(news.category);
      return {
        key: `press-${news.id}`,
        filterKey: 'press',
        title: news.title,
        url: news.url,
        date: news.publishedAt,
        badgeLabel: meta.label,
        badgeVariant: meta.badgeVariant,
        sourceName: news.source,
        duplicateCount: cluster.duplicates.length,
      };
    });

    const ltcRows: FeedRow[] = ltcNotices.map((notice) => ({
      key: `ltc-${notice.id}`,
      filterKey: notice.source,
      title: notice.title,
      url: notice.url,
      date: new Date(notice.postedDate),
      badgeLabel: notice.sourceLabel || notice.source,
      badgeVariant: LTC_BADGE_VARIANT[notice.source] ?? 'neutral',
      duplicateCount: 0,
    }));

    return [...ltcRows, ...pressRows].sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [clusters, ltcNotices]);

  const filteredRows = useMemo(
    () => (sourceFilter === 'all' ? rows : rows.filter((r) => r.filterKey === sourceFilter)),
    [rows, sourceFilter],
  );

  const countOf = (value: SourceFilter) =>
    value === 'all' ? rows.length : rows.filter((r) => r.filterKey === value).length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: duration.fast }} style={{ height: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)', height: '100%' }}>
        <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
          <div style={{ maxWidth: '100%', overflowX: 'auto' }}>
            <SegmentedControl
              value={sourceFilter}
              onChange={(v) => setSourceFilter(v as SourceFilter)}
              label="소식 출처"
              size="sm"
            >
              {SOURCE_FILTERS.map((f) => (
                <SegmentedControlItem key={f.value} value={f.value} label={`${f.label} (${countOf(f.value)})`} />
              ))}
            </SegmentedControl>
          </div>
          <Text type="supporting" color="secondary">클릭하면 원문을 새 탭에서 볼 수 있어요</Text>
        </HStack>

        <div style={{ flex: 1, minHeight: 0 }}>
        <Card padding={0} height="100%">
          <div className="carev-plaza-scroll" style={{ height: '100%', overflowY: 'auto' }}>
          {filteredRows.length === 0 ? (
            <div style={{ padding: 'var(--spacing-8)' }}>
              <EmptyState isCompact title="해당 출처의 소식이 없습니다" icon={<Icon icon={IconNews} size="lg" color="secondary" />} />
            </div>
          ) : (
            <VStack gap={0}>
              {filteredRows.map((row, idx) => (
                /* 진짜 링크여야 한다. div+window.open은 키보드로 못 열고, 우클릭
                   '새 탭에서 열기'나 링크 주소 복사도 동작하지 않는다. */
                <a
                  key={row.key}
                  className="carev-dash-row"
                  href={row.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-2)',
                    padding: 'var(--spacing-2) var(--spacing-3)',
                    borderTop: idx === 0 ? 'none' : '1px solid var(--color-border)',
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                >
                  <div style={{ flexShrink: 0 }}>
                    <Badge variant={row.badgeVariant} label={row.badgeLabel} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text type="body" weight="medium" color="primary" maxLines={1}>{row.title}</Text>
                  </div>
                  {/* 같은 사안을 다룬 다른 매체 기사 수 — 목록이 같은 기사로 도배되지 않게 접어둔다 */}
                  {row.duplicateCount > 0 && (
                    <div style={{ flexShrink: 0 }}>
                      <Badge variant="neutral" label={`외 ${row.duplicateCount}개 매체`} />
                    </div>
                  )}
                  <div style={{ flexShrink: 0 }}>
                    <Text type="supporting" color="secondary">
                      {row.sourceName ? `${row.sourceName} · ` : ''}
                      {formatDistanceToNow(row.date, { addSuffix: true, locale: ko })}
                    </Text>
                  </div>
                </a>
              ))}
            </VStack>
          )}
          </div>
        </Card>
        </div>
      </div>
    </motion.div>
  );
}
