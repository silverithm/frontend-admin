'use client';

/**
 * 월별 급여제공기록지 표 — 날짜 한 줄씩. 화면 미리보기와 인쇄본이 같은 표를 쓴다.
 * 인쇄는 화면 전체가 아니라 이 표만 나가야 하므로, 인쇄용 사본을 body 바로 아래(portal)에 따로 그리고
 * 인쇄할 때 body의 다른 자식은 모두 숨긴다. 관리자 화면의 스크롤 영역 안에서는 긴 표가 잘려 나오기 때문이다.
 */
import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import type { CareRecord } from '@/lib/lab/labTypes';
import { dotDate, monthDates, monthLabel, todayString, weekdayIndex } from './labFormat';
import styles from './lab.module.css';

const COLUMNS: ReadonlyArray<{ key: keyof CareRecord; label: string; width: string }> = [
  { key: 'physical', label: '신체활동 지원', width: '15%' },
  { key: 'cognitive', label: '인지 지원', width: '14%' },
  { key: 'meal', label: '식사', width: '9%' },
  { key: 'toilet', label: '배설', width: '9%' },
  { key: 'bath', label: '목욕', width: '8%' },
  { key: 'nursing', label: '간호·처치', width: '10%' },
  { key: 'training', label: '기능회복훈련', width: '12%' },
  { key: 'specialNote', label: '특이사항', width: '12%' },
];

export function CareMonthlyTable({ month, records }: { month: string; records: CareRecord[] }) {
  const byDate = new Map(records.map((r) => [r.recordDate.slice(0, 10), r]));
  return (
    <table className={styles.sheetTable}>
      <colgroup>
        <col style={{ width: '6%' }} />
        {COLUMNS.map((c) => (
          <col key={c.key} style={{ width: c.width }} />
        ))}
        <col style={{ width: '5%' }} />
      </colgroup>
      <thead>
        <tr>
          <th scope="col">날짜</th>
          {COLUMNS.map((c) => (
            <th scope="col" key={c.key}>
              {c.label}
            </th>
          ))}
          <th scope="col">제공자</th>
        </tr>
      </thead>
      <tbody>
        {monthDates(month).map((date) => {
          const record = byDate.get(date);
          const wd = weekdayIndex(date);
          return (
            <tr key={date} className={wd === 0 || wd === 6 ? styles.sheetWeekend : undefined}>
              <td>{`${Number(date.slice(8, 10))}일(${['일', '월', '화', '수', '목', '금', '토'][wd]})`}</td>
              {COLUMNS.map((c) => (
                <td key={c.key}>{record ? (record[c.key] as string | null) ?? '' : ''}</td>
              ))}
              <td>{record?.providerName ?? ''}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

interface PrintSheetProps {
  month: string;
  elderName: string;
  companyName: string;
  records: CareRecord[];
}

/** 인쇄 전용 사본. 화면에서는 보이지 않고, 인쇄할 때만 나타난다. */
export function CareMonthlyPrint({ month, elderName, companyName, records }: PrintSheetProps) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setHost(document.body);
  }, []);
  if (!host) return null;

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
      <h1 className={styles.printTitle}>급여제공기록 (월별) — 실험실 출력본</h1>
      <div className={styles.printMeta}>
        {companyName && <span>기관: {companyName}</span>}
        <span>수급자: {elderName}</span>
        <span>기간: {monthLabel(month)}</span>
        <span>출력일: {dotDate(todayString())}</span>
      </div>
      <CareMonthlyTable month={month} records={records} />
      <p className={styles.printNote}>
        이 출력본은 케어브이 실험실에서 만든 참고용입니다. 공단 공식 서식(별지 제15호)이 아니므로, 제출·보관용은 공단 서식을 확인해 사용해 주세요.
      </p>
      <p className={styles.printSign}>작성자 확인 (서명): ______________________</p>
    </div>,
    host,
  );
}
