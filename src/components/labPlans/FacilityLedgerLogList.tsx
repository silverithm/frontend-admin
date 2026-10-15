'use client';

/** 한 항목의 실시 기록 목록 — 최신순, 보관 만료일과 보관 위치를 함께 보여 준다. */
import { Button } from '@astryxdesign/core/Button';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import { Chip, ErrorBanner } from '@/components/lab/LabUi';
import { dotDate } from '@/components/lab/labFormat';
import { retainUntil } from '@/lib/lab/facilityLedgerRules';
import type { FacilityItemCode, FacilityLog } from '@/lib/lab/labTypes';
import { doneByLabel, resultLabel, resultTone } from './FacilityLedgerFormat';
import styles from './facilityLedger.module.css';

interface Props {
  code: FacilityItemCode;
  logs: FacilityLog[];
  loading: boolean;
  error: string | null;
  activeId: number | null;
  onRetry: () => void;
  onOpen: (log: FacilityLog) => void;
}

export default function FacilityLedgerLogList({ code, logs, loading, error, activeId, onRetry, onOpen }: Props) {
  if (error) return <ErrorBanner message={error} onRetry={onRetry} />;
  if (loading && logs.length === 0) return <Loading size="inline" label="실시 기록을 불러오는 중..." />;
  if (logs.length === 0) return <Text type="supporting" color="secondary">아직 남긴 실시 기록이 없습니다. 아래에서 첫 기록을 남기면 다음 기한이 계산됩니다.</Text>;
  const sorted = [...logs].sort((a, b) => (a.doneOn < b.doneOn ? 1 : a.doneOn > b.doneOn ? -1 : b.id - a.id));
  return (
    <div className={styles.logList}>
      {sorted.map((l) => {
        const retain = retainUntil(code, l.doneOn);
        return (
          <div key={l.id} className={styles.logCard} data-active={activeId === l.id ? 'true' : undefined}>
            <div className={styles.logHead}>
              <Text type="label">{dotDate(l.doneOn)}</Text>
              <Chip tone={resultTone(l.result)} label={resultLabel(l.result)} />
              <Chip tone="neutral" label={doneByLabel(l.doneBy)} />
              <Button label={activeId === l.id ? '고치는 중' : '고치기'} variant="secondary" size="sm" isDisabled={activeId === l.id} onClick={() => onOpen(l)} />
            </div>
            <div className={styles.logBody}>
              {l.vendorName && <Text type="supporting">업체: {l.vendorName}</Text>}
              {l.actionNote && <Text type="supporting">조치: {l.actionNote}</Text>}
              {l.reportedOn && <Text type="supporting">소방 결과 보고일: {dotDate(l.reportedOn)}</Text>}
              {l.validUntil && <Text type="supporting">보험 만기일: {dotDate(l.validUntil)}</Text>}
              <Text type="supporting" color="secondary">보관 위치: {l.docLocation ? l.docLocation : '적지 않음'}{retain ? ` · 보관 만료일 ${dotDate(retain)}` : ''}</Text>
            </div>
          </div>
        );
      })}
    </div>
  );
}
