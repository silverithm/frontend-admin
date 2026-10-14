'use client';

/**
 * 상태변화·사고 — 위에는 이번 달 요약과 "상태변화 기록이 빠진 주", 아래는 월 목록(열린 것만 걸러 볼 수 있다).
 * 쓰기·고치기는 같은 자리에서 편집기로 바뀌고, "목록으로"를 누르면 돌아온다.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Switch } from '@astryxdesign/core/Switch';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import { eventStats } from '@/lib/lab/careEventRules';
import { listCareEvents } from '@/lib/lab/labApi';
import type { CareEvent } from '@/lib/lab/labTypes';
import { ErrorBanner, MonthStepper } from '@/components/lab/LabUi';
import { currentMonth, errorText, monthLabel } from '@/components/lab/labFormat';
import { useLabElders } from '@/components/lab/useLabElders';
import CareEventEditor from './CareEventEditor';
import CareEventGaps from './CareEventGaps';
import CareEventList from './CareEventList';
import styles from './labRecords.module.css';

interface EditState {
  event: CareEvent | null;
  presetElderId: number | null;
  key: string;
}

export default function CareEventLab() {
  const { elders, isLoading: eldersLoading, error: eldersError, reload: reloadElders } = useLabElders();
  const [month, setMonth] = useState(currentMonth);
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [monthEvents, setMonthEvents] = useState<CareEvent[]>([]);
  const [openEvents, setOpenEvents] = useState<CareEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditState | null>(null);
  const seq = useRef(0);
  const counter = useRef(0);

  const load = useCallback(async (target: string, withOpen: boolean) => {
    const n = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const [byMonth, open] = await Promise.all([listCareEvents({ month: target }), withOpen ? listCareEvents({ status: 'OPEN' }) : Promise.resolve(null)]);
      if (n !== seq.current) return; // 달을 빨리 넘길 때 늦게 온 응답은 버린다
      setMonthEvents(byMonth);
      if (open) setOpenEvents(open);
    } catch (e) {
      if (n !== seq.current) return;
      setError(errorText(e, '상태변화·사고 기록을 불러오지 못했습니다'));
    } finally {
      if (n === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(month, onlyOpen);
    return () => {
      seq.current += 1;
    };
  }, [month, onlyOpen, load]);

  const startNew = (presetElderId: number | null = null) => {
    counter.current += 1;
    setEditing({ event: null, presetElderId, key: `new-${counter.current}` });
  };

  if (editing) {
    return (
      <div className={styles.stack}>
        <CareEventEditor
          key={editing.key}
          elders={elders}
          event={editing.event}
          presetElderId={editing.presetElderId}
          onChanged={(saved) => {
            // 저장한 사고가 있는 달로 따라간다(편집기는 그대로 열려 있다)
            const savedMonth = saved.occurredAt.slice(0, 7);
            if (savedMonth !== month) setMonth(savedMonth);
            else void load(month, onlyOpen);
          }}
          onDeleted={() => {
            setEditing(null);
            void load(month, onlyOpen);
          }}
          onClose={() => {
            setEditing(null);
            void load(month, onlyOpen);
          }}
        />
      </div>
    );
  }

  const stats = eventStats(monthEvents, month);
  const shown = onlyOpen ? openEvents : monthEvents;

  return (
    <div className={styles.stack}>
      {eldersError && <ErrorBanner message={eldersError} onRetry={() => void reloadElders()} />}

      <div className={styles.toolbar}>
        <MonthStepper value={month} onChange={setMonth} isDisabled={loading} />
        <Switch label="열린 것만 (모든 달)" value={onlyOpen} onChange={setOnlyOpen} />
        <div className={styles.spacer}>
          <Button label="새 기록 쓰기" variant="primary" isDisabled={eldersLoading || elders.length === 0} onClick={() => startNew()} />
        </div>
      </div>

      <Text type="supporting" color="secondary">
        {monthLabel(month)} {stats.total}건 · 열림 {stats.open}건
        {stats.guardianRequired > 0 ? ` · 보호자 연락 필요 ${stats.guardianRequired}건 중 ${stats.guardianNotified}건 연락${stats.notifyRate !== null ? ` (${stats.notifyRate}%)` : ''}` : ''}
      </Text>

      {!eldersLoading && elders.length > 0 && <CareEventGaps month={month} elders={elders} events={monthEvents} onWrite={startNew} />}

      {error && <ErrorBanner message={error} onRetry={() => void load(month, onlyOpen)} />}

      {loading && shown.length === 0 ? (
        <Loading size="inline" label="기록을 불러오는 중..." />
      ) : shown.length === 0 && !error ? (
        <Card padding={6}>
          <EmptyState
            isCompact
            title={onlyOpen ? '열려 있는 기록이 없습니다' : `${monthLabel(month)}에는 상태변화·사고 기록이 없습니다`}
            description="어르신의 상태가 달라졌거나 사고가 있었다면 그날 바로 적어 두세요. 메모만 적어도 AI가 칸을 채워 줍니다."
            actions={<Button label="새 기록 쓰기" variant="secondary" isDisabled={eldersLoading || elders.length === 0} onClick={() => startNew()} />}
          />
        </Card>
      ) : (
        <Card padding={0}>
          <CareEventList events={shown} onOpen={(event) => setEditing({ event, presetElderId: null, key: `event-${event.id}` })} />
        </Card>
      )}
    </div>
  );
}
