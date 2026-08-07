'use client';

/**
 * 연간일정 — 한 해 12개월을 한 화면에 펼쳐 보는 뷰.
 *
 * 월간일정이 "이번 달 무엇을 하는가"를 본다면 여기서는 "올해 언제 무엇이 있는가"를 본다.
 * 연간 행사 계획을 세우거나 평가 자료를 만들 때 달을 오가지 않고 훑을 수 있게 하는 게 목적이다.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { format, startOfYear, endOfYear } from 'date-fns';
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

/**
 * 한 달에 한 번에 그리는 최대 건수.
 * 12개월을 한 화면에 펼치는 구조라 제한이 없으면 일정이 많은 기관에서 수천 개 DOM이 한꺼번에 생겨
 * 화면이 멈춘 것처럼 보인다. 넘치는 건 "+N건 더"로 접고 눌렀을 때만 펼친다.
 */
const MONTH_ITEM_LIMIT = 20;

/** 렌더링에 필요한 값을 미리 계산해 담아둔다 (렌더 중 날짜 파싱·색 계산을 없앤다) */
interface AnnualItem {
  schedule: Schedule;
  dayLabel: string;
  color: string;
}

interface AnnualScheduleViewProps {
  /** 월 제목을 누르면 그 달의 월간일정으로 이동시킨다. */
  onSelectMonth?: (date: Date) => void;
}

export default function AnnualScheduleView({ onSelectMonth }: AnnualScheduleViewProps) {
  const { showAlert } = useAlert();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  /** "+N건 더 보기"로 펼친 달 (연도를 바꾸면 접힌 상태로 돌아간다) */
  const [expandedMonths, setExpandedMonths] = useState<Record<number, boolean>>({});

  // 1년치 조회는 한 달치보다 훨씬 무겁다. 화살표를 연달아 누르면 요청이 쌓이고,
  // 먼저 보낸 응답이 늦게 도착해 나중 연도를 덮어쓰는 일이 생긴다.
  // 마지막 요청 번호를 들고 있다가 그 응답만 반영한다.
  const requestSeq = useRef(0);
  /** 이미 받아둔 연도는 다시 부르지 않는다 (연도를 오갈 때 매번 기다리지 않도록) */
  const yearCache = useRef(new Map<number, Schedule[]>());

  const loadYear = useCallback(async (targetYear: number) => {
    const cached = yearCache.current.get(targetYear);
    if (cached) {
      requestSeq.current += 1;
      setSchedules(cached);
      setIsLoading(false);
      return;
    }

    const seq = (requestSeq.current += 1);
    setIsLoading(true);
    try {
      const base = new Date(targetYear, 0, 1);
      const data = await getSchedules(
        format(startOfYear(base), 'yyyy-MM-dd'),
        format(endOfYear(base), 'yyyy-MM-dd'),
      );
      if (seq !== requestSeq.current) return; // 그 사이 다른 연도로 넘어갔다
      // 백엔드 응답은 래퍼 객체로 온다 — 배열을 직접 상태에 넣지 않는다.
      const list: Schedule[] = Array.isArray(data) ? data : data.schedules || [];
      yearCache.current.set(targetYear, list);
      setSchedules(list);
    } catch (error) {
      if (seq !== requestSeq.current) return;
      console.error('연간 일정 로드 실패:', error);
      showAlert({ type: 'error', title: '로드 실패', message: '연간 일정을 불러오지 못했습니다.' });
      setSchedules([]);
    } finally {
      if (seq === requestSeq.current) setIsLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    setExpandedMonths({});
    loadYear(year);
  }, [year, loadYear]);

  /**
   * 월별로 나눈다. 여러 달에 걸친 일정은 걸친 달마다 모두 넣는다 —
   * "3월에 뭐가 있나" 하고 볼 때 2월에 시작한 행사도 보여야 하기 때문이다.
   */
  const byMonth = useMemo(() => {
    const buckets: AnnualItem[][] = Array.from({ length: 12 }, () => []);
    // 날짜는 'yyyy-MM-dd' 문자열이라 Date로 만들지 않고 잘라 쓴다.
    // 1년치는 건수가 많아 Date 생성 비용이 그대로 체감으로 이어진다.
    for (const schedule of schedules) {
      const start = schedule.startDate?.substring(0, 10);
      if (!start || start.length < 10) continue;
      const end = schedule.endDate?.substring(0, 10) || start;

      const startYear = Number(start.substring(0, 4));
      const startMonth = Number(start.substring(5, 7)) - 1;
      const endYear = Number(end.substring(0, 4));
      const endMonth = Number(end.substring(5, 7)) - 1;

      const from = startYear < year ? 0 : startMonth;
      const to = endYear > year ? 11 : endMonth;
      if (Number.isNaN(from) || Number.isNaN(to)) continue;

      for (let m = Math.max(from, 0); m <= to && m <= 11; m += 1) {
        buckets[m].push({
          schedule,
          // 그 달에 시작하는 일정만 날짜를 보여준다. 이어져 온 일정은 '·'
          dayLabel: startYear === year && startMonth === m ? String(Number(start.substring(8, 10))) : '·',
          color: getScheduleColor(schedule),
        });
      }
    }
    for (const bucket of buckets) {
      bucket.sort((a, b) => a.schedule.startDate.localeCompare(b.schedule.startDate));
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

      {isLoading && schedules.length === 0 ? (
        <div className="carev-annual-body" style={{ display: 'flex' }}>
          <Loading size="section" label="연간 일정을 불러오는 중..." />
        </div>
      ) : (
        // 연도를 바꿔 다시 불러오는 중에는 화면을 비우지 않고 흐리게만 둔다.
        // 통째로 사라졌다 나타나면 멈춘 것처럼 보인다.
        <div className="carev-annual-body" style={isLoading ? { opacity: 0.5, pointerEvents: 'none' } : undefined}>
          <div className="carev-annual-grid">
            {MONTH_LABELS.map((monthLabel, index) => {
              const items = byMonth[index];
              const isCurrent = year === thisYear && index === thisMonth;
              const expanded = !!expandedMonths[index];
              const shown = expanded ? items : items.slice(0, MONTH_ITEM_LIMIT);
              const restCount = items.length - shown.length;
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
                      <>
                        {shown.map(({ schedule, dayLabel, color }) => (
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
                        ))}
                        {restCount > 0 && (
                          <Button
                            label={`+${restCount}건 더 보기`}
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpandedMonths((prev) => ({ ...prev, [index]: true }))}
                          />
                        )}
                      </>
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
