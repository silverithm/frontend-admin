'use client';

/**
 * 직원 교육·회의 작성·수정 — 구분·날짜·범주·주제·강사·참석자·내용.
 * 법정 교육 다섯 가지는 범주에 "법정" 표시가 붙고, 참석자가 곧 직원별 연간 이수 기록이 된다.
 * "메모로 AI 작성"은 주제·내용 제안만 하고, 직접 쓴 칸은 덮어쓰지 않는다.
 */
import { useMemo, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { aiDraftTrainingLog, createStaffTraining, deleteStaffTraining, updateStaffTraining } from '@/lib/lab/labApi';
import type { LabStaff, StaffTraining, StaffTrainingKind } from '@/lib/lab/labTypes';
import { TRAINING_KIND_LABEL, isCategoryForKind } from '@/lib/lab/trainingRules';
import { Chip, ErrorBanner, LabConfirm, LabDateInput, SupportText, useNotify } from '@/components/lab/LabUi';
import { errorText, todayString } from '@/components/lab/labFormat';
import PersonPicker from './PersonPicker';
import { AiMemoBox } from './RecordsUi';
import { MAX_ATTENDEES, TRAINING_TEXT_MAX, categoryOptions, draftFromTraining, newDraft, snapshotOf, staffHint, toInput, validate } from './StaffTrainingDraft';
import type { TrainingDraft, TrainingPreset } from './StaffTrainingDraft';
import { mergeAiSuggestions, useAlive, useLatest } from './recordsFormat';
import styles from './labRecords.module.css';

interface EditorProps {
  staff: LabStaff[];
  training: StaffTraining | null;
  preset: TrainingPreset;
  onSaved: (training: StaffTraining, isNew: boolean) => void;
  onDeleted: (id: number) => void;
  onClose: () => void;
}

export default function StaffTrainingEditor({ staff, training, preset, onSaved, onDeleted, onClose }: EditorProps) {
  const notify = useNotify();
  const alive = useAlive();
  const [draft, setDraft] = useState<TrainingDraft>(() => (training ? draftFromTraining(training) : newDraft(preset)));
  const [baseline, setBaseline] = useState(() => snapshotOf(training ? draftFromTraining(training) : newDraft(preset)));
  const latest = useLatest(draft);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const dirty = snapshotOf(draft) !== baseline;
  const items = useMemo(() => staff.map((s) => ({ id: s.id, name: s.name, hint: staffHint(s) })), [staff]);

  const setKind = (value: string) => {
    const kind = value as StaffTrainingKind;
    setDraft((d) => (d.kind === kind ? d : { ...d, kind, category: isCategoryForKind(kind, d.category) ? d.category : kind === 'TRAINING' ? 'ELDER_ABUSE' : 'STAFF' }));
  };
  const setField = (key: 'topic' | 'content', value: string) =>
    setDraft((d) => {
      const ai = { ...d.ai };
      delete ai[key];
      return { ...d, fields: { ...d.fields, [key]: value }, ai };
    });

  const runAi = async () => {
    const now0 = latest.current;
    const memo = now0.memo.trim();
    if (memo === '' || aiLoading) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const result = await aiDraftTrainingLog({ note: memo, kind: now0.kind, category: now0.category });
      if (!alive.current) return;
      const points = result.keyPoints.filter((k) => k.trim() !== '');
      const content = [result.content.trim(), points.length > 0 ? `핵심 내용\n${points.map((k) => `- ${k.trim()}`).join('\n')}` : ''].filter((t) => t !== '').join('\n\n');
      const now = latest.current;
      const merged = mergeAiSuggestions(now.fields, now.ai, { topic: result.topic, content }, TRAINING_TEXT_MAX);
      setDraft((d) => ({ ...d, fields: merged.fields, ai: merged.ai, aiUsed: true, aiKept: merged.kept }));
    } catch (e) {
      if (alive.current) setAiError(errorText(e, 'AI가 교육·회의 기록을 정리하지 못했습니다. 잠시 후 다시 시도해 주세요'));
    } finally {
      if (alive.current) setAiLoading(false);
    }
  };

  const save = async () => {
    if (saving) return;
    const problem = validate(draft);
    if (problem) {
      setSaveError(problem);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const input = toInput(draft, draft.aiUsed || (training?.aiAssisted ?? false));
      const saved = training ? await updateStaffTraining(training.id, input) : await createStaffTraining(input);
      onSaved(saved, !training);
      if (alive.current) setBaseline(snapshotOf(draft));
    } catch (e) {
      if (alive.current) setSaveError(errorText(e, '직원 교육·회의 기록을 저장하지 못했습니다'));
    } finally {
      if (alive.current) setSaving(false);
    }
  };

  const remove = async () => {
    if (!training || deleting) return;
    setDeleting(true);
    try {
      await deleteStaffTraining(training.id);
      onDeleted(training.id);
      notify('교육·회의 기록을 삭제했습니다', 'success');
    } catch (e) {
      if (alive.current) {
        setConfirmDelete(false);
        setSaveError(errorText(e, '직원 교육·회의 기록을 삭제하지 못했습니다'));
      }
    } finally {
      if (alive.current) setDeleting(false);
    }
  };

  const close = () => (dirty ? setConfirmClose(true) : onClose());
  const kindLabel = TRAINING_KIND_LABEL[draft.kind];

  return (
    <Card padding={4}>
      <VStack gap={4}>
        <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
          <Text type="large" weight="semibold">
            {training ? `${kindLabel} 기록 수정` : `${kindLabel} 기록 작성`}
          </Text>
          <HStack gap={2} vAlign="center">
            {dirty && <Chip tone="warn" label="저장 전" />}
            <Button label="목록으로" variant="ghost" onClick={close} />
          </HStack>
        </HStack>

        <SegmentedControl label="구분" value={draft.kind} onChange={setKind}>
          <SegmentedControlItem value="TRAINING" label="교육" />
          <SegmentedControlItem value="MEETING" label="회의" />
        </SegmentedControl>

        <div className={styles.fieldGrid}>
          <LabDateInput label="진행 날짜" value={draft.date} onChange={(v) => setDraft((d) => ({ ...d, date: v }))} max={todayString()} />
          <Selector placeholder="고르기" label="범주" options={categoryOptions(draft.kind)} value={draft.category} onChange={(v) => v && setDraft((d) => ({ ...d, category: v as TrainingDraft['category'] }))} />
          <TextInput label="강사·진행자 (선택)" value={draft.instructor} onChange={(v) => setDraft((d) => ({ ...d, instructor: v.slice(0, 50) }))} />
        </div>

        <AiMemoBox
          description="교육·회의에서 나온 이야기를 편하게 적어 주세요. 주제와 내용 칸을 AI가 정리해 줍니다."
          placeholder="예: 감염 예방 교육. 손 씻기 6단계 시연, 노로바이러스 의심 시 격리와 소독 순서, 마스크 착용 기준 안내."
          memo={draft.memo}
          onMemoChange={(v) => setDraft((d) => ({ ...d, memo: v }))}
          buttonLabel="메모로 AI 작성"
          isLoading={aiLoading}
          onRun={() => void runAi()}
          error={aiError}
          result={draft.aiUsed ? <SupportText>{draft.aiKept > 0 ? `직접 쓰신 ${draft.aiKept}칸은 그대로 두었습니다.` : '비어 있던 칸에 제안을 채웠습니다.'}</SupportText> : undefined}
        />

        <TextInput
          label={draft.ai.topic ? '주제 · AI 제안' : '주제'}
          value={draft.fields.topic}
          onChange={(v) => setField('topic', v.slice(0, TRAINING_TEXT_MAX.topic))}
          placeholder="예: 2026년 노인학대 예방 교육"
        />
        <TextArea
          label={draft.ai.content ? '내용 (선택) · AI 제안' : '내용 (선택)'}
          value={draft.fields.content}
          onChange={(v) => setField('content', v)}
          rows={6}
          maxLength={TRAINING_TEXT_MAX.content}
        />

        <PersonPicker label="참석 직원" items={items} selected={draft.attendeeIds} onChange={(ids) => setDraft((d) => ({ ...d, attendeeIds: ids }))} max={MAX_ATTENDEES} emptyText="등록된 직원이 없습니다" />
        {draft.kind === 'MEETING' && <SupportText>회의는 법정 교육 이수 현황에는 들어가지 않습니다.</SupportText>}

        {saveError && <ErrorBanner message={saveError} />}

        <div className={styles.stickyBar}>
          <HStack gap={2} hAlign="between" vAlign="center" wrap="wrap">
            <div>{training && <Button label="기록 삭제" variant="ghost" isDisabled={saving || deleting} onClick={() => setConfirmDelete(true)} />}</div>
            <HStack gap={2}>
              <Button label="취소" variant="ghost" isDisabled={saving} onClick={close} />
              <Button label="저장" variant="primary" isLoading={saving} isDisabled={saving || (!dirty && !!training)} onClick={() => void save()} />
            </HStack>
          </HStack>
        </div>
      </VStack>

      <LabConfirm
        isOpen={confirmDelete}
        title="이 기록을 삭제할까요?"
        description="지우면 참석자들의 연간 법정 교육 이수 현황에서도 빠지며 되돌릴 수 없습니다."
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
