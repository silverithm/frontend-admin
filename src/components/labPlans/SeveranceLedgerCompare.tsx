'use client';

/** 회계 장부 세출 115(퇴직금 및 퇴직적립금) 올해 실적과 기관 추계 합의 비교. */
import { Card } from '@astryxdesign/core/Card';
import { VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import { ErrorBanner, SupportText } from '@/components/lab/LabUi';
import { num } from '@/components/labRecords/FinanceFormat';
import styles from './labPlans.module.css';

interface Props {
  year: number;
  total: number;
  ledgerTotal: number | null;
  ledgerCount: number;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

export default function SeveranceLedgerCompare({ year, total, ledgerTotal, ledgerCount, loading, error, onRetry }: Props) {
  const diff = ledgerTotal === null ? null : ledgerTotal - total;
  return (
    <Card padding={4}>
      <VStack gap={2}>
        <Text type="label">회계 장부 세출 115 (퇴직금 및 퇴직적립금) {year}년 실적과 견주기</Text>
        {loading ? (
          <Loading size="inline" label="회계 장부를 불러오는 중..." />
        ) : error ? (
          <ErrorBanner message={error} onRetry={onRetry} />
        ) : (
          <>
            <div className={styles.toolbar}>
              <div className={styles.statBox}>
                <Text type="supporting" color="secondary">
                  기관 추계 합계
                </Text>
                <Text type="label" hasTabularNumbers>
                  {num(total)}원
                </Text>
              </div>
              <div className={styles.statBox}>
                <Text type="supporting" color="secondary">
                  장부 세출 115 {year}년 합계 ({ledgerCount}건)
                </Text>
                <Text type="label" hasTabularNumbers>
                  {num(ledgerTotal ?? 0)}원
                </Text>
              </div>
              <div className={styles.statBox}>
                <Text type="supporting" color="secondary">
                  장부 − 추계
                </Text>
                <span className={diff !== null && diff < 0 ? styles.warnText : undefined}>
                  <Text type="label" color="inherit" hasTabularNumbers>
                    {diff === null ? '-' : `${diff > 0 ? '+' : diff < 0 ? '-' : ''}${num(Math.abs(diff))}원`}
                  </Text>
                </span>
              </div>
            </div>
            {ledgerCount === 0 ? (
              <SupportText tone="warn">{year}년 장부에 세출 115로 적은 기록이 없습니다. 퇴직금을 지급했거나 퇴직연금(IRP·DC)에 적립했다면 회계 장부에 ‘115 퇴직금 및 퇴직적립금’으로 남겨 주세요.</SupportText>
            ) : diff !== null && diff < 0 ? (
              <SupportText tone="warn">올해 장부에 적은 금액이 추계 합계보다 {num(Math.abs(diff))}원 적습니다. 지난해까지 쌓아 둔 적립액이 있다면 그만큼 빼고 보세요. 부족하면 퇴직연금 적립을 검토해 주세요.</SupportText>
            ) : (
              <SupportText>올해 장부 금액이 추계 합계 이상입니다. 다만 장부는 올해 낸 돈이고 추계는 지금까지의 전체 금액이라 정확히 같은 기준은 아닙니다. 적립 누계는 퇴직연금 사업자 잔액으로 확인해 주세요.</SupportText>
            )}
          </>
        )}
      </VStack>
    </Card>
  );
}
