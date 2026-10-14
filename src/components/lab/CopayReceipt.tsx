'use client';

/**
 * 영수증·납부확인서 — 청구서 한 건의 항목별 금액, 낸 금액, 납부일을 한 장으로 낸다.
 * 화면 미리보기와 인쇄본이 같은 문서(ReceiptSheet)를 쓴다. 인쇄는 월별 기록지와 같은 방식으로,
 * body 바로 아래(portal)에 사본을 따로 그리고 인쇄할 때 나머지 화면을 모두 숨긴다.
 */
import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { TextInput } from '@astryxdesign/core/TextInput';
import { remainingDue } from '@/lib/lab/copayBill';
import { formatWon } from '@/lib/ltc2026';
import type { CopayBill } from '@/lib/lab/labTypes';
import { SupportText } from './LabUi';
import { companyNameStored, dotDate, monthLabel, todayString } from './labFormat';
import styles from './lab.module.css';

/** 영수증에 찍히는 항목 줄 — 0원인 한도 초과분·이전 미납은 뺀다. */
function receiptLines(bill: CopayBill): Array<{ label: string; amount: number }> {
  const lines = [{ label: '본인부담금', amount: bill.copayAmount }];
  if (bill.overLimitAmount > 0) lines.push({ label: '월 한도 초과분', amount: bill.overLimitAmount });
  for (const item of bill.nonCoveredItems) lines.push({ label: `${item.label} (비급여)`, amount: item.amount });
  if (bill.previousUnpaid > 0) lines.push({ label: '이전 미납금', amount: bill.previousUnpaid });
  return lines;
}

export function ReceiptSheet({ bill, companyName }: { bill: CopayBill; companyName: string }) {
  const remaining = remainingDue(bill);
  const settled = remaining <= 0;
  return (
    <div className={styles.receiptDoc}>
      <h2 className={styles.receiptTitle}>{settled ? '본인부담금 납부확인서' : '본인부담금 영수증'}</h2>
      <table className={styles.receiptTable}>
        <tbody>
          <tr>
            <th scope="row">기관명</th>
            <td>{companyName.trim() === '' ? ' ' : companyName}</td>
            <th scope="row">청구 월</th>
            <td>{monthLabel(bill.billMonth)}</td>
          </tr>
          <tr>
            <th scope="row">수급자</th>
            <td>{bill.elderlyName}</td>
            <th scope="row">이용일수</th>
            <td>{bill.days}일</td>
          </tr>
        </tbody>
      </table>

      <table className={styles.receiptTable}>
        <thead>
          <tr>
            <th scope="col">항목</th>
            <th scope="col" className={styles.num}>
              금액
            </th>
          </tr>
        </thead>
        <tbody>
          {receiptLines(bill).map((line, i) => (
            <tr key={`${line.label}-${i}`}>
              <td>{line.label}</td>
              <td className={styles.num}>{formatWon(line.amount)}</td>
            </tr>
          ))}
          <tr className={styles.receiptTotal}>
            <th scope="row">청구 합계</th>
            <td className={styles.num}>{formatWon(bill.totalDue)}</td>
          </tr>
          <tr>
            <th scope="row">낸 금액</th>
            <td className={styles.num}>{formatWon(bill.paidAmount)}</td>
          </tr>
          <tr>
            <th scope="row">남은 금액</th>
            <td className={styles.num}>{formatWon(Math.max(remaining, 0))}</td>
          </tr>
        </tbody>
      </table>

      <table className={styles.receiptTable}>
        <tbody>
          <tr>
            <th scope="row">납부일</th>
            <td>{dotDate(bill.lastPaidOn)}</td>
            <th scope="row">납부자</th>
            <td>{bill.payerName ?? ' '}</td>
          </tr>
        </tbody>
      </table>

      <p className={styles.receiptStatement}>
        {settled
          ? `위 금액을 ${monthLabel(bill.billMonth)} 장기요양 본인부담금으로 정히 납부받았음을 확인합니다.`
          : `위 금액을 ${monthLabel(bill.billMonth)} 장기요양 본인부담금으로 정히 영수합니다. 남은 금액은 추후 납부해 주세요.`}
      </p>
      <p className={styles.receiptSign}>
        {dotDate(todayString())}
        <br />
        {companyName.trim() === '' ? '기관명' : companyName} (직인)
      </p>
    </div>
  );
}

/** 인쇄 전용 사본. 화면에서는 보이지 않고, 인쇄할 때만 나타난다. */
function ReceiptPrint({ bill, companyName }: { bill: CopayBill; companyName: string }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setHost(document.body);
  }, []);
  if (!host) return null;
  return createPortal(
    // 포털은 Astryx 테마 바깥(body 바로 아래)에 놓이므로, 토큰이 닿도록 테마 속성을 직접 단다
    <div className={styles.printRoot} data-lab-print-root="" data-astryx-theme="neutral">
      <style>{`
        @page { size: A4 portrait; margin: 18mm; }
        @media print {
          body > *:not([data-lab-print-root]) { display: none !important; }
          html, body { background: var(--color-background-card) !important; height: auto !important; overflow: visible !important; }
        }
      `}</style>
      <ReceiptSheet bill={bill} companyName={companyName} />
    </div>,
    host,
  );
}

interface CopayReceiptDialogProps {
  bill: CopayBill;
  onClose: () => void;
}

export default function CopayReceiptDialog({ bill, onClose }: CopayReceiptDialogProps) {
  const [companyName, setCompanyName] = useState(companyNameStored);

  return (
    <>
      <Dialog isOpen onOpenChange={(open) => !open && onClose()} purpose="info" width="min(640px, calc(100vw - 24px))" maxHeight="90vh">
        <Layout
          header={<DialogHeader title={`${bill.elderlyName} · 영수증·납부확인서`} onOpenChange={(open) => !open && onClose()} />}
          content={
            <LayoutContent>
              <div className={styles.kr}>
                <VStack gap={3}>
                  <TextInput label="기관명" description="인쇄본 맨 위와 직인 자리에 들어갑니다" value={companyName} onChange={(v) => setCompanyName(v.slice(0, 60))} />
                  <div className={styles.receiptPaper}>
                    <ReceiptSheet bill={bill} companyName={companyName} />
                  </div>
                  <SupportText>케어브이 실험실에서 만든 참고용 출력본입니다. 직인을 찍어 보호자께 드리세요. 낸 금액·납부일은 수납 입력 기록을 따릅니다.</SupportText>
                </VStack>
              </div>
            </LayoutContent>
          }
          footer={
            <LayoutFooter hasDivider>
              <HStack hAlign="end" gap={2}>
                <Button label="닫기" variant="secondary" onClick={onClose} />
                <Button label="인쇄" variant="primary" onClick={() => window.print()} />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>
      <ReceiptPrint bill={bill} companyName={companyName} />
    </>
  );
}
