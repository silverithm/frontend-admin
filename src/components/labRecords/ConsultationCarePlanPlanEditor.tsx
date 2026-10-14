'use client';

/**
 * 욕구사정·급여제공계획 편집 — 욕구사정 여섯 칸, 목표, 서비스 표(30줄), 보호자 동의일.
 * "AI 계획 초안"은 욕구사정·최근 상담 요약·위험도 단계만 보낸다(이름은 보내지 않는다). 결과는 제안이고,
 * 직접 쓴 목표·서비스는 덮어쓰지 않으며(덧붙이기 버튼으로만 더한다), 저장은 직원이 누를 때만 한다.
 */
import { useMemo, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { aiDraftCarePlan, deleteCarePlan, listCarePlans, listConsultationsByElder, saveCarePlan } from '@/lib/lab/labApi';
import type { CarePlan, CarePlanService, RiskLatest } from '@/lib/lab/labTypes';
import { CARE_PLAN_NEEDS_LABEL, CARE_PLAN_STATUS_LABEL, carePlanStatus } from '@/lib/lab/carePlanRules';
import { AiChip, Chip, ErrorBanner, LabConfirm, LabDateInput, SupportText, useNotify } from '@/components/lab/LabUi';
import { PROVIDER_KEY, dotDate, defaultPersonName, errorText, todayString, writeStored } from '@/components/lab/labFormat';
import type { LabElder } from '@/components/lab/useLabElders';
import {
  GOALS_MAX,
  MAX_SERVICES,
  NEEDS_KEYS,
  NEEDS_MAX,
  consultationsForAi,
  draftFromPlan,
  gapsOfDraft,
  isBlankRow,
  needsFilled,
  needsForAi,
  newDraft,
  riskSummaryForAi,
  rowsFromServices,
  snapshotOf,
  toInput,
  validate,
} from './ConsultationCarePlanPlanDraft';
import type { PlanDraft } from './ConsultationCarePlanPlanDraft';
import ConsultationCarePlanServices from './ConsultationCarePlanServices';
import { useAlive, useLatest } from './recordsFormat';
import styles from './labRecords.module.css';

interface Pending {
  goals: string | null;
  services: CarePlanService[];
}

interface EditorProps {
  elder: LabElder;
  year: number;
  plan: CarePlan | null;
  risk: RiskLatest | undefined;
  onSaved: (plan: CarePlan, isNew: boolean) => void;
  onDeleted: (id: number) => void;
  onClose: () => void;
  onPrint: (plan: CarePlan) => void;
}

export default function ConsultationCarePlanPlanEditor({ elder, year, plan, risk, onSaved, onDeleted, onClose, onPrint }: EditorProps) {
  const notify = useNotify();
  const alive = useAlive();
  const [draft, setDraft] = useState<PlanDraft>(() => (plan ? draftFromPlan(plan) : newDraft(todayString(), defaultPersonName())));
  const [baseline, setBaseline] = useState(() => snapshotOf(plan ? draftFromPlan(plan) : newDraft(todayString(), defaultPersonName())));
  const latest = useLatest(draft);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const dirty = snapshotOf(draft) !== baseline;
  const gaps = useMemo(() => gapsOfDraft(draft), [draft]);
  const status = carePlanStatus({ planYear: year, guardianAgreedOn: draft.guardianAgreedOn || null }, year);
  const filledNeeds = needsFilled(draft.needs);

  const setNeed = (key: (typeof NEEDS_KEYS)[number], value: string) => setDraft((d) => ({ ...d, needs: { ...d.needs, [key]: value } }));

  const runAi = async () => {
    const now0 = latest.current;
    if (!needsFilled(now0.needs) || aiLoading) return;
    setAiLoading(true);
    setAiError(null);
    setAiNotice(null);
    try {
      const prepared = needsForAi(now0.needs);
      // 최근 상담이 없거나 못 읽어도 초안은 만들 수 있다
      const consultations = await listConsultationsByElder(elder.id).then(consultationsForAi, () => undefined);
      const result = await aiDraftCarePlan({
        needs: prepared.needs,
        ...(elder.careGrade ? { grade: elder.careGrade.slice(0, 20) } : {}),
        ...(consultations ? { recentConsultations: consultations } : {}),
        ...(riskSummaryForAi(risk) ? { riskSummary: riskSummaryForAi(risk) } : {}),
      });
      if (!alive.current) return;
      // 응답이 도착한 시점의 최신 입력과 합친다. 센 값(남긴 칸·대기 제안)은 이 자리에서 바로 쓴다.
      const now = latest.current;
      const goalsText = result.goals.trim().slice(0, GOALS_MAX);
      const goalsOpen = now.goals.trim() === '' || now.goalsFromAi;
      const servicesOpen = now.services.every((r) => isBlankRow(r) || r.fromAi);
      const services = result.services.slice(0, MAX_SERVICES);
      const next: PlanDraft = { ...now, aiUsed: true };
      let keptGoals = false;
      if (goalsText !== '' && goalsOpen) {
        next.goals = goalsText;
        next.goalsFromAi = true;
      } else if (goalsText !== '' && goalsText !== now.goals.trim()) {
        keptGoals = true;
      }
      if (services.length > 0 && servicesOpen) next.services = rowsFromServices(services, true);
      const keptServices = services.length > 0 && !servicesOpen;
      setDraft(next);
      setPending(keptGoals || keptServices ? { goals: keptGoals ? goalsText : null, services: keptServices ? services : [] } : null);
      const notes: string[] = [];
      if (prepared.truncated) notes.push('욕구사정이 길어 영역마다 앞부분만 AI에 보냈습니다.');
      if (goalsText === '' && services.length === 0) notes.push('욕구사정에서 근거를 찾지 못해 제안이 비어 있습니다. 욕구를 더 구체적으로 적어 보세요.');
      setAiNotice(notes.length > 0 ? notes.join(' ') : null);
    } catch (e) {
      if (alive.current) setAiError(errorText(e, 'AI가 급여제공계획 초안을 만들지 못했습니다. 잠시 후 다시 시도해 주세요'));
    } finally {
      if (alive.current) setAiLoading(false);
    }
  };

  const appendPendingGoals = () => {
    if (!pending?.goals) return;
    const text = pending.goals;
    setDraft((d) => ({ ...d, goals: `${d.goals.trim()}\n${text}`.trim().slice(0, GOALS_MAX), goalsFromAi: false }));
    setPending((p) => (p ? { ...p, goals: null } : p));
  };
  const appendPendingServices = () => {
    if (!pending || pending.services.length === 0) return;
    const incoming = pending.services;
    setDraft((d) => {
      const kept = d.services.filter((r) => !isBlankRow(r));
      const known = new Set(kept.map((r) => `${r.area.trim()}|${r.content.trim()}`));
      const fresh = incoming.filter((s) => !known.has(`${s.area.trim()}|${s.content.trim()}`));
      return { ...d, services: [...kept, ...rowsFromServices(fresh, true)].slice(0, MAX_SERVICES) };
    });
    setPending((p) => (p ? { ...p, services: [] } : p));
  };

  // 작년 계획에서 비어 있는 칸만 가져온다
  const importLastYear = async () => {
    if (importing) return;
    setImporting(true);
    setSaveError(null);
    try {
      const list = await listCarePlans(year - 1);
      if (!alive.current) return;
      const last = list.find((p) => p.elderlyId === elder.id);
      if (!last) {
        notify(`${year - 1}년 계획이 없습니다`, 'info');
        return;
      }
      const now = latest.current;
      const needs = { ...now.needs };
      for (const k of NEEDS_KEYS) if (needs[k].trim() === '') needs[k] = last.needs[k] ?? '';
      const emptyServices = now.services.every(isBlankRow);
      setDraft({
        ...now,
        needs,
        goals: now.goals.trim() === '' ? last.goals ?? '' : now.goals,
        goalsFromAi: now.goals.trim() === '' ? false : now.goalsFromAi,
        services: emptyServices ? rowsFromServices(last.services) : now.services,
      });
      notify(`${year - 1}년 계획에서 빈 칸을 채웠습니다. 올해 상황에 맞게 고쳐 주세요`, 'info');
    } catch (e) {
      if (alive.current) setSaveError(errorText(e, '작년 계획을 불러오지 못했습니다'));
    } finally {
      if (alive.current) setImporting(false);
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
      const saved = await saveCarePlan(toInput(draft, elder.id, year, draft.aiUsed || (plan?.aiAssisted ?? false)));
      writeStored(PROVIDER_KEY, draft.writer.trim());
      onSaved(saved, !plan);
      if (alive.current) setBaseline(snapshotOf(draft));
    } catch (e) {
      if (alive.current) setSaveError(errorText(e, '급여제공계획을 저장하지 못했습니다'));
    } finally {
      if (alive.current) setSaving(false);
    }
  };

  const remove = async () => {
    if (!plan || deleting) return;
    setDeleting(true);
    try {
      await deleteCarePlan(plan.id);
      onDeleted(plan.id);
      notify('급여제공계획을 삭제했습니다', 'success');
    } catch (e) {
      if (alive.current) {
        setConfirmDelete(false);
        setSaveError(errorText(e, '급여제공계획을 삭제하지 못했습니다'));
      }
    } finally {
      if (alive.current) setDeleting(false);
    }
  };

  const close = () => (dirty ? setConfirmClose(true) : onClose());
  const aiPending = pending && (pending.goals || pending.services.length > 0);

  return (
    <Card padding={4}>
      <VStack gap={4}>
        <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
          <VStack gap={0.5}>
            <Text type="large" weight="semibold">
              {elder.name} · {year}년 욕구사정·급여제공계획
            </Text>
            <Text type="supporting" color="secondary">
              {elder.careGrade ? `${elder.careGrade} · ` : ''}
              {plan ? `마지막 저장 ${dotDate(plan.updatedAt)}` : '아직 저장된 계획이 없습니다'}
            </Text>
          </VStack>
          <HStack gap={2} vAlign="center" wrap="wrap">
            <Chip tone={status === 'OK' ? 'ok' : 'warn'} label={CARE_PLAN_STATUS_LABEL[status]} />
            {dirty && <Chip tone="warn" label="저장 전" />}
            <Button label="목록으로" variant="ghost" onClick={close} />
          </HStack>
        </HStack>

        {!plan && (
          <HStack gap={2} vAlign="center" wrap="wrap">
            <Button label={`${year - 1}년 계획에서 가져오기`} variant="secondary" isLoading={importing} isDisabled={importing} onClick={() => void importLastYear()} />
            <SupportText>작년 계획이 있으면 비어 있는 칸만 채웁니다.</SupportText>
          </HStack>
        )}

        <VStack gap={3}>
          <div className={styles.fieldGrid}>
            <LabDateInput label="욕구사정 날짜" value={draft.assessedOn} onChange={(v) => setDraft((d) => ({ ...d, assessedOn: v }))} max={todayString()} isRequired />
          </div>
          <div className={styles.fieldGridWide}>
            {NEEDS_KEYS.map((k) => (
              <TextArea key={k} label={CARE_PLAN_NEEDS_LABEL[k]} value={draft.needs[k]} onChange={(v) => setNeed(k, v.slice(0, NEEDS_MAX))} rows={3} maxLength={NEEDS_MAX} isOptional />
            ))}
          </div>
        </VStack>

        <VStack gap={2}>
          <HStack gap={3} vAlign="center" wrap="wrap">
            <Button label="AI 계획 초안" variant="secondary" isLoading={aiLoading} isDisabled={aiLoading || !filledNeeds} onClick={() => void runAi()} />
            <Text type="supporting" color="secondary">
              {filledNeeds ? '욕구사정·최근 상담 요약·위험도 단계만 AI로 보냅니다. 어르신 이름은 보내지 않습니다.' : '욕구사정을 한 칸 이상 적으면 AI 초안을 받을 수 있습니다.'}
            </Text>
          </HStack>
          {aiError && <ErrorBanner message={aiError} />}
          {(draft.aiUsed || aiPending || aiNotice) && !aiError && (
            <div className={styles.suggestBox}>
              <VStack gap={2}>
                <HStack gap={2} vAlign="center" wrap="wrap">
                  <AiChip />
                  <Text type="supporting" color="secondary">
                    제안을 목표·서비스 칸에 채웠습니다. 읽어 보고 고친 뒤 저장해 주세요.
                  </Text>
                </HStack>
                {aiNotice && <SupportText tone="warn">{aiNotice}</SupportText>}
                {pending?.goals && (
                  <VStack gap={1}>
                    <SupportText>직접 쓰신 목표는 그대로 두었습니다. AI가 제안한 목표:</SupportText>
                    <Text type="body">
                      <span className={styles.pre}>{pending.goals}</span>
                    </Text>
                    <div>
                      <Button label="목표 뒤에 덧붙이기" variant="secondary" onClick={appendPendingGoals} />
                    </div>
                  </VStack>
                )}
                {pending && pending.services.length > 0 && (
                  <VStack gap={1}>
                    <SupportText>직접 쓰신 서비스는 그대로 두었습니다. AI가 제안한 서비스 {pending.services.length}개:</SupportText>
                    {pending.services.map((s, i) => (
                      <Text key={`${i}-${s.area}`} type="supporting" color="secondary">
                        · {s.area} — {s.content}
                        {s.frequency ? ` (${s.frequency})` : ''}
                      </Text>
                    ))}
                    <div>
                      <Button label="표 끝에 추가" variant="secondary" onClick={appendPendingServices} />
                    </div>
                  </VStack>
                )}
              </VStack>
            </div>
          )}
        </VStack>

        <TextArea
          label={draft.goalsFromAi ? '목표 · AI 제안' : '목표'}
          description="욕구사정에서 이어지는 구체적인 상태로 적어 주세요. 예: 보행기로 혼자 화장실까지 이동하기"
          value={draft.goals}
          onChange={(v) => setDraft((d) => ({ ...d, goals: v.slice(0, GOALS_MAX), goalsFromAi: false }))}
          rows={4}
          maxLength={GOALS_MAX}
          isOptional
        />

        <ConsultationCarePlanServices rows={draft.services} onChange={(rows) => setDraft((d) => ({ ...d, services: rows }))} isDisabled={saving} />

        <div className={styles.suggestBox}>
          <VStack gap={1}>
            <Text type="label">계획서 점검</Text>
            {gaps.length === 0 ? (
              <SupportText>욕구사정·목표·서비스가 모두 채워졌습니다.</SupportText>
            ) : (
              <SupportText tone="warn">비어 있는 곳: {gaps.join(', ')}</SupportText>
            )}
          </VStack>
        </div>

        <div className={styles.fieldGrid}>
          <LabDateInput label="보호자 동의일" value={draft.guardianAgreedOn} onChange={(v) => setDraft((d) => ({ ...d, guardianAgreedOn: v }))} max={todayString()} />
          <TextInput label="작성자 이름" value={draft.writer} onChange={(v) => setDraft((d) => ({ ...d, writer: v.slice(0, 50) }))} isRequired />
        </div>
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Button label="오늘 동의받음" variant="ghost" onClick={() => setDraft((d) => ({ ...d, guardianAgreedOn: todayString() }))} />
          <SupportText>계획을 수급자·보호자에게 설명하고 동의받은 날을 적어야 ‘동의 완료’로 점검됩니다.</SupportText>
        </HStack>

        {saveError && <ErrorBanner message={saveError} />}

        <div className={styles.stickyBar}>
          <HStack gap={2} hAlign="between" vAlign="center" wrap="wrap">
            <HStack gap={1}>
              {plan && <Button label="계획 삭제" variant="ghost" isDisabled={saving || deleting} onClick={() => setConfirmDelete(true)} />}
              {plan && <Button label="인쇄 보기" variant="ghost" isDisabled={saving || dirty} onClick={() => onPrint(plan)} />}
            </HStack>
            <HStack gap={2}>
              <Button label="취소" variant="ghost" isDisabled={saving} onClick={close} />
              <Button label="저장" variant="primary" isLoading={saving} isDisabled={saving || (!dirty && !!plan)} onClick={() => void save()} />
            </HStack>
          </HStack>
        </div>
        {plan && dirty && <SupportText>저장한 뒤에 인쇄 보기를 열 수 있습니다.</SupportText>}
      </VStack>

      <LabConfirm
        isOpen={confirmDelete}
        title="이 급여제공계획을 삭제할까요?"
        description={`${elder.name} 어르신의 ${year}년 계획이 지워지며 되돌릴 수 없습니다.`}
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
