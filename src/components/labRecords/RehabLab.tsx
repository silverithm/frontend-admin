'use client';

/** 기능회복훈련 — 날짜별 보기(기록·고치기)와 월간 보기(어르신별 요약·인쇄)를 오간다. */
import { useState } from 'react';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { ErrorBanner } from '@/components/lab/LabUi';
import { currentMonth, todayString } from '@/components/lab/labFormat';
import { useLabElders } from '@/components/lab/useLabElders';
import RehabDayView from './RehabDayView';
import RehabMonthly from './RehabMonthly';
import styles from './labRecords.module.css';

export default function RehabLab() {
  const { elders, isLoading, error, reload } = useLabElders();
  const [view, setView] = useState<'DAY' | 'MONTH'>('DAY');
  const [date, setDate] = useState(todayString);
  const [month, setMonth] = useState(currentMonth);

  return (
    <div className={styles.stack}>
      <div>
        <SegmentedControl label="보기" value={view} onChange={(v) => v && setView(v as 'DAY' | 'MONTH')}>
          <SegmentedControlItem value="DAY" label="날짜별" />
          <SegmentedControlItem value="MONTH" label="월간" />
        </SegmentedControl>
      </div>
      {error && <ErrorBanner message={error} onRetry={() => void reload()} />}
      {view === 'DAY' ? (
        <RehabDayView elders={elders} eldersLoading={isLoading} date={date} onDateChange={setDate} />
      ) : (
        <RehabMonthly month={month} onMonthChange={setMonth} />
      )}
    </div>
  );
}
