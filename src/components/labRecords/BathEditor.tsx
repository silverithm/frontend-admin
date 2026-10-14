'use client';

/**
 * 목욕 일지 편집기 — 어르신 한 명의 한 번.
 * 위에서 아래로: 어르신·날짜·시각(분은 자동) → 방법·제공 요양보호사 → 메모로 AI 정리(제안) → 목욕 전 상태·피부 관찰·메모 → 저장.
 * 목욕 중 몸을 씻기는 일은 요양보호사가 한다(고시 제35조) — 제공자 칸에는 그 요양보호사를 적는다.
 */
import { useMemo, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { aiStructureBathNote, createBathLog, deleteBathLog, updateBathLog } from '@/lib/lab/labApi';
import type { BathLog, BathMethod } from '@/lib/lab/labTypes';
import { BATH_METHODS } from '@/lib/lab/bathRules';
import { AiChip, Chip, ErrorBanner, LabConfirm, LabDateInput, SupportText, useNotify } from '@/components/lab/LabUi';
import { PROVIDER_KEY, dateLabel, errorText, todayString, writeStored } from '@/components/lab/labFormat';
import type { LabElder } from '@/components/lab/useLabElders';
import { BATH_TEXT_MAX, bathInput, bathProblems, draftFromBath, minutesHint, newBathDraft } from './BathDraft';
import type { BathDraft, BathTextKey } from './BathDraft';
import { AiMemoBox, TimeField } from './RecordsUi';
import { mergeAiSuggestions, useAlive } from './recordsFormat';
import styles from './labRecords.module.css';

interface Props {
  elders: LabElder[];
  log: BathLog | null;
  presetElderId: number | null;
  presetDate: string;
  onSaved: () => void;
  onClose: () => void;
}

const snapshot = (d: BathDraft) => JSON.stringify([d.elderId, d.date, d.start, d.end, d.method, d.provider, d.preCheck, d.skinNote, d.note]);

export default function BathEditor({ elders, log, presetElderId, presetDate, onSaved, onClose }: Props) {
  const notify = useNotify();
  const alive = useAlive();
  const [initial] = useState<BathDraft>(() => (log ? draftFromBath(log) : newBathDraft(presetElderId, presetDate)));
  const [draft, setDraft] = useState<BathDraft>(initial);
  const [baseline] = useState(() => snapshot(initial));
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const hint = useMemo(() => minutesHint(draft.start, draft.end), [draft.start, draft.end]);
  const problems = useMemo(() => bathProblems(draft), [draft]);
  const dirty = snapshot(draft) !== baseline;
  const elderName = elders.find((e) => e.id === draft.elderId)?.name ?? log?.elderlyName ?? '';

  const setText = (key: BathTextKey, value: string) =>
    setDraft((d) => {
      const ai = { ...d.ai };
      delete ai[key];
      return { ...d, [key]: value.slice(0, BATH_TEXT_MAX[key]), ai };
    });

  const runAi = async () => {
    if (aiLoading || draft.memo.trim() === '') return;
    setAiLoading(true);
    setAiError(null);
    try {
      const r = await aiStructureBathNote({ note: draft.memo.trim() });
      if (!alive.current) return;
      setDraft((d) => {
        const merged = mergeAiSuggestions<BathTextKey>(
          { preCheck: d.preCheck, skinNote: d.skinNote, note: d.note },
          d.ai,
          { preCheck: r.preCheck, skinNote: r.skinNote, note: r.note },
          BATH_TEXT_MAX,
        );
        return {
          ...d,
          preCheck: merged.fields.preCheck,
          skinNote: merged.fields.skinNote,
          note: merged.fields.note,
          ai: merged.ai,
          method: d.methodTouched || !r.method ? d.method : r.method,
          aiUsed: true,
          aiKept: merged.kept,
        };
      });
    } catch (e) {
      if (alive.current) setAiError(errorText(e, 'AI가 목욕 메모를 정리하지 못했습니다. 잠시 뒤 다시 눌러 주세요'));
    } finally {
      if (alive.current) setAiLoading(false);
    }
  };

  const save = async () => {
    if (saving) return;
    setSubmitted(true);
    if (problems.length > 0) {
      setError('아래 빨간 안내를 확인해 주세요');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const input = bathInput(draft);
      if (log) await updateBathLog(log.id, input);
      else await createBathLog(input);
      writeStored(PROVIDER_KEY, draft.provider.trim());
      notify(log ? '목욕 일지를 고쳤습니다' : '목욕 일지를 저장했습니다', 'success');
      onSaved();
      if (alive.current) onClose();
    } catch (e) {
      if (alive.current) setError(errorText(e, '목욕 일지를 저장하지 못했습니다'));
    } finally {
      if (alive.current) setSaving(false);
    }
  };

  const remove = async () => {
    if (!log || deleting) return;
    setDeleting(true);
    try {
      await deleteBathLog(log.id);
      notify('목욕 일지를 삭제했습니다', 'success');
      onSaved();
      if (alive.current) onClose();
    } catch (e) {
      if (alive.current) {
        setConfirmDelete(false);
        setError(errorText(e, '목욕 일지를 삭제하지 못했습니다'));
      }
    } finally {
      if (alive.current) setDeleting(false);
    }
  };

  const text = (key: BathTextKey, label: string, rows: number, placeholder: string) => (
    <TextArea
      label={`${label} (선택)${draft.ai[key] ? ' · AI 제안' : ''}`}
      placeholder={placeholder}
      value={draft[key]}
      onChange={(v) => setText(key, v)}
      rows={rows}
      maxLength={BATH_TEXT_MAX[key]}
    />
  );

  return (
    <Card padding={4}>
      <VStack gap={4}>
        <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
          <VStack gap={0.5}>
            <Text type="large" weight="semibold">
              {log ? '목욕 일지 고치기' : '새 목욕 일지'}
            </Text>
            <Text type="supporting" color="secondary">
              {elderName ? `${elderName} 어르신 · ${dateLabel(draft.date)}` : '어르신을 먼저 골라 주세요'}
            </Text>
          </VStack>
          <HStack gap={2} vAlign="center" wrap="wrap">
            {dirty && <Chip tone="warn" label="저장 전" />}
            <Button label="목록으로" variant="ghost" isDisabled={saving} onClick={() => (dirty ? setConfirmLeave(true) : onClose())} />
          </HStack>
        </HStack>

        <div className={styles.fieldGridWide}>
          <Selector
            label="어르신"
            placeholder="어르신 고르기"
            hasSearch={elders.length > 8}
            searchPlaceholder="찾기"
            options={elders.map((e) => ({ value: String(e.id), label: e.name }))}
            value={draft.elderId === null ? '' : String(draft.elderId)}
            onChange={(v) => v && setDraft((d) => ({ ...d, elderId: Number(v) }))}
          />
          <LabDateInput label="목욕한 날" value={draft.date} onChange={(v) => setDraft((d) => ({ ...d, date: v }))} max={todayString()} />
        </div>

        <div className={styles.fieldGrid}>
          <TimeField label="시작 시각" value={draft.start} onChange={(v) => setDraft((d) => ({ ...d, start: v }))} />
          <TimeField label="끝나는 시각" value={draft.end} onChange={(v) => setDraft((d) => ({ ...d, end: v }))} />
          <div>
            <Text type="label">소요 시간</Text>
            <div style={{ minHeight: 32, display: 'flex', alignItems: 'center' }} aria-live="polite">
              {hint.minutes !== null ? (
                <Chip tone="ok" label={`${hint.minutes.toLocaleString('ko-KR')}분`} />
              ) : (
                <Text type="supporting" color="secondary">
                  시각을 적으면 자동 계산
                </Text>
              )}
            </div>
          </div>
        </div>
        {hint.problem && <SupportText tone="error">{hint.problem}</SupportText>}

        <div className={styles.fieldGridWide}>
          <Selector
            label="목욕 방법"
            placeholder="고르기"
            options={BATH_METHODS.map((m) => ({ value: m.value, label: m.label }))}
            value={draft.method}
            onChange={(v) => v && setDraft((d) => ({ ...d, method: v as BathMethod, methodTouched: true }))}
          />
          <TextInput
            label="제공 요양보호사"
            description="몸을 씻기는 일은 요양보호사가 합니다. 그 요양보호사 이름을 적어 주세요."
            placeholder="요양보호사 이름"
            value={draft.provider}
            onChange={(v) => setDraft((d) => ({ ...d, provider: v.slice(0, 50) }))}
          />
        </div>

        <AiMemoBox
          label="목욕 메모"
          description="목욕하며 본 것을 편하게 적어 주세요. 목욕 방법·목욕 전 상태·피부 관찰·메모 칸을 AI가 제안합니다. 시각은 적지 않아도 됩니다."
          placeholder="예: 어깨와 등이 조금 붉었고 크림 발라 드림. 목욕 전 혈압 안정, 기분 좋아하심. 의자에 앉아 샤워."
          memo={draft.memo}
          onMemoChange={(v) => setDraft((d) => ({ ...d, memo: v }))}
          buttonLabel="메모로 AI 정리"
          isLoading={aiLoading}
          onRun={() => void runAi()}
          error={aiError}
          isDisabled={saving}
          result={draft.aiUsed ? <SupportText>{draft.aiKept > 0 ? `직접 쓰신 ${draft.aiKept}칸은 그대로 두었습니다.` : '비어 있던 칸에 제안을 채웠습니다.'} 목욕 방법도 확인해 주세요.</SupportText> : undefined}
        />

        <div className={styles.fieldGridWide}>
          {text('preCheck', '목욕 전 상태', 2, '예: 혈압 안정, 컨디션 좋음')}
          {text('skinNote', '피부 관찰', 2, '예: 등에 붉은 자국, 욕창 부위 이상 없음')}
        </div>
        {text('note', '메모', 2, '특이사항이 있으면 적어 주세요')}

        {submitted && problems.length > 0 && (
          <div className={styles.errorText}>
            <ul style={{ margin: 0, paddingInlineStart: 'var(--spacing-4)' }}>
              {problems.map((p) => (
                <li key={p}>
                  <Text type="supporting" color="inherit">
                    {p}
                  </Text>
                </li>
              ))}
            </ul>
          </div>
        )}
        {error && <ErrorBanner message={error} />}
        <div className={styles.stickyBar}>
          <HStack gap={2} hAlign="between" vAlign="center" wrap="wrap">
            {log ? <Button label="일지 삭제" variant="ghost" isDisabled={saving || deleting} onClick={() => setConfirmDelete(true)} /> : <span />}
            <HStack gap={2} vAlign="center">
              {draft.aiUsed && <AiChip label="AI 제안 포함" />}
              <Button label="저장" variant="primary" isLoading={saving} isDisabled={saving} onClick={() => void save()} />
            </HStack>
          </HStack>
        </div>
      </VStack>
      <LabConfirm
        isOpen={confirmDelete}
        title="이 목욕 일지를 삭제할까요?"
        description={`${elderName} 어르신의 ${dateLabel(draft.date)} 목욕 일지가 지워지며 되돌릴 수 없습니다.`}
        actionLabel="삭제"
        isLoading={deleting}
        onConfirm={() => void remove()}
        onClose={() => setConfirmDelete(false)}
      />
      <LabConfirm isOpen={confirmLeave} title="저장하지 않고 나갈까요?" description="고친 내용이 사라집니다." actionLabel="나가기" onConfirm={onClose} onClose={() => setConfirmLeave(false)} />
    </Card>
  );
}
