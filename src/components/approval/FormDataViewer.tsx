'use client';

import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Card } from '@astryxdesign/core/Card';
import { Badge } from '@astryxdesign/core/Badge';
import { Divider } from '@astryxdesign/core/Divider';
import { Text } from '@astryxdesign/core/Text';
import { Link } from '@astryxdesign/core/Link';
import { VStack, HStack, StackItem } from '@astryxdesign/core/Stack';
import { FormSchema, FormFieldSchema } from '@/types/formSchema';

function formatValue(field: FormFieldSchema, value: any): React.ReactNode {
  if (value === null || value === undefined || value === '') {
    return <Text color="disabled">-</Text>;
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
      if (selected.length === 0) return <Text color="disabled">-</Text>;
      return (
        <HStack gap={1} wrap="wrap">
          {selected.map((v) => {
            const option = field.options?.find((o) => o.value === v);
            return <Badge key={v} variant="teal" label={option ? option.label : v} />;
          })}
        </HStack>
      );
    }

    case 'file': {
      const fileName = value?.fileName || value?.name || String(value);
      const fileUrl = value?.fileUrl || value?.url || '';
      if (fileUrl) {
        return (
          <Link
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            hasUnderline
            style={{ wordBreak: 'break-all' }}
          >
            {fileName}
          </Link>
        );
      }
      return <Text style={{ wordBreak: 'break-all' }}>{fileName}</Text>;
    }

    default:
      return <Text style={{ whiteSpace: 'pre-wrap' }}>{String(value)}</Text>;
  }
}

function FieldCell({ field, value }: { field: FormFieldSchema; value: any }) {
  return (
    <Card variant="muted" padding={3} width="100%">
      <VStack gap={1}>
        <Text type="supporting" weight="semibold">
          {field.label}
        </Text>
        <Text as="div" type="body">
          {formatValue(field, value)}
        </Text>
      </VStack>
    </Card>
  );
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
    <VStack gap={3}>
      {rows.map((row, rowIdx) => {
        if (row.length === 1 && row[0].type === 'section') {
          return (
            <div key={`section-${rowIdx}`} style={{ paddingTop: 'var(--spacing-2)' }}>
              <Divider
                label={
                  <Text
                    type="supporting"
                    weight="semibold"
                    style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
                  >
                    {row[0].label}
                  </Text>
                }
              />
            </div>
          );
        }

        if (row.length === 2) {
          return (
            <HStack key={`row-${rowIdx}`} gap={3}>
              {row.map((field) => (
                <StackItem key={field.id} size="fill">
                  <FieldCell field={field} value={formData[field.id]} />
                </StackItem>
              ))}
            </HStack>
          );
        }

        return (
          <div key={`row-${rowIdx}`}>
            {row.map((field) => (
              <FieldCell key={field.id} field={field} value={formData[field.id]} />
            ))}
          </div>
        );
      })}
    </VStack>
  );
}

function FallbackViewer({ formData }: { formData: Record<string, any> }) {
  return (
    <VStack gap={3}>
      {Object.entries(formData).map(([key, value]) => (
        <Card key={key} variant="muted" padding={3} width="100%">
          <VStack gap={1}>
            <Text type="supporting" weight="semibold">
              {key}
            </Text>
            <Text as="p" type="body" style={{ whiteSpace: 'pre-wrap' }}>
              {value as string}
            </Text>
          </VStack>
        </Card>
      ))}
    </VStack>
  );
}

interface FormDataViewerProps {
  formData: Record<string, any>;
  schema?: FormSchema;
}

export default function FormDataViewer({ formData, schema }: FormDataViewerProps) {
  if (schema) {
    return <SchemaViewer formData={formData} schema={schema} />;
  }
  return <FallbackViewer formData={formData} />;
}
