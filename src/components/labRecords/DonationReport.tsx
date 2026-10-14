'use client';

/**
 * 후원금 수입·사용 결과 보고서 인쇄본 — A4 세로. 후원금별 받은 내용과 쓴 곳(연결된 지출), 남은 금액을 적는다.
 * 화면에서는 보이지 않고 인쇄할 때만 나타난다. 인쇄는 body 바로 아래(portal)에 그리고 다른 화면은 인쇄에서 숨긴다.
 * 후원자 이름은 maskNames가 켜져 있으면 가운데를 가린다.
 */
import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { companyNameStored, dotDate, todayString } from '@/components/lab/labFormat';
import { accountLabel, donationUsage } from '@/lib/lab/ledgerRules';
import type { Donation, LedgerEntry } from '@/lib/lab/labTypes';
import { DONOR_TYPE_LABEL, KIND_LABEL } from './DonationDraft';
import { maskName, num } from './FinanceFormat';
import styles from './labRecords.module.css';

interface Props {
  year: number;
  donations: Donation[];
  entries: LedgerEntry[];
  maskNames: boolean;
  /** 올릴 때마다 인쇄를 한 번 시작한다 */
  printKey: number;
  onReady: () => void;
}

export default function DonationReport({ year, donations, entries, maskNames, printKey, onReady }: Props) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setHost(document.body);
  }, []);
  useEffect(() => {
    if (!host || printKey === 0) return undefined;
    // 포털이 그려진 다음 한 박자 뒤에 인쇄 창을 연다
    const timer = setTimeout(onReady, 60);
    return () => clearTimeout(timer);
    // 인쇄는 printKey가 바뀔 때만 시작한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host, printKey]);
  if (!host || printKey === 0) return null;

  const company = companyNameStored();
  const sorted = [...donations].sort((a, b) => (a.receivedOn < b.receivedOn ? -1 : a.receivedOn > b.receivedOn ? 1 : a.id - b.id));
  const cash = sorted.filter((d) => d.kind === 'CASH').reduce((s, d) => s + d.amount, 0);
  const goods = sorted.filter((d) => d.kind === 'GOODS').reduce((s, d) => s + d.amount, 0);
  const used = sorted.reduce((s, d) => s + d.usedAmount, 0);
  const total = cash + goods;

  return createPortal(
    <div className={styles.printRoot} data-lab-print-root="" data-astryx-theme="neutral">
      <style>{`
        @page { size: A4 portrait; margin: 14mm; }
        @media print {
          body > *:not([data-lab-print-root]) { display: none !important; }
          html, body { background: var(--color-background-card) !important; height: auto !important; overflow: visible !important; }
        }
      `}</style>
      <h1 className={styles.printTitle}>{year}년 후원금 수입·사용 결과 보고서</h1>
      <div className={styles.printMeta}>
        {company && <span>기관: {company}</span>}
        <span>출력일: {dotDate(todayString())}</span>
        <span>후원금 {sorted.length}건</span>
      </div>

      <table className={styles.sheetTable}>
        <thead>
          <tr>
            <th scope="col">현금 후원</th>
            <th scope="col">물품 후원(환산)</th>
            <th scope="col">수입 합계</th>
            <th scope="col">사용 합계</th>
            <th scope="col">남은 금액</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={styles.num}>{num(cash)}</td>
            <td className={styles.num}>{num(goods)}</td>
            <td className={styles.num}>
              <strong>{num(total)}</strong>
            </td>
            <td className={styles.num}>{num(used)}</td>
            <td className={styles.num}>
              <strong>{num(total - used)}</strong>
            </td>
          </tr>
        </tbody>
      </table>

      {sorted.map((d) => {
        const usage = donationUsage(d, entries);
        const remaining = d.amount - d.usedAmount;
        return (
          <section key={d.id} className={styles.slipPage} style={{ breakAfter: 'auto', breakInside: 'avoid' }}>
            <p className={styles.printSection}>
              {dotDate(d.receivedOn)} · {maskNames ? maskName(d.donorName) : d.donorName} ({DONOR_TYPE_LABEL[d.donorType]}) · {KIND_LABEL[d.kind]} {num(d.amount)}원
              {d.receiptNo ? ` · 영수증 ${d.receiptNo}` : ''}
            </p>
            <p className={styles.printNote}>
              {[d.goodsDescription, d.designatedPurpose !== null ? `지정 용도: ${d.designatedPurpose}` : '비지정 후원'].filter(Boolean).join(' · ')}
            </p>
            <table className={styles.sheetTable}>
              <thead>
                <tr>
                  <th scope="col">쓴 날짜</th>
                  <th scope="col">내용</th>
                  <th scope="col">계정</th>
                  <th scope="col" className={styles.num}>
                    금액(원)
                  </th>
                </tr>
              </thead>
              <tbody>
                {usage.entries.length === 0 && (
                  <tr>
                    <td colSpan={4}>연결된 지출이 없습니다</td>
                  </tr>
                )}
                {usage.entries.map((e) => (
                  <tr key={e.id}>
                    <td>{dotDate(e.entryDate)}</td>
                    <td>{e.description}</td>
                    <td>{accountLabel(e.direction, e.accountCode)}</td>
                    <td className={styles.num}>{num(e.amount)}</td>
                  </tr>
                ))}
                <tr>
                  <th scope="row" colSpan={3}>
                    사용 {num(d.usedAmount)}원 · 남은 금액
                  </th>
                  <td className={styles.num}>
                    <strong>{num(remaining)}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        );
      })}

      <p className={styles.printNote}>이 보고서는 케어브이 실험실의 기록으로 만든 참고 자료입니다. 후원금품 사용 결과 공개·보고 서식과 기한은 관할 기관 기준을 확인해 맞춰 주세요(대조 필요).</p>
      <div className={styles.printSign}>
        <span>작성자: ____________</span>
        <span>확인(시설장): ____________ (서명)</span>
      </div>
    </div>,
    host,
  );
}
