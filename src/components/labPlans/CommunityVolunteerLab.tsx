'use client';

/**
 * 봉사 일지 — 달을 고르고 봉사 활동을 적는다. 그 해 일지를 한 번에 받아(listVolunteerLogs year) 월 목록과 연간 요약을 같은 자료로 낸다.
 * 봉사자별 활동 확인서(A4)를 인쇄할 수 있다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '@astryxdesign/core/Card';
import { VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import { ErrorBanner, LabConfirm, MonthStepper, SupportText, useNotify } from '@/components/lab/LabUi';
import { currentMonth, defaultPersonName, errorText, monthLabel, todayString } from '@/components/lab/labFormat';
import { dedupeById, useAlive } from '@/components/labRecords/recordsFormat';
import { volunteerSummary } from '@/lib/lab/communityRules';
import { createVolunteerLog, deleteVolunteerLog, listVolunteerLogs, updateVolunteerLog } from '@/lib/lab/labApi';
import type { VolunteerLog } from '@/lib/lab/labTypes';
import { draftOfVolunteer, emptyVolunteerDraft, inputOfVolunteerDraft, volunteerIssues } from './CommunityVolunteerDraft';
import type { VolunteerDraft } from './CommunityVolunteerDraft';
import CommunityVolunteerCertificate from './CommunityVolunteerCertificate';
import CommunityVolunteerForm from './CommunityVolunteerForm';
import CommunityVolunteerList from './CommunityVolunteerList';
import CommunityVolunteerSummary from './CommunityVolunteerSummary';
import styles from './labPlans.module.css';

/** 오늘이 이 달이면 오늘, 아니면 그 달 1일 */
function defaultDate(month: string): string {
  const today = todayString();
  return today.startsWith(`${month}-`) ? today : `${month}-01`;
}

