'use client';

/** 월 달력 — 날짜마다 프로그램 수를 점으로 보여 주고(인지 프로그램은 색을 달리), 날짜를 누르면 그날 목록만 본다. */
import { useMemo } from 'react';
import type { Program } from '@/lib/lab/labTypes';
import { monthDates, todayString, weekdayIndex } from '@/components/lab/labFormat';
import styles from './labRecords.module.css';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

interface CalendarProps {
  month: string;
  programs: Program[];
  selectedDate: string | null;
  onSelect: (date: string | null) => void;
}

export default function ProgramLogCalendar({ month, programs, selectedDate, onSelect }: CalendarProps) {
  const today = todayString();
  const dates = useMemo(() => monthDates(month), [month]);
  const byDate = useMemo(() => {
    const map = new Map<string, Program[]>();
    for (const p of programs) {
      const key = p.programDate.slice(0, 10);
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return map;
  }, [programs]);
  const lead = dates.length > 0 ? weekdayIndex(dates[0]) : 0;

  return (
    <div className={styles.calendar} role="group" aria-label={`${month} 프로그램 달력`}>
      {WEEKDAYS.map((w) => (
        <div key={w} className={styles.calendarHead} aria-hidden>
          {w}
        </div>
      ))}
      {Array.from({ length: lead }, (_, i) => (
        <div key={`blank-${i}`} className={styles.calendarBlank} aria-hidden />
      ))}
      {dates.map((date) => {
        const list = byDate.get(date) ?? [];
        const cognitive = list.filter((p) => p.category === 'COGNITIVE').length;
        return (
          <button
            key={date}
            type="button"
            className={styles.calendarCell}
            aria-pressed={selectedDate === date}
            data-today={date === today ? 'true' : 'false'}
            aria-label={`${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일, 프로그램 ${list.length}개${cognitive > 0 ? `, 인지 ${cognitive}개` : ''}`}
            onClick={() => onSelect(selectedDate === date ? null : date)}
          >
            <span className={styles.dayNum}>{Number(date.slice(8, 10))}</span>
            <span className={styles.dayDots}>
              {list.slice(0, 4).map((p) => (
                <span key={p.id} className={`${styles.dot} ${p.category === 'COGNITIVE' ? styles.dotCognitive : ''}`} />
              ))}
            </span>
          </button>
        );
      })}
    </div>
  );
}
