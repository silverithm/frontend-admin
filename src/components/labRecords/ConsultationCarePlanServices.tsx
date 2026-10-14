'use client';

/** 제공 서비스 표 — 영역·내용·횟수 줄을 30개까지. 자주 쓰는 영역은 버튼 한 번으로 줄을 더한다. */
import { Button } from '@astryxdesign/core/Button';
import { Icon } from '@astryxdesign/core/Icon';
import { IconButton } from '@astryxdesign/core/IconButton';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { AiChip, SupportText } from '@/components/lab/LabUi';
import { AREA_MAX, COMMON_AREAS, FREQUENCY_MAX, MAX_SERVICES, SERVICE_CONTENT_MAX, nextRowKey } from './ConsultationCarePlanPlanDraft';
import type { ServiceRow } from './ConsultationCarePlanPlanDraft';
import styles from './labRecords.module.css';

interface ServicesProps {
  rows: ServiceRow[];
  onChange: (rows: ServiceRow[]) => void;
  isDisabled?: boolean;
}

export default function ConsultationCarePlanServices({ rows, onChange, isDisabled }: ServicesProps) {
  const full = rows.length >= MAX_SERVICES;
  const patch = (key: number, change: Partial<ServiceRow>) => onChange(rows.map((r) => (r.key === key ? { ...r, ...change, fromAi: false } : r)));
  const add = (area = '') => {
    if (!full) onChange([...rows, { key: nextRowKey(), area, content: '', frequency: '' }]);
  };

  return (
    <VStack gap={3}>
      <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
        <Text type="label">
          제공 서비스 <span className={styles.mutedText}>· {rows.length}/{MAX_SERVICES}줄</span>
        </Text>
        <Button label="줄 추가" variant="secondary" isDisabled={isDisabled || full} onClick={() => add()} />
      </HStack>
      <div className={styles.chips} style={{ justifyContent: 'flex-start' }}>
        {COMMON_AREAS.map((area) => (
          <Button key={area} label={`+ ${area}`} variant="ghost" isDisabled={isDisabled || full} onClick={() => add(area)} />
        ))}
      </div>
      {rows.length === 0 ? (
        <SupportText>아직 서비스가 없습니다. 위 영역 버튼으로 줄을 더하거나 ‘AI 계획 초안’을 받아 보세요.</SupportText>
      ) : (
        rows.map((row, index) => (
          <div className={styles.serviceLine} key={row.key}>
            <TextInput label={`${index + 1}. 영역`} value={row.area} onChange={(v) => patch(row.key, { area: v.slice(0, AREA_MAX) })} isDisabled={isDisabled} placeholder="예: 인지활동" />
            <TextInput label={row.fromAi ? '내용 · AI 제안' : '내용'} value={row.content} onChange={(v) => patch(row.key, { content: v.slice(0, SERVICE_CONTENT_MAX) })} isDisabled={isDisabled} placeholder="무엇을 어떻게 지원하는지" />
            <TextInput label="횟수·주기" value={row.frequency} onChange={(v) => patch(row.key, { frequency: v.slice(0, FREQUENCY_MAX) })} isDisabled={isDisabled} placeholder="예: 주 3회" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}>
              {row.fromAi && <AiChip />}
              <IconButton label={`${index + 1}번 서비스 줄 지우기`} tooltip="줄 지우기" variant="ghost" isDisabled={isDisabled} onClick={() => onChange(rows.filter((r) => r.key !== row.key))} icon={<Icon icon="close" size="sm" />} />
            </div>
          </div>
        ))
      )}
      {full && <SupportText>서비스는 30줄까지 적을 수 있습니다.</SupportText>}
    </VStack>
  );
}
