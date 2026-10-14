'use client';

/**
 * 입소 상담·대기 — 이용 문의를 기록하고 상태(새 문의·상담함·대기·계약 완료·이용 불가·문의 철회)를 관리한다.
 * 위쪽에 확인할 것(연락 예정 지남·동의 없는 연락처·거절 사유 없음·오래된 새 문의), 목록(대기 순번), 편집기, 올해 통계.
 * 저장하지 않은 변경이 있으면 다른 상담을 열기 전에 묻는다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Selector } from '@astryxdesign/core/Selector';
import { Loading } from '@/components/Loading';
import { ErrorBanner, LabConfirm, useNotify } from '@/components/lab/LabUi';
import { defaultPersonName, errorText, todayString } from '@/components/lab/labFormat';
import { useLabElders } from '@/components/lab/useLabElders';
import { YearStepper } from '@/components/labRecords/RecordsUi';
import { dedupeById, useAlive } from '@/components/labRecords/recordsFormat';
import { INTAKE_STATUSES, inquiryAlerts, intakeStats, waitlist } from '@/lib/lab/intakeRules';
import { createIntake, deleteIntake, listIntake, updateIntake } from '@/lib/lab/labApi';
import type { IntakeInquiry, IntakeStatus } from '@/lib/lab/labTypes';
import { draftOfIntake, emptyIntakeDraft, fingerprint, inputOfIntake, intakeBlockers } from './IntakeDraft';
import type { IntakeDraft } from './IntakeDraft';
import IntakeAlerts from './IntakeAlerts';
import IntakeEditor from './IntakeEditor';
import IntakeList from './IntakeList';
import IntakeStatsCard from './IntakeStatsCard';
import styles from './labPlans.module.css';

type Filter = 'ALL' | IntakeStatus;

export default function IntakeLab() {
  const alive = useAlive();
  const notify = useNotify();
  const today = todayString();
  const thisYear = Number(today.slice(0, 4));
  const { elders, isLoading: eldersLoading, error: eldersError } = useLabElders();
  const [rows, setRows] = useState<IntakeInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [year, setYear] = useState(thisYear);
  const [initial] = useState(() => emptyIntakeDraft(today, defaultPersonName()));
  const [draft, setDraft] = useState<IntakeDraft>(initial);
  const [baseline, setBaseline] = useState(() => fingerprint(initial));
  const [formKey, setFormKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toDelete, setToDelete] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const seq = useRef(0);
  const busy = useRef(false);
  const editorRef = useRef<HTMLDivElement>(null);

  const dirty = fingerprint(draft) !== baseline;

  const show = useCallback((d: IntakeDraft) => {
    setDraft(d);
    setBaseline(fingerprint(d));
    setSaveError(null);
    setFormKey((k) => k + 1);
  }, []);

  const load = useCallback(async () => {
    const n = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const list = await listIntake();
      if (!alive.current || n !== seq.current) return;
      setRows(dedupeById(list));
    } catch (err) {
      if (!alive.current || n !== seq.current) return;
      setError(errorText(err, '입소 상담 기록을 불러오지 못했습니다'));
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

  const guard = (action: () => void) => {
    if (dirty) setPending(() => action);
    else action();
  };

  const openInquiry = (id: number) => {
    const found = rows.find((r) => r.id === id);
    if (!found || id === draft.id) return;
    guard(() => {
      show(draftOfIntake(found));
      editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const startNew = () => guard(() => show(emptyIntakeDraft(todayString(), draft.counselorName || defaultPersonName())));

  const ranks = useMemo(() => new Map(waitlist(rows).map((w) => [w.inquiry.id, w.rank])), [rows]);
  const alerts = useMemo(() => inquiryAlerts(rows, today), [rows, today]);
  const stats = useMemo(() => intakeStats(rows, year), [rows, year]);
  const shown = useMemo(() => {
    const list = filter === 'ALL' ? rows : rows.filter((r) => r.status === filter);
    if (filter === 'WAITING') return [...list].sort((a, b) => (ranks.get(a.id) ?? 0) - (ranks.get(b.id) ?? 0));
    return [...list].sort((a, b) => (a.inquiryDate < b.inquiryDate ? 1 : a.inquiryDate > b.inquiryDate ? -1 : b.id - a.id));
  }, [rows, filter, ranks]);

  const filterOptions = useMemo(
    () => [{ value: 'ALL', label: `전체 (${rows.length})` }, ...INTAKE_STATUSES.map((s) => ({ value: s.value, label: `${s.label} (${rows.filter((r) => r.status === s.value).length})` }))],
    [rows],
  );
  const filterLabel = filter === 'ALL' ? '전체' : INTAKE_STATUSES.find((s) => s.value === filter)?.label ?? '';

  const save = async () => {
    if (busy.current) return;
    const blockers = intakeBlockers(draft);
    if (blockers.length > 0) {
      setSaveError(blockers[0]);
      return;
    }
    busy.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const input = inputOfIntake(draft);
      const saved = draft.id === null ? await createIntake(input) : await updateIntake(draft.id, input);
      if (!alive.current) return;
      setRows((cur) => dedupeById([...cur.filter((r) => r.id !== saved.id), saved]));
      show(draftOfIntake(saved));
      notify(draft.id === null ? '상담을 저장했습니다' : '상담을 고쳤습니다', 'success');
    } catch (err) {
      if (alive.current) setSaveError(errorText(err, '입소 상담을 저장하지 못했습니다'));
    } finally {
      busy.current = false;
      if (alive.current) setSaving(false);
    }
  };

  const remove = async () => {
    if (busy.current || draft.id === null) return;
    busy.current = true;
    setDeleting(true);
    try {
      const id = draft.id;
      await deleteIntake(id);
      if (!alive.current) return;
      setRows((cur) => cur.filter((r) => r.id !== id));
      show(emptyIntakeDraft(todayString(), draft.counselorName || defaultPersonName()));
      notify('상담을 삭제했습니다', 'success');
    } catch (err) {
      if (alive.current) setSaveError(errorText(err, '입소 상담을 삭제하지 못했습니다'));
    } finally {
      busy.current = false;
      if (alive.current) {
        setDeleting(false);
        setToDelete(false);
      }
    }
  };

  const nameOf = (id: number) => rows.find((r) => r.id === id)?.applicantName ?? '상담';
  const linkedName = rows.find((r) => r.id === draft.id)?.elderlyName ?? null;

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <div style={{ minWidth: 200 }}>
          <Selector label="상태 보기" placeholder="고르기" options={filterOptions} value={filter} onChange={(v) => v && setFilter(v as Filter)} />
        </div>
        <span className={styles.spacer} />
        <Button label="새 상담 기록" variant="primary" isDisabled={saving || deleting} onClick={startNew} />
      </div>

      <Banner
        status="info"
        title="입소 문의는 정당한 사유 없이 거절할 수 없습니다"
        description="노인장기요양보험법 제35조: 정당한 사유 없이 급여 제공을 거부할 수 없습니다. 거절(이용 불가)에는 사유와 날짜를 꼭 남기고, 연락처를 받을 때는 개인정보 수집·이용 동의를 먼저 받아 주세요."
      />

      {error && <ErrorBanner message={error} onRetry={() => void load()} />}

      {loading ? (
        <Loading size="section" label="입소 상담을 불러오는 중..." />
      ) : (
        <>
          <IntakeAlerts alerts={alerts} nameOf={nameOf} onOpen={openInquiry} />
          <IntakeList rows={shown} ranks={ranks} activeId={draft.id} filterLabel={filterLabel} onOpen={openInquiry} />
        </>
      )}

      <div ref={editorRef}>
        <IntakeEditor
          key={formKey}
          draft={draft}
          onChange={(patch) => setDraft(patch)}
          elders={elders}
          eldersLoading={eldersLoading}
          eldersError={eldersError}
          linkedName={linkedName}
          today={today}
          saving={saving}
          deleting={deleting}
          dirty={dirty}
          error={saveError}
          onSave={() => void save()}
          onCancel={() => {
            const found = rows.find((r) => r.id === draft.id);
            show(found ? draftOfIntake(found) : emptyIntakeDraft(todayString(), draft.counselorName || defaultPersonName()));
          }}
          onDelete={() => setToDelete(true)}
        />
      </div>

      <div className={styles.toolbar}>
        <YearStepper value={year} onChange={setYear} max={thisYear} />
      </div>
      <IntakeStatsCard stats={stats} year={year} />

      <LabConfirm
        isOpen={toDelete}
        title="이 상담을 삭제할까요?"
        description="삭제하면 되돌릴 수 없습니다. 거절이나 철회는 삭제하지 말고 상태로 남겨 두는 것이 좋습니다."
        actionLabel="삭제"
        isLoading={deleting}
        onConfirm={() => void remove()}
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
