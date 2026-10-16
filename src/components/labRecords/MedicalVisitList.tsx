'use client';

/** 그 달 진료 동행 목록 — 날짜·어르신·병원·진료과·동행 직원·보호자 알림·후속 칩. 고치기·인쇄 단추. */
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import type { MedicalVisit } from '@/lib/lab/labTypes';
import { AiChip, Chip } from '@/components/lab/LabUi';
import { dateLabel, dotDate, monthLabel, todayString } from '@/components/lab/labFormat';
import styles from './labRecords.module.css';
import own from './MedicalVisit.module.css';

interface Props {
  month: string;
  visits: MedicalVisit[];
  isLoading: boolean;
  canCreate: boolean;
  onCreate: () => void;
  onOpen: (visit: MedicalVisit) => void;
  onPrint: (visit: MedicalVisit) => void;
}

function followChip(v: MedicalVisit, today: string) {
  if (!v.followUpOn) return null;
  if (v.followUpDone) return <Chip tone="ok" label="후속 확인 완료" />;
  if (v.followUpOn <= today) return <Chip tone="warn" label={`후속 확인 필요 ${dotDate(v.followUpOn)}`} />;
  return <Chip tone="info" label={`후속 확인 ${dotDate(v.followUpOn)}`} />;
}

export default function MedicalVisitList({ month, visits, isLoading, canCreate, onCreate, onOpen, onPrint }: Props) {
  const today = todayString();
  if (isLoading && visits.length === 0) return <Loading size="inline" label="진료 동행 기록을 불러오는 중..." />;
  if (visits.length === 0) {
    return (
      <Card padding={6}>
        <EmptyState
          isCompact
          title={`${monthLabel(month)}에 기록된 진료 동행이 없습니다`}
          description="수급자가 급여제공시간 안에 직원과 병원에 다녀왔다면 그날의 진료 내용을 이곳에 남겨 두세요."
          actions={<Button label="새 진료 동행 기록" variant="secondary" isDisabled={!canCreate} onClick={onCreate} />}
        />
      </Card>
    );
  }
  return (
    <Card padding={0}>
      {visits.map((v) => (
        <div className={own.visitRow} key={v.id}>
          <div className={styles.rowHead}>
            <Text type="label">
              {dateLabel(v.visitDate)} · {v.elderlyName}
              {v.startTime ? <span className={styles.mutedText}> · {v.startTime}{v.endTime ? `~${v.endTime}` : ''}</span> : null}
            </Text>
            <span className={styles.chips}>
              <Button label="고치기" variant="ghost" onClick={() => onOpen(v)} />
              <Button label="인쇄" variant="ghost" onClick={() => onPrint(v)} />
            </span>
          </div>
          <Text type="supporting" color="secondary">
            {v.hospital}
            {v.department && !v.hospital.includes(v.department) ? ` · ${v.department}` : ''} · 동행 직원 {v.escortName || '미기재'}
          </Text>
          <span className={styles.chips} style={{ justifyContent: 'flex-start' }}>
            <Chip tone={v.guardianNotified ? 'ok' : 'neutral'} label={v.guardianNotified ? '보호자 알림' : '보호자 알림 안 함'} />
            {followChip(v, today)}
            {v.aiAssisted && <AiChip label="AI 정리 사용" />}
          </span>
        </div>
      ))}
    </Card>
  );
}
