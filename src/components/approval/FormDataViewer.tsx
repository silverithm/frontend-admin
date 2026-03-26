'use client';

import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { FormSchema, FormFieldSchema } from '@/types/formSchema';

interface FormDataViewerProps {
  formData: Record<string, any>;
  schema?: FormSchema;
}

function formatValue(field: FormFieldSchema, value: any): React.ReactNode {
  if (value === null || value === undefined || value === '') {
    return <span className="text-gray-400">-</span>;
  }

  switch (field.type) {
    case 'number': {
      const num = Number(value);
      if (isNaN(num)) return String(value);
      return new Intl.NumberFormat('ko-KR').format(num);
    }

    case 'date': {
      try {
        return format(new Date(value), 'yyyy년 MM월 dd일', { locale: ko });
      } catch {
        return String(value);
      }
    }

    case 'dateRange': {
      const start = value?.start || value?.startDate || '';
      const end = value?.end || value?.endDate || '';
      try {
        const startStr = start ? format(new Date(start), 'yyyy년 MM월 dd일', { locale: ko }) : '-';
        const endStr = end ? format(new Date(end), 'yyyy년 MM월 dd일', { locale: ko }) : '-';
        return `${startStr} ~ ${endStr}`;
      } catch {
        return `${start} ~ ${end}`;
      }
    }

    case 'select':
    case 'radio': {
      if (field.options) {
        const option = field.options.find((o) => o.value === value);
        if (option) return option.label;
      }
      return String(value);
    }

    case 'checkbox': {
      const selected: string[] = Array.isArray(value) ? value : [];
      if (selected.length === 0) return <span className="text-gray-400">-</span>;
      return (
        <div className="flex flex-wrap gap-1">
          {selected.map((v) => {
            const option = field.options?.find((o) => o.value === v);
            return (
              <span
                key={v}
                className="px-2 py-0.5 bg-teal-100 text-teal-700 text-xs rounded-full font-medium"
              >
                {option ? option.label : v}
              </span>
            );
          })}
        </div>
      );
    }

    case 'file': {
      const fileName = value?.fileName || value?.name || String(value);
      const fileUrl = value?.fileUrl || value?.url || '';
      if (fileUrl) {
        return (
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-teal-600 underline hover:text-teal-800 break-all"
          >
            {fileName}
          </a>
        );
      }
      return <span className="break-all">{fileName}</span>;
    }

    default:
      return <span className="whitespace-pre-wrap">{String(value)}</span>;
  }
}

function SchemaViewer({ formData, schema }: { formData: Record<string, any>; schema: FormSchema }) {
  const fields = schema.fields.filter((f) => f.type !== 'section');
  const sections = schema.fields.filter((f) => f.type === 'section');

  // Group fields into rows respecting half/full width
  const renderFields = () => {
    const rows: FormFieldSchema[][] = [];
    let currentRow: FormFieldSchema[] = [];

    for (const field of schema.fields) {
      if (field.type === 'section') {
        if (currentRow.length > 0) {
          rows.push([...currentRow]);
          currentRow = [];
        }
        rows.push([field]);
        continue;
      }

      if (field.width === 'half') {
        currentRow.push(field);
        if (currentRow.length === 2) {
          rows.push([...currentRow]);
          currentRow = [];
        }
      } else {
        if (currentRow.length > 0) {
          rows.push([...currentRow]);
          currentRow = [];
        }
        rows.push([field]);
      }
    }

    if (currentRow.length > 0) {
      rows.push([...currentRow]);
    }

    return rows;
  };

  const rows = renderFields();

  return (
    <div className="space-y-3">
      {rows.map((row, rowIdx) => {
        if (row.length === 1 && row[0].type === 'section') {
          return (
            <div key={`section-${rowIdx}`} className="pt-2">
              <div className="flex items-center gap-3">
                <hr className="flex-1 border-gray-300" />
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {row[0].label}
                </span>
                <hr className="flex-1 border-gray-300" />
              </div>
            </div>
          );
        }

        if (row.length === 2) {
          return (
            <div key={`row-${rowIdx}`} className="grid grid-cols-2 gap-3">
              {row.map((field) => (
                <div key={field.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <span className="text-gray-500 text-xs font-semibold">{field.label}</span>
                  <div className="text-gray-900 text-sm mt-1">
                    {formatValue(field, formData[field.id])}
                  </div>
                </div>
              ))}
            </div>
          );
        }

        return (
          <div key={`row-${rowIdx}`}>
            {row.map((field) => (
              <div key={field.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <span className="text-gray-500 text-xs font-semibold">{field.label}</span>
                <div className="text-gray-900 text-sm mt-1">
                  {formatValue(field, formData[field.id])}
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function FallbackViewer({ formData }: { formData: Record<string, any> }) {
  return (
    <div className="space-y-3">
      {Object.entries(formData).map(([key, value]) => (
        <div key={key} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
          <span className="text-gray-500 text-xs font-semibold">{key}</span>
          <p className="text-gray-900 text-sm mt-1 whitespace-pre-wrap">{value as string}</p>
        </div>
      ))}
    </div>
  );
}

export default function FormDataViewer({ formData, schema }: FormDataViewerProps) {
  if (schema) {
    return <SchemaViewer formData={formData} schema={schema} />;
  }
  return <FallbackViewer formData={formData} />;
}
