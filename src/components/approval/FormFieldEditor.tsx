'use client';

import { useState } from 'react';
import { FormFieldSchema, FormFieldOption } from '@/types/formSchema';
import { IconPlus, IconTrash } from '@tabler/icons-react';

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
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-gray-200">
        <span className="text-xs font-medium text-white bg-teal-500 px-2 py-0.5 rounded-full">
          {FIELD_TYPE_LABELS[field.type] ?? field.type}
        </span>
        <span className="text-sm font-semibold text-gray-800 truncate">{field.label || '(레이블 없음)'}</span>
      </div>

      {/* 레이블 */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          레이블 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={field.label}
          onChange={(e) => update({ label: e.target.value })}
          placeholder="필드 레이블을 입력하세요"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
        />
      </div>

      {/* 설명 */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">설명</label>
        <input
          type="text"
          value={field.description ?? ''}
          onChange={(e) => update({ description: e.target.value })}
          placeholder="도움말 텍스트 (선택사항)"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
        />
      </div>

      {/* 플레이스홀더 */}
      {hasPlaceholder && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">플레이스홀더</label>
          <input
            type="text"
            value={field.placeholder ?? ''}
            onChange={(e) => update({ placeholder: e.target.value })}
            placeholder="입력 힌트 텍스트"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
          />
        </div>
      )}

      {/* 너비 */}
      {hasWidth && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">너비</label>
          <div className="flex gap-2">
            {(['full', 'half'] as const).map((w) => (
              <button
                key={w}
                onClick={() => update({ width: w })}
                className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${
                  (field.width ?? 'full') === w
                    ? 'border-teal-500 bg-teal-50 text-teal-700 font-medium'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {w === 'full' ? '전체 너비' : '반 너비'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 필수 여부 */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-600">필수 입력</span>
        <button
          onClick={() => update({ required: !field.required })}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            field.required ? 'bg-teal-500' : 'bg-gray-300'
          }`}
          aria-label="필수 여부 토글"
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              field.required ? 'translate-x-4' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* 텍스트 유효성 검사 */}
      {hasTextValidation && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">글자 수 제한</label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-400 mb-1">최소</label>
              <input
                type="number"
                value={field.validation?.minLength ?? ''}
                onChange={(e) =>
                  updateValidation({ minLength: e.target.value ? Number(e.target.value) : undefined })
                }
                placeholder="0"
                min={0}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">최대</label>
              <input
                type="number"
                value={field.validation?.maxLength ?? ''}
                onChange={(e) =>
                  updateValidation({ maxLength: e.target.value ? Number(e.target.value) : undefined })
                }
                placeholder="제한 없음"
                min={0}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* 숫자 유효성 검사 */}
      {hasNumberValidation && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">숫자 범위</label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-400 mb-1">최솟값</label>
              <input
                type="number"
                value={field.validation?.min ?? ''}
                onChange={(e) =>
                  updateValidation({ min: e.target.value !== '' ? Number(e.target.value) : undefined })
                }
                placeholder="제한 없음"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">최댓값</label>
              <input
                type="number"
                value={field.validation?.max ?? ''}
                onChange={(e) =>
                  updateValidation({ max: e.target.value !== '' ? Number(e.target.value) : undefined })
                }
                placeholder="제한 없음"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* 옵션 편집 */}
      {hasOptions && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">선택지</label>
          <div className="space-y-1.5 mb-2">
            {(field.options ?? []).map((opt, index) => (
              <div key={opt.value} className="flex items-center gap-2">
                <input
                  type="text"
                  value={opt.label}
                  onChange={(e) => updateOption(index, e.target.value)}
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                />
                <button
                  onClick={() => removeOption(index)}
                  className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  aria-label="옵션 삭제"
                >
                  <IconTrash size={14} stroke={1.5} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newOptionLabel}
              onChange={(e) => setNewOptionLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addOption();
                }
              }}
              placeholder="새 선택지 입력"
              className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
            />
            <button
              onClick={addOption}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors"
            >
              <IconPlus size={14} stroke={1.5} />
              추가
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
