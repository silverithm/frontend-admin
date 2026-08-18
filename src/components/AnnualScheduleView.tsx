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
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { IconCircleCheck } from '@tabler/icons-react';
import { Loading } from '@/components/Loading';
import { getSchedules } from '@/lib/apiService';
import { Schedule, SCHEDULE_CATEGORIES, getScheduleColor } from '@/types/schedule';
import { useAlert } from './Alert';

const MONTH_LABELS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

const categoryLabel = (category?: string) =>
  SCHEDULE_CATEGORIES.find((c) => c.value === category)?.label ?? '기타';

/** 'yyyy-MM-dd' → '2026.08.08' (Date로 만들지 않아 시간대에 흔들리지 않는다) */
const dotted = (iso?: string) => {
  const d = iso?.substring(0, 10);
  return d && d.length === 10 ? `${d.substring(0, 4)}.${d.substring(5, 7)}.${d.substring(8, 10)}` : '';
};

/** 하루짜리면 날짜 하나만, 여러 날이면 시작~종료로 보여준다 */
const periodText = (schedule: Schedule) => {
  const start = dotted(schedule.startDate);
  const end = dotted(schedule.endDate);
  const range = !end || end === start ? start : `${start} ~ ${end}`;
  if (schedule.isAllDay) return `${range} · 종일`;
  const time = [schedule.startTime, schedule.endTime]
    .filter(Boolean)
    .map((t) => (t as string).slice(0, 5))
    .join(' ~ ');
  return time ? `${range} · ${time}` : range;
};

/** 라벨과 값을 한 줄로 놓는 상세 항목 */
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <HStack gap={3} vAlign="start">
      <span style={{ flexShrink: 0, width: 56 }}>
        <Text type="supporting" color="secondary">{label}</Text>
      </span>
      <Text type="body" color="primary">{value}</Text>
    </HStack>
  );
}

/**
 * 한 달에 한 번에 그리는 최대 건수.
 * 12개월을 한 화면에 펼치는 구조라 제한이 없으면 일정이 많은 기관에서 수천 개 DOM이 한꺼번에 생겨
 * 화면이 멈춘 것처럼 보인다. 넘치는 건 "+N건 더"로 접고 눌렀을 때만 펼친다.
 */
const MONTH_ITEM_LIMIT = 20;

/** 렌더링에 필요한 값을 미리 계산해 담아둔다 (렌더 중 날짜 파싱을 없앤다) */
interface AnnualItem {
  schedule: Schedule;
  dayLabel: string;
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
  /** 상세를 보고 있는 일정. 목록 응답에 할 일·참석자까지 들어 있어 추가 조회가 필요 없다. */
  const [detail, setDetail] = useState<Schedule | null>(null);

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
        <Text type="supporting" color="secondary">
          {total === 0 ? '월간일정에서 등록하면 여기에 모여 보입니다' : `연간 ${total}건`}
        </Text>
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

