'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FormSchema, FormFieldSchema, FieldType } from '@/types/formSchema';
import { formPresets } from '@/lib/formTemplatePresets';
import FieldTypeSelector from './FieldTypeSelector';
import FormFieldEditor from './FormFieldEditor';
import FormPreview from './FormPreview';
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
      <div className="flex flex-col h-full">
        {/* 메인 영역 */}
        <div className="flex flex-1 gap-0 min-h-0 border border-gray-200 rounded-xl overflow-hidden">
          {/* 왼쪽: 필드 목록 */}
          <div className="flex-[2] flex flex-col border-r border-gray-200 bg-white">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">
                필드 목록
                <span className="ml-2 text-xs font-normal text-gray-400">({schema.fields.length}개)</span>
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {schema.fields.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-12 text-gray-400">
                  <svg className="w-12 h-12 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M12 4v16m8-8H4" />
                  </svg>
                  <p className="text-sm">아래 버튼으로 필드를 추가하세요</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {schema.fields.map((field, index) => (
                    <motion.div
                      key={field.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.15 }}
                      onClick={() => setSelectedFieldId(field.id)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${
                        selectedFieldId === field.id
                          ? 'border-teal-500 bg-teal-50'
                          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <span className={`flex-shrink-0 ${selectedFieldId === field.id ? 'text-teal-500' : 'text-gray-400'}`}>
                        {FIELD_TYPE_ICONS[field.type]}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${selectedFieldId === field.id ? 'text-teal-700' : 'text-gray-700'}`}>
                          {field.label || '(레이블 없음)'}
                        </p>
                        {field.required && (
                          <span className="text-xs text-red-500">필수</span>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); moveField(field.id, 'up'); }}
                          disabled={index === 0}
                          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-20 disabled:cursor-not-allowed rounded transition-colors"
                          aria-label="위로 이동"
                        >
                          <IconChevronUp size={13} stroke={2} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); moveField(field.id, 'down'); }}
                          disabled={index === schema.fields.length - 1}
                          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-20 disabled:cursor-not-allowed rounded transition-colors"
                          aria-label="아래로 이동"
                        >
                          <IconChevronDown size={13} stroke={2} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeField(field.id); }}
                          className="p-1 text-red-400 hover:text-red-600 rounded transition-colors"
                          aria-label="필드 삭제"
                        >
                          <IconX size={13} stroke={2} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 border-t border-gray-200">
              <button
                onClick={() => setShowFieldTypeSelector(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-teal-400 hover:text-teal-500 hover:bg-teal-50 transition-all text-sm font-medium"
              >
                <IconPlus size={16} stroke={2} />
                필드 추가
              </button>
            </div>
          </div>

          {/* 오른쪽: 필드 편집기 */}
          <div className="flex-[1] flex flex-col bg-white">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <span className="text-sm font-semibold text-gray-700">필드 설정</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {selectedField ? (
                <FormFieldEditor
                  field={selectedField}
                  onChange={updateField}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 py-8">
                  <svg className="w-10 h-10 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <p className="text-sm text-center">왼쪽에서 필드를 선택하면<br />여기서 편집할 수 있습니다</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 하단 툴바 */}
        <div className="flex items-center gap-3 pt-3">
          {/* 프리셋 선택 */}
          <div className="relative">
            <button
              onClick={() => setShowPresetMenu((prev) => !prev)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-colors"
            >
              프리셋에서 시작
              <IconChevronDown size={14} stroke={1.5} />
            </button>
            <AnimatePresence>
              {showPresetMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  transition={{ duration: 0.1 }}
                  className="absolute bottom-full left-0 mb-1 w-52 bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden"
                >
                  {formPresets.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => loadPreset(preset.id)}
                      className="w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0"
                    >
                      <p className="text-sm font-medium text-gray-700">{preset.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{preset.description}</p>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 미리보기 */}
          <button
            onClick={() => setShowPreview(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-colors"
          >
            <IconEye size={15} stroke={1.5} />
            미리보기
          </button>

          <div className="flex-1" />

          <span className="text-xs text-gray-400">
            총 {schema.fields.length}개 필드
          </span>
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
      <AnimatePresence>
        {showPreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowPreview(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="bg-white rounded-xl shadow-2xl w-full max-w-2xl border border-gray-200 flex flex-col max-h-[85vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">양식 미리보기</h3>
                  <p className="text-sm text-gray-500 mt-0.5">실제 입력 양식과 유사한 형태로 표시됩니다</p>
                </div>
                <button
                  onClick={() => setShowPreview(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="닫기"
                >
                  <IconX size={18} stroke={1.5} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <FormPreview schema={schema} />
              </div>
              <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
                <button
                  onClick={() => setShowPreview(false)}
                  className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  닫기
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
