'use client';

/** 회의 보기 — 올해(연도 이동) 현황·목록·편집기·인쇄. 저장하지 않은 변경이 있으면 다른 회의를 열거나 해를 바꾸기 전에 묻는다. */
import { useRef, useState } from 'react';
import { LabConfirm, useNotify } from '@/components/lab/LabUi';
import { PROVIDER_KEY, defaultPersonName, errorText, writeStored } from '@/components/lab/labFormat';
import { YearStepper } from '@/components/labRecords/RecordsUi';
import { useAlive } from '@/components/labRecords/recordsFormat';
import { createCommitteeMeeting, deleteCommitteeMeeting, updateCommitteeMeeting } from '@/lib/lab/labApi';
import type { CommitteeMeeting, CommitteeMember } from '@/lib/lab/labTypes';
import { useCommitteeMeetings } from './CommitteeData';
import { draftOfMeeting, emptyMeetingDraft, inputOfMeeting, meetingBlockers, meetingFingerprint } from './CommitteeDraft';
import type { MeetingDraft } from './CommitteeDraft';
import CommitteeMeetingEditor from './CommitteeMeetingEditor';
import CommitteeMeetingList from './CommitteeMeetingList';
import CommitteeMinutesPrint from './CommitteeMinutesPrint';
import styles from './labPlans.module.css';

interface Props {
  members: CommitteeMember[];
  today: string;
}

export default function CommitteeMeetingsPanel({ members, today }: Props) {
  const alive = useAlive();
  const notify = useNotify();
  const thisYear = Number(today.slice(0, 4));
  const [year, setYear] = useState(thisYear);
  const { meetings, loading, error, reload } = useCommitteeMeetings(year);
  const [initial] = useState(() => emptyMeetingDraft(today, defaultPersonName()));
  const [draft, setDraft] = useState<MeetingDraft>(initial);
  const [baseline, setBaseline] = useState(() => meetingFingerprint(initial));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toDelete, setToDelete] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [printed, setPrinted] = useState<CommitteeMeeting | null>(null);
  const [printKey, setPrintKey] = useState(0);
  const busy = useRef(false);
  const dirty = meetingFingerprint(draft) !== baseline;

  const show = (d: MeetingDraft) => {
    setDraft(d);
    setBaseline(meetingFingerprint(d));
    setSaveError(null);
  };
  const guard = (action: () => void) => (dirty ? setPending(() => action) : action());
  const blank = () => emptyMeetingDraft(today, draft.writerName || defaultPersonName());

  const save = async () => {
    if (busy.current) return;
    const issues = meetingBlockers(draft);
    if (issues.length > 0) {
      setSaveError(issues[0]);
      return;
    }
    busy.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const input = inputOfMeeting(draft);
      const saved = draft.id === null ? await createCommitteeMeeting(input) : await updateCommitteeMeeting(draft.id, input);
      if (!alive.current) return;
      if (draft.writerName.trim() !== '') writeStored(PROVIDER_KEY, draft.writerName.trim());
      notify(draft.id === null ? '회의를 기록했습니다' : '회의 기록을 고쳤습니다', 'success');
      show(draftOfMeeting(saved));
      // 저장한 회의가 다른 해로 옮겨 갔을 수 있어 그 해로 따라간다
      const savedYear = Number(saved.heldOn.slice(0, 4));
      if (savedYear !== year) setYear(savedYear);
      else await reload();
    } catch (err) {
      if (alive.current) setSaveError(errorText(err, '회의 기록을 저장하지 못했습니다'));
    } finally {
      busy.current = false;
      if (alive.current) setSaving(false);
    }
  };

  const remove = async () => {
    if (draft.id === null || deleting) return;
    const id = draft.id;
    setDeleting(true);
    try {
      await deleteCommitteeMeeting(id);
      if (!alive.current) return;
      notify('회의 기록을 삭제했습니다', 'success');
      setToDelete(false);
      show(blank());
      await reload();
    } catch (err) {
      if (alive.current) {
        notify(errorText(err, '회의 기록을 삭제하지 못했습니다'), 'error');
        setToDelete(false);
      }
    } finally {
      if (alive.current) setDeleting(false);
    }
  };

  const print = () => {
    const m = meetings.find((x) => x.id === draft.id);
    if (!m) return;
    setPrinted(m);
    setPrintKey((k) => k + 1);
  };

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <YearStepper value={year} onChange={(y) => guard(() => setYear(y))} isDisabled={saving} max={thisYear + 1} />
      </div>
      <CommitteeMeetingList year={year} today={today} meetings={meetings} loading={loading} error={error} activeId={draft.id} onRetry={() => void reload()} onOpen={(m) => guard(() => show(draftOfMeeting(m)))} />
      <CommitteeMeetingEditor
        draft={draft}
        onChange={(patch) => setDraft(patch)}
        members={members}
        today={today}
        dirty={dirty}
        saving={saving}
        deleting={deleting}
        error={saveError}
        onSave={() => void save()}
        onCancel={() => guard(() => show(blank()))}
        onDelete={() => setToDelete(true)}
        onPrint={print}
      />
      <CommitteeMinutesPrint meeting={printed} members={members} printKey={printKey} onReady={() => window.print()} />
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
      <LabConfirm isOpen={toDelete} title="이 회의 기록을 삭제할까요?" description="저장한 회의 기록이 지워지고 되돌릴 수 없습니다." actionLabel="삭제" isLoading={deleting} onConfirm={() => void remove()} onClose={() => setToDelete(false)} />
    </div>
  );
}
