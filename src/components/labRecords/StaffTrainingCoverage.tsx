'use client';

/**
 * 법정 교육 이수 현황 — 직원마다 노인학대 예방·성희롱 예방·감염 예방·안전·개인정보 보호 다섯 가지를 올해 들었는지 본다.
 * 범주 줄의 버튼은 "아직 안 들은 직원"을 참석자로 채운 새 교육 기록을 연다. 회의는 이수로 세지 않는다.
 */
import { useMemo, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Switch } from '@astryxdesign/core/Switch';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { StatRow, StatTile } from '@/components/StatTile';
import type { LabStaff, LegalTrainingCategory, StaffTraining } from '@/lib/lab/labTypes';
import { LEGAL_TRAINING_CATEGORIES, summarizeCoverage, trainingCategoryLabel, trainingCoverage } from '@/lib/lab/trainingRules';
import { Chip } from '@/components/lab/LabUi';
import { todayString } from '@/components/lab/labFormat';
import styles from './labRecords.module.css';

interface CoverageProps {
  staff: LabStaff[];
  trainings: StaffTraining[];
  year: number;
  onRecordCategory: (category: LegalTrainingCategory, missingStaffIds: number[]) => void;
}

/** 오늘부터 그 해 12월 31일까지 남은 일수(지난 해면 0) */
function daysLeftInYear(year: number): number {
  const today = todayString();
  const y = Number(today.slice(0, 4));
  if (year !== y) return 0;
  const now = Date.UTC(y, Number(today.slice(5, 7)) - 1, Number(today.slice(8, 10)));
  return Math.round((Date.UTC(y, 11, 31) - now) / 86_400_000);
}

export default function StaffTrainingCoverage({ staff, trainings, year, onRecordCategory }: CoverageProps) {
  const [onlyMissing, setOnlyMissing] = useState(false);
  const coverage = useMemo(() => trainingCoverage(trainings, staff, year), [trainings, staff, year]);
  const summary = useMemo(() => summarizeCoverage(coverage), [coverage]);
  const rows = onlyMissing ? coverage.filter((c) => !c.complete) : coverage;
  const left = daysLeftInYear(year);

  if (staff.length === 0) {
    return (
      <Card padding={6}>
        <EmptyState isCompact title="직원 목록이 비어 있습니다" description="직원이 가입·승인되면 법정 교육 이수 현황이 여기에 나타납니다." />
      </Card>
    );
  }

  // 가장 많은 직원이 빠뜨린 범주
  const worstCategory = [...LEGAL_TRAINING_CATEGORIES].sort((a, b) => summary.byCategory[a] - summary.byCategory[b])[0];
  const worstMissing = summary.total - summary.byCategory[worstCategory];

  return (
    <VStack gap={3}>
      <StatRow>
        <StatTile value={`${summary.complete}/${summary.total}명`} label={`${year}년 법정 교육 모두 이수 (${summary.percent}%)`} tone={summary.total > 0 && summary.complete === summary.total ? 'success' : left > 0 && left <= 60 ? 'warning' : 'neutral'} />
        <StatTile value={`${summary.total - summary.complete}명`} label="아직 빠진 직원" tone={summary.total - summary.complete > 0 && left > 0 && left <= 60 ? 'warning' : 'neutral'} />
        <StatTile value={worstMissing > 0 ? `${worstMissing}명` : '없음'} label={worstMissing > 0 ? `가장 비어 있는 교육: ${trainingCategoryLabel(worstCategory)}` : '빠진 교육 없음'} tone={worstMissing > 0 ? 'warning' : 'success'} />
      </StatRow>

      <Card padding={0}>
        {LEGAL_TRAINING_CATEGORIES.map((category) => {
          const done = summary.byCategory[category];
          const missingIds = coverage.filter((c) => c.missing.includes(category)).map((c) => c.staffId);
          return (
            <div className={styles.rowBlock} key={category}>
              <div className={styles.rowHead}>
                <VStack gap={1}>
                  <Text type="body" weight="medium">
                    {trainingCategoryLabel(category)}
                  </Text>
                  <div className={styles.meter} role="img" aria-label={`${done}/${summary.total}명 이수`} style={{ width: 160 }}>
                    <div className={styles.meterFill} style={{ width: `${summary.total === 0 ? 0 : Math.round((done / summary.total) * 100)}%` }} />
                  </div>
                </VStack>
                <HStack gap={2} vAlign="center" wrap="wrap">
                  <Chip tone={missingIds.length === 0 ? 'ok' : 'warn'} label={missingIds.length === 0 ? '모두 이수' : `${done}/${summary.total}명 · ${missingIds.length}명 미이수`} />
                  {missingIds.length > 0 && <Button label="미이수 직원으로 기록" variant="secondary" onClick={() => onRecordCategory(category, missingIds)} />}
                </HStack>
              </div>
            </div>
          );
        })}
      </Card>

      <div className={styles.toolbar}>
        <Switch label="빠진 직원만" value={onlyMissing} onChange={setOnlyMissing} />
        {left > 0 && (
          <Text type="supporting" color="secondary">
            {year}년 마감(12월 31일)까지 {left}일 남았습니다.
          </Text>
        )}
      </div>

      <Card padding={0}>
        {rows.length === 0 ? (
          <div className={styles.rowBlock}>
            <Text type="supporting" color="secondary">
              모든 직원이 법정 교육 다섯 가지를 이수했습니다.
            </Text>
          </div>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col" className={styles.stickyName}>직원</th>
                  {LEGAL_TRAINING_CATEGORIES.map((c) => (
                    <th scope="col" key={c}>{trainingCategoryLabel(c)}</th>
                  ))}
                  <th scope="col">빠진 교육</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.staffId}>
                    <td className={styles.stickyName}>{c.staffName}</td>
                    {LEGAL_TRAINING_CATEGORIES.map((cat) => (
                      <td key={cat} className={c.done.includes(cat) ? styles.okText : styles.warnText} aria-label={c.done.includes(cat) ? '이수' : '미이수'}>
                        {c.done.includes(cat) ? '이수' : '미이수'}
                      </td>
                    ))}
                    <td>{c.complete ? <Chip tone="ok" label="완료" /> : <Chip tone="warn" label={`${c.missing.length}개 빠짐`} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </VStack>
  );
}
