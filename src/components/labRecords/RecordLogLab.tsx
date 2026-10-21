'use client';

/**
 * 종류별 기록 도구 — 업무수행일지(프로그램 관리자·선임 요양보호사), 시설운영일지, 수급자 안전관리 설명, 현금영수증 발행 대장.
 * 달력 월 목록과 새 기록·고치기·삭제, 월 대장 인쇄(한 건 인쇄도 목록에서). 안전관리 설명은 올해 현황도 보인다.
 * 칸 구성은 기관 자체 서식이다(케어포 공개 메뉴 구성 참고, 고시·평가 필수 항목은 대조 필요).
 */
import { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Text } from '@astryxdesign/core/Text';
import type { RecordLog, RecordLogKind } from '@/lib/lab/labTypes';
import { RECORD_LOG_KINDS } from '@/lib/lab/recordLogRules';
import { ErrorBanner, MonthStepper } from '@/components/lab/LabUi';
import { currentMonth, monthLabel, todayString } from '@/components/lab/labFormat';
import { useLabElders } from '@/components/lab/useLabElders';
import { useRecordLogData } from './RecordLogData';
import RecordLogBriefing from './RecordLogBriefing';
import RecordLogEditor from './RecordLogEditor';
import RecordLogList from './RecordLogList';
import RecordLogSheet from './RecordLogSheet';
import styles from './labRecords.module.css';
import own from './RecordLog.module.css';

type Mode = { type: 'list' } | { type: 'edit'; log: RecordLog | null; elderId: number | null };

interface Props {
  /** 이 도구가 다루는 종류. 둘 이상이면 위에 보기 전환이 생긴다 */
  kinds: RecordLogKind[];
  /** 접어 둔 안내 문단 */
  guide: string[];
}

export default function RecordLogLab({ kinds, guide }: Props) {
  const [kind, setKind] = useState<RecordLogKind>(kinds[0]);
  return (
    <div className={styles.stack}>
      <details className={own.guide}>
        <summary>기록 기준 안내</summary>
        {guide.map((g) => (
          <p key={g}>{g}</p>
        ))}
      </details>
      {kinds.length > 1 && (
        <div>
          <SegmentedControl label="종류" value={kind} onChange={(v) => v && setKind(v as RecordLogKind)}>
            {kinds.map((k) => (
              <SegmentedControlItem key={k} value={k} label={RECORD_LOG_KINDS[k].label} />
            ))}
          </SegmentedControl>
        </div>
      )}
      <RecordLogBody key={kind} kind={kind} />
    </div>
  );
}

function RecordLogBody({ kind }: { kind: RecordLogKind }) {
  const rule = RECORD_LOG_KINDS[kind];
  const { elders, isLoading: eldersLoading, error: eldersError, reload: reloadElders } = useLabElders();
  const [month, setMonth] = useState(currentMonth);
  const [mode, setMode] = useState<Mode>({ type: 'list' });
  const [printing, setPrinting] = useState<{ logs: RecordLog[]; period?: string } | null>(null);
  const year = Number(todayString().slice(0, 4));
  const withYear = kind === 'SAFETY_BRIEFING';
  const { monthData, yearData, reloadAll } = useRecordLogData(kind, month, year, withYear);

  if (mode.type === 'edit') {
    return <RecordLogEditor key={mode.log?.id ?? `new-${mode.elderId ?? 0}`} kind={kind} elders={elders} log={mode.log} presetElderId={mode.elderId} onSaved={reloadAll} onClose={() => setMode({ type: 'list' })} />;
  }

  const canCreate = !rule.perElder || (!eldersLoading && elders.length > 0);
  const create = () => setMode({ type: 'edit', log: null, elderId: null });
  return (
    <div className={styles.stack}>
      {rule.perElder && eldersError && <ErrorBanner message={eldersError} onRetry={() => void reloadElders()} />}
      {withYear && <RecordLogBriefing year={year} elders={elders} logs={yearData.data} isLoading={yearData.isLoading} error={yearData.error} onRetry={() => void yearData.reload()} onRecord={(elderId) => setMode({ type: 'edit', log: null, elderId })} />}
      <div className={styles.toolbar}>
        <MonthStepper value={month} onChange={setMonth} />
        <Text type="supporting" color="secondary">
          {monthData.isLoading ? '불러오는 중...' : `${monthData.data.length}건`}
        </Text>
        <div className={styles.spacer}>
          <Button label="월 대장 인쇄" variant="secondary" isDisabled={monthData.data.length === 0} onClick={() => setPrinting({ logs: monthData.data, period: monthLabel(month) })} />
          <Button label={`새 ${rule.label}`} variant="primary" isDisabled={!canCreate} onClick={create} />
        </div>
      </div>
      {monthData.error && <ErrorBanner message={monthData.error} onRetry={() => void monthData.reload()} />}
      <RecordLogList kind={kind} month={month} logs={monthData.isLoading ? [] : monthData.data} isLoading={monthData.isLoading} onCreate={create} onOpen={(log) => setMode({ type: 'edit', log, elderId: null })} onPrint={(logs) => setPrinting({ logs })} />
      {printing && <RecordLogSheet kind={kind} logs={printing.logs} periodLabel={printing.period} onDone={() => setPrinting(null)} />}
    </div>
  );
}
