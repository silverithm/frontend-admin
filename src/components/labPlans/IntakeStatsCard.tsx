'use client';

/** 그 해 입소 문의 통계 — 전체·경로별·상태별 건수와 계약 전환율. */
import { Card } from '@astryxdesign/core/Card';
import { VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { SupportText } from '@/components/lab/LabUi';
import { INTAKE_SOURCES, INTAKE_STATUSES } from '@/lib/lab/intakeRules';
import type { IntakeStats } from '@/lib/lab/intakeRules';
import styles from './labPlans7.module.css';

function Cell({ name, value }: { name: string; value: string }) {
  return (
    <div className={styles.statCell}>
      <Text type="supporting" color="secondary">
        {name}
      </Text>
      <Text type="label" hasTabularNumbers>
        {value}
      </Text>
    </div>
  );
}

export default function IntakeStatsCard({ stats, year }: { stats: IntakeStats; year: number }) {
  return (
    <Card padding={4}>
      <VStack gap={3}>
        <Text type="label">{year}년 문의 통계 (문의일 기준)</Text>
        {stats.total === 0 ? (
          <Text type="supporting" color="secondary">
            {year}년에 기록한 문의가 없습니다.
          </Text>
        ) : (
          <>
            <div className={styles.statGrid}>
              <Cell name="문의 전체" value={`${stats.total}건`} />
              <Cell name="계약 완료" value={`${stats.contracted}건`} />
              <Cell name="계약 전환율" value={stats.conversionRate === null ? '-' : `${stats.conversionRate}%`} />
            </div>
            <Text type="supporting" color="secondary">
              경로별
            </Text>
            <div className={styles.statGrid}>
              {INTAKE_SOURCES.map((s) => (
                <Cell key={s.value} name={s.label} value={`${stats.bySource[s.value]}건`} />
              ))}
            </div>
            <Text type="supporting" color="secondary">
              상태별
            </Text>
            <div className={styles.statGrid}>
              {INTAKE_STATUSES.map((s) => (
                <Cell key={s.value} name={s.label} value={`${stats.byStatus[s.value]}건`} />
              ))}
            </div>
          </>
        )}
        <SupportText>계약 전환율은 계약 완료 건수를 그 해 문의 건수로 나눈 값입니다. 입소 대기자 관리는 공개된 평가 요구가 아니라 기관 운영용 기록입니다.</SupportText>
      </VStack>
    </Card>
  );
}
