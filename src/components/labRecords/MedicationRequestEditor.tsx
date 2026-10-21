'use client';

/**
 * 투약의뢰서 편집기 — 보호자가 맡긴 약 한 건.
 * 위에서 아래로: 어르신·의뢰자·기간·처방 확인 → 보호자 메모로 약 목록 제안(AI, 저장은 직원이) → 약 목록 → 저장.
 */
import { useMemo, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { aiStructureMedicationRequest, createMedicationRequest, deleteMedicationRequest, updateMedicationRequest } from '@/lib/lab/labApi';
import type { MedicationRequest, RequesterRelation } from '@/lib/lab/labTypes';
import { MAX_MEDICINES, RELATIONS } from '@/lib/lab/medicationRules';
import { ErrorBanner, LabConfirm, LabDateInput, SupportText, useNotify } from '@/components/lab/LabUi';
import { PROVIDER_KEY, errorText, todayString, writeStored } from '@/components/lab/labFormat';
import type { LabElder } from '@/components/lab/useLabElders';
import { REQUEST_NOTE_MAX, REQUESTER_MAX, blankItem, draftFromRequest, itemFrom, newRequestDraft, requestInput, requestProblems } from './MedicationDraft';
import type { ItemDraft, RequestDraft } from './MedicationDraft';
import MedicationItemBlock from './MedicationItemBlock';
import { AiMemoBox } from './RecordsUi';
import { useAlive } from './recordsFormat';
import styles from './labRecords.module.css';

interface Props {
  elders: LabElder[];
  request: MedicationRequest | null;
  onSaved: () => void;
  onClose: () => void;
}

const snapshot = (d: RequestDraft) => JSON.stringify({ ...d, memo: '', items: d.items.map((m) => [m.name, m.dose, m.route, m.slots, m.timing, m.note, m.weekdays]) });

export default function MedicationRequestEditor({ elders, request, onSaved, onClose }: Props) {
  const notify = useNotify();
  const alive = useAlive();
  const [initial] = useState<RequestDraft>(() => (request ? draftFromRequest(request) : newRequestDraft(null)));
  const [draft, setDraft] = useState<RequestDraft>(initial);
  const [baseline] = useState(() => snapshot(initial));
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const problems = useMemo(() => requestProblems(draft), [draft]);
  const dirty = snapshot(draft) !== baseline;
  const set = <K extends keyof RequestDraft>(key: K, value: RequestDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const setItem = (key: number, patch: Partial<ItemDraft>) => setDraft((d) => ({ ...d, items: d.items.map((m) => (m.key === key ? { ...m, ...patch } : m)) }));
  const elderName = elders.find((e) => e.id === draft.elderId)?.name ?? request?.elderlyName ?? '';

  const runAi = async () => {
    if (aiLoading || draft.memo.trim() === '') return;
    setAiLoading(true);
    setAiError(null);
    setAiNote(null);
    try {
      const r = await aiStructureMedicationRequest({ text: draft.memo.trim() });
      if (!alive.current) return;
      if (r.medicines.length === 0) {
        setAiNote('메모에서 약을 찾지 못했습니다. 약 이름이 보이게 다시 적어 보거나 아래 목록에 직접 적어 주세요.');
        return;
      }
      setDraft((d) => {
        // 이름·용량·시간대가 모두 빈 줄은 새 제안으로 바꾸고, 직접 적은 줄은 그대로 둔다
        const kept = d.items.filter((m) => m.name.trim() !== '' || m.dose.trim() !== '' || m.slots.length > 0);
        const merged = [...kept, ...r.medicines.map((m) => itemFrom(m, true))].slice(0, MAX_MEDICINES);
        return { ...d, items: merged.length > 0 ? merged : [blankItem()], aiUsed: true };
      });
      setAiNote(`${r.medicines.length}가지를 약 목록에 더했습니다. 메모에 없는 용량·시간대는 비워 두었으니 의뢰서와 맞춰 채워 주세요.`);
    } catch (e) {
      if (alive.current) setAiError(errorText(e, 'AI가 약 목록을 정리하지 못했습니다. 잠시 뒤 다시 눌러 주세요'));
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
      const input = requestInput(draft, request?.status ?? 'ACTIVE', draft.aiUsed || (request?.aiAssisted ?? false));
      if (request) await updateMedicationRequest(request.id, input);
      else await createMedicationRequest(input);
      writeStored(PROVIDER_KEY, draft.writer.trim());
      notify(request ? '투약의뢰서를 고쳤습니다' : '투약의뢰서를 저장했습니다', 'success');
      onSaved();
      if (alive.current) onClose();
    } catch (e) {
      if (alive.current) setError(errorText(e, '투약의뢰서를 저장하지 못했습니다'));
    } finally {
      if (alive.current) setSaving(false);
    }
  };

  const remove = async () => {
    if (!request || deleting) return;
    setDeleting(true);
    try {
      await deleteMedicationRequest(request.id);
      notify('투약의뢰서를 삭제했습니다', 'success');
      onSaved();
      if (alive.current) onClose();
    } catch (e) {
      if (alive.current) {
        setConfirmDelete(false);
        setError(errorText(e, '투약의뢰서를 삭제하지 못했습니다. 투약 기록이 있으면 삭제할 수 없으니 "끝내기"를 써 주세요'));
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
              {request ? '투약의뢰서 고치기' : '새 투약의뢰서'}
            </Text>
            <Text type="supporting" color="secondary">
              {elderName ? `${elderName} 어르신` : '어르신을 먼저 골라 주세요'}
            </Text>
          </VStack>
          <Button label="목록으로" variant="ghost" isDisabled={saving} onClick={() => (dirty ? setConfirmLeave(true) : onClose())} />
        </HStack>

        <div className={styles.fieldGridWide}>
          <Selector
            label="어르신"
            placeholder="어르신 고르기"
            hasSearch={elders.length > 8}
            searchPlaceholder="찾기"
            options={elders.map((e) => ({ value: String(e.id), label: e.name }))}
            value={draft.elderId === null ? '' : String(draft.elderId)}
            onChange={(v) => v && set('elderId', Number(v))}
          />
          <LabDateInput label="의뢰한 날" value={draft.requestedOn} onChange={(v) => set('requestedOn', v)} max={todayString()} />
        </div>
        <div className={styles.fieldGridWide}>
          <TextInput label="의뢰한 사람" placeholder="약을 맡긴 분 이름" value={draft.requester} onChange={(v) => set('requester', v.slice(0, REQUESTER_MAX))} />
          <Selector
            label="어르신과의 관계"
            placeholder="고르기"
            options={RELATIONS.map((r) => ({ value: r.value, label: r.label }))}
            value={draft.relation}
            onChange={(v) => v && set('relation', v as RequesterRelation)}
          />
        </div>
        <div className={styles.fieldGridWide}>
          <LabDateInput label="투약 시작 날" value={draft.startDate} onChange={(v) => set('startDate', v)} />
          <VStack gap={1}>
            <LabDateInput label="투약 끝나는 날 (선택)" value={draft.endDate} onChange={(v) => set('endDate', v)} />
            {draft.endDate !== '' && <Button label="끝나는 날 비우기" variant="ghost" size="sm" onClick={() => set('endDate', '')} />}
          </VStack>
        </div>
        <CheckboxInput label="의사 처방을 확인했습니다 (처방전이나 약봉투로)" value={draft.prescriptionChecked} onChange={(v) => set('prescriptionChecked', v)} />
        {!draft.prescriptionChecked && <SupportText tone="warn">처방 확인이 없으면 의뢰서 목록에 확인 필요로 표시됩니다.</SupportText>}

        <AiMemoBox
          label="보호자 메모"
          description="보호자가 남긴 메모나 약봉투에 적힌 글을 옮겨 적어 주세요. 약 이름·용량·시간대를 AI가 약 목록으로 제안합니다. 메모에 없는 것은 비워 둡니다."
          placeholder="예: 혈압약 아침 1알 식후, 변비약 저녁 식전 1알 (월·수만)"
          memo={draft.memo}
          onMemoChange={(v) => set('memo', v)}
          buttonLabel="메모로 약 목록 제안"
          isLoading={aiLoading}
          onRun={() => void runAi()}
          error={aiError}
          isDisabled={saving}
          result={aiNote ? <SupportText>{aiNote}</SupportText> : undefined}
        />

        <VStack gap={3}>
          <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
            <Text type="label">
              약 목록 <span className={styles.mutedText}>· {draft.items.length}가지</span>
            </Text>
            <Button label="약 추가" variant="secondary" isDisabled={saving || draft.items.length >= MAX_MEDICINES} onClick={() => setDraft((d) => ({ ...d, items: [...d.items, blankItem()] }))} />
          </HStack>
          {draft.items.map((m, i) => (
            <MedicationItemBlock
              key={m.key}
              item={m}
              index={i}
              isDisabled={saving}
              canRemove={draft.items.length > 1}
              onChange={(patch) => setItem(m.key, patch)}
              onRemove={() => setDraft((d) => ({ ...d, items: d.items.filter((x) => x.key !== m.key) }))}
            />
          ))}
        </VStack>

        <div className={styles.fieldGridWide}>
          <TextInput label="받은 직원" placeholder="의뢰서를 받은 직원 이름" value={draft.writer} onChange={(v) => set('writer', v.slice(0, 50))} />
          <TextArea label="메모 (선택)" placeholder="예: 보관은 냉장, 보호자가 매일 아침 가져옴" value={draft.note} onChange={(v) => set('note', v.slice(0, REQUEST_NOTE_MAX))} rows={2} maxLength={REQUEST_NOTE_MAX} />
        </div>

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
            {request ? <Button label="의뢰서 삭제" variant="ghost" isDisabled={saving || deleting} onClick={() => setConfirmDelete(true)} /> : <span />}
            <Button label="저장" variant="primary" isLoading={saving} isDisabled={saving} onClick={() => void save()} />
          </HStack>
        </div>
      </VStack>
      <LabConfirm
        isOpen={confirmDelete}
        title="이 투약의뢰서를 삭제할까요?"
        description="삭제하면 되돌릴 수 없습니다. 투약 기록이 이미 있으면 삭제되지 않으니 그때는 '끝내기'를 써 주세요."
        actionLabel="삭제"
        isLoading={deleting}
        onConfirm={() => void remove()}
        onClose={() => setConfirmDelete(false)}
      />
      <LabConfirm isOpen={confirmLeave} title="저장하지 않고 나갈까요?" description="고친 내용이 사라집니다." actionLabel="나가기" onConfirm={onClose} onClose={() => setConfirmLeave(false)} />
    </Card>
  );
}
