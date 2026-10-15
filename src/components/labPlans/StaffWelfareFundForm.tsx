'use client';

/** 가산금 받음·사용 한 건 쓰기·고치기 — 저장은 두 번 눌러도 한 번만 된다. */
import { useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { ErrorBanner, LabConfirm, LabDateInput, NumField, SupportText, useNotify } from '@/components/lab/LabUi';
import { errorText } from '@/components/lab/labFormat';
import { useAlive } from '@/components/labRecords/recordsFormat';
import { createBonusFund, deleteBonusFund, updateBonusFund } from '@/lib/lab/labApi';
import type { BonusFund, BonusFundKind, LabStaff } from '@/lib/lab/labTypes';
import { emptyFund, fundBlockers, fundInput, fundToDraft } from './StaffWelfareDraft';
import type { FundDraft } from './StaffWelfareDraft';
import StaffWelfareEvidence from './StaffWelfareEvidence';
import { MAX_FUND_AMOUNT, MAX_ITEM, MAX_NOTE } from './StaffWelfareFormat';
import plans from './labPlans.module.css';

const KIND_OPTIONS: Array<{ value: BonusFundKind; label: string }> = [
  { value: 'RECEIVED', label: '받음' },
  { value: 'SPENT', label: '사용' },
];

interface Props {
  editing: BonusFund | null;
  staff: LabStaff[];
  staffLoading: boolean;
  year: number;
  today: string;
  onChanged: () => Promise<void>;
  onClear: () => void;
}

export default function StaffWelfareFundForm({ editing, staff, staffLoading, year, today, onChanged, onClear }: Props) {
  const alive = useAlive();
  const notify = useNotify();
  const busy = useRef(false);
  const [draft, setDraft] = useState<FundDraft>(() => (editing ? fundToDraft(editing) : emptyFund()));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toDelete, setToDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (p: Partial<FundDraft>) => setDraft((d) => ({ ...d, ...p }));
  const spent = draft.kind === 'SPENT';
  const blockers = fundBlockers(draft, today);
  const disabled = saving || deleting;
  const evidenceYear = Number(draft.occurredOn.slice(0, 4)) || year;
  const staffOptions = staff.map((s) => ({ value: String(s.id), label: s.position ? `${s.name} (${s.position})` : s.name }));
  if (draft.memberId !== '' && !staffOptions.some((o) => o.value === draft.memberId) && editing?.memberName) staffOptions.unshift({ value: draft.memberId, label: editing.memberName });

  const reset = () => {
    setDraft(emptyFund());
    setError(null);
    onClear();
  };

  const save = async () => {
    if (busy.current || blockers.length > 0) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      const input = fundInput(draft);
      if (draft.id === null) await createBonusFund(input);
      else await updateBonusFund(draft.id, input);
      if (!alive.current) return;
      notify(draft.id === null ? '가산금 기록을 저장했습니다' : '가산금 기록을 고쳤습니다', 'success');
      await onChanged();
      if (alive.current) reset();
    } catch (err) {
      if (alive.current) setError(errorText(err, '가산금 기록을 저장하지 못했습니다'));
    } finally {
      busy.current = false;
      if (alive.current) setSaving(false);
    }
  };

  const remove = async () => {
    if (draft.id === null || deleting) return;
    setDeleting(true);
    try {
      await deleteBonusFund(draft.id);
      if (!alive.current) return;
      notify('가산금 기록을 지웠습니다', 'success');
      setToDelete(false);
      await onChanged();
      if (alive.current) onClear();
    } catch (err) {
      if (alive.current) {
        notify(errorText(err, '가산금 기록을 지우지 못했습니다'), 'error');
        setToDelete(false);
      }
    } finally {
      if (alive.current) setDeleting(false);
    }
  };

  return (
    <Card padding={4}>
      <VStack gap={3}>
        <Text type="label">{draft.id === null ? '가산금 기록하기' : '가산금 기록 고치기'}</Text>
        <div className={plans.fieldGrid}>
          <Selector label="받음 / 사용" placeholder="받음·사용 고르기" options={KIND_OPTIONS} value={draft.kind} onChange={(v) => set({ kind: v as BonusFundKind, ...(v === 'RECEIVED' ? { memberId: '', ownerUse: false, evidenceLedgerId: null } : { evidenceLedgerId: null }) })} isDisabled={disabled || draft.id !== null} />
          <LabDateInput label={spent ? '사용한 날' : '받은 날'} value={draft.occurredOn} max={today} onChange={(v) => set({ occurredOn: v })} />
          <NumField label="금액 (원)" value={draft.amount} onChange={(v) => set({ amount: v })} max={MAX_FUND_AMOUNT} placeholder="예: 3,000,000" isDisabled={disabled} />
          {spent && <Selector label="대상 직원 (선택)" placeholder="비우면 여러 직원" hasSearch searchPlaceholder="찾기" hasClear options={staffOptions} value={draft.memberId === '' ? null : draft.memberId} onChange={(v) => set({ memberId: v ?? '' })} isDisabled={disabled || staffLoading} />}
        </div>
        <TextInput label={spent ? '용도' : '출처 (평가 연도 등)'} placeholder={spent ? '예: 직원 처우개선 수당 지급' : '예: 2025년 정기평가 우수 가산금'} value={draft.purpose} onChange={(v) => set({ purpose: v.slice(0, MAX_ITEM) })} isDisabled={disabled} />
        {spent && <SupportText>기관 내부 환경 개선(도배, 에어컨 설치 등)은 인정되지 않습니다. 직원 처우개선에 쓴 것만 적어 주세요.</SupportText>}
        {spent && <CheckboxInput label="대표자·시설장에게 쓴 금액" value={draft.ownerUse} onChange={(v) => set({ ownerUse: v })} isDisabled={disabled} />}
        {spent && draft.ownerUse && <SupportText tone="warn">대표자 겸 시설장·직원에게 쓴 금액은 사용 비율에서 뺍니다.</SupportText>}
        <StaffWelfareEvidence year={evidenceYear} direction={spent ? 'EXPENSE' : 'INCOME'} value={draft.evidenceLedgerId} onChange={(id) => set({ evidenceLedgerId: id })} isDisabled={disabled} />
        <TextInput label="메모 (선택)" placeholder="예: 영수증은 서류함 3번 칸" value={draft.note} onChange={(v) => set({ note: v.slice(0, MAX_NOTE) })} isDisabled={disabled} />
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
          {(draft.id !== null || draft.purpose !== '') && <Button label={draft.id === null ? '비우기' : '고치기 취소'} variant="ghost" isDisabled={disabled} onClick={reset} />}
          <Button label={draft.id === null ? '가산금 기록 저장' : '고친 내용 저장'} variant="primary" isLoading={saving} isDisabled={disabled || blockers.length > 0} onClick={() => void save()} />
        </HStack>
      </VStack>
      <LabConfirm isOpen={toDelete} title="이 가산금 기록을 삭제할까요?" description="목록에서 지워지고 되돌릴 수 없습니다." actionLabel="삭제" isLoading={deleting} onConfirm={() => void remove()} onClose={() => setToDelete(false)} />
    </Card>
  );
}
