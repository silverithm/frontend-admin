'use client';

/**
 * 원 단위 금액 입력 — 쉼표·원·공백을 붙여 넣어도 숫자만 읽고, 보여 줄 때는 천 단위 쉼표를 붙인다.
 * 공용 NumField와 같지만 Enter 키(onEnter)와 입력칸 ref를 받는다(장부·후원금을 키보드로 빨리 넣기 위해).
 */
import type { Ref } from 'react';
import { TextInput } from '@astryxdesign/core/TextInput';
import { groupDigits, parseDigits } from '@/components/lab/labFormat';

interface Props {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  max: number;
  description?: string;
  placeholder?: string;
  isDisabled?: boolean;
  isLabelHidden?: boolean;
  onEnter?: () => void;
  inputRef?: Ref<HTMLInputElement>;
}

export default function FinanceMoneyField({ label, value, onChange, max, description, placeholder, isDisabled, isLabelHidden, onEnter, inputRef }: Props) {
  return (
    <TextInput
      ref={inputRef}
      label={label}
      isLabelHidden={isLabelHidden}
      value={value === null ? '' : groupDigits(value)}
      onChange={(text) => onChange(parseDigits(text, max))}
      description={description}
      placeholder={placeholder}
      isDisabled={isDisabled}
      onEnter={onEnter}
    />
  );
}
