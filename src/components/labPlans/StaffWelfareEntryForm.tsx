'use client';

/** 복지 제공 한 건 쓰기·고치기 — 종류에 따라 불인정 경고를 바로 보여 주고, 저장은 두 번 눌러도 한 번만 된다. */
import { useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Chip, ErrorBanner, LabConfirm, LabDateInput, NumField, SupportText, useNotify } from '@/components/lab/LabUi';
import { errorText } from '@/components/lab/labFormat';
import { useAlive } from '@/components/labRecords/recordsFormat';
import { createStaffWelfare, deleteStaffWelfare, updateStaffWelfare } from '@/lib/lab/labApi';
import { welfareEntryOk } from '@/lib/lab/welfareRules';
import type { LabStaff, StaffWelfare, WelfareKind } from '@/lib/lab/labTypes';
import { emptyEntry, entryBlockers, entryInput, entryToDraft } from './StaffWelfareDraft';
import type { EntryDraft } from './StaffWelfareDraft';
import StaffWelfareEvidence from './StaffWelfareEvidence';
import { KIND_OPTIONS, MAX_ITEM, MAX_NOTE, MAX_WELFARE_AMOUNT, kindInfo, welfareReasons } from './StaffWelfareFormat';
import styles from './StaffWelfare.module.css';
import plans from './labPlans.module.css';

interface Props {
  editing: StaffWelfare | null;
  staff: LabStaff[];
  staffLoading: boolean;
  staffError: string | null;
  year: number;
  today: string;
  onChanged: () => Promise<void>;
  onClear: () => void;
}

