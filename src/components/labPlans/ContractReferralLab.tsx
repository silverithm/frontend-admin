'use client';

/**
 * 퇴소 연계기록지 보기 — 올해 퇴소 목록(요건 칩·요약), 작성 편집기, A4 연계기록지와 올해 제공대장 인쇄.
 * 올해(고른 해) 연계기록지는 한 번에 받아 목록·요약·제공대장이 같은 자료를 쓴다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import { Chip, ErrorBanner, LabConfirm, SupportText, useNotify } from '@/components/lab/LabUi';
import { defaultPersonName, errorText, PROVIDER_KEY, todayString, writeStored } from '@/components/lab/labFormat';
import type { LabElder } from '@/components/lab/useLabElders';
import { dedupeById, useAlive } from '@/components/labRecords/recordsFormat';
import { YearStepper } from '@/components/labRecords/RecordsUi';
import { referralSummary } from '@/lib/lab/dischargeRules';
import { createDischargeReferral, deleteDischargeReferral, listDischargeReferrals, listElderContracts, updateDischargeReferral } from '@/lib/lab/labApi';
import type { DischargeReferral, ElderContract } from '@/lib/lab/labTypes';
import { endReasonLabel } from './ContractFormat';
import ContractLedgerPrint from './ContractLedgerPrint';
import { draftOfReferral, draftOfSeed, emptyReferralDraft, inputOfReferralDraft, reasonOfEnd, referralIssues } from './ContractReferralDraft';
import type { ReferralDraft, ReferralSeed } from './ContractReferralDraft';
import ContractReferralEditor from './ContractReferralEditor';
import ContractReferralList, { ContractReferralMissing } from './ContractReferralList';
import ContractReferralPrint from './ContractReferralPrint';
import styles from './labPlans.module.css';

interface Props {
  elders: LabElder[];
  eldersLoading: boolean;
  eldersError: string | null;
  /** 계약 편집기에서 넘어온 값. key가 바뀔 때마다 새로 적기를 시작한다 */
  seed: ReferralSeed | null;
  /** 올라갈 때마다 계약 목록을 다시 읽는다 */
  contractsVersion: number;
}

type PrintJob = { kind: 'referral'; referral: DischargeReferral } | { kind: 'ledger' };

