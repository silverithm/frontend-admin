'use client';

/** 보존 기한과 파기 대상 — 급여가 끝난 날부터 5년(시행규칙 제27조제4항). 이 화면은 서류를 지우지 않고, 기한이 지난 종료 계약을 알려 줄 뿐이다. */
import { useMemo } from 'react';
import { Card } from '@astryxdesign/core/Card';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/Stack';
import { destroyCandidates, retentionUntil, RETENTION_YEARS } from '@/lib/lab/elderDocRules';
import type { ElderContract } from '@/lib/lab/labTypes';
import { Chip } from '@/components/lab/LabUi';
import { dotDate } from '@/components/lab/labFormat';
import own from './ElderDocs.module.css';

const KEEP_SHOWN = 8;

export default function ElderDocsRetention({ contracts, today }: { contracts: ElderContract[]; today: string }) {
  const { destroy, keeping } = useMemo(() => {
    const ended = contracts.filter((c) => c.status === 'ENDED' && c.contractEnd);
    const destroyList = destroyCandidates(ended, today);
    const destroySet = new Set(destroyList.map((c) => c.id));
    const keepList = ended
      .filter((c) => !destroySet.has(c.id))
      .sort((a, b) => (retentionUntil(a.contractEnd!) ?? '').localeCompare(retentionUntil(b.contractEnd!) ?? ''));
    return { destroy: destroyList, keeping: keepList };
  }, [contracts, today]);

  return (
    <Card padding={4}>
      <VStack gap={3}>
        <Text type="large" weight="semibold">
          보존 기한과 파기 대상
        </Text>
        <Text type="supporting" color="secondary">
          급여계약 서류·급여제공기록지 같은 급여비용 산정 서류는 급여가 끝난 날부터 {RETENTION_YEARS}년간 보존합니다(노인장기요양보험법 시행규칙 제27조제4항). 서류별로 기산점이 다른지는 공단 지침 대조가 필요합니다. 이 화면은 서류를 지우지 않고, 종료한 계약 기준으로 기한이 지났는지만 알려 줍니다.
        </Text>
        <div>
          <Text type="label">파기 대상 {destroy.length}건</Text>
          {destroy.length === 0 ? (
            <Text type="supporting" color="secondary">
              보존 기한이 지난 종료 계약이 없습니다.
            </Text>
          ) : (
            destroy.map((c) => (
              <div className={own.retentionRow} key={c.id}>
                <Text type="supporting">
                  <strong>{c.elderlyName}</strong> · 급여 종료 {dotDate(c.contractEnd)}
                </Text>
                <span>
                  <Chip tone="danger" label={`보존 기한 ${dotDate(retentionUntil(c.contractEnd!))} 지남`} />
                </span>
              </div>
            ))
          )}
          {destroy.length > 0 && (
            <Text type="supporting" color="secondary">
              파기 전에 소송·감사 등으로 더 보관할 사유가 없는지 확인해 주세요.
            </Text>
          )}
        </div>
        <div>
          <Text type="label">보존 중인 종료 계약 {keeping.length}건</Text>
          {keeping.length === 0 ? (
            <Text type="supporting" color="secondary">
              보존 중인 종료 계약이 없습니다.
            </Text>
          ) : (
            keeping.slice(0, KEEP_SHOWN).map((c) => (
              <div className={own.retentionRow} key={c.id}>
                <Text type="supporting">
                  <strong>{c.elderlyName}</strong> · 급여 종료 {dotDate(c.contractEnd)}
                </Text>
                <Text type="supporting" color="secondary">
                  {dotDate(retentionUntil(c.contractEnd!))}까지 보존
                </Text>
              </div>
            ))
          )}
          {keeping.length > KEEP_SHOWN && (
            <Text type="supporting" color="secondary">
              기한이 가까운 {KEEP_SHOWN}건만 보여 드립니다.
            </Text>
          )}
        </div>
      </VStack>
    </Card>
  );
}
