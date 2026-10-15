'use client';

/** 위쪽 요약 칩 — 기한 지남, 30일 안, 적용 확인 필요, 보관 위치 없음. */
import { Text } from '@astryxdesign/core/Text';
import { Chip } from '@/components/lab/LabUi';
import type { LedgerSummary } from '@/lib/lab/facilityLedgerRules';
import styles from './facilityLedger.module.css';

export default function FacilityLedgerSummary({ summary }: { summary: LedgerSummary }) {
  const clear = summary.overdue === 0 && summary.soon === 0 && summary.unknown === 0 && summary.noDocLocation === 0;
  return (
    <div className={styles.lines}>
      <div className={styles.chipRow}>
        <Chip tone={summary.overdue > 0 ? 'danger' : 'ok'} label={`기한 지남 ${summary.overdue}개`} />
        <Chip tone={summary.soon > 0 ? 'warn' : 'ok'} label={`30일 안 ${summary.soon}개`} />
        <Chip tone={summary.unknown > 0 ? 'warn' : 'ok'} label={`적용 확인 필요 ${summary.unknown}개`} />
        <Chip tone={summary.noDocLocation > 0 ? 'warn' : 'ok'} label={`보관 위치 없음 ${summary.noDocLocation}개`} />
      </div>
      {clear && <Text type="supporting" color="secondary">지금 챙길 점검이 없습니다. 달이 바뀌면 월 점검 항목이 다시 도래합니다.</Text>}
    </div>
  );
}
