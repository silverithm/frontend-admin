'use client';

/** 감염병 유행·발생 기록 목록 — 종류 칩, 진행 일수, 진행 중 강조, 빠진 신고 칩(outbreakCheck). */
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import type { Outbreak } from '@/lib/lab/labTypes';
import { OUTBREAK_GAP_LABEL, outbreakCheck } from '@/lib/lab/outbreakRules';
import { Chip } from '@/components/lab/LabUi';
import { dateLabel, todayString } from '@/components/lab/labFormat';
import { actionLabel, alertLabel, kindLabel } from './OutbreakDraft';
import styles from './labRecords.module.css';
import own from './Outbreak.module.css';

interface Props {
  year: number;
  outbreaks: Outbreak[];
  isFiltered: boolean;
  onOpen: (o: Outbreak) => void;
  onPrint: (o: Outbreak) => void;
  onCreate: () => void;
}

export default function OutbreakList({ year, outbreaks, isFiltered, onOpen, onPrint, onCreate }: Props) {
  const today = todayString();
  if (outbreaks.length === 0) {
    return (
      <Card padding={6}>
        <EmptyState
          isCompact
          title={isFiltered ? '이 종류의 기록이 없습니다' : `${year}년에 기록된 유행·발생이 없습니다`}
          description={isFiltered ? '다른 종류를 골라 보세요.' : '같은 증상 환자가 2명 이상 나오거나 확진·의심 환자가 생기면 바로 기록해 주세요. 없었다면 비워 두어도 됩니다.'}
          actions={isFiltered ? undefined : <Button label="유행·발생 기록 쓰기" variant="secondary" onClick={onCreate} />}
        />
      </Card>
    );
  }
  const sorted = [...outbreaks].sort((a, b) => (a.startedOn < b.startedOn ? 1 : a.startedOn > b.startedOn ? -1 : b.id - a.id));
  return (
    <Card padding={0}>
      {sorted.map((o) => {
        const c = outbreakCheck(o, today);
        return (
          <div className={`${styles.rowBlock} ${c.open ? own.openRow : ''}`} key={o.id}>
            <div className={styles.stackTight}>
              <div className={styles.rowHead}>
                <HStack gap={2} vAlign="center" wrap="wrap">
                  <Text type="body" weight="medium">
                    {o.disease}
                  </Text>
                  <Chip tone={o.kind === 'NATIONAL' ? 'info' : 'neutral'} label={kindLabel(o.kind)} />
                  {o.kind === 'NATIONAL' && o.alertLevel && <Chip tone={o.alertLevel === 'RED' || o.alertLevel === 'ORANGE' ? 'danger' : 'warn'} label={`경보 ${alertLabel(o.alertLevel)}`} />}
                  {c.open ? <Chip tone="danger" label={`진행 중 · ${c.daysOpen}일째`} /> : <Chip tone="ok" label={`종료 · ${c.daysOpen}일 지속`} />}
                </HStack>
                <HStack gap={1}>
                  <Button label="인쇄 보기" variant="ghost" onClick={() => onPrint(o)} />
                  <Button label="수정" variant="ghost" onClick={() => onOpen(o)} />
                </HStack>
              </div>
              <Text type="supporting" color="secondary">
                {dateLabel(o.startedOn.slice(0, 10))} 시작{o.endedOn ? ` · ${dateLabel(o.endedOn.slice(0, 10))} 종료` : ''}
                {o.kind !== 'NATIONAL' ? ` · 수급자 ${o.elderCases}명 · 직원 ${o.staffCases}명` : ''}
              </Text>
              {o.kind !== 'NATIONAL' && (
                <HStack gap={1} wrap="wrap">
                  {c.missing.length === 0 ? <Chip tone="ok" label="안내·신고·보고 모두 있음" /> : c.missing.map((g) => <Chip key={g} tone="warn" label={`${OUTBREAK_GAP_LABEL[g]} 빠짐`} />)}
                </HStack>
              )}
              <Text type="supporting" color="secondary">
                {o.actions.length > 0 ? `한 조치: ${o.actions.map(actionLabel).join(', ')}` : '한 조치를 아직 적지 않았습니다'}
              </Text>
            </div>
          </div>
        );
      })}
    </Card>
  );
}
