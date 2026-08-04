'use client';

import { useMemo, useState } from 'react';
import { FormSchema, FormFieldSchema, AGGREGATE_LABEL } from '@/types/formSchema';
import {
  FormValues,
  getFieldSpan,
  isFieldVisible,
  computeFieldValue,
  withComputedValues,
  createEmptyRow,
  validateForm,
} from '@/lib/formSchemaLogic';
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
import { chunkRowForDocTable, groupFieldsIntoRows } from './formValueFormat';
import { DateInput } from '@astryxdesign/core/DateInput';
import { FileInput } from '@astryxdesign/core/FileInput';
import { Divider } from '@astryxdesign/core/Divider';
import { FieldStatus } from '@astryxdesign/core/FieldStatus';
import { Icon } from '@astryxdesign/core/Icon';
import { IconPlus, IconTrash, IconCalculator } from '@tabler/icons-react';

interface FormRendererProps {
  schema: FormSchema;
  initialValues?: FormValues;
  onSubmit: (formData: FormValues) => void;
  readOnly?: boolean;
  submitLabel?: string;
  /** 지정하면 실제 공문 문서 모양 위에서 빈칸을 바로 입력하는 레이아웃으로 렌더한다 */
  documentFrame?: {
    companyName: string;
    title: string;
    requesterName: string;
    approvalLine?: { name: string }[];
  };
}

/** 단일 입력 컨트롤 (그리드 래핑 없이 컨트롤만) — 반복 행 안에서도 재사용한다 */
function FieldControl({
  field,
  value,
  error,
  readOnly,
  onChange,
  compact = false,
}: {
  field: FormFieldSchema;
  value: any;
  error?: string;
  readOnly: boolean;
  onChange: (val: any) => void;
  compact?: boolean;
}) {
  const { type, label, placeholder, required, description, options, validation } = field;
  const displayLabel = label || '(레이블 없음)';
  const statusProp = error ? ({ type: 'error' as const, message: error }) : undefined;
  const labelHidden = compact;

  if (type === 'textarea') {
    return (
      <TextArea
        label={displayLabel}
        isLabelHidden={labelHidden}
        isRequired={required}
        isDisabled={readOnly}
        description={compact ? undefined : description}
        placeholder={placeholder}
        rows={compact ? 2 : 3}
        value={value ?? ''}
        onChange={onChange}
        status={statusProp}
      />
    );
  }

  if (type === 'select') {
    return (
      <Selector
        label={displayLabel}
        isLabelHidden={labelHidden}
        isRequired={required}
        isDisabled={readOnly}
        description={compact ? undefined : description}
        width="100%"
        placeholder={placeholder || '선택하세요'}
        options={(options ?? []).map((opt) => ({ value: opt.value, label: opt.label }))}
        value={value ?? ''}
        onChange={onChange}
        status={statusProp}
      />
    );
  }

  if (type === 'radio') {
    return (
      <RadioList
        label={displayLabel}
        isLabelHidden={labelHidden}
        isRequired={required}
        isDisabled={readOnly}
        description={compact ? undefined : description}
        orientation="horizontal"
        value={value ?? ''}
        onChange={onChange}
        status={statusProp}
      >
        {(options ?? []).map((opt) => (
          <RadioListItem key={opt.value} label={opt.label} value={opt.value} />
        ))}
      </RadioList>
    );
  }

  if (type === 'file') {
    const fileValue: File | null = value instanceof File ? value : null;
    return (
      <FileInput
        label={displayLabel}
        isLabelHidden={labelHidden}
        isRequired={required}
        isDisabled={readOnly}
        description={compact ? undefined : description}
        mode="dropzone"
        placeholder={placeholder || '클릭하여 파일 첨부'}
        value={fileValue}
        onChange={(f) => { if (f) onChange(f as File); }}
        status={statusProp}
      />
    );
  }

  if (type === 'date') {
    return (
      <DateInput
        label={displayLabel}
        isLabelHidden={labelHidden}
        isRequired={required}
        isDisabled={readOnly}
        description={compact ? undefined : description}
        placeholder={placeholder}
        value={value || undefined}
        onChange={(val) => onChange(val ?? '')}
        status={statusProp}
      />
    );
  }

  if (type === 'number') {
    return (
      <NumberInput
        label={displayLabel}
        isLabelHidden={labelHidden}
        isRequired={required}
        isDisabled={readOnly}
        description={compact ? undefined : description}
        placeholder={placeholder}
        min={validation?.min}
        max={validation?.max}
        value={value === '' || value === undefined || value === null ? undefined : Number(value)}
        onChange={(val) => onChange(val === undefined || val === null ? '' : String(val))}
        status={statusProp}
      />
    );
  }

  return (
    <TextInput
      label={displayLabel}
      isLabelHidden={labelHidden}
      type="text"
      isRequired={required}
      isDisabled={readOnly}
      description={compact ? undefined : description}
      placeholder={placeholder}
      value={value ?? ''}
      onChange={onChange}
      status={statusProp}
    />
  );
}

