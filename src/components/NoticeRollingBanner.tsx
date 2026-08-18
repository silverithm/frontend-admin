'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconSpeakerphone } from '@tabler/icons-react';
import { HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Icon } from '@astryxdesign/core/Icon';
import { getNotices } from '@/lib/apiService';
import { useVisiblePolling } from '@/lib/useVisiblePolling';
import { Notice } from '@/types/notice';
import { duration } from '@/theme/motion';

interface NoticeRollingBannerProps {
  onNoticeClick: () => void;
  autoScrollInterval?: number;
  maxNotices?: number;
  /** 받아온 전체 공지 목록(자르기 전)을 셸에 넘긴다 — 사이드바 새 공지 배지가 같은 데이터를 쓴다 */
  onNoticesLoaded?: (notices: Notice[]) => void;
}

export default function NoticeRollingBanner({
  onNoticeClick,
  autoScrollInterval = 5000,
  maxNotices = 5,
  onNoticesLoaded,
}: NoticeRollingBannerProps) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchNotices = useCallback(async () => {
    try {
      const response = await getNotices({ status: 'PUBLISHED' });

      const sortedNotices = (response.notices as Notice[]).sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        if (a.priority !== b.priority) {
          const priorityOrder: Record<string, number> = { HIGH: 0, NORMAL: 1, LOW: 2 };
          return (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1);
        }
        return new Date(b.publishedAt || b.createdAt).getTime() -
               new Date(a.publishedAt || a.createdAt).getTime();
      });

      setNotices(sortedNotices.slice(0, maxNotices));
      onNoticesLoaded?.(sortedNotices);
    } catch (error) {
      console.error('Failed to fetch notices:', error);
    } finally {
      setIsLoading(false);
    }
  }, [maxNotices, onNoticesLoaded]);

  // 공지 로드 + 5분 주기 갱신 (보고 있는 탭에서만)
  useVisiblePolling(fetchNotices, 300000);

  // Auto-scroll when 2+ notices and not hovered
  useEffect(() => {
    if (notices.length <= 1 || isHovered) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % notices.length);
    }, autoScrollInterval);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [notices.length, isHovered, autoScrollInterval]);

  if (isLoading || notices.length === 0) return null;

  const currentNotice = notices[currentIndex];

  const getBadgeStyle = (): React.CSSProperties => {
    if (currentNotice.priority === 'HIGH') {
      return { backgroundColor: 'var(--color-background-red)', color: 'var(--color-text-red)' };
    }
    if (currentNotice.isPinned) {
      return { backgroundColor: 'var(--color-background-orange)', color: 'var(--color-text-orange)' };
    }
    return { backgroundColor: 'var(--color-background-blue)', color: 'var(--color-text-blue)' };
  };

  const getBadgeLabel = () => {
    if (currentNotice.priority === 'HIGH') return '긴급';
    if (currentNotice.isPinned) return '고정';
    return '공지';
  };

  return (
    <motion.div
      whileHover={{ scale: 1.002 }}
      style={{
        width: '100%',
        height: '48px',
        background: 'var(--color-background-card)',
        borderBottom: '1px solid var(--color-border)',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        transition: 'box-shadow var(--duration-medium) var(--ease-standard)',
        boxShadow: isHovered ? 'var(--shadow-low)' : 'none',
      }}
      onClick={onNoticeClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="region"
      aria-label="공지사항 롤링 배너"
      aria-live="polite"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={currentNotice.id}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: duration.medium, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            padding: '0 var(--spacing-6)',
          }}
        >
          <HStack
            gap={3}
            vAlign="center"
            width="100%"
            style={{ maxWidth: '1140px', margin: '0 auto' }}
          >
            {/* Icon + Label */}
            <HStack gap={1} vAlign="center" style={{ flexShrink: 0 }}>
              <Icon icon={IconSpeakerphone} size="sm" color="primary" />
              <Text type="label" color="primary" weight="medium" textWrap="nowrap">
                공지사항
              </Text>
            </HStack>

            {/* Badge */}
            <div style={{
              ...getBadgeStyle(),
              padding: 'var(--spacing-0-5) var(--spacing-2)',
              borderRadius: 'var(--radius-none)',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}>
              <Text type="label" weight="semibold" color="inherit" textWrap="nowrap">
                {getBadgeLabel()}
              </Text>
            </div>

            {/* Notice Title */}
            <Text
              type="body"
              weight="medium"
              color="primary"
              maxLines={1}
              style={{ flex: 1, minWidth: 0 }}
            >
              {currentNotice.title || '(제목 없음)'}
            </Text>

            {/* Navigation Dots */}
            {notices.length > 1 && (
              <HStack gap={1.5} vAlign="center" style={{ flexShrink: 0 }}>
                {notices.map((_, index) => (
                  <button
                    key={index}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentIndex(index);
                    }}
                    aria-label={`공지사항 ${index + 1}`}
                    style={{
                      width: index === currentIndex ? '16px' : '6px',
                      height: '6px',
                      padding: 'var(--spacing-0)',
                      border: 'none',
                      borderRadius: 'var(--radius-none)',
                      backgroundColor: index === currentIndex
                        ? 'var(--color-accent)'
                        : 'var(--color-border)',
                      transition: 'background-color var(--duration-medium) var(--ease-standard)',
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </HStack>
            )}
          </HStack>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
