'use client';

/**
 * 연간일정 — 한 해 12개월을 한 화면에 펼쳐 보는 뷰.
 *
 * 월간일정이 "이번 달 무엇을 하는가"를 본다면 여기서는 "올해 언제 무엇이 있는가"를 본다.
 * 연간 행사 계획을 세우거나 평가 자료를 만들 때 달을 오가지 않고 훑을 수 있게 하는 게 목적이다.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { format, startOfYear, endOfYear, parseISO } from 'date-fns';
import { Button } from '@astryxdesign/core/Button';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Text } from '@astryxdesign/core/Text';
import { Icon } from '@astryxdesign/core/Icon';
import { Badge } from '@astryxdesign/core/Badge';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { IconCalendarStats } from '@tabler/icons-react';
import { Loading } from '@/components/Loading';
import { getSchedules } from '@/lib/apiService';
import { Schedule, getScheduleColor, withAlpha } from '@/types/schedule';
import { useAlert } from './Alert';

const MONTH_LABELS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

interface AnnualScheduleViewProps {
  /** 월 제목을 누르면 그 달의 월간일정으로 이동시킨다. */
  onSelectMonth?: (date: Date) => void;
}

export default function AnnualScheduleView({ onSelectMonth }: AnnualScheduleViewProps) {
  const { showAlert } = useAlert();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadYear = useCallback(async (targetYear: number) => {
    setIsLoading(true);
    try {
      const base = new Date(targetYear, 0, 1);
      const data = await getSchedules(
        format(startOfYear(base), 'yyyy-MM-dd'),
        format(endOfYear(base), 'yyyy-MM-dd'),
      );
      // 백엔드 응답은 래퍼 객체로 온다 — 배열을 직접 상태에 넣지 않는다.
      setSchedules(Array.isArray(data) ? data : data.schedules || []);
    } catch (error) {
      console.error('연간 일정 로드 실패:', error);
      showAlert({ type: 'error', title: '로드 실패', message: '연간 일정을 불러오지 못했습니다.' });
      setSchedules([]);
    } finally {
      setIsLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    loadYear(year);
  }, [year, loadYear]);

  /**
   * 월별로 나눈다. 여러 달에 걸친 일정은 걸친 달마다 모두 넣는다 —
   * "3월에 뭐가 있나" 하고 볼 때 2월에 시작한 행사도 보여야 하기 때문이다.
   */
  const byMonth = useMemo(() => {
    const buckets: Schedule[][] = Array.from({ length: 12 }, () => []);
    for (const schedule of schedules) {
      const start = parseISO(schedule.startDate);
      const end = schedule.endDate ? parseISO(schedule.endDate) : start;
      if (Number.isNaN(start.getTime())) continue;

      const from = start.getFullYear() < year ? 0 : start.getMonth();
      const to = end.getFullYear() > year ? 11 : (Number.isNaN(end.getTime()) ? start.getMonth() : end.getMonth());
      for (let m = from; m <= to && m <= 11; m += 1) {
        if (m >= 0) buckets[m].push(schedule);
      }
    }
    for (const bucket of buckets) {
      bucket.sort((a, b) => a.startDate.localeCompare(b.startDate));
    }
    return buckets;
  }, [schedules, year]);

  const total = schedules.length;
  const thisYear = new Date().getFullYear();
  const thisMonth = new Date().getMonth();

  return (
    <div className="carev-annual-root">
      {/* 연도 이동 */}
      <div className="carev-annual-header">
        <HStack gap={2} vAlign="center">
          <IconButton
            label="이전 해"
            variant="ghost"
            size="sm"
            icon={<Icon icon="chevronLeft" size="sm" />}
            onClick={() => setYear((y) => y - 1)}
          />
          <Text type="large" weight="bold" color="primary">{year}년</Text>
          <IconButton
            label="다음 해"
            variant="ghost"
            size="sm"
            icon={<Icon icon="chevronRight" size="sm" />}
            onClick={() => setYear((y) => y + 1)}
          />
          {year !== thisYear && (
            <Button label="올해" variant="ghost" size="sm" onClick={() => setYear(thisYear)} />
          )}
        </HStack>
        <Text type="supporting" color="secondary">연간 {total}건</Text>
      </div>

      {isLoading ? (
        <div className="carev-annual-body" style={{ display: 'flex' }}>
          <Loading size="section" label="연간 일정을 불러오는 중..." />
        </div>
      ) : (
        <div className="carev-annual-body">
          <div className="carev-annual-grid">
            {MONTH_LABELS.map((monthLabel, index) => {
              const items = byMonth[index];
              const isCurrent = year === thisYear && index === thisMonth;
              return (
                <section
                  key={monthLabel}
                  className={`carev-annual-month${isCurrent ? ' carev-annual-month-current' : ''}`}
                >
                  <header className="carev-annual-month-head">
                    <button
                      type="button"
                      className="carev-annual-month-title"
                      onClick={() => onSelectMonth?.(new Date(year, index, 1))}
                      title={`${year}년 ${monthLabel} 월간일정으로 이동`}
                    >
                      <Text type="label" weight="bold" color={isCurrent ? 'accent' : 'primary'}>{monthLabel}</Text>
                    </button>
                    {items.length > 0 && <Badge variant="neutral" label={items.length} />}
                  </header>

                  <div className="carev-annual-month-list">
                    {items.length === 0 ? (
                      <Text type="supporting" color="disabled">일정 없음</Text>
                    ) : (
                      items.map((schedule) => {
                        const color = getScheduleColor(schedule);
                        const day = parseISO(schedule.startDate);
                        const dayLabel = day.getMonth() === index ? format(day, 'd') : '·';
                        return (
                          <div
                            key={`${schedule.id}-${index}`}
                            className="carev-annual-item"
                            style={{ background: withAlpha(color, 0.1), borderLeft: `3px solid ${color}` }}
                            title={schedule.title}
                          >
                            <span className="carev-annual-item-day">
                              <Text type="supporting" color="secondary">{dayLabel}</Text>
                            </span>
                            <Text type="supporting" color="primary" maxLines={1}>{schedule.title}</Text>
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>
              );
            })}
          </div>

          {total === 0 && (
            <div className="carev-annual-empty">
              <VStack gap={2} hAlign="center">
                <Icon icon={IconCalendarStats} size="lg" color="tertiary" />
                <Text type="body" color="secondary">{year}년에 등록된 일정이 없습니다.</Text>
                <Text type="supporting" color="disabled">월간일정에서 일정을 등록하시면 여기에 모여서 보입니다.</Text>
              </VStack>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
