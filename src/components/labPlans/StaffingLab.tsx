'use client';

/**
 * 인력배치 점검 — 달이 끝난 뒤(기본은 지난달) 그 달의 입소자 수·공휴일·직원별 근무시간으로
 * 직종별 배치 기준 충족 여부, 결원, 감산 위험, 가산 안내를 점검한다. 저장한 달은 불러오고, 없으면 새로 적는다.
 * 저장하지 않은 변경이 있으면 달을 바꾸기 전에 묻는다. A4 인쇄.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Loading } from '@/components/Loading';
import { Chip, ErrorBanner, LabConfirm, MonthStepper, SupportText, useNotify } from '@/components/lab/LabUi';
import { PROVIDER_KEY, defaultPersonName, errorText, monthLabel, shiftMonth, todayString, writeStored } from '@/components/lab/labFormat';
import { useAlive } from '@/components/labRecords/recordsFormat';
import { deleteStaffingMonth, saveStaffingMonth } from '@/lib/lab/labApi';
import type { StaffingMonth } from '@/lib/lab/labTypes';
import { monthlyUsers, staffingCheck, standardMonthlyHours } from '@/lib/lab/staffingRules';
import { checkOfRecord } from './StaffingCheckOf';
import { useMonthRecords, useStaffingYear } from './StaffingData';
import { MAX_NOTE, MAX_STAFF_NAME, draftOfStaffing, emptyStaffingDraft, fingerprintOfStaffing, hoursOf, inputOfStaffing, staffingBlockers, totalSum } from './StaffingDraft';
import type { StaffingDraft } from './StaffingDraft';
import StaffingHolidays from './StaffingHolidays';
import StaffingMonthList from './StaffingMonthList';
import { StaffingIntro, StaffingVerify } from './StaffingNotes';
import StaffingPrint from './StaffingPrint';
import StaffingResult from './StaffingResult';
import StaffingStaffTable from './StaffingStaffTable';
import StaffingUsersCard from './StaffingUsersCard';
import styles from './labPlans.module.css';

export default function StaffingLab() {
  const alive = useAlive();
  const notify = useNotify();
  const today = todayString();
  const thisYear = Number(today.slice(0, 4));
  const [month, setMonth] = useState(() => shiftMonth(today.slice(0, 7), -1));
  const [draft, setDraft] = useState<StaffingDraft | null>(null);
  const [baseline, setBaseline] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [printKey, setPrintKey] = useState(0);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [toDelete, setToDelete] = useState<StaffingMonth | null>(null);
  const [deleting, setDeleting] = useState(false);
  const busy = useRef(false);

  const records = useMonthRecords(month);
  const year = useStaffingYear(thisYear);

  // 달을 열 때마다 저장된 기록이 있으면 그것으로, 없으면 새 초안으로 시작한다
  useEffect(() => {
    if (!records.data) return;
    const d = records.data.saved ? draftOfStaffing(records.data.saved) : emptyStaffingDraft(month, defaultPersonName());
    setDraft(d);
    setBaseline(fingerprintOfStaffing(d));
    setSaveError(null);
    // records.data가 바뀔 때(달을 새로 읽었을 때)만 초안을 다시 만든다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records.data]);

  const dirty = draft !== null && fingerprintOfStaffing(draft) !== baseline;
  const set = (p: Partial<StaffingDraft>) => setDraft((d) => (d ? { ...d, ...p } : d));

  const users = draft ? monthlyUsers(totalSum(draft), draft.serviceDays ?? 0) : 0;
  const standardHours = draft ? standardMonthlyHours(draft.month, draft.holidays) : 0;
  const previousViolated = records.data?.previous ? checkOfRecord(records.data.previous).check.violated : null;
  const check = useMemo(
    () => staffingCheck({ users, staff: (draft?.staff ?? []).map((s) => ({ jobType: s.jobType, hours: hoursOf(s) ?? 0 })), standardHours, previousViolated: previousViolated === true }),
    [users, draft?.staff, standardHours, previousViolated],
  );

  const guard = (action: () => void) => {
    if (dirty) setPending(() => action);
    else action();
  };
  const changeMonth = (m: string) => guard(() => setMonth(m));

  const save = async () => {
    if (busy.current || !draft) return;
    const blockers = staffingBlockers(draft);
    if (blockers.length > 0) {
      setSaveError(blockers[0]);
      return;
    }
    busy.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await saveStaffingMonth(inputOfStaffing(draft));
      if (!alive.current) return;
      if (draft.writerName.trim() !== '') writeStored(PROVIDER_KEY, draft.writerName.trim());
      const next = draftOfStaffing(saved);
      setDraft(next);
      setBaseline(fingerprintOfStaffing(next));
      notify(`${monthLabel(saved.staffingMonth)} 인력배치 점검을 저장했습니다`, 'success');
      void year.reload();
    } catch (err) {
      if (alive.current) setSaveError(errorText(err, '인력배치 점검을 저장하지 못했습니다'));
    } finally {
      busy.current = false;
      if (alive.current) setSaving(false);
    }
  };

  const remove = async () => {
    if (!toDelete || deleting) return;
    const target = toDelete;
    setDeleting(true);
    try {
      await deleteStaffingMonth(target.id);
      if (!alive.current) return;
      notify(`${monthLabel(target.staffingMonth)} 기록을 삭제했습니다`, 'success');
      setToDelete(null);
      void year.reload();
      if (target.staffingMonth === month) void records.reload();
    } catch (err) {
      if (alive.current) {
        notify(errorText(err, '기록을 삭제하지 못했습니다'), 'error');
        setToDelete(null);
      }
    } finally {
      if (alive.current) setDeleting(false);
    }
  };

  const blockers = draft ? staffingBlockers(draft) : [];
  // 다른 달의 초안이 남아 있는 동안이나 읽기에 실패했을 때는 입력 칸을 보이지 않는다(엉뚱한 달에 저장하지 않게)
  const ready = draft !== null && draft.month === month && !records.loading && !records.error;
  const loading = !ready && !records.error;
  const isSaved = records.data?.saved != null;

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <MonthStepper value={month} onChange={changeMonth} isDisabled={saving} />
        {ready && (isSaved ? <Chip tone="info" label="저장한 기록" /> : <Chip tone="neutral" label="새로 적는 달" />)}
        {dirty && <Chip tone="warn" label="저장하지 않은 변경" />}
        <span className={styles.spacer} />
        <Button label="A4 인쇄" variant="secondary" isDisabled={!ready || users === 0} onClick={() => setPrintKey((k) => k + 1)} />
      </div>

      <StaffingIntro />

      {records.error && <ErrorBanner message={records.error} onRetry={() => void records.reload()} />}
      {records.data?.previousFailed && <SupportText tone="warn">지난달 기록을 읽지 못했습니다. 연속 위반 배수가 빠진 채 계산됩니다. 달을 다시 열어 보세요.</SupportText>}

      {loading ? (
        <Loading size="section" label={`${monthLabel(month)} 인력배치 점검을 불러오는 중...`} />
      ) : ready && draft ? (
        <>
          <StaffingUsersCard draft={draft} onChange={set} disabled={saving} />
          <StaffingHolidays month={draft.month} holidays={draft.holidays} onChange={(holidays) => set({ holidays })} disabled={saving} />
          <StaffingStaffTable staff={draft.staff} standardHours={standardHours} onChange={(staff) => set({ staff })} disabled={saving} />
          <StaffingResult check={check} users={users} previousViolated={previousViolated} previousFailed={records.data?.previousFailed ?? false} hasStaff={draft.staff.length > 0} />
          <Card padding={4}>
            <VStack gap={3}>
              <div className={styles.fieldGrid}>
                <TextInput label="작성자" value={draft.writerName} onChange={(v) => set({ writerName: v.slice(0, MAX_STAFF_NAME) })} placeholder="점검한 직원 이름" isDisabled={saving} />
              </div>
              <TextArea label="메모 (선택)" value={draft.note} onChange={(v) => set({ note: v.slice(0, MAX_NOTE) })} placeholder="예: 요양보호사 1명 5일 결근, 대체 인력 없음" rows={3} maxLength={MAX_NOTE} isDisabled={saving} />
              {blockers.length > 0 && (
                <VStack gap={1}>
                  <Text type="label">저장하기 전에 확인해 주세요</Text>
                  {blockers.map((m) => (
                    <SupportText key={m} tone="warn">
                      {m}
                    </SupportText>
                  ))}
                </VStack>
              )}
              {saveError && <ErrorBanner message={saveError} />}
              <HStack gap={2} hAlign="end" wrap="wrap">
                <Button label={isSaved ? '고친 내용 저장' : `${monthLabel(month)} 점검 저장`} variant="primary" isLoading={saving} isDisabled={saving || blockers.length > 0 || (isSaved && !dirty)} onClick={() => void save()} />
              </HStack>
            </VStack>
          </Card>
        </>
      ) : null}

      <StaffingMonthList
        year={thisYear}
        rows={year.rows}
        loading={year.loading}
        error={year.error}
        activeMonth={month}
        busy={saving || deleting}
        onRetry={() => void year.reload()}
        onOpen={(m) => m !== month && guard(() => setMonth(m))}
        onDelete={setToDelete}
      />
      <StaffingVerify />

      {ready && draft && <StaffingPrint draft={draft} users={users} standardHours={standardHours} check={check} printKey={printKey} onReady={() => window.print()} />}

      <LabConfirm
        isOpen={pending !== null}
        title="저장하지 않은 변경이 있습니다"
        description="저장하지 않고 다른 달을 열면 지금 적은 내용이 사라집니다."
        actionLabel="버리고 이동"
        onConfirm={() => {
          pending?.();
          setPending(null);
        }}
        onClose={() => setPending(null)}
      />
      <LabConfirm
        isOpen={toDelete !== null}
        title={toDelete ? `${monthLabel(toDelete.staffingMonth)} 기록을 삭제할까요?` : ''}
        description="저장한 인력배치 점검이 지워지고 되돌릴 수 없습니다. 다음 달 점검의 연속 위반 계산에도 쓰이지 않게 됩니다."
        actionLabel="삭제"
        isLoading={deleting}
        onConfirm={() => void remove()}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}