export default function ContractReferralLab({ elders, eldersLoading, eldersError, seed, contractsVersion }: Props) {
  const alive = useAlive();
  const notify = useNotify();
  const today = todayString();
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [referrals, setReferrals] = useState<DischargeReferral[]>([]);
  const [contracts, setContracts] = useState<ElderContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contractError, setContractError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ReferralDraft>(() => emptyReferralDraft(defaultPersonName(), todayString()));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<DischargeReferral | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [job, setJob] = useState<PrintJob | null>(null);
  const [printKey, setPrintKey] = useState(0);
  const [editorKey, setEditorKey] = useState(0);
  const seq = useRef(0);
  const savingRef = useRef(false);
  const editorRef = useRef<HTMLDivElement>(null);

  // 계약 편집기에서 넘어온 값으로 새로 적기를 시작한다(렌더 중 이전 값과 비교하는 React 권장 방식)
  const [seenSeed, setSeenSeed] = useState(0);
  if (seed && seed.key !== seenSeed) {
    setSeenSeed(seed.key);
    setEditorKey((k) => k + 1);
    setDraft(draftOfSeed(seed, defaultPersonName(), todayString()));
    setSaveError(null);
    const seedYear = Number(seed.dischargeOn.slice(0, 4));
    if (Number.isInteger(seedYear) && seedYear > 2000) setYear(seedYear);
  }

  const load = useCallback(async () => {
    const n = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const list = await listDischargeReferrals({ year });
      if (!alive.current || n !== seq.current) return;
      setReferrals(dedupeById(list));
    } catch (err) {
      if (!alive.current || n !== seq.current) return;
      setReferrals([]);
      setError(errorText(err, '퇴소 연계기록지를 불러오지 못했습니다'));
    } finally {
      if (alive.current && n === seq.current) setLoading(false);
    }
  }, [year, alive]);

  useEffect(() => {
    void load();
    return () => {
      seq.current += 1;
    };
  }, [load]);

  // 계약은 연결 고르기와 "안 쓴 종료 계약" 찾기에 쓴다. 못 읽어도 연계기록지 쓰기는 된다.
  useEffect(() => {
    let cancelled = false;
    listElderContracts()
      .then((list) => {
        if (cancelled) return;
        setContracts(dedupeById(list));
        setContractError(null);
      })
      .catch((err) => {
        if (!cancelled) setContractError(errorText(err, '계약 목록을 불러오지 못해 계약 연결과 "안 쓴 종료 계약" 안내를 쓸 수 없습니다'));
      });
    return () => {
      cancelled = true;
    };
  }, [contractsVersion]);

  const sorted = useMemo(() => [...referrals].sort((a, b) => (a.dischargeOn < b.dischargeOn ? 1 : a.dischargeOn > b.dischargeOn ? -1 : b.id - a.id)), [referrals]);
  const summary = useMemo(() => referralSummary(referrals, year), [referrals, year]);
  const missing = useMemo(
    () =>
      contracts
        .filter((c) => c.status === 'ENDED' && c.contractEnd !== null && c.contractEnd.startsWith(`${year}-`) && reasonOfEnd(c.endReason) !== null)
        .filter((c) => !referrals.some((r) => r.contractId === c.id || (r.elderlyId === c.elderlyId && r.dischargeOn === c.contractEnd)))
        .map((c) => ({ contractId: c.id, elderlyId: c.elderlyId, name: c.elderlyName, endedOn: c.contractEnd as string, reasonLabel: endReasonLabel(c.endReason) })),
    [contracts, referrals, year],
  );

  const open = (next: ReferralDraft) => {
    setDraft(next);
    setEditorKey((k) => k + 1);
    setSaveError(null);
    setTimeout(() => editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };

  const save = async () => {
    if (savingRef.current) return;
    const issues = referralIssues(draft);
    if (issues.length > 0) {
      setSaveError(issues[0]);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const input = inputOfReferralDraft(draft);
      const saved = draft.id === null ? await createDischargeReferral(input) : await updateDischargeReferral(draft.id, input);
      if (!alive.current) return;
      setReferrals((cur) => {
        const rest = cur.filter((x) => x.id !== saved.id);
        return saved.dischargeOn.startsWith(`${year}-`) ? [...rest, saved] : rest;
      });
      if (draft.writerName.trim() !== '') writeStored(PROVIDER_KEY, draft.writerName.trim());
      notify(draft.id === null ? '퇴소 연계기록지를 저장했습니다' : '퇴소 연계기록지를 고쳤습니다', 'success');
      setDraft(emptyReferralDraft(draft.writerName, todayString()));
      setEditorKey((k) => k + 1);
    } catch (err) {
      if (alive.current) setSaveError(errorText(err, '퇴소 연계기록지를 저장하지 못했습니다'));
    } finally {
      savingRef.current = false;
      if (alive.current) setSaving(false);
    }
  };

  const remove = async () => {
    if (!toDelete || deleting) return;
    setDeleting(true);
    try {
      await deleteDischargeReferral(toDelete.id);
      if (!alive.current) return;
      const id = toDelete.id;
      setReferrals((cur) => cur.filter((x) => x.id !== id));
      setDraft((d) => (d.id === id ? emptyReferralDraft(d.writerName, todayString()) : d));
      notify('퇴소 연계기록지를 삭제했습니다', 'success');
      setToDelete(null);
    } catch (err) {
      if (alive.current) {
        notify(errorText(err, '퇴소 연계기록지를 삭제하지 못했습니다'), 'error');
        setToDelete(null);
      }
    } finally {
      if (alive.current) setDeleting(false);
    }
  };

  const startPrint = (next: PrintJob) => {
    setJob(next);
    setPrintKey((k) => k + 1);
  };

  const busy = saving || deleting;
  const fallbackName = draft.elderlyId === null ? null : (referrals.find((r) => r.elderlyId === draft.elderlyId)?.elderlyName ?? contracts.find((c) => c.elderlyId === draft.elderlyId)?.elderlyName ?? null);

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <YearStepper value={year} onChange={setYear} isDisabled={busy} />
        <span className={styles.spacer} />
        <Button label="올해 제공대장 인쇄" variant="secondary" isDisabled={loading || busy} onClick={() => startPrint({ kind: 'ledger' })} />
      </div>

      <Card padding={4}>
        <VStack gap={2}>
          <Text type="label">2026 평가 30 기준② — 퇴소 연계기록지</Text>
          <SupportText>
            계약 종료일까지 수급자(보호자)에게 연계기록지를 써서 드리고, 사본과 제공대장으로 확인합니다. 사망하거나 퇴소 없이 입원만 한 경우는 쓰지 않습니다. 작성·제공이 퇴소일보다 늦으면 상담기록지 등 관련 서류로 예외가 인정될 수 있습니다.
          </SupportText>
        </VStack>
      </Card>

      {error && <ErrorBanner message={error} onRetry={() => void load()} />}
      {eldersError && <ErrorBanner message={eldersError} />}
      {contractError && <SupportText tone="warn">{contractError}</SupportText>}

      <Card padding={4}>
        <VStack gap={2}>
          <HStack gap={2} vAlign="center" wrap="wrap">
            <Text type="label">{year}년 퇴소 연계기록지 ({sorted.length}건)</Text>
            {!loading && (summary.total === 0 ? <Chip tone="ok" label="퇴소자 없음 — 충족으로 봅니다" /> : null)}
            {summary.total > 0 && (
              <>
                <Chip tone="neutral" label={`퇴소 ${summary.total}명`} />
                <Chip tone={summary.provided === summary.total ? 'ok' : 'warn'} label={`제공대장 ${summary.provided}명`} />
                <Chip tone={summary.onTime === summary.total ? 'ok' : 'warn'} label={`기한 안 제공 ${summary.onTime}명`} />
              </>
            )}
          </HStack>
          {loading && referrals.length === 0 ? (
            <Loading size="section" label="퇴소 연계기록지를 불러오는 중..." />
          ) : (
            <ContractReferralList
              referrals={sorted}
              isBusy={busy}
              onEdit={(r) => open(draftOfReferral(r))}
              onDelete={setToDelete}
              onPrint={(r) => startPrint({ kind: 'referral', referral: r })}
            />
          )}
          <ContractReferralMissing
            items={missing}
            isBusy={busy}
            onWrite={(contractId) => {
              const c = contracts.find((x) => x.id === contractId);
              const reason = c ? reasonOfEnd(c.endReason) : null;
              if (c && reason && c.contractEnd) open(draftOfSeed({ key: 0, elderlyId: c.elderlyId, contractId: c.id, dischargeOn: c.contractEnd, reason, careGrade: c.careGrade }, defaultPersonName(), todayString()));
            }}
          />
          {sorted.length > 0 && <SupportText>“연계기록지 인쇄”는 그 어르신의 A4 사본을, 위의 “올해 제공대장 인쇄”는 이 해 전체 대장을 인쇄 창으로 보냅니다.</SupportText>}
        </VStack>
      </Card>

      <div ref={editorRef}>
        <ContractReferralEditor
          key={editorKey}
          draft={draft}
          onChange={setDraft}
          elders={elders}
          eldersLoading={eldersLoading}
          fallbackElderName={fallbackName}
          contracts={contracts}
          saving={saving}
          error={saveError}
          onSave={() => void save()}
          onCancel={() => {
            setDraft(emptyReferralDraft(draft.writerName, todayString()));
            setEditorKey((k) => k + 1);
            setSaveError(null);
          }}
        />
      </div>

      {job?.kind === 'referral' && <ContractReferralPrint referral={job.referral} printKey={printKey} onReady={() => window.print()} />}
      {job?.kind === 'ledger' && <ContractLedgerPrint year={year} referrals={referrals} printKey={printKey} onReady={() => window.print()} />}

      <LabConfirm
        isOpen={toDelete !== null}
        title="이 퇴소 연계기록지를 삭제할까요?"
        description={toDelete ? `${toDelete.dischargeOn} 퇴소 ${toDelete.elderlyName} — 삭제하면 되돌릴 수 없습니다.` : ''}
        actionLabel="삭제"
        isLoading={deleting}
        onConfirm={() => void remove()}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}
