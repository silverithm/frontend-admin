'use client';

/**
 * 후원금 전용계좌 점검 — (그 해 1월~선택한 달 말까지 받은 현금 후원금 − 후원금과 연결해 쓴 지출)이 후원금 전용 통장의 월말 잔액과 맞는지 본다.
 * 재무·회계 규칙 제17조: 계좌로 받는 후원금은 후원금 전용계좌로 받고 쓴다(물품 후원은 제외).
 * 전년에서 넘어온 후원금이나 통장 시작 잔액이 있으면 그만큼 차이로 나타난다.
 */
import { useMemo } from 'react';
import { Card } from '@astryxdesign/core/Card';
import { VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Chip, ErrorBanner, SupportText } from '@/components/lab/LabUi';
import { monthLabel, monthRange } from '@/components/lab/labFormat';
import { donationAccountCheck } from '@/lib/lab/bankRules';
import type { BankAccount, BankStatement, Donation, LedgerEntry } from '@/lib/lab/labTypes';
import { accountsOfMonth } from './BankReconBook';
import { signedWonText, wonText } from './BankReconFormat';
import styles from './labPlans.module.css';
import bank from './bankRecon.module.css';

interface Props {
  month: string;
  accounts: BankAccount[];
  statements: BankStatement[];
  /** 그 해 장부 */
  entries: LedgerEntry[];
  donations: Donation[];
  loading: boolean;
  error: string | null;
}

export default function BankReconDonation({ month, accounts, statements, entries, donations, loading, error }: Props) {
  const year = Number(month.slice(0, 4));
  const donationAccounts = useMemo(() => accountsOfMonth(accounts, month).filter((a) => a.purpose === 'DONATION'), [accounts, month]);
  const closings = donationAccounts.map((a) => statements.find((s) => s.accountId === a.id && s.statementMonth === month)?.closingBalance);
  const allKnown = donationAccounts.length > 0 && closings.every((c) => c !== undefined);
  const balance = allKnown ? closings.reduce<number>((s, c) => s + (c ?? 0), 0) : null;

  const check = useMemo(() => {
    const end = monthRange(month).end;
    // 선택한 달 말까지만 센다 — 월말 잔액은 그 날의 값이기 때문이다
    return donationAccountCheck(
      donations.filter((d) => d.receivedOn <= end),
      entries.filter((e) => e.entryDate <= end),
      year,
      balance,
    );
  }, [donations, entries, month, year, balance]);

  return (
    <Card padding={4}>
      <VStack gap={3}>
        <Text type="label">{year}년 후원금 전용계좌 점검 ({monthLabel(month)} 말 기준)</Text>
        {error && <ErrorBanner message={error} />}
        {loading ? (
          <SupportText>후원금과 장부를 불러오는 중...</SupportText>
        ) : donationAccounts.length === 0 ? (
          <SupportText>후원금 전용 통장이 없습니다. 위 통장 목록에서 용도를 ‘후원금 전용’으로 통장을 추가하면 점검할 수 있습니다.</SupportText>
        ) : (
          <>
            <div className={styles.toolbar}>
              <div className={styles.statBox}>
                <Text type="supporting" color="secondary">
                  받은 현금 후원금 (1월~{Number(month.slice(5, 7))}월)
                </Text>
                <Text type="label" hasTabularNumbers>
                  {wonText(check.received)}
                </Text>
              </div>
              <div className={styles.statBox}>
                <Text type="supporting" color="secondary">
                  후원금으로 쓴 지출
                </Text>
                <Text type="label" hasTabularNumbers>
                  {wonText(check.used)}
                </Text>
              </div>
              <div className={styles.statBox}>
                <Text type="supporting" color="secondary">
                  남아 있어야 할 금액
                </Text>
                <Text type="label" hasTabularNumbers>
                  {wonText(check.expected)}
                </Text>
              </div>
              <div className={styles.statBox}>
                <Text type="supporting" color="secondary">
                  후원금 통장 월말 잔액
                </Text>
                <Text type="label" hasTabularNumbers>
                  {balance === null ? '입력 전' : wonText(balance)}
                </Text>
              </div>
              <div className={styles.statBox}>
                <Text type="supporting" color="secondary">
                  차이 (통장 − 남아 있어야 할 금액)
                </Text>
                {check.diff === null ? (
                  <Text type="label">월말 잔액을 먼저 저장해 주세요</Text>
                ) : check.diff === 0 ? (
                  <span className={`${bank.diffNumber} ${styles.okText}`}>맞음</span>
                ) : (
                  <span className={`${bank.diffNumber} ${styles.dangerText}`}>{signedWonText(check.diff)}</span>
                )}
              </div>
            </div>
            {check.diff !== null && check.diff !== 0 && <Chip tone="danger" label="차이 있음" />}
            <SupportText>
              전년에서 넘어온 후원금이나 통장 시작 잔액이 있으면 그만큼 차이로 나타납니다. 후원금 지출은 장부에서 ‘후원금 연결’을 해 두어야 반영되고, 물품 후원은 제외합니다.
            </SupportText>
          </>
        )}
      </VStack>
    </Card>
  );
}
