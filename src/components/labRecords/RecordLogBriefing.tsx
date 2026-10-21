'use client';

/** 수급자 안전관리 설명 올해 현황 — 설명 안 한 수급자를 앞에 보이고, 그 자리에서 바로 기록하러 간다. */
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import type { RecordLog } from '@/lib/lab/labTypes';
import { briefingMissing, briefingStatus } from '@/lib/lab/recordLogRules';
import { Chip, ErrorBanner } from '@/components/lab/LabUi';
import { dotDate } from '@/components/lab/labFormat';
import type { LabElder } from '@/components/lab/useLabElders';
import own from './RecordLog.module.css';

interface Props {
  year: number;
  elders: LabElder[];
  logs: RecordLog[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onRecord: (elderId: number) => void;
}

export default function RecordLogBriefing({ year, elders, logs, isLoading, error, onRetry, onRecord }: Props) {
  if (error) return <ErrorBanner message={error} onRetry={onRetry} />;
  if (isLoading && logs.length === 0) return <Loading size="inline" label="올해 현황을 불러오는 중..." />;
  if (elders.length === 0) {
    return (
      <Card padding={6}>
        <EmptyState isCompact title="어르신이 없습니다" description="어르신을 등록하면 연 1회 안전관리 설명 현황을 볼 수 있습니다." />
      </Card>
    );
  }
  const rows = briefingStatus(elders, logs, year);
  const missing = briefingMissing(rows);
  return (
    <Card padding={0}>
      <div className={own.statusRow}>
        <Text type="label">{year}년 수급자 안전관리 설명</Text>
        <Chip tone={missing === 0 ? 'ok' : 'warn'} label={missing === 0 ? '모두 설명함' : `아직 ${missing}명`} />
      </div>
      {rows.map((r) => (
        <div className={own.statusRow} key={r.elderlyId}>
          <Text type="label">{r.elderlyName}</Text>
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
            {r.lastOn ? <Chip tone="ok" label={`${dotDate(r.lastOn)} 설명${r.count > 1 ? ` · ${r.count}회` : ''}`} /> : <Chip tone="warn" label="올해 설명 전" />}
            <Button label={r.lastOn ? '또 기록하기' : '설명 기록하기'} variant="ghost" onClick={() => onRecord(r.elderlyId)} />
          </span>
        </div>
      ))}
    </Card>
  );
}
