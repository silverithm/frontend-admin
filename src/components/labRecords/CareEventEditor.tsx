'use client';

/**
 * 상태변화·사고 기록 편집기 — 어르신 한 명의 한 건.
 * 위에서 아래로: 누가·언제·무슨 일 → 메모로 AI 정리(제안) → 상황·조치 → 보호자 연락 → 후속·재발 방지 → 체크리스트 → 저장·닫기·인쇄.
 * 닫기는 규칙(canClose)이 허락할 때만 되고, 안 되는 이유를 그대로 보여 준다. 저장은 직원이 누를 때만 한다.
 */
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { aiStructureCareEvent, createCareEvent, deleteCareEvent, listRiskLatest, updateCareEvent } from '@/lib/lab/labApi';
import type { CareEvent, CareEventKind, CareEventSeverity, GuardianContactMethod, RiskLatest } from '@/lib/lab/labTypes';
import { EVENT_KINDS, EVENT_SEVERITIES, canClose, eventChecklist, requiresGuardianNotice } from '@/lib/lab/careEventRules';
import { fillName } from '@/lib/lab/guardianNotice';
import { AiChip, Chip, ErrorBanner, LabConfirm, LabDateInput, SupportText, useNotify } from '@/components/lab/LabUi';
import { PROVIDER_KEY, defaultPersonName, errorText, todayString, writeStored } from '@/components/lab/labFormat';
import type { LabElder } from '@/components/lab/useLabElders';
import CareEventChecklist from './CareEventChecklist';
import { EVENT_TEXT_LABEL, EVENT_TEXT_MAX, GUARDIAN_METHODS, draftFromEvent, eventLikeOf, newDraft, snapshotOf, toInput, validate } from './CareEventDraft';
import type { CareEventDraft, EventTextKey } from './CareEventDraft';
import CareEventReport from './CareEventReport';
import { AiMemoBox, TimeField } from './RecordsUi';
import { mergeAiSuggestions, useAlive } from './recordsFormat';
import styles from './labRecords.module.css';

interface Props {
  elders: LabElder[];
  event: CareEvent | null;
  presetElderId: number | null;
  /** 저장·닫기·다시 열기 뒤 목록을 새로 읽게 한다(편집기는 열어 둔다) */
  onChanged: (event: CareEvent, isNew: boolean) => void;
  onDeleted: () => void;
  onClose: () => void;
}

