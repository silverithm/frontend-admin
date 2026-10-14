'use client';

/** 목욕 일지 날짜별 보기 — 그날 목록, 새 기록·고치기, 그 주에 아직 목욕을 안 한 출석 어르신. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import { listBathLogs } from '@/lib/lab/labApi';
import type { BathLog } from '@/lib/lab/labTypes';
import { bathMethodLabel } from '@/lib/lab/bathRules';
import { mondayOf } from '@/lib/lab/careEventRules';
import { addDays } from '@/lib/lab/programRules';
import { Chip, ErrorBanner, LabDateInput } from '@/components/lab/LabUi';
import { dateLabel, errorText, todayString } from '@/components/lab/labFormat';
import type { LabElder } from '@/components/lab/useLabElders';
import BathEditor from './BathEditor';
import BathWeekly from './BathWeekly';
import { dedupeById, monthsBetween } from './recordsFormat';
import styles from './labRecords.module.css';

type Mode = { type: 'list' } | { type: 'edit'; log: BathLog | null; elderId: number | null };

interface Props {
  elders: LabElder[];
  eldersLoading: boolean;
  date: string;
  onDateChange: (date: string) => void;
}

export default function BathDayView({ elders, eldersLoading, date, onDateChange }: Props) {
  const [logs, setLogs] = useState<BathLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>({ type: 'list' });
  const seq = useRef(0);
  const today = todayString();
  const monday = mondayOf(date);
  const sunday = addDays(monday, 6) ?? monday;
  // 그 주가 두 달에 걸치면 두 달 모두 읽어야 주간 현황이 맞다
  const monthKey = monthsBetween(monday, sunday).join(',');

  const load = useCallback(async (key: string) => {
    const n = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const lists = await Promise.all(key.split(',').map((m) => listBathLogs({ month: m })));
      if (n === seq.current) setLogs(dedupeById(lists.flat()));
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
    void load(monthKey);
    return () => {
      seq.current += 1;
    };
  }, [monthKey, load]);

  const dayLogs = useMemo(() => logs.filter((l) => l.bathDate.slice(0, 10) === date).sort((a, b) => a.startTime.localeCompare(b.startTime) || a.id - b.id), [logs, date]);
  const shift = (days: number) => {
    const next = addDays(date, days);
    if (next && next <= today) onDateChange(next);
  };

  if (mode.type === 'edit') {
    return (
      <BathEditor
        key={mode.log?.id ?? `new-${mode.elderId ?? 'none'}`}
        elders={elders}
        log={mode.log}
        presetElderId={mode.elderId}
        presetDate={date}
        onSaved={() => void load(monthKey)}
        onClose={() => setMode({ type: 'list' })}
      />
    );
  }

  const newLog = (elderId: number | null) => setMode({ type: 'edit', log: null, elderId });

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarGrow} style={{ maxWidth: 220 }}>
          <LabDateInput label="목욕 날짜" value={date} onChange={(v) => v && v <= today && onDateChange(v)} max={today} />
        </div>
        <Button label="전날" variant="ghost" onClick={() => shift(-1)} />
        <Button label="다음 날" variant="ghost" isDisabled={date >= today} onClick={() => shift(1)} />
        <Button label="오늘로" variant="ghost" isDisabled={date === today} onClick={() => onDateChange(today)} />
        <div className={styles.spacer}>
          <Button label="목욕 기록하기" variant="primary" isDisabled={eldersLoading || elders.length === 0} onClick={() => newLog(null)} />
        </div>
      </div>
      <Text type="supporting" color="secondary">
        {dateLabel(date)} · {dayLogs.length}건
      </Text>

      {error && <ErrorBanner message={error} onRetry={() => void load(monthKey)} />}

      {loading && logs.length === 0 ? (
        <Loading size="inline" label="목욕 일지를 불러오는 중..." />
      ) : dayLogs.length === 0 && !error ? (
        <Card padding={6}>
          <EmptyState
            isCompact
            title={`${dateLabel(date)}에는 목욕 일지가 없습니다`}
            description="목욕을 한 어르신의 시각·방법·제공 요양보호사를 기록해 주세요."
            actions={<Button label="목욕 기록하기" variant="secondary" isDisabled={eldersLoading || elders.length === 0} onClick={() => newLog(null)} />}
          />
        </Card>
      ) : (
        <Card padding={0}>
          <div role="list">
            {dayLogs.map((l) => (
              <div className={styles.rowBlock} role="listitem" key={l.id}>
                <div className={styles.rowHead}>
                  <span className={styles.chips} style={{ justifyContent: 'flex-start' }}>
                    <Text type="body" weight="medium">
                      {l.elderlyName}
                    </Text>
                    <Chip tone="info" label={bathMethodLabel(l.method)} />
                    <Chip tone="neutral" label={`${l.startTime}~${l.endTime} · ${l.minutes.toLocaleString('ko-KR')}분`} />
                  </span>
                  <Button label={`${l.elderlyName} 일지 고치기`} variant="ghost" onClick={() => setMode({ type: 'edit', log: l, elderId: null })} />
                </div>
                <Text type="supporting" color="secondary">
                  제공 요양보호사 {l.providerName}
                </Text>
                {[
                  ['목욕 전 상태', l.preCheck],
                  ['피부 관찰', l.skinNote],
                  ['메모', l.note],
                ].map(([label, value]) =>
                  value ? (
                    <div className={styles.pre} key={label}>
                      <Text type="supporting">
                        {label}: {value}
                      </Text>
                    </div>
                  ) : null,
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {!eldersLoading && !loading && !error && elders.length > 0 && <BathWeekly elders={elders} logs={logs} monday={monday} sunday={sunday} isCurrentWeek={mondayOf(today) === monday} onRecord={(id) => newLog(id)} />}
    </div>
  );
}
