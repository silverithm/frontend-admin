'use client';

/**
 * 일정 등록 폼의 "반복" 칸 — 안 함 / 매주(요일 고르기) / 매월(같은 날짜).
 * 서버에는 반복 개념이 없어, 등록할 때 날짜마다 일정 한 건씩 만든다(createRepeatedSchedules).
 */
import React from 'react';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { DateInput } from '@astryxdesign/core/DateInput';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import type { ISODateString } from '@astryxdesign/core/Calendar';
import { MAX_REPEAT_COUNT, describeRepeat, expandRepeatDates } from '@/lib/scheduleRepeat';
import type { RepeatKind, RepeatRule } from '@/lib/scheduleRepeat';

export const EMPTY_REPEAT: RepeatRule = { kind: 'NONE', weekdays: [], until: '' };

const WEEKDAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

interface Props {
  startDate: string;
  value: RepeatRule;
  onChange: (next: RepeatRule) => void;
}

export default function ScheduleRepeatFields({ startDate, value, onChange }: Props) {
  const dates = value.kind === 'NONE' ? [] : expandRepeatDates(startDate, value);
  const capped = dates.length >= MAX_REPEAT_COUNT;

  return (
    <VStack gap={2}>
      <Selector
        label="반복"
        value={value.kind}
        onChange={(v) => onChange({ ...value, kind: ((v as RepeatKind) || 'NONE'), until: v && v !== 'NONE' ? value.until : '' })}
        options={[
          { value: 'NONE', label: '반복 안 함' },
          { value: 'WEEKLY', label: '매주' },
          { value: 'MONTHLY', label: '매월 같은 날짜' },
        ]}
      />
      {value.kind === 'WEEKLY' && (
        <HStack gap={3} wrap="wrap">
          {WEEKDAY_NAMES.map((name, day) => (
            <CheckboxInput
              key={name}
              label={name}
              value={value.weekdays.includes(day)}
              onChange={(checked) =>
                onChange({ ...value, weekdays: checked ? [...value.weekdays, day].sort() : value.weekdays.filter((d) => d !== day) })
              }
            />
          ))}
        </HStack>
      )}
      {value.kind !== 'NONE' && (
        <>
          <DateInput
            label="반복 끝나는 날"
            value={value.until ? (value.until as ISODateString) : undefined}
            onChange={(v) => onChange({ ...value, until: v || '' })}
          />
          <Text type="supporting" color={value.until && value.until >= startDate ? 'secondary' : 'accent'}>
            {!value.until
              ? '반복이 끝나는 날을 골라 주세요.'
              : value.until < startDate
                ? '끝나는 날이 시작일보다 빠릅니다.'
                : `${describeRepeat(value.kind, value.weekdays.length > 0 ? value.weekdays : [new Date(`${startDate}T12:00:00Z`).getUTCDay()], dates.length)}${capped ? ` (최대 ${MAX_REPEAT_COUNT}건까지만 등록합니다)` : ''}`}
          </Text>
        </>
      )}
    </VStack>
  );
}
