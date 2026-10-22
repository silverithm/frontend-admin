'use client';

/**
 * 월 본인부담금 대장 인쇄본 — 청구대장(어르신별 급여비용·공단부담·본인부담·비급여·청구)과 수납대장(받은 돈·수납일·낸 사람).
 * 케어포 본인부담금 메뉴의 청구대장·수납대장 리포트에 해당한다. 화면에서는 보이지 않고, 그려지면 인쇄 창을 연다.
 */
import { useEffect } from 'react';
import { copayLedger, receiptLedger } from '@/lib/lab/copayLedger';
import type { CopayBill } from '@/lib/lab/labTypes';
import { formatWon, gradeLabel } from '@/lib/ltc2026';
import RecordsPrintPortal from '@/components/labRecords/RecordsPrint';
import { useLatest } from '@/components/labRecords/recordsFormat';
import print from '@/components/labRecords/labRecords.module.css';
import { companyNameStored, dotDate, monthLabel, todayString } from './labFormat';

const STATUS_TEXT = { PAID: '완납', PARTIAL: '일부 납부', UNPAID: '미납' } as const;
const keep = { whiteSpace: 'nowrap' } as const;
const right = { whiteSpace: 'nowrap', textAlign: 'right' } as const;

export default function CopayLedgerSheet({ month, bills, onDone }: { month: string; bills: CopayBill[]; onDone: () => void }) {
  const company = companyNameStored();
  const done = useLatest(onDone);
  useEffect(() => {
    const finish = () => done.current();
    window.addEventListener('afterprint', finish);
    const timer = window.setTimeout(() => window.print(), 50);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('afterprint', finish);
    };
  }, [done]);

  const ledger = copayLedger(bills);
  const receipts = receiptLedger(bills);
  const gradeOf = new Map(bills.map((b) => [b.id, gradeLabel(b.careGrade)]));
  const t = ledger.totals;

  return (
    <RecordsPrintPortal landscape>
      <h1 className={print.printTitle}>{monthLabel(month)} 본인부담금 청구대장</h1>
      <div className={print.printMeta}>
        {company && <span>기관: {company}</span>}
        <span>청구 {t.count}건</span>
        <span>청구 합계 {formatWon(t.totalDue)}</span>
        <span>수납 {formatWon(t.paid)}</span>
        <span>미수 {formatWon(t.remaining)}</span>
      </div>
      <table className={print.sheetTable}>
        <thead>
          <tr>
            <th scope="col">수급자</th>
            <th scope="col">등급</th>
            <th scope="col">이용일수</th>
            <th scope="col">급여비용 총액</th>
            <th scope="col">공단 부담</th>
            <th scope="col">본인부담금</th>
            <th scope="col">한도 초과</th>
            <th scope="col">비급여</th>
            <th scope="col">이전 미납</th>
            <th scope="col">청구 합계</th>
            <th scope="col">수납</th>
            <th scope="col">미수</th>
            <th scope="col">상태</th>
          </tr>
        </thead>
        <tbody>
          {ledger.rows.map((r) => (
            <tr key={r.billId}>
              <td style={keep}>{r.elderlyName}</td>
              <td style={keep}>{gradeOf.get(r.billId)}</td>
              <td style={right}>{r.days}일</td>
              <td style={right}>{formatWon(r.totalFee)}</td>
              <td style={right}>{formatWon(r.insurerShare)}</td>
              <td style={right}>{formatWon(r.copay)}</td>
              <td style={right}>{formatWon(r.overLimit)}</td>
              <td style={right}>{formatWon(r.nonCovered)}</td>
              <td style={right}>{formatWon(r.previousUnpaid)}</td>
              <td style={right}>{formatWon(r.totalDue)}</td>
              <td style={right}>{formatWon(r.paid)}</td>
              <td style={right}>{formatWon(r.remaining)}</td>
              <td style={keep}>{STATUS_TEXT[r.status]}</td>
            </tr>
          ))}
          <tr>
            <th scope="row" style={keep}>합계</th>
            <td />
            <td style={right}>{t.days}일</td>
            <td style={right}>{formatWon(t.totalFee)}</td>
            <td style={right}>{formatWon(t.insurerShare)}</td>
            <td style={right}>{formatWon(t.copay)}</td>
            <td style={right}>{formatWon(t.overLimit)}</td>
            <td style={right}>{formatWon(t.nonCovered)}</td>
            <td style={right}>{formatWon(t.previousUnpaid)}</td>
            <td style={right}>{formatWon(t.totalDue)}</td>
            <td style={right}>{formatWon(t.paid)}</td>
            <td style={right}>{formatWon(t.remaining)}</td>
            <td />
          </tr>
        </tbody>
      </table>

      <div className={print.printSection}>수납대장 — 받은 돈 {receipts.rows.length}건 · {formatWon(receipts.total)}</div>
      <table className={print.sheetTable}>
        <thead>
          <tr>
            <th scope="col">수납일(마지막)</th>
            <th scope="col">수급자</th>
            <th scope="col">낸 사람</th>
            <th scope="col">수납액</th>
            <th scope="col">청구 합계</th>
            <th scope="col">남은 금액</th>
          </tr>
        </thead>
        <tbody>
          {receipts.rows.map((r) => (
            <tr key={r.billId}>
              <td style={keep}>{r.lastPaidOn ? dotDate(r.lastPaidOn) : ''}</td>
              <td style={keep}>{r.elderlyName}</td>
              <td style={keep}>{r.payerName ?? ''}</td>
              <td style={right}>{formatWon(r.paid)}</td>
              <td style={right}>{formatWon(r.totalDue)}</td>
              <td style={right}>{formatWon(r.remaining)}</td>
            </tr>
          ))}
          {receipts.rows.length === 0 && (
            <tr>
              <td colSpan={6}>이 달에 받은 돈이 없습니다.</td>
            </tr>
          )}
        </tbody>
      </table>
      <div className={print.printSign}>
        <span>작성자 (서명): ____________</span>
        <span>확인자 (서명): ____________</span>
      </div>
      <p className={print.printNote}>
        저장된 청구서로 계산한 기관 자체 대장입니다. 금액은 2026년 수가 기준 어림 계산이며 가산·미이용일 등은 반영하지 않았습니다 — 공단 청구상세와 대조해 주세요. 출력일 {dotDate(todayString())}
      </p>
    </RecordsPrintPortal>
  );
}
