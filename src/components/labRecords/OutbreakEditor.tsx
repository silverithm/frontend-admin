'use client';

/**
 * 감염병 유행·발생 기록 한 건 쓰기 — 종류·병명·시작일·환자 수·보호자 안내/보건소 신고/지자체·공단 보고일·조치·종료일·메모.
 * 국가 위기 경보는 단계(관심·주의·경계·심각)만 받고 신고 칸은 숨긴다. 저장은 두 번 눌러도 한 번만 나간다.
 */
import { useMemo, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { createOutbreak, deleteOutbreak, updateOutbreak } from '@/lib/lab/labApi';
import type { Outbreak, OutbreakActionKey, OutbreakAlertLevel, OutbreakKind } from '@/lib/lab/labTypes';
import { OUTBREAK_ACTIONS, OUTBREAK_GAP_LABEL, outbreakCheck } from '@/lib/lab/outbreakRules';
import { Chip, ErrorBanner, LabConfirm, LabDateInput, NumField, SupportText, useNotify } from '@/components/lab/LabUi';
import { errorText, todayString } from '@/components/lab/labFormat';
import { ALERT_LEVELS, CASES_MAX, DISEASE_MAX, NOTE_MAX, OUTBREAK_KINDS, draftFromOutbreak, newOutbreakDraft, outbreakInput, outbreakProblem, outbreakSnapshot } from './OutbreakDraft';
import type { OutbreakDraft } from './OutbreakDraft';
import { useAlive } from './recordsFormat';
import styles from './labRecords.module.css';
import own from './Outbreak.module.css';

interface Props {
  outbreak: Outbreak | null;
  onSaved: (isNew: boolean, startedOn: string) => void;
  onClose: () => void;
  onPrint: (outbreak: Outbreak) => void;
}

const num = (text: string): number | null => (text === '' || !/^\d+$/.test(text) ? null : Number(text));

export default function OutbreakEditor({ outbreak, onSaved, onClose, onPrint }: Props) {
  const notify = useNotify();
  const alive = useAlive();
  const today = todayString();
  const [initial] = useState<OutbreakDraft>(() => (outbreak ? draftFromOutbreak(outbreak) : newOutbreakDraft(today)));
  const [draft, setDraft] = useState<OutbreakDraft>(initial);
  const baseline = useMemo(() => outbreakSnapshot(initial), [initial]);
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const dirty = outbreakSnapshot(draft) !== baseline;
  const national = draft.kind === 'NATIONAL';
  const check = useMemo(
    () =>
      outbreakCheck(
        {
          kind: draft.kind,
          startedOn: draft.startedOn,
          endedOn: draft.endedOn || null,
          guardianNotifiedOn: draft.guardianOn || null,
          healthCenterReportedOn: draft.healthCenterOn || null,
          authorityReportedOn: draft.authorityOn || null,
          actions: draft.actions,
        },
        today,
      ),
    [draft, today],
  );

  const set = <K extends keyof OutbreakDraft>(key: K, value: OutbreakDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const toggleAction = (key: OutbreakActionKey, on: boolean) =>
    setDraft((d) => ({ ...d, actions: on ? (d.actions.includes(key) ? d.actions : [...d.actions, key]) : d.actions.filter((v) => v !== key) }));

  const save = async () => {
    if (lock.current) return;
    const problem = outbreakProblem(draft, today);
    if (problem) {
      setError(problem);
      return;
    }
    lock.current = true;
    setSaving(true);
    setError(null);
    try {
      const input = outbreakInput(draft);
      if (outbreak) await updateOutbreak(outbreak.id, input);
      else await createOutbreak(input);
      notify(outbreak ? '감염병 기록을 고쳤습니다' : '감염병 기록을 저장했습니다', 'success');
      onSaved(!outbreak, draft.startedOn);
    } catch (e) {
      if (alive.current) setError(errorText(e, '감염병 유행·발생 기록을 저장하지 못했습니다'));
    } finally {
      lock.current = false;
      if (alive.current) setSaving(false);
    }
  };

  const remove = async () => {
    if (!outbreak || deleting) return;
    setDeleting(true);
    try {
      await deleteOutbreak(outbreak.id);
      notify('감염병 기록을 삭제했습니다', 'success');
      onSaved(false, outbreak.startedOn);
    } catch (e) {
      if (alive.current) {
        setConfirmDelete(false);
        setError(errorText(e, '감염병 유행·발생 기록을 삭제하지 못했습니다'));
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
              {outbreak ? '감염병 유행·발생 기록 고치기' : '감염병 유행·발생 기록 쓰기'}
            </Text>
            <Text type="supporting" color="secondary">
              유행이나 확진·의심 환자가 나왔을 때 알린 날과 한 조치를 남기는 기록입니다.
            </Text>
          </div>
          <HStack gap={2} vAlign="center" wrap="wrap">
            {dirty && <Chip tone="warn" label="저장 전" />}
            <Button label="목록으로" variant="ghost" onClick={close} />
          </HStack>
        </HStack>

        <div className={own.fieldGrid}>
          <Selector
            label="종류"
            placeholder="종류 고르기"
            options={OUTBREAK_KINDS.map((k) => ({ value: k.value, label: k.label }))}
            value={draft.kind}
            onChange={(v) => v && set('kind', v as OutbreakKind)}
          />
          {national && (
            <Selector
              label="경보 단계"
              placeholder="단계 고르기"
              options={ALERT_LEVELS.map((l) => ({ value: l.value, label: l.label }))}
              value={draft.alertLevel}
              onChange={(v) => v && set('alertLevel', v as OutbreakAlertLevel)}
            />
          )}
          <TextInput label="병명·증상" placeholder="예: 독감, 노로바이러스, 발열·기침" value={draft.disease} onChange={(v) => set('disease', v.slice(0, DISEASE_MAX))} isDisabled={saving} />
          <LabDateInput label="시작일" value={draft.startedOn} onChange={(v) => set('startedOn', v)} max={today} />
        </div>

        {!national && (
          <div className={own.fieldGrid}>
            <NumField label="수급자 환자 수 (명)" value={num(draft.elderCases)} onChange={(v) => set('elderCases', v === null ? '' : String(v))} max={CASES_MAX} grouped={false} isDisabled={saving} />
            <NumField label="직원 환자 수 (명)" value={num(draft.staffCases)} onChange={(v) => set('staffCases', v === null ? '' : String(v))} max={CASES_MAX} grouped={false} isDisabled={saving} />
          </div>
        )}

        {national ? (
          <SupportText>국가 위기 경보는 보호자 안내·보건소 신고·지자체 보고를 따로 받지 않고, 경보 단계에 맞춰 한 조치만 남깁니다.</SupportText>
        ) : (
          <VStack gap={2}>
            <div className={own.fieldGrid}>
              <LabDateInput label="보호자 안내일 (선택)" value={draft.guardianOn} onChange={(v) => set('guardianOn', v)} max={today} />
              <LabDateInput label="보건소 신고일 (선택)" value={draft.healthCenterOn} onChange={(v) => set('healthCenterOn', v)} max={today} />
              <LabDateInput label="지자체·공단 보고일 (선택)" value={draft.authorityOn} onChange={(v) => set('authorityOn', v)} max={today} />
            </div>
            <div className={styles.stackTight}>
              {check.missing.length === 0 ? (
                <HStack gap={1} wrap="wrap">
                  <Chip tone="ok" label="보호자 안내·보건소 신고·지자체·공단 보고가 모두 있습니다" />
                </HStack>
              ) : (
                <>
                  <SupportText tone="warn">확진·의심 환자가 나오면 즉시 보건소에 알리고 지자체·공단에 보고해야 합니다. 아직 빈 곳:</SupportText>
                  <HStack gap={1} wrap="wrap">
                    {check.missing.map((g) => (
                      <Chip key={g} tone="warn" label={`${OUTBREAK_GAP_LABEL[g]} 빠짐`} />
                    ))}
                  </HStack>
                </>
              )}
            </div>
          </VStack>
        )}

        <VStack gap={1}>
          <Text type="label">한 조치 (해당하는 것 모두)</Text>
          <div className={own.actionGrid}>
            {OUTBREAK_ACTIONS.map((a) => (
              <CheckboxInput key={a.key} label={a.label} value={draft.actions.includes(a.key)} onChange={(on) => toggleAction(a.key, on)} isDisabled={saving} />
            ))}
          </div>
          <SupportText>평가에서는 면담과 함께 조치 자료를 봅니다. 한 조치는 빠짐없이 체크해 주세요.</SupportText>
        </VStack>

        <div className={own.fieldGrid}>
          <LabDateInput label="종료일 (선택)" value={draft.endedOn} onChange={(v) => set('endedOn', v)} max={today} />
        </div>
        {!national && <SupportText>최후 접촉자를 최대 잠복기간까지 추적해 새 발병이 없으면 종료일을 적습니다. 종료일이 비어 있으면 진행 중으로 봅니다.</SupportText>}

        <TextArea label="메모 (선택)" placeholder="예: 3층 거실 이용 수급자 위주로 발생, 보건소 방문 소독 완료" value={draft.note} onChange={(v) => set('note', v.slice(0, NOTE_MAX))} rows={3} maxLength={NOTE_MAX} isDisabled={saving} />
        <SupportText>수급자·직원 이름은 적지 마세요. 인원 수와 조치만 남깁니다.</SupportText>

        {error && <ErrorBanner message={error} />}

        <div className={styles.stickyBar}>
          <HStack gap={2} hAlign="between" vAlign="center" wrap="wrap">
            <HStack gap={1}>
              {outbreak && <Button label="삭제" variant="ghost" isDisabled={saving || deleting} onClick={() => setConfirmDelete(true)} />}
              {outbreak && <Button label="인쇄 보기" variant="ghost" isDisabled={saving || dirty} onClick={() => onPrint(outbreak)} />}
            </HStack>
            <HStack gap={2}>
              <Button label="취소" variant="ghost" isDisabled={saving} onClick={close} />
              <Button label="저장" variant="primary" isLoading={saving} isDisabled={saving || (!dirty && !!outbreak)} onClick={() => void save()} />
            </HStack>
          </HStack>
        </div>
        {outbreak && dirty && <SupportText>저장한 뒤에 인쇄 보기를 열 수 있습니다.</SupportText>}
      </VStack>

      <LabConfirm
        isOpen={confirmDelete}
        title="이 감염병 기록을 삭제할까요?"
        description="지워지면 되돌릴 수 없습니다."
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
