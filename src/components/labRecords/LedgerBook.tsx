'use client';

/** 현금출납부 표 — 전월 이월 잔액, 줄마다 수입·지출·잔액, 달 합계. 줄에서 고치기·삭제를 한다. */
import { Button } from '@astryxdesign/core/Button';
import { AiChip, Chip, SupportText } from '@/components/lab/LabUi';
import { dateLabel } from '@/components/lab/labFormat';
import { accountLabel } from '@/lib/lab/ledgerRules';
import type { CashBookRow, CashBookTotals } from '@/lib/lab/ledgerRules';
import type { LedgerEntry } from '@/lib/lab/labTypes';
import { DIRECTION_LABEL, EVIDENCE_LABEL } from './LedgerDraft';
import { num } from './FinanceFormat';
import styles from './labRecords.module.css';

interface Props {
  rows: CashBookRow[];
  totals: CashBookTotals;
  entryById: ReadonlyMap<number, LedgerEntry>;
  isBusy: boolean;
  onEdit: (entry: LedgerEntry) => void;
  onDelete: (entry: LedgerEntry) => void;
}

export default function LedgerBook({ rows, totals, entryById, isBusy, onEdit, onDelete }: Props) {
  return (
    <div className={styles.tableScroll}>
      <table className={`${styles.table} ${styles.stackTable}`}>
        <thead>
          <tr>
            <th scope="col">날짜</th>
            <th scope="col">계정</th>
            <th scope="col">적요</th>
            <th scope="col" className={styles.num}>
              수입
            </th>
            <th scope="col" className={styles.num}>
              지출
            </th>
            <th scope="col" className={styles.num}>
              잔액
            </th>
            <th scope="col">작업</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td data-label="날짜" colSpan={2} className={styles.mutedText}>
              전월 이월
            </td>
            <td data-label="적요" className={styles.mutedText}>
              이월 잔액
            </td>
            <td className={styles.num} />
            <td className={styles.num} />
            <td className={styles.num} data-label="잔액">
              <strong>{num(totals.opening)}</strong>
            </td>
            <td />
          </tr>
          {rows.length === 0 && (
            <tr>
              <td colSpan={7}>
                <SupportText>이 달에 기록한 장부 줄이 없습니다. 위에서 날짜·계정·금액을 적고 저장하세요.</SupportText>
              </td>
            </tr>
          )}
          {rows.map((row, i) => {
            const entry = row.id === null ? undefined : entryById.get(row.id);
            return (
              <tr key={row.id ?? `r${i}`}>
                <td data-label="날짜">{dateLabel(row.entryDate)}</td>
                <td data-label="계정" className={styles.wrap}>
                  <Chip tone={row.direction === 'INCOME' ? 'info' : 'neutral'} label={DIRECTION_LABEL[row.direction]} /> {accountLabel(row.direction, row.accountCode)}
                </td>
                <td data-label="적요" className={styles.payName}>
                  {row.description}
                  {entry && (entry.counterparty || entry.evidenceType || entry.donationId !== null || entry.aiAssisted) && (
                    <>
                      <br />
                      <span className={styles.mutedText}>
                        {[entry.counterparty, entry.evidenceType ? EVIDENCE_LABEL[entry.evidenceType] : null, entry.donationId !== null ? '후원금 연결' : null].filter(Boolean).join(' · ')}
                      </span>{' '}
                      {entry.aiAssisted && <AiChip label="AI 제안 계정" />}
                    </>
                  )}
                </td>
                <td className={styles.num} data-label="수입">
                  {row.income > 0 ? num(row.income) : ''}
                </td>
                <td className={styles.num} data-label="지출">
                  {row.expense > 0 ? num(row.expense) : ''}
                </td>
                <td className={`${styles.num} ${row.balance < 0 ? styles.dangerText : ''}`} data-label="잔액">
                  {num(row.balance)}
                </td>
                <td data-label="작업">
                  {entry && (
                    <span className={styles.payActionRow}>
                      <Button label="고치기" variant="ghost" size="sm" isDisabled={isBusy} onClick={() => onEdit(entry)} />
                      <Button label="삭제" variant="ghost" size="sm" isDisabled={isBusy} onClick={() => onDelete(entry)} />
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
          <tr>
            <th scope="row" colSpan={3}>
              달 합계
            </th>
            <td className={styles.num} data-label="수입 합계">
              <strong>{num(totals.income)}</strong>
            </td>
            <td className={styles.num} data-label="지출 합계">
              <strong>{num(totals.expense)}</strong>
            </td>
            <td className={`${styles.num} ${totals.closing < 0 ? styles.dangerText : ''}`} data-label="달 말 잔액">
              <strong>{num(totals.closing)}</strong>
            </td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
