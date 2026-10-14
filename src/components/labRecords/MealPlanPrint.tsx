'use client';

/**
 * 주간 식단표 인쇄본 — A4 가로 한 장, 표 하나. 화면에서는 보이지 않고 인쇄할 때만 나타난다.
 * 인쇄는 화면 전체가 아니라 이 표만 나가야 하므로 body 바로 아래(portal)에 그리고 다른 자식은 인쇄에서 숨긴다.
 */
import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import type { MealDay } from '@/lib/lab/labTypes';
import { MEAL_SLOTS, getSlot, weekdayLabel } from '@/lib/lab/mealRules';
import { companyNameStored, dotDate, todayString } from '@/components/lab/labFormat';
import styles from './labRecords.module.css';

interface PrintProps {
  weekStart: string;
  days: MealDay[];
  notes: string;
  writer: string;
}

export default function MealPlanPrint({ weekStart, days, notes, writer }: PrintProps) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setHost(document.body);
  }, []);
  if (!host) return null;
  const last = days[days.length - 1]?.date ?? weekStart;
  const company = companyNameStored();

  return createPortal(
    // 포털은 Astryx 테마 바깥(body 바로 아래)에 놓이므로, 토큰이 닿도록 테마 속성을 직접 단다
    <div className={styles.printRoot} data-lab-print-root="" data-astryx-theme="neutral">
      <style>{`
        @page { size: A4 landscape; margin: 10mm; }
        @media print {
          body > *:not([data-lab-print-root]) { display: none !important; }
          html, body { background: var(--color-background-card) !important; height: auto !important; overflow: visible !important; }
        }
      `}</style>
      <h1 className={styles.printTitle}>주간 식단표</h1>
      <div className={styles.printMeta}>
        {company && <span>기관: {company}</span>}
        <span>
          기간: {dotDate(weekStart)} ~ {dotDate(last)}
        </span>
        {writer && <span>작성자: {writer}</span>}
      </div>
      <table className={`${styles.sheetTable} ${styles.mealPrintTable}`}>
        <thead>
          <tr>
            <th scope="col" className={styles.mealPrintLabel}>
              구분
            </th>
            {days.map((d) => (
              <th key={d.date} scope="col">
                {weekdayLabel(d.date)} ({Number(d.date.slice(5, 7))}/{Number(d.date.slice(8, 10))})
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MEAL_SLOTS.map((slot) => (
            <tr key={slot.id}>
              <th scope="row" className={styles.mealPrintLabel}>
                {slot.label}
              </th>
              {days.map((d) => (
                <td key={d.date}>{getSlot(d, slot.id) || ' '}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {notes.trim() !== '' && <p className={styles.printNote}>비고: {notes}</p>}
      <p className={styles.printNote}>이 출력본은 케어브이 실험실에서 만든 참고용입니다. 출력일 {dotDate(todayString())}</p>
    </div>,
    host,
  );
}
