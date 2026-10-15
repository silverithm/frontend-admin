'use client';

/**
 * 급여제공계획 변경 이력 한 건 쓰기 — 변경일·사유·변경 항목·변경 내용·관련 상태변화·보호자 설명/확인서명·공단 통보일.
 * 빠진 곳은 changeRecordCheck로 칩으로 보여 주고(서명·통보는 비어도 저장되지만 평가에서는 빈칸), 저장은 한 번만 나간다.
 */
import { useMemo, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { createCarePlanChange, deleteCarePlanChange, updateCarePlanChange } from '@/lib/lab/labApi';
import type { CareEvent, CarePlanChange, CarePlanChangeItem, CarePlanChangeReason } from '@/lib/lab/labTypes';
import { CHANGE_GAP_LABEL, changeRecordCheck } from '@/lib/lab/needsRules';
import { Chip, ErrorBanner, LabConfirm, LabDateInput, SupportText, useNotify } from '@/components/lab/LabUi';
import { errorText, todayString } from '@/components/lab/labFormat';
import type { LabElder } from '@/components/lab/useLabElders';
import {
  CHANGE_ITEMS,
  CHANGE_REASONS,
  DETAIL_MAX,
  REASON_NOTE_MAX,
  changeInput,
  changeProblem,
  changeSnapshot,
  draftFromChange,
  eventOptionLabel,
  newChangeDraft,
} from './ConsultationCarePlanChangeDraft';
import type { ChangeDraft, ChangePreset } from './ConsultationCarePlanChangeDraft';
import { useAlive } from './recordsFormat';
import styles from './labRecords.module.css';
import own from './ConsultationCarePlanChange.module.css';

interface Props {
  elder: LabElder;
  change: CarePlanChange | null;
  preset: ChangePreset;
  /** 이 어르신의 상태변화·사고 기록(관련 상태변화 고르기) */
  events: CareEvent[];
  onSaved: (isNew: boolean) => void;
  onClose: () => void;
  onPrint: (change: CarePlanChange) => void;
}

const NO_EVENT = 'none';

export default function ConsultationCarePlanChangeEditor({ elder, change, preset, events, onSaved, onClose, onPrint }: Props) {
  const notify = useNotify();
  const alive = useAlive();
  const today = todayString();
  const [initial] = useState<ChangeDraft>(() => (change ? draftFromChange(change) : newChangeDraft(preset)));
  const [draft, setDraft] = useState<ChangeDraft>(initial);
  const [baseline, setBaseline] = useState(() => changeSnapshot(initial));
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const dirty = changeSnapshot(draft) !== baseline;
  const gaps = useMemo(
    () => changeRecordCheck({ reasonNote: draft.reasonNote, changeItems: draft.items, guardianSignedOn: draft.signedOn || null, notifiedOn: draft.notifiedOn || null }),
    [draft],
  );

  const eventOptions = useMemo(() => {
    const sorted = [...events].sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : a.occurredAt > b.occurredAt ? -1 : b.id - a.id));
    const list = [{ value: NO_EVENT, label: '연결 안 함' }, ...sorted.map((e) => ({ value: String(e.id), label: eventOptionLabel(e) }))];
    if (draft.eventId !== null && !events.some((e) => e.id === draft.eventId)) list.push({ value: String(draft.eventId), label: '연결된 상태변화(목록에 없음)' });
    return list;
  }, [events, draft.eventId]);

  const set = <K extends keyof ChangeDraft>(key: K, value: ChangeDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const toggleItem = (item: CarePlanChangeItem, on: boolean) =>
    setDraft((d) => ({ ...d, items: on ? (d.items.includes(item) ? d.items : [...d.items, item]) : d.items.filter((v) => v !== item) }));

  const save = async () => {
    if (lock.current) return;
    const problem = changeProblem(draft, today);
    if (problem) {
      setError(problem);
      return;
    }
    lock.current = true;
    setSaving(true);
    setError(null);
    try {
      const input = changeInput(draft, elder.id);
      if (change) await updateCarePlanChange(change.id, input);
      else await createCarePlanChange(input);
      notify(change ? '계획 변경 이력을 고쳤습니다' : '계획 변경 이력을 저장했습니다', 'success');
      onSaved(!change);
      if (alive.current) setBaseline(changeSnapshot(draft));
    } catch (e) {
      if (alive.current) setError(errorText(e, '계획 변경 이력을 저장하지 못했습니다'));
    } finally {
      lock.current = false;
      if (alive.current) setSaving(false);
    }
  };

  const remove = async () => {
    if (!change || deleting) return;
    setDeleting(true);
    try {
      await deleteCarePlanChange(change.id);
      notify('계획 변경 이력을 삭제했습니다', 'success');
      onSaved(false);
    } catch (e) {
      if (alive.current) {
        setConfirmDelete(false);
        setError(errorText(e, '계획 변경 이력을 삭제하지 못했습니다'));
      }
    } finally {
      if (alive.current) setDeleting(false);
    }
  };

  const close = () => (dirty ? setConfirmClose(true) : onClose());

  return (
    <Card padding={4}>
      <VStack gap={4}>
        <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
          <div className={styles.stackTight}>
            <Text type="large" weight="semibold">
              {elder.name} · {change ? '계획 변경 이력 고치기' : '계획 변경 이력 쓰기'}
            </Text>
            <Text type="supporting" color="secondary">
              급여내용·시간·횟수를 바꿨을 때 사유와 보호자 확인, 공단 통보를 남기는 기록입니다.
            </Text>
          </div>
          <HStack gap={2} vAlign="center" wrap="wrap">
            {dirty && <Chip tone="warn" label="저장 전" />}
            <Button label="목록으로" variant="ghost" onClick={close} />
          </HStack>
        </HStack>

        <div className={own.fieldGrid}>
          <LabDateInput label="변경일" value={draft.changedOn} onChange={(v) => set('changedOn', v)} max={today} />
          <Selector
            label="변경 사유"
            placeholder="사유 고르기"
            options={CHANGE_REASONS.map((r) => ({ value: r.value, label: r.label }))}
            value={draft.reason}
            onChange={(v) => v && set('reason', v as CarePlanChangeReason)}
          />
        </div>

        <TextArea
          label="사유 서술"
          description="왜 바꾸는지 구체적으로 적어 주세요. 예: 낙상 뒤 보행이 불안정해 이동 지원 시간을 늘림"
          placeholder="변경한 사유를 적어 주세요"
          value={draft.reasonNote}
          onChange={(v) => set('reasonNote', v.slice(0, REASON_NOTE_MAX))}
          rows={3}
          maxLength={REASON_NOTE_MAX}
          isDisabled={saving}
        />

        <VStack gap={1}>
          <Text type="label">변경 항목 (한 가지 이상)</Text>
          <HStack gap={4} wrap="wrap">
            {CHANGE_ITEMS.map((i) => (
              <CheckboxInput key={i.value} label={i.label} value={draft.items.includes(i.value)} onChange={(on) => toggleItem(i.value, on)} isDisabled={saving} />
            ))}
          </HStack>
        </VStack>

        <TextArea
          label="변경 내용"
          description="무엇이 어떻게 바뀌었는지 적어 주세요. 예: 인지활동 주 2회 → 주 3회, 오후 2시 → 오전 10시"
          placeholder="바뀐 급여내용·시간·횟수를 적어 주세요"
          value={draft.detail}
          onChange={(v) => set('detail', v.slice(0, DETAIL_MAX))}
          rows={4}
          maxLength={DETAIL_MAX}
          isDisabled={saving}
        />

        <Selector
          label="관련 상태변화 (선택)"
          placeholder="상태변화·사고 기록 고르기"
          hasSearch
          searchPlaceholder="찾기"
          options={eventOptions}
          value={draft.eventId === null ? NO_EVENT : String(draft.eventId)}
          onChange={(v) => v && set('eventId', v === NO_EVENT ? null : Number(v))}
        />
        {events.length === 0 && <SupportText>이 어르신의 상태변화·사고 기록이 없어 연결할 것이 없습니다.</SupportText>}

        <div className={own.fieldGrid}>
          <LabDateInput label="보호자 설명일 (선택)" value={draft.explainedOn} onChange={(v) => set('explainedOn', v)} max={today} />
          <LabDateInput label="확인서명일 (선택)" value={draft.signedOn} onChange={(v) => set('signedOn', v)} max={today} />
          <LabDateInput label="공단 통보일 (선택)" value={draft.notifiedOn} onChange={(v) => set('notifiedOn', v)} max={today} />
        </div>
        <SupportText>변경 내용을 보호자에게 설명한 날, 보호자 확인 서명을 받은 날, 국민건강보험공단에 알린 날을 적습니다. 서명·통보가 비면 평가에서는 빠진 것으로 봅니다.</SupportText>

        <div className={styles.suggestBox}>
          <div className={styles.stackTight}>
            <Text type="label">빠진 곳 점검</Text>
            {gaps.length === 0 ? (
              <HStack gap={1} wrap="wrap">
                <Chip tone="ok" label="사유·변경 항목·보호자 확인서명·공단 통보가 모두 있습니다" />
              </HStack>
            ) : (
              <HStack gap={1} wrap="wrap">
                {gaps.map((g) => (
                  <Chip key={g} tone="warn" label={`${CHANGE_GAP_LABEL[g]} 빠짐`} />
                ))}
              </HStack>
            )}
          </div>
        </div>

        {error && <ErrorBanner message={error} />}

        <div className={styles.stickyBar}>
          <HStack gap={2} hAlign="between" vAlign="center" wrap="wrap">
            <HStack gap={1}>
              {change && <Button label="삭제" variant="ghost" isDisabled={saving || deleting} onClick={() => setConfirmDelete(true)} />}
              {change && <Button label="인쇄 보기" variant="ghost" isDisabled={saving || dirty} onClick={() => onPrint(change)} />}
            </HStack>
            <HStack gap={2}>
              <Button label="취소" variant="ghost" isDisabled={saving} onClick={close} />
              <Button label="저장" variant="primary" isLoading={saving} isDisabled={saving || (!dirty && !!change)} onClick={() => void save()} />
            </HStack>
          </HStack>
        </div>
        {change && dirty && <SupportText>저장한 뒤에 인쇄 보기를 열 수 있습니다.</SupportText>}
      </VStack>

      <LabConfirm
        isOpen={confirmDelete}
        title="이 계획 변경 이력을 삭제할까요?"
        description={`${elder.name} 어르신의 계획 변경 이력이 지워지며 되돌릴 수 없습니다.`}
        actionLabel="삭제"
        isLoading={deleting}
        onConfirm={() => void remove()}
        onClose={() => setConfirmDelete(false)}
      />
      <LabConfirm
        isOpen={confirmClose}
        title="저장하지 않은 내용이 있습니다"
        description="나가면 지금 적은 내용이 사라집니다. 그래도 나갈까요?"
        actionLabel="나가기"
        onConfirm={() => {
          setConfirmClose(false);
          onClose();
        }}
        onClose={() => setConfirmClose(false)}
      />
    </Card>
  );
}
