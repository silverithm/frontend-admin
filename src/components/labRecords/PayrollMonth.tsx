'use client';

/**
 * 보기 2 "월 급여대장" — 월을 고르면 직원마다 시간·기타 수당·공제를 입력하고 즉시 계산한다.
 * 저장은 줄별 또는 "전체 계산·저장"(한 번에), 달 전체는 "이달 확정"(잠금)과 "확정 풀기"로 한다.
 * 지난달 시간·수당 복사로 반복 입력을 줄이고, 급여명세서는 줄마다 또는 전체를 A4 세로로 인쇄한다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '@astryxdesign/core/Card';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Loading } from '@/components/Loading';
import { ErrorBanner, LabConfirm, useNotify } from '@/components/lab/LabUi';
import { currentMonth, errorText, monthLabel, readStored, shiftMonth, writeStored } from '@/components/lab/labFormat';
import { confirmPayrollMonth, listPayrollLines, savePayrollLine, unconfirmPayrollMonth } from '@/lib/lab/labApi';
import type { LongServiceFacility, PayrollLine, PayrollProfile } from '@/lib/lab/labTypes';
import PayrollMonthBar from './PayrollMonthBar';
import PayrollMonthTable from './PayrollMonthTable';
import PayrollSlip from './PayrollSlip';
import type { SlipItem } from './PayrollSlip';
import { buildRows, draftFromLine, draftSnapshot, jobLabel, monthTotals } from './PayrollDraft';
import type { AllowDraft, DeductDraft, HourKey, MonthRow, RowDraft } from './PayrollDraft';
import { useAlive, useLatest } from './recordsFormat';
import styles from './labRecords.module.css';

const FACILITY_KEY = 'carev.lab.payroll.facility';

interface Props {
  profiles: PayrollProfile[];
  /** 급여 기준이 아직 없는 직원 이름 */
  missingNames: string[];
  /** 저장·확정이 끝났을 때(위쪽 카드를 다시 불러오게) */
  onChanged: () => void;
}

type Pending = { kind: 'month'; to: string } | { kind: 'confirm' } | { kind: 'unconfirm' } | null;

