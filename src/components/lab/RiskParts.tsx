'use client';

import { Text } from '@astryxdesign/core/Text';
import { cognitiveToolLabel, halfYearStatus, riskLevelLabel, riskLevelTone } from '@/lib/lab/riskScales';
import type { CognitiveScores, RiskAssessment, RiskLatestEntry, RiskLevel } from '@/lib/lab/labTypes';
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

/** 'K-MMSE (한국판 …)' → 'K-MMSE' */
function cognitiveToolShort(tool: CognitiveScores['tool']): string {
  return cognitiveToolLabel(tool).split(' (')[0];
}

/** 인지기능 평가 한 줄 요약: 도구 · 점수 · 외부기관 */
export function cognitiveSummary(scores: CognitiveScores): string {
  const parts = [cognitiveToolShort(scores.tool)];
  if (typeof scores.score === 'number') parts.push(`${scores.score}점`);
  if (scores.institution) parts.push(scores.institution);
  return parts.join(' · ');
}

/** 이력·삭제 확인에 쓰는 평가 한 줄: 욕창·낙상은 합계 점수, 인지기능은 도구·점수 */
export function assessmentResultText(item: RiskAssessment): string {
  return item.kind === 'COGNITIVE' ? cognitiveSummary(item.scores) : `${item.total}점`;
}

/**
 * 표 칸 하나: 마지막 평가일·점수·단계·반기 상태.
 * 인지기능은 도구마다 점수가 없을 수 있어(진단서 등) 합계 점수 대신 판정만 보여 준다.
 */
export function RiskCell({ entry, today, isCognitive }: { entry: RiskLatestEntry | null; today: Date; isCognitive?: boolean }) {
  const status = halfYearStatus(entry?.assessedOn, today);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-1)', alignItems: 'flex-start' }}>
      {entry && (
        <Text type="body" hasTabularNumbers>
          {isCognitive ? dotDate(entry.assessedOn) : `${dotDate(entry.assessedOn)} · ${entry.total}점`}
        </Text>
      )}
      <span style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-1)' }}>
        {entry && <RiskLevelChip level={entry.riskLevel} />}
        <HalfChip status={status} />
      </span>
    </div>
  );
}
