'use client';

/**
 * 송영 일지 — 운행일지(그날 출석한 어르신으로 탑승자 채움), 수칙·운행표 제공, 차량·보험 세 보기.
 * 고시 제34조 제4항의 이동서비스 일지 작성·보관과 2026 평가 지표 28(수칙 제공·종합보험)을 돕는다.
 */
import { useCallback, useState } from 'react';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { listLabStaff, listTransportVehicles } from '@/lib/lab/labApi';
import { ErrorBanner } from '@/components/lab/LabUi';
import { useLabElders } from '@/components/lab/useLabElders';
import { Loading } from '@/components/Loading';
import { useRecordsLoader } from './useRecordsLoader';
import TransportLogView from './TransportLogView';
import TransportRulesView from './TransportRulesView';
import TransportVehicles from './TransportVehicles';
import styles from './labRecords.module.css';

type View = 'LOG' | 'RULES' | 'VEHICLES';

export default function TransportLab() {
  const [view, setView] = useState<View>('LOG');
  const { elders, isLoading: eldersLoading, error: eldersError, reload: reloadElders } = useLabElders();
  const loadVehicles = useCallback(() => listTransportVehicles(), []);
  const loadStaff = useCallback(() => listLabStaff(), []);
  const vehicles = useRecordsLoader(loadVehicles, '차량 목록을 불러오지 못했습니다', []);
  const staff = useRecordsLoader(loadStaff, '직원 목록을 불러오지 못했습니다', []);

  return (
    <div className={styles.stack}>
      <div>
        <SegmentedControl label="보기" value={view} onChange={(v) => v && setView(v as View)}>
          <SegmentedControlItem value="LOG" label="운행일지" />
          <SegmentedControlItem value="RULES" label="수칙·운행표 제공" />
          <SegmentedControlItem value="VEHICLES" label="차량·보험" />
        </SegmentedControl>
      </div>
      {eldersError && <ErrorBanner message={eldersError} onRetry={() => void reloadElders()} />}
      {vehicles.error && <ErrorBanner message={vehicles.error} onRetry={() => void vehicles.reload()} />}

      {view === 'LOG' && (
        <TransportLogView
          vehicles={vehicles.data}
          staff={staff.data}
          staffError={staff.error}
          elders={elders}
          baseLoading={eldersLoading || vehicles.isLoading || staff.isLoading}
          onGoVehicles={() => setView('VEHICLES')}
        />
      )}
      {view === 'RULES' && (eldersLoading ? <Loading size="inline" label="어르신 목록을 불러오는 중..." /> : <TransportRulesView elders={elders} />)}
      {view === 'VEHICLES' && (vehicles.isLoading && vehicles.data.length === 0 ? <Loading size="inline" label="차량 목록을 불러오는 중..." /> : <TransportVehicles vehicles={vehicles.data} onChanged={() => void vehicles.reload()} />)}
    </div>
  );
}
