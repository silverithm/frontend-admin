export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'dateRange'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'file'
  | 'section'
  /** 다른 숫자 필드를 집계해 자동으로 값이 채워지는 필드 */
  | 'computed'
  /** 같은 구성의 행을 여러 개 입력하는 반복 그룹 */
  | 'repeater';

/** 한 줄(12칼럼) 안에서 필드가 차지하는 폭 */
export type FieldWidth = 'full' | 'twoThirds' | 'half' | 'third' | 'quarter';

export const FIELD_WIDTH_SPAN: Record<FieldWidth, number> = {
  full: 12,
  twoThirds: 8,
  half: 6,
  third: 4,
  quarter: 3,
};

export const FIELD_WIDTH_LABEL: Record<FieldWidth, string> = {
  full: '한 줄 전체',
  twoThirds: '2/3',
  half: '1/2',
  third: '1/3',
  quarter: '1/4',
};

export interface FormFieldOption {
  label: string;
  value: string;
}

export interface FormFieldValidation {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
}

/** 집계 연산 */
export type AggregateOperation = 'sum' | 'average' | 'count';

export const AGGREGATE_LABEL: Record<AggregateOperation, string> = {
  sum: '합계',
  average: '평균',
  count: '개수',
};

export interface ComputedConfig {
  operation: AggregateOperation;
  /** 집계할 일반 숫자 필드 id 목록 */
  sourceFieldIds?: string[];
  /** 반복 그룹의 특정 숫자 컬럼을 행 전체에 대해 집계할 때 사용 */
  sourceRepeaterId?: string;
  sourceRepeaterFieldId?: string;
  /** 표시 단위 (예: 원, 시간) */
  unit?: string;
}

export interface RepeaterConfig {
  /** 각 행을 구성하는 하위 필드 (repeater/computed는 중첩 불가) */
  fields: FormFieldSchema[];
  minRows?: number;
  maxRows?: number;
  addLabel?: string;
}

export type ConditionOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'isEmpty'
  | 'isNotEmpty';

export const CONDITION_LABEL: Record<ConditionOperator, string> = {
  equals: '값이 같으면',
  notEquals: '값이 다르면',
  contains: '값을 포함하면',
  isEmpty: '비어 있으면',
  isNotEmpty: '입력되어 있으면',
};

export interface FieldCondition {
  /** 기준이 되는 다른 필드의 id */
  fieldId: string;
  operator: ConditionOperator;
  value?: string;
}

export interface VisibilityRule {
  /** all = 모든 조건 만족, any = 하나라도 만족 */
  match: 'all' | 'any';
  conditions: FieldCondition[];
}

export interface FormFieldSchema {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: FormFieldOption[];
  defaultValue?: any;
  validation?: FormFieldValidation;
  width?: FieldWidth;
  description?: string;
  /** type === 'computed' 일 때의 집계 설정 */
  computed?: ComputedConfig;
  /** type === 'repeater' 일 때의 행 구성 */
  repeater?: RepeaterConfig;
  /** 조건을 만족할 때만 표시. 없으면 항상 표시 */
  visibleWhen?: VisibilityRule;
}

export interface FormSchema {
  version: number;
  fields: FormFieldSchema[];
}
