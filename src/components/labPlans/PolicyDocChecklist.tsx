'use client';

/** 항목 체크리스트 — 종류에 맞는 항목(itemsOf)을 직접 확인해 체크한다. AI 제안으로 체크된 항목에는 표시가 붙는다. */
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { AiChip, Chip } from '@/components/lab/LabUi';
import { docStatus, itemsOf } from '@/lib/lab/policyDocRules';
import type { PolicyDraft } from './PolicyDocDraft';
import styles from './labPlans10.module.css';

interface Props {
  draft: PolicyDraft;
  today: string;
  isDisabled: boolean;
  onToggle: (key: string, on: boolean) => void;
}

export default function PolicyDocChecklist({ draft, today, isDisabled, onToggle }: Props) {
  const items = itemsOf(draft.kind, draft.guideNo);
  if (items.length === 0) {
    return <Text type="supporting" color="secondary">이 종류는 항목을 체크하지 않습니다. 개정일과 비치 장소만 적으면 됩니다.</Text>;
  }
  const status = docStatus({ kind: draft.kind, guideNo: draft.guideNo, revisedOn: draft.revisedOn === '' ? null : draft.revisedOn, location: draft.location, checks: draft.checks }, today);
  return (
    <VStack gap={2}>
      <HStack gap={2} vAlign="center" wrap="wrap">
        <Text type="label">항목 확인</Text>
        <Chip tone={status.complete ? 'ok' : 'warn'} label={`${status.itemsChecked}/${status.itemsTotal}`} />
      </HStack>
      <div className={styles.checklist}>
        {items.map((i) => (
          <div key={i.key} className={styles.checkItem}>
            <CheckboxInput label={i.label} value={draft.checks[i.key] === true} onChange={(on) => onToggle(i.key, on)} isDisabled={isDisabled} />
            {draft.ai[i.key] && <AiChip />}
          </div>
        ))}
      </div>
    </VStack>
  );
}
