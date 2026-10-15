'use client';

/** 사례관리 대상 어르신 한 명 — 어르신·선정 사유·사례관리 계획·담당 직원과 반영·평가. */
import { Button } from '@astryxdesign/core/Button';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { AiChip } from '@/components/lab/LabUi';
import { MAX_PLAN, MAX_REASON } from './CaseMeetingDraft';
import type { TargetDraft } from './CaseMeetingDraft';
import CaseMeetingFollowUp from './CaseMeetingFollowUp';
import styles from './labPlans10.module.css';

interface Option {
  value: string;
  label: string;
}

interface Props {
  index: number;
  target: TargetDraft;
  heldOn: string;
  today: string;
  elderOptions: Option[];
  ownerOptions: Option[];
  eldersLoading: boolean;
  defaultEvaluator: string;
  /** 첫 대상 칸에 들어온 AI 제안 표시 */
  aiReason: boolean;
  aiPlan: boolean;
  canRemove: boolean;
  isDisabled: boolean;
  onChange: (patch: Partial<TargetDraft>) => void;
  onRemove: () => void;
}

const NO_OWNER = 'none';

export default function CaseMeetingTargetCard({ index, target, heldOn, today, elderOptions, ownerOptions, eldersLoading, defaultEvaluator, aiReason, aiPlan, canRemove, isDisabled, onChange, onRemove }: Props) {
  return (
    <div className={styles.targetCard}>
      <HStack gap={2} vAlign="center" hAlign="between" wrap="wrap">
        <Text type="label">대상 {index + 1}</Text>
        <Button label={`대상 ${index + 1} 빼기`} variant="ghost" isDisabled={isDisabled || !canRemove} onClick={onRemove} />
      </HStack>
      <div className={styles.attendeeGrid}>
        <Selector
          label="대상 어르신"
          placeholder={eldersLoading ? '어르신 목록을 불러오는 중...' : '어르신 고르기'}
          hasSearch
          searchPlaceholder="찾기"
          options={elderOptions}
          value={target.elderlyId === null ? undefined : String(target.elderlyId)}
          onChange={(v) => {
            if (v === null) return;
            onChange({ elderlyId: Number(v), elderlyName: elderOptions.find((o) => o.value === v)?.label ?? '' });
          }}
          isDisabled={isDisabled}
        />
        <Selector
          label="담당 직원 (선택)"
          placeholder="담당 직원 고르기"
          hasSearch
          searchPlaceholder="찾기"
          options={ownerOptions}
          value={target.ownerMemberId === null ? NO_OWNER : String(target.ownerMemberId)}
          onChange={(v) => onChange({ ownerMemberId: v === null || v === NO_OWNER ? null : Number(v) })}
          isDisabled={isDisabled}
        />
      </div>
      <VStack gap={1}>
        {aiReason && <AiChip />}
        <TextArea label="선정 사유" placeholder="예: 최근 낙상이 늘어 이동 보조와 환경 점검이 함께 필요함" value={target.reason} onChange={(v) => onChange({ reason: v.slice(0, MAX_REASON) })} rows={3} maxLength={MAX_REASON} isDisabled={isDisabled} />
      </VStack>
      <VStack gap={1}>
        {aiPlan && <AiChip />}
        <TextArea label="사례관리 계획" placeholder="예: 주 3회 이동 보조, 낙상 위험 환경 점검 후 30일 안에 재평가" value={target.plan} onChange={(v) => onChange({ plan: v.slice(0, MAX_PLAN) })} rows={4} maxLength={MAX_PLAN} isDisabled={isDisabled} />
      </VStack>
      <CaseMeetingFollowUp target={target} heldOn={heldOn} today={today} defaultEvaluator={defaultEvaluator} isDisabled={isDisabled} onChange={onChange} />
    </div>
  );
}
