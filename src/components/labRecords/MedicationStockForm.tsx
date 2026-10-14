'use client';

/** 약품 대장 한 줄 등록·고치기 — 이름·효능·수량·보관·사용기한·개봉일·폐기일. */
import { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { createMedicineStock, deleteMedicineStock, updateMedicineStock } from '@/lib/lab/labApi';
import type { MedicineStock } from '@/lib/lab/labTypes';
import { ErrorBanner, LabConfirm, LabDateInput, NumField, useNotify } from '@/components/lab/LabUi';
import { errorText } from '@/components/lab/labFormat';
import { draftFromStock, newStockDraft, stockInput, stockProblems } from './MedicationDraft';
import type { StockDraft } from './MedicationDraft';
import { useAlive } from './recordsFormat';
import styles from './labRecords.module.css';

interface Props {
  stock: MedicineStock | null;
  onSaved: () => void;
  onClose: () => void;
}

export default function MedicationStockForm({ stock, onSaved, onClose }: Props) {
  const notify = useNotify();
  const alive = useAlive();
  const [draft, setDraft] = useState<StockDraft>(() => (stock ? draftFromStock(stock) : newStockDraft()));
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const set = <K extends keyof StockDraft>(key: K, value: StockDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const problems = stockProblems(draft);

  const save = async () => {
    if (saving) return;
    setSubmitted(true);
    if (problems.length > 0) return;
    setSaving(true);
    setError(null);
    try {
      const input = stockInput(draft);
      if (stock) await updateMedicineStock(stock.id, input);
      else await createMedicineStock(input);
      notify(stock ? '약품 정보를 고쳤습니다' : '약품을 대장에 올렸습니다', 'success');
      onSaved();
      if (alive.current) onClose();
    } catch (e) {
      if (alive.current) setError(errorText(e, '약품을 저장하지 못했습니다'));
    } finally {
      if (alive.current) setSaving(false);
    }
  };

  const remove = async () => {
    if (!stock || deleting) return;
    setDeleting(true);
    try {
      await deleteMedicineStock(stock.id);
      notify('대장에서 약품을 지웠습니다', 'success');
      onSaved();
      if (alive.current) onClose();
    } catch (e) {
      if (alive.current) {
        setConfirmDelete(false);
        setError(errorText(e, '약품을 지우지 못했습니다'));
      }
    } finally {
      if (alive.current) setDeleting(false);
    }
  };

  return (
    <Card padding={4}>
      <VStack gap={4}>
        <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
          <Text type="large" weight="semibold">
            {stock ? '약품 고치기' : '약품 등록'}
          </Text>
          <Button label="닫기" variant="ghost" isDisabled={saving} onClick={onClose} />
        </HStack>
        <div className={styles.fieldGridWide}>
          <TextInput label="약품 이름" placeholder="예: 타이레놀정" value={draft.name} onChange={(v) => set('name', v.slice(0, 60))} />
          <TextInput label="효능" placeholder="예: 해열진통" value={draft.efficacy} onChange={(v) => set('efficacy', v.slice(0, 100))} />
        </div>
        <div className={styles.fieldGrid}>
          <NumField label="수량" value={draft.quantity} onChange={(v) => set('quantity', v)} max={100000} />
          <TextInput label="단위" placeholder="예: 정" value={draft.unit} onChange={(v) => set('unit', v.slice(0, 10))} />
          <Selector
            label="보관"
            placeholder="고르기"
            options={[
              { value: 'ROOM', label: '실온' },
              { value: 'FRIDGE', label: '냉장' },
            ]}
            value={draft.storage}
            onChange={(v) => v && set('storage', v as StockDraft['storage'])}
          />
        </div>
        <div className={styles.fieldGrid}>
          <LabDateInput label="사용기한" value={draft.expiresOn} onChange={(v) => set('expiresOn', v)} />
          <LabDateInput label="개봉일 (선택)" value={draft.openedOn} onChange={(v) => set('openedOn', v)} />
          <LabDateInput label="폐기일 (선택)" value={draft.disposedOn} onChange={(v) => set('disposedOn', v)} />
        </div>
        {(draft.openedOn !== '' || draft.disposedOn !== '') && (
          <HStack gap={2} wrap="wrap">
            {draft.openedOn !== '' && <Button label="개봉일 비우기" variant="ghost" size="sm" onClick={() => set('openedOn', '')} />}
            {draft.disposedOn !== '' && <Button label="폐기일 비우기" variant="ghost" size="sm" onClick={() => set('disposedOn', '')} />}
          </HStack>
        )}
        <TextInput label="메모 (선택)" placeholder="예: 비상약 상자 2번 칸" value={draft.note} onChange={(v) => set('note', v.slice(0, 200))} />
        {submitted && problems.length > 0 && (
          <div className={styles.errorText}>
            <ul style={{ margin: 0, paddingInlineStart: 'var(--spacing-4)' }}>
              {problems.map((p) => (
                <li key={p}>
                  <Text type="supporting" color="inherit">
                    {p}
                  </Text>
                </li>
              ))}
            </ul>
          </div>
        )}
        {error && <ErrorBanner message={error} />}
        <HStack gap={2} hAlign="between" vAlign="center" wrap="wrap">
          {stock ? <Button label="대장에서 지우기" variant="ghost" isDisabled={saving || deleting} onClick={() => setConfirmDelete(true)} /> : <span />}
          <Button label="저장" variant="primary" isLoading={saving} isDisabled={saving} onClick={() => void save()} />
        </HStack>
      </VStack>
      <LabConfirm
        isOpen={confirmDelete}
        title="대장에서 지울까요?"
        description="다 쓰거나 버린 약은 지우지 말고 폐기일을 적어 두는 편이 기록에 좋습니다. 지우면 되돌릴 수 없습니다."
        actionLabel="지우기"
        isLoading={deleting}
        onConfirm={() => void remove()}
        onClose={() => setConfirmDelete(false)}
      />
    </Card>
  );
}
