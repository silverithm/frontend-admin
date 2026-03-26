'use client';

import { FormSchema, FormFieldSchema } from '@/types/formSchema';

interface FormPreviewProps {
  schema: FormSchema;
}

function PreviewField({ field }: { field: FormFieldSchema }) {
  const { type, label, placeholder, required, description, options } = field;

  const labelEl = (
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label || '(레이블 없음)'}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );

  const descEl = description ? (
    <p className="text-xs text-gray-500 mt-1">{description}</p>
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
      <div className={field.width === 'half' ? '' : 'col-span-2'}>
        {labelEl}
        <textarea
          disabled
          placeholder={placeholder}
          rows={3}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-400 resize-none"
        />
        {descEl}
      </div>
    );
  }

  if (type === 'select') {
    return (
      <div className={field.width === 'half' ? '' : 'col-span-2'}>
        {labelEl}
        <select
          disabled
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-400 appearance-none"
        >
          <option value="">{placeholder || '선택하세요'}</option>
          {(options ?? []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {descEl}
      </div>
    );
  }

  if (type === 'radio') {
    return (
      <div className={field.width === 'half' ? '' : 'col-span-2'}>
        {labelEl}
        <div className="flex flex-wrap gap-3 mt-1">
          {(options ?? []).map((opt) => (
            <label key={opt.value} className="flex items-center gap-1.5 text-sm text-gray-400 cursor-not-allowed">
              <input type="radio" disabled className="accent-teal-500" />
              {opt.label}
            </label>
          ))}
        </div>
        {descEl}
      </div>
    );
  }

  if (type === 'checkbox') {
    return (
      <div className={field.width === 'half' ? '' : 'col-span-2'}>
        {labelEl}
        <div className="flex flex-wrap gap-3 mt-1">
          {(options ?? []).map((opt) => (
            <label key={opt.value} className="flex items-center gap-1.5 text-sm text-gray-400 cursor-not-allowed">
              <input type="checkbox" disabled className="accent-teal-500" />
              {opt.label}
            </label>
          ))}
        </div>
        {descEl}
      </div>
    );
  }

  if (type === 'file') {
    return (
      <div className={field.width === 'half' ? '' : 'col-span-2'}>
        {labelEl}
        <div className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-400 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
          파일을 선택하세요
        </div>
        {descEl}
      </div>
    );
  }

  if (type === 'dateRange') {
    return (
      <div className={field.width === 'half' ? '' : 'col-span-2'}>
        {labelEl}
        <div className="flex items-center gap-2">
          <input
            type="date"
            disabled
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-400"
          />
          <span className="text-gray-400 text-sm">~</span>
          <input
            type="date"
            disabled
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-400"
          />
        </div>
        {descEl}
      </div>
    );
  }

  // text, number, date
  const inputType = type === 'date' ? 'date' : type === 'number' ? 'number' : 'text';
  return (
    <div className={field.width === 'half' ? '' : 'col-span-2'}>
      {labelEl}
      <input
        type={inputType}
        disabled
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-400"
      />
      {descEl}
    </div>
  );
}

export default function FormPreview({ schema }: FormPreviewProps) {
  if (schema.fields.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-sm">미리볼 필드가 없습니다</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-4">
      {schema.fields.map((field) => (
        <PreviewField key={field.id} field={field} />
      ))}
    </div>
  );
}
