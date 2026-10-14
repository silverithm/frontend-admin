'use client';

/** 프로그램 계획 — 연간계획 · 월간 계획표 · 의견수렴 세 보기를 오간다(평가 24·25·26 기준①③, 17 소통노력 기준③). */
import { useState } from 'react';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import ProgramPlanAnnual from './ProgramPlanAnnual';
import ProgramPlanFeedback from './ProgramPlanFeedback';
import ProgramPlanMonth from './ProgramPlanMonth';
import styles from './labRecords.module.css';

type View = 'ANNUAL' | 'MONTH' | 'FEEDBACK';

export default function ProgramPlanLab() {
  const [view, setView] = useState<View>('ANNUAL');
  return (
    <div className={styles.stack}>
      <div>
        <SegmentedControl label="보기" value={view} onChange={(v) => v && setView(v as View)}>
          <SegmentedControlItem value="ANNUAL" label="연간계획" />
          <SegmentedControlItem value="MONTH" label="월간 계획표" />
          <SegmentedControlItem value="FEEDBACK" label="의견수렴" />
        </SegmentedControl>
      </div>
      {view === 'ANNUAL' ? <ProgramPlanAnnual /> : view === 'MONTH' ? <ProgramPlanMonth /> : <ProgramPlanFeedback />}
    </div>
  );
}
