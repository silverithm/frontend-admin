'use client';

import { useState, useRef } from 'react';
import { FormSchema, FormFieldSchema } from '@/types/formSchema';

interface FormRendererProps {
  schema: FormSchema;
  initialValues?: Record<string, any>;
  onSubmit: (formData: Record<string, any>) => void;
  readOnly?: boolean;
  submitLabel?: string;
}

const INPUT_CLASS =
  'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed';

function FieldRenderer({
  field,
  value,
  error,
  readOnly,
  onChange,
}: {
  field: FormFieldSchema;
  value: any;
  error?: string;
  readOnly: boolean;
  onChange: (fieldId: string, val: any) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { id, type, label, placeholder, required, description, options, validation } = field;
  const colSpan = field.width === 'half' ? '' : 'col-span-2';

  const labelEl = (
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label || '(레이블 없음)'}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );

  const descEl = description ? (
    <p className="text-xs text-gray-500 mt-1">{description}</p>
  ) : null;

  const errorEl = error ? (
    <p className="text-xs text-red-500 mt-1">{error}</p>
  ) : null;

  if (type === 'section') {
    return (
      <div className="col-span-2">
        <div className="flex items-center gap-3 my-1">
          <span className="text-sm font-semibold text-gray-700">{label}</span>
          <div className="flex-1 h-px bg-gray-300" />
        </div>
      </div>
    );
  }

  if (type === 'textarea') {
    return (
      <div className={colSpan}>
        {labelEl}
        <textarea
          disabled={readOnly}
          placeholder={placeholder}
          rows={3}
          value={value ?? ''}
          onChange={(e) => onChange(id, e.target.value)}
          className={`${INPUT_CLASS} resize-none`}
        />
        {descEl}
        {errorEl}
      </div>
    );
  }

  if (type === 'select') {
    return (
      <div className={colSpan}>
        {labelEl}
        <select
          disabled={readOnly}
          value={value ?? ''}
          onChange={(e) => onChange(id, e.target.value)}
          className={INPUT_CLASS}
        >
          <option value="">{placeholder || '선택하세요'}</option>
          {(options ?? []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {descEl}
        {errorEl}
      </div>
    );
  }

  if (type === 'radio') {
    return (
      <div className={colSpan}>
        {labelEl}
        <div className="flex flex-wrap gap-3 mt-1">
          {(options ?? []).map((opt) => (
            <label
              key={opt.value}
              className={`flex items-center gap-1.5 text-sm text-gray-700 ${readOnly ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
            >
              <input
                type="radio"
                name={id}
                value={opt.value}
                checked={value === opt.value}
                disabled={readOnly}
                onChange={() => onChange(id, opt.value)}
                className="accent-teal-500"
              />
              {opt.label}
            </label>
          ))}
        </div>
        {descEl}
        {errorEl}
      </div>
    );
  }

  if (type === 'checkbox') {
    const checkedValues: string[] = Array.isArray(value) ? value : [];
    const handleCheckbox = (optValue: string, checked: boolean) => {
      if (checked) {
        onChange(id, [...checkedValues, optValue]);
      } else {
        onChange(id, checkedValues.filter((v) => v !== optValue));
      }
    };
    return (
      <div className={colSpan}>
        {labelEl}
        <div className="flex flex-wrap gap-3 mt-1">
          {(options ?? []).map((opt) => (
            <label
              key={opt.value}
              className={`flex items-center gap-1.5 text-sm text-gray-700 ${readOnly ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
            >
              <input
                type="checkbox"
                value={opt.value}
                checked={checkedValues.includes(opt.value)}
                disabled={readOnly}
                onChange={(e) => handleCheckbox(opt.value, e.target.checked)}
                className="accent-teal-500"
              />
              {opt.label}
            </label>
          ))}
        </div>
        {descEl}
        {errorEl}
      </div>
    );
  }

  if (type === 'file') {
    const fileValue: File | null = value instanceof File ? value : null;
    const formatSize = (bytes: number) => {
      if (bytes < 1024) return `${bytes}B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    };
    return (
      <div className={colSpan}>
        {labelEl}
        {readOnly ? (
          <div className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-400 flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            {fileValue ? fileValue.name : '파일 없음'}
          </div>
        ) : (
          <>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onChange(id, file);
              }}
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-full p-4 border-2 border-dashed border-gray-300 rounded-xl text-center cursor-pointer hover:border-teal-400 hover:bg-teal-50 transition-all"
            >
              {fileValue ? (
                <div className="flex items-center justify-center space-x-3">
                  <svg className="w-6 h-6 text-teal-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div className="text-left">
                    <p className="text-gray-900 font-medium text-sm">{fileValue.name}</p>
                    <p className="text-gray-500 text-xs">{formatSize(fileValue.size)}</p>
                  </div>
                </div>
              ) : (
                <>
                  <svg className="w-8 h-8 mx-auto text-gray-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-gray-600 text-sm">클릭하여 파일 첨부</p>
                </>
              )}
            </div>
          </>
        )}
        {descEl}
        {errorEl}
      </div>
    );
  }

  if (type === 'dateRange') {
    const startKey = `${id}_start`;
    const endKey = `${id}_end`;
    return (
      <div className={colSpan}>
        {labelEl}
        <div className="flex items-center gap-2">
          <input
            type="date"
            disabled={readOnly}
            value={value?.[startKey] ?? ''}
            onChange={(e) => onChange(startKey, e.target.value)}
            className={INPUT_CLASS}
          />
          <span className="text-gray-400 text-sm flex-shrink-0">~</span>
          <input
            type="date"
            disabled={readOnly}
            value={value?.[endKey] ?? ''}
            onChange={(e) => onChange(endKey, e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        {descEl}
        {errorEl}
      </div>
    );
  }

  // text, number, date
  const inputType = type === 'date' ? 'date' : type === 'number' ? 'number' : 'text';
  const displayValue =
    type === 'number' && readOnly && value !== '' && value !== undefined && value !== null
      ? new Intl.NumberFormat('ko-KR').format(Number(value))
      : (value ?? '');

  return (
    <div className={colSpan}>
      {labelEl}
      <input
        type={readOnly && type === 'number' ? 'text' : inputType}
        disabled={readOnly}
        placeholder={placeholder}
        value={displayValue}
        min={validation?.min}
        max={validation?.max}
        onChange={(e) => onChange(id, e.target.value)}
        className={INPUT_CLASS}
      />
      {descEl}
      {errorEl}
    </div>
  );
}

export default function FormRenderer({
  schema,
  initialValues = {},
  onSubmit,
  readOnly = false,
  submitLabel = '제출',
}: FormRendererProps) {
  // For dateRange fields, values are stored as flat keys: {fieldId}_start, {fieldId}_end
  const buildInitialValues = (): Record<string, any> => {
    const vals: Record<string, any> = { ...initialValues };
    schema.fields.forEach((field) => {
      if (field.type === 'section') return;
      if (field.type === 'dateRange') {
        const startKey = `${field.id}_start`;
        const endKey = `${field.id}_end`;
        if (!(startKey in vals)) vals[startKey] = field.defaultValue?.start ?? '';
        if (!(endKey in vals)) vals[endKey] = field.defaultValue?.end ?? '';
      } else {
        if (!(field.id in vals)) {
          vals[field.id] =
            field.type === 'checkbox' ? (field.defaultValue ?? []) : (field.defaultValue ?? '');
        }
      }
    });
    return vals;
  };

  const [formValues, setFormValues] = useState<Record<string, any>>(buildInitialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (key: string, val: any) => {
    setFormValues((prev) => ({ ...prev, [key]: val }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    schema.fields.forEach((field) => {
      if (field.type === 'section') return;

      if (field.type === 'dateRange') {
        const startKey = `${field.id}_start`;
        const endKey = `${field.id}_end`;
        if (field.required) {
          if (!formValues[startKey]) newErrors[startKey] = '시작일을 선택해주세요.';
          if (!formValues[endKey]) newErrors[endKey] = '종료일을 선택해주세요.';
        }
        return;
      }

      const val = formValues[field.id];
      const isEmpty =
        val === '' ||
        val === undefined ||
        val === null ||
        (Array.isArray(val) && val.length === 0) ||
        (val instanceof File === false && field.type === 'file' && !val);

      if (field.required && isEmpty) {
        newErrors[field.id] = `${field.label}을(를) 입력해주세요.`;
        return;
      }

      if (field.type === 'number' && val !== '' && val !== undefined && val !== null) {
        const num = Number(val);
        if (field.validation?.min !== undefined && num < field.validation.min) {
          newErrors[field.id] = `최솟값은 ${field.validation.min}입니다.`;
        } else if (field.validation?.max !== undefined && num > field.validation.max) {
          newErrors[field.id] = `최댓값은 ${field.validation.max}입니다.`;
        }
      }

      if (
        (field.type === 'text' || field.type === 'textarea') &&
        typeof val === 'string' &&
        val.length > 0
      ) {
        if (field.validation?.minLength !== undefined && val.length < field.validation.minLength) {
          newErrors[field.id] = `최소 ${field.validation.minLength}자 이상 입력해주세요.`;
        } else if (
          field.validation?.maxLength !== undefined &&
          val.length > field.validation.maxLength
        ) {
          newErrors[field.id] = `최대 ${field.validation.maxLength}자까지 입력 가능합니다.`;
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onSubmit(formValues);
  };

  const getFieldValue = (field: FormFieldSchema): any => {
    if (field.type === 'dateRange') {
      return {
        [`${field.id}_start`]: formValues[`${field.id}_start`],
        [`${field.id}_end`]: formValues[`${field.id}_end`],
      };
    }
    return formValues[field.id];
  };

  const getFieldError = (field: FormFieldSchema): string | undefined => {
    if (field.type === 'dateRange') {
      return errors[`${field.id}_start`] || errors[`${field.id}_end`];
    }
    return errors[field.id];
  };

  if (schema.fields.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400">
        <p className="text-sm">표시할 필드가 없습니다.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-4">
        {schema.fields.map((field) => (
          <FieldRenderer
            key={field.id}
            field={field}
            value={getFieldValue(field)}
            error={getFieldError(field)}
            readOnly={readOnly}
            onChange={handleChange}
          />
        ))}
      </div>
      {!readOnly && (
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={handleSubmit}
            className="px-6 py-2 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 transition-colors shadow-sm"
          >
            {submitLabel}
          </button>
        </div>
      )}
    </div>
  );
}
