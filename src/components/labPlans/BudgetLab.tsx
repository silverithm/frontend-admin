'use client';

/**
 * 예산·결산 — 연도와 차수(본예산·추경)를 고르고 세입·세출 줄을 편집한다. 전년 실적·AI로 초안을 받아 직원이 골라 반영한다.
 * 확정된 예산은 잠기고, 추경은 앞 차수를 복사해 만든다. 그 해 회계 장부(listLedgerEntriesByYear)와 견줘 집행 표와 결산을 낸다.
 * 저장하지 않은 변경이 있으면 연도·차수를 바꾸기 전에 묻는다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import { ErrorBanner, LabConfirm, useNotify } from '@/components/lab/LabUi';
import { errorText, todayString } from '@/components/lab/labFormat';
import { YearStepper } from '@/components/labRecords/RecordsUi';
import { dedupeById, useAlive } from '@/components/labRecords/recordsFormat';
import { budgetVsActual, latestBudget, settlement } from '@/lib/lab/budgetRules';
import { confirmBudget, deleteBudget, listBudgets, listLedgerEntriesByYear, saveBudget, unconfirmBudget } from '@/lib/lab/labApi';
import type { Budget, LedgerDirection, LedgerEntry } from '@/lib/lab/labTypes';
import { MAX_REVISION, draftIssues, draftOfBudget, emptyBudgetDraft, fingerprint, inputOfBudgetDraft, newLine, plainLines, revisionLabel, supplementaryOf } from './BudgetDraft';
import type { BudgetDraft } from './BudgetDraft';
import BudgetDeadlines from './BudgetDeadlines';
import BudgetDraftTools from './BudgetDraftTools';
import BudgetEditor from './BudgetEditor';
import BudgetSettlement from './BudgetSettlement';
import BudgetVsActual from './BudgetVsActual';
import styles from './labPlans.module.css';

export default function BudgetLab() {
  const alive = useAlive();
  const notify = useNotify();
  const today = todayString();
  const thisYear = Number(today.slice(0, 4));
  const [year, setYear] = useState(thisYear);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [draft, setDraft] = useState<BudgetDraft | null>(null);
  const [baseline, setBaseline] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(true);
  const [ledgerError, setLedgerError] = useState<string | null>(null);
  const [prevEntries, setPrevEntries] = useState<LedgerEntry[] | null>(null);
  const [prevLoading, setPrevLoading] = useState(true);
  const [prevError, setPrevError] = useState<string | null>(null);
  const [throughMonth, setThroughMonth] = useState(0);
  const [saving, setSaving] = useState(false);
  const [working, setWorking] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState(false);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const seq = useRef(0);
  const prevSeq = useRef(0);
  const busyRef = useRef(false);

  const dirty = draft !== null && fingerprint(draft) !== baseline;

  const show = useCallback((d: BudgetDraft | null, saved = true) => {
    setDraft(d);
    setBaseline(d === null ? '' : saved ? fingerprint(d) : '');
    setSaveError(null);
  }, []);

  const load = useCallback(async () => {
    const n = ++seq.current;
    setLoading(true);
    setLedgerLoading(true);
    setError(null);
    setLedgerError(null);
    const [b, l] = await Promise.allSettled([listBudgets(year), listLedgerEntriesByYear(year)]);
    if (!alive.current || n !== seq.current) return; // 늦게 온 응답은 버린다
    if (b.status === 'fulfilled') {
      const list = dedupeById(b.value);
      setBudgets(list);
      const latest = latestBudget(list, year);
      show(latest ? draftOfBudget(latest) : null);
    } else {
      setBudgets([]);
      show(null);
      setError(errorText(b.reason, '예산을 불러오지 못했습니다'));
    }
    if (l.status === 'fulfilled') setEntries(dedupeById(l.value));
    else {
      setEntries([]);
      setLedgerError(errorText(l.reason, '회계 장부를 불러오지 못했습니다') + ' — 집행 표와 결산의 실적이 비어 있을 수 있습니다');
    }
    setLoading(false);
    setLedgerLoading(false);
  }, [year, alive, show]);

  const loadPrev = useCallback(async () => {
    const n = ++prevSeq.current;
    setPrevLoading(true);
    setPrevError(null);
    try {
      const list = await listLedgerEntriesByYear(year - 1);
      if (!alive.current || n !== prevSeq.current) return;
      setPrevEntries(dedupeById(list));
    } catch (err) {
      if (!alive.current || n !== prevSeq.current) return;
      setPrevEntries(null);
      setPrevError(errorText(err, '전년 장부를 불러오지 못했습니다'));
    } finally {
      if (alive.current && n === prevSeq.current) setPrevLoading(false);
    }
  }, [year, alive]);

  useEffect(() => {
    void load();
    return () => {
      seq.current += 1;
    };
  }, [load]);

  useEffect(() => {
    void loadPrev();
    return () => {
      prevSeq.current += 1;
    };
  }, [loadPrev]);

  /** 저장하지 않은 변경이 있으면 먼저 묻는다 */
  const guard = (action: () => void) => {
    if (dirty) setPending(() => action);
    else action();
  };

  const changeYear = (y: number) =>
    guard(() => {
      setYear(y);
      setThroughMonth(0);
    });

  const selectRevision = (revision: number) =>
    guard(() => {
      const found = budgets.find((b) => b.revision === revision);
      if (found) show(draftOfBudget(found));
    });

  const latest = latestBudget(budgets, year);
  const hasUnsavedNew = draft !== null && draft.id === null;
  const canSupplement = latest !== null && latest.revision < MAX_REVISION && !hasUnsavedNew && !loading;

  const makeFirst = () => guard(() => show(emptyBudgetDraft(year, 0)));
  const makeSupplement = () => {
    if (!latest) return;
    guard(() => show(supplementaryOf(latest), false));
  };

  const applySaved = (saved: Budget) => {
    setBudgets((cur) => [...cur.filter((b) => b.id !== saved.id && b.revision !== saved.revision), saved].sort((a, b) => a.revision - b.revision));
    show(draftOfBudget(saved));
  };

  const run = async (kind: 'save' | 'confirm' | 'unconfirm' | 'delete') => {
    if (busyRef.current || draft === null) return;
    busyRef.current = true;
    if (kind === 'save') setSaving(true);
    else setWorking(true);
    setSaveError(null);
    try {
      if (kind === 'save') {
        if (draftIssues(draft).length > 0) {
          setSaveError(draftIssues(draft)[0]);
          return;
        }
        const saved = await saveBudget(inputOfBudgetDraft(draft));
        if (!alive.current) return;
        applySaved(saved);
        notify('예산을 저장했습니다', 'success');
      } else if (draft.id !== null) {
        if (kind === 'confirm') {
          const saved = await confirmBudget(draft.id);
          if (!alive.current) return;
          applySaved(saved);
          notify('예산을 확정했습니다', 'success');
        } else if (kind === 'unconfirm') {
          const saved = await unconfirmBudget(draft.id);
          if (!alive.current) return;
          applySaved(saved);
          notify('확정을 풀었습니다. 이제 고칠 수 있습니다', 'success');
        } else {
          await deleteBudget(draft.id);
          if (!alive.current) return;
          const id = draft.id;
          const rest = budgets.filter((b) => b.id !== id);
          setBudgets(rest);
          const next = latestBudget(rest, year);
          show(next ? draftOfBudget(next) : null);
          notify('예산을 삭제했습니다', 'success');
        }
      }
    } catch (err) {
      if (alive.current) {
        const fallback = { save: '예산을 저장하지 못했습니다', confirm: '예산을 확정하지 못했습니다', unconfirm: '예산 확정을 풀지 못했습니다', delete: '예산을 삭제하지 못했습니다' }[kind];
        setSaveError(errorText(err, fallback));
      }
    } finally {
      busyRef.current = false;
      if (alive.current) {
        setSaving(false);
        setWorking(false);
        setToDelete(false);
      }
    }
  };

  const applyProposals = (picked: Array<{ direction: LedgerDirection; accountCode: string; amount: number }>) =>
    setDraft((cur) => {
      if (cur === null) return cur;
      const lines = cur.lines.map((l) => ({ ...l }));
      for (const p of picked) {
        const found = lines.find((l) => l.direction === p.direction && l.accountCode === p.accountCode);
        if (found) found.amount = p.amount;
        else lines.push(newLine(p.direction, p.accountCode, p.amount));
      }
      return { ...cur, lines };
    });

  const plain = useMemo(() => (draft === null ? null : { lines: plainLines(draft) }), [draft]);
  const vs = useMemo(() => budgetVsActual(plain, entries, year, throughMonth === 0 ? undefined : throughMonth), [plain, entries, year, throughMonth]);
  const settled = useMemo(() => settlement(plain, entries, year), [plain, entries, year]);

  const revisionOptions = useMemo(() => {
    const list = budgets.map((b) => ({ value: String(b.revision), label: `${revisionLabel(b.revision)}${b.status === 'CONFIRMED' ? ' (확정)' : ''}` }));
    if (draft !== null && draft.id === null && !budgets.some((b) => b.revision === draft.revision)) list.push({ value: String(draft.revision), label: `${revisionLabel(draft.revision)} (저장 전)` });
    return list.sort((a, b) => Number(a.value) - Number(b.value));
  }, [budgets, draft]);

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <YearStepper value={year} onChange={changeYear} max={thisYear + 1} isDisabled={saving || working} />
        {revisionOptions.length > 0 && (
          <div style={{ minWidth: 180 }}>
            <Selector label="차수" options={revisionOptions} value={draft === null ? undefined : String(draft.revision)} onChange={(v) => selectRevision(Number(v))} isDisabled={saving || working} />
          </div>
        )}
        <span className={styles.spacer} />
        {budgets.length === 0 && draft === null && <Button label="본예산 만들기" variant="primary" isDisabled={loading} onClick={makeFirst} />}
        <Button label="추경 만들기" variant="secondary" isDisabled={!canSupplement || saving || working} onClick={makeSupplement} />
      </div>
      <Text type="supporting" color="secondary">
        추경 만들기는 가장 뒤 차수({latest ? revisionLabel(latest.revision) : '없음'})를 복사해 다음 차수 초안을 만듭니다. 저장해야 추경이 만들어집니다.
      </Text>

      {error && <ErrorBanner message={error} onRetry={() => void load()} />}

      <BudgetDeadlines year={year} revision={draft?.revision ?? 0} decidedOn={draft?.decidedOn ?? ''} today={today} />

      {loading ? (
        <Loading size="section" label="예산을 불러오는 중..." />
      ) : draft === null ? (
        <Card padding={4}>
          <VStack gap={2}>
            <Text type="label">{year}년 예산이 아직 없습니다</Text>
            <Text type="supporting" color="secondary">
              ‘본예산 만들기’를 누르고 세입·세출 줄을 적거나, 전년 실적·AI로 초안을 받아 보세요. 그 해 회계 장부의 집행과 결산은 아래에서 예산 없이도 볼 수 있습니다.
            </Text>
            <HStack gap={2}>
              <Button label="본예산 만들기" variant="primary" onClick={makeFirst} />
            </HStack>
          </VStack>
        </Card>
      ) : (
        <>
          <BudgetEditor
            draft={draft}
            baseline={baseline}
            onChange={setDraft}
            saving={saving}
            working={working}
            error={saveError}
            onSave={() => void run('save')}
            onConfirm={() => void run('confirm')}
            onUnconfirm={() => void run('unconfirm')}
            onDelete={() => setToDelete(true)}
          />
          <BudgetDraftTools
            year={year}
            lines={draft.lines}
            prevEntries={prevEntries}
            prevLoading={prevLoading}
            prevError={prevError}
            onReloadPrev={() => void loadPrev()}
            isLocked={draft.status === 'CONFIRMED'}
            onApply={applyProposals}
          />
        </>
      )}

      <BudgetVsActual result={vs} throughMonth={throughMonth} onThroughMonth={setThroughMonth} loading={ledgerLoading} ledgerError={ledgerError} hasBudget={draft !== null && draft.lines.length > 0} />
      {dirty && <Text type="supporting" color="secondary">집행 표와 결산에는 저장하지 않은 변경도 반영되어 있습니다.</Text>}
      <BudgetSettlement year={year} revision={draft === null ? null : draft.revision} settlement={settled} disabled={ledgerLoading || ledgerError !== null} />

      <LabConfirm
        isOpen={toDelete}
        title="이 예산을 삭제할까요?"
        description={draft ? `${draft.fiscalYear}년 ${revisionLabel(draft.revision)} — 삭제하면 되돌릴 수 없습니다.` : ''}
        actionLabel="삭제"
        isLoading={working}
        onConfirm={() => void run('delete')}
        onClose={() => setToDelete(false)}
      />
      <LabConfirm
        isOpen={pending !== null}
        title="저장하지 않은 변경이 있습니다"
        description="계속하면 지금 고친 내용이 사라집니다. 계속할까요?"
        actionLabel="버리고 계속"
        onConfirm={() => {
          const action = pending;
          setPending(null);
          action?.();
        }}
        onClose={() => setPending(null)}
      />
    </div>
  );
}
