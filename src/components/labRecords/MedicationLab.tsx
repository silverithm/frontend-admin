'use client';

/**
 * 투약 관리 — 세 보기: 오늘 투약(출석한 어르신 기준으로 먹일 약을 확인·기록), 투약의뢰서(보호자가 맡긴 약), 약품 관리(대장·분기 점검).
 * 이 화면은 "무엇을 확인해야 하는가"만 알려 준다. 복용 가부·용량 판단은 의사 처방과 간호(조무)사의 몫이다.
 */
import { useState } from 'react';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { ErrorBanner } from '@/components/lab/LabUi';
import { useLabElders } from '@/components/lab/useLabElders';
import MedicationRequests from './MedicationRequests';
import { useMedicationRequests } from './MedicationRequestsData';
import MedicationStorage from './MedicationStorage';
import MedicationToday from './MedicationToday';
import styles from './labRecords.module.css';

type View = 'TODAY' | 'REQUESTS' | 'STORAGE';

export default function MedicationLab() {
  const { elders, isLoading: eldersLoading, error: eldersError, reload: reloadElders } = useLabElders();
  const requestData = useMedicationRequests();
  const [view, setView] = useState<View>('TODAY');

  return (
    <div className={styles.stack}>
      <div>
        <SegmentedControl label="보기" value={view} onChange={(v) => v && setView(v as View)}>
          <SegmentedControlItem value="TODAY" label="오늘 투약" />
          <SegmentedControlItem value="REQUESTS" label="투약의뢰서" />
          <SegmentedControlItem value="STORAGE" label="약품 관리" />
        </SegmentedControl>
      </div>
      {eldersError && <ErrorBanner message={eldersError} onRetry={() => void reloadElders()} />}
      {requestData.error && <ErrorBanner message={requestData.error} onRetry={() => void requestData.reload()} />}
      {view === 'TODAY' && <MedicationToday requests={requestData.requests} requestsLoading={requestData.isLoading} />}
      {view === 'REQUESTS' && (
        <MedicationRequests elders={elders} eldersLoading={eldersLoading} requests={requestData.requests} requestsLoading={requestData.isLoading} onChanged={() => void requestData.reload()} />
      )}
      {view === 'STORAGE' && <MedicationStorage />}
    </div>
  );
}
