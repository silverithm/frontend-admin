'use client';

/**
 * 여러 어르신 한 번에 기록 — 같은 훈련을 한 반이 함께 했을 때. 어르신을 고르고, 종류·시간·항목·내용·담당을 한 번만 적는다.
 * 반응은 어르신마다 달라 저장한 뒤 따로 적는다. 메모를 적으면 AI가 종류·분·항목·내용을 제안한다(분이 메모에 없으면 빈칸 그대로).
 */
import { useMemo, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { aiStructureRehabLog, createRehabSessionsBatch } from '@/lib/lab/labApi';
import type { RehabKind, RehabSession } from '@/lib/lab/labTypes';
import { MAX_REHAB_MINUTES, REHAB_KINDS } from '@/lib/lab/rehabRules';
import { ErrorBanner, LabDateInput, NumField, SupportText, useNotify } from '@/components/lab/LabUi';
import { PROVIDER_KEY, dateLabel, defaultPersonName, errorText, todayString, writeStored } from '@/components/lab/labFormat';
import type { LabElder } from '@/components/lab/useLabElders';
import PersonPicker from './PersonPicker';
import { REHAB_TEXT_MAX, itemsText, newFormDraft, parseItems, validateForm } from './RehabDraft';
import type { RehabFormDraft } from './RehabDraft';
import { AiMemoBox } from './RecordsUi';
import { useAlive } from './recordsFormat';
import { useElderAttendance } from './useElderAttendance';
import styles from './labRecords.module.css';

interface Props {
  elders: LabElder[];
  date: string;
  onSaved: (sessions: RehabSession[], aiReaction: string) => void;
  onClose: () => void;
}

export default function RehabBatchForm({ elders, date, onSaved, onClose }: Props) {
  const notify = useNotify();
  const alive = useAlive();
  const [draft, setDraft] = useState<RehabFormDraft>(() => newFormDraft(date, defaultPersonName()));
  const [ids, setIds] = useState<number[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attendance = useElderAttendance(draft.date || todayString());

  const items = useMemo(
    () => elders.map((e) => ({ id: e.id, name: e.name, priority: attendance.hasData && attendance.present.has(e.id) })),
    [elders, attendance.hasData, attendance.present],
  );
  const parsed = parseItems(draft.itemsText);

  const runAi = async () => {
    if (aiLoading || draft.memo.trim() === '') return;
    setAiLoading(true);
    setAiError(null);
    try {
      const r = await aiStructureRehabLog({ note: draft.memo.trim(), kind: draft.kindTouched ? draft.kind : undefined });
      if (!alive.current) return;
      const notes: string[] = [];
      setDraft((d) => ({
        ...d,
        kind: !d.kindTouched && r.kind ? r.kind : d.kind,
        // 메모에 분이 없으면 AI는 null을 준다 — 빈칸 그대로 두고 직원이 적게 한다
        minutes: r.minutes !== null && d.minutes === null ? r.minutes : d.minutes,
        itemsText: d.itemsText.trim() === '' && r.items.length > 0 ? itemsText(r.items) : d.itemsText,
        content: d.content.trim() === '' || d.contentAi ? r.content.slice(0, REHAB_TEXT_MAX.content) : d.content,
        contentAi: d.content.trim() === '' || d.contentAi ? r.content.trim() !== '' : d.contentAi,
        aiUsed: true,
        aiReaction: r.reaction ?? '',
      }));
      if (r.minutes === null) notes.push('메모에 훈련 시간이 없어 분은 비워 두었습니다. 직접 적어 주세요.');
      if (r.reaction) notes.push('반응은 어르신마다 달라, 저장한 뒤 어르신별 칸에서 고를 수 있게 남겨 두었습니다.');
      setAiNote(notes.join(' '));
    } catch (e) {
      if (alive.current) setAiError(errorText(e, 'AI가 메모를 정리하지 못했습니다. 잠시 뒤 다시 눌러 주세요'));
    } finally {
      if (alive.current) setAiLoading(false);
    }
  };

  const save = async () => {
    if (saving) return;
    const problem = validateForm(draft) ?? (ids.length === 0 ? '기록할 어르신을 한 명 이상 골라 주세요' : null);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const sessions = await createRehabSessionsBatch({
        elderlyIds: ids,
        sessionDate: draft.date,
        kind: draft.kind,
        minutes: draft.minutes as number,
        items: parsed.items,
        content: draft.content.trim() === '' ? null : draft.content.trim(),
        therapistName: draft.therapist.trim(),
        aiAssisted: draft.aiUsed,
      });
      writeStored(PROVIDER_KEY, draft.therapist.trim());
      notify(`${sessions.length}명의 기능회복훈련을 기록했습니다`, 'success');
      onSaved(sessions, draft.aiReaction);
    } catch (e) {
      if (alive.current) setError(errorText(e, '기능회복훈련을 한 번에 기록하지 못했습니다'));
    } finally {
      if (alive.current) setSaving(false);
    }
  };

  return (
    <Card padding={4}>
      <VStack gap={4}>
        <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
          <VStack gap={0.5}>
            <Text type="large" weight="semibold">
              여러 어르신 한 번에 기록
            </Text>
            <Text type="supporting" color="secondary">
              {dateLabel(draft.date)} · 같은 훈련을 함께 한 어르신을 고르고 한 번만 적습니다
            </Text>
          </VStack>
          <Button label="취소" variant="ghost" isDisabled={saving} onClick={onClose} />
        </HStack>

        <div className={styles.fieldGrid}>
          <LabDateInput label="훈련 날짜" value={draft.date} onChange={(v) => setDraft((d) => ({ ...d, date: v }))} max={todayString()} />
          <Selector
            label="종류"
            options={REHAB_KINDS.map((k) => ({ value: k.value, label: k.label }))}
            value={draft.kind}
            onChange={(v) => v && setDraft((d) => ({ ...d, kind: v as RehabKind, kindTouched: true }))}
          />
          <NumField label="훈련 시간 (분)" value={draft.minutes} onChange={(v) => setDraft((d) => ({ ...d, minutes: v }))} max={MAX_REHAB_MINUTES} grouped={false} placeholder="예: 30" />
          <TextInput label="담당자" value={draft.therapist} onChange={(v) => setDraft((d) => ({ ...d, therapist: v.slice(0, 50) }))} />
        </div>

        <PersonPicker label="어르신" items={items} selected={ids} onChange={setIds} priorityLabel="출석" max={50} isDisabled={saving} emptyText="등록된 어르신이 없습니다" />
        {attendance.error && <SupportText>{attendance.error}</SupportText>}
        {!attendance.isLoading && !attendance.error && !attendance.hasData && <SupportText>이 날 출결 기록이 없어 출석한 분을 따로 보여 주지 못합니다.</SupportText>}

        <AiMemoBox
          description="오늘 한 훈련을 편하게 적어 주세요. 종류·시간·항목·내용 칸을 AI가 제안합니다."
          placeholder="예: 오전 반 열 분이 함께 평행봉 걷기와 계단 오르기를 30분 했습니다. 대체로 잘 따라 하셨고 한 분은 중간에 쉬었습니다."
          memo={draft.memo}
          onMemoChange={(v) => setDraft((d) => ({ ...d, memo: v }))}
          buttonLabel="메모로 AI 정리"
          isLoading={aiLoading}
          onRun={() => void runAi()}
          error={aiError}
          result={draft.aiUsed && aiNote !== null ? <SupportText>{aiNote === '' ? '비어 있던 칸에 제안을 채웠습니다.' : aiNote}</SupportText> : undefined}
        />

        <TextInput
          label="훈련 항목 (선택)"
          description="쉼표로 나눠 적으세요. 10개까지, 하나에 40자까지."
          value={draft.itemsText}
          onChange={(v) => setDraft((d) => ({ ...d, itemsText: v }))}
          placeholder="평행봉 걷기, 계단 오르기"
          status={parsed.error ? { type: 'error', message: parsed.error } : undefined}
        />
        <TextArea
          label={draft.contentAi ? '내용 (선택) · AI 제안' : '내용 (선택)'}
          value={draft.content}
          onChange={(v) => setDraft((d) => ({ ...d, content: v.slice(0, REHAB_TEXT_MAX.content), contentAi: false }))}
          rows={3}
          maxLength={REHAB_TEXT_MAX.content}
          placeholder="훈련을 어떻게 진행했는지"
        />

        {error && <ErrorBanner message={error} />}
        <div className={styles.stickyBar}>
          <HStack gap={2} hAlign="between" vAlign="center" wrap="wrap">
            <Text type="supporting" color="secondary">
              {ids.length}명 선택
            </Text>
            <Button label={ids.length > 0 ? `${ids.length}명 기록하기` : '기록하기'} variant="primary" isLoading={saving} isDisabled={saving} onClick={() => void save()} />
          </HStack>
        </div>
      </VStack>
    </Card>
  );
}
