'use client';

/**
 * 상담일지 작성·수정 — 상대·이름·방법·내용·후속 조치.
 * "메모로 AI 정리"는 메모만 보내(상대 이름은 보내지 않는다) 내용·후속 조치 제안과 욕구 신호를 받는다.
 * 직접 쓴 칸은 덮어쓰지 않고, 저장은 직원이 누를 때만 한다.
 */
import { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { aiDraftConsultation, createConsultation, deleteConsultation, updateConsultation } from '@/lib/lab/labApi';
import type { Consultation } from '@/lib/lab/labTypes';
import { Chip, ErrorBanner, LabConfirm, LabDateInput, SupportText, useNotify } from '@/components/lab/LabUi';
import { PROVIDER_KEY, dateLabel, defaultPersonName, errorText, todayString, writeStored } from '@/components/lab/labFormat';
import { COUNTERPART_OPTIONS, CONSULT_TEXT_MAX, METHOD_OPTIONS, draftFromConsultation, newDraft, snapshotOf, toInput, validate } from './ConsultationCarePlanConsultDraft';
import type { ConsultDraft, ConsultTextKey } from './ConsultationCarePlanConsultDraft';
import { AiMemoBox } from './RecordsUi';
import { mergeAiSuggestions, useAlive, useLatest } from './recordsFormat';
import styles from './labRecords.module.css';

interface EditorProps {
  elderId: number;
  elderName: string;
  consultation: Consultation | null;
  onSaved: (c: Consultation, isNew: boolean) => void;
  onDeleted: (id: number) => void;
  onClose: () => void;
}

export default function ConsultationCarePlanConsultEditor({ elderId, elderName, consultation, onSaved, onDeleted, onClose }: EditorProps) {
  const notify = useNotify();
  const alive = useAlive();
  const [draft, setDraft] = useState<ConsultDraft>(() => (consultation ? draftFromConsultation(consultation) : newDraft(todayString(), defaultPersonName())));
  const [baseline, setBaseline] = useState(() => snapshotOf(consultation ? draftFromConsultation(consultation) : newDraft(todayString(), defaultPersonName())));
  const latest = useLatest(draft);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const dirty = snapshotOf(draft) !== baseline;

  const setField = (key: ConsultTextKey, value: string) =>
    setDraft((d) => {
      const ai = { ...d.ai };
      delete ai[key];
      return { ...d, fields: { ...d.fields, [key]: value }, ai };
    });

  const runAi = async () => {
    const memo = latest.current.memo.trim();
    if (memo === '' || aiLoading) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const result = await aiDraftConsultation({ note: memo });
      if (!alive.current) return;
      const now = latest.current;
      const merged = mergeAiSuggestions(now.fields, now.ai, result, CONSULT_TEXT_MAX);
      setDraft((d) => ({ ...d, fields: merged.fields, ai: merged.ai, aiUsed: true, aiKept: merged.kept, needSignals: result.needSignals }));
    } catch (e) {
      if (alive.current) setAiError(errorText(e, 'AI가 상담 내용을 정리하지 못했습니다. 잠시 후 다시 시도해 주세요'));
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
      const input = toInput(draft, elderId, draft.aiUsed || (consultation?.aiAssisted ?? false));
      const saved = consultation ? await updateConsultation(consultation.id, input) : await createConsultation(input);
      writeStored(PROVIDER_KEY, draft.consultant.trim());
      onSaved(saved, !consultation);
      if (alive.current) setBaseline(snapshotOf(draft));
    } catch (e) {
      if (alive.current) setSaveError(errorText(e, '상담일지를 저장하지 못했습니다'));
    } finally {
      if (alive.current) setSaving(false);
    }
  };

  const remove = async () => {
    if (!consultation || deleting) return;
    setDeleting(true);
    try {
      await deleteConsultation(consultation.id);
      onDeleted(consultation.id);
      notify('상담일지를 삭제했습니다', 'success');
    } catch (e) {
      if (alive.current) {
        setConfirmDelete(false);
        setSaveError(errorText(e, '상담일지를 삭제하지 못했습니다'));
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
          <VStack gap={0.5}>
            <Text type="large" weight="semibold">
              {elderName} · {consultation ? '상담일지 수정' : '상담일지 작성'}
            </Text>
            {consultation && (
              <Text type="supporting" color="secondary">
                {dateLabel(consultation.consultedOn.slice(0, 10))} 상담
              </Text>
            )}
          </VStack>
          <HStack gap={2} vAlign="center">
            {dirty && <Chip tone="warn" label="저장 전" />}
            <Button label="닫기" variant="ghost" onClick={close} />
          </HStack>
        </HStack>

        <div className={styles.fieldGrid}>
          <LabDateInput label="상담 날짜" value={draft.date} onChange={(v) => setDraft((d) => ({ ...d, date: v }))} max={todayString()} isRequired />
          <Selector label="상담 상대" options={COUNTERPART_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} value={draft.counterpart} onChange={(v) => v && setDraft((d) => ({ ...d, counterpart: v as ConsultDraft['counterpart'] }))} />
          <TextInput label="상대 이름" value={draft.counterpartName} onChange={(v) => setDraft((d) => ({ ...d, counterpartName: v.slice(0, 50) }))} isOptional placeholder="예: 큰딸 김OO" />
          <Selector label="상담 방법" options={METHOD_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} value={draft.method} onChange={(v) => v && setDraft((d) => ({ ...d, method: v as ConsultDraft['method'] }))} />
        </div>

        <AiMemoBox
          description="상담에서 오간 이야기를 편하게 적어 주세요. 내용·후속 조치 칸을 AI가 정리해 줍니다. 상대 이름은 이 메모에 적지 마세요."
          placeholder="예: 보호자가 최근 밤에 잠을 잘 못 주무신다고 함. 주 2회 목욕 지원 요청, 다음 달 병원 동행 가능한지 문의."
          memo={draft.memo}
          onMemoChange={(v) => setDraft((d) => ({ ...d, memo: v }))}
          buttonLabel="메모로 AI 정리"
          isLoading={aiLoading}
          onRun={() => void runAi()}
          error={aiError}
          result={
            draft.aiUsed ? (
              <VStack gap={2}>
                <SupportText>{draft.aiKept > 0 ? `직접 쓰신 ${draft.aiKept}칸은 그대로 두었습니다.` : '비어 있던 칸에 제안을 채웠습니다.'}</SupportText>
                {draft.needSignals.length > 0 && (
                  <VStack gap={1}>
                    <SupportText>욕구 신호 — 욕구사정·급여계획을 쓸 때 참고하세요(저장되지 않습니다)</SupportText>
                    <div className={styles.chips} style={{ justifyContent: 'flex-start' }}>
                      {draft.needSignals.map((s) => (
                        <Chip key={s} tone="info" label={s} />
                      ))}
                    </div>
                  </VStack>
                )}
              </VStack>
            ) : undefined
          }
        />

        <div className={styles.fieldGridWide}>
          <TextArea label={draft.ai.content ? '상담 내용 · AI 제안' : '상담 내용'} value={draft.fields.content} onChange={(v) => setField('content', v)} rows={6} maxLength={CONSULT_TEXT_MAX.content} isRequired />
          <TextArea label={draft.ai.followUp ? '후속 조치 · AI 제안' : '후속 조치'} value={draft.fields.followUp} onChange={(v) => setField('followUp', v)} rows={6} maxLength={CONSULT_TEXT_MAX.followUp} isOptional />
        </div>
        <div className={styles.fieldGrid}>
          <TextInput label="상담자 이름" value={draft.consultant} onChange={(v) => setDraft((d) => ({ ...d, consultant: v.slice(0, 50) }))} isRequired />
        </div>

        {saveError && <ErrorBanner message={saveError} />}

        <div className={styles.stickyBar}>
          <HStack gap={2} hAlign="between" vAlign="center" wrap="wrap">
            <div>{consultation && <Button label="상담일지 삭제" variant="ghost" isDisabled={saving || deleting} onClick={() => setConfirmDelete(true)} />}</div>
            <HStack gap={2}>
              <Button label="취소" variant="ghost" isDisabled={saving} onClick={close} />
              <Button label="저장" variant="primary" isLoading={saving} isDisabled={saving || (!dirty && !!consultation)} onClick={() => void save()} />
            </HStack>
          </HStack>
        </div>
      </VStack>

      <LabConfirm
        isOpen={confirmDelete}
        title="이 상담일지를 삭제할까요?"
        description={`${elderName} 어르신의 상담일지가 지워지며 되돌릴 수 없습니다.`}
        actionLabel="삭제"
        isLoading={deleting}
        onConfirm={() => void remove()}
        onClose={() => setConfirmDelete(false)}
      />
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
