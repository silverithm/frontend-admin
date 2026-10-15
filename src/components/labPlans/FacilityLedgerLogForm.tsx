'use client';

/** 실시 기록 한 건 쓰기·고치기 — 소방은 보고일, 보험은 만기를 더 받는다. 저장은 두 번 눌러도 한 번만 된다. */
import { useEffect, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { ErrorBanner, LabConfirm, LabDateInput, SupportText, useNotify } from '@/components/lab/LabUi';
import { dotDate, errorText } from '@/components/lab/labFormat';
import { useAlive } from '@/components/labRecords/recordsFormat';
import { createFacilityLog, deleteFacilityLog, updateFacilityLog } from '@/lib/lab/labApi';
import { retainUntil } from '@/lib/lab/facilityLedgerRules';
import type { FacilityDoneBy, FacilityItemCode, FacilityLog, FacilityLogResult } from '@/lib/lab/labTypes';
import { emptyLog, isFireCode, isInsuranceCode, logBlockers, logInput, logToDraft } from './FacilityLedgerDraft';
import type { LogDraft } from './FacilityLedgerDraft';
import { DONE_BY_OPTIONS, MAX_ACTION, MAX_DOC_LOCATION, MAX_VENDOR, RESULT_OPTIONS, fireReportDeadline, fireReportWarning } from './FacilityLedgerFormat';
import plans from './labPlans.module.css';
import styles from './facilityLedger.module.css';

interface Props {
  code: FacilityItemCode;
  editing: FacilityLog | null;
  today: string;
  /** 저장·삭제 뒤 목록과 표를 다시 읽는다 */
  onChanged: () => Promise<void>;
  onClear: () => void;
  onDirtyChange: (dirty: boolean) => void;
}

export default function FacilityLedgerLogForm({ code, editing, today, onChanged, onClear, onDirtyChange }: Props) {
  const alive = useAlive();
  const notify = useNotify();
  const busy = useRef(false);
  const [draft, setDraft] = useState<LogDraft>(() => (editing ? logToDraft(editing) : emptyLog()));
  const initial = useRef(JSON.stringify(draft));
  const dirty = JSON.stringify(draft) !== initial.current;
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toDelete, setToDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (p: Partial<LogDraft>) => setDraft((d) => ({ ...d, ...p }));
  const fire = isFireCode(code);
  const insurance = isInsuranceCode(code);
  const blockers = logBlockers(code, draft, today);
  const retain = draft.doneOn ? retainUntil(code, draft.doneOn) : null;
  const reportWarn = fire ? fireReportWarning(draft.doneOn, draft.reportedOn, today) : null;
  const deadline = fire ? fireReportDeadline(draft.doneOn) : null;
  const disabled = saving || deleting;

  const clear = () => {
    onDirtyChange(false);
    onClear();
  };
  const save = async () => {
    if (busy.current || blockers.length > 0) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      const input = logInput(code, draft);
      if (draft.id === null) await createFacilityLog(input);
      else await updateFacilityLog(draft.id, input);
      if (!alive.current) return;
      notify(draft.id === null ? '실시 기록을 저장했습니다' : '실시 기록을 고쳤습니다', 'success');
      await onChanged();
      if (alive.current) clear();
    } catch (err) {
      if (alive.current) setError(errorText(err, '실시 기록을 저장하지 못했습니다'));
    } finally {
      busy.current = false;
      if (alive.current) setSaving(false);
    }
  };
  const remove = async () => {
    if (draft.id === null || deleting) return;
    setDeleting(true);
    try {
      await deleteFacilityLog(draft.id);
      if (!alive.current) return;
      notify('실시 기록을 지웠습니다', 'success');
      setToDelete(false);
      await onChanged();
      if (alive.current) clear();
    } catch (err) {
      if (alive.current) {
        notify(errorText(err, '실시 기록을 지우지 못했습니다'), 'error');
        setToDelete(false);
      }
    } finally {
      if (alive.current) setDeleting(false);
    }
  };

  return (
    <div className={styles.formBox}>
      <VStack gap={3}>
        <Text type="label">{draft.id === null ? '실시 기록 쓰기' : '실시 기록 고치기'}</Text>
        <div className={plans.fieldGrid}>
          <LabDateInput label="실시일" value={draft.doneOn} max={today} onChange={(v) => set({ doneOn: v })} />
          <Selector label="실시 구분" placeholder="고르기" options={DONE_BY_OPTIONS} value={draft.doneBy} onChange={(v) => v && set({ doneBy: v as FacilityDoneBy })} isDisabled={disabled} />
          <TextInput label="업체명" placeholder="예: 한빛소방안전" value={draft.vendorName} onChange={(v) => set({ vendorName: v.slice(0, MAX_VENDOR) })} isDisabled={disabled} />
          <Selector label="결과" placeholder="고르기" options={RESULT_OPTIONS} value={draft.result} onChange={(v) => v && set({ result: v as FacilityLogResult })} isDisabled={disabled} />
          {fire && <LabDateInput label="소방 결과 보고일" value={draft.reportedOn} max={today} onChange={(v) => set({ reportedOn: v })} />}
          {insurance && <LabDateInput label="보험 만기일 (필수)" value={draft.validUntil} onChange={(v) => set({ validUntil: v })} />}
        </div>
        <TextInput label="조치 내용" placeholder={draft.result === 'PASS' ? '예: 지적 사항 없음' : '예: 소화기 2대 교체, 유도등 배터리 교체 후 재확인'} value={draft.actionNote} onChange={(v) => set({ actionNote: v.slice(0, MAX_ACTION) })} isDisabled={disabled} />
        <TextInput label="결과서 보관 위치" placeholder="예: 사무실 서류함 3번, 2026 안전점검 철" value={draft.docLocation} onChange={(v) => set({ docLocation: v.slice(0, MAX_DOC_LOCATION) })} isDisabled={disabled} />
        {insurance && <SupportText>보험 만기일은 증권에 적힌 마지막 날입니다. 만기가 지나면 ‘기한 지남’으로 표시됩니다.</SupportText>}
        {fire && deadline && <SupportText>소방서 보고 기한은 점검이 끝난 날부터 15일 안({dotDate(deadline)})입니다.</SupportText>}
        {reportWarn && (
          <div className={styles.callout} role="alert" data-tone="danger">
            <Text type="label">{reportWarn}</Text>
          </div>
        )}
        {retain && <SupportText>이 결과서는 {dotDate(retain)}까지 보관해야 합니다.</SupportText>}
        {(draft.result === 'FIX_NEEDED' || draft.result === 'FAIL') && draft.actionNote.trim() === '' && <SupportText tone="warn">조치가 필요하거나 부적합이면 어떻게 고쳤는지 조치 내용에 남겨 두세요.</SupportText>}
        {(dirty || editing !== null) && blockers.length > 0 && (
          <VStack gap={1}>
            <Text type="label">저장하기 전에 확인해 주세요</Text>
            {blockers.map((m) => (
              <SupportText key={m} tone="warn">{m}</SupportText>
            ))}
          </VStack>
        )}
        {error && <ErrorBanner message={error} />}
        <HStack gap={2} hAlign="end" wrap="wrap">
          {draft.id !== null && <Button label="이 기록 삭제" variant="ghost" isLoading={deleting} isDisabled={disabled} onClick={() => setToDelete(true)} />}
          {(draft.id !== null || dirty) && <Button label={draft.id === null ? '비우기' : '고치기 취소'} variant="ghost" isDisabled={disabled} onClick={() => { setDraft(emptyLog()); setError(null); clear(); }} />}
          <Button label={draft.id === null ? '실시 기록 저장' : '고친 내용 저장'} variant="primary" isLoading={saving} isDisabled={disabled || blockers.length > 0} onClick={() => void save()} />
        </HStack>
      </VStack>
      <LabConfirm isOpen={toDelete} title="이 실시 기록을 삭제할까요?" description="대장에서 지워지고 다음 기한이 다시 계산됩니다. 되돌릴 수 없습니다." actionLabel="삭제" isLoading={deleting} onConfirm={() => void remove()} onClose={() => setToDelete(false)} />
    </div>
  );
}
