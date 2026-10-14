'use client';

/**
 * 점검표 작성 — 항목마다 적합·부적합·해당 없음, 메모, 부적합이 있으면 조치 내용(AI 제안 가능).
 * "아직 답하지 않은 항목을 모두 적합으로"로 매일 점검을 빠르게 끝낼 수 있다. 저장은 직원이 누를 때만 한다.
 * 화면 윗부분이 날짜·종류를 바꾸면 이 화면은 새로 만들어진다(key) — 그래서 늦게 온 AI 응답은 자연히 버려진다.
 */
import { useEffect, useMemo, useState } from 'react';
import type { MutableRefObject } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { aiDraftSafetyActions, deleteSafetyCheck, saveSafetyCheck } from '@/lib/lab/labApi';
import type { SafetyCheck, SafetyKind } from '@/lib/lab/labTypes';
import { MAX_SAFETY_ACTIONS, MAX_SAFETY_NOTE, SAFETY_CADENCE_LABEL, templateFor } from '@/lib/lab/safetyRules';
import { AiChip, Chip, ErrorBanner, LabConfirm, SupportText, useNotify } from '@/components/lab/LabUi';
import { PROVIDER_KEY, dateLabel, defaultPersonName, errorText, writeStored } from '@/components/lab/labFormat';
import { countOf, draftFromCheck, snapshotOf, toInput, validate } from './SafetyCheckDraft';
import type { Answer, SafetyDraft } from './SafetyCheckDraft';
import { useAlive, useLatest } from './recordsFormat';
import styles from './labRecords.module.css';

interface EditorProps {
  kind: SafetyKind;
  date: string;
  existing: SafetyCheck | null;
  /** 저장하지 않은 변경이 있는지를 윗 화면이 읽는 표 */
  dirtyRef: MutableRefObject<boolean>;
  onSaved: (saved: SafetyCheck) => void;
  onDeleted: (id: number) => void;
}

