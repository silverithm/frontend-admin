'use client';

/**
 * 목욕 일지 월간 보기 — 어르신별 횟수와 목욕 가산(수급자당 주 1회 3,000원, 수급자 부담 없음), 어르신별 월 제공 일지 인쇄.
 * 달 경계에 걸친 주는 이웃 달에도 잡힐 수 있어 "달 경계 주 — 대조 필요"로 표시한다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import { listBathLogs, listElderContracts } from '@/lib/lab/labApi';
import type { BathLog, ElderContract } from '@/lib/lab/labTypes';
import { BATH_BONUS_PER_WEEK, bathBonus, bathBonusTotal, weekCrossesMonth } from '@/lib/lab/bathRules';
import { addDays } from '@/lib/lab/programRules';
import { Chip, ErrorBanner, MonthStepper, useNotify } from '@/components/lab/LabUi';
import { errorText, monthLabel } from '@/components/lab/labFormat';
import BathMonthSheet from './BathMonthSheet';
import type { BathSheetData } from './BathMonthSheet';
import { shortDate } from './BathDraft';
import { useBathPrintJob } from './BathPrintJob';
import styles from './labRecords.module.css';
import own from './MedicationBath.module.css';

const gradeText = (grade: ElderContract['careGrade']): string => (grade === 'cognitive' ? '인지지원등급' : `${grade}등급`);

interface Props {
  month: string;
  onMonthChange: (month: string) => void;
}

export default function BathMonthly({ month, onMonthChange }: Props) {
  const notify = useNotify();
  const [logs, setLogs] = useState<BathLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState<number | null>(null);
  const [printing, print] = useBathPrintJob<BathSheetData>();
  const seq = useRef(0);

  const load = useCallback(async (target: string) => {
    const n = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const list = await listBathLogs({ month: target });
      if (n === seq.current) setLogs(list);
    } catch (e) {
      if (n === seq.current) {
        setLogs([]);
        setError(errorText(e, '목욕 일지를 불러오지 못했습니다'));
      }
    } finally {
      if (n === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(month);
    return () => {
      seq.current += 1;
    };
  }, [month, load]);

  const rows = useMemo(() => {
    const bonus = new Map(bathBonus(logs, month).map((b) => [b.elderlyId, b]));
    const byElder = new Map<number, BathLog[]>();
    for (const l of logs) {
      if (l.bathDate.slice(0, 7) !== month) continue;
      byElder.set(l.elderlyId, [...(byElder.get(l.elderlyId) ?? []), l]);
    }
    return [...byElder.entries()]
      .map(([elderlyId, list]) => ({
        elderlyId,
        name: list[0].elderlyName,
        logs: list.sort((a, b) => a.bathDate.localeCompare(b.bathDate) || a.startTime.localeCompare(b.startTime)),
        bonus: bonus.get(elderlyId) ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [logs, month]);

  const total = bathBonusTotal(rows.flatMap((r) => (r.bonus ? [r.bonus] : [])));
  const anySplit = rows.some((r) => r.bonus?.splitWeek);

  const preparePrint = async (row: (typeof rows)[number]) => {
    if (preparing !== null) return;
    setPreparing(row.elderlyId);
    let contract: ElderContract | null = null;
    try {
      const list = await listElderContracts({ status: 'ACTIVE' });
      contract = list.find((c) => c.elderlyId === row.elderlyId) ?? null;
    } catch {
      notify('계약 정보를 읽지 못해 등급·인정번호는 빈칸으로 인쇄합니다', 'info');
    } finally {
      setPreparing(null);
    }
    print({ elderName: row.name, month, gradeText: contract ? gradeText(contract.careGrade) : '', recognitionNo: contract?.recognitionNo ?? '', logs: row.logs });
  };

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <MonthStepper value={month} onChange={onMonthChange} isDisabled={loading} />
        <Text type="supporting" color="secondary">
          {monthLabel(month)} {rows.length}명 · 가산 {total.toLocaleString('ko-KR')}원
        </Text>
      </div>
      <Text type="supporting" color="secondary">
        목욕 가산은 수급자당 주 1회(월~일) {BATH_BONUS_PER_WEEK.toLocaleString('ko-KR')}원이고 수급자 부담은 없습니다(고시 제35조 — 대조 필요). 한 주에 여러 번 해도 한 번만 셉니다.
      </Text>
      {anySplit && <div className={own.warnBlock}>달 경계에 걸친 주가 있습니다. 그 주가 이웃 달에도 잡힐 수 있으니 청구 전에 대조해 주세요.</div>}
      {error && <ErrorBanner message={error} onRetry={() => void load(month)} />}

      {loading && logs.length === 0 ? (
        <Loading size="inline" label="목욕 일지를 불러오는 중..." />
      ) : rows.length === 0 && !error ? (
        <Card padding={6}>
          <EmptyState isCompact title={`${monthLabel(month)}에는 목욕 일지가 없습니다`} description="날짜별 보기에서 목욕을 기록하면 어르신별 가산 주와 금액을 계산해 드립니다." />
        </Card>
      ) : (
        <Card padding={0}>
          <div className={styles.tableScroll}>
            <table className={`${styles.table} ${styles.stackTable}`}>
              <thead>
                <tr>
                  <th scope="col">어르신</th>
                  <th scope="col" className={styles.num}>목욕 횟수</th>
                  <th scope="col">가산 주</th>
                  <th scope="col" className={styles.num}>가산 금액</th>
                  <th scope="col">
                    <span className={styles.srOnly}>인쇄</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.elderlyId}>
                    <td data-label="어르신">{r.name}</td>
                    <td className={styles.num} data-label="목욕 횟수">
                      {r.logs.length.toLocaleString('ko-KR')}회
                    </td>
                    <td className={styles.wrap} data-label="가산 주">
                      {r.bonus ? (
                        <span className={styles.chips} style={{ justifyContent: 'flex-start' }}>
                          {r.bonus.weeks.map((w) => {
                            const sunday = addDays(w, 6) ?? w;
                            return <Chip key={w} tone={weekCrossesMonth(w) ? 'warn' : 'neutral'} label={`${shortDate(w)}~${shortDate(sunday)}`} />;
                          })}
                          {r.bonus.splitWeek && <Chip tone="warn" label="달 경계 주 — 대조 필요" />}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className={styles.num} data-label="가산 금액">
                      {r.bonus ? `${r.bonus.weeks.length}주 × ${BATH_BONUS_PER_WEEK.toLocaleString('ko-KR')} = ${r.bonus.amount.toLocaleString('ko-KR')}원` : '-'}
                    </td>
                    <td>
                      <Button label={`${r.name} 제공 일지 인쇄`} variant="secondary" isLoading={preparing === r.elderlyId} isDisabled={preparing !== null} onClick={() => void preparePrint(r)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {printing && <BathMonthSheet data={printing} />}
    </div>
  );
}
