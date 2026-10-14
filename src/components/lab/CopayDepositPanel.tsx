'use client';

/**
 * 입금 내역 붙여넣기 — 은행 거래내역을 붙여 넣으면 청구서와 맞춰 보고, 맞을 법한 짝을 "제안"한다.
 * 은행 내역은 이 브라우저 안에서만 읽는다(서버·AI로 보내지 않음). 수납 반영은 항상 직원이 "반영"을 눌러야 일어난다.
 */
import { useMemo, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Collapsible } from '@astryxdesign/core/Collapsible';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { addCopayPayment } from '@/lib/lab/labApi';
import { remainingDue } from '@/lib/lab/copayBill';
import { confidenceRank, matchDeposits, parseBankText } from '@/lib/lab/paymentMatch';
import type { Deposit, Match, MatchConfidence } from '@/lib/lab/paymentMatch';
import { formatWon } from '@/lib/ltc2026';
import type { CopayBill } from '@/lib/lab/labTypes';
import { Chip, ErrorBanner, SupportText, useNotify } from './LabUi';
import type { Tone } from './LabUi';
import { dotDate, errorText, todayString } from './labFormat';
import styles from './lab.module.css';

const CONFIDENCE: Record<MatchConfidence, { label: string; tone: Tone }> = {
  HIGH: { label: '확실', tone: 'ok' },
  MEDIUM: { label: '보통', tone: 'warn' },
  LOW: { label: '낮음', tone: 'neutral' },
};

interface CopayDepositPanelProps {
  bills: CopayBill[];
  onApplied: (bill: CopayBill) => void;
}

interface Result {
  deposits: Deposit[];
  matches: Match[];
}