export default function StaffWelfareEntryForm({ editing, staff, staffLoading, staffError, year, today, onChanged, onClear }: Props) {
  const alive = useAlive();
  const notify = useNotify();
  const busy = useRef(false);
  const [draft, setDraft] = useState<EntryDraft>(() => (editing ? entryToDraft(editing) : emptyEntry()));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toDelete, setToDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (p: Partial<EntryDraft>) => setDraft((d) => ({ ...d, ...p }));
  const info = kindInfo(draft.kind);
  const blockers = entryBlockers(draft, today);
  const asEntry = { givenOn: draft.givenOn, kind: draft.kind as WelfareKind, signed: draft.signed, recipientIsOwner: draft.recipientIsOwner, evidenceLedgerId: draft.evidenceLedgerId, evidenceNote: draft.evidenceNote };
  const counted = welfareEntryOk(asEntry);
  const reasons = welfareReasons(asEntry);
  const evidenceYear = Number(draft.givenOn.slice(0, 4)) || year;
  const disabled = saving || deleting;
  const staffOptions = staff.map((s) => ({ value: String(s.id), label: s.position ? `${s.name} (${s.position})` : s.name }));
  if (draft.memberId !== '' && !staffOptions.some((o) => o.value === draft.memberId) && editing) staffOptions.unshift({ value: draft.memberId, label: editing.memberName });

  const save = async () => {
    if (busy.current || blockers.length > 0) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      const input = entryInput(draft);
      if (draft.id === null) await createStaffWelfare(input);
      else await updateStaffWelfare(draft.id, input);
      if (!alive.current) return;
      notify(draft.id === null ? '복지 제공 기록을 저장했습니다' : '복지 제공 기록을 고쳤습니다', 'success');
      await onChanged();
      if (alive.current) {
        setDraft(emptyEntry());
        onClear();
      }
    } catch (err) {
      if (alive.current) setError(errorText(err, '직원 복지 제공 기록을 저장하지 못했습니다'));
    } finally {
      busy.current = false;
      if (alive.current) setSaving(false);
    }
  };

  const remove = async () => {
    if (draft.id === null || deleting) return;
    setDeleting(true);
    try {
      await deleteStaffWelfare(draft.id);
      if (!alive.current) return;
      notify('복지 제공 기록을 지웠습니다', 'success');
      setToDelete(false);
      await onChanged();
      if (alive.current) onClear();
    } catch (err) {
      if (alive.current) {
        notify(errorText(err, '복지 제공 기록을 지우지 못했습니다'), 'error');
        setToDelete(false);
      }
    } finally {
      if (alive.current) setDeleting(false);
    }
  };

  return (
    <Card padding={4}>
      <VStack gap={3}>
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Text type="label">{draft.id === null ? '복지 제공 기록하기' : '복지 제공 기록 고치기'}</Text>
          {draft.kind !== '' && <Chip tone={counted ? 'ok' : 'warn'} label={counted ? '분기 1회로 셉니다' : '아직 세어지지 않습니다'} />}
        </HStack>
        <div className={plans.fieldGrid}>
          <LabDateInput label="제공일" value={draft.givenOn} max={today} onChange={(v) => set({ givenOn: v })} />
          <Selector label="직원" placeholder="받은 직원 고르기" hasSearch searchPlaceholder="찾기" options={staffOptions} value={draft.memberId === '' ? undefined : draft.memberId} onChange={(v) => set({ memberId: v })} isDisabled={disabled || staffLoading} />
          <Selector label="종류" placeholder="종류 고르기" options={KIND_OPTIONS} value={draft.kind === '' ? undefined : draft.kind} onChange={(v) => set({ kind: v })} isDisabled={disabled} />
          <NumField label="금액 (원)" value={draft.amount} onChange={(v) => set({ amount: v })} max={MAX_WELFARE_AMOUNT} placeholder="예: 50,000" isDisabled={disabled} />
        </div>
        {staffError && <ErrorBanner message={staffError} />}
        {info && !info.recognized && (
          <div className={styles.warnBox} role="alert">
            <Text type="label">{info.label}은(는) 복지로 인정되지 않습니다</Text>
            <Text type="supporting">이 기록은 분기 제공으로 세어지지 않습니다. 인정되는 종류(현물·교육비·포상금 등)가 따로 있는지 확인해 주세요.</Text>
          </div>
        )}
        {info?.check && <SupportText tone="warn">‘기타’는 인정 여부를 평가 원문과 대조해야 합니다. 되도록 가까운 종류를 골라 주세요.</SupportText>}
        <TextInput label="내용 (포상품)" placeholder="예: 문화상품권 5만 원권, 독감 예방접종비" value={draft.item} onChange={(v) => set({ item: v.slice(0, MAX_ITEM) })} isDisabled={disabled} />
        <HStack gap={4} wrap="wrap">
          <CheckboxInput label="수령인 서명 받음" value={draft.signed} onChange={(v) => set({ signed: v })} isDisabled={disabled} />
          <CheckboxInput label="대표자 본인에게 준 것" value={draft.recipientIsOwner} onChange={(v) => set({ recipientIsOwner: v })} isDisabled={disabled} />
        </HStack>
        {draft.recipientIsOwner && <SupportText tone="warn">대표자 본인에게 준 복지는 세지 않습니다.</SupportText>}
        <div className={plans.fieldGrid}>
          <StaffWelfareEvidence year={evidenceYear} direction="EXPENSE" value={draft.evidenceLedgerId} onChange={(id) => set({ evidenceLedgerId: id })} isDisabled={disabled} />
          <TextInput label="증빙 보관 위치 (선택)" placeholder="예: 사무실 서류함 2번, 10월 영수증 철" value={draft.evidenceNote} onChange={(v) => set({ evidenceNote: v.slice(0, MAX_NOTE) })} isDisabled={disabled} />
        </div>
        <SupportText>장부 기록을 고르거나 보관 위치를 적어야 증빙이 있는 것으로 칩니다. 현금 지급은 서명부만으로는 부족합니다.</SupportText>
        <TextInput label="메모 (선택)" placeholder="예: 3분기 우수 직원 포상" value={draft.note} onChange={(v) => set({ note: v.slice(0, MAX_NOTE) })} isDisabled={disabled} />
        {draft.kind !== '' && reasons.length > 0 && (
          <VStack gap={1}>
            {reasons.map((r) => (
              <SupportText key={r} tone="warn">{r}</SupportText>
            ))}
          </VStack>
        )}
        {blockers.length > 0 && (
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
          {(draft.id !== null || draft.kind !== '' || draft.item !== '') && <Button label={draft.id === null ? '비우기' : '고치기 취소'} variant="ghost" isDisabled={disabled} onClick={() => { setDraft(emptyEntry()); setError(null); onClear(); }} />}
          <Button label={draft.id === null ? '제공 기록 저장' : '고친 내용 저장'} variant="primary" isLoading={saving} isDisabled={disabled || blockers.length > 0} onClick={() => void save()} />
        </HStack>
      </VStack>
      <LabConfirm isOpen={toDelete} title="이 복지 제공 기록을 삭제할까요?" description="제공대장에서 지워지고 되돌릴 수 없습니다." actionLabel="삭제" isLoading={deleting} onConfirm={() => void remove()} onClose={() => setToDelete(false)} />
    </Card>
  );
}
