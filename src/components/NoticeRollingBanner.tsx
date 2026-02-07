'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconSpeakerphone } from '@tabler/icons-react';
import { getNotices } from '@/lib/apiService';
import { Notice } from '@/types/notice';
import { tokens } from '@/theme';

interface NoticeRollingBannerProps {
  onNoticeClick: () => void;
  autoScrollInterval?: number;
  maxNotices?: number;
}

export default function NoticeRollingBanner({
  onNoticeClick,
  autoScrollInterval = 5000,
  maxNotices = 5,
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
    } catch (error) {
      console.error('Failed to fetch notices:', error);
    } finally {
      setIsLoading(false);
    }
  }, [maxNotices]);

  // Fetch notices on mount + every 5 minutes
  useEffect(() => {
    fetchNotices();
    const refreshInterval = setInterval(fetchNotices, 300000);
    return () => clearInterval(refreshInterval);
  }, [fetchNotices]);

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
      return { backgroundColor: 'rgba(255, 107, 107, 0.8)', color: 'white' };
    }
    if (currentNotice.isPinned) {
      return { backgroundColor: 'rgba(255, 179, 71, 0.8)', color: 'white' };
    }
    return { backgroundColor: 'rgba(77, 171, 247, 0.8)', color: 'white' };
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
        background: 'white',
        borderBottom: `1px solid ${tokens.colors.border}`,
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        transition: `box-shadow ${tokens.animation.normal} ${tokens.animation.curve}`,
        boxShadow: isHovered ? tokens.shadows.sm : 'none',
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
          transition={{ duration: 0.4, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            padding: '0 24px',
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            maxWidth: '1140px',
            margin: '0 auto',
            width: '100%',
          }}>
            {/* Icon + Label */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
              <IconSpeakerphone size={18} stroke={1.5} color={tokens.colors.textPrimary} />
              <span style={{
                fontSize: '12px',
                fontWeight: 500,
                color: tokens.colors.textPrimary,
                whiteSpace: 'nowrap',
              }}>
                공지사항
              </span>
            </div>

            {/* Badge */}
            <span style={{
              ...getBadgeStyle(),
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}>
              {getBadgeLabel()}
            </span>

            {/* Notice Title */}
            <p style={{
              fontSize: '14px',
              fontWeight: 500,
              color: tokens.colors.textPrimary,
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              margin: 0,
            }}>
              {currentNotice.title || '(제목 없음)'}
            </p>

            {/* Navigation Dots */}
            {notices.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
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
                      padding: 0,
                      border: 'none',
                      borderRadius: '3px',
                      backgroundColor: index === currentIndex
                        ? tokens.colors.accent
                        : tokens.colors.border,
                      transition: `all ${tokens.animation.normal} ${tokens.animation.curve}`,
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
