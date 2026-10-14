'use client';

/**
 * 퇴직금 추계 — 기준일(퇴직일로 가정, 기본 오늘)에 직원 전체가 퇴직한다고 보고 직원별 추계액과 기관 합계를 낸다.
 * 직원 급여 기준(입사일·주 소정근로시간·급여)과 급여대장 직전 3개월을 쓰고, 회계 장부 세출 115 올해 실적과 견준다.
 * 한 사람을 골라 퇴직일·연간 상여를 넣으면 계산식을 한 줄씩 보여 준다. A4 인쇄.
 */
import { useMemo, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Loading } from '@/components/Loading';
import { ErrorBanner, LabDateInput, SupportText } from '@/components/lab/LabUi';
import { todayString } from '@/components/lab/labFormat';
import { isValidYmd } from '@/lib/lab/labDate';
import { severanceLiability } from '@/lib/lab/severanceRules';
import { usePayrollProfiles, usePayrollYears, usePensionLedger, yearsNeeded } from './SeveranceData';
import SeveranceDetail from './SeveranceDetail';
import { groupLines, rowsOf } from './SeveranceFormat';
import SeveranceLedgerCompare from './SeveranceLedgerCompare';
import { SeveranceIntro, SeveranceVerify } from './SeveranceNotes';
import SeverancePrint from './SeverancePrint';
import SeveranceTable from './SeveranceTable';
import styles from './labPlans.module.css';

export default function SeveranceLab() {
  const today = todayString();
  const thisYear = Number(today.slice(0, 4));
  const [asOf, setAsOf] = useState(today);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [retireOverride, setRetireOverride] = useState<string | null>(null);
  const [bonus, setBonus] = useState<number | null>(null);
  const [printKey, setPrintKey] = useState(0);
  const detailRef = useRef<HTMLDivElement>(null);

  const retireDate = retireOverride ?? asOf;
  const validAsOf = isValidYmd(asOf);
  const years = useMemo(() => [...(validAsOf ? yearsNeeded(asOf) : []), ...(activeId !== null && isValidYmd(retireDate) ? yearsNeeded(retireDate) : [])], [validAsOf, asOf, activeId, retireDate]);
  const { profiles, loading: profilesLoading, error: profilesError, reload: reloadProfiles } = usePayrollProfiles();
  const { lines, loading: linesLoading, error: linesError, reload: reloadLines } = usePayrollYears(years);
  const ledger = usePensionLedger(thisYear);

  const byMember = useMemo(() => groupLines(lines), [lines]);
  const rows = useMemo(() => (validAsOf ? rowsOf(profiles, byMember, asOf) : []), [profiles, byMember, asOf, validAsOf]);
  const total = useMemo(() => (validAsOf ? severanceLiability(profiles, byMember, asOf).total : 0), [profiles, byMember, asOf, validAsOf]);
  const eligibleCount = rows.filter((r) => r.estimate.eligible).length;

  const pick = (id: number | null) => {
    setActiveId(id);
    if (id !== null) requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const loading = profilesLoading || (linesLoading && lines.length === 0);

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <LabDateInput label="기준일 (퇴직일로 가정)" value={asOf} onChange={(v) => { setAsOf(v); setRetireOverride(null); }} />
        <Button label="오늘로" variant="ghost" onClick={() => { setAsOf(today); setRetireOverride(null); }} isDisabled={asOf === today} />
        <span className={styles.spacer} />
        <Button label="A4 인쇄" variant="secondary" isDisabled={loading || !validAsOf || rows.length === 0} onClick={() => setPrintKey((k) => k + 1)} />
      </div>

      <SeveranceIntro />

      {profilesError && <ErrorBanner message={profilesError} onRetry={() => void reloadProfiles()} />}
      {linesError && <ErrorBanner message={`${linesError} — 평균임금을 못 구한 직원은 통상임금으로 계산되어 실제보다 적을 수 있습니다`} onRetry={reloadLines} />}

      {!validAsOf ? (
        <SupportText tone="warn">기준일을 골라 주세요.</SupportText>
      ) : loading ? (
        <Loading size="section" label="직원 급여 기준과 급여대장을 불러오는 중..." />
      ) : (
        <>
          <SupportText>
            {asOf} 기준 직원 {rows.length}명 중 퇴직금 대상 {eligibleCount}명, 추계 합계는 {total.toLocaleString('ko-KR')}원입니다.
          </SupportText>
          <SeveranceTable rows={rows} total={total} asOf={asOf} activeId={activeId} onPick={pick} />
          <SeveranceLedgerCompare year={thisYear} total={total} ledgerTotal={ledger.total} ledgerCount={ledger.count} loading={ledger.loading} error={ledger.error} onRetry={() => void ledger.reload()} />
          <div ref={detailRef}>
            <SeveranceDetail
              rows={rows}
              activeId={activeId}
              onPick={pick}
              lines={lines}
              retireDate={retireDate}
              onRetireDate={setRetireOverride}
              bonus={bonus}
              onBonus={setBonus}
              loading={linesLoading}
            />
          </div>
        </>
      )}
      <SeveranceVerify />
      <SeverancePrint rows={rows} total={total} asOf={asOf} year={thisYear} ledgerTotal={ledger.total} printKey={printKey} onReady={() => window.print()} />
    </div>
  );
}
