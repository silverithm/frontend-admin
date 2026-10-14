'use client';

/** 투약의뢰서의 약 한 가지 — 이름·용량·경로·시간대(여러 개)·복용 시점·메모. 좁은 화면에서도 한 줄씩 쌓인다. */
import { Button } from '@astryxdesign/core/Button';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import type { MedicationRoute, MedicationSlot, MedicationTiming } from '@/lib/lab/labTypes';
import { MAX_MEDICINE_DOSE, MAX_MEDICINE_NAME, MAX_MEDICINE_NOTE, ROUTES, SLOTS, TIMINGS } from '@/lib/lab/medicationRules';
import { AiChip } from '@/components/lab/LabUi';
import type { ItemDraft } from './MedicationDraft';
import styles from './labRecords.module.css';
import own from './MedicationBath.module.css';

interface Props {
  item: ItemDraft;
  index: number;
  onChange: (patch: Partial<ItemDraft>) => void;
  onRemove: () => void;
  canRemove: boolean;
  isDisabled?: boolean;
}

export default function MedicationItemBlock({ item, index, onChange, onRemove, canRemove, isDisabled }: Props) {
  const toggleSlot = (slot: MedicationSlot, on: boolean) => {
    const next = on ? [...item.slots, slot] : item.slots.filter((s) => s !== slot);
    onChange({ slots: SLOTS.map((s) => s.value).filter((v) => next.includes(v)), ai: false });
  };
  return (
    <div className={`${own.itemBlock} ${item.ai ? own.itemBlockAi : ''}`} role="group" aria-label={`${index + 1}번째 약`}>
      <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
        <HStack gap={2} vAlign="center">
          <Text type="label">{index + 1}번째 약</Text>
          {item.ai && <AiChip />}
        </HStack>
        <Button label="이 약 빼기" variant="ghost" isDisabled={isDisabled || !canRemove} onClick={onRemove} />
      </HStack>
      <div className={styles.fieldGrid}>
        <TextInput label="약 이름" placeholder="예: 혈압약" value={item.name} onChange={(v) => onChange({ name: v.slice(0, MAX_MEDICINE_NAME), ai: false })} isDisabled={isDisabled} />
        <TextInput label="용량 (선택)" placeholder="예: 1정" value={item.dose} onChange={(v) => onChange({ dose: v.slice(0, MAX_MEDICINE_DOSE), ai: false })} isDisabled={isDisabled} />
        <Selector
          label="경로"
          placeholder="고르기"
          options={ROUTES.map((r) => ({ value: r.value, label: r.label }))}
          value={item.route}
          onChange={(v) => v && onChange({ route: v as MedicationRoute, ai: false })}
          isDisabled={isDisabled}
        />
        <Selector
          label="복용 시점"
          placeholder="고르기"
          options={TIMINGS.map((t) => ({ value: t.value, label: t.label }))}
          value={item.timing}
          onChange={(v) => v && onChange({ timing: v as MedicationTiming, ai: false })}
          isDisabled={isDisabled}
        />
      </div>
      <div role="group" aria-label={`${index + 1}번째 약 먹는 시간대`}>
        <Text type="label">먹는 시간대</Text>
        <div className={own.slotChecks}>
          {SLOTS.map((s) => (
            <CheckboxInput key={s.value} label={s.label} value={item.slots.includes(s.value)} isDisabled={isDisabled} onChange={(on) => toggleSlot(s.value, on)} />
          ))}
        </div>
        {item.slots.length === 0 && (
          <Text type="supporting" color="secondary">
            시간대를 고르지 않으면 오늘 투약에 나타나지 않습니다.
          </Text>
        )}
      </div>
      <TextInput label="메모 (선택)" placeholder="예: 갈아서, 물 많이" value={item.note} onChange={(v) => onChange({ note: v.slice(0, MAX_MEDICINE_NOTE), ai: false })} isDisabled={isDisabled} />
    </div>
  );
}
