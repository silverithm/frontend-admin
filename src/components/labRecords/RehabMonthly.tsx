'use client';

/** 기능회복훈련 월간 보기 — 어르신별 횟수·훈련한 날·분·종류. 인쇄하면 이 표만 A4로 나온다. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import { listRehabSessions } from '@/lib/lab/labApi';
import type { RehabSession } from '@/lib/lab/labTypes';
import { REHAB_KINDS, rehabMonthly } from '@/lib/lab/rehabRules';
import type { RehabMonthlyRow } from '@/lib/lab/rehabRules';
import { ErrorBanner, MonthStepper } from '@/components/lab/LabUi';
import { companyNameStored, dotDate, errorText, monthLabel, todayString } from '@/components/lab/labFormat';
import RecordsPrintPortal from './RecordsPrint';
import styles from './labRecords.module.css';

const kindsText = (row: RehabMonthlyRow): string =>
  REHAB_KINDS.filter((k) => row.byKind[k.value].count > 0)
    .map((k) => `${k.label} ${row.byKind[k.value].count}회 ${row.byKind[k.value].minutes.toLocaleString('ko-KR')}분`)
    .join(' · ');

export default function RehabMonthly({ month, onMonthChange }: { month: string; onMonthChange: (m: string) => void }) {
  const [sessions, setSessions] = useState<RehabSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const load = useCallback(async (target: string) => {
    const n = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const list = await listRehabSessions({ month: target });
      if (n === seq.current) setSessions(list);
    } catch (e) {
      if (n === seq.current) {
        setSessions([]);
        setError(errorText(e, '기능회복훈련 기록을 불러오지 못했습니다'));
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

  const rows = useMemo(() => rehabMonthly(sessions, month), [sessions, month]);
  const totals = useMemo(() => rows.reduce((a, r) => ({ sessions: a.sessions + r.sessions, minutes: a.minutes + r.minutes }), { sessions: 0, minutes: 0 }), [rows]);

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <MonthStepper value={month} onChange={onMonthChange} isDisabled={loading} />
        <Text type="supporting" color="secondary">
          {monthLabel(month)} {rows.length}명 · {totals.sessions.toLocaleString('ko-KR')}회 · {totals.minutes.toLocaleString('ko-KR')}분
        </Text>
        <div className={styles.spacer}>
          <Button label="월간 인쇄" variant="secondary" isDisabled={rows.length === 0} onClick={() => window.print()} />
        </div>
      </div>
      {error && <ErrorBanner message={error} onRetry={() => void load(month)} />}
      {loading && sessions.length === 0 ? (
        <Loading size="inline" label="기록을 불러오는 중..." />
      ) : rows.length === 0 && !error ? (
        <Card padding={6}>
          <EmptyState isCompact title={`${monthLabel(month)}에는 기능회복훈련 기록이 없습니다`} description="날짜별 보기에서 훈련을 기록하면 어르신별로 모아 보여 드립니다." />
        </Card>
      ) : (
        <Card padding={0}>
          <div className={styles.tableScroll}>
            <table className={`${styles.table} ${styles.stackTable}`}>
              <thead>
                <tr>
                  <th scope="col">어르신</th>
                  <th scope="col" className={styles.num}>횟수</th>
                  <th scope="col" className={styles.num}>훈련한 날</th>
                  <th scope="col" className={styles.num}>총 시간(분)</th>
                  <th scope="col">종류별</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.elderlyId}>
                    <td data-label="어르신">{r.elderlyName}</td>
                    <td className={styles.num} data-label="횟수">{r.sessions.toLocaleString('ko-KR')}회</td>
                    <td className={styles.num} data-label="훈련한 날">{r.days.toLocaleString('ko-KR')}일</td>
                    <td className={styles.num} data-label="총 시간">{r.minutes.toLocaleString('ko-KR')}분</td>
                    <td className={styles.wrap} data-label="종류별">{kindsText(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <RecordsPrintPortal>
        <h1 className={styles.printTitle}>{monthLabel(month)} 기능회복훈련 월간 요약</h1>
        <div className={styles.printMeta}>
          {companyNameStored() && <span>기관: {companyNameStored()}</span>}
          <span>
            {rows.length}명 · {totals.sessions.toLocaleString('ko-KR')}회 · {totals.minutes.toLocaleString('ko-KR')}분
          </span>
        </div>
        <table className={styles.sheetTable}>
          <thead>
            <tr>
              <th scope="col">어르신</th>
              <th scope="col">횟수</th>
              <th scope="col">훈련한 날</th>
              <th scope="col">총 시간(분)</th>
              <th scope="col">종류별</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.elderlyId}>
                <td>{r.elderlyName}</td>
                <td>{r.sessions}회</td>
                <td>{r.days}일</td>
                <td>{r.minutes.toLocaleString('ko-KR')}분</td>
                <td>{kindsText(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className={styles.printNote}>이 출력본은 케어브이 실험실에서 만든 참고용입니다. 출력일 {dotDate(todayString())}</p>
      </RecordsPrintPortal>
    </div>
  );
}