export default function PayrollMonth({ profiles, missingNames, onChanged }: Props) {
  const notify = useNotify();
  const alive = useAlive();
  const [month, setMonth] = useState(currentMonth);
  const [lines, setLines] = useState<PayrollLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<number, RowDraft>>({});
  const [facility, setFacility] = useState<LongServiceFacility>('HOME');
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(() => new Set());
  const [rowErrors, setRowErrors] = useState<Record<number, string | undefined>>({});
  const [barError, setBarError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [slips, setSlips] = useState<SlipItem[]>([]);
  const [printKey, setPrintKey] = useState(0);
  const seq = useRef(0);
  const busyRef = useRef(false);

  useEffect(() => {
    const stored = readStored(FACILITY_KEY);
    if (stored === 'HOME' || stored === 'RESIDENTIAL') setFacility(stored);
  }, []);

  const load = useCallback(async (target: string) => {
    const n = ++seq.current;
    setLoading(true);
    setLoadError(null);
    try {
      const list = await listPayrollLines(target);
      if (n !== seq.current) return; // 월을 빨리 넘길 때 늦게 온 응답은 버린다
      setLines(list);
      setEdits({});
      setRowErrors({});
      setBarError(null);
    } catch (e) {
      if (n !== seq.current) return;
      setLines([]);
      setLoadError(errorText(e, '월 급여대장을 불러오지 못했습니다'));
    } finally {
      if (n === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(month);
    return () => {
      seq.current += 1;
    };
  }, [month, load]);

  const rows = useMemo(() => buildRows(profiles, lines, edits, month, facility), [profiles, lines, edits, month, facility]);
  const totals = useMemo(() => monthTotals(rows), [rows]);
  const rowsRef = useLatest(rows);
  const monthRef = useLatest(month);
  const busy = saving || copying || confirming || loading;
  const hasEdits = Object.keys(edits).length > 0;
  const hasEditsRef = useLatest(hasEdits);
  const editsRef = useLatest(edits);

  // 저장하지 않고 탭을 닫으려 할 때 브라우저가 한 번 묻는다
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (hasEditsRef.current) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasEditsRef]);

  const editRow = (id: number, fn: (d: RowDraft) => RowDraft) => {
    setEdits((prev) => {
      const row = rowsRef.current.find((r) => r.memberId === id);
      if (!row || row.status === 'locked' || row.status === 'orphan') return prev;
      return { ...prev, [id]: fn(prev[id] ?? row.draft) };
    });
  };

  const goMonth = (to: string) => {
    if (busy || to === month) return;
    if (hasEdits) setPending({ kind: 'month', to });
    else setMonth(to);
  };

  const changeFacility = (f: LongServiceFacility) => {
    setFacility(f);
    writeStored(FACILITY_KEY, f);
  };

  /** 줄들을 차례로 저장한다. 실패한 줄은 그 줄 아래에 오류를 남기고 나머지는 계속한다. */
  const saveRows = async (targets: MonthRow[]) => {
    if (busyRef.current || targets.length === 0) return;
    const target = month;
    busyRef.current = true;
    setSaving(true);
    setRowErrors({});
    setBarError(null);
    const savedLines: PayrollLine[] = [];
    const snaps = new Map<number, string>();
    const failed: Record<number, string> = {};
    for (const r of targets) {
      if (!alive.current || monthRef.current !== target) break;
      if (!r.calc) continue;
      try {
        savedLines.push(await savePayrollLine({ memberId: r.memberId, ...r.calc.amounts }));
        snaps.set(r.memberId, draftSnapshot(r.draft));
      } catch (e) {
        failed[r.memberId] = errorText(e, '저장하지 못했습니다');
      }
    }
    busyRef.current = false;
    if (!alive.current) return;
    setSaving(false);
    if (monthRef.current !== target) return;
    const failCount = Object.keys(failed).length;
    const ids = new Set(savedLines.map((l) => l.memberId));
    setLines((prev) => [...prev.filter((l) => !ids.has(l.memberId)), ...savedLines]);
    // 저장하는 동안 더 고친 줄은 편집 상태를 그대로 둔다
    setEdits((prev) => {
      const next = { ...prev };
      for (const [id, snap] of snaps) if (next[id] && draftSnapshot(next[id]) === snap) delete next[id];
      return next;
    });
    setRowErrors(failed);
    if (savedLines.length > 0) {
      notify(failCount > 0 ? `${savedLines.length}명 저장, ${failCount}명은 저장하지 못했습니다` : `${savedLines.length}명의 급여를 저장했습니다`, failCount > 0 ? 'error' : 'success');
      onChanged();
    } else if (failCount > 0) {
      setBarError(`저장하지 못했습니다. 아래 직원별 안내를 확인해 주세요`);
    }
  };

  const saveAll = () => {
    const targets = rowsRef.current.filter((r) => r.status === 'new' || r.status === 'edited');
    void saveRows(targets);
  };

  const copyPrev = async () => {
    if (busyRef.current) return;
    const target = month;
    busyRef.current = true;
    setCopying(true);
    setBarError(null);
    try {
      const prev = await listPayrollLines(shiftMonth(target, -1));
      if (!alive.current || monthRef.current !== target) return;
      const byMember = new Map(prev.map((l) => [l.memberId, l]));
      // 이미 저장했거나 직접 고친 줄은 건드리지 않고, 처음 입력하는 줄만 채운다
      const fill = rowsRef.current.filter((r) => r.profile && !r.saved && !editsRef.current[r.memberId] && byMember.has(r.memberId));
      const skippedSaved = rowsRef.current.filter((r) => r.profile && (r.saved || editsRef.current[r.memberId])).length;
      const noPrev = rowsRef.current.filter((r) => r.profile && !r.saved && !editsRef.current[r.memberId] && !byMember.has(r.memberId)).length;
      setEdits((cur) => {
        const next = { ...cur };
        for (const r of fill) {
          const l = byMember.get(r.memberId);
          if (l && !next[r.memberId]) next[r.memberId] = draftFromLine(l);
        }
        return next;
      });
      const parts = [`${monthLabel(shiftMonth(target, -1))}에서 ${fill.length}명의 시간·기타 수당·공제를 복사했습니다`];
      if (noPrev > 0) parts.push(`지난달 기록이 없는 ${noPrev}명은 그대로입니다`);
      if (skippedSaved > 0) parts.push(`이미 저장했거나 고친 ${skippedSaved}명은 건드리지 않았습니다`);
      notify(parts.join('. '), fill.length > 0 ? 'success' : 'info');
    } catch (e) {
      if (alive.current && monthRef.current === target) setBarError(errorText(e, '지난달 급여를 불러오지 못했습니다'));
    } finally {
      busyRef.current = false;
      if (alive.current) setCopying(false);
    }
  };

  const runMonthAction = async (kind: 'confirm' | 'unconfirm') => {
    if (busyRef.current) return;
    const target = month;
    busyRef.current = true;
    setConfirming(true);
    setBarError(null);
    try {
      const result = kind === 'confirm' ? (await confirmPayrollMonth(target)).confirmed : (await unconfirmPayrollMonth(target)).unconfirmed;
      if (!alive.current) return;
      notify(kind === 'confirm' ? `${monthLabel(target)} 급여 ${result}명을 확정했습니다` : `${monthLabel(target)} 급여 ${result}명의 확정을 풀었습니다`, 'success');
      setPending(null);
      onChanged();
      busyRef.current = false;
      await load(target);
    } catch (e) {
      if (alive.current) {
        setPending(null);
        setBarError(errorText(e, kind === 'confirm' ? '급여를 확정하지 못했습니다' : '확정을 풀지 못했습니다'));
      }
    } finally {
      busyRef.current = false;
      if (alive.current) setConfirming(false);
    }
  };

  const slipOf = (r: MonthRow): SlipItem => ({
    memberId: r.memberId,
    name: r.name,
    jobText: r.profile ? jobLabel(r.profile.jobType) : '',
    hireDate: r.profile?.hireDate ?? '',
    profile: r.profile,
    amounts: r.amounts,
    saved: r.status === 'saved' || r.status === 'locked',
  });

  const startPrint = (list: MonthRow[]) => {
    const ok = list.filter((r) => r.status !== 'invalid' && r.status !== 'orphan');
    if (ok.length === 0) {
      setBarError('인쇄할 수 있는 직원이 없습니다. 입력 확인이 필요한 줄을 먼저 고쳐 주세요');
      return;
    }
    setBarError(ok.length < list.length ? `입력 확인이 필요한 ${list.length - ok.length}명은 명세서에서 뺐습니다` : null);
    setSlips(ok.map(slipOf));
    setPrintKey((k) => k + 1);
  };

  const toggle = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className={styles.stack}>
      <PayrollMonthBar
        month={month}
        onMonth={goMonth}
        facility={facility}
        onFacility={changeFacility}
        rows={rows}
        totals={totals}
        busy={busy}
        saving={saving}
        copying={copying}
        confirming={confirming}
        onCopyPrev={() => void copyPrev()}
        onSaveAll={saveAll}
        onConfirm={() => setPending({ kind: 'confirm' })}
        onUnconfirm={() => setPending({ kind: 'unconfirm' })}
        onPrintAll={() => startPrint(rowsRef.current)}
        missingNames={missingNames}
      />
      {barError && <ErrorBanner message={barError} />}
      {loadError && <ErrorBanner message={loadError} onRetry={() => void load(month)} />}

      {loading ? (
        <Loading size="inline" label="월 급여대장을 불러오는 중..." />
      ) : loadError ? null : rows.length === 0 ? (
        <Card padding={6}>
          <EmptyState isCompact title="급여 기준이 있는 직원이 없습니다" description="위의 “급여 기준” 보기에서 직원의 직종·월급(시급)·가족 수를 먼저 저장해 주세요." />
        </Card>
      ) : (
        <Card padding={0}>
          <PayrollMonthTable
            rows={rows}
            expanded={expanded}
            isBusy={saving || copying || confirming}
            rowErrors={rowErrors}
            onHour={(id, key: HourKey, text) => editRow(id, (d) => ({ ...d, [key]: text }))}
            onAllowances={(id, next: AllowDraft[]) => editRow(id, (d) => ({ ...d, allowances: next }))}
            onDeductions={(id, next: DeductDraft[]) => editRow(id, (d) => ({ ...d, deductions: next }))}
            onToggle={toggle}
            onPrint={(r) => startPrint([r])}
            onSaveRow={(r) => void saveRows([r])}
          />
        </Card>
      )}

      <PayrollSlip month={month} items={slips} printKey={printKey} onReady={() => window.print()} />

      <LabConfirm
        isOpen={pending?.kind === 'month'}
        title="저장하지 않은 내용이 있습니다"
        description="다른 달로 넘어가면 지금 입력한 시간과 수당이 사라집니다. 그래도 넘어갈까요?"
        actionLabel="넘어가기"
        onConfirm={() => {
          if (pending?.kind === 'month') setMonth(pending.to);
          setPending(null);
        }}
        onClose={() => setPending(null)}
      />
      <LabConfirm
        isOpen={pending?.kind === 'confirm'}
        title={`${monthLabel(month)} 급여를 확정할까요?`}
        description="확정하면 이 달의 모든 급여 줄이 잠겨 고칠 수 없습니다. 고쳐야 하면 ‘확정 풀기’를 눌러 풀 수 있습니다."
        actionLabel="확정"
        isLoading={confirming}
        onConfirm={() => void runMonthAction('confirm')}
        onClose={() => setPending(null)}
      />
      <LabConfirm
        isOpen={pending?.kind === 'unconfirm'}
        title={`${monthLabel(month)} 확정을 풀까요?`}
        description="모든 줄의 잠금이 풀리고 다시 고칠 수 있게 됩니다. 이미 직원에게 명세서를 준 달이라면 다시 확정한 뒤 새로 인쇄해 주세요."
        actionLabel="확정 풀기"
        isLoading={confirming}
        onConfirm={() => void runMonthAction('unconfirm')}
        onClose={() => setPending(null)}
      />
    </div>
  );
}
