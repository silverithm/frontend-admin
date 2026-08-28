'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { FiArrowDown, FiArrowUp, FiPlus, FiTrash2, FiX } from 'react-icons/fi';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { ClickableCard } from '@astryxdesign/core/ClickableCard';
import { Divider } from '@astryxdesign/core/Divider';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Loading } from '@/components/Loading';
import { Switch } from '@astryxdesign/core/Switch';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Text } from '@astryxdesign/core/Text';
import { Grid } from '@astryxdesign/core/Grid';
import { HStack, StackItem, VStack } from '@astryxdesign/core/Stack';
import { useConfirm } from '@/components/ConfirmDialog';
import {
  createMeetingMinutesTemplate,
  deleteMeetingMinutesTemplate,
  listMeetingMinutesTemplates,
  updateMeetingMinutesTemplate,
} from '@/lib/apiService';
import { MinutesSection, MinutesTemplate } from '@/types/meetingMinutes';

interface TemplateManagerProps {
  onClose: () => void;
  onNotification: (message: string, type: 'success' | 'error' | 'info') => void;
}

let keySeed = 0;
function newSectionKey() {
  keySeed += 1;
  return `s${Date.now().toString(36)}${keySeed}`;
}

/** 편집 중인 양식의 임시 상태 */
interface DraftState {
  name: string;
  sections: MinutesSection[];
  aiInstruction: string;
  formatExample: string;
  isDefault: boolean;
}

function toDraft(template: MinutesTemplate): DraftState {
  return {
    name: template.name,
    sections: template.sections.length > 0 ? template.sections : [{ key: newSectionKey(), label: '' }],
    aiInstruction: template.aiInstruction ?? '',
    formatExample: template.formatExample ?? '',
    isDefault: template.isDefault,
  };
}

/**
 * 회의록 양식 관리 — 회사당 여러 개(전체회의용/사례회의용 등)를 만들어 저장해두고 골라 쓴다.
 * 각 양식은 섹션 구성 + AI 자동 정리가 따를 지시·출력 형식 예시를 함께 담는다.
 * 이미 작성된 회의록은 작성 당시 섹션을 스냅샷으로 갖고 있어 양식을 나중에 고쳐도 바뀌지 않는다.
 */
