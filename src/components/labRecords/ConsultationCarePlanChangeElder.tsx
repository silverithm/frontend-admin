'use client';

/** 고른 어르신 한 분의 계획 변경 — 이력 목록, 쓰기 화면, 한 건 인쇄. 어르신이 바뀌면 부모가 key로 새로 그린다. */
import { useCallback } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import { listCarePlanChanges, listCareEvents } from '@/lib/lab/labApi';
import type { CareEvent, CarePlanChange } from '@/lib/lab/labTypes';
import { ErrorBanner } from '@/components/lab/LabUi';
import { todayString } from '@/components/lab/labFormat';
import type { LabElder } from '@/components/lab/useLabElders';
import ConsultationCarePlanChangeEditor from './ConsultationCarePlanChangeEditor';
import ConsultationCarePlanChangeList from './ConsultationCarePlanChangeList';
import ConsultationCarePlanChangeSheet from './ConsultationCarePlanChangeSheet';
import type { ChangePreset } from './ConsultationCarePlanChangeDraft';
import { useRecordsLoader } from './useRecordsLoader';
import styles from './labRecords.module.css';

export type ChangeMode = { type: 'list' } | { type: 'edit'; change: CarePlanChange | null; preset: ChangePreset } | { type: 'print'; change: CarePlanChange };

interface Props {
  elder: LabElder;
  mode: ChangeMode;
  onMode: (mode: ChangeMode) => void;
  /** 저장·삭제 뒤 위쪽 올해 목록을 다시 읽게 한다 */
  onChanged: () => void;
}

const NONE_CHANGES: CarePlanChange[] = [];
const NONE_EVENTS: CareEvent[] = [];

export default function ConsultationCarePlanChangeElder({ elder, mode, onMode, onChanged }: Props) {
  const loadChanges = useCallback(() => listCarePlanChanges({ elderlyId: elder.id }), [elder.id]);
  const loadEvents = useCallback(() => listCareEvents({ elderlyId: elder.id }), [elder.id]);
  const changes = useRecordsLoader(loadChanges, '계획 변경 이력을 불러오지 못했습니다', NONE_CHANGES);
  const events = useRecordsLoader(loadEvents, '상태변화·사고 기록을 불러오지 못했습니다', NONE_EVENTS);

  const newPreset = (): ChangePreset => ({ date: todayString() });

  if (mode.type === 'print') {
    const event = mode.change.eventId === null ? null : events.data.find((e) => e.id === mode.change.eventId) ?? null;
    return <ConsultationCarePlanChangeSheet change={mode.change} grade={elder.careGrade} event={event} onDone={() => onMode({ type: 'list' })} />;
  }

  if (changes.isLoading || events.isLoading) {
    return changes.error || events.error ? null : <Loading size="inline" label="불러오는 중..." />;
  }

  if (mode.type === 'edit') {
    return (
      <ConsultationCarePlanChangeEditor
        key={mode.change?.id ?? 'new'}
        elder={elder}
        change={mode.change}
        preset={mode.preset}
        events={events.data}
        onSaved={() => {
          void changes.reload();
          onChanged();
          onMode({ type: 'list' });
        }}
        onClose={() => onMode({ type: 'list' })}
        onPrint={(c) => onMode({ type: 'print', change: c })}
      />
    );
  }

  return (
    <div className={styles.stack}>
      {changes.error && <ErrorBanner message={changes.error} onRetry={() => void changes.reload()} />}
      {events.error && <ErrorBanner message={events.error} onRetry={() => void events.reload()} />}
      <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
        <Text type="large" weight="semibold">
          {elder.name} 어르신의 계획 변경 이력 {changes.data.length}건
        </Text>
        <Button label="계획 변경 쓰기" variant="primary" onClick={() => onMode({ type: 'edit', change: null, preset: newPreset() })} />
      </HStack>
      {!changes.error && (
        <ConsultationCarePlanChangeList
          elderName={elder.name}
          changes={changes.data}
          events={events.data}
          onOpen={(c) => onMode({ type: 'edit', change: c, preset: { date: c.changedOn.slice(0, 10) } })}
          onPrint={(c) => onMode({ type: 'print', change: c })}
          onCreate={() => onMode({ type: 'edit', change: null, preset: newPreset() })}
        />
      )}
    </div>
  );
}
