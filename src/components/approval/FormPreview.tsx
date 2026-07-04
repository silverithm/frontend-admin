'use client';

import { FormSchema, FormFieldSchema } from '@/types/formSchema';
import { Grid, GridSpan } from '@astryxdesign/core/Grid';
import { HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Divider } from '@astryxdesign/core/Divider';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { TextInput } from '@astryxdesign/core/TextInput';
import { TextArea } from '@astryxdesign/core/TextArea';
import { NumberInput } from '@astryxdesign/core/NumberInput';
import { DateInput } from '@astryxdesign/core/DateInput';
import { DateRangeInput } from '@astryxdesign/core/DateRangeInput';
import { FileInput } from '@astryxdesign/core/FileInput';
import { Selector } from '@astryxdesign/core/Selector';
import { RadioList, RadioListItem } from '@astryxdesign/core/RadioList';
import { CheckboxList, CheckboxListItem } from '@astryxdesign/core/CheckboxList';

interface FormPreviewProps {
  schema: FormSchema;
}

function PreviewField({ field }: { field: FormFieldSchema }) {
  const { type, label, placeholder, required, description, options } = field;

  const fieldLabel = label || '(레이블 없음)';
  const noop = () => {};

  if (type === 'section') {
    return (
      <GridSpan columns={2}>
        <HStack gap={3} vAlign="center">
          <Text type="label" weight="semibold" color="primary">
            {label}
          </Text>
          <div style={{ flex: 1 }}>
            <Divider />
          </div>
        </HStack>
      </GridSpan>
    );
  }

  let content: React.ReactNode;

  if (type === 'textarea') {
    content = (
      <TextArea
        label={fieldLabel}
        value=""
        onChange={noop}
        placeholder={placeholder}
        rows={3}
        isDisabled
        isRequired={required}
        description={description}
      />
    );
  } else if (type === 'select') {
    content = (
      <Selector
        label={fieldLabel}
        options={(options ?? []).map((opt) => ({ value: opt.value, label: opt.label }))}
        placeholder={placeholder || '선택하세요'}
        isDisabled
        isRequired={required}
        description={description}
      />
    );
  } else if (type === 'radio') {
    content = (
      <RadioList
        label={fieldLabel}
        value=""
        onChange={noop}
        orientation="horizontal"
        isDisabled
        isRequired={required}
        description={description}
      >
        {(options ?? []).map((opt) => (
          <RadioListItem key={opt.value} label={opt.label} value={opt.value} />
        ))}
      </RadioList>
    );
  } else if (type === 'checkbox') {
    content = (
      <CheckboxList
        label={fieldLabel}
        value={[]}
        onChange={noop}
        isDisabled
        description={description}
      >
        {(options ?? []).map((opt) => (
          <CheckboxListItem key={opt.value} label={opt.label} value={opt.value} />
        ))}
      </CheckboxList>
    );
  } else if (type === 'file') {
    content = (
      <FileInput
        label={fieldLabel}
        value={null}
        onChange={noop}
        placeholder="파일을 선택하세요"
        isDisabled
        isRequired={required}
        description={description}
      />
    );
  } else if (type === 'dateRange') {
    content = (
      <DateRangeInput
        label={fieldLabel}
        value={null}
        onChange={noop}
        isDisabled
        isRequired={required}
        description={description}
      />
    );
  } else if (type === 'date') {
    content = (
      <DateInput
        label={fieldLabel}
        value={undefined}
        onChange={noop}
        placeholder={placeholder}
        isDisabled
        isRequired={required}
        description={description}
      />
    );
  } else if (type === 'number') {
    content = (
      <NumberInput
        label={fieldLabel}
        value={null}
        onChange={noop}
        placeholder={placeholder}
        isDisabled
        isRequired={required}
        description={description}
      />
    );
  } else {
    // text
    content = (
      <TextInput
        label={fieldLabel}
        value=""
        onChange={noop}
        placeholder={placeholder}
        isDisabled
        isRequired={required}
        description={description}
      />
    );
  }

  return field.width === 'half' ? content : <GridSpan columns={2}>{content}</GridSpan>;
}

export default function FormPreview({ schema }: FormPreviewProps) {
  if (schema.fields.length === 0) {
    return <EmptyState title="미리볼 필드가 없습니다" />;
  }

  return (
    <Grid columns={2} gap={4}>
      {schema.fields.map((field) => (
        <PreviewField key={field.id} field={field} />
      ))}
    </Grid>
  );
}
