'use client';

/** 연간 자원연계 요약 — 종류별 수, 연계한 어르신 수, 후속 확인이 지난 연계. */
import { Banner } from '@astryxdesign/core/Banner';
import { Card } from '@astryxdesign/core/Card';
import { VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Chip, SupportText } from '@/components/lab/LabUi';
import { dotDate } from '@/components/lab/labFormat';
import { RESOURCE_TYPES } from '@/lib/lab/communityRules';
import type { ResourceSummary } from '@/lib/lab/communityRules';
import type { ResourceLink } from '@/lib/lab/labTypes';
import styles from './labPlans.module.css';

interface Props {
  year: number;
  summary: ResourceSummary<ResourceLink>;
}

export default function CommunityResourceSummary({ year, summary }: Props) {
  return (
    <Card padding={4}>
      <VStack gap={3}>
        <Text type="label">{year}년 자원연계 요약</Text>
        <div className={styles.toolbar}>
          <div className={styles.statBox}>
            <Text type="supporting" color="secondary">
              연계 건수
            </Text>
            <Text type="label" hasTabularNumbers>
              {summary.total}건
            </Text>
          </div>
          <div className={styles.statBox}>
            <Text type="supporting" color="secondary">
              연계한 어르신
            </Text>
            <Text type="label" hasTabularNumbers>
              {summary.eldersLinked}명
            </Text>
          </div>
          {RESOURCE_TYPES.filter((t) => summary.byType[t.value] > 0).map((t) => (
            <div key={t.value} className={styles.statBox}>
              <Text type="supporting" color="secondary">
                {t.label}
              </Text>
              <Text type="label" hasTabularNumbers>
                {summary.byType[t.value]}건
              </Text>
            </div>
          ))}
        </div>
        {summary.followUpsDue.length > 0 && (
          <Banner status="warning" title={`후속 확인 예정일이 지났는데 결과가 비어 있는 연계가 ${summary.followUpsDue.length}건 있습니다`}>
            <VStack gap={1}>
              {summary.followUpsDue.map((l) => (
                <Text key={l.id} type="supporting">
                  {dotDate(l.followUpOn)} 예정 · {l.elderlyId === null ? '기관 전체' : l.elderlyName ?? '(이름 없음)'} · {l.institution} <Chip tone="warn" label="확인 필요" />
                </Text>
              ))}
            </VStack>
          </Banner>
        )}
        <SupportText>연계기록지를 제공한 건은 목록에 ‘연계기록지 제공’으로 표시됩니다(2026년 평가 ‘외부기관연계’에서 확인). 지역사회 자원 연계 자체를 묻는 별도 지표는 없어, 이 기록은 기관의 사례 관리와 후속 확인용입니다.</SupportText>
      </VStack>
    </Card>
  );
}