export default function CopayDepositPanel({ bills, onApplied }: CopayDepositPanelProps) {
  const notify = useNotify();
  const [text, setText] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [emptyNote, setEmptyNote] = useState(false);
  const [applied, setApplied] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const billById = useMemo(() => new Map(bills.map((b) => [b.id, b])), [bills]);

  const analyze = () => {
    setError(null);
    setApplied(new Set());
    const deposits = parseBankText(text);
    if (deposits.length === 0) {
      setResult(null);
      setEmptyNote(true);
      return;
    }
    setEmptyNote(false);
    const matches = matchDeposits(
      deposits,
      bills.map((b) => ({ id: b.id, elderlyName: b.elderlyName, payerName: b.payerName, totalDue: b.totalDue, paidAmount: b.paidAmount, status: b.status })),
    ).sort((a, b) => confidenceRank(b.confidence) - confidenceRank(a.confidence) || a.depositIndex - b.depositIndex);
    setResult({ deposits, matches });
  };

  const apply = async (match: Match) => {
    const deposit = result?.deposits[match.depositIndex];
    if (!deposit || busy !== null) return;
    setBusy(match.depositIndex);
    setError(null);
    try {
      const updated = await addCopayPayment(match.billId, {
        amount: deposit.amount,
        paidOn: deposit.date ?? todayString(),
        payerName: deposit.name.trim() === '' ? null : deposit.name.trim(),
      });
      setApplied((prev) => new Set(prev).add(match.depositIndex));
      onApplied(updated);
      notify(`${updated.elderlyName} 어르신 ${formatWon(deposit.amount)} 수납을 반영했습니다`, 'success');
    } catch (e) {
      setError(errorText(e, '수납을 기록하지 못했습니다'));
    } finally {
      setBusy(null);
    }
  };

  const matchedIndexes = new Set(result?.matches.map((m) => m.depositIndex));
  const unmatched = result ? result.deposits.map((d, i) => ({ d, i })).filter(({ i }) => !matchedIndexes.has(i)) : [];

  return (
    <Card padding={0}>
      <Collapsible trigger={<Text type="label">입금 내역 붙여넣기 · 수납 맞춰 보기</Text>} defaultIsOpen={false}>
        <div style={{ padding: 'var(--spacing-4)' }}>
          <VStack gap={3}>
            <Text type="supporting" color="secondary">
              은행 앱·인터넷뱅킹의 거래내역을 복사해 붙여 넣으세요. 은행 내역은 이 브라우저 안에서만 맞춰 보고 AI로 보내지 않습니다. 맞는 청구서를 제안만 하며, 수납은 ‘반영’을 눌러야 기록됩니다.
            </Text>
            <TextArea
              label="입금 내역"
              value={text}
              onChange={(v) => {
                setText(v);
                setEmptyNote(false);
              }}
              rows={6}
              placeholder={'예) 10/06 입금 김영희 98,000원\n(엑셀 표를 그대로 붙여 넣어도 됩니다)'}
            />
            <HStack gap={2} vAlign="center" wrap="wrap">
              <Button label="맞춰 보기" variant="secondary" isDisabled={text.trim() === '' || bills.length === 0} onClick={analyze} />
              {text !== '' && (
                <Button
                  label="지우기"
                  variant="ghost"
                  onClick={() => {
                    setText('');
                    setResult(null);
                    setApplied(new Set());
                    setEmptyNote(false);
                  }}
                />
              )}
              {bills.length === 0 && <SupportText>이 달에 저장된 청구서가 없어 맞춰 볼 수 없습니다.</SupportText>}
            </HStack>
            {emptyNote && <SupportText tone="warn">입금 내역을 읽지 못했습니다. 날짜·이름·금액이 한 줄에 있는 거래내역을 그대로 붙여 넣어 주세요.</SupportText>}
            {error && <ErrorBanner message={error} />}

            {result && (
              <VStack gap={3}>
                <Text type="label">
                  입금 {result.deposits.length}건 중 {result.matches.length}건에 짝을 찾았습니다
                </Text>
                {result.matches.map((m) => {
                  const dep = result.deposits[m.depositIndex];
                  const bill = billById.get(m.billId);
                  if (!dep || !bill) return null;
                  const done = applied.has(m.depositIndex);
                  const c = CONFIDENCE[m.confidence];
                  return (
                    <div className={styles.suggestBox} key={m.depositIndex}>
                      <HStack hAlign="between" vAlign="center" gap={3} wrap="wrap">
                        <VStack gap={0.5}>
                          <HStack gap={2} vAlign="center" wrap="wrap">
                            <Text type="body" weight="medium" hasTabularNumbers>
                              {dep.date ? `${dotDate(dep.date)} ` : ''}
                              {dep.name || '입금자 미상'} {formatWon(dep.amount)}
                            </Text>
                            <Text type="supporting" color="secondary">
                              →
                            </Text>
                            <Text type="body" weight="medium">
                              {bill.elderlyName} (남은 {formatWon(remainingDue(bill))})
                            </Text>
                            <Chip tone={c.tone} label={`신뢰도 ${c.label}`} />
                          </HStack>
                          <Text type="supporting" color="secondary">
                            {m.reason}
                          </Text>
                        </VStack>
                        <Button
                          label={done ? '반영됨' : '반영'}
                          size="sm"
                          variant={done ? 'ghost' : 'secondary'}
                          isLoading={busy === m.depositIndex}
                          isDisabled={done || busy !== null}
                          onClick={() => void apply(m)}
                        />
                      </HStack>
                    </div>
                  );
                })}
                {unmatched.length > 0 && (
                  <VStack gap={1}>
                    <Text type="label">짝을 찾지 못한 입금 {unmatched.length}건</Text>
                    {unmatched.map(({ d, i }) => (
                      <Text key={i} type="supporting" color="secondary" hasTabularNumbers>
                        {d.date ? `${dotDate(d.date)} ` : ''}
                        {d.name || '입금자 미상'} {formatWon(d.amount)}
                      </Text>
                    ))}
                  </VStack>
                )}
              </VStack>
            )}
          </VStack>
        </div>
      </Collapsible>
    </Card>
  );
}
