'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

import { Text } from '@astryxdesign/core/Text';
import { Icon } from '@astryxdesign/core/Icon';
import { Banner } from '@astryxdesign/core/Banner';
import { Badge } from '@astryxdesign/core/Badge';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';

import { Loading } from '@/components/Loading';
import {
  fetchExternalNotices,
  ExternalNotice,
  ExternalNoticeSource,
  EXTERNAL_NOTICE_SOURCE_LABEL_FALLBACK,
} from '@/lib/externalNoticeApi';

type SourceFilter = 'ALL' | ExternalNoticeSource;

const SOURCE_FILTERS: { value: SourceFilter; label: string }[] = [
  { value: 'ALL', label: '전체' },
  { value: 'LTC_NOTICE', label: '공지사항' },
  { value: 'LTC_LAW', label: '법령자료실' },
  { value: 'LTC_EVAL', label: '평가 매뉴얼' },
  { value: 'LTC_EDU', label: '기관종사자 교육' },
];

function sourceLabelOf(n: ExternalNotice) {
  return n.sourceLabel || EXTERNAL_NOTICE_SOURCE_LABEL_FALLBACK[n.source] || n.source;
}

function formatPostedDate(dateStr: string | null | undefined) {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return format(date, 'yyyy.MM.dd', { locale: ko });
  } catch {
    return dateStr;
  }
}

/**
 * 장기요양 소식(노인장기요양보험 longtermcare.or.kr 게시판 4종 자동 수집 공지) 목록.
 * 관리자 화면(NoticeManagement)과 직원 화면(EmployeeNotice)의 "장기요양 소식" 서브탭에서 공용으로 쓴다.
 * 클릭하면 외부 상세 페이지를 새 탭으로 연다.
 */
export default function ExternalNoticeList() {
  const [notices, setNotices] = useState<ExternalNotice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('ALL');

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetchExternalNotices(0, 20, sourceFilter === 'ALL' ? undefined : sourceFilter)
      .then((page) => {
        if (!cancelled) setNotices(page.content);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '장기요양 소식을 불러오는데 실패했습니다.');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sourceFilter]);

  return (
    <VStack gap={3} align="start" width="100%">
      <Banner
        status="info"
        title="자동 수집 안내"
        description="노인장기요양보험(longtermcare.or.kr)의 공지·법령·평가 자료를 매일 자동으로 가져옵니다."
        container="section"
      />

      <SegmentedControl value={sourceFilter} onChange={(v) => setSourceFilter(v as SourceFilter)} label="게시판 필터">
        {SOURCE_FILTERS.map((f) => (
          <SegmentedControlItem key={f.value} value={f.value} label={f.label} />
        ))}
      </SegmentedControl>

      {isLoading ? (
        <Loading size="inline" height={160} label="장기요양 소식을 불러오는 중..." />
      ) : error ? (
        <Banner status="error" title="불러오기 실패" description={error} />
      ) : notices.length > 0 ? (
        <VStack gap={2} align="start" width="100%">
          {notices.map((n) => (
            <div
              key={n.id}
              className="carev-notice-item"
              onClick={() => window.open(n.url, '_blank', 'noopener')}
              role="link"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') window.open(n.url, '_blank', 'noopener');
              }}
              style={{
                width: '100%',
                padding: 'var(--spacing-4)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-element)',
                cursor: 'pointer',
                background: 'var(--color-background-card)',
              }}
            >
              <HStack gap={3} vAlign="center">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <VStack gap={1.5} align="start">
                    <Text type="body" weight="medium" maxLines={1}>{n.title}</Text>
                    <HStack gap={3} vAlign="center" wrap="wrap">
                      <Badge variant="neutral" label={sourceLabelOf(n)} />
                      <Text type="supporting">{formatPostedDate(n.postedDate)}</Text>
                    </HStack>
                  </VStack>
                </div>
                <Icon icon="externalLink" size="sm" color="tertiary" />
              </HStack>
            </div>
          ))}
        </VStack>
      ) : (
        <div style={{ width: '100%' }}>
          <EmptyState
            icon={<Icon icon="info" size="lg" />}
            title="등록된 장기요양 소식이 없습니다"
            description="새로운 소식이 수집되면 이곳에 표시됩니다"
          />
        </div>
      )}
    </VStack>
  );
}
