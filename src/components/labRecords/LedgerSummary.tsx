'use client';

/**
 * 연간 요약 — 관·항·목별 월별 합계(세입·세출)와 월별 수입 − 지출. 합계가 0인 계정은 접어 두고 "0원 계정 보기"로 펼친다.
 * 계산은 ledgerSummary가 하고, 이 화면은 보여 주기와 CSV 내려받기만 한다.
 */
import { useMemo, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Chip, SupportText } from '@/components/lab/LabUi';
import { ledgerSummary } from '@/lib/lab/ledgerRules';
import type { DirectionSummary } from '@/lib/lab/ledgerRules';
import type { LedgerEntry } from '@/lib/lab/labTypes';
import { summaryCsv } from './LedgerCsv';
import { downloadCsv, num } from './FinanceFormat';
import styles from './labRecords.module.css';

interface Props {
  year: number;
  entries: LedgerEntry[];
}

const MONTH_HEADS = Array.from({ length: 12 }, (_, i) => `${i + 1}월`);

function MonthCells({ months, total, strong }: { months: number[]; total: number; strong?: boolean }) {
  const cell = (v: number) => (v === 0 ? '' : strong ? <strong>{num(v)}</strong> : num(v));
  return (
    <>
      {months.map((v, i) => (
        <td key={MONTH_HEADS[i]} className={`${styles.num} ${v < 0 ? styles.dangerText : ''}`}>
          {cell(v)}
        </td>
      ))}
      <td className={`${styles.num} ${total < 0 ? styles.dangerText : ''}`}>
        <strong>{num(total)}</strong>
      </td>
    </>
  );
}

function SideRows({ title, side, showZero }: { title: string; side: DirectionSummary; showZero: boolean }) {
  return (
    <>
      <tr>
        <th scope="row" colSpan={14}>
          {title}
        </th>
      </tr>
      {side.groups.map((g) => {
        if (g.total === 0 && !showZero) return null;
        return [
          <tr key={`g${g.code}`}>
            <th scope="row">
              {g.code}관 {g.name}
            </th>
            <MonthCells months={g.months} total={g.total} strong />
          </tr>,
          ...g.sections.flatMap((s) => {
            if (s.total === 0 && !showZero) return [];
            return [
              <tr key={`s${g.code}${s.code}`}>
                <td className={styles.sumSection}>
                  {s.code}항 {s.name}
                </td>
                <MonthCells months={s.months} total={s.total} />
              </tr>,
              ...s.accounts
                .filter((a) => a.total !== 0 || showZero)
                .map((a) => (
                  <tr key={`a${g.code}${s.code}${a.code}`}>
                    <td className={styles.sumAccount}>
                      {a.code} {a.name}
                      {a.unknown && ' '}
                      {a.unknown && <Chip tone="warn" label="목록에 없음" />}
                    </td>
                    <MonthCells months={a.months} total={a.total} />
                  </tr>
                )),
            ];
          }),
        ];
      })}
      <tr>
        <th scope="row">{title} 합계</th>
        <MonthCells months={side.months} total={side.total} strong />
      </tr>
    </>
  );
}

export default function LedgerSummary({ year, entries }: Props) {
  const [showZero, setShowZero] = useState(false);
  const summary = useMemo(() => ledgerSummary(entries, year), [entries, year]);
  const empty = summary.income.total === 0 && summary.expense.total === 0;

  return (
    <div className={styles.stackTight}>
      <HStack gap={2} vAlign="center" wrap="wrap">
        <Text type="label">{year}년 관·항·목별 합계</Text>
        <Chip tone={summary.net < 0 ? 'danger' : 'ok'} label={`수입 − 지출 ${num(summary.net)}원`} />
        <span className={styles.spacer} />
        <CheckboxInput label="0원 계정도 보기" value={showZero} onChange={setShowZero} />
        <Button label="CSV 내려받기" variant="secondary" isDisabled={empty} onClick={() => downloadCsv(`장부_연간요약_${year}.csv`, summaryCsv(summary))} />
      </HStack>
      {empty ? (
        <SupportText>{year}년에 기록한 장부 줄이 없습니다.</SupportText>
      ) : (
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">과목</th>
                {MONTH_HEADS.map((m) => (
                  <th key={m} scope="col" className={styles.num}>
                    {m}
                  </th>
                ))}
                <th scope="col" className={styles.num}>
                  합계
                </th>
              </tr>
            </thead>
            <tbody>
              <SideRows title="세입" side={summary.income} showZero={showZero} />
              <SideRows title="세출" side={summary.expense} showZero={showZero} />
              <tr>
                <th scope="row">수입 − 지출</th>
                <MonthCells months={summary.netByMonth} total={summary.net} strong />
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <SupportText>금액은 원 단위입니다. 세입과 세출은 코드가 같아도 다른 과목입니다(세입 111 적립금 / 세출 111 급여).</SupportText>
    </div>
  );
}
