'use client';

import { useState } from 'react';
import {
  FormFieldSchema,
  FormFieldOption,
  FormSchema,
  FieldWidth,
  FIELD_WIDTH_LABEL,
  AggregateOperation,
  AGGREGATE_LABEL,
  ConditionOperator,
  CONDITION_LABEL,
} from '@/types/formSchema';
import {
  getNumericFieldCandidates,
  getConditionFieldCandidates,
  getRepeaterCandidates,
} from '@/lib/formSchemaLogic';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { Button } from '@astryxdesign/core/Button';
import { TextInput } from '@astryxdesign/core/TextInput';
import { NumberInput } from '@astryxdesign/core/NumberInput';
import { Switch } from '@astryxdesign/core/Switch';
import { Badge } from '@astryxdesign/core/Badge';
import { Selector } from '@astryxdesign/core/Selector';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { Text } from '@astryxdesign/core/Text';
import { Icon } from '@astryxdesign/core/Icon';
import { VStack, HStack } from '@astryxdesign/core/Stack';

interface FormFieldEditorProps {
  field: FormFieldSchema;
  onChange: (updated: FormFieldSchema) => void;
  /** 계산·조건부 설정에서 다른 필드를 참조하기 위해 전체 스키마가 필요하다 */
  schema?: FormSchema;
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
  computed: '자동 계산',
  repeater: '반복 항목',
};

