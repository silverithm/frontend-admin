'use client';

/** 연간계획 한 분야의 작성·수정 — 목표·세부 내용·횟수·대상·예산·작성일·작성자. 저장은 직원이 누를 때만 한다. */
import { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { deleteProgramPlan, saveProgramPlan } from '@/lib/lab/labApi';
import type { PlanCategory, ProgramPlan } from '@/lib/lab/labTypes';
import { REQUIRED_FREQUENCY, planCategoryLabel } from '@/lib/lab/programPlanRules';
import { Chip, ErrorBanner, LabConfirm, LabDateInput, NumField, SupportText } from '@/components/lab/LabUi';
import { defaultPersonName, errorText, todayString } from '@/components/lab/labFormat';
import { MAX_PLAN_BUDGET, MAX_WRITER, PLAN_LIMITS, newPlanDraft, planDraftOf, planInputOf, planSnapshot, validatePlan } from './ProgramPlanDraft';
import type { PlanDraft } from './ProgramPlanDraft';
import { useAlive } from './recordsFormat';
import styles from './labRecords.module.css';

interface Props {
  year: number;
  category: PlanCategory;
  plan: ProgramPlan | null;
  onSaved: (plan: ProgramPlan) => void;
  onDeleted: (id: number) => void;
  onClose: () => void;
}

export default function ProgramPlanAnnualEditor({ year, category, plan, onSaved, onDeleted, onClose }: Props) {
  const alive = useAlive();
  const initial = () => (plan ? planDraftOf(plan) : newPlanDraft(category, todayString(), defaultPersonName()));
  const [draft, setDraft] = useState<PlanDraft>(initial);
  const [baseline] = useState(() => planSnapshot(initial()));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  const dirty = planSnapshot(draft) !== baseline;
  const set = <K extends keyof PlanDraft>(key: K, value: PlanDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const label = planCategoryLabel(category);

  const save = async () => {
    if (saving) return;
    const problem = validatePlan(draft);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await saveProgramPlan(planInputOf(draft, year, plan?.aiAssisted ?? false));
      onSaved(saved);
    } catch (e) {
      if (alive.current) setError(errorText(e, '연간계획을 저장하지 못했습니다'));
    } finally {
      if (alive.current) setSaving(false);
    }
  };

  const remove = async () => {
    if (!plan || deleting) return;
    setDeleting(true);
    try {
      await deleteProgramPlan(plan.id);
      onDeleted(plan.id);
    } catch (e) {
      if (alive.current) {
        setConfirmDelete(false);
        setError(errorText(e, '연간계획을 삭제하지 못했습니다'));
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
            {year}년 {label} 연간계획 {plan ? '고치기' : '작성'}
          </Text>
          <HStack gap={2} vAlign="center">
            {dirty && <Chip tone="warn" label="저장 전" />}
            <Button label="닫기" variant="ghost" onClick={close} />
          </HStack>
        </HStack>
        <SupportText>평가 기준은 {label} 프로그램을 {REQUIRED_FREQUENCY[category]} 실시하는 것입니다. 횟수 칸에 계획한 횟수를 적어 주세요.</SupportText>

        <TextArea label="목표" description="이 분야 프로그램으로 어르신께 이루려는 것" placeholder="예: 근력과 균형 감각을 유지해 낙상 없이 지내도록 돕는다" value={draft.goal} onChange={(v) => set('goal', v)} rows={3} maxLength={PLAN_LIMITS.goal} />
        <TextArea label="세부 프로그램·방법" description="어떤 활동을 어떤 방식으로 하는지" placeholder="예: 매일 오전 맨손체조, 주 2회 탄력밴드 운동, 월 1회 걷기 산책" value={draft.content} onChange={(v) => set('content', v)} rows={6} maxLength={PLAN_LIMITS.content} />
        <div className={styles.fieldGrid}>
          <TextInput label="실시 횟수" placeholder="예: 주 3회" value={draft.frequency} onChange={(v) => set('frequency', v.slice(0, PLAN_LIMITS.frequency))} />
          <TextInput label="대상 (선택)" placeholder="예: 전체 어르신" value={draft.target} onChange={(v) => set('target', v.slice(0, PLAN_LIMITS.target))} />
          <NumField label="예산(원) (선택)" value={draft.budget} onChange={(v) => set('budget', v)} max={MAX_PLAN_BUDGET} placeholder="예: 500,000" />
          <LabDateInput label="작성일" value={draft.writtenOn} onChange={(v) => set('writtenOn', v)} />
          <TextInput label="작성자" value={draft.writerName} onChange={(v) => set('writerName', v.slice(0, MAX_WRITER))} />
        </div>
        <SupportText>작성일은 {year}년 안이거나 {year - 1}년 12월이어야 평가에서 인정됩니다.</SupportText>

        {error && <ErrorBanner message={error} />}

        <div className={styles.stickyBar}>
          <HStack gap={2} hAlign="between" vAlign="center" wrap="wrap">
            <div>{plan && <Button label="연간계획 삭제" variant="ghost" isDisabled={saving || deleting} onClick={() => setConfirmDelete(true)} />}</div>
            <HStack gap={2}>
              <Button label="취소" variant="ghost" isDisabled={saving} onClick={close} />
              <Button label="저장" variant="primary" isLoading={saving} isDisabled={saving || (!dirty && !!plan)} onClick={() => void save()} />
            </HStack>
          </HStack>
        </div>
      </VStack>
      <LabConfirm
        isOpen={confirmDelete}
        title={`${year}년 ${label} 연간계획을 삭제할까요?`}
        description="삭제하면 평가 준비에서 이 분야 연간계획이 없는 것으로 보이며 되돌릴 수 없습니다."
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
