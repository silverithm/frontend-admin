'use client';

/**
 * 오늘 투약 — 그날 출석한 어르신의 투약의뢰서에서 시간대별로 먹일 약을 보여 주고, 투약함·건너뜀·거부를 기록한다.
 * 출결을 읽지 못하거나 그날 출결 기록이 없으면 의뢰가 있는 모든 어르신을 보여 주고 그렇게 알린다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Switch } from '@astryxdesign/core/Switch';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import { listMedicationDoses } from '@/lib/lab/labApi';
import type { MedicationDose, MedicationRequest } from '@/lib/lab/labTypes';
import { SIX_RIGHTS, dosesDue, doseStatus } from '@/lib/lab/medicationRules';
import { addDays } from '@/lib/lab/programRules';
import { Chip, ErrorBanner, LabDateInput } from '@/components/lab/LabUi';
import { dateLabel, errorText, todayString } from '@/components/lab/labFormat';
import MedicationDoseRow from './MedicationDoseRow';
import type { DueRow } from './MedicationDoseRow';
import { useElderAttendance } from './useElderAttendance';
import styles from './labRecords.module.css';
import own from './MedicationBath.module.css';

interface Props {
  requests: MedicationRequest[];
  requestsLoading: boolean;
}

export default function MedicationToday({ requests, requestsLoading }: Props) {
  const [date, setDate] = useState(todayString);
  const [doses, setDoses] = useState<MedicationDose[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAbsent, setShowAbsent] = useState(false);
  const attendance = useElderAttendance(date);
  const seq = useRef(0);
  const today = todayString();

  const load = useCallback(async (target: string) => {
    const n = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const list = await listMedicationDoses({ date: target });
      if (n === seq.current) setDoses(list);
    } catch (e) {
      if (n === seq.current) {
        setDoses([]);
        setError(errorText(e, '투약 기록을 불러오지 못했습니다'));
      }
    } finally {
      if (n === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(date);
    return () => {
      seq.current += 1;
    };
  }, [date, load]);

  const attendanceKnown = attendance.hasData && !attendance.error;
  const presentIds = useMemo(() => (attendanceKnown && !showAbsent ? [...attendance.present] : undefined), [attendanceKnown, showAbsent, attendance.present]);
  const rows: DueRow[] = useMemo(() => doseStatus(dosesDue(requests, date, presentIds), doses), [requests, date, presentIds, doses]);
  const names = useMemo(() => new Map(requests.map((r) => [r.elderlyId, r.elderlyName])), [requests]);
  const count = (s: DueRow['state']) => rows.filter((r) => r.state === s).length;

  const groups = useMemo(() => {
    const out: Array<{ elderlyId: number; rows: DueRow[] }> = [];
    for (const r of rows) {
      const last = out[out.length - 1];
      if (last && last.elderlyId === r.elderlyId) last.rows.push(r);
      else out.push({ elderlyId: r.elderlyId, rows: [r] });
    }
    return out;
  }, [rows]);

  const shift = (days: number) => {
    const next = addDays(date, days);
    if (next && next <= today) setDate(next);
  };

  const upsertDose = (saved: MedicationDose) =>
    setDoses((prev) => [...prev.filter((d) => !(d.requestId === saved.requestId && d.givenOn.slice(0, 10) === saved.givenOn.slice(0, 10) && d.slot === saved.slot)), saved]);
  const dropDose = (gone: MedicationDose) => setDoses((prev) => prev.filter((d) => d.id !== gone.id));

  const busy = requestsLoading || loading || attendance.isLoading;

  return (
    <div className={styles.stack}>
      <details className={own.details}>
        <summary>투약 6원칙 (먹이기 전에 확인)</summary>
        <ol>
          {SIX_RIGHTS.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </details>

      <div className={styles.toolbar}>
        <div className={styles.toolbarGrow} style={{ maxWidth: 220 }}>
          <LabDateInput label="투약 날짜" value={date} onChange={(v) => v && v <= today && setDate(v)} max={today} />
        </div>
        <Button label="전날" variant="ghost" onClick={() => shift(-1)} />
        <Button label="다음 날" variant="ghost" isDisabled={date >= today} onClick={() => shift(1)} />
        <Button label="오늘로" variant="ghost" isDisabled={date === today} onClick={() => setDate(today)} />
        {attendanceKnown && (
          <div className={styles.spacer}>
            <Switch label="출석하지 않은 분도 보기" value={showAbsent} onChange={setShowAbsent} />
          </div>
        )}
      </div>

      <div className={styles.chips} style={{ justifyContent: 'flex-start' }}>
        <Text type="supporting" color="secondary">
          {dateLabel(date)}
        </Text>
        <Chip tone={count('PENDING') > 0 ? 'warn' : 'ok'} label={`${date < today ? '기록 없음' : '대기'} ${count('PENDING')}건`} />
        <Chip tone="ok" label={`투약함 ${count('DONE')}건`} />
        {count('SKIPPED') + count('REFUSED') > 0 && <Chip tone="neutral" label={`건너뜀·거부 ${count('SKIPPED') + count('REFUSED')}건`} />}
      </div>

      {!attendance.isLoading && (attendance.error || !attendance.hasData) && (
        <div className={own.warnBlock}>
          {attendance.error ?? '그날 출결 기록이 없어 의뢰가 있는 모든 어르신을 보여 드립니다.'}
        </div>
      )}
      {error && <ErrorBanner message={error} onRetry={() => void load(date)} />}

      {busy && rows.length === 0 ? (
        <Loading size="inline" label="투약 목록을 불러오는 중..." />
      ) : rows.length === 0 && !error ? (
        <Card padding={6}>
          <EmptyState
            isCompact
            title={`${dateLabel(date)}에 먹일 약이 없습니다`}
            description={attendanceKnown && !showAbsent ? '출석한 어르신 중 진행 중인 투약의뢰서가 없습니다. "투약의뢰서" 보기에서 보호자가 맡긴 약을 등록해 주세요.' : '진행 중인 투약의뢰서가 없습니다. "투약의뢰서" 보기에서 보호자가 맡긴 약을 등록해 주세요.'}
          />
        </Card>
      ) : (
        <Card padding={0}>
          {groups.map((g) => (
            <section key={g.elderlyId} aria-label={`${names.get(g.elderlyId) ?? '어르신'} 투약`}>
              <div className={own.groupHead}>
                {names.get(g.elderlyId) ?? '어르신'}
                {attendanceKnown && !attendance.present.has(g.elderlyId) && <span className={styles.mutedText}> · 이날 출석 기록 없음</span>}
              </div>
              <div role="list">
                {g.rows.map((r) => (
                  <MedicationDoseRow key={`${r.requestId}-${r.slot}-${date}`} row={r} isPast={date < today} onSaved={upsertDose} onDeleted={dropDose} />
                ))}
              </div>
            </section>
          ))}
        </Card>
      )}
    </div>
  );
}
