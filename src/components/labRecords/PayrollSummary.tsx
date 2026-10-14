'use client';

/**
 * 급여대장 위쪽 카드 두 장 — 올해 인건비 지출비율(staffCostRatio)과 이번 달 총지급·실지급·사업주 부담.
 * 인건비는 저장된 올해 급여 줄, 수입은 청구서(coveredTotal)다. 비율은 급여 줄이 있는 달만 맞춰 비교한다(수입이 더 많은 달이 섞이면 비율이 낮게 나온다).
 * 두 자료는 따로 불러와 한쪽이 실패해도 다른 쪽은 보여 준다.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '@astryxdesign/core/Card';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import { Chip, ErrorBanner, SupportText } from '@/components/lab/LabUi';
import { currentMonth, errorText, monthLabel, todayString } from '@/components/lab/labFormat';
import { listCopayBillsByYear, listPayrollLinesByYear } from '@/lib/lab/labApi';
import type { CopayBill, PayrollLine } from '@/lib/lab/labTypes';
import { staffCostRatio } from '@/lib/lab/staffCostRatio';
import { won } from './FinanceFormat';
import { useAlive } from './recordsFormat';
import styles from './labRecords.module.css';

interface Props {
  /** 올릴 때마다 다시 불러온다(저장·확정 뒤) */
  refreshKey: number;
}

export default function PayrollSummary({ refreshKey }: Props) {
  const alive = useAlive();
  const year = Number(todayString().slice(0, 4));
  const [lines, setLines] = useState<PayrollLine[] | null>(null);
  const [bills, setBills] = useState<CopayBill[] | null>(null);
  const [lineError, setLineError] = useState<string | null>(null);
  const [billError, setBillError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);

  useEffect(() => {
    const n = ++seq.current;
    setLoading(true);
    void Promise.allSettled([listPayrollLinesByYear(year), listCopayBillsByYear(year)]).then(([l, b]) => {
      if (!alive.current || n !== seq.current) return; // 늦게 온 응답은 버린다
      if (l.status === 'fulfilled') {
        setLines(l.value);
        setLineError(null);
      } else {
        setLines(null);
        setLineError(errorText(l.reason, '올해 급여대장을 불러오지 못했습니다'));
      }
      if (b.status === 'fulfilled') {
        setBills(b.value);
        setBillError(null);
      } else {
        setBills(null);
        setBillError(errorText(b.reason, '올해 청구서를 불러오지 못했습니다. 수입을 알 수 없어 인건비 비율은 계산하지 않습니다'));
      }
      setLoading(false);
    });
    return () => {
      seq.current += 1;
    };
  }, [year, refreshKey, alive]);

  const ratio = useMemo(() => {
    if (!lines || !bills) return null;
    const months = new Set(lines.map((l) => l.payMonth));
    const revenue = bills.filter((b) => months.has(b.billMonth)).reduce((sum, b) => sum + b.coveredTotal, 0);
    const confirmedMonths = [...months].filter((m) => lines.filter((l) => l.payMonth === m).every((l) => l.status === 'CONFIRMED')).length;
    return { result: staffCostRatio({ lines, revenue }), months: months.size, confirmedMonths };
  }, [lines, bills]);

  const thisMonth = useMemo(() => {
    if (!lines) return null;
    const m = currentMonth();
    const mine = lines.filter((l) => l.payMonth === m);
    return {
      month: m,
      count: mine.length,
      gross: mine.reduce((s, l) => s + l.grossPay, 0),
      net: mine.reduce((s, l) => s + l.netPay, 0),
      employer: mine.reduce((s, l) => s + l.employerNps + l.employerHealth + l.employerLtc + l.employerEmployment, 0),
      confirmed: mine.length > 0 && mine.every((l) => l.status === 'CONFIRMED'),
    };
  }, [lines]);

  const r = ratio?.result ?? null;

  return (
    <div className={styles.fieldGridWide}>
      <Card padding={4}>
        <VStack gap={2}>
          <HStack gap={2} vAlign="center" wrap="wrap">
            <Text type="label">{year}년 인건비 지출비율</Text>
            {r && r.ratio !== null && <Chip tone={r.met ? 'ok' : 'warn'} label={r.met ? '기준 이상' : '기준 미달'} />}
          </HStack>
          {loading && !ratio ? (
            <Loading size="inline" label="불러오는 중..." />
          ) : billError ? (
            <ErrorBanner message={billError} />
          ) : lineError ? (
            <ErrorBanner message={lineError} />
          ) : r && ratio ? (
            r.ratio === null ? (
              <SupportText>{ratio.months === 0 ? '저장된 올해 급여대장이 없어 계산할 수 없습니다. 월 급여대장에서 급여를 저장하면 나타납니다.' : '급여 줄이 있는 달의 청구서가 없어 수입이 0원입니다. 본인부담금 화면에서 청구서를 먼저 만들어 주세요.'}</SupportText>
            ) : (
              <>
                <Text type="large" hasTabularNumbers>
                  {r.ratio.toFixed(1)}%
                  <span className={styles.mutedText}> / 기준 {r.target}% (대조 필요)</span>
                </Text>
                <SupportText>
                  인건비 {won(r.laborCost)} ÷ 수입 {won(r.revenue)} · 급여 줄이 있는 {ratio.months}개월 기준(확정 {ratio.confirmedMonths}개월)
                </SupportText>
                <SupportText>
                  인건비 = 총지급 {won(r.grossTotal)} + 사업주 4대보험 {won(r.employerInsuranceTotal)} + 퇴직적립 {won(r.retirementAccrual)}(총지급의 1/12). 수입은 청구서의 장기요양급여비용(공단부담 + 본인부담) 합입니다.
                </SupportText>
              </>
            )
          ) : null}
        </VStack>
      </Card>

      <Card padding={4}>
        <VStack gap={2}>
          <HStack gap={2} vAlign="center" wrap="wrap">
            <Text type="label">{monthLabel(currentMonth())} 급여 (저장된 값)</Text>
            {thisMonth?.confirmed && <Chip tone="ok" label="확정" />}
          </HStack>
          {loading && !thisMonth ? (
            <Loading size="inline" label="불러오는 중..." />
          ) : lineError ? (
            <ErrorBanner message={lineError} />
          ) : thisMonth && thisMonth.count > 0 ? (
            <div className={styles.toolbar}>
              <div className={styles.statBox}>
                <Text type="supporting" color="secondary">
                  총지급 ({thisMonth.count}명)
                </Text>
                <Text type="label" hasTabularNumbers>
                  {won(thisMonth.gross)}
                </Text>
              </div>
              <div className={styles.statBox}>
                <Text type="supporting" color="secondary">
                  실지급
                </Text>
                <Text type="label" hasTabularNumbers>
                  {won(thisMonth.net)}
                </Text>
              </div>
              <div className={styles.statBox}>
                <Text type="supporting" color="secondary">
                  사업주 부담
                </Text>
                <Text type="label" hasTabularNumbers>
                  {won(thisMonth.employer)}
                </Text>
              </div>
            </div>
          ) : (
            <SupportText>이번 달 급여가 아직 저장되지 않았습니다. “월 급여대장”에서 저장하면 합계가 나타납니다.</SupportText>
          )}
        </VStack>
      </Card>
    </div>
  );
}
