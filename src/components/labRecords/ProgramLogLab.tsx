'use client';

/**
 * 프로그램 일지 — 위에는 이번 주 인지 프로그램 횟수·최근 4주 충족·참여가 적은 어르신, 아래는 월 달력과 날짜별 목록.
 * 쓰기·수정은 같은 자리에서 작성 화면으로 바뀌고, 저장하면 목록으로 돌아온다.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import { listPrograms } from '@/lib/lab/labApi';
import type { Program } from '@/lib/lab/labTypes';
import { ErrorBanner, MonthStepper, useNotify } from '@/components/lab/LabUi';
import { currentMonth, dateLabel, errorText, monthLabel, todayString } from '@/components/lab/labFormat';
import { useLabElders } from '@/components/lab/useLabElders';
import ProgramLogCognitiveGaps from './ProgramLogCognitiveGaps';
import ProgramLogCalendar from './ProgramLogCalendar';
import ProgramLogEditor from './ProgramLogEditor';
import ProgramLogList from './ProgramLogList';
import ProgramLogSummary from './ProgramLogSummary';
import type { ProgramPreset } from './ProgramLogDraft';
import styles from './labRecords.module.css';

interface EditState {
  program: Program | null;
  preset: ProgramPreset;
}

export default function ProgramLogLab() {
  const notify = useNotify();
  const { elders, isLoading: eldersLoading, error: eldersError, reload: reloadElders } = useLabElders();
  const [month, setMonth] = useState(currentMonth);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [version, setVersion] = useState(0);
  const seq = useRef(0);

  const load = useCallback(async (target: string) => {
    const n = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const list = await listPrograms(target);
      if (n !== seq.current) return; // 달을 빨리 넘길 때 늦게 온 응답은 버린다
      setPrograms(list);
    } catch (e) {
      if (n !== seq.current) return;
      setPrograms([]);
      setError(errorText(e, '프로그램 일지를 불러오지 못했습니다'));
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

  const changeMonth = (value: string) => {
    setSelectedDate(null);
    setMonth(value);
  };

  const startNew = (preset?: Partial<ProgramPreset>) => {
    const today = todayString();
    // 보고 있는 달의 첫날을 기본으로 하되, 미래 날짜는 기록할 수 없으니 오늘로 맞춘다
    const first = `${month}-01`;
    const fallback = today.startsWith(month) || first > today ? today : first;
    setEditing({ program: null, preset: { date: selectedDate ?? fallback, ...preset } });
  };

  const afterChange = () => {
    setEditing(null);
    setVersion((v) => v + 1);
    void load(month);
  };

  if (editing) {
    return (
      <div className={styles.stack}>
        <ProgramLogEditor
          key={editing.program?.id ?? `new-${editing.preset.from?.id ?? 'blank'}-${editing.preset.category ?? ''}`}
          elders={elders}
          program={editing.program}
          preset={editing.preset}
          onSaved={(saved, isNew) => {
            notify(isNew ? '프로그램 일지를 저장했습니다' : '프로그램 일지를 수정했습니다', 'success');
            afterChange();
            // 다른 달 날짜로 저장했다면 그 달로 따라간다
            const savedMonth = saved.programDate.slice(0, 7);
            if (savedMonth !== month) changeMonth(savedMonth);
          }}
          onDeleted={() => afterChange()}
          onClose={() => setEditing(null)}
        />
      </div>
    );
  }

  const shown = selectedDate ? programs.filter((p) => p.programDate.slice(0, 10) === selectedDate) : programs;

  return (
    <div className={styles.stack}>
      {eldersError && <ErrorBanner message={eldersError} onRetry={() => void reloadElders()} />}
      <ProgramLogSummary elders={elders} version={version} onWriteCognitive={() => startNew({ category: 'COGNITIVE', date: todayString() })} />

      <div className={styles.toolbar}>
        <MonthStepper value={month} onChange={changeMonth} isDisabled={loading} />
        <Text type="supporting" color="secondary">
          {monthLabel(month)} 프로그램 {programs.length}건
        </Text>
        <div className={styles.spacer}>
          <Button label="프로그램 일지 쓰기" variant="primary" isDisabled={eldersLoading} onClick={() => startNew()} />
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={() => void load(month)} />}

      <Card padding={4}>
        <ProgramLogCalendar month={month} programs={programs} selectedDate={selectedDate} onSelect={setSelectedDate} />
        <div style={{ marginTop: 'var(--spacing-2)' }}>
          <Text type="supporting" color="secondary">
            파란 점은 인지 프로그램, 테두리가 있는 점은 인지활동형(60분 이상) 프로그램입니다. 날짜를 누르면 그날 프로그램만 보여요.
          </Text>
        </div>
      </Card>

      <ProgramLogCognitiveGaps month={month} programs={programs} programsLoading={loading} programsFailed={error !== null} elders={elders} eldersLoading={eldersLoading} eldersFailed={eldersError !== null} />

      {loading && programs.length === 0 ? (
        <Loading size="inline" label="프로그램을 불러오는 중..." />
      ) : shown.length === 0 && !error ? (
        <Card padding={6}>
          <EmptyState
            isCompact
            title={selectedDate ? `${dateLabel(selectedDate)}에는 프로그램 일지가 없습니다` : `${monthLabel(month)}에는 프로그램 일지가 없습니다`}
            description="오늘 한 활동을 메모로 적고 AI로 정리해 첫 일지를 남겨 보세요."
            actions={<Button label="프로그램 일지 쓰기" variant="secondary" onClick={() => startNew()} />}
          />
        </Card>
      ) : (
        <Card padding={0}>
          {selectedDate && (
            <div className={styles.rowBlock}>
              <Button label={`${dateLabel(selectedDate)} 보는 중 — 이번 달 전체 보기`} variant="ghost" onClick={() => setSelectedDate(null)} />
            </div>
          )}
          <ProgramLogList programs={shown} onEdit={(program) => setEditing({ program, preset: { date: program.programDate.slice(0, 10) } })} onCopy={(from) => setEditing({ program: null, preset: { date: todayString(), from } })} />
        </Card>
      )}
    </div>
  );
}
