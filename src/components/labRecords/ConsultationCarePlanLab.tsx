'use client';

/**
 * 상담일지 · 욕구사정·급여계획 — 두 보기를 오간다.
 * 어르신 목록은 한 번만 불러와 두 보기가 함께 쓴다.
 */
import { useState } from 'react';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { ErrorBanner } from '@/components/lab/LabUi';
import { useLabElders } from '@/components/lab/useLabElders';
import ConsultationCarePlanConsultView from './ConsultationCarePlanConsultView';
import ConsultationCarePlanPlanView from './ConsultationCarePlanPlanView';
import styles from './labRecords.module.css';

type View = 'consult' | 'plan';

interface ConsultationCarePlanLabProps {
  /** 실험실 메뉴에서 '상담일지'로 들어오면 상담, '욕구사정·급여계획'으로 들어오면 계획 보기로 연다 */
  initialView?: View;
}

export default function ConsultationCarePlanLab({ initialView = 'consult' }: ConsultationCarePlanLabProps) {
  const [view, setView] = useState<View>(initialView);
  const { elders, isLoading, error, reload } = useLabElders();

  return (
    <div className={styles.stack}>
      <SegmentedControl label="상담·계획 보기" value={view} onChange={(v) => setView(v as View)}>
        <SegmentedControlItem value="consult" label="상담일지" />
        <SegmentedControlItem value="plan" label="욕구사정·급여계획" />
      </SegmentedControl>

      {error && <ErrorBanner message={error} onRetry={() => void reload()} />}

      {view === 'consult' && <ConsultationCarePlanConsultView elders={elders} eldersLoading={isLoading} />}
      {view === 'plan' && <ConsultationCarePlanPlanView elders={elders} eldersLoading={isLoading} />}
    </div>
  );
}