export default function MeetingMinutesTemplateSettings({ onClose, onNotification }: TemplateManagerProps) {
  const { confirm, ConfirmContainer } = useConfirm();
  const [templates, setTemplates] = useState<MinutesTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const keyOf = (t: MinutesTemplate) => (t.id != null ? String(t.id) : 'new');

  const reload = useCallback(async (selectKey?: string) => {
    setIsLoading(true);
    try {
      const list = await listMeetingMinutesTemplates();
      setTemplates(list);
      const target = selectKey
        ? list.find((t) => keyOf(t) === selectKey)
        : list.find((t) => keyOf(t) === selectedKey) ?? list[0];
      if (target) {
        setSelectedKey(keyOf(target));
        setDraft(toDraft(target));
      } else {
        setSelectedKey(null);
        setDraft(null);
      }
    } catch (error) {
      onNotification(error instanceof Error ? error.message : '양식을 불러오지 못했어요.', 'error');
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onNotification]);

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedTemplate = templates.find((t) => keyOf(t) === selectedKey) ?? null;

  const selectTemplate = (template: MinutesTemplate) => {
    setSelectedKey(keyOf(template));
    setDraft(toDraft(template));
  };

  const startNewTemplate = () => {
    setSelectedKey(null);
    setDraft({
      name: '',
      sections: [{ key: newSectionKey(), label: '' }],
      aiInstruction: '',
      formatExample: '',
      isDefault: templates.length === 0,
    });
  };

  const moveSection = (index: number, delta: number) => {
    if (!draft) return;
    const next = [...draft.sections];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setDraft({ ...draft, sections: next });
  };

  const save = async () => {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) {
      onNotification('양식 이름을 입력해 주세요.', 'error');
      return;
    }
    const cleanedSections = draft.sections
      .map((s) => ({ ...s, label: s.label.trim() }))
      .filter((s) => s.label.length > 0);
    if (cleanedSections.length === 0) {
      onNotification('섹션을 한 개 이상 만들어 주세요.', 'error');
      return;
    }

    setSaving(true);
    try {
      const input = {
        name,
        sections: cleanedSections,
        aiInstruction: draft.aiInstruction.trim() || null,
        formatExample: draft.formatExample.trim() || null,
        isDefault: draft.isDefault,
      };
      if (selectedTemplate?.id != null) {
        const saved = await updateMeetingMinutesTemplate(selectedTemplate.id, input);
        onNotification('양식을 저장했어요.', 'success');
        await reload(keyOf(saved));
      } else {
        const saved = await createMeetingMinutesTemplate(input);
        onNotification('새 양식을 만들었어요.', 'success');
        await reload(keyOf(saved));
      }
    } catch (error) {
      onNotification(error instanceof Error ? error.message : '양식 저장에 실패했어요.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const removeTemplate = async () => {
    if (!selectedTemplate?.id) return;
    const ok = await confirm({
      title: '양식을 삭제할까요?',
      message: `"${selectedTemplate.name}" 양식을 삭제합니다. 이미 작성된 회의록에는 영향이 없습니다.`,
      confirmText: '삭제',
      type: 'danger',
    });
    if (!ok) return;

    setDeleting(true);
    try {
      await deleteMeetingMinutesTemplate(selectedTemplate.id);
      onNotification('양식을 삭제했어요.', 'success');
      await reload();
    } catch (error) {
      onNotification(error instanceof Error ? error.message : '삭제에 실패했어요.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  if (isLoading) {
    return <Loading size="inline" label="양식을 불러오는 중..." />;
  }

  return (
    <VStack gap={4}>
      <ConfirmContainer />
      <Text type="supporting" color="secondary">
        회의 성격별로 양식을 여러 개 만들어 두고 골라 쓸 수 있어요. 각 양식은 섹션 구성과, AI 자동 정리가
        따를 지시·출력 형식 예시를 함께 담습니다. 이미 작성된 회의록은 바뀌지 않아요.
      </Text>

      <Grid columns={3} gap={4}>
        {/* 양식 목록 */}
        <StackItem>
          <VStack gap={2}>
            {templates.map((template) => (
              <ClickableCard
                key={keyOf(template)}
                label={`${template.name} 양식 편집`}
                onClick={() => selectTemplate(template)}
                padding={2}
                isDisabled={keyOf(template) === selectedKey && selectedTemplate != null}
              >
                <HStack gap={1} vAlign="center" hAlign="between">
                  <Text type="supporting" weight={keyOf(template) === selectedKey ? 'semibold' : 'medium'}>
                    {template.name}
                  </Text>
                  {template.isDefault && <Badge variant="teal" label="기본" />}
                </HStack>
              </ClickableCard>
            ))}
            <Button label="새 양식 만들기" variant="ghost" size="sm" icon={<FiPlus />} onClick={startNewTemplate} />
          </VStack>
        </StackItem>

        {/* 편집 영역 */}
        <StackItem size="fill">
          {draft ? (
            <VStack gap={3}>
              <TextInput
                label="양식 이름"
                value={draft.name}
                onChange={(value) => setDraft({ ...draft, name: value })}
                placeholder="예: 전체회의용, 사례회의용"
              />

              <VStack gap={1}>
                <Text type="label" weight="medium">섹션 구성</Text>
                <VStack gap={2}>
                  {draft.sections.map((item, index) => (
                    <HStack key={item.key} gap={1} vAlign="end">
                      <StackItem size="fill">
                        <TextInput
                          label={`섹션 ${index + 1}`}
                          isLabelHidden
                          value={item.label}
                          onChange={(value) =>
                            setDraft({
                              ...draft,
                              sections: draft.sections.map((s, i) => (i === index ? { ...s, label: value } : s)),
                            })
                          }
                          placeholder="섹션 이름 (예: 전체)"
                        />
                      </StackItem>
                      <IconButton label="위로" variant="ghost" size="sm" icon={<FiArrowUp />} onClick={() => moveSection(index, -1)} />
                      <IconButton label="아래로" variant="ghost" size="sm" icon={<FiArrowDown />} onClick={() => moveSection(index, 1)} />
                      <IconButton
                        label="섹션 삭제"
                        variant="ghost"
                        size="sm"
                        icon={<FiX />}
                        onClick={() => setDraft({ ...draft, sections: draft.sections.filter((_, i) => i !== index) })}
                      />
                    </HStack>
                  ))}
                </VStack>
                <Button
                  label="섹션 추가"
                  variant="ghost"
                  size="sm"
                  icon={<FiPlus />}
                  onClick={() => setDraft({ ...draft, sections: [...draft.sections, { key: newSectionKey(), label: '' }] })}
                />
              </VStack>

              <Divider />

              <TextArea
                label="AI 정리 지시 (선택)"
                value={draft.aiInstruction}
                onChange={(value) => setDraft({ ...draft, aiInstruction: value })}
                placeholder="예: 존댓말로 정리해줘 / 담당자 이름을 항목 맨 앞에 붙여줘 / 어르신별로 묶어줘"
                rows={2}
              />
              <TextArea
                label="출력 형식 예시 (선택)"
                value={draft.formatExample}
                onChange={(value) => setDraft({ ...draft, formatExample: value })}
                placeholder={'이렇게 적어두면 AI 자동 정리가 이 형식을 따라가요.\n예) * [김선생] 어르신 목욕 일정 화요일로 조정.'}
                rows={3}
              />

              <Switch
                label="이 양식을 기본으로 사용"
                value={draft.isDefault}
                onChange={(checked) => setDraft({ ...draft, isDefault: checked })}
                labelPosition="start"
                labelSpacing="spread"
              />

              <HStack gap={2} hAlign="between">
                {selectedTemplate?.id != null ? (
                  <Button
                    label="삭제"
                    variant="destructive"
                    icon={<FiTrash2 />}
                    isLoading={deleting}
                    onClick={() => void removeTemplate()}
                  />
                ) : <span />}
                <Button label="양식 저장" variant="primary" isLoading={saving} onClick={() => void save()} />
              </HStack>
            </VStack>
          ) : (
            <Text type="supporting" color="secondary">왼쪽에서 양식을 고르거나 새로 만들어 주세요.</Text>
          )}
        </StackItem>
      </Grid>

      <Divider />

      <HStack hAlign="end">
        <Button label="닫기" variant="secondary" onClick={onClose} />
      </HStack>
    </VStack>
  );
}
