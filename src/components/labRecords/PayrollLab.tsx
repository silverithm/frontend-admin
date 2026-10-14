'use client';

/**
 * 급여대장 — 위에는 올해 인건비 지출비율과 이번 달 급여 카드, 그 아래 두 보기.
 *  · 급여 기준: 직원별 직종·월급(시급)·가족·원천징수 비율·식대·입사일·4대보험 가입을 한 번 저장한다.
 *  · 월 급여대장: 월을 고르고 직원마다 시간을 넣으면 buildPayrollLine이 즉시 계산한다. 저장·이달 확정·명세서 인쇄.
 * 월 급여대장은 보기를 오가도 입력이 사라지지 않게 숨기기만 한다. 기준값 중 확인 안 된 것은 "대조 필요" 안내에 모아 둔다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Loading } from '@/components/Loading';
import { ErrorBanner } from '@/components/lab/LabUi';
import { errorText } from '@/components/lab/labFormat';
import { listLabStaff, listPayrollProfiles } from '@/lib/lab/labApi';
import type { LabStaff, PayrollProfile } from '@/lib/lab/labTypes';
import PayrollMonth from './PayrollMonth';
import PayrollNotes from './PayrollNotes';
import PayrollProfiles from './PayrollProfiles';
import PayrollSummary from './PayrollSummary';
import { useAlive } from './recordsFormat';
import styles from './labRecords.module.css';

type View = 'month' | 'profiles';

export default function PayrollLab() {
  const alive = useAlive();
  const [view, setView] = useState<View>('month');
  const [staff, setStaff] = useState<LabStaff[]>([]);
  const [profiles, setProfiles] = useState<PayrollProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const n = ++seq.current;
    setLoading(true);
    setError(null);
    const [s, p] = await Promise.allSettled([listLabStaff(), listPayrollProfiles()]);
    if (!alive.current || n !== seq.current) return; // 늦게 온 응답은 버린다
    if (s.status === 'rejected' || p.status === 'rejected') {
      const reason = s.status === 'rejected' ? s.reason : p.status === 'rejected' ? p.reason : null;
      setError(errorText(reason, '직원·급여 기준을 불러오지 못했습니다'));
    }
    if (s.status === 'fulfilled') setStaff(s.value);
    if (p.status === 'fulfilled') setProfiles(p.value);
    setLoading(false);
  }, [alive]);

  useEffect(() => {
    void load();
    return () => {
      seq.current += 1;
    };
  }, [load]);

  const missingNames = useMemo(() => {
    const have = new Set(profiles.map((p) => p.memberId));
    return staff.filter((s) => !have.has(s.id)).map((s) => s.name);
  }, [staff, profiles]);

  const bump = useCallback(() => setRefreshKey((k) => k + 1), []);

  return (
    <div className={styles.stack}>
      <PayrollSummary refreshKey={refreshKey} />

      <SegmentedControl label="급여대장 보기" value={view} onChange={(v) => setView(v as View)}>
        <SegmentedControlItem value="month" label="월 급여대장" />
        <SegmentedControlItem value="profiles" label="급여 기준" />
      </SegmentedControl>

      {error && <ErrorBanner message={error} onRetry={() => void load()} />}

      {loading && profiles.length === 0 && staff.length === 0 ? (
        <Loading size="section" label="직원과 급여 기준을 불러오는 중..." />
      ) : (
        <>
          <div hidden={view !== 'month'}>
            <PayrollMonth profiles={profiles} missingNames={missingNames} onChanged={bump} />
          </div>
          <div hidden={view !== 'profiles'}>
            <PayrollProfiles
              staff={staff}
              profiles={profiles}
              onProfilesChange={(fn) => {
                setProfiles(fn);
                bump();
              }}
            />
          </div>
        </>
      )}

      <PayrollNotes />
    </div>
  );
}
