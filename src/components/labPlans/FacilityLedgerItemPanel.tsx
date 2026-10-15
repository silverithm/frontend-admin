'use client';

/** 항목을 열었을 때 — 남길 증빙 안내, 실시 기록 목록, 쓰기·고치기. */
import { useEffect, useRef, useState } from 'react';
import { Text } from '@astryxdesign/core/Text';
import { Chip } from '@/components/lab/LabUi';
import { dotDate } from '@/components/lab/labFormat';
import { cadenceLabel, nextDue } from '@/lib/lab/facilityLedgerRules';
import type { FacilityItem } from '@/lib/lab/facilityLedgerRules';
import type { FacilityLog, FacilityProfile } from '@/lib/lab/labTypes';
import FacilityLedgerLogForm from './FacilityLedgerLogForm';
import FacilityLedgerLogList from './FacilityLedgerLogList';
import { useItemLogs } from './FacilityLedgerLoad';
import { itemHints } from './FacilityLedgerNotes';
import styles from './facilityLedger.module.css';

interface Props {
  item: FacilityItem;
  profile: FacilityProfile | null;
  today: string;
  /** 이 항목 기록을 읽을 때마다 표의 계산에 넘긴다 */
  onLogs: (logs: FacilityLog[]) => void;
  /** 저장·삭제 뒤 표 전체를 다시 읽는다 */
  onChanged: () => Promise<void>;
  /** 쓰던 내용이 있는지(다른 데로 갈 때 묻는 데 쓴다) */
  onDirtyChange: (dirty: boolean) => void;
  /** 쓰던 내용이 있으면 true를 돌려주고 확인 창이 뜬다 */
  guard: (go: () => void) => boolean;
}

export default function FacilityLedgerItemPanel({ item, profile, today, onLogs, onChanged, onDirtyChange, guard }: Props) {
  const logs = useItemLogs(item.code);
  const [editing, setEditing] = useState<FacilityLog | null>(null);
  const [formKey, setFormKey] = useState(0);
  const formRef = useRef<HTMLDivElement>(null);
  const { data, loading, error, reload } = logs;
  useEffect(() => {
    if (!loading && !error) onLogs(data);
    // 읽기가 끝날 때마다 한 번만 넘긴다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, loading, error]);
  const due = nextDue(item.code, data, profile, today);
  const open = (l: FacilityLog | null) => {
    const go = () => {
      setEditing(l);
      setFormKey((k) => k + 1);
      if (l) setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
    };
    if (!guard(go)) go();
  };
  const changed = async () => {
    await Promise.all([reload(), onChanged()]);
  };
  const hints = itemHints(item.code);
  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <Text type="label">{item.name}</Text>
        <Chip tone={item.basis === 'LAW' ? 'info' : 'warn'} label={item.basis === 'LAW' ? '법정' : '평가 요건'} />
      </div>
      <div className={styles.lines}>
        <Text type="supporting" color="secondary">근거: {item.lawRef} · 주기: {cadenceLabel(item.cadence)}</Text>
        <Text type="supporting">남길 증빙: {item.evidence}</Text>
        <Text type="supporting" color="secondary">
          {item.retentionYears !== null ? `결과서는 실시한 날부터 ${item.retentionYears}년 보관합니다.` : '법에 정한 보관 연수는 없지만 다음 점검과 평가 때까지 보관해 두세요.'}
        </Text>
        {due.windowStartYmd && due.windowEndYmd && <Text type="supporting" color="secondary">점검 가능 기간: {dotDate(due.windowStartYmd)} ~ {dotDate(due.windowEndYmd)}</Text>}
        {due.missed > 0 && <Text type="supporting" color="secondary">기록이 없는 기간이 {due.missed}번 있습니다.</Text>}
        {hints.map((h) => (
          <Text key={h} type="supporting" color="secondary">{h}</Text>
        ))}
      </div>
      <Text type="label">실시 기록</Text>
      <FacilityLedgerLogList code={item.code} logs={data} loading={loading} error={error} activeId={editing?.id ?? null} onRetry={() => void reload()} onOpen={open} />
      <div ref={formRef}>
        <FacilityLedgerLogForm key={`${item.code}${formKey}`} code={item.code} editing={editing} today={today} onChanged={changed} onClear={() => { setEditing(null); setFormKey((k) => k + 1); }} onDirtyChange={onDirtyChange} />
      </div>
    </div>
  );
}
