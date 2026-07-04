'use client';

import { useState } from 'react';
import { FormSchema, FormFieldSchema } from '@/types/formSchema';
import { Grid, GridSpan } from '@astryxdesign/core/Grid';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { TextInput } from '@astryxdesign/core/TextInput';
import { TextArea } from '@astryxdesign/core/TextArea';
import { NumberInput } from '@astryxdesign/core/NumberInput';
import { Selector } from '@astryxdesign/core/Selector';
import { RadioList, RadioListItem } from '@astryxdesign/core/RadioList';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { DateInput } from '@astryxdesign/core/DateInput';
import { FileInput } from '@astryxdesign/core/FileInput';
import { Divider } from '@astryxdesign/core/Divider';
import { FieldStatus } from '@astryxdesign/core/FieldStatus';

interface FormRendererProps {
  schema: FormSchema;
  initialValues?: Record<string, any>;
  onSubmit: (formData: Record<string, any>) => void;
  readOnly?: boolean;
  submitLabel?: string;
}

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
  const { id, type, label, placeholder, required, description, options, validation } = field;
  const span = field.width === 'half' ? 1 : 2;

  const displayLabel = label || '(레이블 없음)';
  const statusProp = error ? ({ type: 'error' as const, message: error }) : undefined;

  // 그룹형 필드(체크박스 그룹, 날짜 범위)용 레이블 노드
  const groupLabelNode = (
    <Text type="label" weight="medium">
      {displayLabel}
      {required && (
        <span style={{ color: 'var(--color-text-red)', marginLeft: 'var(--spacing-0-5)' }} aria-hidden>
          *
        </span>
      )}
    </Text>
  );

  if (type === 'section') {
    return (
      <GridSpan columns={2}>
        <Divider label={label} />
      </GridSpan>
    );
  }

  if (type === 'textarea') {
    return (
      <GridSpan columns={span}>
        <TextArea
          label={displayLabel}
          isRequired={required}
          isDisabled={readOnly}
          description={description}
          placeholder={placeholder}
          rows={3}
          value={value ?? ''}
          onChange={(val) => onChange(id, val)}
          status={statusProp}
        />
      </GridSpan>
    );
  }

  if (type === 'select') {
    return (
      <GridSpan columns={span}>
        <Selector
          label={displayLabel}
          isRequired={required}
          isDisabled={readOnly}
          description={description}
          placeholder={placeholder || '선택하세요'}
          options={(options ?? []).map((opt) => ({ value: opt.value, label: opt.label }))}
          value={value ?? ''}
          onChange={(val) => onChange(id, val)}
          status={statusProp}
        />
      </GridSpan>
    );
  }

  if (type === 'radio') {
    return (
      <GridSpan columns={span}>
        <RadioList
          label={displayLabel}
          isRequired={required}
          isDisabled={readOnly}
          description={description}
          orientation="horizontal"
          value={value ?? ''}
          onChange={(val) => onChange(id, val)}
          status={statusProp}
        >
          {(options ?? []).map((opt) => (
            <RadioListItem key={opt.value} label={opt.label} value={opt.value} />
          ))}
        </RadioList>
      </GridSpan>
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
      <GridSpan columns={span}>
        <VStack gap={1.5} vAlign="start">
          {groupLabelNode}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-3)', alignItems: 'center' }}>
            {(options ?? []).map((opt) => (
              <CheckboxInput
                key={opt.value}
                label={opt.label}
                size="sm"
                isDisabled={readOnly}
                value={checkedValues.includes(opt.value)}
                onChange={(checked) => handleCheckbox(opt.value, checked)}
              />
            ))}
          </div>
          {description && <Text type="supporting">{description}</Text>}
          {error && <FieldStatus type="error" message={error} variant="detached" />}
        </VStack>
      </GridSpan>
    );
  }

  if (type === 'file') {
    const fileValue: File | null = value instanceof File ? value : null;
    return (
      <GridSpan columns={span}>
        <FileInput
          label={displayLabel}
          isRequired={required}
          isDisabled={readOnly}
          description={description}
          mode="dropzone"
          placeholder={placeholder || '클릭하여 파일 첨부'}
          value={fileValue}
          onChange={(f) => {
            if (f) onChange(id, f as File);
          }}
          status={statusProp}
        />
      </GridSpan>
    );
  }

  if (type === 'dateRange') {
    const startKey = `${id}_start`;
    const endKey = `${id}_end`;
    return (
      <GridSpan columns={span}>
        <VStack gap={1.5} vAlign="start">
          {groupLabelNode}
          <HStack gap={2} vAlign="center">
            <DateInput
              label="시작일"
              isLabelHidden
              isDisabled={readOnly}
              value={value?.[startKey] || undefined}
              onChange={(val) => onChange(startKey, val ?? '')}
            />
            <Text type="supporting">~</Text>
            <DateInput
              label="종료일"
              isLabelHidden
              isDisabled={readOnly}
              value={value?.[endKey] || undefined}
              onChange={(val) => onChange(endKey, val ?? '')}
            />
          </HStack>
          {description && <Text type="supporting">{description}</Text>}
          {error && <FieldStatus type="error" message={error} variant="detached" />}
        </VStack>
      </GridSpan>
    );
  }

  if (type === 'date') {
    return (
      <GridSpan columns={span}>
        <DateInput
          label={displayLabel}
          isRequired={required}
          isDisabled={readOnly}
          description={description}
          placeholder={placeholder}
          value={value || undefined}
          onChange={(val) => onChange(id, val ?? '')}
          status={statusProp}
        />
      </GridSpan>
    );
  }

  if (type === 'number') {
    return (
      <GridSpan columns={span}>
        <NumberInput
          label={displayLabel}
          isRequired={required}
          isDisabled={readOnly}
          description={description}
          placeholder={placeholder}
          min={validation?.min}
          max={validation?.max}
          value={value === '' || value === undefined || value === null ? undefined : Number(value)}
          onChange={(val) => onChange(id, val === undefined || val === null ? '' : String(val))}
          status={statusProp}
        />
      </GridSpan>
    );
  }

  // text
  return (
    <GridSpan columns={span}>
      <TextInput
        label={displayLabel}
        type="text"
        isRequired={required}
        isDisabled={readOnly}
        description={description}
        placeholder={placeholder}
        value={value ?? ''}
        onChange={(val) => onChange(id, val)}
        status={statusProp}
      />
    </GridSpan>
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
      <div style={{ padding: '40px 0', textAlign: 'center' }}>
        <Text type="body" color="secondary">
          표시할 필드가 없습니다.
        </Text>
      </div>
    );
  }

  return (
    <VStack gap={6}>
      <Grid columns={2} gap={4}>
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
      </Grid>
      {!readOnly && (
        <HStack hAlign="end">
          <Button label={submitLabel} variant="primary" type="button" onClick={handleSubmit} />
        </HStack>
      )}
    </VStack>
  );
}
