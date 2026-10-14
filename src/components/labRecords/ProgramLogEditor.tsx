'use client';

/**
 * 프로그램 일지 작성·수정 — 날짜·시각·분류·제목·목표·내용·반응·진행자·참여 어르신.
 * "메모로 AI 작성"은 메모만 보내 제목·목표·내용·반응 제안을 받는다. 직접 쓴 칸은 덮어쓰지 않고, 저장은 직원이 누를 때만 한다.
 */
import { useMemo, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { aiDraftProgramLog, createProgram, deleteProgram, updateProgram } from '@/lib/lab/labApi';
import type { Program } from '@/lib/lab/labTypes';
import { Chip, ErrorBanner, LabConfirm, LabDateInput, SupportText, useNotify } from '@/components/lab/LabUi';
import { PROVIDER_KEY, defaultPersonName, errorText, todayString, writeStored } from '@/components/lab/labFormat';
import type { LabElder } from '@/components/lab/useLabElders';
import PersonPicker from './PersonPicker';
import { MAX_PARTICIPANTS, PROGRAM_CATEGORIES, PROGRAM_TEXT_MAX, categoryLabel, draftFromProgram, newDraft, snapshotOf, toInput, validate } from './ProgramLogDraft';
import type { ProgramDraft, ProgramPreset, ProgramTextKey } from './ProgramLogDraft';
import { AiMemoBox, TimeField } from './RecordsUi';
import { mergeAiSuggestions, useAlive, useLatest } from './recordsFormat';
import { useElderAttendance } from './useElderAttendance';
import styles from './labRecords.module.css';

const FIELD_LABEL: Record<ProgramTextKey, string> = { title: '제목', goal: '목표', content: '내용', reaction: '어르신 반응' };

interface ProgramEditorProps {
  elders: LabElder[];
  /** 수정할 일지(없으면 새로 쓴다) */
  program: Program | null;
  preset: ProgramPreset;
  onSaved: (program: Program, isNew: boolean) => void;
  onDeleted: (id: number) => void;
  onClose: () => void;
}

export default function ProgramLogEditor({ elders, program, preset, onSaved, onDeleted, onClose }: ProgramEditorProps) {
  const notify = useNotify();
  const alive = useAlive();
  const [draft, setDraft] = useState<ProgramDraft>(() => (program ? draftFromProgram(program) : newDraft(preset, defaultPersonName())));
  const [baseline, setBaseline] = useState(() => snapshotOf(program ? draftFromProgram(program) : newDraft(preset, defaultPersonName())));
  const latest = useLatest(draft);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const attendance = useElderAttendance(draft.date || todayString());

  const dirty = snapshotOf(draft) !== baseline;
  const items = useMemo(
    () => elders.map((e) => ({ id: e.id, name: e.name, hint: e.careGrade, priority: attendance.hasData && attendance.present.has(e.id) })),
    [elders, attendance.hasData, attendance.present],
  );

  const setField = (key: ProgramTextKey, value: string) =>
    setDraft((d) => {
      const ai = { ...d.ai };
      delete ai[key]; // 사람이 손댄 칸은 더 이상 AI 제안이 아니다
      return { ...d, fields: { ...d.fields, [key]: value }, ai };
    });

  const runAi = async () => {
    const memo = latest.current.memo.trim();
    if (memo === '' || aiLoading) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const result = await aiDraftProgramLog({ note: memo, category: latest.current.category });
      if (!alive.current) return;
      // 응답이 도착한 시점의 최신 입력과 합친다 — 기다리는 동안 직접 쓴 칸은 지키고, 센 개수는 이 자리에서 바로 쓴다
      const now = latest.current;
      const merged = mergeAiSuggestions(now.fields, now.ai, result, PROGRAM_TEXT_MAX);
      setDraft((d) => ({ ...d, fields: merged.fields, ai: merged.ai, aiUsed: true, aiKept: merged.kept }));
    } catch (e) {
      if (alive.current) setAiError(errorText(e, 'AI가 프로그램 일지를 정리하지 못했습니다. 잠시 후 다시 시도해 주세요'));
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
      const input = toInput(draft, draft.aiUsed || (program?.aiAssisted ?? false));
      const saved = program ? await updateProgram(program.id, input) : await createProgram(input);
      if (draft.instructor.trim() !== '') writeStored(PROVIDER_KEY, draft.instructor.trim());
      onSaved(saved, !program);
      if (alive.current) setBaseline(snapshotOf(draft));
    } catch (e) {
      if (alive.current) setSaveError(errorText(e, '프로그램 일지를 저장하지 못했습니다'));
    } finally {
      if (alive.current) setSaving(false);
    }
  };

  const remove = async () => {
    if (!program || deleting) return;
    setDeleting(true);
    try {
      await deleteProgram(program.id);
      onDeleted(program.id);
      notify('프로그램 일지를 삭제했습니다', 'success');
    } catch (e) {
      if (alive.current) {
        setConfirmDelete(false);
        setSaveError(errorText(e, '프로그램 일지를 삭제하지 못했습니다'));
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
            {program ? '프로그램 일지 수정' : preset.from ? '프로그램 일지 (복사해서 새로)' : '프로그램 일지 작성'}
          </Text>
          <HStack gap={2} vAlign="center">
            {dirty && <Chip tone="warn" label="저장 전" />}
            <Button label="목록으로" variant="ghost" onClick={close} />
          </HStack>
        </HStack>

        <div className={styles.fieldGrid}>
          <LabDateInput label="진행 날짜" value={draft.date} onChange={(v) => setDraft((d) => ({ ...d, date: v }))} max={todayString()} isRequired />
          <TimeField label="시작 시각" value={draft.time} onChange={(v) => setDraft((d) => ({ ...d, time: v }))} />
          <Selector
            label="분류"
            options={PROGRAM_CATEGORIES.map((c) => ({ value: c, label: c === 'COGNITIVE' ? `${categoryLabel(c)} (주 3회 점검)` : categoryLabel(c) }))}
            value={draft.category}
            onChange={(v) => v && setDraft((d) => ({ ...d, category: v as ProgramDraft['category'] }))}
          />
          <TextInput label="진행자" value={draft.instructor} onChange={(v) => setDraft((d) => ({ ...d, instructor: v.slice(0, 50) }))} />
        </div>

        <AiMemoBox
          description="오늘 한 활동을 편하게 적어 주세요. 아래 제목·목표·내용·반응 칸을 AI가 나눠 정리해 줍니다."
          placeholder="예: 오전 10시에 회상 활동으로 옛날 사진을 보며 이야기 나눔. 열 분이 참여, 두 분은 졸려 하셨고 한 분은 고향 이야기를 길게 하심."
          memo={draft.memo}
          onMemoChange={(v) => setDraft((d) => ({ ...d, memo: v }))}
          buttonLabel="메모로 AI 작성"
          isLoading={aiLoading}
          onRun={() => void runAi()}
          error={aiError}
          result={draft.aiUsed ? draft.aiKept > 0 ? <SupportText>직접 쓰신 {draft.aiKept}칸은 그대로 두었습니다.</SupportText> : <SupportText>비어 있던 칸에 제안을 채웠습니다.</SupportText> : undefined}
        />

        <TextInput
          label={draft.ai.title ? `${FIELD_LABEL.title} · AI 제안` : FIELD_LABEL.title}
          value={draft.fields.title}
          onChange={(v) => setField('title', v.slice(0, PROGRAM_TEXT_MAX.title))}
          isRequired
          placeholder="예: 회상 활동 — 옛날 사진 보며 이야기하기"
        />
        <div className={styles.fieldGridWide}>
          {(['goal', 'content', 'reaction'] as const).map((key) => (
            <TextArea
              key={key}
              label={draft.ai[key] ? `${FIELD_LABEL[key]} · AI 제안` : FIELD_LABEL[key]}
              value={draft.fields[key]}
              onChange={(v) => setField(key, v)}
              rows={key === 'content' ? 5 : 3}
              maxLength={PROGRAM_TEXT_MAX[key]}
              isOptional
            />
          ))}
        </div>

        <PersonPicker
          label="참여 어르신"
          items={items}
          selected={draft.participantIds}
          onChange={(ids) => setDraft((d) => ({ ...d, participantIds: ids }))}
          priorityLabel="출석"
          max={MAX_PARTICIPANTS}
          emptyText="등록된 어르신이 없습니다"
        />
        {attendance.isLoading ? (
          <SupportText>그날 출석 정보를 불러오는 중...</SupportText>
        ) : !attendance.hasData ? (
          <SupportText>이 날은 출결 기록이 없어 출석한 분을 먼저 보여 드리지 못했습니다.</SupportText>
        ) : null}

        {saveError && <ErrorBanner message={saveError} />}

        <div className={styles.stickyBar}>
          <HStack gap={2} hAlign="between" vAlign="center" wrap="wrap">
            <div>{program && <Button label="일지 삭제" variant="ghost" isDisabled={saving || deleting} onClick={() => setConfirmDelete(true)} />}</div>
            <HStack gap={2}>
              <Button label="취소" variant="ghost" isDisabled={saving} onClick={close} />
              <Button label="저장" variant="primary" isLoading={saving} isDisabled={saving || (!dirty && !!program)} onClick={() => void save()} />
            </HStack>
          </HStack>
        </div>
      </VStack>

      <LabConfirm
        isOpen={confirmDelete}
        title="이 프로그램 일지를 삭제할까요?"
        description="지워지면 인지 프로그램 주 3회 집계에서도 빠지며 되돌릴 수 없습니다."
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
