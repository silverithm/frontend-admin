'use client';

/**
 * 간호일지 — 날짜를 고르고, 어르신 목록에서 한 분씩 바이탈·투약·처치를 기록한다.
 * 목록에는 그날 기록 여부와 "확인 필요" 표시가 보이고, 기본은 그날 출석한 어르신만 보여 준다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Switch } from '@astryxdesign/core/Switch';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import { listNursingLogsByDate } from '@/lib/lab/labApi';
import type { NursingLog } from '@/lib/lab/labTypes';
import { evaluateVitals, worstVitalLevel } from '@/lib/lab/vitalFlags';
import { Chip, ErrorBanner, LabConfirm, LabDateInput, useNotify } from '@/components/lab/LabUi';
import { dateLabel, errorText, todayString } from '@/components/lab/labFormat';
import { useLabElders } from '@/components/lab/useLabElders';
import { readingFromLog } from './NursingLogDraft';
import NursingLogEditor from './NursingLogEditor';
import { useElderAttendance } from './useElderAttendance';
import styles from './labRecords.module.css';

const EMPTY_LOG = { systolic: null, diastolic: null, pulse: null, temperature: null, bloodSugar: null, weight: null } as const;

export default function NursingLogLab() {
  const notify = useNotify();
  const { elders, isLoading: eldersLoading, error: eldersError, reload: reloadElders } = useLabElders();
  const [date, setDate] = useState(todayString);
  const [logs, setLogs] = useState<NursingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [onlyPresent, setOnlyPresent] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [pendingNav, setPendingNav] = useState<(() => void) | null>(null);
  const attendance = useElderAttendance(date);
  const seq = useRef(0);

  const load = useCallback(async (target: string) => {
    const n = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const list = await listNursingLogsByDate(target);
      if (n !== seq.current) return; // 날짜를 빨리 넘길 때 늦게 온 응답은 버린다
      setLogs(list);
    } catch (e) {
      if (n !== seq.current) return;
      setLogs([]);
      setError(errorText(e, '간호일지를 불러오지 못했습니다'));
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

  const byElder = useMemo(() => new Map(logs.map((l) => [l.elderlyId, l])), [logs]);
  const filtering = onlyPresent && attendance.hasData && attendance.present.size > 0;
  // 출석한 분만 보더라도 이미 기록이 있는 분은 목록에 남긴다(결석 처리 전에 쓴 기록을 놓치지 않게)
  const visible = useMemo(() => (filtering ? elders.filter((e) => attendance.present.has(e.id) || byElder.has(e.id)) : elders), [elders, filtering, attendance.present, byElder]);
  const recordedCount = visible.filter((e) => byElder.has(e.id)).length;
  const attentionCount = visible.filter((e) => worstVitalLevel(evaluateVitals(readingFromLog(byElder.get(e.id) ?? EMPTY_LOG))) !== null).length;

  const flagCount = useCallback((log: NursingLog | undefined) => (log ? evaluateVitals(readingFromLog(log)) : []), []);

  const guarded = useCallback(
    (action: () => void) => {
      if (dirty) setPendingNav(() => action);
      else action();
    },
    [dirty],
  );

  const changeDate = (value: string) => {
    if (!value || value === date) return;
    guarded(() => {
      setSelectedId(null);
      setDate(value);
    });
  };

  const selected = elders.find((e) => e.id === selectedId) ?? null;
  const selectedIndex = visible.findIndex((e) => e.id === selectedId);
  const hasNext = selectedIndex !== -1 && visible.length > 1;

  const handleSaved = useCallback(
    (log: NursingLog, goNext: boolean) => {
      setLogs((prev) => [...prev.filter((l) => l.elderlyId !== log.elderlyId), log]);
      if (!goNext) return;
      // 아직 기록이 없는 다음 분을 먼저, 없으면 목록의 다음 분. 이 계산은 방금 저장한 분을 기록 있음으로 넣어서 한다.
      const done = new Set(logs.map((l) => l.elderlyId));
      done.add(log.elderlyId);
      const from = visible.findIndex((e) => e.id === log.elderlyId);
      const order = [...visible.slice(from + 1), ...visible.slice(0, Math.max(from, 0))];
      const next = order.find((e) => !done.has(e.id));
      if (next) setSelectedId(next.id);
      else notify('이 목록의 간호일지를 모두 기록했습니다', 'success');
    },
    [logs, visible, notify],
  );
  const handleDeleted = useCallback((id: number) => setLogs((prev) => prev.filter((l) => l.id !== id)), []);

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarGrow} style={{ maxWidth: 220 }}>
          <LabDateInput label="기록 날짜" value={date} onChange={changeDate} max={todayString()} />
        </div>
        <Button label="오늘로" variant="ghost" isDisabled={date === todayString()} onClick={() => changeDate(todayString())} />
        <Switch label="출석한 어르신만" value={onlyPresent} onChange={setOnlyPresent} isDisabled={!attendance.hasData || attendance.present.size === 0} />
        <Text type="supporting" color="secondary">
          {dateLabel(date)} · 기록 {recordedCount}/{visible.length}명{attentionCount > 0 ? ` · 확인 필요 ${attentionCount}명` : ''}
        </Text>
      </div>

      {eldersError && <ErrorBanner message={eldersError} onRetry={() => void reloadElders()} />}
      {error && <ErrorBanner message={error} onRetry={() => void load(date)} />}
      {attendance.error && !attendance.isLoading && (
        <Text type="supporting" color="secondary">
          {attendance.error}
        </Text>
      )}
      {!attendance.isLoading && !attendance.error && !attendance.hasData && (
        <Text type="supporting" color="secondary">
          이 날 출결 기록이 없어 모든 어르신을 보여 드립니다. 출결을 먼저 찍으면 출석한 분만 걸러 볼 수 있어요.
        </Text>
      )}

      {eldersLoading ? (
        <Loading size="inline" label="어르신 목록을 불러오는 중..." />
      ) : elders.length === 0 ? (
        <EmptyState title="등록된 어르신이 없습니다" description="회원관리 탭에서 어르신을 먼저 등록해 주세요." />
      ) : (
        <div className={styles.split} data-has-selection={selected ? 'true' : 'false'}>
          <div className={styles.splitList}>
            <Card padding={0}>
              {loading && logs.length === 0 ? (
                <Loading size="inline" label="기록을 불러오는 중..." />
              ) : (
                <nav aria-label="어르신 목록" className={styles.listScroll}>
                  {visible.map((elder) => {
                    const log = byElder.get(elder.id);
                    const flags = flagCount(log);
                    const worst = worstVitalLevel(flags);
                    return (
                      <button
                        key={elder.id}
                        type="button"
                        className={styles.elderButton}
                        aria-current={elder.id === selectedId}
                        disabled={loading && logs.length === 0}
                        onClick={() => elder.id !== selectedId && guarded(() => setSelectedId(elder.id))}
                      >
                        <Text type="body" weight="medium">
                          {elder.name}
                        </Text>
                        <span className={styles.chips}>
                          {worst && <Chip tone={worst === 'WATCH' ? 'warn' : 'danger'} label={`확인 필요 ${flags.length}`} />}
                          <Chip tone={log ? 'ok' : 'neutral'} label={log ? '기록 있음' : '기록 없음'} />
                        </span>
                      </button>
                    );
                  })}
                </nav>
              )}
            </Card>
          </div>
          <div className={styles.splitDetail}>
            {selected ? (
              <NursingLogEditor
                key={`${selected.id}-${date}`}
                elderId={selected.id}
                elderName={selected.name}
                date={date}
                log={byElder.get(selected.id) ?? null}
                hasNext={hasNext}
                onSaved={handleSaved}
                onDeleted={handleDeleted}
                onDirtyChange={setDirty}
                onBack={() => guarded(() => setSelectedId(null))}
              />
            ) : (
              <Card padding={6}>
                <EmptyState isCompact title="왼쪽에서 어르신을 골라 주세요" description="기록이 없는 분부터 혈압·체온을 적고 Enter로 칸을 넘기면 빠릅니다." />
              </Card>
            )}
          </div>
        </div>
      )}

      <LabConfirm
        isOpen={pendingNav !== null}
        title="저장하지 않은 내용이 있습니다"
        description="이동하면 지금 적은 내용이 사라집니다. 그래도 이동할까요?"
        actionLabel="이동"
        onConfirm={() => {
          const action = pendingNav;
          setPendingNav(null);
          setDirty(false);
          action?.();
        }}
        onClose={() => setPendingNav(null)}
      />
    </div>
  );
}