export default function SafetyCheckEditor({ kind, date, existing, dirtyRef, onSaved, onDeleted }: EditorProps) {
  const notify = useNotify();
  const alive = useAlive();
  const template = templateFor(kind);
  const [draft, setDraft] = useState<SafetyDraft>(() => draftFromCheck(kind, existing, defaultPersonName()));
  const [baseline, setBaseline] = useState(() => snapshotOf(draftFromCheck(kind, existing, defaultPersonName())));
  const latest = useLatest(draft);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const dirty = snapshotOf(draft) !== baseline;
  useEffect(() => {
    dirtyRef.current = dirty;
    return () => {
      dirtyRef.current = false;
    };
  }, [dirty, dirtyRef]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirtyRef]);

  const count = useMemo(() => countOf(draft), [draft]);
  const labelOf = useMemo(() => new Map(template.items.map((i) => [i.code, i.label])), [template]);
  const failed = draft.items.filter((i) => i.answer === 'fail');
  const needsActions = failed.length > 0 && draft.actions.trim() === '';

  const setAnswer = (code: string, answer: Answer) => setDraft((d) => ({ ...d, items: d.items.map((i) => (i.code === code ? { ...i, answer } : i)) }));
  const setNote = (code: string, note: string) => setDraft((d) => ({ ...d, items: d.items.map((i) => (i.code === code ? { ...i, note: note.slice(0, MAX_SAFETY_NOTE) } : i)) }));
  const fillOk = () => setDraft((d) => ({ ...d, items: d.items.map((i) => (i.answer === '' ? { ...i, answer: 'ok' } : i)) }));

  const runAi = async () => {
    if (aiLoading || failed.length === 0) return;
    setAiLoading(true);
    setAiError(null);
    setSuggestion(null);
    try {
      const result = await aiDraftSafetyActions({ kind, failed: failed.map((i) => ({ label: labelOf.get(i.code) ?? i.code, note: i.note.trim() })) });
      if (!alive.current) return;
      const text = result.actions.trim().slice(0, MAX_SAFETY_ACTIONS);
      if (text === '') {
        setAiError('AI가 조치 계획을 만들지 못했습니다. 직접 적어 주세요');
        return;
      }
      const now = latest.current;
      if (now.actions.trim() === '' || now.actionsAi) {
        setDraft((d) => ({ ...d, actions: text, actionsAi: true, aiUsed: true }));
      } else {
        // 직접 쓴 조치 내용은 덮어쓰지 않고, 제안을 아래에 따로 보여 준다
        setSuggestion(text);
      }
    } catch (e) {
      if (alive.current) setAiError(errorText(e, 'AI가 조치 계획을 만들지 못했습니다. 잠시 후 다시 시도해 주세요'));
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
    const now = draft;
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await saveSafetyCheck(toInput(kind, date, now));
      if (now.inspector.trim() !== '') writeStored(PROVIDER_KEY, now.inspector.trim());
      onSaved(saved);
      if (alive.current) {
        setBaseline(snapshotOf(now));
        notify(`${dateLabel(date)} ${template.label} 점검을 저장했습니다`, 'success');
      }
    } catch (e) {
      if (alive.current) setSaveError(errorText(e, '점검 기록을 저장하지 못했습니다'));
    } finally {
      if (alive.current) setSaving(false);
    }
  };

  const remove = async () => {
    if (!existing || deleting) return;
    setDeleting(true);
    try {
      await deleteSafetyCheck(existing.id);
      notify('점검 기록을 삭제했습니다', 'success');
      onDeleted(existing.id);
    } catch (e) {
      if (alive.current) {
        setConfirmDelete(false);
        setSaveError(errorText(e, '점검 기록을 삭제하지 못했습니다'));
      }
    } finally {
      if (alive.current) setDeleting(false);
    }
  };

  return (
    <Card padding={4}>
      <VStack gap={4}>
        <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
          <div>
            <Text type="large" weight="semibold">
              {dateLabel(date)} {template.label}
            </Text>
            <br />
            <Text type="supporting" color="secondary">
              {SAFETY_CADENCE_LABEL[template.cadence]} · {template.description}
            </Text>
          </div>
          <HStack gap={2} vAlign="center">
            {existing ? <Chip tone="info" label="기록 있음 (수정)" /> : <Chip tone="neutral" label="새 점검" />}
            {dirty && <Chip tone="warn" label="저장 전" />}
          </HStack>
        </HStack>

        <HStack gap={3} vAlign="center" wrap="wrap">
          <SupportText>
            적합 {count.ok} · 부적합 {count.fail} · 해당 없음 {count.na} · 아직 안 봄 {count.unset}
          </SupportText>
          <Button label="안 본 항목 모두 적합" variant="secondary" size="sm" isDisabled={count.unset === 0 || saving} onClick={fillOk} />
        </HStack>

        <div>
          {draft.items.map((item) => (
            <div key={item.code} className={styles.safetyItem} data-answer={item.answer || 'none'}>
              <Text type="body">{labelOf.get(item.code) ?? item.code}</Text>
              <div className={styles.safetyControls}>
                <SegmentedControl label={`${labelOf.get(item.code) ?? item.code} 점검 결과`} value={item.answer} onChange={(v) => setAnswer(item.code, v as Answer)} size="sm" isDisabled={saving}>
                  <SegmentedControlItem value="ok" label="적합" />
                  <SegmentedControlItem value="fail" label="부적합" />
                  <SegmentedControlItem value="na" label="해당 없음" />
                </SegmentedControl>
                <TextInput
                  label={`${labelOf.get(item.code) ?? item.code} 메모`}
                  isLabelHidden
                  size="sm"
                  value={item.note}
                  isDisabled={saving}
                  placeholder={item.answer === 'fail' ? '무엇이 문제인지 적어 주세요 (선택)' : '메모 (선택)'}
                  onChange={(v) => setNote(item.code, v)}
                  status={item.answer === 'fail' && item.note.trim() === '' ? { type: 'warning' } : undefined}
                />
              </div>
            </div>
          ))}
        </div>

        <VStack gap={2}>
          <TextArea
            label={draft.actionsAi ? '조치 내용 (선택) · AI 제안' : '조치 내용 (선택)'}
            description={failed.length > 0 ? `부적합 ${failed.length}건에 대해 언제·누가·어떻게 조치했는지 적어 주세요. 평가에서 조치 여부를 봅니다.` : '부적합 항목이 있을 때 조치한 내용을 적습니다.'}
            value={draft.actions}
            rows={4}
            maxLength={MAX_SAFETY_ACTIONS}
            isDisabled={saving}
            onChange={(v) => setDraft((d) => ({ ...d, actions: v, actionsAi: false }))}
          />
          <HStack gap={3} vAlign="center" wrap="wrap">
            <Button label="조치 계획 AI" variant="secondary" isLoading={aiLoading} isDisabled={failed.length === 0 || aiLoading || saving} onClick={() => void runAi()} />
            <SupportText>{failed.length === 0 ? '부적합 항목이 있으면 조치 계획을 제안해 드립니다.' : '부적합 항목과 메모만 AI로 보내며, 결과는 제안일 뿐 저장되지 않습니다.'}</SupportText>
          </HStack>
          {aiError && <ErrorBanner message={aiError} />}
          {suggestion && (
            <div className={styles.suggestBox}>
              <VStack gap={2}>
                <HStack gap={2} vAlign="center">
                  <AiChip />
                  <SupportText>직접 쓰신 조치 내용은 그대로 두고, 제안을 아래에 따로 보여 드립니다.</SupportText>
                </HStack>
                <div className={styles.pre}>
                  <Text type="body">{suggestion}</Text>
                </div>
                <HStack gap={2}>
                  <Button
                    label="아래에 덧붙이기"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setDraft((d) => ({ ...d, actions: `${d.actions.trim()}\n${suggestion}`.slice(0, MAX_SAFETY_ACTIONS), aiUsed: true }));
                      setSuggestion(null);
                    }}
                  />
                  <Button label="버리기" variant="ghost" size="sm" onClick={() => setSuggestion(null)} />
                </HStack>
              </VStack>
            </div>
          )}
        </VStack>

        <TextInput label="점검자 (선택)" value={draft.inspector} onChange={(v) => setDraft((d) => ({ ...d, inspector: v.slice(0, 50) }))} />

        {needsActions && <SupportText tone="warn">부적합 항목이 있는데 조치 내용이 비어 있습니다. 저장은 되지만 평가에서 조치 미흡으로 볼 수 있어요.</SupportText>}
        {saveError && <ErrorBanner message={saveError} />}

        <div className={styles.stickyBar}>
          <HStack gap={2} hAlign="between" vAlign="center" wrap="wrap">
            <div>{existing && <Button label="점검 기록 삭제" variant="ghost" isDisabled={saving || deleting} onClick={() => setConfirmDelete(true)} />}</div>
            <Button label="점검 저장" variant="primary" isLoading={saving} isDisabled={saving || (!dirty && !!existing)} onClick={() => void save()} />
          </HStack>
        </div>
      </VStack>

      <LabConfirm
        isOpen={confirmDelete}
        title="이 점검 기록을 삭제할까요?"
        description="지우면 그날 점검을 하지 않은 것으로 계산되며 되돌릴 수 없습니다."
        actionLabel="삭제"
        isLoading={deleting}
        onConfirm={() => void remove()}
        onClose={() => setConfirmDelete(false)}
      />
    </Card>
  );
}
