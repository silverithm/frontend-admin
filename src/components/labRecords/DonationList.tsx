'use client';

/**
 * 후원금 목록 — 받은 날짜·후원자·구분·금액·사용액·남은 금액. 이름은 기본으로 가리고(maskName) "이름 보이기"를 켜면 전체를 보여 준다.
 * 사용액은 서버가 계산한 usedAmount(연결된 지출의 합)이고, 어디에 썼는지는 불러온 장부의 연결된 지출(donationUsage)로 펼쳐 보인다.
 */
import { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Chip, SupportText } from '@/components/lab/LabUi';
import { dateLabel, dotDate } from '@/components/lab/labFormat';
import { accountLabel, donationUsage } from '@/lib/lab/ledgerRules';
import type { Donation, LedgerEntry } from '@/lib/lab/labTypes';
import { DONOR_TYPE_LABEL, KIND_LABEL } from './DonationDraft';
import { maskName, num } from './FinanceFormat';
import styles from './labRecords.module.css';

interface Props {
  donations: Donation[];
  /** 연결된 지출을 찾아볼 장부 줄 */
  entries: LedgerEntry[];
  showNames: boolean;
  isBusy: boolean;
  onEdit: (donation: Donation) => void;
  onDelete: (donation: Donation) => void;
}

export default function DonationList({ donations, entries, showNames, isBusy, onEdit, onDelete }: Props) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const toggle = (id: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (donations.length === 0) return <SupportText>이 해에 기록한 후원금이 없습니다. 위에서 받은 내용을 적고 저장하세요.</SupportText>;

  return (
    <div className={styles.tableScroll}>
      <table className={`${styles.table} ${styles.stackTable}`}>
        <thead>
          <tr>
            <th scope="col">받은 날짜</th>
            <th scope="col">후원자</th>
            <th scope="col">내용</th>
            <th scope="col" className={styles.num}>
              금액
            </th>
            <th scope="col" className={styles.num}>
              사용
            </th>
            <th scope="col" className={styles.num}>
              남은 금액
            </th>
            <th scope="col">작업</th>
          </tr>
        </thead>
        <tbody>
          {donations.map((d) => {
            const remaining = d.amount - d.usedAmount;
            const usage = donationUsage(d, entries);
            const isOpen = open.has(d.id);
            const detailGap = usage.used !== d.usedAmount;
            return [
              <tr key={d.id}>
                <td data-label="받은 날짜">{dateLabel(d.receivedOn)}</td>
                <td data-label="후원자" className={styles.payName}>
                  {showNames ? d.donorName : maskName(d.donorName)} <span className={styles.mutedText}>{DONOR_TYPE_LABEL[d.donorType]}</span>
                </td>
                <td data-label="내용" className={styles.payName}>
                  <Chip tone={d.kind === 'CASH' ? 'info' : 'neutral'} label={KIND_LABEL[d.kind]} /> {d.goodsDescription ?? ''}
                  {d.designatedPurpose !== null && (
                    <>
                      <br />
                      <span className={styles.mutedText}>지정: {d.designatedPurpose}</span>
                    </>
                  )}
                  {d.receiptNo && (
                    <>
                      <br />
                      <span className={styles.mutedText}>영수증 {d.receiptNo}</span>
                    </>
                  )}
                </td>
                <td className={styles.num} data-label="금액">
                  {num(d.amount)}
                </td>
                <td className={styles.num} data-label="사용">
                  {num(d.usedAmount)}
                </td>
                <td className={`${styles.num} ${remaining < 0 ? styles.dangerText : ''}`} data-label="남은 금액">
                  <strong>{num(remaining)}</strong>
                  {remaining < 0 && (
                    <>
                      {' '}
                      <Chip tone="danger" label="후원금보다 더 씀" />
                    </>
                  )}
                </td>
                <td data-label="작업">
                  <span className={styles.payActionRow}>
                    <Button label={isOpen ? '사용 내역 접기' : '사용 내역'} variant="ghost" size="sm" onClick={() => toggle(d.id)} />
                    <Button label="고치기" variant="ghost" size="sm" isDisabled={isBusy} onClick={() => onEdit(d)} />
                    <Button label="삭제" variant="ghost" size="sm" isDisabled={isBusy} onClick={() => onDelete(d)} />
                  </span>
                </td>
              </tr>,
              isOpen && (
                <tr key={`${d.id}-use`} className={styles.paySub}>
                  <td colSpan={7}>
                    {usage.entries.length === 0 ? (
                      <SupportText>연결된 지출이 없습니다. 회계 장부에서 지출을 적을 때 “후원금 연결”로 이 후원금을 고르면 여기에 나타납니다.</SupportText>
                    ) : (
                      <ul className={styles.noteList}>
                        {usage.entries.map((e) => (
                          <li key={e.id}>
                            {dotDate(e.entryDate)} · {e.description} · {accountLabel(e.direction, e.accountCode)} · {num(e.amount)}원
                          </li>
                        ))}
                      </ul>
                    )}
                    {detailGap && <SupportText tone="warn">서버가 센 사용액({num(d.usedAmount)}원)과 불러온 장부의 연결 지출({num(usage.used)}원)이 다릅니다. 연결된 지출 일부가 다른 해 장부에 있을 수 있습니다.</SupportText>}
                  </td>
                </tr>
              ),
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}
