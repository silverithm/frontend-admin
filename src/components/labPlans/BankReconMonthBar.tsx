'use client';

/** 대사할 달 고르기 — 한 달씩 넘긴다. 기본은 지난달(월말 잔액은 달이 끝나야 확인된다). */
import { Text } from '@astryxdesign/core/Text';
import { MonthStepper, SupportText } from '@/components/lab/LabUi';
import styles from './labPlans.module.css';

interface Props {
  month: string;
  onChange: (month: string) => void;
}

export default function BankReconMonthBar({ month, onChange }: Props) {
  return (
    <div className={styles.toolbar}>
      <Text type="label">대사할 달</Text>
      <MonthStepper value={month} onChange={onChange} />
      <SupportText>월말 잔액은 달이 끝난 뒤 확인되므로 기본은 지난달입니다.</SupportText>
    </div>
  );
}
