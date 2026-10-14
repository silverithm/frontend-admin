'use client';

/**
 * 월간 점검 달력 — 날짜마다 그날 해야 하는 매일 점검(주방·위생·차량)을 몇 개 했는지 "2/3"으로 보여 준다.
 * 색만으로 알리지 않고 글자로도 쓴다. 운영일 편집을 켜면 날짜를 눌러 휴원일(공휴일 등)로 빼거나 되돌린다.
 */
import { useMemo } from 'react';
import type { SafetyCheck, SafetyKind } from '@/lib/lab/labTypes';
import { isPerformed } from '@/lib/lab/safetyRules';
import { monthDates, todayString, weekdayIndex } from '@/components/lab/labFormat';
import styles from './labRecords.module.css';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

interface CalendarProps {
  month: string;
  checks: SafetyCheck[];
  operating: ReadonlySet<string>;
  closed: ReadonlySet<string>;
  dailyKinds: readonly SafetyKind[];
  editMode: boolean;
  selected: string;
  onSelect: (date: string) => void;
  onToggleClosed: (date: string) => void;
}

export default function SafetyCheckCalendar({ month, checks, operating, closed, dailyKinds, editMode, selected, onSelect, onToggleClosed }: CalendarProps) {
  const today = todayString();
  const dates = useMemo(() => monthDates(month), [month]);
  const byDate = useMemo(() => {
    const map = new Map<string, Set<SafetyKind>>();
    for (const c of checks) {
      if (!isPerformed(c)) continue;
      const key = c.checkDate.slice(0, 10);
      const set = map.get(key) ?? new Set<SafetyKind>();
      set.add(c.kind);
      map.set(key, set);
    }
    return map;
  }, [checks]);
  const lead = dates.length > 0 ? weekdayIndex(dates[0]) : 0;

  return (
    <div className={styles.calendar} role="group" aria-label={`${month} 점검 달력`}>
      {WEEKDAYS.map((w) => (
        <div key={w} className={styles.calendarHead} aria-hidden>
          {w}
        </div>
      ))}
      {Array.from({ length: lead }, (_, i) => (
        <div key={`blank-${i}`} className={styles.calendarBlank} aria-hidden />
      ))}
      {dates.map((date) => {
        const day = Number(date.slice(8, 10));
        const weekday = weekdayIndex(date) >= 1 && weekdayIndex(date) <= 5;
        const isClosed = closed.has(date);
        const isOperating = operating.has(date);
        const done = byDate.get(date) ?? new Set<SafetyKind>();
        const dailyDone = dailyKinds.filter((k) => done.has(k)).length;
        const other = [...done].filter((k) => !dailyKinds.includes(k)).length;
        const future = date > today;
        let state: 'full' | 'part' | 'none' | 'off' | 'future' = 'off';
        if (isOperating && !future) {
          if (dailyKinds.length === 0) state = done.size > 0 ? 'full' : 'none';
          else state = dailyDone === dailyKinds.length ? 'full' : dailyDone > 0 ? 'part' : 'none';
        } else if (isOperating) state = 'future';
        // 주말이거나 휴원일에도 점검 기록이 있으면 숨기지 않는다
        const label = !weekday ? '주말' : isClosed ? '휴원' : isOperating && dailyKinds.length > 0 ? `${dailyDone}/${dailyKinds.length}` : '';
        const canToggle = editMode && weekday;
        return (
          <button
            key={date}
            type="button"
            className={styles.calendarCell}
            aria-pressed={editMode ? isClosed : selected === date}
            data-today={date === today ? 'true' : 'false'}
            data-state={state}
            data-edit={editMode ? 'true' : 'false'}
            disabled={editMode && !weekday}
            aria-label={`${Number(month.slice(5, 7))}월 ${day}일, ${editMode ? (isClosed ? '휴원일, 누르면 운영일로 되돌림' : weekday ? '운영일, 누르면 휴원일로 뺌' : '주말') : isOperating ? `매일 점검 ${dailyKinds.length}개 중 ${dailyDone}개 완료` : isClosed ? '휴원일' : '운영일 아님'}${other > 0 ? `, 그 밖의 점검 ${other}건` : ''}`}
            onClick={() => (canToggle ? onToggleClosed(date) : editMode ? undefined : onSelect(date))}
          >
            <span className={styles.dayNum}>{day}</span>
            <span className={styles.calendarMark}>{label}</span>
            {other > 0 && <span className={styles.calendarOther}>+{other}</span>}
          </button>
        );
      })}
    </div>
  );
}
