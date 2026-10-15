'use client';

/** 직원 권익 향상(지표 8) 다섯 기준 요약 — 배점 0.5/0.5/1/1/1. */
import { Card } from '@astryxdesign/core/Card';
import { VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { SupportText } from '@/components/lab/LabUi';
import type { GrievanceSummary, PayrollProfile, PolicyDoc, StaffWelfare, BonusFund } from '@/lib/lab/labTypes';
import { BonusFundCard, InsuranceCard } from './StaffWelfareCriteriaA';
import { GrievanceCard, QuarterCard, SeveranceCard } from './StaffWelfareCriteriaB';
import styles from './StaffWelfare.module.css';

interface Source<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

interface Props {
  year: number;
  today: string;
  profiles: Source<PayrollProfile[]>;
  funds: Source<BonusFund[]>;
  entries: Source<StaffWelfare[]>;
  grievance: Source<GrievanceSummary | null>;
  docs: Source<PolicyDoc[]>;
  onRetry: () => void;
}

export default function StaffWelfareSummary({ year, today, profiles, funds, entries, grievance, docs, onRetry }: Props) {
  return (
    <Card padding={4}>
      <VStack gap={3}>
        <Text type="label">직원 권익 향상 — 다섯 기준 (2026 지표 8, 4점)</Text>
        <SupportText>기준마다 충족하면 점수를 받습니다. 아래는 이 도구에 적힌 기록으로 센 현황이고, 서류로 확인할 부분은 따로 적었습니다.</SupportText>
        <div className={styles.criteriaGrid}>
          <InsuranceCard profiles={profiles.data} loading={profiles.loading} error={profiles.error} onRetry={onRetry} />
          <BonusFundCard funds={funds.data} loading={funds.loading} error={funds.error} onRetry={onRetry} />
          <QuarterCard entries={entries.data} today={today} loading={entries.loading} error={entries.error} onRetry={onRetry} />
          <GrievanceCard year={year} summary={grievance.data} docs={docs.data} loading={grievance.loading || docs.loading} error={grievance.error} docsError={docs.error} onRetry={onRetry} />
          <SeveranceCard />
        </div>
      </VStack>
    </Card>
  );
}
