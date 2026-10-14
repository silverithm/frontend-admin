'use client';

/** 기능회복훈련 날짜별 보기 — 그날 세션 목록, 여러 어르신 한 번에 기록, 어르신별 고치기. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import { listRehabSessions } from '@/lib/lab/labApi';
import type { RehabSession } from '@/lib/lab/labTypes';
import { rehabKindLabel } from '@/lib/lab/rehabRules';
import { addDays } from '@/lib/lab/programRules';
import { Chip, ErrorBanner, LabDateInput } from '@/components/lab/LabUi';
import { dateLabel, errorText, todayString } from '@/components/lab/labFormat';
import type { LabElder } from '@/components/lab/useLabElders';
import RehabBatchForm from './RehabBatchForm';
import RehabReactionPanel from './RehabReactionPanel';
import RehabSessionEditor from './RehabSessionEditor';
import styles from './labRecords.module.css';

type Mode = { type: 'list' } | { type: 'batch' } | { type: 'reactions'; sessions: RehabSession[]; aiReaction: string } | { type: 'edit'; session: RehabSession };

interface Props {
  elders: LabElder[];
  eldersLoading: boolean;
  date: string;
  onDateChange: (date: string) => void;
}

export default function RehabDayView({ elders, eldersLoading, date, onDateChange }: Props) {
  const [sessions, setSessions] = useState<RehabSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>({ type: 'list' });
  const seq = useRef(0);

  const load = useCallback(async (target: string) => {
    const n = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const list = await listRehabSessions({ date: target });
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
    void load(date);
    return () => {
      seq.current += 1;
    };
  }, [date, load]);

  const shift = (days: number) => {
    const next = addDays(date, days);
    if (next && next <= todayString()) onDateChange(next);
  };

  if (mode.type === 'batch') {
    return (
      <RehabBatchForm
        elders={elders}
        date={date}
        onClose={() => setMode({ type: 'list' })}
        onSaved={(saved, aiReaction) => {
          setMode({ type: 'reactions', sessions: saved, aiReaction });
          // 기록한 날짜가 보던 날과 다르면 그 날로 따라간다
          const savedDate = saved[0]?.sessionDate.slice(0, 10);
          if (savedDate && savedDate !== date) onDateChange(savedDate);
          else void load(date);
        }}
      />
    );
  }
  if (mode.type === 'reactions') {
    return (
      <RehabReactionPanel
        sessions={mode.sessions}
        aiReaction={mode.aiReaction}
        onSessionSaved={(s) => setSessions((prev) => prev.map((p) => (p.id === s.id ? s : p)))}
        onDone={() => {
          setMode({ type: 'list' });
          void load(date);
        }}
      />
    );
  }
  if (mode.type === 'edit') {
    return (
      <RehabSessionEditor
        key={mode.session.id}
        session={mode.session}
        onClose={() => setMode({ type: 'list' })}
        onSaved={(s) => {
          setMode({ type: 'list' });
          const savedDate = s.sessionDate.slice(0, 10);
          if (savedDate !== date) onDateChange(savedDate);
          else void load(date);
        }}
        onDeleted={() => {
          setMode({ type: 'list' });
          void load(date);
        }}
      />
    );
  }

  const people = new Set(sessions.map((s) => s.elderlyId)).size;
  const minutes = sessions.reduce((n, s) => n + (s.minutes > 0 ? s.minutes : 0), 0);

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarGrow} style={{ maxWidth: 220 }}>
          <LabDateInput label="훈련 날짜" value={date} onChange={(v) => v && v <= todayString() && onDateChange(v)} max={todayString()} />
        </div>
        <Button label="전날" variant="ghost" onClick={() => shift(-1)} />
        <Button label="다음 날" variant="ghost" isDisabled={date >= todayString()} onClick={() => shift(1)} />
        <Button label="오늘로" variant="ghost" isDisabled={date === todayString()} onClick={() => onDateChange(todayString())} />
        <div className={styles.spacer}>
          <Button label="여러 어르신 한 번에 기록" variant="primary" isDisabled={eldersLoading || elders.length === 0} onClick={() => setMode({ type: 'batch' })} />
        </div>
      </div>
      <Text type="supporting" color="secondary">
        {dateLabel(date)} · {people}명 · {sessions.length}건 · {minutes.toLocaleString('ko-KR')}분
      </Text>

      {error && <ErrorBanner message={error} onRetry={() => void load(date)} />}

      {loading && sessions.length === 0 ? (
        <Loading size="inline" label="기록을 불러오는 중..." />
      ) : sessions.length === 0 && !error ? (
        <Card padding={6}>
          <EmptyState
            isCompact
            title={`${dateLabel(date)}에는 기능회복훈련 기록이 없습니다`}
            description="같은 훈련을 함께 한 어르신을 한꺼번에 골라 한 번에 기록할 수 있습니다."
            actions={<Button label="여러 어르신 한 번에 기록" variant="secondary" isDisabled={eldersLoading || elders.length === 0} onClick={() => setMode({ type: 'batch' })} />}
          />
        </Card>
      ) : (
        <Card padding={0}>
          <div role="list">
            {sessions.map((s) => (
              <div className={styles.rowBlock} role="listitem" key={s.id}>
                <div className={styles.rowHead}>
                  <span className={styles.chips} style={{ justifyContent: 'flex-start' }}>
                    <Text type="body" weight="medium">
                      {s.elderlyName}
                    </Text>
                    <Chip tone="info" label={rehabKindLabel(s.kind)} />
                    <Chip tone="neutral" label={`${s.minutes.toLocaleString('ko-KR')}분`} />
                  </span>
                  <Button label={`${s.elderlyName} 기록 고치기`} variant="ghost" onClick={() => setMode({ type: 'edit', session: s })} />
                </div>
                {s.items && s.items.length > 0 && (
                  <Text type="supporting" color="secondary">
                    항목: {s.items.join(', ')}
                  </Text>
                )}
                {s.content && (
                  <div className={styles.pre}>
                    <Text type="supporting">{s.content}</Text>
                  </div>
                )}
                <div className={styles.pre}>
                  <Text type="supporting" color="secondary">
                    {s.reaction ? `반응: ${s.reaction}` : '반응: 아직 적지 않았습니다'}
                  </Text>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
