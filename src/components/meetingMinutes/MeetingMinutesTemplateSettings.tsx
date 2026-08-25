'use client';

import React, { useState } from 'react';
import { FiArrowDown, FiArrowUp, FiPlus, FiX } from 'react-icons/fi';
import { Button } from '@astryxdesign/core/Button';
import { IconButton } from '@astryxdesign/core/IconButton';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Text } from '@astryxdesign/core/Text';
import { HStack, StackItem, VStack } from '@astryxdesign/core/Stack';
import { saveMeetingMinutesTemplate } from '@/lib/apiService';
import { MinutesSection } from '@/types/meetingMinutes';

interface TemplateSettingsProps {
  sections: MinutesSection[];
  onSaved: (sections: MinutesSection[]) => void;
  onNotification: (message: string, type: 'success' | 'error' | 'info') => void;
}

let keySeed = 0;
function newKey() {
  keySeed += 1;
  return `s${Date.now().toString(36)}${keySeed}`;
}

/**
 * 회의록 양식(섹션 구성) 편집.
 * 여기서 정한 섹션이 새 회의록의 뼈대가 되고, AI 자동 정리도 이 구성대로 나눠 담는다.
 * 이미 만들어진 회의록은 작성 당시 구성을 그대로 간직한다 (스냅샷).
 */
export default function MeetingMinutesTemplateSettings({
  sections,
  onSaved,
  onNotification,
}: TemplateSettingsProps) {
  const [items, setItems] = useState<MinutesSection[]>(
    sections.length > 0 ? sections : [{ key: newKey(), label: '' }],
  );
  const [saving, setSaving] = useState(false);

  const move = (index: number, delta: number) => {
    const next = [...items];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
  };

  const save = async () => {
    const cleaned = items
      .map((item) => ({ ...item, label: item.label.trim() }))
      .filter((item) => item.label.length > 0);
    if (cleaned.length === 0) {
      onNotification('섹션을 한 개 이상 만들어 주세요.', 'error');
      return;
    }
    setSaving(true);
    try {
      await saveMeetingMinutesTemplate(cleaned);
      onSaved(cleaned);
      onNotification('양식을 저장했어요. 다음 회의록부터 이 구성으로 작성됩니다.', 'success');
    } catch (error) {
      onNotification(error instanceof Error ? error.message : '양식 저장에 실패했어요.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <VStack gap={3}>
      <Text type="supporting" color="secondary">
        회의록을 나눌 섹션을 정합니다. 예: [전체], [요보팀], [어르신 특이사항].
        AI 자동 정리도 이 구성대로 내용을 나눠 담아요. 이미 작성된 회의록은 바뀌지 않습니다.
      </Text>

      <VStack gap={2}>
        {items.map((item, index) => (
          <HStack key={item.key} gap={1} vAlign="end">
            <StackItem size="fill">
              <TextInput
                label={`섹션 ${index + 1}`}
                isLabelHidden
                value={item.label}
                onChange={(value) =>
                  setItems((prev) => prev.map((s, i) => (i === index ? { ...s, label: value } : s)))
                }
                placeholder="섹션 이름 (예: 전체)"
              />
            </StackItem>
            <IconButton label="위로" variant="ghost" size="sm" icon={<FiArrowUp />} onClick={() => move(index, -1)} />
            <IconButton label="아래로" variant="ghost" size="sm" icon={<FiArrowDown />} onClick={() => move(index, 1)} />
            <IconButton
              label="섹션 삭제"
              variant="ghost"
              size="sm"
              icon={<FiX />}
              onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
            />
          </HStack>
        ))}
      </VStack>

      <HStack gap={2} hAlign="between">
        <Button
          label="섹션 추가"
          variant="secondary"
          size="sm"
          icon={<FiPlus />}
          onClick={() => setItems((prev) => [...prev, { key: newKey(), label: '' }])}
        />
        <Button label="양식 저장" variant="primary" isLoading={saving} onClick={() => void save()} />
      </HStack>
    </VStack>
  );
}
