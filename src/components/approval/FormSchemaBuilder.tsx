'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FormSchema, FormFieldSchema, FieldType } from '@/types/formSchema';
import { formPresets } from '@/lib/formTemplatePresets';
import FieldTypeSelector from './FieldTypeSelector';
import FormFieldEditor from './FormFieldEditor';
import FormPreview from './FormPreview';
import { Button } from '@astryxdesign/core/Button';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Text } from '@astryxdesign/core/Text';
import { Icon } from '@astryxdesign/core/Icon';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import {
  IconPlus,
  IconChevronUp,
  IconChevronDown,
  IconEye,
  IconLetterCase,
  IconAlignLeft,
  IconHash,
  IconCalendar,
  IconCalendarEvent,
  IconCircleDot,
  IconSquareCheck,
  IconPaperclip,
  IconSeparator,
  IconX,
} from '@tabler/icons-react';

interface FormSchemaBuilderProps {
  initialSchema?: FormSchema;
  onSchemaChange: (schema: FormSchema) => void;
}

const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

const FIELD_TYPE_ICONS: Record<FieldType, React.ReactNode> = {
  text: <IconLetterCase size={14} stroke={1.5} />,
  textarea: <IconAlignLeft size={14} stroke={1.5} />,
  number: <IconHash size={14} stroke={1.5} />,
  date: <IconCalendar size={14} stroke={1.5} />,
  dateRange: <IconCalendarEvent size={14} stroke={1.5} />,
  select: <IconChevronDown size={14} stroke={1.5} />,
  radio: <IconCircleDot size={14} stroke={1.5} />,
  checkbox: <IconSquareCheck size={14} stroke={1.5} />,
  file: <IconPaperclip size={14} stroke={1.5} />,
  section: <IconSeparator size={14} stroke={1.5} />,
};

const DEFAULT_FIELD_BY_TYPE: Record<FieldType, Partial<FormFieldSchema>> = {
  text: { label: '텍스트 필드', placeholder: '입력하세요', width: 'full', required: false },
  textarea: { label: '텍스트 영역', placeholder: '내용을 입력하세요', width: 'full', required: false },
  number: { label: '숫자 필드', placeholder: '0', width: 'half', required: false },
  date: { label: '날짜', width: 'half', required: false },
  dateRange: { label: '날짜 범위', width: 'full', required: false },
  select: {
    label: '선택 필드',
    placeholder: '선택하세요',
    width: 'half',
    required: false,
    options: [
      { label: '옵션 1', value: genId() },
      { label: '옵션 2', value: genId() },
    ],
  },
  radio: {
    label: '라디오 필드',
    width: 'full',
    required: false,
    options: [
      { label: '항목 1', value: genId() },
      { label: '항목 2', value: genId() },
    ],
  },
  checkbox: {
    label: '체크박스 필드',
    width: 'full',
    required: false,
    options: [
      { label: '항목 1', value: genId() },
      { label: '항목 2', value: genId() },
    ],
  },
  file: { label: '파일 첨부', width: 'full', required: false },
  section: { label: '구분선', required: false },
};

const EMPTY_SCHEMA: FormSchema = { version: 1, fields: [] };

