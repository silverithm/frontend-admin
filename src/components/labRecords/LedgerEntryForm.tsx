'use client';

/**
 * 장부 한 줄 입력 — 날짜, 수입·지출, 계정(관·항·목 고르기), 적요, 금액, 거래처, 증빙, 후원금 연결.
 * 금액 칸에서 Enter를 누르면 바로 저장하고, 날짜·수입/지출은 그대로 둔 채 적요 칸으로 돌아간다(같은 날 여러 건을 빨리 넣도록).
 */
import type { Ref } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { AiChip, Chip, ErrorBanner, LabDateInput, SupportText } from '@/components/lab/LabUi';
import { dotDate } from '@/components/lab/labFormat';
import type { Donation, LedgerDirection, LedgerEvidenceType } from '@/lib/lab/labTypes';
import { MAX_COUNTERPARTY, MAX_LEDGER_AMOUNT, MAX_LEDGER_DESCRIPTION, EVIDENCE_OPTIONS, draftIssues } from './LedgerDraft';
import type { EntryDraft } from './LedgerDraft';
import { accountOptions, maskName, won } from './FinanceFormat';
import FinanceMoneyField from './FinanceMoneyField';
import styles from './labRecords.module.css';

interface Props {
  draft: EntryDraft;
  onChange: (next: EntryDraft) => void;
  donations: Donation[];
  /** 후원금 목록을 불러오지 못했을 때의 안내 */
  donationNote: string | null;
  saving: boolean;
  error: string | null;
  onSave: () => void;
  onCancel: () => void;
  descriptionRef: Ref<HTMLInputElement>;
}

export default function LedgerEntryForm({ draft, onChange, donations, donationNote, saving, error, onSave, onCancel, descriptionRef }: Props) {
  const set = (patch: Partial<EntryDraft>) => onChange({ ...draft, ...patch });
  const issues = draftIssues(draft);
  const editing = draft.id !== null;
  const donationOptions = [
    ...donations.map((d) => ({ value: String(d.id), label: `${dotDate(d.receivedOn)} ${maskName(d.donorName)} ${won(d.amount)}${d.receiptNo ? ` (${d.receiptNo})` : ''}` })),
  ];
  // 연결된 후원금이 목록(올해·작년)에 없으면 그 번호를 그대로 지키되 알려 준다
  const linkedMissing = draft.donationId !== null && !donations.some((d) => d.id === draft.donationId);
  if (linkedMissing && draft.donationId !== null) donationOptions.push({ value: String(draft.donationId), label: `후원금 번호 ${draft.donationId} (목록에 없음)` });

  return (
    <Card padding={4}>
      <VStack gap={3}>
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Text type="label">{editing ? '장부 줄 고치기' : '장부에 적기'}</Text>
          {editing && <Chip tone="warn" label="수정 중" />}
          {draft.aiAssisted && <AiChip label="AI 제안 계정" />}
        </HStack>
        <div className={styles.fieldGridWide}>
          <LabDateInput label="날짜" value={draft.date} onChange={(v) => set({ date: v })} />
          <SegmentedControl
            label="수입·지출"
            value={draft.direction}
            onChange={(v) => {
              const direction = v as LedgerDirection;
              // 방향이 바뀌면 계정표가 달라지므로 계정·후원금 연결을 비운다
              set({ direction, accountCode: '', aiAssisted: false, donationId: direction === 'EXPENSE' ? draft.donationId : null });
            }}
          >
            <SegmentedControlItem value="EXPENSE" label="지출" />
            <SegmentedControlItem value="INCOME" label="수입" />
          </SegmentedControl>
          <Selector
            label="계정 (관·항·목)"
            placeholder="계정 고르기"
            hasSearch
            searchPlaceholder="코드나 이름으로 찾기"
            options={accountOptions(draft.direction)}
            value={draft.accountCode}
            onChange={(v) => set({ accountCode: v, aiAssisted: false })}
          />
        </div>
        <div className={styles.fieldGridWide}>
          <TextInput
            ref={descriptionRef}
            label="적요"
            value={draft.description}
            onChange={(v) => set({ description: v.slice(0, MAX_LEDGER_DESCRIPTION) })}
            placeholder="예: 10월 전기요금"
            description={`${Array.from(draft.description).length}/${MAX_LEDGER_DESCRIPTION}자`}
          />
          <FinanceMoneyField label="금액 (원)" value={draft.amount} onChange={(v) => set({ amount: v })} max={MAX_LEDGER_AMOUNT} placeholder="쉼표 없이 써도 됩니다" description="1원 이상, 100억 원 이하. Enter로 저장" onEnter={() => !saving && issues.length === 0 && onSave()} />
        </div>
        <div className={styles.fieldGridWide}>
          <TextInput label="거래처 (선택)" value={draft.counterparty} onChange={(v) => set({ counterparty: v.slice(0, MAX_COUNTERPARTY) })} />
          <Selector label="증빙 (선택)" placeholder="증빙 없음" hasClear options={EVIDENCE_OPTIONS} value={draft.evidence === '' ? null : draft.evidence} onChange={(v) => set({ evidence: (v ?? '') as LedgerEvidenceType | '' })} />
          {draft.direction === 'EXPENSE' && (
            <Selector
              label="후원금 연결 (선택)"
              placeholder="연결 안 함"
              hasClear
              options={donationOptions}
              value={draft.donationId === null ? null : String(draft.donationId)}
              onChange={(v) => set({ donationId: v === null || v === '' ? null : Number(v) })}
              hasSearch
              searchPlaceholder="날짜·이름·번호로 찾기"
            />
          )}
        </div>
        {draft.direction === 'EXPENSE' && donationNote && <SupportText tone="warn">{donationNote}</SupportText>}
        {draft.direction === 'EXPENSE' && !donationNote && <SupportText>후원금으로 쓴 지출은 연결해 두면 후원금 화면에서 남은 금액과 사용 결과 보고서가 맞춰집니다.</SupportText>}
        {draft.accountCode !== '' && issues.length > 0 && (
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
          <Button label={editing ? '고친 내용 저장' : '장부에 저장'} variant="primary" isLoading={saving} isDisabled={saving || issues.length > 0} onClick={onSave} />
        </HStack>
      </VStack>
    </Card>
  );
}
