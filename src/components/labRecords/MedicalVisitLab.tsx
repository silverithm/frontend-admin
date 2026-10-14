'use client';

/**
 * 진료 동행 — 급여제공시간 안에 직원이 수급자와 병원에 다녀온 기록(2026 평가 30 외부기관연계 기준①).
 * 월 목록과 후속 확인 예정, 기록 편집(메모 → AI 정리), 올해 통계, 한 건 인쇄(보호자 전달용).
 * 이 화면은 진료 내용을 옮겨 적는 곳이지 의료 판단을 하는 곳이 아닙니다.
 */
import { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Text } from '@astryxdesign/core/Text';
import type { MedicalVisit } from '@/lib/lab/labTypes';
import { ErrorBanner, MonthStepper } from '@/components/lab/LabUi';
import { currentMonth, todayString } from '@/components/lab/labFormat';
import { useLabElders } from '@/components/lab/useLabElders';
import { useMedicalVisitData } from './MedicalVisitData';
import MedicalVisitEditor from './MedicalVisitEditor';
import MedicalVisitFollowUps from './MedicalVisitFollowUps';
import MedicalVisitList from './MedicalVisitList';
import MedicalVisitSheet from './MedicalVisitSheet';
import MedicalVisitStats from './MedicalVisitStats';
import styles from './labRecords.module.css';
import own from './MedicalVisit.module.css';

type Mode = { type: 'list' } | { type: 'edit'; visit: MedicalVisit | null };

export default function MedicalVisitLab() {
  const { elders, isLoading: eldersLoading, error: eldersError, reload: reloadElders } = useLabElders();
  const [month, setMonth] = useState(currentMonth);
  const [mode, setMode] = useState<Mode>({ type: 'list' });
  const [printing, setPrinting] = useState<MedicalVisit | null>(null);
  const year = Number(todayString().slice(0, 4));
  const { monthData, dueData, yearData, reloadAll } = useMedicalVisitData(month, year);

  if (mode.type === 'edit') {
    return <MedicalVisitEditor key={mode.visit?.id ?? 'new'} elders={elders} visit={mode.visit} onSaved={reloadAll} onClose={() => setMode({ type: 'list' })} />;
  }

  const canCreate = !eldersLoading && elders.length > 0;
  return (
    <div className={styles.stack}>
      <details className={own.guide}>
        <summary>기록 기준 안내</summary>
        <p>
          2026 주야간보호 평가 30(외부기관연계) 기준①은 수급자가 급여제공시간 안에 종사자와 함께 의료기관에서 진료받은 내용을 급여제공기록지·간호일지·상담일지 등에 기록했는지 봅니다.
        </p>
        <p>이 화면의 필수 항목(병원·진료 내용·동행 직원)은 규정에 정해진 것이 아니라 기관 서식입니다. 보호자가 직접 동행한 진료를 기록 대상으로 보는지는 대조가 필요합니다.</p>
      </details>
      {eldersError && <ErrorBanner message={eldersError} onRetry={() => void reloadElders()} />}
      <MedicalVisitFollowUps visits={dueData.data} error={dueData.error} onRetry={() => void dueData.reload()} onOpen={(v) => setMode({ type: 'edit', visit: v })} onChanged={reloadAll} />
      <div className={styles.toolbar}>
        <MonthStepper value={month} onChange={setMonth} />
        <Text type="supporting" color="secondary">
          {monthData.isLoading ? '불러오는 중...' : `${monthData.data.length}건`}
        </Text>
        <div className={styles.spacer}>
          <Button label="새 진료 동행 기록" variant="primary" isDisabled={!canCreate} onClick={() => setMode({ type: 'edit', visit: null })} />
        </div>
      </div>
      {monthData.error && <ErrorBanner message={monthData.error} onRetry={() => void monthData.reload()} />}
      <MedicalVisitList
        month={month}
        visits={monthData.data}
        isLoading={monthData.isLoading}
        canCreate={canCreate}
        onCreate={() => setMode({ type: 'edit', visit: null })}
        onOpen={(v) => setMode({ type: 'edit', visit: v })}
        onPrint={setPrinting}
      />
      <MedicalVisitStats year={year} visits={yearData.data} isLoading={yearData.isLoading} error={yearData.error} onRetry={() => void yearData.reload()} />
      {printing && <MedicalVisitSheet visit={printing} onDone={() => setPrinting(null)} />}
    </div>
  );
}