function FieldRenderer({
  field,
  values,
  errors,
  readOnly,
  onChange,
  onRowsChange,
}: {
  field: FormFieldSchema;
  values: FormValues;
  errors: Record<string, string>;
  readOnly: boolean;
  onChange: (key: string, val: any) => void;
  onRowsChange: (fieldId: string, rows: any[]) => void;
}) {
  const { id, type, label, required, description } = field;
  const span = getFieldSpan(field.width);
  const displayLabel = label || '(레이블 없음)';
  const error = type === 'dateRange' ? errors[`${id}_start`] || errors[`${id}_end`] : errors[id];

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
      <GridSpan columns={12}>
        <Divider label={label} />
      </GridSpan>
    );
  }

  // 계산 필드 — 사용자가 입력하지 않고 자동으로 채워진다
  if (type === 'computed') {
    const result = computeFieldValue(field.computed, values);
    const opLabel = AGGREGATE_LABEL[field.computed?.operation ?? 'sum'];
    return (
      <GridSpan columns={span}>
        <VStack gap={1.5} vAlign="start">
          {groupLabelNode}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-2)',
              width: '100%',
              padding: 'var(--spacing-3)',
              borderRadius: 'var(--radius-inner)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-background-muted)',
            }}
          >
            <Icon icon={IconCalculator} size="sm" color="tertiary" />
            <Text type="body" weight="bold" color="primary" hasTabularNumbers>
              {result === null ? '-' : result.toLocaleString('ko-KR')}
            </Text>
            {field.computed?.unit && <Text type="supporting" color="secondary">{field.computed.unit}</Text>}
            <div style={{ marginLeft: 'auto' }}>
              <Text type="supporting" color="secondary">{opLabel} 자동 계산</Text>
            </div>
          </div>
          {description && <Text type="supporting">{description}</Text>}
        </VStack>
      </GridSpan>
    );
  }

  // 반복 그룹 — 행을 늘려가며 입력한다
  if (type === 'repeater') {
    const rows: any[] = Array.isArray(values[id]) ? values[id] : [];
    const subFields = field.repeater?.fields ?? [];
    const maxRows = field.repeater?.maxRows;
    const canAdd = !readOnly && (maxRows === undefined || rows.length < maxRows);
    const minRows = field.repeater?.minRows ?? 0;

    return (
      <GridSpan columns={12}>
        <VStack gap={2} vAlign="start">
          <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
            {groupLabelNode}
            <Text type="supporting" color="secondary">{rows.length}개 항목</Text>
          </HStack>
          {description && <Text type="supporting">{description}</Text>}

          {rows.length === 0 && (
            <Text type="supporting" color="secondary">아직 추가된 항목이 없습니다.</Text>
          )}

          {rows.map((row, rowIndex) => (
            <div
              key={rowIndex}
              style={{
                width: '100%',
                padding: 'var(--spacing-3)',
                borderRadius: 'var(--radius-inner)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-background-card)',
              }}
            >
              <HStack gap={2} vAlign="start">
                <div style={{ flexShrink: 0, paddingTop: 'var(--spacing-2)', minWidth: 24 }}>
                  <Text type="supporting" color="secondary" hasTabularNumbers>{rowIndex + 1}</Text>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Grid columns={12} gap={2}>
                    {subFields.map((sub) => (
                      <GridSpan key={sub.id} columns={getFieldSpan(sub.width)}>
                        <VStack gap={1}>
                          {rowIndex === 0 && (
                            <Text type="supporting" weight="medium" color="secondary">
                              {sub.label}
                              {sub.required && (
                                <span style={{ color: 'var(--color-text-red)', marginLeft: 2 }} aria-hidden>*</span>
                              )}
                            </Text>
                          )}
                          <FieldControl
                            field={sub}
                            value={row?.[sub.id]}
                            error={errors[`${id}.${rowIndex}.${sub.id}`]}
                            readOnly={readOnly}
                            compact
                            onChange={(val) => {
                              const next = rows.map((r, i) => (i === rowIndex ? { ...r, [sub.id]: val } : r));
                              onRowsChange(id, next);
                            }}
                          />
                        </VStack>
                      </GridSpan>
                    ))}
                  </Grid>
                </div>
                {!readOnly && rows.length > minRows && (
                  <div style={{ flexShrink: 0, paddingTop: rowIndex === 0 ? 'var(--spacing-5)' : 0 }}>
                    <Button
                      label="행 삭제"
                      variant="ghost"
                      size="sm"
                      isIconOnly
                      icon={<Icon icon={IconTrash} size="sm" />}
                      onClick={() => onRowsChange(id, rows.filter((_, i) => i !== rowIndex))}
                    />
                  </div>
                )}
              </HStack>
            </div>
          ))}

          {error && <FieldStatus type="error" message={error} variant="detached" />}

          {canAdd && (
            <Button
              label={field.repeater?.addLabel || '행 추가'}
              variant="secondary"
              size="sm"
              icon={<Icon icon={IconPlus} size="sm" />}
              onClick={() => onRowsChange(id, [...rows, createEmptyRow(field)])}
            />
          )}
        </VStack>
      </GridSpan>
    );
  }

  if (type === 'checkbox') {
    const checkedValues: string[] = Array.isArray(values[id]) ? values[id] : [];
    const handleCheckbox = (optValue: string, checked: boolean) => {
      onChange(id, checked ? [...checkedValues, optValue] : checkedValues.filter((v) => v !== optValue));
    };
    return (
      <GridSpan columns={span}>
        <VStack gap={1.5} vAlign="start">
          {groupLabelNode}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-3)', alignItems: 'center' }}>
            {(field.options ?? []).map((opt) => (
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
              value={values[startKey] || undefined}
              onChange={(val) => onChange(startKey, val ?? '')}
            />
            <Text type="supporting">~</Text>
            <DateInput
              label="종료일"
              isLabelHidden
              isDisabled={readOnly}
              value={values[endKey] || undefined}
              onChange={(val) => onChange(endKey, val ?? '')}
            />
          </HStack>
          {description && <Text type="supporting">{description}</Text>}
          {error && <FieldStatus type="error" message={error} variant="detached" />}
        </VStack>
      </GridSpan>
    );
  }

  return (
    <GridSpan columns={span}>
      <FieldControl
        field={field}
        value={values[id]}
        error={error}
        readOnly={readOnly}
        onChange={(val) => onChange(id, val)}
      />
    </GridSpan>
  );
}

/**
 * API에서 온 formSchema는 JSON 문자열일 수 있고, 파싱 실패·필드 누락도 가능하다.
 * 어떤 입력이 와도 렌더러가 죽지 않도록 항상 { fields: [] } 형태로 정규화한다.
 * (파싱 없이 문자열을 그대로 넘긴 호출부에서 schema.fields.forEach가 터져
 *  화면 전체가 Application error로 죽는 사고가 있었다)
 */
function normalizeSchema(raw: unknown): FormSchema {
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
  }
  const schema = parsed as FormSchema | null;
  if (schema && Array.isArray(schema.fields)) return schema;
  return { version: 1, fields: [] };
}