export default function FormFieldEditor({ field, onChange, schema }: FormFieldEditorProps) {
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

  const numericCandidates = schema ? getNumericFieldCandidates(schema, field.id) : [];
  const conditionCandidates = schema ? getConditionFieldCandidates(schema, field.id) : [];
  const repeaterCandidates = schema ? getRepeaterCandidates(schema) : [];

  const updateComputed = (partial: Partial<NonNullable<FormFieldSchema['computed']>>) => {
    onChange({
      ...field,
      computed: { operation: 'sum', ...(field.computed ?? {}), ...partial },
    });
  };

  const updateRepeater = (partial: Partial<NonNullable<FormFieldSchema['repeater']>>) => {
    onChange({
      ...field,
      repeater: { fields: [], ...(field.repeater ?? {}), ...partial },
    });
  };

  const updateRepeaterField = (index: number, partial: Partial<FormFieldSchema>) => {
    const fields = (field.repeater?.fields ?? []).map((f, i) => (i === index ? { ...f, ...partial } : f));
    updateRepeater({ fields });
  };

  const addRepeaterField = () => {
    const fields = [
      ...(field.repeater?.fields ?? []),
      { id: genId(), type: 'text' as const, label: '새 열', required: false, width: 'third' as FieldWidth },
    ];
    updateRepeater({ fields });
  };

  const removeRepeaterField = (index: number) => {
    updateRepeater({ fields: (field.repeater?.fields ?? []).filter((_, i) => i !== index) });
  };

  const updateVisibility = (partial: Partial<NonNullable<FormFieldSchema['visibleWhen']>>) => {
    onChange({
      ...field,
      visibleWhen: { match: 'all', conditions: [], ...(field.visibleWhen ?? {}), ...partial },
    });
  };

  const updateCondition = (index: number, partial: Partial<{ fieldId: string; operator: ConditionOperator; value: string }>) => {
    const conditions = (field.visibleWhen?.conditions ?? []).map((c, i) =>
      i === index ? { ...c, ...partial } : c
    );
    updateVisibility({ conditions });
  };

  const addCondition = () => {
    updateVisibility({
      conditions: [
        ...(field.visibleWhen?.conditions ?? []),
        { fieldId: '', operator: 'equals' as ConditionOperator, value: '' },
      ],
    });
  };

  const removeCondition = (index: number) => {
    updateVisibility({ conditions: (field.visibleWhen?.conditions ?? []).filter((_, i) => i !== index) });
  };

  const removeOption = (index: number) => {
    const options = (field.options ?? []).filter((_, i) => i !== index);
    update({ options });
  };

  return (
    <VStack gap={4}>
      {/* 헤더 */}
      <div style={{ paddingBottom: 'var(--spacing-3)', borderBottom: '1px solid var(--color-border)' }}>
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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-1-5)' }}>
            {(['full', 'twoThirds', 'half', 'third', 'quarter'] as FieldWidth[]).map((w) => (
              <Button
                key={w}
                label={FIELD_WIDTH_LABEL[w]}
                size="sm"
                variant={(field.width ?? 'full') === w ? 'primary' : 'secondary'}
                onClick={() => update({ width: w })}
              />
            ))}
          </div>
          <Text type="supporting" color="secondary">
            같은 줄에 들어갈 만큼 폭이 남으면 다음 필드가 옆으로 붙습니다.
          </Text>
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

      {/* 자동 계산 설정 */}
      {field.type === 'computed' && (
        <VStack gap={2}>
          <Text type="supporting" weight="medium">자동 계산</Text>
          <Selector
            label="연산"
            width="100%"
            value={field.computed?.operation ?? 'sum'}
            options={(['sum', 'average', 'count'] as AggregateOperation[]).map((op) => ({
              value: op,
              label: AGGREGATE_LABEL[op],
            }))}
            onChange={(value) => updateComputed({ operation: value as AggregateOperation })}
          />

          <Text type="supporting" color="secondary">집계할 숫자 필드</Text>
          {numericCandidates.length === 0 ? (
            <Text type="supporting" color="secondary">숫자 필드를 먼저 추가해주세요.</Text>
          ) : (
            <VStack gap={1}>
              {numericCandidates.map((candidate) => (
                <CheckboxInput
                  key={candidate.value}
                  label={candidate.label}
                  size="sm"
                  value={(field.computed?.sourceFieldIds ?? []).includes(candidate.value)}
                  onChange={(checked) => {
                    const current = field.computed?.sourceFieldIds ?? [];
                    updateComputed({
                      sourceFieldIds: checked
                        ? [...current, candidate.value]
                        : current.filter((id) => id !== candidate.value),
                    });
                  }}
                />
              ))}
            </VStack>
          )}

          {repeaterCandidates.length > 0 && (
            <>
              <Text type="supporting" color="secondary">반복 항목의 열도 합산할 수 있습니다</Text>
              <Selector
                label="반복 항목"
                width="100%"
                value={field.computed?.sourceRepeaterId ?? ''}
                options={[
                  { value: '', label: '사용 안 함' },
                  ...repeaterCandidates.map((r) => ({ value: r.id, label: r.label })),
                ]}
                onChange={(value) =>
                  updateComputed({ sourceRepeaterId: value || undefined, sourceRepeaterFieldId: undefined })
                }
              />
              {field.computed?.sourceRepeaterId && (
                <Selector
                  label="합산할 열"
                  width="100%"
                  value={field.computed?.sourceRepeaterFieldId ?? ''}
                  options={[
                    { value: '', label: '선택하세요' },
                    ...(repeaterCandidates
                      .find((r) => r.id === field.computed?.sourceRepeaterId)
                      ?.repeater?.fields.filter((f) => f.type === 'number')
                      .map((f) => ({ value: f.id, label: f.label })) ?? []),
                  ]}
                  onChange={(value) => updateComputed({ sourceRepeaterFieldId: value || undefined })}
                />
              )}
            </>
          )}

          <TextInput
            label="단위"
            value={field.computed?.unit ?? ''}
            onChange={(value) => updateComputed({ unit: value })}
            placeholder="원, 시간 등 (선택사항)"
          />
        </VStack>
      )}

      {/* 반복 항목의 열 구성 */}
      {field.type === 'repeater' && (
        <VStack gap={2}>
          <Text type="supporting" weight="medium">열 구성</Text>
          {(field.repeater?.fields ?? []).map((sub, index) => (
            <div
              key={sub.id}
              style={{
                padding: 'var(--spacing-2)',
                borderRadius: 'var(--radius-inner)',
                border: '1px solid var(--color-border)',
              }}
            >
              <VStack gap={1.5}>
                <HStack gap={1.5} vAlign="center">
                  <div style={{ flex: 1 }}>
                    <TextInput
                      label="열 이름"
                      isLabelHidden
                      value={sub.label}
                      onChange={(value) => updateRepeaterField(index, { label: value })}
                      placeholder="열 이름"
                    />
                  </div>
                  <Button
                    label="열 삭제"
                    variant="ghost"
                    size="sm"
                    isIconOnly
                    icon={<Icon icon={IconTrash} size="sm" />}
                    onClick={() => removeRepeaterField(index)}
                  />
                </HStack>
                <HStack gap={1.5} vAlign="center">
                  <div style={{ flex: 1 }}>
                    <Selector
                      label="유형"
                      isLabelHidden
                      width="100%"
                      value={sub.type}
                      options={[
                        { value: 'text', label: '텍스트' },
                        { value: 'number', label: '숫자' },
                        { value: 'date', label: '날짜' },
                        { value: 'select', label: '선택' },
                      ]}
                      onChange={(value) => updateRepeaterField(index, { type: value as FormFieldSchema['type'] })}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <Selector
                      label="폭"
                      isLabelHidden
                      width="100%"
                      value={sub.width ?? 'third'}
                      options={(['full', 'half', 'third', 'quarter'] as FieldWidth[]).map((w) => ({
                        value: w,
                        label: FIELD_WIDTH_LABEL[w],
                      }))}
                      onChange={(value) => updateRepeaterField(index, { width: value as FieldWidth })}
                    />
                  </div>
                  <CheckboxInput
                    label="필수"
                    size="sm"
                    value={!!sub.required}
                    onChange={(checked) => updateRepeaterField(index, { required: checked })}
                  />
                </HStack>
              </VStack>
            </div>
          ))}
          <Button
            label="열 추가"
            variant="secondary"
            size="sm"
            icon={<Icon icon={IconPlus} size="sm" />}
            onClick={addRepeaterField}
          />
          <HStack gap={2}>
            <div style={{ flex: 1 }}>
              <NumberInput
                label="최소 행 수"
                value={field.repeater?.minRows}
                min={0}
                onChange={(value) => updateRepeater({ minRows: value ?? undefined })}
              />
            </div>
            <div style={{ flex: 1 }}>
              <NumberInput
                label="최대 행 수"
                value={field.repeater?.maxRows}
                min={1}
                onChange={(value) => updateRepeater({ maxRows: value ?? undefined })}
              />
            </div>
          </HStack>
        </VStack>
      )}

      {/* 조건부 표시 */}
      {field.type !== 'section' && (
        <VStack gap={2}>
          <Switch
            label="조건을 만족할 때만 표시"
            labelPosition="start"
            labelSpacing="spread"
            value={!!field.visibleWhen}
            onChange={(checked) =>
              update({
                visibleWhen: checked
                  ? { match: 'all', conditions: [{ fieldId: '', operator: 'equals', value: '' }] }
                  : undefined,
              })
            }
          />

          {field.visibleWhen && (
            <VStack gap={2}>
              {conditionCandidates.length === 0 ? (
                <Text type="supporting" color="secondary">
                  기준이 될 다른 필드가 없습니다. 선택 필드를 먼저 추가해주세요.
                </Text>
              ) : (
                <>
                  <Selector
                    label="조건 결합"
                    width="100%"
                    value={field.visibleWhen.match}
                    options={[
                      { value: 'all', label: '모든 조건을 만족할 때' },
                      { value: 'any', label: '하나라도 만족할 때' },
                    ]}
                    onChange={(value) => updateVisibility({ match: value as 'all' | 'any' })}
                  />

                  {field.visibleWhen.conditions.map((condition, index) => {
                    const sourceField = schema?.fields.find((f) => f.id === condition.fieldId);
                    const needsValue = condition.operator !== 'isEmpty' && condition.operator !== 'isNotEmpty';
                    return (
                      <div
                        key={index}
                        style={{
                          padding: 'var(--spacing-2)',
                          borderRadius: 'var(--radius-inner)',
                          border: '1px solid var(--color-border)',
                        }}
                      >
                        <VStack gap={1.5}>
                          <Selector
                            label="기준 필드"
                            isLabelHidden
                            width="100%"
                            value={condition.fieldId}
                            options={[{ value: '', label: '필드를 선택하세요' }, ...conditionCandidates]}
                            onChange={(value) => updateCondition(index, { fieldId: value })}
                          />
                          <HStack gap={1.5} vAlign="center">
                            <div style={{ flex: 1 }}>
                              <Selector
                                label="조건"
                                isLabelHidden
                                width="100%"
                                value={condition.operator}
                                options={(Object.keys(CONDITION_LABEL) as ConditionOperator[]).map((op) => ({
                                  value: op,
                                  label: CONDITION_LABEL[op],
                                }))}
                                onChange={(value) => updateCondition(index, { operator: value as ConditionOperator })}
                              />
                            </div>
                            <Button
                              label="조건 삭제"
                              variant="ghost"
                              size="sm"
                              isIconOnly
                              icon={<Icon icon={IconTrash} size="sm" />}
                              onClick={() => removeCondition(index)}
                            />
                          </HStack>
                          {needsValue &&
                            (sourceField?.options?.length ? (
                              <Selector
                                label="값"
                                isLabelHidden
                                width="100%"
                                value={condition.value ?? ''}
                                options={[
                                  { value: '', label: '값을 선택하세요' },
                                  ...sourceField.options.map((o) => ({ value: o.value, label: o.label })),
                                ]}
                                onChange={(value) => updateCondition(index, { value })}
                              />
                            ) : (
                              <TextInput
                                label="값"
                                isLabelHidden
                                value={condition.value ?? ''}
                                onChange={(value) => updateCondition(index, { value })}
                                placeholder="비교할 값"
                              />
                            ))}
                        </VStack>
                      </div>
                    );
                  })}

                  <Button
                    label="조건 추가"
                    variant="secondary"
                    size="sm"
                    icon={<Icon icon={IconPlus} size="sm" />}
                    onClick={addCondition}
                  />
                </>
              )}
            </VStack>
          )}
        </VStack>
      )}

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
