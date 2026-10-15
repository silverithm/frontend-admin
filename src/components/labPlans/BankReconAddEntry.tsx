'use client';

/**
 * "장부에 넣기" — 장부에 없는 통장 거래 한 줄을 회계 장부로 옮기는 작은 입력. 날짜·방향·금액은 통장 거래 그대로 고정하고(그래야 다시 맞출 때 짝이 된다),
 * 적요는 고칠 수 있고 계정은 직원이 계정표에서 직접 고른다. 계정 제안(AI)은 없다.
 */
import { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Chip, ErrorBanner, SupportText } from '@/components/lab/LabUi';
import { dotDate, errorText } from '@/components/lab/labFormat';
import { accountOptions } from '@/components/labRecords/FinanceFormat';
import { useAlive } from '@/components/labRecords/recordsFormat';
import { createLedgerEntry } from '@/lib/lab/labApi';
import type { StatementLine } from '@/lib/lab/bankRules';
import { MAX_LEDGER_DESCRIPTION, ledgerEntryIssues } from '@/lib/lab/ledgerRules';
import type { LedgerDirection, LedgerEntry } from '@/lib/lab/labTypes';
import { wonText } from './BankReconFormat';
import styles from './labPlans.module.css';
import bank from './bankRecon.module.css';

interface Props {
  line: StatementLine;
  onSaved: (entry: LedgerEntry) => void;
  onCancel: () => void;
}

export default function BankReconAddEntry({ line, onSaved, onCancel }: Props) {
  const alive = useAlive();
  const direction: LedgerDirection = line.amount > 0 ? 'INCOME' : 'EXPENSE';
  const amount = Math.abs(line.amount);
  const [accountCode, setAccountCode] = useState('');
  const [description, setDescription] = useState(line.description.slice(0, MAX_LEDGER_DESCRIPTION));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const issues = ledgerEntryIssues({ entryDate: line.date, direction, accountCode, description, amount, counterparty: null });

  const save = async () => {
    if (saving || issues.length > 0) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await createLedgerEntry({
        entryDate: line.date,
        direction,
        accountCode,
        description: description.trim(),
        amount,
        counterparty: null,
        evidenceType: 'TRANSFER',
        donationId: null,
        aiAssisted: false,
      });
      if (alive.current) onSaved(saved);
    } catch (e) {
      if (alive.current) setError(errorText(e, '장부에 넣지 못했습니다'));
    } finally {
      if (alive.current) setSaving(false);
    }
  };

  return (
    <div className={bank.addBox}>
      <VStack gap={3}>
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Text type="label">장부에 넣기</Text>
          <Chip tone={direction === 'INCOME' ? 'info' : 'neutral'} label={direction === 'INCOME' ? '수입' : '지출'} />
          <Text type="supporting" color="secondary" hasTabularNumbers>
            {dotDate(line.date)} · {wonText(amount)}
          </Text>
        </HStack>
        <div className={styles.fieldGrid}>
          <Selector
            label="계정 (관·항·목)"
            placeholder="계정 고르기"
            hasSearch
            searchPlaceholder="코드나 이름으로 찾기"
            options={accountOptions(direction)}
            value={accountCode === '' ? undefined : accountCode}
            onChange={(v) => setAccountCode(v)}
            isDisabled={saving}
          />
          <TextInput label="적요" value={description} onChange={(v) => setDescription(v.slice(0, MAX_LEDGER_DESCRIPTION))} placeholder="예: 10월 전기요금" isDisabled={saving} />
        </div>
        {accountCode !== '' && issues.length > 0 && (
          <VStack gap={1}>
            {issues.map((m) => (
              <SupportText key={m} tone="warn">
                {m}
              </SupportText>
            ))}
          </VStack>
        )}
        <SupportText>날짜·금액·수입/지출은 통장 거래 그대로 넣습니다. 계정은 직접 골라 주세요. 증빙은 ‘계좌이체 내역’으로 적습니다.</SupportText>
        {error && <ErrorBanner message={error} />}
        <HStack gap={2} hAlign="end" wrap="wrap">
          <Button label="넣기 취소" variant="ghost" isDisabled={saving} onClick={onCancel} />
          <Button label="장부에 저장" variant="primary" isLoading={saving} isDisabled={saving || issues.length > 0} onClick={() => void save()} />
        </HStack>
      </VStack>
    </div>
  );
}
