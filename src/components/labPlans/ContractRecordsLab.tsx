'use client';

/**
 * 계약·인정 보기 — 알림 목록, 진행 중 계약 표, 계약 없는 어르신, 편집기. 계약은 한 번에 모두 받아(listElderContracts) 표·알림·편집이 같은 자료를 쓴다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import { ErrorBanner, LabConfirm, useNotify } from '@/components/lab/LabUi';
import { errorText, todayString } from '@/components/lab/labFormat';
import type { LabElder } from '@/components/lab/useLabElders';
import { dedupeById, useAlive } from '@/components/labRecords/recordsFormat';
import { contractAlerts } from '@/lib/lab/contractRules';
import { createElderContract, deleteElderContract, listElderContracts, updateElderContract } from '@/lib/lab/labApi';
import type { ElderContract } from '@/lib/lab/labTypes';
import ContractAlerts from './ContractAlerts';
import { contractIssues, draftOfContract, emptyContractDraft, inputOfContractDraft } from './ContractDraft';
import type { ContractDraft } from './ContractDraft';
import ContractEditor from './ContractEditor';
import { endNeedsReferral } from './ContractFormat';
import ContractMissing from './ContractMissing';
import { reasonOfEnd } from './ContractReferralDraft';
import type { ReferralSeed } from './ContractReferralDraft';
import ContractTable from './ContractTable';
import styles from './labPlans.module.css';

interface Props {
  elders: LabElder[];
  eldersLoading: boolean;
  eldersError: string | null;
  /** 저장한 종료 계약으로 퇴소 연계기록지 쓰기를 시작한다 */
  onStartReferral: (seed: Omit<ReferralSeed, 'key'>) => void;
  /** 계약을 저장·삭제했다 */
  onChanged: () => void;
}

