'use client';

/** 위원 명단 보기 — 현황·목록·입력 양식. 저장하지 않은 변경이 있으면 다른 위원을 열기 전에 묻는다. */
import { useState } from 'react';
import { LabConfirm, useNotify } from '@/components/lab/LabUi';
import { errorText } from '@/components/lab/labFormat';
import { useAlive } from '@/components/labRecords/recordsFormat';
import { createCommitteeMember, deleteCommitteeMember, updateCommitteeMember } from '@/lib/lab/labApi';
import type { CommitteeMember } from '@/lib/lab/labTypes';
import { draftOfMember, emptyMemberDraft, inputOfMember, memberBlockers, memberFingerprint } from './CommitteeDraft';
import type { MemberDraft } from './CommitteeDraft';
import CommitteeMemberForm from './CommitteeMemberForm';
import CommitteeMemberList from './CommitteeMemberList';
import styles from './labPlans.module.css';

interface Props {
  members: CommitteeMember[];
  loading: boolean;
  error: string | null;
  today: string;
  onReload: () => Promise<void>;
}

export default function CommitteeMembersPanel({ members, loading, error, today, onReload }: Props) {
  const alive = useAlive();
  const notify = useNotify();
  const [initial] = useState(() => emptyMemberDraft(today));
  const [draft, setDraft] = useState<MemberDraft>(initial);
  const [baseline, setBaseline] = useState(() => memberFingerprint(initial));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [toDelete, setToDelete] = useState<CommitteeMember | null>(null);
  const [deleting, setDeleting] = useState(false);
  const dirty = memberFingerprint(draft) !== baseline;

  const show = (d: MemberDraft) => {
    setDraft(d);
    setBaseline(memberFingerprint(d));
    setSaveError(null);
  };
  const guard = (action: () => void) => (dirty ? setPending(() => action) : action());

  const save = async () => {
    if (saving) return;
    const issues = memberBlockers(draft);
    if (issues.length > 0) {
      setSaveError(issues[0]);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const input = inputOfMember(draft);
      if (draft.id === null) await createCommitteeMember(input);
      else await updateCommitteeMember(draft.id, input);
      if (!alive.current) return;
      notify(draft.id === null ? '위원을 추가했습니다' : '위원 정보를 고쳤습니다', 'success');
      show(emptyMemberDraft(today));
      await onReload();
    } catch (err) {
      if (alive.current) setSaveError(errorText(err, '위원을 저장하지 못했습니다'));
    } finally {
      if (alive.current) setSaving(false);
    }
  };

  const remove = async () => {
    if (!toDelete || deleting) return;
    const target = toDelete;
    setDeleting(true);
    try {
      await deleteCommitteeMember(target.id);
      if (!alive.current) return;
      notify('위원을 삭제했습니다', 'success');
      setToDelete(null);
      if (draft.id === target.id) show(emptyMemberDraft(today));
      await onReload();
    } catch (err) {
      if (alive.current) {
        notify(errorText(err, '위원을 삭제하지 못했습니다'), 'error');
        setToDelete(null);
      }
    } finally {
      if (alive.current) setDeleting(false);
    }
  };

  return (
    <div className={styles.stack}>
      <CommitteeMemberList members={members} today={today} loading={loading} error={error} busy={saving || deleting} onRetry={() => void onReload()} onEdit={(m) => guard(() => show(draftOfMember(m)))} onDelete={setToDelete} />
      <CommitteeMemberForm
        draft={draft}
        onChange={setDraft}
        dirty={dirty}
        saving={saving}
        error={saveError}
        onSave={() => void save()}
        onCancel={() => guard(() => show(emptyMemberDraft(today)))}
      />
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
      <LabConfirm
        isOpen={toDelete !== null}
        title={toDelete ? `${toDelete.name} 위원을 삭제할까요?` : ''}
        description="명단에서 지워지고 되돌릴 수 없습니다. 임기가 끝났거나 그만둔 위원은 삭제하지 말고 ‘활동 중’을 해제해 두면 지난 회의 참석 기록이 남습니다."
        actionLabel="삭제"
        isLoading={deleting}
        onConfirm={() => void remove()}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}
