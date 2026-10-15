'use client';

/**
 * 계획 반영이 필요한 상태변화 — 올해 상태변화·낙상·부상·입원·응급(보통 이상)과 계획 변경 이력을 맞춰 본다(eventPlanReflection).
 * 사건일 30일 안에 같은 어르신의 계획 변경 이력이 없으면 강조하고, 줄에서 바로 '계획 변경 쓰기'로 이어진다.
 */
import { useMemo, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import type { CareEvent, CarePlanChange } from '@/lib/lab/labTypes';
import { eventPlanReflection } from '@/lib/lab/needsRules';
import type { PlanReflectionState } from '@/lib/lab/needsRules';
import { Chip, SupportText } from '@/components/lab/LabUi';
import { dotDate, todayString } from '@/components/lab/labFormat';
import { eventOptionLabel } from './ConsultationCarePlanChangeDraft';
import styles from './labRecords.module.css';
import own from './ConsultationCarePlanChange.module.css';

interface Props {
  year: number;
  events: CareEvent[];
  changes: CarePlanChange[];
  onWrite: (elderlyId: number, eventId: number) => void;
}

export default function ConsultationCarePlanChangeReflection({ year, events, changes, onWrite }: Props) {
  const [showDone, setShowDone] = useState(false);
  const today = todayString();
  const reflection = useMemo(() => eventPlanReflection(events, changes, today), [events, changes, today]);
  const eventById = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
  const shown = reflection.rows.filter((r) => showDone || r.state !== 'PLAN_CHANGE');

  const stateChip = (state: PlanReflectionState, due: string) => {
    if (state === 'PLAN_CHANGE') return <Chip tone="ok" label="계획 변경 있음" />;
    if (state === 'FOLLOW_UP') return <Chip tone="info" label="건별 사유만 있음" />;
    if (state === 'PENDING') return <Chip tone="warn" label={`${dotDate(due)}까지 계획 변경 필요`} />;
    return <Chip tone="danger" label="계획 변경 없음 (기한 지남)" />;
  };

  return (
    <div className={styles.stackTight}>
      <Text type="large" weight="semibold">
        계획 반영이 필요한 상태변화
      </Text>
      <details className={own.guide}>
        <summary>어떤 상태변화를 보나요</summary>
        <p>{year}년의 상태변화·낙상·부상·병원·응급 기록 중 중증도가 ‘보통’ 이상인 것을 봅니다. 일어난 날부터 30일 안에 같은 어르신의 계획 변경 이력이 있으면 반영된 것으로 셉니다.</p>
        <p>일시(하루)적인 변경은 급여제공기록지에 건별 사유를 남기면 인정됩니다(Q&amp;A Q58·59). 급여내용·시간·횟수를 계속 바꾸는 장기 변경일 때 계획 변경 이력이 필요합니다.</p>
      </details>
      <HStack gap={2} vAlign="center" wrap="wrap">
        <Chip tone={reflection.none > 0 ? 'danger' : 'neutral'} label={`기한 지남 ${reflection.none}건`} />
        <Chip tone={reflection.pending > 0 ? 'warn' : 'neutral'} label={`기한 안 ${reflection.pending}건`} />
        <Chip tone="info" label={`건별 사유만 ${reflection.followUpOnly}건`} />
        <Chip tone="ok" label={`계획 변경 있음 ${reflection.planChange}건`} />
      </HStack>
      <CheckboxInput label="계획 변경이 있는 건도 보기" value={showDone} onChange={setShowDone} />
      {shown.length === 0 ? (
        <Card padding={6}>
          <EmptyState
            isCompact
            title={reflection.total === 0 ? `${year}년에 계획 반영이 필요한 상태변화가 없습니다` : '확인할 상태변화가 없습니다'}
            description={reflection.total === 0 ? '보통 이상의 상태변화·사고가 기록되면 여기에 나타납니다.' : '모두 계획 변경 이력과 이어져 있습니다.'}
          />
        </Card>
      ) : (
        <Card padding={0}>
          {shown.map((r) => {
            const e = eventById.get(r.eventId);
            if (!e) return null;
            const strong = r.state === 'NONE' ? own.reflectDanger : r.state === 'PENDING' ? own.reflectWarn : '';
            return (
              <div className={`${own.reflectRow} ${strong}`} key={r.eventId}>
                <div className={own.reflectText}>
                  <Text type="body" weight="medium">
                    {e.elderlyName} · {eventOptionLabel(e)}
                  </Text>
                  {r.state === 'FOLLOW_UP' && <SupportText>건별 사유만 있음 — 장기 변경이면 계획 변경 필요</SupportText>}
                  {e.followUp && r.state === 'FOLLOW_UP' && (
                    <Text type="supporting" color="secondary">
                      후속 조치: {e.followUp.length > 60 ? `${e.followUp.slice(0, 60)}…` : e.followUp}
                    </Text>
                  )}
                </div>
                <HStack gap={2} vAlign="center" wrap="wrap">
                  {stateChip(r.state, r.due)}
                  {r.state !== 'PLAN_CHANGE' && <Button label="계획 변경 쓰기" variant={r.state === 'FOLLOW_UP' ? 'ghost' : 'secondary'} onClick={() => onWrite(r.elderlyId, r.eventId)} />}
                </HStack>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
