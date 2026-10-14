'use client';

/** 의견수렴 기록 작성·수정 — 반기·수렴일·방법·참여 인원·의견 요약·반영 내용·반영일. */
import { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { createProgramFeedback, deleteProgramFeedback, updateProgramFeedback } from '@/lib/lab/labApi';
import type { FeedbackMethod, ProgramFeedback } from '@/lib/lab/labTypes';
import { FEEDBACK_METHODS, halfLabel, halfOfDate } from '@/lib/lab/programPlanRules';
import { Chip, ErrorBanner, LabConfirm, LabDateInput, NumField, SupportText } from '@/components/lab/LabUi';
import { defaultPersonName, errorText, todayString } from '@/components/lab/labFormat';
import { MAX_FEEDBACK_PEOPLE, MAX_FEEDBACK_TEXT, MAX_WRITER, feedbackDraftOf, feedbackInputOf, feedbackSnapshot, newFeedbackDraft, validateFeedback } from './ProgramPlanDraft';
import type { FeedbackDraft } from './ProgramPlanDraft';
import { useAlive } from './recordsFormat';
import styles from './labRecords.module.css';

interface Props {
  year: number;
  feedback: ProgramFeedback | null;
  onSaved: (saved: ProgramFeedback, isNew: boolean) => void;
  onDeleted: (id: number) => void;
  onClose: () => void;
}

export default function ProgramPlanFeedbackEditor({ year, feedback, onSaved, onDeleted, onClose }: Props) {
  const alive = useAlive();
  const initial = () => (feedback ? feedbackDraftOf(feedback) : newFeedbackDraft(todayString().startsWith(`${year}-`) ? todayString() : `${year}-01-01`, defaultPersonName()));
  const [draft, setDraft] = useState<FeedbackDraft>(initial);
  const [baseline] = useState(() => feedbackSnapshot(initial()));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  const dirty = feedbackSnapshot(draft) !== baseline;
  const set = <K extends keyof FeedbackDraft>(key: K, value: FeedbackDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const half = halfOfDate(draft.collectedOn);

  const save = async () => {
    if (saving) return;
    const problem = validateFeedback(draft, year);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const input = feedbackInputOf(draft, feedback?.aiAssisted ?? false);
      const result = feedback ? await updateProgramFeedback(feedback.id, input) : await createProgramFeedback(input);
      onSaved(result, !feedback);
    } catch (e) {
      if (alive.current) setError(errorText(e, '의견수렴 기록을 저장하지 못했습니다'));
    } finally {
      if (alive.current) setSaving(false);
    }
  };

  const remove = async () => {
    if (!feedback || deleting) return;
    setDeleting(true);
    try {
      await deleteProgramFeedback(feedback.id);
      onDeleted(feedback.id);
    } catch (e) {
      if (alive.current) {
        setConfirmDelete(false);
        setError(errorText(e, '의견수렴 기록을 삭제하지 못했습니다'));
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
          <Text type="large" weight="semibold">
            {feedback ? '의견수렴 기록 고치기' : '의견수렴 기록 작성'}
          </Text>
          <HStack gap={2} vAlign="center">
            {dirty && <Chip tone="warn" label="저장 전" />}
            <Button label="닫기" variant="ghost" onClick={close} />
          </HStack>
        </HStack>
        <div className={styles.fieldGrid}>
          <LabDateInput label="의견을 모은 날" value={draft.collectedOn} onChange={(v) => set('collectedOn', v)} />
          <Selector
            label="방법"
            placeholder="방법 고르기"
            options={FEEDBACK_METHODS.map((m) => ({ value: m.value, label: m.label }))}
            value={draft.method}
            onChange={(v) => v && set('method', v as FeedbackMethod)}
          />
          <NumField label="참여 인원(명)" value={draft.participants} onChange={(v) => set('participants', v)} max={MAX_FEEDBACK_PEOPLE} grouped={false} placeholder="예: 12" />
          <TextInput label="작성자" value={draft.writerName} onChange={(v) => set('writerName', v.slice(0, MAX_WRITER))} />
        </div>
        <SupportText>{half ? `이 기록은 ${halfLabel(half)} 의견수렴으로 셉니다.` : '날짜를 고르면 상반기·하반기가 정해집니다.'}</SupportText>
        <TextArea label="의견 요약" description="어르신·보호자가 바란 것을 요약해 주세요. 이름은 적지 않아도 됩니다" placeholder="예: 오후에 몸을 움직이는 활동을 늘려 달라는 의견이 많았고, 노래교실을 좋아하셨다" value={draft.summary} onChange={(v) => set('summary', v)} rows={5} maxLength={MAX_FEEDBACK_TEXT} />
        <div className={styles.fieldGridWide}>
          <TextArea label="반영 내용 (선택)" description="의견을 프로그램에 어떻게 반영했는지" placeholder="예: 10월부터 오후 신체 프로그램을 주 1회 늘림" value={draft.reflection} onChange={(v) => set('reflection', v)} rows={4} maxLength={MAX_FEEDBACK_TEXT} />
          <LabDateInput label="반영일 (선택)" value={draft.reflectedOn} onChange={(v) => set('reflectedOn', v)} />
        </div>
        {error && <ErrorBanner message={error} />}
        <div className={styles.stickyBar}>
          <HStack gap={2} hAlign="between" vAlign="center" wrap="wrap">
            <div>{feedback && <Button label="기록 삭제" variant="ghost" isDisabled={saving || deleting} onClick={() => setConfirmDelete(true)} />}</div>
            <HStack gap={2}>
              <Button label="취소" variant="ghost" isDisabled={saving} onClick={close} />
              <Button label="저장" variant="primary" isLoading={saving} isDisabled={saving || (!dirty && !!feedback)} onClick={() => void save()} />
            </HStack>
          </HStack>
        </div>
      </VStack>
      <LabConfirm isOpen={confirmDelete} title="이 의견수렴 기록을 삭제할까요?" description="삭제하면 반기별 수렴 현황에서도 빠지며 되돌릴 수 없습니다." actionLabel="삭제" isLoading={deleting} onConfirm={() => void remove()} onClose={() => setConfirmDelete(false)} />
      <LabConfirm
        isOpen={confirmClose}
        title="저장하지 않은 내용이 있습니다"
        description="닫으면 지금 적은 내용이 사라집니다. 그래도 닫을까요?"
        actionLabel="닫기"
        onConfirm={() => {
          setConfirmClose(false);
          onClose();
        }}
        onClose={() => setConfirmClose(false)}
      />
    </Card>
  );
}
