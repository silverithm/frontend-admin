'use client';

/**
 * 주간 식단 표 — 데스크톱은 요일 6열 × 9행, 휴대폰은 날짜별 카드로 쌓인다(같은 칸을 CSS로만 다르게 배치한다).
 * 속도를 위한 키: Enter = 다음 날 같은 칸, ↓/↑ = 같은 날 다음/이전 칸. Tab은 그날 위에서 아래로 간다.
 */
import { useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { TextInput } from '@astryxdesign/core/TextInput';
import { MEAL_SLOTS, MEAL_TEXT_LIMIT, getSlot, weekdayLabel } from '@/lib/lab/mealRules';
import type { MealSlotId } from '@/lib/lab/mealRules';
import type { MealDay } from '@/lib/lab/labTypes';
import { dateLabel } from '@/components/lab/labFormat';
import { aiKey } from './MealPlanDraft';
import styles from './labRecords.module.css';

interface TableProps {
  days: MealDay[];
  ai: Record<string, true>;
  /** 한 주에 겹친 주찬 날짜 */
  repeated: ReadonlySet<string>;
  /** 지난주 주찬과 같은 날짜 */
  sameAsLast: ReadonlySet<string>;
  today: string;
  isDisabled: boolean;
  onChange: (dayIndex: number, slot: MealSlotId, text: string) => void;
}

const cellName = (day: number, slot: MealSlotId) => `meal-${day}-${slot}`;

export default function MealPlanTable({ days, ai, repeated, sameAsLast, today, isDisabled, onChange }: TableProps) {
  const root = useRef<HTMLDivElement>(null);

  const focusCell = (day: number, slotIndex: number) => {
    const slot = MEAL_SLOTS[slotIndex];
    if (!slot || day < 0 || day >= days.length) return;
    const el = root.current?.querySelector<HTMLInputElement>(`input[name="${cellName(day, slot.id)}"]`);
    el?.focus();
    el?.select();
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>, day: number, slotIndex: number) => {
    if (e.nativeEvent.isComposing) return; // 한글 조합 중 Enter는 글자 확정이다
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) return focusCell(day - 1, slotIndex);
      if (day + 1 < days.length) focusCell(day + 1, slotIndex);
      else focusCell(0, slotIndex + 1); // 토요일 다음은 다음 행의 월요일
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusCell(day, slotIndex + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusCell(day, slotIndex - 1);
    }
  };

  return (
    <div className={styles.mealScroll} ref={root}>
      <div className={styles.mealGrid} role="group" aria-label="주간 식단표 입력">
        <div className={styles.mealCorner} aria-hidden />
        {MEAL_SLOTS.map((slot, i) => (
          <div key={slot.id} className={styles.mealRowLabel} style={{ gridRow: i + 2 }} aria-hidden>
            {slot.label}
          </div>
        ))}
        {days.map((day, di) => (
          <section key={day.date} className={styles.mealDay} style={{ gridColumn: di + 2 }} data-today={day.date === today ? 'true' : 'false'} aria-label={dateLabel(day.date)}>
            <div className={styles.mealDayHead}>
              <span>{weekdayLabel(day.date)}</span>
              <span className={styles.mutedText}>{Number(day.date.slice(5, 7))}/{Number(day.date.slice(8, 10))}</span>
            </div>
            {MEAL_SLOTS.map((slot, si) => {
              const isMain = slot.id === 'main';
              const dup = isMain && repeated.has(day.date);
              const same = isMain && sameAsLast.has(day.date);
              const cls = [styles.mealCell, ai[aiKey(day.date, slot.id)] ? styles.aiCell : '', dup ? styles.repeatCell : '', !dup && same ? styles.sameCell : ''].join(' ');
              return (
                <div key={slot.id} className={cls}>
                  <span className={styles.mealCellLabel}>{slot.label}</span>
                  <TextInput
                    label={`${weekdayLabel(day.date)}요일 ${slot.label}`}
                    isLabelHidden
                    size="sm"
                    htmlName={cellName(di, slot.id)}
                    value={getSlot(day, slot.id)}
                    isDisabled={isDisabled}
                    onChange={(v) => onChange(di, slot.id, v.slice(0, MEAL_TEXT_LIMIT))}
                    onKeyDown={(e) => onKey(e, di, si)}
                    placeholder={slot.id === 'soft' ? '예: 생선살 발라 으깸' : undefined}
                    status={dup ? { type: 'warning' } : undefined}
                  />
                  {dup && <span className={styles.cellNote}>이번 주 중복</span>}
                  {!dup && same && <span className={styles.cellNote}>지난주와 같음</span>}
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}