                  <div className={`carev-annual-month-list${items.length === 0 ? ' carev-annual-month-list-empty' : ''}`}>
                    {items.length === 0 ? (
                      <Text type="supporting" color="disabled">일정 없음</Text>
                    ) : (
                      <>
                        {shown.map(({ schedule, dayLabel }) => (
                          <button
                            key={`${schedule.id}-${index}`}
                            type="button"
                            className="carev-annual-item"
                            title={schedule.title}
                            onClick={() => setDetail(schedule)}
                          >
                            <span className="carev-annual-item-day">
                              <Text type="supporting" color="secondary">{dayLabel}</Text>
                            </span>
                            {/* 월간일정과 같은 색 규칙 — 일정에 고른 색이 있으면 그 색, 없으면 카테고리 기본색 */}
                            <span
                              className="carev-annual-item-dot"
                              style={{
                                backgroundColor: getScheduleColor(schedule),
                                opacity: schedule.isCompleted ? 0.4 : 1,
                              }}
                            />
                            <span
                              style={{
                                minWidth: 0,
                                textDecoration: schedule.isCompleted ? 'line-through' : 'none',
                                opacity: schedule.isCompleted ? 0.6 : 1,
                              }}
                            >
                              <Text type="supporting" color="primary" maxLines={1}>{schedule.title}</Text>
                            </span>
                          </button>
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

          {/* 일정 상세 — 월간일정과 같은 내용을 보여준다. 고치거나 지우는 건 월간일정에서 한다. */}
          <Dialog
            isOpen={!!detail}
            onOpenChange={(open) => { if (!open) setDetail(null); }}
            purpose="info"
            width={560}
          >
            {detail && (
              <Layout
                header={
                  <DialogHeader
                    title={detail.title}
                    subtitle={categoryLabel(detail.category)}
                    onOpenChange={(open) => { if (!open) setDetail(null); }}
                  />
                }
                content={
                  <LayoutContent>
                    <VStack gap={4}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--spacing-2)',
                          padding: 'var(--spacing-3)',
                          borderRadius: 'var(--radius-inner)',
                          border: `1px solid ${detail.isCompleted ? 'var(--color-border-green)' : 'var(--color-border)'}`,
                          background: detail.isCompleted ? 'var(--color-background-green)' : 'var(--color-background-muted)',
                        }}
                      >
                        <Icon icon={IconCircleCheck} size="md" color={detail.isCompleted ? 'success' : 'tertiary'} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Text type="body" weight="medium" color="primary">
                            {detail.isCompleted ? '수행완료' : '진행 예정'}
                          </Text>
                          {detail.isCompleted && (
                            <Text type="supporting" color="secondary">
                              {detail.completedByName ? `${detail.completedByName} · ` : ''}
                              {detail.completedAt ? format(new Date(detail.completedAt), 'yyyy.MM.dd HH:mm') : ''}
                            </Text>
                          )}
                        </div>
                      </div>

                      <DetailRow label="기간" value={periodText(detail)} />
                      {detail.location && <DetailRow label="장소" value={detail.location} />}
                      {detail.managerName && <DetailRow label="담당자" value={detail.managerName} />}
                      {detail.participants && detail.participants.length > 0 && (
                        <DetailRow
                          label="참석자"
                          value={detail.participants.map((p) => p.userName).join(', ')}
                        />
                      )}
                      {detail.content && (
                        <VStack gap={1} align="start">
                          <Text type="supporting" color="secondary">내용</Text>
                          <Text type="body" color="primary" style={{ whiteSpace: 'pre-wrap' }}>{detail.content}</Text>
                        </VStack>
                      )}
                      {detail.tasks && detail.tasks.length > 0 && (
                        <VStack gap={2} align="start">
                          <Text type="supporting" color="secondary">
                            할 일 {detail.tasks.filter((t) => t.isCompleted).length}/{detail.tasks.length}
                          </Text>
                          {detail.tasks.map((task) => (
                            <HStack key={task.id} gap={2} vAlign="center">
                              <Icon
                                icon={IconCircleCheck}
                                size="sm"
                                color={task.isCompleted ? 'success' : 'tertiary'}
                              />
                              <Text
                                type="body"
                                color={task.isCompleted ? 'secondary' : 'primary'}
                                style={task.isCompleted ? { textDecoration: 'line-through' } : undefined}
                              >
                                {task.content}
                                {task.assigneeName ? ` · ${task.assigneeName}` : ''}
                              </Text>
                            </HStack>
                          ))}
                        </VStack>
                      )}
                      {detail.authorName && <DetailRow label="작성자" value={detail.authorName} />}
                    </VStack>
                  </LayoutContent>
                }
                footer={
                  <LayoutFooter hasDivider>
                    <HStack gap={2} hAlign="end">
                      <Button label="닫기" variant="ghost" onClick={() => setDetail(null)} />
                      {onSelectMonth && (
                        <Button
                          label="월간일정에서 열기"
                          variant="primary"
                          onClick={() => {
                            const start = detail.startDate?.substring(0, 10) ?? '';
                            const y = Number(start.substring(0, 4));
                            const m = Number(start.substring(5, 7)) - 1;
                            setDetail(null);
                            if (Number.isFinite(y) && Number.isFinite(m)) {
                              onSelectMonth(new Date(y, m, 1));
                            }
                          }}
                        />
                      )}
                    </HStack>
                  </LayoutFooter>
                }
              />
            )}
          </Dialog>
        </div>
      )}
    </div>
  );
}
