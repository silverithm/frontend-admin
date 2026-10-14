'use client';

import { Text } from '@astryxdesign/core/Text';
import { halfYearStatus, riskLevelLabel, riskLevelTone } from '@/lib/lab/riskScales';
import type { RiskLatestEntry, RiskLevel } from '@/lib/lab/labTypes';
import { Chip } from './LabUi';
import type { Tone } from './LabUi';
import { dotDate } from './labFormat';

const LEVEL_TONE: Record<ReturnType<typeof riskLevelTone>, Tone> = {
  danger: 'danger',
  warning: 'warn',
  caution: 'neutral',
  ok: 'neutral',
};

export function RiskLevelChip({ level }: { level: RiskLevel }) {
  return <Chip tone={LEVEL_TONE[riskLevelTone(level)]} label={riskLevelLabel(level)} />;
}

export type HalfStatus = ReturnType<typeof halfYearStatus>;

export function HalfChip({ status }: { status: HalfStatus }) {
  if (status === 'DONE') return <Chip tone="ok" label="이번 반기 완료" />;
  if (status === 'DUE') return <Chip tone="warn" label="평가 필요" />;
  return <Chip tone="danger" label="평가 기록 없음" />;
}

/** 표 칸 하나: 마지막 평가일·점수·단계·반기 상태 */
export function RiskCell({ entry, today }: { entry: RiskLatestEntry | null; today: Date }) {
  const status = halfYearStatus(entry?.assessedOn, today);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-1)', alignItems: 'flex-start' }}>
      {entry && (
        <Text type="body" hasTabularNumbers>
          {dotDate(entry.assessedOn)} · {entry.total}점
        </Text>
      )}
      <span style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-1)' }}>
        {entry && <RiskLevelChip level={entry.riskLevel} />}
        <HalfChip status={status} />
      </span>
    </div>
  );
}
