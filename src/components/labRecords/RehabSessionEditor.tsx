'use client';

/** 기능회복훈련 한 건 고치기 — 어르신 한 명의 세션. 반응도 여기서 고친다. */
import { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { deleteRehabSession, updateRehabSession } from '@/lib/lab/labApi';
import type { RehabKind, RehabSession } from '@/lib/lab/labTypes';
import { MAX_REHAB_MINUTES, REHAB_KINDS } from '@/lib/lab/rehabRules';
import { ErrorBanner, LabConfirm, LabDateInput, NumField, useNotify } from '@/components/lab/LabUi';
import { PROVIDER_KEY, dateLabel, errorText, todayString, writeStored } from '@/components/lab/labFormat';
import { REHAB_TEXT_MAX, draftFromSession, parseItems, sessionInput, validateSession } from './RehabDraft';
import type { RehabSessionDraft } from './RehabDraft';
import { useAlive } from './recordsFormat';
import styles from './labRecords.module.css';

interface Props {
  session: RehabSession;
  onSaved: (s: RehabSession) => void;
  onDeleted: (id: number) => void;
  onClose: () => void;
}

export default function RehabSessionEditor({ session, onSaved, onDeleted, onClose }: Props) {
  const notify = useNotify();
  const alive = useAlive();
  const [draft, setDraft] = useState<RehabSessionDraft>(() => draftFromSession(session));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const parsed = parseItems(draft.itemsText);
  const set = <K extends keyof RehabSessionDraft>(key: K, value: RehabSessionDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const save = async () => {
    if (saving) return;
    const problem = validateSession(draft);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await updateRehabSession(session.id, sessionInput(session.elderlyId, draft, session.aiAssisted));
      writeStored(PROVIDER_KEY, draft.therapist.trim());
      notify('기능회복훈련 기록을 고쳤습니다', 'success');
      onSaved(updated);
    } catch (e) {
      if (alive.current) setError(errorText(e, '기능회복훈련 기록을 고치지 못했습니다'));
    } finally {
      if (alive.current) setSaving(false);
    }
  };

  const remove = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteRehabSession(session.id);
      notify('기록을 삭제했습니다', 'success');
      onDeleted(session.id);
    } catch (e) {
      if (alive.current) {
        setConfirmDelete(false);
        setError(errorText(e, '기록을 삭제하지 못했습니다'));
      }
    } finally {
      if (alive.current) setDeleting(false);
    }
  };

  return (
    <Card padding={4}>
      <VStack gap={4}>
        <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
          <VStack gap={0.5}>
            <Text type="large" weight="semibold">
              {session.elderlyName} 어르신 훈련 기록 고치기
            </Text>
            <Text type="supporting" color="secondary">
              {dateLabel(session.sessionDate.slice(0, 10))}
            </Text>
          </VStack>
          <Button label="목록으로" variant="ghost" isDisabled={saving} onClick={onClose} />
        </HStack>
        <div className={styles.fieldGrid}>
          <LabDateInput label="훈련 날짜" value={draft.date} onChange={(v) => set('date', v)} max={todayString()} />
          <Selector label="종류" options={REHAB_KINDS.map((k) => ({ value: k.value, label: k.label }))} value={draft.kind} onChange={(v) => v && set('kind', v as RehabKind)} />
          <NumField label="훈련 시간 (분)" value={draft.minutes} onChange={(v) => set('minutes', v)} max={MAX_REHAB_MINUTES} grouped={false} />
          <TextInput label="담당자" value={draft.therapist} onChange={(v) => set('therapist', v.slice(0, 50))} />
        </div>
        <TextInput
          label="훈련 항목 (선택)"
          description="쉼표로 나눠 적으세요. 10개까지, 하나에 40자까지."
          value={draft.itemsText}
          onChange={(v) => set('itemsText', v)}
          status={parsed.error ? { type: 'error', message: parsed.error } : undefined}
        />
        <div className={styles.fieldGridWide}>
          <TextArea label="내용 (선택)" value={draft.content} onChange={(v) => set('content', v.slice(0, REHAB_TEXT_MAX.content))} rows={3} maxLength={REHAB_TEXT_MAX.content} />
          <TextArea label="반응 (선택)" value={draft.reaction} onChange={(v) => set('reaction', v.slice(0, REHAB_TEXT_MAX.reaction))} rows={3} maxLength={REHAB_TEXT_MAX.reaction} />
        </div>
        {error && <ErrorBanner message={error} />}
        <div className={styles.stickyBar}>
          <HStack gap={2} hAlign="between" vAlign="center" wrap="wrap">
            <Button label="기록 삭제" variant="ghost" isDisabled={saving || deleting} onClick={() => setConfirmDelete(true)} />
            <Button label="저장" variant="primary" isLoading={saving} isDisabled={saving} onClick={() => void save()} />
          </HStack>
        </div>
      </VStack>
      <LabConfirm
        isOpen={confirmDelete}
        title="이 기록을 삭제할까요?"
        description={`${session.elderlyName} 어르신의 ${dateLabel(session.sessionDate.slice(0, 10))} 훈련 기록이 지워지며 되돌릴 수 없습니다.`}
        actionLabel="삭제"
        isLoading={deleting}
        onConfirm={() => void remove()}
        onClose={() => setConfirmDelete(false)}
      />
    </Card>
  );
}