export default function CommunityVolunteerLab() {
  const alive = useAlive();
  const notify = useNotify();
  const today = todayString();
  const [month, setMonth] = useState(currentMonth());
  const year = Number(month.slice(0, 4));
  const [logs, setLogs] = useState<VolunteerLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<VolunteerDraft>(() => emptyVolunteerDraft(defaultDate(currentMonth()), defaultPersonName()));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<VolunteerLog | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [certName, setCertName] = useState('');
  const [printKey, setPrintKey] = useState(0);
  const seq = useRef(0);
  const savingRef = useRef(false);

  const load = useCallback(async () => {
    const n = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const list = await listVolunteerLogs({ year });
      if (!alive.current || n !== seq.current) return; // 늦게 온 응답은 버린다
      setLogs(dedupeById(list));
    } catch (err) {
      if (!alive.current || n !== seq.current) return;
      setLogs([]);
      setError(errorText(err, '봉사자 일지를 불러오지 못했습니다'));
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

  const changeMonth = (m: string) => {
    setMonth(m);
    // 새로 적는 중이면 날짜를 그 달로 옮긴다
    setDraft((d) => (d.id === null ? { ...d, date: defaultDate(m) } : d));
  };

  const monthLogs = useMemo(
    () => logs.filter((l) => l.activityDate.startsWith(`${month}-`)).sort((a, b) => (a.activityDate < b.activityDate ? 1 : a.activityDate > b.activityDate ? -1 : b.id - a.id)),
    [logs, month],
  );
  const summary = useMemo(() => volunteerSummary(logs, year, today), [logs, year, today]);

  /** 저장·VMS 표시로 돌아온 한 건을 목록에 반영한다. 다른 해로 옮겨 갔으면 이 해 목록에서는 뺀다. */
  const applySaved = (saved: VolunteerLog) =>
    setLogs((cur) => {
      const rest = cur.filter((x) => x.id !== saved.id);
      return saved.activityDate.startsWith(`${year}-`) ? [...rest, saved] : rest;
    });

  const save = async () => {
    if (savingRef.current) return;
    const issues = volunteerIssues(draft, today);
    if (issues.length > 0) {
      setSaveError(issues[0]);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const input = inputOfVolunteerDraft(draft);
      const saved = draft.id === null ? await createVolunteerLog(input) : await updateVolunteerLog(draft.id, input);
      if (!alive.current) return;
      applySaved(saved);
      notify(draft.id === null ? '봉사 일지를 기록했습니다' : '봉사 일지를 고쳤습니다', 'success');
      // 다음 봉사자를 이어서 적도록 날짜·시간·확인자는 남기고 이름·내용만 비운다
      setDraft({ ...emptyVolunteerDraft(draft.date, draft.confirmer), start: draft.start, end: draft.end, organization: draft.organization });
    } catch (err) {
      if (alive.current) setSaveError(errorText(err, '봉사 일지를 기록하지 못했습니다'));
    } finally {
      savingRef.current = false;
      if (alive.current) setSaving(false);
    }
  };

  const markVms = async (log: VolunteerLog) => {
    if (busyId !== null) return;
    setBusyId(log.id);
    try {
      const saved = await updateVolunteerLog(log.id, { ...inputOfVolunteerDraft(draftOfVolunteer(log)), vmsRegistered: true });
      if (!alive.current) return;
      applySaved(saved);
      notify('VMS 등록으로 표시했습니다', 'success');
    } catch (err) {
      if (alive.current) notify(errorText(err, 'VMS 등록 표시를 하지 못했습니다'), 'error');
    } finally {
      if (alive.current) setBusyId(null);
    }
  };

  const remove = async () => {
    if (!toDelete || deleting) return;
    setDeleting(true);
    try {
      await deleteVolunteerLog(toDelete.id);
      if (!alive.current) return;
      const id = toDelete.id;
      setLogs((cur) => cur.filter((x) => x.id !== id));
      setDraft((d) => (d.id === id ? emptyVolunteerDraft(d.date, d.confirmer) : d));
      notify('봉사 일지를 삭제했습니다', 'success');
      setToDelete(null);
    } catch (err) {
      if (alive.current) {
        notify(errorText(err, '봉사 일지를 삭제하지 못했습니다'), 'error');
        setToDelete(null);
      }
    } finally {
      if (alive.current) setDeleting(false);
    }
  };

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <MonthStepper value={month} onChange={changeMonth} isDisabled={saving} />
      </div>

      <CommunityVolunteerForm
        draft={draft}
        onChange={setDraft}
        saving={saving}
        error={saveError}
        onSave={() => void save()}
        onCancel={() => {
          setDraft(emptyVolunteerDraft(draft.date, draft.confirmer));
          setSaveError(null);
        }}
      />

      {error && <ErrorBanner message={error} onRetry={() => void load()} />}

      <Card padding={4}>
        <VStack gap={2}>
          <Text type="label">
            {monthLabel(month)} 봉사 일지 ({monthLogs.length}건)
          </Text>
          {loading && logs.length === 0 ? (
            <Loading size="section" label="봉사 일지를 불러오는 중..." />
          ) : (
            <CommunityVolunteerList
              logs={monthLogs}
              today={today}
              isBusy={saving || deleting || busyId !== null}
              onEdit={(l) => {
                setDraft(draftOfVolunteer(l));
                setSaveError(null);
              }}
              onDelete={setToDelete}
              onMarkVms={(l) => void markVms(l)}
            />
          )}
          <SupportText>활동 시간은 시작·끝 시간으로 서버가 다시 계산해 저장합니다. 봉사자의 서명이 있는 활동일지 원본은 따로 3년 이상 보관해 주세요.</SupportText>
        </VStack>
      </Card>

      {!loading || logs.length > 0 ? (
        <CommunityVolunteerSummary
          year={year}
          summary={summary}
          onCertificate={(name) => {
            setCertName(name);
            setPrintKey((k) => k + 1);
          }}
        />
      ) : null}

      <CommunityVolunteerCertificate year={year} volunteerName={certName} logs={logs} printKey={printKey} onReady={() => window.print()} />

      <LabConfirm
        isOpen={toDelete !== null}
        title="이 봉사 일지를 삭제할까요?"
        description={toDelete ? `${toDelete.activityDate} ${toDelete.volunteerName} ${toDelete.startTime}~${toDelete.endTime} — 삭제하면 되돌릴 수 없습니다.` : ''}
        actionLabel="삭제"
        isLoading={deleting}
        onConfirm={() => void remove()}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}
