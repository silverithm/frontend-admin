'use client';

/** 후속 확인 예정 — 후속 날짜가 오늘이거나 지났는데 아직 확인하지 않은 진료. 누르면 그 기록, 확인했으면 "후속 확인 완료". */
import { useMemo, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Text } from '@astryxdesign/core/Text';
import { updateMedicalVisit } from '@/lib/lab/labApi';
import type { MedicalVisit } from '@/lib/lab/labTypes';
import { followUpsDue } from '@/lib/lab/medicalVisitRules';
import { ErrorBanner, useNotify } from '@/components/lab/LabUi';
import { dotDate, errorText, todayString } from '@/components/lab/labFormat';
import { visitInputOf } from './MedicalVisitDraft';
import { useAlive } from './recordsFormat';
import own from './MedicalVisit.module.css';

interface Props {
  visits: MedicalVisit[];
  error: string | null;
  onRetry: () => void;
  onOpen: (visit: MedicalVisit) => void;
  onChanged: () => void;
}

export default function MedicalVisitFollowUps({ visits, error, onRetry, onOpen, onChanged }: Props) {
  const notify = useNotify();
  const alive = useAlive();
  const today = todayString();
  const due = useMemo(() => followUpsDue(visits, today), [visits, today]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [doneError, setDoneError] = useState<string | null>(null);

  const complete = async (v: MedicalVisit) => {
    if (busyId !== null) return;
    setBusyId(v.id);
    setDoneError(null);
    try {
      await updateMedicalVisit(v.id, visitInputOf(v, { followUpDone: true }));
      notify(`${v.elderlyName} 어르신의 후속 확인을 완료로 표시했습니다`, 'success');
      onChanged();
    } catch (e) {
      if (alive.current) setDoneError(errorText(e, '후속 확인을 완료로 표시하지 못했습니다'));
    } finally {
      if (alive.current) setBusyId(null);
    }
  };

  if (error) return <ErrorBanner message={error} onRetry={onRetry} />;
  if (due.length === 0) return null;

  return (
    <section className={own.dueBox} aria-label="후속 확인 예정">
      <Text type="label">후속 확인 예정 {due.length}건</Text>
      <Text type="supporting" color="secondary">
        진료 뒤 다시 확인하기로 한 날이 됐습니다. 보호자·병원에 확인했으면 완료로 표시해 주세요.
      </Text>
      {doneError && <ErrorBanner message={doneError} />}
      {due.map((v) => (
        <div className={own.dueRow} key={v.id}>
          <Text type="supporting">
            <strong>{v.elderlyName}</strong> · {v.hospital}
            {v.department ? ` ${v.department}` : ''} · 후속 {dotDate(v.followUpOn)} (진료 {dotDate(v.visitDate)})
          </Text>
          <span className={own.dueActions}>
            <Button label="기록 보기" variant="ghost" onClick={() => onOpen(v)} />
            <Button label="후속 확인 완료" variant="secondary" isLoading={busyId === v.id} isDisabled={busyId !== null} onClick={() => void complete(v)} />
          </span>
        </div>
      ))}
    </section>
  );
}
