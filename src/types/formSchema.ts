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
  | 'section';

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

export interface FormFieldSchema {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: FormFieldOption[];
  defaultValue?: any;
  validation?: FormFieldValidation;
  width?: 'full' | 'half';
  description?: string;
}

export interface FormSchema {
  version: number;
  fields: FormFieldSchema[];
}
