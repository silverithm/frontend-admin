'use client';

/** 후원금 한 건 입력 양식 — 받은 날짜, 후원자, 현금·물품, 금액(물품은 환산액), 지정 용도, 영수증 번호. */
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Switch } from '@astryxdesign/core/Switch';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Chip, ErrorBanner, LabDateInput, SupportText } from '@/components/lab/LabUi';
import type { DonationKind, DonorType } from '@/lib/lab/labTypes';
import { DONOR_TYPE_OPTIONS, MAX_DONATION_AMOUNT, MAX_DONOR_NAME, MAX_GOODS_DESCRIPTION, MAX_PURPOSE, MAX_RECEIPT_NO, donationIssues } from './DonationDraft';
import type { DonationDraft } from './DonationDraft';
import FinanceMoneyField from './FinanceMoneyField';
import styles from './labRecords.module.css';

interface Props {
  draft: DonationDraft;
  onChange: (next: DonationDraft) => void;
  saving: boolean;
  error: string | null;
  onSave: () => void;
  onCancel: () => void;
}

export default function DonationForm({ draft, onChange, saving, error, onSave, onCancel }: Props) {
  const set = (patch: Partial<DonationDraft>) => onChange({ ...draft, ...patch });
  const issues = donationIssues(draft);
  const editing = draft.id !== null;
  const touched = draft.donorName !== '' || draft.amount !== null;

  return (
    <Card padding={4}>
      <VStack gap={3}>
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Text type="label">{editing ? '후원금 고치기' : '후원금 받은 내용 적기'}</Text>
          {editing && <Chip tone="warn" label="수정 중" />}
        </HStack>
        <div className={styles.fieldGridWide}>
          <LabDateInput label="받은 날짜" value={draft.receivedOn} onChange={(v) => set({ receivedOn: v })} />
          <TextInput label="후원자 이름" value={draft.donorName} onChange={(v) => set({ donorName: v.slice(0, MAX_DONOR_NAME) })} isDisabled={saving} />
          <Selector placeholder="고르기" label="후원자 구분" options={DONOR_TYPE_OPTIONS} value={draft.donorType} onChange={(v) => v && set({ donorType: v as DonorType })} isDisabled={saving} />
        </div>
        <div className={styles.fieldGridWide}>
          <SegmentedControl label="현금·물품" value={draft.kind} onChange={(v) => set({ kind: v as DonationKind })}>
            <SegmentedControlItem value="CASH" label="현금" />
            <SegmentedControlItem value="GOODS" label="물품" />
          </SegmentedControl>
          <FinanceMoneyField
            label={draft.kind === 'GOODS' ? '환산 금액 (원)' : '금액 (원)'}
            value={draft.amount}
            onChange={(v) => set({ amount: v })}
            max={MAX_DONATION_AMOUNT}
            placeholder="쉼표 없이 써도 됩니다"
            description={draft.kind === 'GOODS' ? '물품은 시가로 환산한 금액을 적습니다' : '1원 이상, 100억 원 이하'}
            isDisabled={saving}
          />
        </div>
        {draft.kind === 'GOODS' && (
          <TextInput label="물품 설명" value={draft.goodsDescription} onChange={(v) => set({ goodsDescription: v.slice(0, MAX_GOODS_DESCRIPTION) })} placeholder="예: 쌀 20kg 10포" description={`${Array.from(draft.goodsDescription).length}/${MAX_GOODS_DESCRIPTION}자`} isDisabled={saving} />
        )}
        <div className={styles.fieldGridWide}>
          <Switch label="쓸 용도가 정해진 후원(지정 후원)" value={draft.designated} onChange={(v) => set({ designated: v })} isDisabled={saving} />
          {draft.designated && <TextInput label="지정 용도" value={draft.purpose} onChange={(v) => set({ purpose: v.slice(0, MAX_PURPOSE) })} placeholder="예: 어르신 겨울 난방비" isDisabled={saving} />}
          <TextInput label="영수증 번호 (선택)" value={draft.receiptNo} onChange={(v) => set({ receiptNo: v.slice(0, MAX_RECEIPT_NO) })} isDisabled={saving} />
        </div>
        {touched && issues.length > 0 && (
          <VStack gap={1}>
            {issues.map((m) => (
              <SupportText key={m} tone="warn">
                {m}
              </SupportText>
            ))}
          </VStack>
        )}
        {error && <ErrorBanner message={error} />}
        <HStack gap={2} hAlign="end" wrap="wrap">
          {editing && <Button label="고치기 취소" variant="ghost" isDisabled={saving} onClick={onCancel} />}
          <Button label={editing ? '고친 내용 저장' : '후원금 저장'} variant="primary" isLoading={saving} isDisabled={saving || issues.length > 0} onClick={onSave} />
        </HStack>
      </VStack>
    </Card>
  );
}
