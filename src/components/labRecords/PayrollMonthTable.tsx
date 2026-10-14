'use client';

/**
 * 월 급여대장 입력 표 — 직원마다 한 줄. 시간 다섯 칸을 Tab으로 오가고, Enter(Shift+Enter)는 같은 칸의 아래(위) 직원으로 옮긴다.
 * 입력하면 줄 끝의 총지급·공제·실지급이 바로 다시 계산된다. 확정된 줄은 잠금 표시와 함께 입력이 막힌다.
 * 좁은 화면(≤640px)에서는 직원 한 명이 카드 한 장으로 쌓인다.
 */
import type { KeyboardEvent } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Chip, ErrorBanner, SupportText } from '@/components/lab/LabUi';
import type { Tone } from '@/components/lab/LabUi';
import { HOUR_FIELDS, deductionTotal, jobLabel } from './PayrollDraft';
import type { AllowDraft, DeductDraft, HourKey, MonthRow, RowStatus } from './PayrollDraft';
import PayrollRowDetail from './PayrollRowDetail';
import { sanitizeDecimal } from './recordsFormat';
import { num } from './FinanceFormat';
import styles from './labRecords.module.css';

const STATUS: Record<RowStatus, { tone: Tone; label: string }> = {
  locked: { tone: 'ok', label: '확정 · 잠김' },
  orphan: { tone: 'neutral', label: '기준 없음' },
  invalid: { tone: 'danger', label: '입력 확인' },
  new: { tone: 'warn', label: '저장 전' },
  edited: { tone: 'warn', label: '바뀜' },
  saved: { tone: 'info', label: '저장됨' },
};

interface Props {
  rows: MonthRow[];
  expanded: ReadonlySet<number>;
  isBusy: boolean;
  rowErrors: Readonly<Record<number, string | undefined>>;
  onHour: (memberId: number, key: HourKey, text: string) => void;
  onAllowances: (memberId: number, next: AllowDraft[]) => void;
  onDeductions: (memberId: number, next: DeductDraft[]) => void;
  onToggle: (memberId: number) => void;
  onPrint: (row: MonthRow) => void;
  onSaveRow: (row: MonthRow) => void;
}

/** Enter로 같은 칸의 다음(Shift면 이전) 직원 입력칸으로 옮긴다 */
function moveWithEnter(e: KeyboardEvent<HTMLTableSectionElement>) {
  if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
  const input = e.target;
  if (!(input instanceof HTMLInputElement)) return;
  const cell = input.closest('td[data-col]');
  const rowEl = input.closest('tr[data-main]');
  const col = cell?.getAttribute('data-col');
  if (!cell || !rowEl || !col) return;
  e.preventDefault();
  let next = e.shiftKey ? rowEl.previousElementSibling : rowEl.nextElementSibling;
  while (next) {
    if (next.hasAttribute('data-main')) {
      const target = next.querySelector<HTMLInputElement>(`td[data-col="${col}"] input:not([disabled])`);
      if (target) {
        target.focus();
        target.select();
        return;
      }
    }
    next = e.shiftKey ? next.previousElementSibling : next.nextElementSibling;
  }
}

export default function PayrollMonthTable({ rows, expanded, isBusy, rowErrors, onHour, onAllowances, onDeductions, onToggle, onPrint, onSaveRow }: Props) {
  return (
    <div className={styles.tableScroll}>
      <table className={`${styles.table} ${styles.payTable}`}>
        <thead>
          <tr>
            <th scope="col" className={styles.stickyName}>
              직원
            </th>
            {HOUR_FIELDS.map((f) => (
              <th key={f.key} scope="col" className={styles.num}>
                {f.label}
                <span className={styles.mutedText}> (시간)</span>
              </th>
            ))}
            <th scope="col" className={styles.num}>
              총지급
            </th>
            <th scope="col" className={styles.num}>
              공제
            </th>
            <th scope="col" className={styles.num}>
              실지급
            </th>
            <th scope="col">상태·작업</th>
          </tr>
        </thead>
        <tbody onKeyDown={moveWithEnter}>
          {rows.map((r) => {
            const readOnly = r.status === 'locked' || r.status === 'orphan';
            const st = STATUS[r.status];
            const open = expanded.has(r.memberId);
            const extraCount = r.draft.allowances.length + r.draft.deductions.length;
            const notes = [r.wageIssue, ...(r.status === 'invalid' && r.calc ? r.calc.issues : [])].filter((m): m is string => !!m);
            const rowError = rowErrors[r.memberId];
            return [
              <tr key={`m${r.memberId}`} data-main="">
                <td className={`${styles.stickyName} ${styles.payName}`} data-label="직원">
                  <strong>{r.name}</strong>
                  <br />
                  <span className={styles.mutedText}>{r.profile ? `${jobLabel(r.profile.jobType)} · ${r.profile.payType === 'HOURLY' ? '시급제' : '월급제'}` : '급여 기준 없음'}</span>
                </td>
                {HOUR_FIELDS.map((f) => (
                  <td key={f.key} data-col={f.key} data-label={`${f.label} 시간`} className={styles.payHour}>
                    <TextInput
                      label={`${r.name} ${f.label} 시간`}
                      isLabelHidden
                      size="sm"
                      width={72}
                      placeholder="0"
                      value={r.draft[f.key]}
                      onChange={(v) => onHour(r.memberId, f.key, sanitizeDecimal(v, 1))}
                      isDisabled={readOnly || isBusy}
                    />
                  </td>
                ))}
                <td className={styles.num} data-label="총지급">
                  {num(r.amounts.grossPay)}
                </td>
                <td className={styles.num} data-label="공제">
                  {num(deductionTotal(r.amounts))}
                </td>
                <td className={`${styles.num} ${r.amounts.netPay < 0 ? styles.dangerText : ''}`} data-label="실지급">
                  <strong>{num(r.amounts.netPay)}</strong>
                </td>
                <td data-label="상태·작업" className={styles.payActions}>
                  <span className={styles.payActionRow}>
                    <Chip tone={st.tone} label={st.label} />
                  </span>
                  <span className={styles.payActionRow}>
                    <Button label={open ? '접기' : `수당·공제${extraCount > 0 ? ` ${extraCount}` : ''}`} variant="ghost" size="sm" onClick={() => onToggle(r.memberId)} />
                    <Button label="명세서" variant="ghost" size="sm" isDisabled={r.status === 'invalid' || r.status === 'orphan' || isBusy} onClick={() => onPrint(r)} />
                    {(r.status === 'new' || r.status === 'edited') && <Button label="이 줄 저장" variant="secondary" size="sm" isDisabled={isBusy} onClick={() => onSaveRow(r)} />}
                  </span>
                </td>
              </tr>,
              notes.length > 0 || rowError || open ? (
                <tr key={`s${r.memberId}`} className={styles.paySub}>
                  <td colSpan={10}>
                    {notes.map((m) => (
                      <div key={m}>
                        <SupportText tone="warn">{m}</SupportText>
                      </div>
                    ))}
                    {rowError && <ErrorBanner message={`${r.name}: ${rowError}`} />}
                    {open && <PayrollRowDetail row={r} readOnly={readOnly || isBusy} onAllowances={(n) => onAllowances(r.memberId, n)} onDeductions={(n) => onDeductions(r.memberId, n)} />}
                  </td>
                </tr>
              ) : null,
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}