export default function ContractRecordsLab({ elders, eldersLoading, eldersError, onStartReferral, onChanged }: Props) {
  const alive = useAlive();
  const notify = useNotify();
  const today = todayString();
  const [contracts, setContracts] = useState<ElderContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ContractDraft>(() => emptyContractDraft());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<ElderContract | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showEnded, setShowEnded] = useState(false);
  const seq = useRef(0);
  const savingRef = useRef(false);
  const editorRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const n = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const list = await listElderContracts();
      if (!alive.current || n !== seq.current) return;
      setContracts(dedupeById(list));
    } catch (err) {
      if (!alive.current || n !== seq.current) return;
      setContracts([]);
      setError(errorText(err, '계약 목록을 불러오지 못했습니다'));
    } finally {
      if (alive.current && n === seq.current) setLoading(false);
    }
  }, [alive]);

  useEffect(() => {
    void load();
    return () => {
      seq.current += 1;
    };
  }, [load]);

  const active = useMemo(() => contracts.filter((c) => c.status === 'ACTIVE').sort((a, b) => a.elderlyName.localeCompare(b.elderlyName, 'ko')), [contracts]);
  const ended = useMemo(() => contracts.filter((c) => c.status === 'ENDED').sort((a, b) => ((a.contractEnd ?? '') < (b.contractEnd ?? '') ? 1 : -1)), [contracts]);
  const alerts = useMemo(() => contractAlerts(contracts, today), [contracts, today]);
  const activeOf = useMemo(() => new Map(active.map((c) => [c.elderlyId, c.id])), [active]);
  const nameOf = useCallback(
    (id: number) => contracts.find((c) => c.elderlyId === id)?.elderlyName ?? elders.find((e) => e.id === id)?.name ?? '(알 수 없는 어르신)',
    [contracts, elders],
  );
  const without = useMemo(() => elders.filter((e) => !activeOf.has(e.id)), [elders, activeOf]);

  const openEditor = (next: ContractDraft) => {
    setDraft(next);
    setSaveError(null);
    // 편집기가 화면 밖이면 보이는 곳으로 옮긴다
    setTimeout(() => editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };

  const applySaved = (saved: ElderContract) => setContracts((cur) => [...cur.filter((x) => x.id !== saved.id), saved]);

  const save = async (thenReferral: boolean) => {
    if (savingRef.current) return;
    const issues = contractIssues(draft, activeOf);
    if (issues.length > 0) {
      setSaveError(issues[0]);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const input = inputOfContractDraft(draft);
      const saved = draft.id === null ? await createElderContract(input) : await updateElderContract(draft.id, input);
      if (!alive.current) return;
      applySaved(saved);
      onChanged();
      notify(draft.id === null ? '계약을 등록했습니다' : '계약을 고쳤습니다', 'success');
      setDraft(emptyContractDraft());
      const reason = reasonOfEnd(saved.endReason);
      if (thenReferral && saved.status === 'ENDED' && endNeedsReferral(saved.endReason) && reason && saved.contractEnd) {
        onStartReferral({ elderlyId: saved.elderlyId, contractId: saved.id, dischargeOn: saved.contractEnd, reason, careGrade: saved.careGrade });
      }
    } catch (err) {
      if (alive.current) setSaveError(errorText(err, '계약을 저장하지 못했습니다'));
    } finally {
      savingRef.current = false;
      if (alive.current) setSaving(false);
    }
  };

  const remove = async () => {
    if (!toDelete || deleting) return;
    setDeleting(true);
    try {
      await deleteElderContract(toDelete.id);
      if (!alive.current) return;
      const id = toDelete.id;
      setContracts((cur) => cur.filter((x) => x.id !== id));
      setDraft((d) => (d.id === id ? emptyContractDraft() : d));
      onChanged();
      notify('계약을 삭제했습니다', 'success');
      setToDelete(null);
    } catch (err) {
      if (alive.current) {
        notify(errorText(err, '계약을 삭제하지 못했습니다'), 'error');
        setToDelete(null);
      }
    } finally {
      if (alive.current) setDeleting(false);
    }
  };

  const busy = saving || deleting;
  const fallbackName = draft.elderlyId === null ? null : nameOf(draft.elderlyId);

  return (
    <div className={styles.stack}>
      {error && <ErrorBanner message={error} onRetry={() => void load()} />}
      {eldersError && <ErrorBanner message={eldersError} />}

      {loading && contracts.length === 0 ? (
        <Loading size="section" label="계약을 불러오는 중..." />
      ) : (
        <>
          <ContractAlerts
            alerts={alerts}
            nameOf={nameOf}
            onOpen={(id) => {
              const c = contracts.find((x) => x.id === id);
              if (c) openEditor(draftOfContract(c));
            }}
          />

          <Card padding={4}>
            <VStack gap={2}>
              <HStack gap={2} vAlign="center" wrap="wrap">
                <Text type="label">진행 중 계약 ({active.length}건)</Text>
                <Button label="새 계약 등록" size="sm" variant="secondary" isDisabled={busy} onClick={() => openEditor(emptyContractDraft())} />
              </HStack>
              <ContractTable
                contracts={active}
                alerts={alerts}
                today={today}
                isBusy={busy}
                emptyText={'진행 중인 계약이 없습니다. 위 단추나 아래 목록의 "계약 등록"으로 시작하세요.'}
                onEdit={(c) => openEditor(draftOfContract(c))}
                onDelete={setToDelete}
              />
            </VStack>
          </Card>

          <ContractMissing elders={without} isBusy={busy} onRegister={(e) => openEditor(emptyContractDraft(e.id, e.careGrade))} />
        </>
      )}

      <div ref={editorRef}>
        <ContractEditor
          draft={draft}
          onChange={setDraft}
          elders={elders}
          eldersLoading={eldersLoading}
          fallbackElderName={fallbackName}
          activeOf={activeOf}
          today={today}
          saving={saving}
          error={saveError}
          onSave={() => void save(false)}
          onSaveToReferral={() => void save(true)}
          onCancel={() => {
            setDraft(emptyContractDraft());
            setSaveError(null);
          }}
        />
      </div>

      {ended.length > 0 && (
        <Card padding={4}>
          <VStack gap={2}>
            <HStack gap={2} vAlign="center" wrap="wrap">
              <Text type="label">종료한 계약 ({ended.length}건)</Text>
              <Button label={showEnded ? '접기' : '펼치기'} size="sm" variant="ghost" onClick={() => setShowEnded((v) => !v)} />
            </HStack>
            {showEnded && <ContractTable contracts={ended} alerts={[]} today={today} isBusy={busy} emptyText="" onEdit={(c) => openEditor(draftOfContract(c))} onDelete={setToDelete} />}
          </VStack>
        </Card>
      )}

      <LabConfirm
        isOpen={toDelete !== null}
        title="이 계약을 삭제할까요?"
        description={toDelete ? `${toDelete.elderlyName} ${toDelete.contractStart} 시작 계약 — 삭제하면 되돌릴 수 없습니다. 이 계약에 이어 둔 연계기록지는 남고 계약 연결만 풀립니다.` : ''}
        actionLabel="삭제"
        isLoading={deleting}
        onConfirm={() => void remove()}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}