export default function FormRenderer({
  schema: rawSchema,
  initialValues = {},
  onSubmit,
  readOnly = false,
  submitLabel = '제출',
  documentFrame,
}: FormRendererProps) {
  const schema = normalizeSchema(rawSchema);
  const buildInitialValues = (): FormValues => {
    const vals: FormValues = { ...initialValues };
    schema.fields.forEach((field) => {
      if (field.type === 'section' || field.type === 'computed') return;

      if (field.type === 'dateRange') {
        const startKey = `${field.id}_start`;
        const endKey = `${field.id}_end`;
        if (!(startKey in vals)) vals[startKey] = field.defaultValue?.start ?? '';
        if (!(endKey in vals)) vals[endKey] = field.defaultValue?.end ?? '';
        return;
      }

      if (field.type === 'repeater') {
        if (!Array.isArray(vals[field.id])) {
          const minRows = field.repeater?.minRows ?? 1;
          vals[field.id] = Array.from({ length: Math.max(minRows, 0) }, () => createEmptyRow(field));
        }
        return;
      }

      if (!(field.id in vals)) {
        vals[field.id] = field.type === 'checkbox' ? (field.defaultValue ?? []) : (field.defaultValue ?? '');
      }
    });
    return vals;
  };

  const [formValues, setFormValues] = useState<FormValues>(buildInitialValues);
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

  const handleRowsChange = (fieldId: string, rows: any[]) => {
    setFormValues((prev) => ({ ...prev, [fieldId]: rows }));
    setErrors((prev) => {
      // 해당 반복 그룹의 오류는 값이 바뀌면 초기화한다
      const next: Record<string, string> = {};
      Object.entries(prev).forEach(([k, v]) => {
        if (k !== fieldId && !k.startsWith(`${fieldId}.`)) next[k] = v;
      });
      return next;
    });
  };

  // 조건부 표시 규칙에 따라 지금 보여줄 필드
  const visibleFields = useMemo(
    () => schema.fields.filter((field) => isFieldVisible(field, formValues)),
    [schema.fields, formValues]
  );

  const handleSubmit = () => {
    const newErrors = validateForm(schema, formValues);
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;
    // 계산 결과를 제출 시점 값으로 함께 저장한다
    onSubmit(withComputedValues(schema, formValues));
  };

  if (schema.fields.length === 0) {
    return (
      <div style={{ padding: 'var(--spacing-10) 0', textAlign: 'center' }}>
        <Text type="body" color="secondary">표시할 필드가 없습니다.</Text>
      </div>
    );
  }

  // ── 공문형 레이아웃: 실제 결재 문서 모양 위에서 빈칸을 바로 입력 ──
  if (documentFrame) {
    // 표 셀 하나에 들어갈 입력 컨트롤 — 복잡 타입은 여기서 직접 분기한다
    const renderDocControl = (field: FormFieldSchema) => {
      const error = field.type === 'dateRange'
        ? errors[`${field.id}_start`] || errors[`${field.id}_end`]
        : errors[field.id];

      if (field.type === 'computed') {
        const result = computeFieldValue(field.computed, formValues);
        return (
          <Text type="body" weight="bold" hasTabularNumbers>
            {result === null ? '-' : result.toLocaleString('ko-KR')}
            {field.computed?.unit ? ` ${field.computed.unit}` : ''}
          </Text>
        );
      }

      if (field.type === 'dateRange') {
        return (
          <HStack gap={2} vAlign="center" wrap="wrap">
            <FieldControl
              field={{ ...field, id: `${field.id}_start`, type: 'date', label: '시작일' }}
              value={formValues[`${field.id}_start`]}
              error={errors[`${field.id}_start`]}
              readOnly={readOnly}
              onChange={(val) => handleChange(`${field.id}_start`, val)}
              compact
            />
            <Text color="secondary">~</Text>
            <FieldControl
              field={{ ...field, id: `${field.id}_end`, type: 'date', label: '종료일' }}
              value={formValues[`${field.id}_end`]}
              error={errors[`${field.id}_end`]}
              readOnly={readOnly}
              onChange={(val) => handleChange(`${field.id}_end`, val)}
              compact
            />
          </HStack>
        );
      }

      if (field.type === 'checkbox') {
        const checkedValues: string[] = Array.isArray(formValues[field.id]) ? formValues[field.id] : [];
        return (
          <VStack gap={1} vAlign="start">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-3)', alignItems: 'center' }}>
              {(field.options ?? []).map((opt) => (
                <CheckboxInput
                  key={opt.value}
                  label={opt.label}
                  size="sm"
                  isDisabled={readOnly}
                  value={checkedValues.includes(opt.value)}
                  onChange={(checked) =>
                    handleChange(
                      field.id,
                      checked ? [...checkedValues, opt.value] : checkedValues.filter((v) => v !== opt.value)
                    )
                  }
                />
              ))}
            </div>
            {error && (
              <span style={{ color: 'var(--color-text-red)' }}>
                <Text type="supporting" color="inherit">{error}</Text>
              </span>
            )}
          </VStack>
        );
      }

      return (
        <FieldControl
          field={field}
          value={formValues[field.id]}
          error={error}
          readOnly={readOnly}
          onChange={(val) => handleChange(field.id, val)}
          compact
        />
      );
    };

    // 반복 표(repeater)는 문서 표 셀에 들어가기엔 넓어서 표 아래 전체 폭으로 그린다
    const tableFields = visibleFields.filter((f) => f.type !== 'repeater');
    const repeaterFields = visibleFields.filter((f) => f.type === 'repeater');
    // 섹션은 구획 제목 행으로 렌더하고, 3필드 이상 묶인 행은 2개씩 쪼갠다 (필드 유실 방지)
    const fieldRows = groupFieldsIntoRows(tableFields).flatMap(chunkRowForDocTable);
    const line = documentFrame.approvalLine ?? [];
    const boxes = [
      { label: '기안', name: documentFrame.requesterName },
      ...line.map((approver, index) => ({
        label: index === line.length - 1 ? '결재' : '검토',
        name: approver.name,
      })),
    ];
    const today = new Date();
    const todayLabel = `${today.getFullYear()}. ${today.getMonth() + 1}. ${today.getDate()}.`;

    return (
      <VStack gap={5}>
        <div className="carev-doc-page" style={{ width: '100%' }}>
          <div className="carev-doc-letterhead">{documentFrame.companyName}</div>

          <div className="carev-doc-topbar">
            <div className="carev-doc-meta">
              <div>문서번호 : 결재 후 발급</div>
              <div>기안일자 : {todayLabel}</div>
              <div>시행일자 : -</div>
            </div>
            <table className="carev-doc-approval-table">
              <thead>
                <tr>
                  {boxes.map((box, index) => (
                    <th key={index}>{box.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {boxes.map((_, index) => (
                    <td key={index} className="carev-doc-approval-cell" />
                  ))}
                </tr>
                <tr>
                  {boxes.map((box, index) => (
                    <td key={index} className="carev-doc-approval-name">{box.name || '-'}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <div className="carev-doc-title">
            {documentFrame.title || '(제목을 입력하세요)'}
          </div>

          <table className="carev-doc-fields-table">
            <tbody>
              {fieldRows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.length === 1 && row[0].type === 'section' ? (
                    <td className="carev-doc-section-row" colSpan={4}>{row[0].label}</td>
                  ) : row.length === 2 ? (
                    <>
                      <td className="carev-doc-field-label">{row[0].label}{row[0].required ? ' *' : ''}</td>
                      <td className="carev-doc-field-value">{renderDocControl(row[0])}</td>
                      <td className="carev-doc-field-label">{row[1].label}{row[1].required ? ' *' : ''}</td>
                      <td className="carev-doc-field-value">{renderDocControl(row[1])}</td>
                    </>
                  ) : (
                    <>
                      <td className="carev-doc-field-label">{row[0].label}{row[0].required ? ' *' : ''}</td>
                      <td className="carev-doc-field-value" colSpan={3}>{renderDocControl(row[0])}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {repeaterFields.length > 0 && (
            <div style={{ marginTop: 'var(--spacing-4)' }}>
              <Grid columns={12} gap={4}>
                {repeaterFields.map((field) => (
                  <FieldRenderer
                    key={field.id}
                    field={field}
                    values={formValues}
                    errors={errors}
                    readOnly={readOnly}
                    onChange={handleChange}
                    onRowsChange={handleRowsChange}
                  />
                ))}
              </Grid>
            </div>
          )}
        </div>

        {!readOnly && (
          <HStack hAlign="end">
            <Button label={submitLabel} variant="primary" type="button" onClick={handleSubmit} />
          </HStack>
        )}
      </VStack>
    );
  }

  return (
    <VStack gap={6}>
      <Grid columns={12} gap={4}>
        {visibleFields.map((field) => (
          <FieldRenderer
            key={field.id}
            field={field}
            values={formValues}
            errors={errors}
            readOnly={readOnly}
            onChange={handleChange}
            onRowsChange={handleRowsChange}
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
