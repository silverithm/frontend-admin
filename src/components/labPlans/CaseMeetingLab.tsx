'use client';

/**
 * 사례관리 회의 — 반기 현황, 연도별 회의 목록, 회의 쓰기(참석 직종 확인·AI 정리·대상별 반영과 평가), A4 인쇄.
 * 저장하지 않은 변경이 있으면 다른 회의를 열거나 해를 바꾸기 전에 묻는다. 저장 버튼은 두 번 눌러도 한 번만 저장한다.
 */
import { useRef, useState } from 'react';
import { LabConfirm, useNotify } from '@/components/lab/LabUi';
import { defaultPersonName, errorText, todayString } from '@/components/lab/labFormat';
import { useLabElders } from '@/components/lab/useLabElders';
import { useAlive } from '@/components/labRecords/recordsFormat';
import { createCaseMeeting, deleteCaseMeeting, updateCaseMeeting } from '@/lib/lab/labApi';
import type { CaseMeeting } from '@/lib/lab/labTypes';
import { useCaseMeetings, useCaseRoster } from './CaseMeetingData';
import { draftOfMeeting, emptyMeetingDraft, inputOfMeeting, meetingBlockers, meetingFingerprint } from './CaseMeetingDraft';
import type { MeetingDraft } from './CaseMeetingDraft';
import CaseMeetingEditor from './CaseMeetingEditor';
import CaseMeetingList from './CaseMeetingList';
import { CaseMeetingGuide, CaseMeetingIntro } from './CaseMeetingNotes';
import CaseMeetingPrint from './CaseMeetingPrint';
import CaseMeetingStatus from './CaseMeetingStatus';
import styles from './labPlans.module.css';

export default function CaseMeetingLab() {
  const alive = useAlive();
  const notify = useNotify();
  const today = todayString();
  const thisYear = Number(today.slice(0, 4));
  const [year, setYear] = useState(thisYear);
  const [refreshKey, setRefreshKey] = useState(0);
  const roster = useCaseRoster();
  const elders = useLabElders();
  const list = useCaseMeetings([year], refreshKey);
  const statusYears = useCaseMeetings([thisYear, thisYear - 1], refreshKey);
  const [initial] = useState(() => emptyMeetingDraft(today));
  const [draft, setDraft] = useState<MeetingDraft>(initial);
  const [baseline, setBaseline] = useState(() => meetingFingerprint(initial));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toDelete, setToDelete] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [printed, setPrinted] = useState<CaseMeeting | null>(null);
  const [printKey, setPrintKey] = useState(0);
  const busy = useRef(false);
  const dirty = meetingFingerprint(draft) !== baseline;

  const show = (d: MeetingDraft) => {
    setDraft(d);
    setBaseline(meetingFingerprint(d));
    setSaveError(null);
  };
  const guard = (action: () => void) => (dirty ? setPending(() => action) : action());
  const reloadAll = () => setRefreshKey((k) => k + 1);

  const save = async () => {
    if (busy.current) return;
    const issues = meetingBlockers(draft, today);
    if (issues.length > 0) {
      setSaveError(issues[0]);
      return;
    }
    busy.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const input = inputOfMeeting(draft);
      const saved = draft.id === null ? await createCaseMeeting(input) : await updateCaseMeeting(draft.id, input);
      if (!alive.current) return;
      notify(draft.id === null ? '사례관리 회의를 기록했습니다' : '사례관리 회의 기록을 고쳤습니다', 'success');
      show(draftOfMeeting(saved));
      const savedYear = Number(saved.heldOn.slice(0, 4));
      if (savedYear !== year) setYear(savedYear);
      reloadAll();
    } catch (err) {
      if (alive.current) setSaveError(errorText(err, '사례관리 회의를 저장하지 못했습니다'));
    } finally {
      busy.current = false;
      if (alive.current) setSaving(false);
    }
  };

  const remove = async () => {
    if (draft.id === null || deleting) return;
    setDeleting(true);
    try {
      await deleteCaseMeeting(draft.id);
      if (!alive.current) return;
      notify('사례관리 회의 기록을 삭제했습니다', 'success');
      setToDelete(false);
      show(emptyMeetingDraft(today));
      reloadAll();
    } catch (err) {
      if (alive.current) {
        notify(errorText(err, '사례관리 회의 기록을 삭제하지 못했습니다'), 'error');
        setToDelete(false);
      }
    } finally {
      if (alive.current) setDeleting(false);
    }
  };

  const print = () => {
    const m = list.meetings.find((x) => x.id === draft.id);
    if (!m) return;
    setPrinted(m);
    setPrintKey((k) => k + 1);
  };

  return (
    <div className={styles.stack}>
      <CaseMeetingIntro />
      <CaseMeetingStatus meetings={statusYears.meetings} profiles={roster.profiles} today={today} loading={statusYears.loading || roster.loading} error={statusYears.error} onRetry={statusYears.reload} />
      <CaseMeetingList
        year={year}
        maxYear={thisYear}
        today={today}
        meetings={list.meetings}
        loading={list.loading}
        error={list.error}
        activeId={draft.id}
        isDisabled={saving}
        onYear={(y) => guard(() => setYear(y))}
        onRetry={list.reload}
        onOpen={(m) => guard(() => show(draftOfMeeting(m)))}
      />
      <CaseMeetingEditor
        draft={draft}
        onChange={(patch) => setDraft(patch)}
        staff={roster.staff}
        profiles={roster.profiles}
        rosterLoading={roster.loading}
        rosterError={roster.error}
        onRosterRetry={() => void roster.reload()}
        elders={elders.elders}
        eldersLoading={elders.isLoading}
        eldersError={elders.error}
        today={today}
        writerName={defaultPersonName()}
        dirty={dirty}
        saving={saving}
        deleting={deleting}
        error={saveError}
        onSave={() => void save()}
        onCancel={() => guard(() => show(emptyMeetingDraft(today)))}
        onDelete={() => setToDelete(true)}
        onPrint={print}
      />
      <CaseMeetingGuide />
      <CaseMeetingPrint meeting={printed} profiles={roster.profiles} printKey={printKey} onReady={() => window.print()} />
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
      <LabConfirm isOpen={toDelete} title="이 회의 기록을 삭제할까요?" description="저장한 사례관리 회의 기록이 지워지고 되돌릴 수 없습니다." actionLabel="삭제" isLoading={deleting} onConfirm={() => void remove()} onClose={() => setToDelete(false)} />
    </div>
  );
}
