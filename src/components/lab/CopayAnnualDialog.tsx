'use client';

/**
 * 연간 납부 내역 — 한 해 동안 보호자가 낸 본인부담금을 어르신별로 모아 보고, 엑셀로 열리는 CSV로 내려받는다.
 * 의료비 공제 제출용 자료를 만들 때 쓴다. 기준은 "청구 월"이다(12월분을 1월에 내도 작년 이용분으로 본다).
 * 공제 대상 여부와 금액은 세무 기준에 따라 다르므로, 이 표는 기관이 받은 금액의 기록일 뿐이다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Icon } from '@astryxdesign/core/Icon';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import { listCopayBillsByYear } from '@/lib/lab/labApi';
import { annualPaymentRows, annualPaymentTotals, toCsv } from '@/lib/lab/copayBill';
import type { AnnualPaymentRow, CsvHeader } from '@/lib/lab/copayBill';
import { formatWon } from '@/lib/ltc2026';
import { ErrorBanner, SupportText, useNotify } from './LabUi';
import { dotDate, errorText, monthLabel, todayString } from './labFormat';
import styles from './lab.module.css';

const FIRST_YEAR = 2020;

type CsvRow = Pick<AnnualPaymentRow, 'elderlyName' | 'billMonth' | 'paidAmount' | 'lastPaidOn'>;

const CSV_HEADERS: ReadonlyArray<CsvHeader<CsvRow>> = [
  { key: 'elderlyName', label: '어르신' },
  { key: 'billMonth', label: '청구월' },
  { key: 'paidAmount', label: '낸 금액(원)' },
  { key: 'lastPaidOn', label: '마지막 납부일' },
];

/** 브라우저가 파일을 내려받게 한다. 주소는 곧바로 풀어 메모리를 돌려준다. */
function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

interface CopayAnnualDialogProps {
  /** 처음 보여 줄 연도 — 화면에서 보던 달의 연도 */
  initialYear: number;
  onClose: () => void;
}

export default function CopayAnnualDialog({ initialYear, onClose }: CopayAnnualDialogProps) {
  const notify = useNotify();
  const thisYear = Number(todayString().slice(0, 4));
  const [year, setYear] = useState(initialYear);
  const [rows, setRows] = useState<AnnualPaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const load = useCallback(async (target: number) => {
    const n = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const bills = await listCopayBillsByYear(target);
      if (n !== seq.current) return; // 연도를 빨리 넘기면 앞선 응답은 버린다
      setRows(annualPaymentRows(bills, target));
    } catch (e) {
      if (n !== seq.current) return;
      setRows([]);
      setError(errorText(e, '연간 납부 내역을 불러오지 못했습니다'));
    } finally {
      if (n === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(year);
    return () => {
      seq.current += 1;
    };
  }, [year, load]);

  const totals = useMemo(() => annualPaymentTotals(rows), [rows]);
  const grandTotal = useMemo(() => rows.reduce((sum, r) => sum + r.paidAmount, 0), [rows]);

  const download = () => {
    if (rows.length === 0) return;
    const csvRows: CsvRow[] = [
      ...rows,
      // 맨 끝 합계 줄 — 엑셀에서 합계를 다시 내지 않아도 되게
      { elderlyName: '합계', billMonth: '', paidAmount: grandTotal, lastPaidOn: null },
    ];
    downloadCsv(`본인부담금_납부내역_${year}.csv`, toCsv(csvRows, CSV_HEADERS));
    notify(`${year}년 납부 내역 ${rows.length}건을 내려받았습니다`, 'success');
  };

  return (
    <Dialog isOpen onOpenChange={(open) => !open && onClose()} purpose="info" width="min(760px, calc(100vw - 24px))" maxHeight="90vh">
      <Layout
        header={<DialogHeader title="연간 납부 내역" onOpenChange={(open) => !open && onClose()} />}
        content={
          <LayoutContent>
            <div className={styles.kr}>
              <VStack gap={3}>
                <SupportText>
                  의료비 공제 제출용으로, 그 해 청구 월 기준으로 보호자가 낸 본인부담금을 어르신별로 모았습니다. 공제 대상 여부와 금액은 세무 기준을 확인해 주세요.
                </SupportText>
                <div role="group" aria-label="연도 선택" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}>
                  <IconButton
                    label="이전 해"
                    tooltip="이전 해"
                    variant="ghost"
                    isDisabled={year <= FIRST_YEAR}
                    onClick={() => setYear((y) => y - 1)}
                    icon={<Icon icon="chevronLeft" size="sm" />}
                  />
                  <span style={{ display: 'inline-block', minWidth: 88, textAlign: 'center' }}>
                    <Text type="label" hasTabularNumbers>
                      {year}년
                    </Text>
                  </span>
                  <IconButton
                    label="다음 해"
                    tooltip="다음 해"
                    variant="ghost"
                    isDisabled={year >= thisYear}
                    onClick={() => setYear((y) => y + 1)}
                    icon={<Icon icon="chevronRight" size="sm" />}
                  />
                </div>

                {error && <ErrorBanner message={error} onRetry={() => void load(year)} />}

                {loading ? (
                  <Loading size="section" label="납부 내역을 불러오는 중..." />
                ) : rows.length === 0 && !error ? (
                  <EmptyState isCompact title={`${year}년에 낸 금액이 기록된 청구서가 없습니다`} description="수납 입력을 한 청구서만 이 표에 나옵니다." />
                ) : rows.length > 0 ? (
                  <>
                    <HStack gap={4} wrap="wrap">
                      <VStack gap={0.5}>
                        <Text type="supporting" color="secondary">
                          {year}년 낸 금액 합계
                        </Text>
                        <Text type="large" weight="bold" hasTabularNumbers>
                          {formatWon(grandTotal)}
                        </Text>
                      </VStack>
                      <VStack gap={0.5}>
                        <Text type="supporting" color="secondary">
                          어르신 · 청구서
                        </Text>
                        <Text type="large" weight="semibold" hasTabularNumbers>
                          {totals.length}명 · {rows.length}건
                        </Text>
                      </VStack>
                    </HStack>

                    <div className={styles.tableScroll}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th scope="col">어르신</th>
                            <th scope="col">청구 월</th>
                            <th scope="col" className={styles.num}>
                              낸 금액
                            </th>
                            <th scope="col">마지막 납부일</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r) => (
                            <tr key={r.billId}>
                              <td>{r.elderlyName}</td>
                              <td>{monthLabel(r.billMonth)}</td>
                              <td className={styles.num}>{formatWon(r.paidAmount)}</td>
                              <td>{dotDate(r.lastPaidOn)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <VStack gap={1}>
                      <Text type="label">어르신별 합계</Text>
                      <div className={styles.tableScroll}>
                        <table className={styles.table}>
                          <tbody>
                            {totals.map((t) => (
                              <tr key={t.elderlyName}>
                                <td>{t.elderlyName}</td>
                                <td className={styles.num}>{formatWon(t.paidAmount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </VStack>
                  </>
                ) : null}
              </VStack>
            </div>
          </LayoutContent>
        }
        footer={
          <LayoutFooter hasDivider>
            <HStack hAlign="end" gap={2}>
              <Button label="닫기" variant="secondary" onClick={onClose} />
              <Button label="CSV 내려받기" variant="primary" isDisabled={loading || rows.length === 0} onClick={download} />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  );
}
