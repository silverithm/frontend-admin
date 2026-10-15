'use client';

/**
 * 시설 관리 대장 — 시설 정보로 법정 점검·검사·청소·보험의 적용 여부를 판정하고, 마지막 실시일과 다음 기한, 결과서 보관 위치를 챙긴다.
 * 판단이 어려운 항목은 지어내지 않고 ‘확인 필요’로 두며 관할 기관에 확인하도록 안내한다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import { ErrorBanner, LabConfirm, useNotify } from '@/components/lab/LabUi';
import { errorText, todayString } from '@/components/lab/labFormat';
import { useAlive } from '@/components/labRecords/recordsFormat';
import { ledgerSummary } from '@/lib/lab/facilityLedgerRules';
import { saveFacilityProfile } from '@/lib/lab/labApi';
import type { FacilityApplies, FacilityItemCode, FacilityLog, FacilityProfile } from '@/lib/lab/labTypes';
import { overrideInput } from './FacilityLedgerDraft';
import FacilityLedgerItemPanel from './FacilityLedgerItemPanel';
import { useFacilityProfile, useYearLogs } from './FacilityLedgerLoad';
import { FacilityLedgerNotes } from './FacilityLedgerNotes';
import FacilityLedgerPrint from './FacilityLedgerPrint';
import FacilityLedgerProfile from './FacilityLedgerProfile';
import FacilityLedgerSummary from './FacilityLedgerSummary';
import FacilityLedgerTable from './FacilityLedgerTable';
import plans from './labPlans.module.css';

export default function FacilityLedgerLab() {
  const alive = useAlive();
  const notify = useNotify();
  const today = todayString();
  const thisYear = Number(today.slice(0, 4));
  const profile = useFacilityProfile();
  const yearLogs = useYearLogs(thisYear);
  // 항목을 열어 읽은 그 항목의 전체 기록 — 지난 해 기록까지 있어 연도 목록보다 정확하다
  const [extras, setExtras] = useState<Partial<Record<FacilityItemCode, FacilityLog[]>>>({});
  const [openCode, setOpenCode] = useState<FacilityItemCode | null>(null);
  const [savingCode, setSavingCode] = useState<FacilityItemCode | null>(null);
  const [printKey, setPrintKey] = useState(0);
  const profileDirty = useRef(false);
  const logDirty = useRef(false);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const onProfileDirty = useCallback((d: boolean) => {
    profileDirty.current = d;
  }, []);
  const onLogDirty = useCallback((d: boolean) => {
    logDirty.current = d;
  }, []);

  // 창을 닫거나 새로 고칠 때도 쓰던 내용이 있으면 브라우저가 묻는다
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (profileDirty.current || logDirty.current) e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const logs = useMemo(() => {
    const keep = yearLogs.data.filter((l) => extras[l.itemCode] === undefined);
    return [...keep, ...Object.values(extras).flatMap((v) => v ?? [])];
  }, [yearLogs.data, extras]);
  // 처음 읽은 뒤에는 다시 읽는 동안에도 표를 그대로 둔다(열어 둔 기록 칸이 사라지지 않게)
  const [loadedOnce, setLoadedOnce] = useState(false);
  useEffect(() => {
    if (!yearLogs.loading && !yearLogs.error) setLoadedOnce(true);
  }, [yearLogs.loading, yearLogs.error]);
  const ready = profile.data !== null && !profile.error && !yearLogs.error && loadedOnce;
  const summary = useMemo(() => (profile.data && ready ? ledgerSummary(profile.data, logs, today) : null), [profile.data, logs, today, ready]);

  /** 쓰던 내용이 있으면 확인을 묻고 true */
  const guard = (go: () => void) => {
    if (!logDirty.current) return false;
    setPending(() => () => {
      logDirty.current = false;
      go();
    });
    return true;
  };
  const toggle = (code: FacilityItemCode) => {
    const go = () => setOpenCode((c) => (c === code ? null : code));
    if (!guard(go)) go();
  };
  const onOverride = async (code: FacilityItemCode, value: FacilityApplies | null) => {
    const saved = profile.data;
    if (!saved || savingCode !== null) return;
    setSavingCode(code);
    try {
      const next = await saveFacilityProfile(overrideInput(saved, code, value));
      if (!alive.current) return;
      profile.setData(next);
      notify(value === null ? '자동 판정으로 되돌렸습니다' : value === 'NO' ? '해당 없음으로 지정했습니다. 해당 없음 목록에서 다시 볼 수 있습니다' : '해당으로 지정했습니다', 'success');
    } catch (err) {
      if (alive.current) notify(errorText(err, '직접 지정을 저장하지 못했습니다'), 'error');
    } finally {
      if (alive.current) setSavingCode(null);
    }
  };
  const reloadLogs = async () => {
    await yearLogs.reload();
  };
  const retryAll = () => {
    void profile.reload();
    void yearLogs.reload();
  };

  return (
    <div className={plans.stack}>
      <Card padding={4}>
        <VStack gap={3}>
          <Text type="label">시설 관리 대장</Text>
          <Text type="supporting" color="secondary">소방·전기·가스·승강기·저수조·정화조·소독·안전점검·보험의 법정 점검 주기를 챙깁니다. 시설 정보를 입력하면 우리 센터에 해당하는 항목이 가려지고, 실시 기록을 남기면 다음 기한이 계산됩니다.</Text>
          {summary ? <FacilityLedgerSummary summary={summary} /> : null}
          <HStack gap={3} wrap="wrap">
            <Button label="대장 인쇄" variant="secondary" isDisabled={!summary} onClick={() => setPrintKey((k) => k + 1)} />
          </HStack>
        </VStack>
      </Card>

      <FacilityLedgerProfile profile={profile.data} loading={profile.loading} error={profile.error} today={today} onRetry={() => void profile.reload()} onSaved={(p: FacilityProfile) => profile.setData(p)} onDirtyChange={onProfileDirty} />

      <Card padding={4}>
        <VStack gap={3}>
          <Text type="label">점검 항목</Text>
          <FacilityLedgerNotes />
          {yearLogs.error && <ErrorBanner message={yearLogs.error} onRetry={retryAll} />}
          {!summary && !yearLogs.error && !profile.error && <Loading size="section" label="점검 항목을 계산하는 중..." />}
          {summary && (
            <FacilityLedgerTable
              summary={summary}
              profile={profile.data}
              openCode={openCode}
              savingCode={savingCode}
              onToggle={toggle}
              onOverride={(c, v) => void onOverride(c, v)}
              renderPanel={(item) => (
                <FacilityLedgerItemPanel
                  item={item}
                  profile={profile.data}
                  today={today}
                  onLogs={(l) => setExtras((prev) => ({ ...prev, [item.code]: l }))}
                  onChanged={reloadLogs}
                  onDirtyChange={onLogDirty}
                  guard={guard}
                />
              )}
            />
          )}
        </VStack>
      </Card>

      <FacilityLedgerPrint summary={summary} profile={profile.data} logs={logs} today={today} printKey={printKey} onReady={() => window.print()} />
      <LabConfirm
        isOpen={pending !== null}
        title="저장하지 않은 변경이 있습니다"
        description="저장하지 않고 넘어가면 지금 적은 내용이 사라집니다."
        actionLabel="버리고 이동"
        onConfirm={() => {
          const go = pending;
          setPending(null);
          go?.();
        }}
        onClose={() => setPending(null)}
      />
    </div>
  );
}
