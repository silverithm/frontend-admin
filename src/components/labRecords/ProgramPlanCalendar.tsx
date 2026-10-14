'use client';

/**
 * 월간 계획표 달력 — 월요일부터 7칸. 쉬는 날은 흐리게 보이고, 칸마다 그날 프로그램이 한 줄씩 나온다.
 * 휴대폰 폭(640px 이하)에서는 같은 칸이 날짜별 목록으로 바뀐다(운영일과 프로그램이 있는 날만).
 */
import { useMemo } from 'react';
import type { ScheduleItem } from '@/lib/lab/labTypes';
import { monthDates, todayString, weekdayIndex, weekdayKo } from '@/components/lab/labFormat';
import own from './ProgramPlan.module.css';

const HEADS = ['월', '화', '수', '목', '금', '토', '일'];

export function markClass(category: ScheduleItem['category']): string {
  if (category === 'COGNITIVE') return own.calMarkCognitive;
  if (category === 'PHYSICAL') return own.calMarkPhysical;
  if (category === 'SOCIAL') return own.calMarkSocial;
  return '';
}

interface Props {
  month: string;
  items: ReadonlyArray<ScheduleItem>;
  operatingDays: ReadonlyArray<string>;
  selectedDate: string | null;
  onSelect: (date: string | null) => void;
}

export default function ProgramPlanCalendar({ month, items, operatingDays, selectedDate, onSelect }: Props) {
  const today = todayString();
  const dates = useMemo(() => monthDates(month), [month]);
  const operating = useMemo(() => new Set(operatingDays), [operatingDays]);
  const byDate = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    for (const it of items) {
      const key = it.date.slice(0, 10);
      map.set(key, [...(map.get(key) ?? []), it]);
    }
    return map;
  }, [items]);
  const lead = dates.length > 0 ? (weekdayIndex(dates[0]) + 6) % 7 : 0;

  return (
    <div className={own.cal} role="group" aria-label={`${month} 프로그램 계획표 달력`}>
      {HEADS.map((w) => (
        <div key={w} className={own.calHead} aria-hidden>
          {w}
        </div>
      ))}
      {Array.from({ length: lead }, (_, i) => (
        <div key={`blank-${i}`} className={own.calBlank} aria-hidden />
      ))}
      {dates.map((date) => {
        const list = byDate.get(date) ?? [];
        const open = operating.has(date);
        const day = Number(date.slice(8, 10));
        return (
          <button
            key={date}
            type="button"
            className={own.calCell}
            aria-pressed={selectedDate === date}
            data-operating={open ? 'true' : 'false'}
            data-empty={list.length === 0 ? 'true' : 'false'}
            data-today={date === today ? 'true' : 'false'}
            aria-label={`${Number(month.slice(5, 7))}월 ${day}일 ${weekdayKo(date)}요일${open ? '' : ', 쉬는 날'}, 프로그램 ${list.length}개`}
            onClick={() => onSelect(selectedDate === date ? null : date)}
          >
            <span className={own.calDay}>
              {day}
              <span className={own.calDayWeek}>{weekdayKo(date)}</span>
            </span>
            {list.length === 0 ? (
              <span className={own.calEmpty}>{open ? '+ 넣기' : ''}</span>
            ) : (
              list.map((it, i) => (
                <span key={`${it.startTime ?? ''}-${it.title}-${i}`} className={own.calItem}>
                  <span className={`${own.calMark} ${markClass(it.category)}`} aria-hidden />
                  <span>
                    {it.startTime ? `${it.startTime} ` : ''}
                    {it.title}
                  </span>
                </span>
              ))
            )}
          </button>
        );
      })}
    </div>
  );
}
