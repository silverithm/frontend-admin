'use client';

/**
 * 진료 동행 기록 편집기 — 한 건.
 * 위에서 아래로: 어르신·날짜·시각·병원·진료과 → 진료 메모를 AI로 정리(제안, 저장은 직원이) → 사유·진료 내용·처방 → 동행 직원·보호자 알림·후속 확인 → 저장.
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
import { aiStructureMedicalVisit, createMedicalVisit, deleteMedicalVisit, updateMedicalVisit } from '@/lib/lab/labApi';
import { isValidYmd } from '@/lib/lab/labDate';
import type { MedicalVisit } from '@/lib/lab/labTypes';
import { ErrorBanner, LabConfirm, LabDateInput, SupportText, useNotify } from '@/components/lab/LabUi';
import { errorText, todayString } from '@/components/lab/labFormat';
import type { LabElder } from '@/components/lab/useLabElders';
import { AI_FIELD_LABEL, AI_FIELD_LIMITS, VISIT_LIMITS, draftFromVisit, newVisitDraft, visitInput, visitProblems, visitSnapshot } from './MedicalVisitDraft';
import type { AiField, VisitDraft } from './MedicalVisitDraft';
import { AiMemoBox, TimeField } from './RecordsUi';
import { mergeAiSuggestions, useAlive } from './recordsFormat';
import styles from './labRecords.module.css';

interface Props {
  elders: LabElder[];
  visit: MedicalVisit | null;
  onSaved: () => void;
  onClose: () => void;
}

export default function MedicalVisitEditor({ elders, visit, onSaved, onClose }: Props) {
  const notify = useNotify();
  const alive = useAlive();
  const today = todayString();
  const [initial] = useState<VisitDraft>(() => (visit ? draftFromVisit(visit) : newVisitDraft(todayString())));
  const [draft, setDraft] = useState<VisitDraft>(initial);
  const [baseline] = useState(() => visitSnapshot(initial));
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiDone, setAiDone] = useState(false);
  const [followNote, setFollowNote] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const problems = useMemo(() => visitProblems(draft, today), [draft, today]);
  const dirty = visitSnapshot(draft) !== baseline;
  const elderName = elders.find((e) => e.id === draft.elderId)?.name ?? visit?.elderlyName ?? '';
  const elderOptions = useMemo(() => {
    const list = elders.map((e) => ({ value: String(e.id), label: e.name }));
    if (visit && !elders.some((e) => e.id === visit.elderlyId)) list.push({ value: String(visit.elderlyId), label: `${visit.elderlyName} (목록에 없음)` });
    return list;
  }, [elders, visit]);

  const set = <K extends keyof VisitDraft>(key: K, value: VisitDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  /** AI가 채운 칸을 직원이 고치면 그 칸은 직접 쓴 칸이 되어, 다시 정리해도 덮어쓰지 않는다 */
  const setText = (key: AiField | 'escort' | 'guardianNote', value: string) =>
    setDraft((d) => {
      const marks = { ...d.aiMarks };
      if (key in AI_FIELD_LIMITS) delete marks[key as AiField];
      return { ...d, [key]: value, aiMarks: marks };
    });

  const runAi = async () => {
    if (aiLoading || draft.memo.trim() === '') return;
    setAiLoading(true);
    setAiError(null);
    setAiDone(false);
    try {
      const r = await aiStructureMedicalVisit(draft.memo.trim(), { elderNames: [elderName], staffNames: [draft.escort] });
      if (!alive.current) return;
      const followDate = isValidYmd(r.followUp?.date) ? r.followUp.date : null;
      setDraft((d) => {
        const m = mergeAiSuggestions(
          { hospital: d.hospital, department: d.department, reason: d.reason, result: d.result, prescription: d.prescription },
          d.aiMarks,
          { hospital: r.hospital, department: r.department, reason: r.reason, result: r.result, prescription: r.prescription },
          AI_FIELD_LIMITS,
        );
        const followUpOn = followDate && d.followUpOn === '' ? followDate : d.followUpOn;
        return { ...d, ...m.fields, aiMarks: m.ai, aiKept: m.kept, followUpOn, aiUsed: true };
      });
      setFollowNote((r.followUp?.note ?? '').trim().slice(0, 200));
      setAiDone(true);
    } catch (e) {
      if (alive.current) setAiError(errorText(e, 'AI가 진료 메모를 정리하지 못했습니다. 잠시 뒤 다시 눌러 주세요'));
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
      const input = visitInput(draft);
      if (visit) await updateMedicalVisit(visit.id, input);
      else await createMedicalVisit(input);
      notify(visit ? '진료 동행 기록을 고쳤습니다' : '진료 동행 기록을 저장했습니다', 'success');
      onSaved();
      if (alive.current) onClose();
    } catch (e) {
      if (alive.current) setError(errorText(e, '진료 동행 기록을 저장하지 못했습니다'));
    } finally {
      if (alive.current) setSaving(false);
    }
  };

  const remove = async () => {
    if (!visit || deleting) return;
    setDeleting(true);
    try {
      await deleteMedicalVisit(visit.id);
      notify('진료 동행 기록을 삭제했습니다', 'success');
      onSaved();
      if (alive.current) onClose();
    } catch (e) {
      if (alive.current) {
        setConfirmDelete(false);
        setError(errorText(e, '진료 동행 기록을 삭제하지 못했습니다'));
      }
    } finally {
      if (alive.current) setDeleting(false);
    }
  };

  const aiFields = (Object.keys(draft.aiMarks) as AiField[]).map((k) => AI_FIELD_LABEL[k]);
  const aiResult = aiDone ? (
    <VStack gap={2}>
      {aiFields.length === 0 && followNote === '' ? (
        <SupportText>메모에서 채울 내용을 찾지 못했습니다. 진료 과목·진료 내용이 보이게 다시 적어 보거나 아래 칸에 직접 적어 주세요.</SupportText>
      ) : null}
      {draft.aiKept > 0 && <SupportText>직접 적은 {draft.aiKept}칸은 바꾸지 않았습니다.</SupportText>}
      {followNote !== '' && (
        <div>
          <Text type="supporting">
            후속 안내: {followNote}
            {draft.followUpOn === '' ? ' (날짜는 메모에 없어 비워 두었습니다. 아래 후속 확인 날짜를 직접 골라 주세요.)' : ''}
          </Text>
          <Button
            label="진료 내용 끝에 더하기"
            variant="ghost"
            onClick={() => {
              setDraft((d) => {
                const next = `${d.result.trim()}${d.result.trim() === '' ? '' : '\n'}후속 안내: ${followNote}`.slice(0, VISIT_LIMITS.result);
                const marks = { ...d.aiMarks };
                delete marks.result;
                return { ...d, result: next, aiMarks: marks };
              });
              setFollowNote('');
            }}
          />
        </div>
      )}
    </VStack>
  ) : undefined;

  return (
    <Card padding={4}>
      <VStack gap={4}>
        <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
          <VStack gap={0.5}>
            <Text type="large" weight="semibold">
              {visit ? '진료 동행 기록 고치기' : '새 진료 동행 기록'}
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
            hasSearch={elderOptions.length > 8}
            searchPlaceholder="찾기"
            options={elderOptions}
            value={draft.elderId === null ? '' : String(draft.elderId)}
            onChange={(v) => v && set('elderId', Number(v))}
          />
          <LabDateInput label="진료 날짜" value={draft.visitDate} onChange={(v) => set('visitDate', v)} />
        </div>
        <div className={styles.fieldGridWide}>
          <TimeField label="시작 시각 (선택)" value={draft.startTime} onChange={(v) => set('startTime', v)} />
          <TimeField label="끝 시각 (선택)" value={draft.endTime} onChange={(v) => set('endTime', v)} />
        </div>
        <div className={styles.fieldGridWide}>
          <TextInput label="병원" placeholder="예: 서울정형외과" value={draft.hospital} onChange={(v) => setText('hospital', v.slice(0, VISIT_LIMITS.hospital))} />
          <TextInput label="진료과 (선택)" placeholder="예: 정형외과" value={draft.department} onChange={(v) => setText('department', v.slice(0, VISIT_LIMITS.department))} />
        </div>

        <AiMemoBox
          label="진료 메모"
          description="진료실에서 들은 말이나 처방전에 적힌 내용을 그대로 옮겨 적어 주세요. 진료과·사유·진료 내용·처방을 AI가 정리해 제안합니다. 메모에 없는 진단·약·날짜는 비워 둡니다."
          placeholder="예: 무릎이 아파서 정형외과 방문, X-ray 결과 퇴행성 관절염 소견, 소염제 5일분 처방, 2주 뒤 재방문"
          memo={draft.memo}
          onMemoChange={(v) => set('memo', v.slice(0, VISIT_LIMITS.memo))}
          buttonLabel="메모로 AI 정리"
          isLoading={aiLoading}
          onRun={() => void runAi()}
          error={aiError}
          isDisabled={saving}
          result={aiResult}
        />

        <TextArea label="진료 사유 (선택)" placeholder="예: 무릎 통증이 2주 이어져 방문" value={draft.reason} onChange={(v) => setText('reason', v.slice(0, VISIT_LIMITS.reason))} rows={2} maxLength={VISIT_LIMITS.reason} />
        <TextArea label="진료 내용" placeholder="의사가 한 말, 검사 결과, 주의 사항을 적어 주세요" value={draft.result} onChange={(v) => setText('result', v.slice(0, VISIT_LIMITS.result))} rows={4} maxLength={VISIT_LIMITS.result} />
        <TextArea label="처방 (선택)" placeholder="예: 소염제 5일분, 식후 30분" value={draft.prescription} onChange={(v) => setText('prescription', v.slice(0, VISIT_LIMITS.prescription))} rows={2} maxLength={VISIT_LIMITS.prescription} />
        {aiFields.length > 0 && <SupportText>AI가 채운 칸: {aiFields.join('·')} — 읽어 보고 사실과 다르면 고친 뒤 저장해 주세요.</SupportText>}

        <TextInput label="동행 직원" placeholder="병원에 함께 간 직원 이름" value={draft.escort} onChange={(v) => setText('escort', v.slice(0, VISIT_LIMITS.escort))} />

        <VStack gap={2}>
          <CheckboxInput label="보호자에게 알렸습니다" value={draft.guardianNotified} onChange={(v) => set('guardianNotified', v)} />
          {draft.guardianNotified && (
            <TextInput label="알린 내용 (선택)" placeholder="예: 전화로 진료 결과를 설명드림" value={draft.guardianNote} onChange={(v) => setText('guardianNote', v.slice(0, VISIT_LIMITS.guardianNote))} />
          )}
        </VStack>

        <div className={styles.fieldGridWide}>
          <VStack gap={1}>
            <LabDateInput label="후속 확인 날짜 (선택)" value={draft.followUpOn} onChange={(v) => setDraft((d) => ({ ...d, followUpOn: v, followUpDone: v === '' ? false : d.followUpDone }))} />
            {draft.followUpOn !== '' && <Button label="후속 날짜 비우기" variant="ghost" size="sm" onClick={() => setDraft((d) => ({ ...d, followUpOn: '', followUpDone: false }))} />}
          </VStack>
          {draft.followUpOn !== '' && <CheckboxInput label="후속 확인 완료" value={draft.followUpDone} onChange={(v) => set('followUpDone', v)} />}
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
            {visit ? <Button label="기록 삭제" variant="ghost" isDisabled={saving || deleting} onClick={() => setConfirmDelete(true)} /> : <span />}
            <Button label="저장" variant="primary" isLoading={saving} isDisabled={saving} onClick={() => void save()} />
          </HStack>
        </div>
      </VStack>
      <LabConfirm
        isOpen={confirmDelete}
        title="이 진료 동행 기록을 삭제할까요?"
        description="삭제하면 되돌릴 수 없습니다."
        actionLabel="삭제"
        isLoading={deleting}
        onConfirm={() => void remove()}
        onClose={() => setConfirmDelete(false)}
      />
      <LabConfirm isOpen={confirmLeave} title="저장하지 않고 나갈까요?" description="고친 내용이 사라집니다." actionLabel="나가기" onConfirm={onClose} onClose={() => setConfirmLeave(false)} />
    </Card>
  );
}
