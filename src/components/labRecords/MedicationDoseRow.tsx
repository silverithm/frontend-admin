'use client';

/** 오늘 투약 한 줄 — 어르신·시간대·약, 상태, 투약함·건너뜀·거부 단추. 단추를 누르면 줄 아래에 시각·투약자·상태 메모 칸이 열린다. */
import { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { deleteMedicationDose, saveMedicationDose } from '@/lib/lab/labApi';
import type { MedicationDose, MedicationDoseStatus } from '@/lib/lab/labTypes';
import { routeLabel, slotLabel, timingLabel } from '@/lib/lab/medicationRules';
import type { DoseDue, DoseState } from '@/lib/lab/medicationRules';
import { Chip, ErrorBanner, LabConfirm, useNotify } from '@/components/lab/LabUi';
import type { Tone } from '@/components/lab/LabUi';
import { PROVIDER_KEY, errorText, writeStored } from '@/components/lab/labFormat';
import { OBSERVATION_MAX, doseInput, newDoseDraft, nowHm, validateDose } from './MedicationDraft';
import type { DoseDraft } from './MedicationDraft';
import { TimeField } from './RecordsUi';
import { useAlive } from './recordsFormat';
import styles from './labRecords.module.css';
import own from './MedicationBath.module.css';

export type DueRow = DoseDue & { dose: MedicationDose | null; state: DoseState };

interface Props {
  row: DueRow;
  /** 이 날이 오늘 이전인가 — 기록이 없으면 "대기" 대신 "기록 없음"으로 보인다 */
  isPast: boolean;
  onSaved: (dose: MedicationDose) => void;
  onDeleted: (dose: MedicationDose) => void;
}

const STATUS_LABEL: Record<MedicationDoseStatus, string> = { GIVEN: '투약함', SKIPPED: '건너뜀', REFUSED: '거부' };
const STATE_TONE: Record<DoseState, Tone> = { DONE: 'ok', SKIPPED: 'warn', REFUSED: 'danger', PENDING: 'neutral' };

/** 투약함은 '투약 후 상태', 건너뜀·거부는 '사유' — 같은 쪽끼리만 글을 이어 쓴다 */
function sameKind(a: MedicationDoseStatus, b: MedicationDoseStatus): boolean {
  return (a === 'GIVEN') === (b === 'GIVEN');
}

export default function MedicationDoseRow({ row, isPast, onSaved, onDeleted }: Props) {
  const notify = useNotify();
  const alive = useAlive();
  const [draft, setDraft] = useState<DoseDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { dose } = row;

  const open = (status: MedicationDoseStatus) => {
    setError(null);
    if (dose) {
      setDraft({ status, givenAt: status === 'GIVEN' ? dose.givenAt ?? nowHm() : '', giver: dose.giverName, observation: sameKind(status, dose.status) ? dose.observation ?? '' : '' });
    } else {
      setDraft(newDoseDraft(status));
    }
  };

  // 칸 이름이 '투약 후 상태'와 '사유'로 갈리므로, 종류가 바뀌면 고치지 않은 이전 글은 비운다
  const setStatus = (status: MedicationDoseStatus) =>
    setDraft((d) => {
      if (!d) return d;
      const untouched = d.observation === (dose?.observation ?? '');
      return { ...d, status, givenAt: status === 'GIVEN' ? d.givenAt || nowHm() : d.givenAt, observation: !sameKind(status, d.status) && untouched ? '' : d.observation };
    });

  const save = async () => {
    if (!draft || saving) return;
    const problem = validateDose(draft);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await saveMedicationDose(doseInput({ elderlyId: row.elderlyId, requestId: row.requestId, givenOn: row.date, slot: row.slot }, draft));
      writeStored(PROVIDER_KEY, draft.giver.trim());
      notify(`${slotLabel(row.slot)} 투약을 ${STATUS_LABEL[draft.status]}으로 기록했습니다`, 'success');
      onSaved(saved);
      if (alive.current) setDraft(null);
    } catch (e) {
      if (alive.current) setError(errorText(e, '투약 기록을 저장하지 못했습니다'));
    } finally {
      if (alive.current) setSaving(false);
    }
  };

  const remove = async () => {
    if (!dose || deleting) return;
    setDeleting(true);
    try {
      await deleteMedicationDose(dose.id);
      notify('투약 기록을 취소했습니다', 'success');
      onDeleted(dose);
      if (alive.current) setConfirmDelete(false);
    } catch (e) {
      if (alive.current) {
        setConfirmDelete(false);
        setError(errorText(e, '투약 기록을 취소하지 못했습니다'));
      }
    } finally {
      if (alive.current) setDeleting(false);
    }
  };

  const stateLabel =
    row.state === 'DONE'
      ? `투약함${dose?.givenAt ? ` ${dose.givenAt}` : ''}`
      : row.state === 'SKIPPED'
        ? '건너뜀'
        : row.state === 'REFUSED'
          ? '거부'
          : isPast
            ? '기록 없음'
            : '대기';

  return (
    <div className={own.doseRow} role="listitem">
      <div className={own.doseTop}>
        <span className={styles.chips} style={{ justifyContent: 'flex-start' }}>
          <Chip tone="info" label={slotLabel(row.slot)} />
          <Chip tone={row.state === 'PENDING' && isPast ? 'danger' : STATE_TONE[row.state]} label={stateLabel} />
          {dose && dose.giverName !== '' && (
            <Text type="supporting" color="secondary">
              {dose.giverName}
            </Text>
          )}
        </span>
        <div className={own.doseActions}>
          <Button label="투약함" variant={row.state === 'DONE' ? 'secondary' : 'primary'} isDisabled={draft !== null} onClick={() => open('GIVEN')} />
          <Button label="건너뜀" variant="secondary" isDisabled={draft !== null} onClick={() => open('SKIPPED')} />
          <Button label="거부" variant="secondary" isDisabled={draft !== null} onClick={() => open('REFUSED')} />
          {dose && <Button label="기록 취소" variant="ghost" isDisabled={draft !== null || deleting} onClick={() => setConfirmDelete(true)} />}
        </div>
      </div>
      <ul className={own.medList}>
        {row.medicines.map((m, i) => (
          <li key={`${m.name}-${i}`}>
            <strong>{m.name}</strong>
            {m.dose ? ` ${m.dose}` : ''} · {routeLabel(m.route)} · {timingLabel(m.timing)}
            {m.note ? ` · ${m.note}` : ''}
          </li>
        ))}
      </ul>
      {dose?.observation && (
        <div className={styles.pre}>
          <Text type="supporting" color="secondary">
            {dose.status === 'GIVEN' ? '투약 후 상태' : '사유'}: {dose.observation}
          </Text>
        </div>
      )}
      {error && draft === null && <ErrorBanner message={error} />}
      {draft && (
        <div className={own.doseForm}>
          <SegmentedControl label="처리" value={draft.status} onChange={(v) => v && setStatus(v as MedicationDoseStatus)}>
            <SegmentedControlItem value="GIVEN" label="투약함" />
            <SegmentedControlItem value="SKIPPED" label="건너뜀" />
            <SegmentedControlItem value="REFUSED" label="거부" />
          </SegmentedControl>
          {draft.status === 'GIVEN' && (
            <Text type="supporting" color="secondary">
              먹이기 전에 대상자·약·용량·경로·시간이 의뢰서와 같은지 확인했나요?
            </Text>
          )}
          <div className={styles.fieldGrid}>
            {draft.status === 'GIVEN' && <TimeField label="투약 시각" value={draft.givenAt} onChange={(v) => setDraft((d) => (d ? { ...d, givenAt: v } : d))} />}
            <TextInput label={draft.status === 'GIVEN' ? '투약한 사람' : '처리한 사람'} value={draft.giver} onChange={(v) => setDraft((d) => (d ? { ...d, giver: v.slice(0, 50) } : d))} />
          </div>
          <TextArea
            label={draft.status === 'GIVEN' ? '투약 후 상태 (선택)' : '사유 (선택)'}
            placeholder={draft.status === 'GIVEN' ? '예: 물과 함께 삼킴, 이상 반응 없음' : '예: 식사를 거부해 보호자께 알림'}
            value={draft.observation}
            onChange={(v) => setDraft((d) => (d ? { ...d, observation: v.slice(0, OBSERVATION_MAX) } : d))}
            rows={2}
            maxLength={OBSERVATION_MAX}
          />
          {error && <ErrorBanner message={error} />}
          <HStack gap={2} wrap="wrap">
            <Button label="저장" variant="primary" isLoading={saving} isDisabled={saving} onClick={() => void save()} />
            <Button label="취소" variant="ghost" isDisabled={saving} onClick={() => setDraft(null)} />
          </HStack>
        </div>
      )}
      <LabConfirm
        isOpen={confirmDelete}
        title="이 투약 기록을 취소할까요?"
        description={`${slotLabel(row.slot)} 투약 기록이 지워지고 다시 대기로 돌아갑니다.`}
        actionLabel="기록 취소"
        isLoading={deleting}
        onConfirm={() => void remove()}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  );
}
