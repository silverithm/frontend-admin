'use client';

/** 올해 진료 동행 통계 — 진료과별 건수, 동행 직원 기재, 보호자 알림률. */
import { useMemo } from 'react';
import { Card } from '@astryxdesign/core/Card';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/Stack';
import { Loading } from '@/components/Loading';
import type { MedicalVisit } from '@/lib/lab/labTypes';
import { visitStats } from '@/lib/lab/medicalVisitRules';
import { ErrorBanner } from '@/components/lab/LabUi';
import styles from './labRecords.module.css';
import own from './MedicalVisit.module.css';

interface Props {
  year: number;
  visits: MedicalVisit[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}

export default function MedicalVisitStats({ year, visits, isLoading, error, onRetry }: Props) {
  const stats = useMemo(() => visitStats(visits, year), [visits, year]);
  const departments = useMemo(() => Object.entries(stats.byDepartment).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko')), [stats]);
  const max = departments.reduce((m, [, n]) => Math.max(m, n), 1);

  return (
    <Card padding={4}>
      <VStack gap={3}>
        <Text type="large" weight="semibold">
          {year}년 진료 동행 통계
        </Text>
        {error && <ErrorBanner message={error} onRetry={onRetry} />}
        {isLoading && visits.length === 0 ? (
          <Loading size="inline" label="올해 통계를 불러오는 중..." />
        ) : error && visits.length === 0 ? null : stats.total === 0 ? (
          <Text type="supporting" color="secondary">
            올해 기록된 진료 동행이 아직 없습니다. 기록을 남기면 진료과별 건수와 보호자 알림률이 여기에 모입니다.
          </Text>
        ) : (
          <>
            <div className={own.statRow}>
              <div className={styles.statBox}>
                <Text type="supporting" color="secondary">
                  전체
                </Text>
                <Text type="large" weight="semibold" hasTabularNumbers>
                  {stats.total}건
                </Text>
              </div>
              <div className={styles.statBox}>
                <Text type="supporting" color="secondary">
                  동행 직원 기재
                </Text>
                <Text type="large" weight="semibold" hasTabularNumbers>
                  {stats.escorted}/{stats.total}건
                </Text>
              </div>
              <div className={styles.statBox}>
                <Text type="supporting" color="secondary">
                  보호자 알림
                </Text>
                <Text type="large" weight="semibold" hasTabularNumbers>
                  {stats.guardianNotified}건{stats.notifyRate !== null ? ` (${stats.notifyRate}%)` : ''}
                </Text>
              </div>
            </div>
            <VStack gap={2}>
              <Text type="label">진료과별</Text>
              {departments.map(([name, count]) => (
                <div className={own.deptRow} key={name}>
                  <span className={own.deptName}>
                    <Text type="supporting">{name}</Text>
                  </span>
                  <span className={own.deptTrack} aria-hidden="true">
                    <div className={own.deptFill} style={{ width: `${Math.max(4, Math.round((count / max) * 100))}%` }} />
                  </span>
                  <Text type="supporting" hasTabularNumbers>
                    {count}건
                  </Text>
                </div>
              ))}
            </VStack>
          </>
        )}
      </VStack>
    </Card>
  );
}
