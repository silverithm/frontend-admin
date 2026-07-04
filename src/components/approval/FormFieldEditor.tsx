'use client';

import { useState } from 'react';
import { FormFieldSchema, FormFieldOption } from '@/types/formSchema';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { Button } from '@astryxdesign/core/Button';
import { TextInput } from '@astryxdesign/core/TextInput';
import { NumberInput } from '@astryxdesign/core/NumberInput';
import { Switch } from '@astryxdesign/core/Switch';
import { Badge } from '@astryxdesign/core/Badge';
import { Text } from '@astryxdesign/core/Text';
import { Icon } from '@astryxdesign/core/Icon';
import { VStack, HStack } from '@astryxdesign/core/Stack';

interface FormFieldEditorProps {
  field: FormFieldSchema;
  onChange: (updated: FormFieldSchema) => void;
}

const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: '텍스트',
  textarea: '긴 글',
  number: '숫자',
  date: '날짜',
  dateRange: '날짜 범위',
  select: '선택',
  radio: '라디오',
  checkbox: '체크박스',
  file: '파일 첨부',
  section: '구분선',
};

export default function FormFieldEditor({ field, onChange }: FormFieldEditorProps) {
  const [newOptionLabel, setNewOptionLabel] = useState('');

  const update = (partial: Partial<FormFieldSchema>) => {
    onChange({ ...field, ...partial });
  };

  const updateValidation = (partial: Partial<FormFieldSchema['validation']>) => {
    onChange({ ...field, validation: { ...field.validation, ...partial } });
  };

  const hasOptions = field.type === 'select' || field.type === 'radio' || field.type === 'checkbox';
  const hasPlaceholder = !['section', 'file'].includes(field.type);
  const hasWidth = field.type !== 'section';
  const hasTextValidation = field.type === 'text' || field.type === 'textarea';
  const hasNumberValidation = field.type === 'number';

  const addOption = () => {
    const label = newOptionLabel.trim();
    if (!label) return;
    const newOption: FormFieldOption = { label, value: genId() };
    update({ options: [...(field.options ?? []), newOption] });
    setNewOptionLabel('');
  };

  const updateOption = (index: number, label: string) => {
    const options = (field.options ?? []).map((opt, i) =>
      i === index ? { ...opt, label } : opt
    );
    update({ options });
  };

  const removeOption = (index: number) => {
    const options = (field.options ?? []).filter((_, i) => i !== index);
    update({ options });
  };

  return (
    <VStack gap={4}>
      {/* 헤더 */}
      <div style={{ paddingBottom: 12, borderBottom: '1px solid var(--color-border)' }}>
        <HStack gap={2} vAlign="center">
          <Badge variant="teal" label={FIELD_TYPE_LABELS[field.type] ?? field.type} />
          <Text type="body" weight="semibold" maxLines={1}>
            {field.label || '(레이블 없음)'}
          </Text>
        </HStack>
      </div>

      {/* 레이블 */}
      <TextInput
        label="레이블"
        isRequired
        value={field.label}
        onChange={(value) => update({ label: value })}
        placeholder="필드 레이블을 입력하세요"
      />

      {/* 설명 */}
      <TextInput
        label="설명"
        value={field.description ?? ''}
        onChange={(value) => update({ description: value })}
        placeholder="도움말 텍스트 (선택사항)"
      />

      {/* 플레이스홀더 */}
      {hasPlaceholder && (
        <TextInput
          label="플레이스홀더"
          value={field.placeholder ?? ''}
          onChange={(value) => update({ placeholder: value })}
          placeholder="입력 힌트 텍스트"
        />
      )}

      {/* 너비 */}
      {hasWidth && (
        <VStack gap={1.5}>
          <Text type="supporting" weight="medium">너비</Text>
          <HStack gap={2}>
            {(['full', 'half'] as const).map((w) => (
              <div key={w} style={{ flex: 1 }}>
                <Button
                  label={w === 'full' ? '전체 너비' : '반 너비'}
                  variant={(field.width ?? 'full') === w ? 'primary' : 'secondary'}
                  onClick={() => update({ width: w })}
                  style={{ width: '100%' }}
                />
              </div>
            ))}
          </HStack>
        </VStack>
      )}

      {/* 필수 여부 */}
      <Switch
        label="필수 입력"
        labelPosition="start"
        labelSpacing="spread"
        value={!!field.required}
        onChange={(checked) => update({ required: checked })}
      />

      {/* 텍스트 유효성 검사 */}
      {hasTextValidation && (
        <VStack gap={2}>
          <Text type="supporting" weight="medium">글자 수 제한</Text>
          <HStack gap={2}>
            <div style={{ flex: 1 }}>
              <NumberInput
                label="최소"
                value={field.validation?.minLength}
                onChange={(value) =>
                  updateValidation({ minLength: value ?? undefined })
                }
                placeholder="0"
                min={0}
                hasClear
              />
            </div>
            <div style={{ flex: 1 }}>
              <NumberInput
                label="최대"
                value={field.validation?.maxLength}
                onChange={(value) =>
                  updateValidation({ maxLength: value ?? undefined })
                }
                placeholder="제한 없음"
                min={0}
                hasClear
              />
            </div>
          </HStack>
        </VStack>
      )}

      {/* 숫자 유효성 검사 */}
      {hasNumberValidation && (
        <VStack gap={2}>
          <Text type="supporting" weight="medium">숫자 범위</Text>
          <HStack gap={2}>
            <div style={{ flex: 1 }}>
              <NumberInput
                label="최솟값"
                value={field.validation?.min}
                onChange={(value) =>
                  updateValidation({ min: value ?? undefined })
                }
                placeholder="제한 없음"
                hasClear
              />
            </div>
            <div style={{ flex: 1 }}>
              <NumberInput
                label="최댓값"
                value={field.validation?.max}
                onChange={(value) =>
                  updateValidation({ max: value ?? undefined })
                }
                placeholder="제한 없음"
                hasClear
              />
            </div>
          </HStack>
        </VStack>
      )}

      {/* 옵션 편집 */}
      {hasOptions && (
        <VStack gap={2}>
          <Text type="supporting" weight="medium">선택지</Text>
          <VStack gap={1.5}>
            {(field.options ?? []).map((opt, index) => (
              <HStack key={opt.value} gap={2} vAlign="center">
                <div style={{ flex: 1 }}>
                  <TextInput
                    label="선택지"
                    isLabelHidden
                    value={opt.label}
                    onChange={(value) => updateOption(index, value)}
                  />
                </div>
                <Button
                  isIconOnly
                  variant="ghost"
                  label="옵션 삭제"
                  icon={<Icon icon={IconTrash} size="sm" color="error" />}
                  onClick={() => removeOption(index)}
                />
              </HStack>
            ))}
          </VStack>
          <div
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addOption();
              }
            }}
          >
            <HStack gap={2} vAlign="end">
              <div style={{ flex: 1 }}>
                <TextInput
                  label="새 선택지"
                  isLabelHidden
                  value={newOptionLabel}
                  onChange={(value) => setNewOptionLabel(value)}
                  placeholder="새 선택지 입력"
                />
              </div>
              <Button
                label="추가"
                variant="primary"
                icon={<IconPlus size={16} stroke={1.5} />}
                onClick={addOption}
              />
            </HStack>
          </div>
        </VStack>
      )}
    </VStack>
  );
}