export default function CareEventEditor({ elders, event, presetElderId, onChanged, onDeleted, onClose }: Props) {
  const notify = useNotify();
  const alive = useAlive();
  const [saved, setSaved] = useState<CareEvent | null>(event);
  // 새 기록의 기본 시각은 한 번만 정한다 — 두 번 만들면 분이 넘어가며 열자마자 "저장 전"으로 보인다
  const [initialDraft] = useState<CareEventDraft>(() => (event ? draftFromEvent(event) : newDraft(defaultPersonName(), presetElderId)));
  const [draft, setDraft] = useState<CareEventDraft>(initialDraft);
  const [baseline, setBaseline] = useState(() => snapshotOf(initialDraft));
  const [status, setStatus] = useState<'OPEN' | 'CLOSED'>(event?.status ?? 'OPEN');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [risk, setRisk] = useState<RiskLatest[] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // 낙상 재평가 항목은 어르신의 가장 최근 Morse 평가일이 있어야 판정된다
  useEffect(() => {
    let cancelled = false;
    listRiskLatest()
      .then((list) => !cancelled && setRisk(list))
      .catch(() => !cancelled && setRisk(null));
    return () => {
      cancelled = true;
    };
  }, []);

  const elder = elders.find((e) => e.id === draft.elderId) ?? null;
  const elderName = elder?.name ?? saved?.elderlyName ?? '';
  const errors = useMemo(() => validate(draft), [draft]);
  const like = useMemo(() => eventLikeOf(draft), [draft]);
  const latestMorseOn = risk?.find((r) => r.elderlyId === draft.elderId)?.morse?.assessedOn ?? null;
  const checklist = useMemo(() => eventChecklist(like, { latestMorseOn }), [like, latestMorseOn]);
  const closing = useMemo(() => canClose(like), [like]);
  const needGuardian = requiresGuardianNotice(draft.kind, draft.severity);
  const dirty = snapshotOf(draft) !== baseline;

  const setField = (key: EventTextKey, value: string) =>
    setDraft((d) => {
      const ai = { ...d.ai };
      delete ai[key];
      return { ...d, fields: { ...d.fields, [key]: value.slice(0, EVENT_TEXT_MAX[key]) }, ai };
    });

  const runAi = async () => {
    if (aiLoading || draft.memo.trim() === '') return;
    setAiLoading(true);
    setAiError(null);
    try {
      const r = await aiStructureCareEvent({ note: draft.memo.trim() });
      if (!alive.current) return;
      setDraft((d) => {
        const merged = mergeAiSuggestions(d.fields, d.ai, { description: r.description, immediateAction: r.immediateAction, followUp: r.followUp, prevention: r.prevention }, EVENT_TEXT_MAX);
        return {
          ...d,
          fields: merged.fields,
          ai: merged.ai,
          kind: d.kindTouched ? d.kind : r.kind,
          severity: d.severityTouched ? d.severity : r.severity,
          aiUsed: true,
          aiKept: merged.kept,
          aiMessage: fillName(r.guardianMessage ?? '', elder?.name ?? '[어르신]'),
        };
      });
    } catch (e) {
      if (alive.current) setAiError(errorText(e, 'AI가 메모를 정리하지 못했습니다. 잠시 뒤 다시 눌러 주세요'));
    } finally {
      if (alive.current) setAiLoading(false);
    }
  };

  const copyMessage = async () => {
    const text = fillName(draft.aiMessage, elderName || '[어르신]');
    try {
      await navigator.clipboard.writeText(text);
      notify('보호자 연락 문장을 복사했습니다', 'success');
    } catch {
      notify('복사하지 못했습니다. 글을 직접 선택해 복사해 주세요', 'error');
    }
  };

  const save = async (next: 'OPEN' | 'CLOSED') => {
    if (saving) return;
    setSubmitted(true);
    if (Object.keys(errors).length > 0) {
      setSaveError('빨간 표시가 있는 칸을 확인해 주세요');
      return;
    }
    if (next === 'CLOSED' && !closing.ok) {
      setSaveError(closing.reasons.join(' · '));
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const input = toInput(draft, next, next === 'CLOSED' ? saved?.closedOn ?? todayString() : null, draft.aiUsed || (saved?.aiAssisted ?? false));
      const result = saved ? await updateCareEvent(saved.id, input) : await createCareEvent(input);
      writeStored(PROVIDER_KEY, draft.reporter.trim());
      onChanged(result, !saved);
      if (!alive.current) return;
      setSaved(result);
      setStatus(result.status);
      setBaseline(snapshotOf(draft));
      notify(next === 'CLOSED' ? '저장하고 닫았습니다' : saved && status === 'CLOSED' && next === 'OPEN' ? '다시 열었습니다' : '저장했습니다', 'success');
    } catch (e) {
      if (alive.current) setSaveError(errorText(e, '기록을 저장하지 못했습니다'));
    } finally {
      if (alive.current) setSaving(false);
    }
  };

  const remove = async () => {
    if (!saved || deleting) return;
    setDeleting(true);
    try {
      await deleteCareEvent(saved.id);
      notify('기록을 삭제했습니다', 'success');
      onDeleted();
    } catch (e) {
      if (alive.current) {
        setConfirmDelete(false);
        setSaveError(errorText(e, '기록을 삭제하지 못했습니다'));
      }
    } finally {
      if (alive.current) setDeleting(false);
    }
  };

  const err = (key: keyof typeof errors) => (submitted && errors[key] ? { type: 'error' as const, message: errors[key] as string } : undefined);
  const text = (key: EventTextKey, rows: number, placeholder: string, optional = true) => (
    <TextArea
      label={`${EVENT_TEXT_LABEL[key]}${optional ? ' (선택)' : ''}${draft.ai[key] ? ' · AI 제안' : ''}`}
      value={draft.fields[key]}
      onChange={(v) => setField(key, v)}
      rows={rows}
      maxLength={EVENT_TEXT_MAX[key]}
      placeholder={placeholder}
      status={key === 'description' ? err('description') : undefined}
    />
  );

  return (
    <Card padding={4}>
      <VStack gap={4}>
        <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
          <VStack gap={0.5}>
            <Text type="large" weight="semibold">
              {saved ? '상태변화·사고 기록 고치기' : '새 상태변화·사고 기록'}
            </Text>
            <Text type="supporting" color="secondary">
              {elderName ? `${elderName} 어르신` : '어르신을 먼저 골라 주세요'}
            </Text>
          </VStack>
          <HStack gap={2} vAlign="center" wrap="wrap">
            {saved && <Chip tone={status === 'CLOSED' ? 'ok' : 'warn'} label={status === 'CLOSED' ? '닫힘' : '열림'} />}
            {dirty && <Chip tone="warn" label="저장 전" />}
            <Button label="목록으로" variant="ghost" onClick={() => (dirty ? setConfirmLeave(true) : onClose())} />
          </HStack>
        </HStack>

        <div className={styles.fieldGridWide}>
          <Selector
            label="어르신"
            options={elders.map((e) => ({ value: String(e.id), label: e.name }))}
            value={draft.elderId === null ? '' : String(draft.elderId)}
            onChange={(v) => v && setDraft((d) => ({ ...d, elderId: Number(v) }))}
            status={err('elder')}
          />
          <HStack gap={2} vAlign="end" wrap="wrap">
            <LabDateInput label="일어난 날" value={draft.date} onChange={(v) => setDraft((d) => ({ ...d, date: v }))} max={todayString()} />
            <TimeField label="시각" value={draft.time} onChange={(v) => setDraft((d) => ({ ...d, time: v }))} />
          </HStack>
        </div>
        {submitted && errors.occurred && <SupportText tone="error">{errors.occurred}</SupportText>}

        <div className={styles.fieldGrid}>
          <Selector
            label="종류"
            options={EVENT_KINDS.map((k) => ({ value: k.value, label: k.label }))}
            value={draft.kind}
            onChange={(v) => v && setDraft((d) => ({ ...d, kind: v as CareEventKind, kindTouched: true }))}
          />
          <Selector
            label="중증도"
            options={EVENT_SEVERITIES.map((s) => ({ value: s.value, label: s.label }))}
            value={draft.severity}
            onChange={(v) => v && setDraft((d) => ({ ...d, severity: v as CareEventSeverity, severityTouched: true }))}
          />
          <TextInput label="장소 (선택)" value={draft.place} onChange={(v) => setDraft((d) => ({ ...d, place: v.slice(0, 100) }))} placeholder="예: 화장실 앞 복도" status={err('place')} />
        </div>
        {needGuardian && (
          <SupportText tone="warn">이 종류·중증도는 보호자에게 반드시 알리고 연락 기록을 남겨야 닫을 수 있습니다.</SupportText>
        )}
        {draft.kind === 'FALL' && <SupportText tone="warn">낙상입니다. 위험도 평가에서 낙상 재평가(Morse)를 해 주세요. 재평가 기록이 있어야 체크리스트가 채워집니다.</SupportText>}

        <AiMemoBox
          description="있었던 일을 편하게 적어 주세요. 종류·중증도·상황·조치·후속·재발 방지 칸과 보호자에게 보낼 연락 문장을 AI가 제안합니다."
          placeholder="예: 점심 후 화장실 앞에서 미끄러져 엉덩방아. 의식 또렷, 통증은 오른쪽 엉덩이. 간호사 확인하고 얼음찜질, 지켜보기로 함."
          memo={draft.memo}
          onMemoChange={(v) => setDraft((d) => ({ ...d, memo: v }))}
          buttonLabel="메모로 AI 정리"
          isLoading={aiLoading}
          onRun={() => void runAi()}
          error={aiError}
          result={draft.aiUsed ? <SupportText>{draft.aiKept > 0 ? `직접 쓰신 ${draft.aiKept}칸은 그대로 두었습니다.` : '비어 있던 칸에 제안을 채웠습니다.'} 종류·중증도도 확인해 주세요.</SupportText> : undefined}
        />

        <div className={styles.fieldGridWide}>
          {text('description', 4, '무슨 일이 어떻게 있었는지 사실대로', false)}
          {text('immediateAction', 4, '사고 직후 한 조치 — 안정, 활력징후 확인, 응급처치, 보고')}
        </div>
        {submitted && errors.description && <SupportText tone="error">{errors.description}</SupportText>}

        <VStack gap={2}>
          <Text type="label">보호자 연락{needGuardian ? '' : ' (선택)'}</Text>
          <div className={styles.fieldGridWide}>
            <HStack gap={2} vAlign="end" wrap="wrap">
              <LabDateInput label="알린 날" value={draft.guardianDate} onChange={(v) => setDraft((d) => ({ ...d, guardianDate: v, guardianTime: v && d.guardianTime === '' ? d.time : d.guardianTime }))} max={todayString()} />
              <TimeField label="알린 시각" value={draft.guardianTime} onChange={(v) => setDraft((d) => ({ ...d, guardianTime: v }))} />
            </HStack>
            <Selector
              label="방법"
              options={GUARDIAN_METHODS.map((m) => ({ value: m.value, label: m.label }))}
              value={draft.guardianMethod}
              onChange={(v) => setDraft((d) => ({ ...d, guardianMethod: (v ?? '') as GuardianContactMethod | '' }))}
              placeholder="고르기"
            />
          </div>
          {submitted && errors.guardian && <SupportText tone="error">{errors.guardian}</SupportText>}
          {(draft.guardianDate || draft.guardianMethod) && (
            <Button label="보호자 연락 기록 지우기" variant="ghost" onClick={() => setDraft((d) => ({ ...d, guardianDate: '', guardianTime: '', guardianMethod: '' }))} />
          )}
          {text('guardianResponse', 2, '보호자가 한 말·요청')}
          {draft.aiMessage !== '' && (
            <div className={styles.suggestBox}>
              <VStack gap={2}>
                <HStack gap={2} vAlign="center" wrap="wrap">
                  <AiChip />
                  <Text type="supporting" color="secondary">
                    보호자에게 보낼 연락 문장입니다. 고쳐서 복사해 전화·문자에 쓰세요. 실제로 연락한 뒤 위 칸에 시각을 적어 주세요.
                  </Text>
                </HStack>
                <TextArea label="보호자 연락 문장" value={fillName(draft.aiMessage, elderName || '[어르신]')} onChange={(v) => setDraft((d) => ({ ...d, aiMessage: v }))} rows={4} maxLength={1000} />
                <div>
                  <Button label="연락 문장 복사" variant="secondary" onClick={() => void copyMessage()} />
                </div>
              </VStack>
            </div>
          )}
        </VStack>

        <div className={styles.fieldGridWide}>
          <TextInput label="병원 (선택)" value={draft.hospital} onChange={(v) => setDraft((d) => ({ ...d, hospital: v.slice(0, 100) }))} placeholder="진료·이송한 병원" status={err('hospital')} />
          <TextInput label="보고자" value={draft.reporter} onChange={(v) => setDraft((d) => ({ ...d, reporter: v.slice(0, 50) }))} status={err('reporter')} />
        </div>
        <div className={styles.fieldGridWide}>
          {text('followUp', 3, '경과 관찰, 병원 진료, 보호자 협의 — 닫으려면 꼭 필요합니다')}
          {text('prevention', 3, '낙상·부상은 환경 정비, 보행 보조, 근력 운동 등')}
        </div>

        <CareEventChecklist items={checklist} riskUnknown={risk === null && draft.kind === 'FALL'} />

        {status === 'OPEN' && !closing.ok && (
          <SupportText tone="warn">닫을 수 없습니다 — {closing.reasons.join(' · ')}</SupportText>
        )}
        {saveError && <ErrorBanner message={saveError} />}

        <div className={styles.stickyBar}>
          <HStack gap={2} hAlign="between" vAlign="center" wrap="wrap">
            <HStack gap={1} wrap="wrap">
              {saved && <Button label="기록 삭제" variant="ghost" isDisabled={saving || deleting} onClick={() => setConfirmDelete(true)} />}
              <Button label="사고 보고서 인쇄" variant="ghost" isDisabled={draft.elderId === null} onClick={() => window.print()} />
            </HStack>
            <HStack gap={2} wrap="wrap">
              <Button label="저장" variant={status === 'OPEN' ? 'secondary' : 'primary'} isLoading={saving} isDisabled={saving || (!dirty && !!saved)} onClick={() => void save(status)} />
              {status === 'OPEN' ? (
                <Button label="저장하고 닫기" variant="primary" isDisabled={saving || !closing.ok} onClick={() => void save('CLOSED')} />
              ) : (
                <Button label="다시 열기" variant="secondary" isDisabled={saving} onClick={() => void save('OPEN')} />
              )}
            </HStack>
          </HStack>
        </div>
      </VStack>

      <CareEventReport draft={draft} elderName={elderName} />

      <LabConfirm
        isOpen={confirmDelete}
        title="이 기록을 삭제할까요?"
        description="상태변화·사고 기록이 지워지며 되돌릴 수 없습니다."
        actionLabel="삭제"
        isLoading={deleting}
        onConfirm={() => void remove()}
        onClose={() => setConfirmDelete(false)}
      />
      <LabConfirm
        isOpen={confirmLeave}
        title="저장하지 않고 나갈까요?"
        description="고친 내용이 저장되지 않았습니다."
        actionLabel="저장 안 하고 나가기"
        onConfirm={onClose}
        onClose={() => setConfirmLeave(false)}
      />
    </Card>
  );
}
