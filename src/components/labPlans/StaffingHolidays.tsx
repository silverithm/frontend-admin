'use client';

/** 공휴일 — 그 달의 공휴일·대체공휴일(2026년 목록이 기본, 넣고 뺄 수 있다)과 월 기준 근무시간(월~금 − 공휴일 − 근로자의 날 × 8시간). */
import { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { LabDateInput, SupportText } from '@/components/lab/LabUi';
import { dotDate, monthLabel, weekdayKo } from '@/components/lab/labFormat';
import { KR_HOLIDAYS_2026, defaultHolidays, holidaysOfMonth, standardMonthlyHours, weekdaysInMonth } from '@/lib/lab/staffingRules';
import styles from './labPlans.module.css';
import eight from './labPlans8.module.css';

interface Props {
  month: string;
  holidays: string[];
  onChange: (holidays: string[]) => void;
  disabled: boolean;
}

export default function StaffingHolidays({ month, holidays, onChange, disabled }: Props) {
  const [adding, setAdding] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const hours = standardMonthlyHours(month, holidays);
  const weekdays = weekdaysInMonth(month);
  const isDefault = JSON.stringify([...holidays].sort()) === JSON.stringify(defaultHolidays(month));
  const noList = !KR_HOLIDAYS_2026.some((d) => d.startsWith(month.slice(0, 4)));

  const add = () => {
    if (adding === '') return;
    if (holidaysOfMonth(month, [adding]).length === 0) {
      setMessage(`${monthLabel(month)} 안의 날짜만 넣을 수 있습니다`);
      return;
    }
    setMessage(null);
    onChange(holidaysOfMonth(month, [...holidays, adding]));
    setAdding('');
  };

  return (
    <Card padding={4}>
      <VStack gap={3}>
        <Text type="label">공휴일과 월 기준 근무시간</Text>
        <div className={eight.chipRow}>
          {holidays.length === 0 && <Text type="supporting" color="secondary">이 달에 뺄 공휴일이 없습니다.</Text>}
          {holidays.map((d) => (
            <button key={d} type="button" className={eight.removableChip} disabled={disabled} aria-label={`${dotDate(d)} 공휴일 빼기`} onClick={() => onChange(holidays.filter((x) => x !== d))}>
              <span>
                {dotDate(d)} ({weekdayKo(d)})
              </span>
              <span aria-hidden>×</span>
            </button>
          ))}
        </div>
        <HStack gap={3} vAlign="end" wrap="wrap">
          <LabDateInput label="공휴일 더하기" value={adding} onChange={setAdding} />
          <Button label="넣기" variant="secondary" isDisabled={disabled || adding === ''} onClick={add} />
          <Button label="기본 목록으로" variant="ghost" isDisabled={disabled || isDefault} onClick={() => { setMessage(null); onChange(defaultHolidays(month)); }} />
        </HStack>
        {message && <SupportText tone="warn">{message}</SupportText>}
        <div>
          <span className={eight.statRow}>
            <span className={styles.statBox}>
              <Text type="supporting" color="secondary">월~금 날 수</Text>
              <Text type="large" hasTabularNumbers>{weekdays}일</Text>
            </span>
            <span className={styles.statBox}>
              <Text type="supporting" color="secondary">월 기준 근무시간</Text>
              <Text type="large" hasTabularNumbers>{hours}시간</Text>
            </span>
          </span>
        </div>
        <SupportText>
          월 기준 근무시간은 (월~금 {weekdays}일 − 공휴일·대체공휴일 − 5월 1일 근로자의 날) × 8시간입니다(고시 제49조①). 토요일은 근무가능일에서 뺍니다.
          {noList ? ' 2026년 밖의 달은 기본 공휴일 목록이 없으니 직접 넣어 주세요.' : ' 기본 공휴일 목록은 대조 필요합니다 — 인사혁신처 월력요항과 맞춰 보고 고쳐 주세요.'}
        </SupportText>
      </VStack>
    </Card>
  );
}
