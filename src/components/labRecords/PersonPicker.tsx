'use client';

/**
 * 사람 고르기 — 어르신(참여자)·직원(참석자) 공용. 검색, 전체 선택·해제, "우선" 그룹(출석한 분)을 먼저 보여 준다.
 * 목록에 없는 id(퇴소·퇴사한 분)가 선택에 들어 있으면 저장할 때 그대로 지키되, 몇 명인지 알려 준다.
 */
import { useMemo, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import styles from './labRecords.module.css';

export interface PickerItem {
  id: number;
  name: string;
  /** 이름 아래 작은 글(직책 등) */
  hint?: string | null;
  /** 먼저 보여 줄 사람인지(예: 그날 출석) */
  priority?: boolean;
}

interface PersonPickerProps {
  label: string;
  items: ReadonlyArray<PickerItem>;
  selected: ReadonlyArray<number>;
  onChange: (ids: number[]) => void;
  /** 우선 그룹 이름(예: "출석한 어르신") — 우선 항목이 하나도 없으면 그룹 제목은 보이지 않는다 */
  priorityLabel?: string;
  max?: number;
  isDisabled?: boolean;
  emptyText?: string;
}

export default function PersonPicker({ label, items, selected, onChange, priorityLabel = '출석', max, isDisabled, emptyText = '고를 수 있는 사람이 없습니다' }: PersonPickerProps) {
  const [query, setQuery] = useState('');
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const known = useMemo(() => new Set(items.map((i) => i.id)), [items]);
  const outside = selected.filter((id) => !known.has(id)).length;

  const q = query.trim();
  const visible = useMemo(() => items.filter((i) => q === '' || i.name.includes(q)), [items, q]);
  const priority = visible.filter((i) => i.priority);
  const others = visible.filter((i) => !i.priority);
  const priorityAll = items.filter((i) => i.priority);

  const limit = max ?? Number.MAX_SAFE_INTEGER;
  const toggle = (id: number, on: boolean) => {
    if (on) {
      if (selectedSet.has(id) || selected.length >= limit) return;
      onChange([...selected, id]);
    } else {
      onChange(selected.filter((v) => v !== id));
    }
  };
  const addMany = (ids: number[]) => {
    const merged = [...selected];
    for (const id of ids) if (!selectedSet.has(id) && merged.length < limit) merged.push(id);
    onChange(merged);
  };

  const row = (item: PickerItem) => (
    <div className={styles.pickerRow} key={item.id}>
      <CheckboxInput
        label={item.name}
        description={item.hint ?? undefined}
        value={selectedSet.has(item.id)}
        isDisabled={isDisabled || (!selectedSet.has(item.id) && selected.length >= limit)}
        onChange={(checked) => toggle(item.id, checked)}
      />
    </div>
  );

  return (
    <VStack gap={2}>
      <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
        <Text type="label">
          {label} <span className={styles.mutedText}>· {selected.length}명 선택</span>
        </Text>
        <HStack gap={1} wrap="wrap">
          {priorityAll.length > 0 && (
            <Button label={`${priorityLabel} ${priorityAll.length}명 선택`} variant="secondary" isDisabled={isDisabled} onClick={() => addMany(priorityAll.map((i) => i.id))} />
          )}
          <Button label="보이는 사람 모두 선택" variant="ghost" isDisabled={isDisabled || visible.length === 0} onClick={() => addMany(visible.map((i) => i.id))} />
          <Button label="선택 해제" variant="ghost" isDisabled={isDisabled || selected.length === 0} onClick={() => onChange([])} />
        </HStack>
      </HStack>
      {items.length > 8 && <TextInput label={`${label} 찾기`} isLabelHidden placeholder="이름으로 찾기" value={query} onChange={setQuery} hasClear />}
      <div className={styles.pickerBox}>
        {items.length === 0 ? (
          <div className={styles.pickerRow}>
            <Text type="supporting" color="secondary">
              {emptyText}
            </Text>
          </div>
        ) : visible.length === 0 ? (
          <div className={styles.pickerRow}>
            <Text type="supporting" color="secondary">
              ‘{q}’와 맞는 사람이 없습니다
            </Text>
          </div>
        ) : (
          <>
            {priority.length > 0 && <div className={styles.pickerHead}>{priorityLabel}한 분 ({priority.length})</div>}
            {priority.map(row)}
            {priority.length > 0 && others.length > 0 && <div className={styles.pickerHead}>그 외 ({others.length})</div>}
            {others.map(row)}
          </>
        )}
      </div>
      {max !== undefined && selected.length >= max && (
        <Text type="supporting" color="secondary">
          최대 {max}명까지 고를 수 있습니다.
        </Text>
      )}
      {outside > 0 && (
        <Text type="supporting" color="secondary">
          목록에 없는 {outside}명(퇴소·퇴사 등)은 기록에 그대로 남습니다.
        </Text>
      )}
    </VStack>
  );
}
