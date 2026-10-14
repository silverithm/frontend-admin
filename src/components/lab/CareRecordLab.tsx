'use client';

/** 급여제공기록 — 하루 기록 · 월별 기록지 · 제공대장 세 화면을 묶는다. */
import { useState } from 'react';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { ErrorBanner } from './LabUi';
import CareRecordLabDaily from './CareRecordLabDaily';
import CareRecordLabDelivery from './CareRecordLabDelivery';
import CareRecordLabMonthly from './CareRecordLabMonthly';
import { useLabElders } from './useLabElders';
import styles from './lab.module.css';

type CareView = 'daily' | 'monthly' | 'delivery';

export default function CareRecordLab() {
  const [view, setView] = useState<CareView>('daily');
  const { elders, isLoading, error, reload } = useLabElders();

  return (
    <div className={styles.stack}>
      <SegmentedControl label="급여제공기록 보기" value={view} onChange={(v) => setView(v as CareView)} size="sm">
        <SegmentedControlItem value="daily" label="하루 기록" />
        <SegmentedControlItem value="monthly" label="월별 기록지" />
        <SegmentedControlItem value="delivery" label="제공대장" />
      </SegmentedControl>

      {error && <ErrorBanner message={error} onRetry={() => void reload()} />}

      {view === 'daily' && <CareRecordLabDaily elders={elders} eldersLoading={isLoading} />}
      {view === 'monthly' && <CareRecordLabMonthly elders={elders} eldersLoading={isLoading} />}
      {view === 'delivery' && <CareRecordLabDelivery elders={elders} eldersLoading={isLoading} />}
    </div>
  );
}
