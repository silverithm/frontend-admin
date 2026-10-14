'use client';

/** 상태변화·사고 목록 — 한 줄에 종류·중증도·보호자 연락·상태. 좁은 화면에서는 칩이 아래로 줄바꿈된다. */
import { Text } from '@astryxdesign/core/Text';
import { eventKindLabel, eventSeverityLabel, requiresGuardianNotice } from '@/lib/lab/careEventRules';
import type { CareEvent, CareEventSeverity } from '@/lib/lab/labTypes';
import { Chip } from '@/components/lab/LabUi';
import type { Tone } from '@/components/lab/LabUi';
import { eventTimeLabel } from './CareEventDraft';
import styles from './labRecords.module.css';

const SEVERITY_TONE: Record<CareEventSeverity, Tone> = { LOW: 'neutral', MODERATE: 'info', HIGH: 'warn', CRITICAL: 'danger' };

export function guardianChip(e: Pick<CareEvent, 'kind' | 'severity' | 'guardianNotifiedAt'>): { tone: Tone; label: string } {
  if (e.guardianNotifiedAt) return { tone: 'ok', label: '보호자 연락함' };
  return requiresGuardianNotice(e.kind, e.severity) ? { tone: 'danger', label: '보호자 연락 필요' } : { tone: 'neutral', label: '연락 안 함' };
}

export default function CareEventList({ events, onOpen }: { events: CareEvent[]; onOpen: (event: CareEvent) => void }) {
  return (
    <div role="list">
      {events.map((e) => {
        const g = guardianChip(e);
        return (
          <button type="button" role="listitem" className={styles.eventRow} key={e.id} onClick={() => onOpen(e)} aria-label={`${e.elderlyName} ${eventKindLabel(e.kind)} ${eventTimeLabel(e.occurredAt)} 열기`}>
            <span className={styles.rowHead}>
              <Text type="body" weight="medium">
                {e.elderlyName}
              </Text>
              <Text type="supporting" color="secondary">
                {eventTimeLabel(e.occurredAt)}
              </Text>
            </span>
            <span className={styles.chips} style={{ justifyContent: 'flex-start' }}>
              <Chip tone="info" label={eventKindLabel(e.kind)} />
              <Chip tone={SEVERITY_TONE[e.severity]} label={eventSeverityLabel(e.severity)} />
              <Chip tone={g.tone} label={g.label} />
              <Chip tone={e.status === 'CLOSED' ? 'ok' : 'warn'} label={e.status === 'CLOSED' ? '닫힘' : '열림'} />
            </span>
            <Text type="supporting" color="secondary">
              {e.description.length > 80 ? `${e.description.slice(0, 80)}…` : e.description}
            </Text>
          </button>
        );
      })}
    </div>
  );
}
