'use client';

/** 한 어르신의 계획 변경 이력 목록 — 사유·변경 항목·빠진 곳(changeRecordCheck)·관련 상태변화. */
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import type { CareEvent, CarePlanChange } from '@/lib/lab/labTypes';
import { CHANGE_GAP_LABEL, changeRecordCheck } from '@/lib/lab/needsRules';
import { Chip } from '@/components/lab/LabUi';
import { dateLabel } from '@/components/lab/labFormat';
import { eventOptionLabel, itemLabel, reasonLabel } from './ConsultationCarePlanChangeDraft';
import styles from './labRecords.module.css';

interface Props {
  elderName: string;
  changes: CarePlanChange[];
  events: CareEvent[];
  onOpen: (change: CarePlanChange) => void;
  onPrint: (change: CarePlanChange) => void;
  onCreate: () => void;
}

export default function ConsultationCarePlanChangeList({ elderName, changes, events, onOpen, onPrint, onCreate }: Props) {
  if (changes.length === 0) {
    return (
      <Card padding={6}>
        <EmptyState
          isCompact
          title={`${elderName} 어르신의 계획 변경 이력이 없습니다`}
          description="급여내용·시간·횟수를 바꾸면 그날 사유와 보호자 확인을 남겨 주세요."
          actions={<Button label="계획 변경 쓰기" variant="secondary" onClick={onCreate} />}
        />
      </Card>
    );
  }
  const sorted = [...changes].sort((a, b) => (a.changedOn < b.changedOn ? 1 : a.changedOn > b.changedOn ? -1 : b.id - a.id));
  return (
    <Card padding={0}>
      {sorted.map((c) => {
        const gaps = changeRecordCheck(c);
        const event = c.eventId === null ? null : events.find((e) => e.id === c.eventId) ?? null;
        return (
          <div className={styles.rowBlock} key={c.id}>
            <div className={styles.stackTight}>
              <div className={styles.rowHead}>
                <HStack gap={2} vAlign="center" wrap="wrap">
                  <Text type="body" weight="medium">
                    {dateLabel(c.changedOn.slice(0, 10))}
                  </Text>
                  <Chip tone="info" label={reasonLabel(c.reason)} />
                  {c.changeItems.map((i) => (
                    <Chip key={i} tone="neutral" label={itemLabel(i)} />
                  ))}
                </HStack>
                <HStack gap={1}>
                  <Button label="인쇄 보기" variant="ghost" onClick={() => onPrint(c)} />
                  <Button label="수정" variant="ghost" onClick={() => onOpen(c)} />
                </HStack>
              </div>
              <Text type="supporting" color="secondary">
                {c.reasonNote}
              </Text>
              {event && (
                <Text type="supporting" color="secondary">
                  관련 상태변화: {eventOptionLabel(event)}
                </Text>
              )}
              <HStack gap={1} wrap="wrap">
                {gaps.length === 0 ? <Chip tone="ok" label="빠진 곳 없음" /> : gaps.map((g) => <Chip key={g} tone="warn" label={`${CHANGE_GAP_LABEL[g]} 빠짐`} />)}
              </HStack>
            </div>
          </div>
        );
      })}
    </Card>
  );
}
