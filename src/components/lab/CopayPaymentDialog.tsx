'use client';

/** 수납 입력 — 낸 금액을 청구서에 더한다. 여러 번 나눠 낼 수 있다. */
import { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { addCopayPayment } from '@/lib/lab/labApi';
import { MAX_MONEY, remainingDue } from '@/lib/lab/copayBill';
import { formatWon } from '@/lib/ltc2026';
import type { CopayBill } from '@/lib/lab/labTypes';
import { ErrorBanner, LabDateInput, NumField } from './LabUi';
import { errorText, todayString } from './labFormat';

interface CopayPaymentDialogProps {
  bill: CopayBill;
  onClose: () => void;
  onSaved: (bill: CopayBill) => void;
}

export default function CopayPaymentDialog({ bill, onClose, onSaved }: CopayPaymentDialogProps) {
  const remaining = remainingDue(bill);
  const [amount, setAmount] = useState<number | null>(remaining > 0 ? remaining : null);
  const [paidOn, setPaidOn] = useState<string>(todayString());
  const [payer, setPayer] = useState(bill.payerName ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (saving) return;
    if (amount === null || amount < 1) {
      setError('낸 금액을 1원 이상으로 입력해 주세요');
      return;
    }
    if (!paidOn) {
      setError('낸 날짜를 골라 주세요');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await addCopayPayment(bill.id, { amount, paidOn, payerName: payer.trim() === '' ? null : payer.trim() });
      onSaved(updated);
    } catch (e) {
      setError(errorText(e, '수납을 기록하지 못했습니다'));
      setSaving(false);
    }
  };

  const guardClose = (open: boolean) => {
    if (!open && !saving) onClose();
  };

  return (
    <Dialog isOpen onOpenChange={guardClose} purpose="form" width="min(420px, calc(100vw - 24px))">
      <Layout
        header={<DialogHeader title={`${bill.elderlyName} · 수납 입력`} onOpenChange={guardClose} />}
        content={
          <LayoutContent>
            <VStack gap={3}>
              <Text type="supporting" color="secondary">
                청구 {formatWon(bill.totalDue)} · 낸 금액 {formatWon(bill.paidAmount)} · 남은 금액 {formatWon(remaining)}
              </Text>
              <NumField label="낸 금액 (원)" value={amount} onChange={setAmount} max={MAX_MONEY} />
              {amount !== null && remaining > 0 && amount > remaining && (
                <Text type="supporting" color="secondary">
                  남은 금액보다 {formatWon(amount - remaining)} 많습니다. 초과 납부라면 그대로 기록해도 됩니다.
                </Text>
              )}
              <LabDateInput label="낸 날짜" value={paidOn} onChange={setPaidOn} max={todayString()} />
              <TextInput label="낸 사람 (선택)" value={payer} onChange={(v) => setPayer(v.slice(0, 50))} placeholder="예: 보호자 이름" />
              {error && <ErrorBanner message={error} />}
            </VStack>
          </LayoutContent>
        }
        footer={
          <LayoutFooter hasDivider>
            <HStack gap={2} hAlign="end">
              <Button label="취소" variant="ghost" isDisabled={saving} onClick={onClose} />
              <Button label="수납 기록" variant="primary" isLoading={saving} isDisabled={saving} onClick={() => void submit()} />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  );
}