export default function FormSchemaBuilder({ initialSchema, onSchemaChange }: FormSchemaBuilderProps) {
  const [schema, setSchema] = useState<FormSchema>(initialSchema ?? EMPTY_SCHEMA);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [showFieldTypeSelector, setShowFieldTypeSelector] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showPresetMenu, setShowPresetMenu] = useState(false);

  useEffect(() => {
    onSchemaChange(schema);
  }, [schema, onSchemaChange]);

  const updateSchema = (updated: FormSchema) => {
    setSchema(updated);
  };

  const addField = (type: FieldType) => {
    const defaults = DEFAULT_FIELD_BY_TYPE[type];
    const newField: FormFieldSchema = {
      id: genId(),
      type,
      label: defaults.label ?? type,
      required: defaults.required ?? false,
      width: defaults.width ?? 'full',
      placeholder: defaults.placeholder,
      options: defaults.options ? defaults.options.map((o) => ({ ...o, value: genId() })) : undefined,
    };
    const updated: FormSchema = {
      ...schema,
      fields: [...schema.fields, newField],
    };
    updateSchema(updated);
    setSelectedFieldId(newField.id);
  };

  const updateField = (updated: FormFieldSchema) => {
    const fields = schema.fields.map((f) => (f.id === updated.id ? updated : f));
    updateSchema({ ...schema, fields });
  };

  const removeField = (id: string) => {
    const fields = schema.fields.filter((f) => f.id !== id);
    updateSchema({ ...schema, fields });
    if (selectedFieldId === id) {
      setSelectedFieldId(null);
    }
  };

  const moveField = (id: string, direction: 'up' | 'down') => {
    const index = schema.fields.findIndex((f) => f.id === id);
    if (index < 0) return;
    const newFields = [...schema.fields];
    if (direction === 'up' && index > 0) {
      [newFields[index - 1], newFields[index]] = [newFields[index], newFields[index - 1]];
    } else if (direction === 'down' && index < newFields.length - 1) {
      [newFields[index], newFields[index + 1]] = [newFields[index + 1], newFields[index]];
    }
    updateSchema({ ...schema, fields: newFields });
  };

  const loadPreset = (presetId: string) => {
    const preset = formPresets.find((p) => p.id === presetId);
    if (!preset) return;
    updateSchema(preset.schema);
    setSelectedFieldId(null);
    setShowPresetMenu(false);
  };

  const selectedField = schema.fields.find((f) => f.id === selectedFieldId) ?? null;

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* 메인 영역 */}
        <div
          style={{
            display: 'flex',
            flex: 1,
            minHeight: 0,
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-container)',
            overflow: 'hidden',
          }}
        >
          {/* 왼쪽: 필드 목록 */}
          <div
            style={{
              flex: 2,
              display: 'flex',
              flexDirection: 'column',
              borderRight: '1px solid var(--color-border)',
              background: 'var(--color-background-card)',
            }}
          >
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--color-border)',
                background: 'var(--color-background-muted)',
              }}
            >
              <HStack gap={1} vAlign="center">
                <Text type="label" weight="semibold">필드 목록</Text>
                <Text type="supporting" color="disabled">({schema.fields.length}개)</Text>
              </HStack>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--spacing-3)' }}>
              {schema.fields.length === 0 ? (
                <div
                  style={{
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '48px 0',
                  }}
                >
                  <VStack gap={3} hAlign="center">
                    <Icon icon={IconPlus} size="lg" color="disabled" />
                    <Text type="body" color="disabled">아래 버튼으로 필드를 추가하세요</Text>
                  </VStack>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-1-5)' }}>
                  {schema.fields.map((field, index) => {
                    const isSelected = selectedFieldId === field.id;
                    return (
                      <motion.div
                        key={field.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.15 }}
                        onClick={() => setSelectedFieldId(field.id)}
                        className={isSelected ? undefined : 'carev-formbuilder-field-item'}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--spacing-2)',
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-element)',
                          border: `1px solid ${isSelected ? 'var(--color-accent)' : 'var(--color-border)'}`,
                          background: isSelected ? 'var(--color-background-teal)' : 'var(--color-background-card)',
                          cursor: 'pointer',
                          transition: 'all 150ms ease',
                        }}
                      >
                        <span
                          style={{
                            flexShrink: 0,
                            display: 'inline-flex',
                            color: isSelected ? 'var(--color-text-accent)' : 'var(--color-text-disabled)',
                          }}
                        >
                          {FIELD_TYPE_ICONS[field.type]}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Text type="body" weight="medium" maxLines={1} color={isSelected ? 'accent' : 'primary'}>
                            {field.label || '(레이블 없음)'}
                          </Text>
                          {field.required && (
                            <div style={{ color: 'var(--color-text-red)' }}>
                              <Text type="supporting" color="inherit">필수</Text>
                            </div>
                          )}
                        </div>
                        <HStack gap={0.5} vAlign="center">
                          <IconButton
                            label="위로 이동"
                            variant="ghost"
                            size="sm"
                            icon={<Icon icon={IconChevronUp} size="sm" />}
                            isDisabled={index === 0}
                            onClick={(e) => { e.stopPropagation(); moveField(field.id, 'up'); }}
                          />
                          <IconButton
                            label="아래로 이동"
                            variant="ghost"
                            size="sm"
                            icon={<Icon icon={IconChevronDown} size="sm" />}
                            isDisabled={index === schema.fields.length - 1}
                            onClick={(e) => { e.stopPropagation(); moveField(field.id, 'down'); }}
                          />
                          <IconButton
                            label="필드 삭제"
                            variant="ghost"
                            size="sm"
                            icon={<Icon icon={IconX} size="sm" color="error" />}
                            onClick={(e) => { e.stopPropagation(); removeField(field.id); }}
                          />
                        </HStack>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ padding: 'var(--spacing-3)', borderTop: '1px solid var(--color-border)' }}>
              <Button
                label="필드 추가"
                variant="secondary"
                icon={<Icon icon={IconPlus} size="sm" />}
                onClick={() => setShowFieldTypeSelector(true)}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {/* 오른쪽: 필드 편집기 */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--color-background-card)',
            }}
          >
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--color-border)',
                background: 'var(--color-background-muted)',
              }}
            >
              <Text type="label" weight="semibold">필드 설정</Text>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--spacing-4)' }}>
              {selectedField ? (
                <FormFieldEditor
                  field={selectedField}
                  onChange={updateField}
                />
              ) : (
                <div
                  style={{
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '32px 0',
                  }}
                >
                  <VStack gap={3} hAlign="center">
                    <Icon icon="wrench" size="lg" color="disabled" />
                    <Text type="body" color="disabled" justify="center">
                      왼쪽에서 필드를 선택하면<br />여기서 편집할 수 있습니다
                    </Text>
                  </VStack>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 하단 툴바 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)', paddingTop: 'var(--spacing-3)' }}>
          {/* 프리셋 선택 */}
          <div style={{ position: 'relative' }}>
            <Button
              label="프리셋에서 시작"
              variant="secondary"
              size="sm"
              endContent={<Icon icon="chevronDown" size="sm" />}
              onClick={() => setShowPresetMenu((prev) => !prev)}
            />
            <AnimatePresence>
              {showPresetMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  transition={{ duration: 0.1 }}
                  style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: 0,
                    marginBottom: 'var(--spacing-1)',
                    width: 208,
                    background: 'var(--color-background-popover)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-element)',
                    boxShadow: 'var(--shadow-high)',
                    zIndex: 20,
                    overflow: 'hidden',
                  }}
                >
                  {formPresets.map((preset, idx) => (
                    <button
                      key={preset.id}
                      onClick={() => loadPreset(preset.id)}
                      className="carev-formbuilder-preset-item"
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '10px 12px',
                        background: 'transparent',
                        border: 'none',
                        borderBottom:
                          idx === formPresets.length - 1 ? 'none' : '1px solid var(--color-border)',
                        cursor: 'pointer',
                      }}
                    >
                      <VStack gap={0.5}>
                        <Text type="body" weight="medium">{preset.name}</Text>
                        <Text type="supporting" color="disabled" maxLines={1}>{preset.description}</Text>
                      </VStack>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 미리보기 */}
          <Button
            label="미리보기"
            variant="secondary"
            size="sm"
            icon={<Icon icon={IconEye} size="sm" />}
            onClick={() => setShowPreview(true)}
          />

          <div style={{ flex: 1 }} />

          <Text type="supporting" color="disabled">총 {schema.fields.length}개 필드</Text>
        </div>
      </div>

      {/* 필드 타입 선택 오버레이 */}
      <AnimatePresence>
        {showFieldTypeSelector && (
          <FieldTypeSelector
            onSelect={addField}
            onClose={() => setShowFieldTypeSelector(false)}
          />
        )}
      </AnimatePresence>

      {/* 미리보기 모달 */}
      <Dialog
        isOpen={showPreview}
        onOpenChange={(open) => { if (!open) setShowPreview(false); }}
        purpose="info"
        width={672}
        maxHeight="85vh"
      >
        <Layout
          header={
            <DialogHeader
              title="양식 미리보기"
              subtitle="실제 입력 양식과 유사한 형태로 표시됩니다"
              onOpenChange={(open) => { if (!open) setShowPreview(false); }}
            />
          }
          content={
            <LayoutContent>
              <FormPreview schema={schema} />
            </LayoutContent>
          }
          footer={
            <LayoutFooter hasDivider>
              <HStack gap={2} hAlign="end">
                <Button label="닫기" variant="secondary" onClick={() => setShowPreview(false)} />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>
    </>
  );
}
