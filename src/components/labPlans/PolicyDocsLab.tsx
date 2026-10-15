'use client';

/**
 * 규정·지침 대장 — 종류별 대장 목록(상태 칩·개정일·비치 장소·교육일), 문서 편집과 항목 체크, 원문 AI 항목 점검, A4 인쇄.
 * 저장하지 않은 변경이 있으면 다른 문서를 열기 전에 묻는다. 저장 버튼은 두 번 눌러도 한 번만 저장한다.
 */
import { useRef, useState } from 'react';
import { LabConfirm, useNotify } from '@/components/lab/LabUi';
import { errorText, todayString } from '@/components/lab/labFormat';
import { useAlive } from '@/components/labRecords/recordsFormat';
import { createPolicyDoc, deletePolicyDoc, updatePolicyDoc } from '@/lib/lab/labApi';
import type { PolicyDoc } from '@/lib/lab/labTypes';
import { usePolicyDocs } from './PolicyDocData';
import { draftOfPolicy, emptyPolicyDraft, inputOfPolicy, policyBlockers, policyFingerprint } from './PolicyDocDraft';
import type { PolicyDraft } from './PolicyDocDraft';
import PolicyDocEditor from './PolicyDocEditor';
import { hasSameKind, slotKeyOf } from './PolicyDocKinds';
import type { Slot } from './PolicyDocKinds';
import PolicyDocList from './PolicyDocList';
import { PolicyDocIntro } from './PolicyDocNotes';
import PolicyDocPrint from './PolicyDocPrint';
import styles from './labPlans.module.css';

export default function PolicyDocsLab() {
  const alive = useAlive();
  const notify = useNotify();
  const today = todayString();
  const { docs, loading, error, reload } = usePolicyDocs();
  const [initial] = useState(() => emptyPolicyDraft('OPERATING_RULES', null));
  const [draft, setDraft] = useState<PolicyDraft>(initial);
  const [baseline, setBaseline] = useState(() => policyFingerprint(initial));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toDelete, setToDelete] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [printDocs, setPrintDocs] = useState<PolicyDoc[] | null>(null);
  const [printKey, setPrintKey] = useState(0);
  const busy = useRef(false);
  const dirty = policyFingerprint(draft) !== baseline;
  const duplicate = hasSameKind(docs, draft.kind, draft.guideNo, draft.id);
  const activeSlot = draft.id === null && draft.kind !== 'OTHER' ? slotKeyOf(draft) : null;

  const show = (d: PolicyDraft) => {
    setDraft(d);
    setBaseline(policyFingerprint(d));
    setSaveError(null);
  };
  const guard = (action: () => void) => (dirty ? setPending(() => action) : action());

  const save = async () => {
    if (busy.current) return;
    const issues = policyBlockers(draft, today, duplicate);
    if (issues.length > 0) {
      setSaveError(issues[0]);
      return;
    }
    busy.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const input = inputOfPolicy(draft);
      const saved = draft.id === null ? await createPolicyDoc(input) : await updatePolicyDoc(draft.id, input);
      if (!alive.current) return;
      notify(draft.id === null ? '규정·지침을 대장에 올렸습니다' : '규정·지침을 고쳤습니다', 'success');
      show(draftOfPolicy(saved));
      await reload();
    } catch (err) {
      if (alive.current) setSaveError(errorText(err, '규정·지침을 저장하지 못했습니다'));
    } finally {
      busy.current = false;
      if (alive.current) setSaving(false);
    }
  };

  const remove = async () => {
    if (draft.id === null || deleting) return;
    setDeleting(true);
    try {
      await deletePolicyDoc(draft.id);
      if (!alive.current) return;
      notify('규정·지침을 대장에서 지웠습니다', 'success');
      setToDelete(false);
      show(emptyPolicyDraft('OPERATING_RULES', null));
      await reload();
    } catch (err) {
      if (alive.current) {
        notify(errorText(err, '규정·지침을 삭제하지 못했습니다'), 'error');
        setToDelete(false);
      }
    } finally {
      if (alive.current) setDeleting(false);
    }
  };

  const print = () => {
    setPrintDocs(docs);
    setPrintKey((k) => k + 1);
  };

  return (
    <div className={styles.stack}>
      <PolicyDocIntro />
      <PolicyDocList
        docs={docs}
        today={today}
        loading={loading}
        error={error}
        activeId={draft.id}
        activeSlot={activeSlot}
        isDisabled={saving}
        onRetry={() => void reload()}
        onOpenDoc={(d) => guard(() => show(draftOfPolicy(d)))}
        onOpenSlot={(s: Slot) => guard(() => show(emptyPolicyDraft(s.kind, s.guideNo)))}
        onNewOther={() => guard(() => show(emptyPolicyDraft('OTHER', null)))}
        onPrint={print}
      />
      <PolicyDocEditor
        draft={draft}
        onChange={(patch) => setDraft(patch)}
        today={today}
        duplicate={duplicate}
        dirty={dirty}
        saving={saving}
        deleting={deleting}
        error={saveError}
        onSave={() => void save()}
        onCancel={() => guard(() => show(emptyPolicyDraft('OPERATING_RULES', null)))}
        onDelete={() => setToDelete(true)}
      />
      <PolicyDocPrint docs={printDocs} printKey={printKey} onReady={() => window.print()} />
      <LabConfirm
        isOpen={pending !== null}
        title="저장하지 않은 변경이 있습니다"
        description="저장하지 않고 넘어가면 지금 적은 내용이 사라집니다."
        actionLabel="버리고 이동"
        onConfirm={() => {
          pending?.();
          setPending(null);
        }}
        onClose={() => setPending(null)}
      />
      <LabConfirm isOpen={toDelete} title="이 규정·지침을 삭제할까요?" description="대장에서 지워지고 되돌릴 수 없습니다. 원본 문서는 따로 보관해 주세요." actionLabel="삭제" isLoading={deleting} onConfirm={() => void remove()} onClose={() => setToDelete(false)} />
    </div>
  );
}
