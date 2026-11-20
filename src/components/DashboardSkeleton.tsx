import React from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday } from 'date-fns';
import { Card } from '@astryxdesign/core/Card';
import { Skeleton } from '@astryxdesign/core/Skeleton';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { WEEK_GRID_COLUMNS } from '@/lib/scheduleBars';
import { subheaderStyle } from './subheaderStyle';
import { CalendarCellBars } from './CalendarLoading';

/*
 * 대시보드 첫 로딩 뼈대 (2026-11-20).
 * 예전에는 회색 큰 판 세 장이라, 데이터가 들어오면 화면 구조가 통째로 바뀌어 튀었다.
 * 실제 화면과 같은 클래스·격자(.carev-dash-panels, 주 격자)를 써서 인사말 줄 → 출결 띠 →
 * 패널 카드(머리줄 + 줄) → 월간일정 달력 순서로 같은 자리에 뼈대를 깐다.
 */

// AdminDashboard의 달력 바 크기와 같아야 칸 안 뼈대가 실제 바와 겹쳐 보인다
const DASH_BAR_HEIGHT = 15;
const DASH_BAR_GAP = 2;
const DASH_BAR_AREA_TOP = 30;
const DASH_BAR_EDGE_INSET = 2;
const DASH_CELL_FLOOR = 64;
const GRID_LINE = '1px solid var(--color-border-emphasized)';
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** 패널 카드: 머리줄(아이콘 + 제목 두 줄) + 본문 줄 몇 개 */
function PanelCardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div>
      <Card padding={0} height="100%">
        <VStack gap={0} height="100%">
          <div style={{ ...subheaderStyle, padding: 'var(--spacing-3) var(--spacing-4)' }}>
            <HStack gap={2} vAlign="center">
              <Skeleton width={32} height={32} radius={2} />
              <VStack gap={1} align="start">
                <Skeleton width={72} height={16} radius={2} />
                <Skeleton width={44} height={12} radius={2} />
              </VStack>
            </HStack>
          </div>
          <div style={{ padding: 'var(--spacing-2)', flex: 1 }}>
            <VStack gap={1}>
              {Array.from({ length: rows }, (_, i) => (
                <div key={i} style={{ padding: 'var(--spacing-2)' }}>
                  <Skeleton width="100%" height={36} radius={2} index={i} />
                </div>
              ))}
            </VStack>
          </div>
        </VStack>
      </Card>
    </div>
  );
}

export default function DashboardSkeleton() {
  const now = new Date();
  const month = startOfMonth(now);
  const days = eachDayOfInterval({ start: startOfWeek(month, { weekStartsOn: 0 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 0 }) });
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  return (
    <div
      className="carev-dash-root carev-skel-rows"
      role="status"
      aria-label="대시보드를 불러오는 중"
      style={{ display: 'flex', minHeight: 0, flex: 1, flexDirection: 'column', gap: 'var(--spacing-3)', paddingBottom: 'var(--spacing-4)' }}
    >
      {/* 인사말 줄 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <HStack gap={2} vAlign="center">
          <Skeleton width={180} height={20} radius={2} />
          <Skeleton width={120} height={16} radius={2} index={1} />
        </HStack>
        <Skeleton width={72} height={20} radius={2} index={2} />
      </div>

      {/* 오늘 현황 띠 */}
      <div style={{ marginBottom: 'var(--spacing-3)' }}>
        <Card padding={4}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--spacing-4)' }}>
            <Skeleton width="80%" height={36} radius={2} />
            <Skeleton width="80%" height={36} radius={2} index={1} />
          </div>
        </Card>
      </div>

      <div className="carev-dash-panels" style={{ display: 'grid', gap: 'var(--spacing-3)', flex: 1, minHeight: 0 }}>
        <PanelCardSkeleton />
        <PanelCardSkeleton />

        {/* 월간일정 — 머리줄 + 요일 줄 + 실제 날짜 숫자가 든 격자 */}
        <div className="carev-dash-panel-full">
          <Card padding={0} height="100%">
            <VStack gap={0} height="100%">
              <div style={{ ...subheaderStyle, padding: 'var(--spacing-3) var(--spacing-4)' }}>
                <HStack gap={2} vAlign="center">
                  <Skeleton width={32} height={32} radius={2} />
                  <VStack gap={1} align="start">
                    <Skeleton width={72} height={16} radius={2} />
                    <Skeleton width={110} height={12} radius={2} />
                  </VStack>
                </HStack>
              </div>
              <div style={{ padding: 'var(--spacing-3) var(--spacing-4)', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, border: GRID_LINE, borderRadius: 'var(--radius-inner)', overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: WEEK_GRID_COLUMNS, flexShrink: 0, borderBottom: GRID_LINE, background: 'var(--color-background-muted)' }}>
                    {WEEKDAYS.map((d) => (
                      <div key={d} style={{ display: 'flex', height: 28, alignItems: 'center', justifyContent: 'center', color: d === '일' ? 'var(--color-text-red)' : d === '토' ? 'var(--color-text-blue)' : 'var(--color-text-primary)' }}>
                        <Text type="supporting" weight="medium" color="inherit">{d}</Text>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                    {weeks.map((week, wi) => (
                      <div key={wi} style={{ position: 'relative', display: 'grid', gridTemplateColumns: WEEK_GRID_COLUMNS, flex: 1, minHeight: DASH_CELL_FLOOR }}>
                        {week.map((date) => {
                          const inMonth = isSameMonth(date, month);
                          return (
                            <div
                              key={date.toISOString()}
                              style={{
                                position: 'relative',
                                minHeight: DASH_CELL_FLOOR,
                                padding: 'var(--spacing-1)',
                                borderRight: date.getDay() === 6 ? 'none' : GRID_LINE,
                                borderBottom: wi === weeks.length - 1 ? 'none' : GRID_LINE,
                                opacity: inMonth ? 1 : 0.4,
                                color: date.getDay() === 0 ? 'var(--color-text-red)' : date.getDay() === 6 ? 'var(--color-text-blue)' : 'var(--color-text-primary)',
                              }}
                            >
                              <span style={{ display: 'flex', height: 22, width: 22, alignItems: 'center', justifyContent: 'center', fontWeight: isToday(date) ? 'var(--font-weight-bold)' : 'var(--font-weight-medium)' }}>
                                <Text type="supporting" color="inherit">{format(date, 'd')}</Text>
                              </span>
                              {inMonth && (
                                <CalendarCellBars
                                  seed={date.getDate() + date.getMonth() * 3}
                                  barHeight={DASH_BAR_HEIGHT}
                                  gap={DASH_BAR_GAP}
                                  top={DASH_BAR_AREA_TOP}
                                  inset={DASH_BAR_EDGE_INSET}
                                  index={wi + date.getDay()}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </VStack>
          </Card>
        </div>
      </div>
    </div>
  );
}
