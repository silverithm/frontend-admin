'use client';

/** 분기 점검 현황 — 올해 1~4분기에 점검을 했는지(지난 분기 빠짐은 빨갛게), 점검 기록하기, 점검표 인쇄. */
import { useMemo, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import type { MedicineCheck, MedicineStock } from '@/lib/lab/labTypes';
import { quarterChecks } from '@/lib/lab/medicationRules';
import { Chip, ErrorBanner } from '@/components/lab/LabUi';
import { dotDate, todayString } from '@/components/lab/labFormat';
import MedicationCheckForm from './MedicationCheckForm';
import MedicationCheckSheet, { sheetRow } from './MedicationCheckSheet';
import type { CheckSheetData } from './MedicationCheckSheet';
import { usePrintJob } from './MedicationPrintJob';
import { YearStepper } from './RecordsUi';
import styles from './labRecords.module.css';
import own from './MedicationBath.module.css';

interface Props {
  stock: MedicineStock[];
  checks: MedicineCheck[];
  year: number;
  onYearChange: (year: number) => void;
  loading: boolean;
  error: string | null;
  onReload: () => void;
  /** 점검 저장 뒤 — 폐기 표시가 대장에 반영되므로 대장도 다시 읽는다 */
  onSaved: () => void;
}

/** 그 분기의 점검 기본 날짜 — 오늘이 그 분기면 오늘, 아니면 그 분기 마지막 날 */
function quarterDate(year: number, quarter: number, today: string): string {
  if (today.slice(0, 4) === String(year) && Math.floor((Number(today.slice(5, 7)) - 1) / 3) + 1 === quarter) return today;
  const month = quarter * 3;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const date = `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
  return date > today ? today : date;
}

export default function MedicationChecks({ stock, checks, year, onYearChange, loading, error, onReload, onSaved }: Props) {
  const today = todayString();
  const thisYear = Number(today.slice(0, 4));
  const currentQuarter = Math.floor((Number(today.slice(5, 7)) - 1) / 3) + 1;
  const [formDate, setFormDate] = useState<string | null>(null);
  const [printing, print] = usePrintJob<CheckSheetData>();
  const quarters = useMemo(() => quarterChecks(checks, year), [checks, year]);
  const byId = useMemo(() => new Map(stock.map((s) => [s.id, s])), [stock]);
  const missed = quarters.filter((q) => !q.done && (year < thisYear || (year === thisYear && q.quarter < currentQuarter))).length;

  const sheetOf = (check: MedicineCheck): CheckSheetData => ({
    checkedOn: check.checkedOn.slice(0, 10),
    inspector: check.inspectorName,
    cabinetLocked: check.cabinetLocked,
    fridgeLocked: check.fridgeLocked,
    rows: check.items.map((it) => sheetRow(byId.get(it.stockId), it, check.checkedOn.slice(0, 10))),
    note: check.note ?? '',
  });

  if (formDate !== null) {
    return (
      <>
        <MedicationCheckForm key={formDate} stock={stock} checks={checks} initialDate={formDate} onSaved={onSaved} onClose={() => setFormDate(null)} onPrint={print} />
        {printing && <MedicationCheckSheet data={printing} />}
      </>
    );
  }

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <Text type="large" weight="semibold">
          분기 점검
        </Text>
        <YearStepper value={year} onChange={onYearChange} isDisabled={loading} max={thisYear} />
        {missed > 0 && <Chip tone="danger" label={`지난 분기 ${missed}번 빠짐`} />}
        <div className={styles.spacer}>
          <Button label="점검 기록하기" variant="primary" isDisabled={loading} onClick={() => setFormDate(today)} />
        </div>
      </div>
      <Text type="supporting" color="secondary">
        2026 평가 기준: 약품보관함은 잠가 두고(냉장고에 두면 냉장고도 잠금), 일반의약품의 사용기한과 보관 상태를 분기에 1회 이상 점검해 일자·약품명·효능·사용기한·점검자명·폐기일자를 남깁니다. 사용기한이 지난 약을 보관하면 인정되지 않습니다. (공고 원문 대조 필요)
      </Text>
      {error && <ErrorBanner message={error} onRetry={onReload} />}
      {loading && checks.length === 0 ? (
        <Loading size="inline" label="점검 기록을 불러오는 중..." />
      ) : (
        <div className={own.quarterGrid}>
          {quarters.map((q) => {
            const late = !q.done && (year < thisYear || (year === thisYear && q.quarter < currentQuarter));
            const started = year < thisYear || (year === thisYear && q.quarter <= currentQuarter);
            const check = q.checkedOn ? checks.find((c) => c.checkedOn.slice(0, 10) === q.checkedOn) : undefined;
            return (
              <Card padding={0} key={q.quarter}>
                <div className={`${own.quarterCell} ${late ? own.quarterLate : ''}`} style={{ border: 0 }}>
                  <Text type="label">{q.quarter}분기</Text>
                  <span className={styles.chips} style={{ justifyContent: 'flex-start' }}>
                    {q.done ? <Chip tone={q.lockedOk ? 'ok' : 'warn'} label={q.lockedOk ? '점검함' : '잠금 확인 안 됨'} /> : late ? <Chip tone="danger" label="지난 분기 빠짐" /> : <Chip tone="neutral" label={started ? '점검 전' : '아직 아님'} />}
                  </span>
                  <Text type="supporting" color="secondary">
                    {q.checkedOn ? `${dotDate(q.checkedOn)} 점검` : '점검 기록 없음'}
                  </Text>
                  <div className={own.doseActions}>
                    {q.done && q.checkedOn && <Button label={`${q.quarter}분기 점검 보기`} variant="secondary" isDisabled={loading} onClick={() => setFormDate(q.checkedOn)} />}
                    {check && <Button label={`${q.quarter}분기 점검표 인쇄`} variant="ghost" onClick={() => print(sheetOf(check))} />}
                    {!q.done && started && <Button label={`${q.quarter}분기 점검하기`} variant="secondary" isDisabled={loading} onClick={() => setFormDate(quarterDate(year, q.quarter, today))} />}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {printing && <MedicationCheckSheet data={printing} />}
    </div>
  );
}
