'use client';

/** 목욕 일지 — 날짜별 보기(기록·그 주 아직 안 한 분)와 월간 보기(가산·월 제공 일지 인쇄)를 오간다. */
import { useState } from 'react';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { ErrorBanner } from '@/components/lab/LabUi';
import { currentMonth, todayString } from '@/components/lab/labFormat';
import { useLabElders } from '@/components/lab/useLabElders';
import BathDayView from './BathDayView';
import BathMonthly from './BathMonthly';
import styles from './labRecords.module.css';

export default function BathLab() {
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
      {view === 'DAY' ? <BathDayView elders={elders} eldersLoading={isLoading} date={date} onDateChange={setDate} /> : <BathMonthly month={month} onMonthChange={setMonth} />}
    </div>
  );
}
