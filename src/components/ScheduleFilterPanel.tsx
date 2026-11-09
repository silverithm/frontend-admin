'use client';

import { useMemo } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { CheckboxList, CheckboxListItem } from '@astryxdesign/core/CheckboxList';
import { VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import {
  collectPersonOptions,
  isKindFilterValue,
  isPersonFilterValue,
  labelFilterValue,
  matchesKindFilter,
  MY_SCHEDULES_FILTER,
  NO_LABEL_FILTER,
  personFilterValue,
  type FilterableSchedule,
} from '@/lib/scheduleFilter';

interface ScheduleFilterPanelProps {
  values: string[];
  onChange: (values: string[]) => void;
  /** 기관이 만든 일정 구분 */
  labels: { id: string | number; name: string }[];
  /** 보고 있는 달의 일정 전체(필터 걸기 전) — 담당자 목록과 완료 수를 여기서 센다 */
  schedules: FilterableSchedule[];
  /** 골라 둔 사람이 이번 달 일정에 없을 때 쓸 이름 */
  fallbackName?: (personKey: string) => string | undefined;
}

/**
 * '일정 필터' 팝오버 내용 — 월간일정 탭과 대시보드 달력이 같이 쓴다.
 *
 * 담당자 묶음을 위에 둔다: 원장이 월간 업무를 사람별로 점검하려고 여는 필터다(2026-11-09 요청).
 * 사람 옆 '완료 9/12'는 그 사람이 맡은 이번 달 일정 중 수행완료된 수 — 열기만 해도 누가
 * 밀렸는지 보인다. 일정 구분을 골라 두면 그 구분 안에서 센다(목록과 달력이 같은 일정을 말한다).
 */
export default function ScheduleFilterPanel({
  values,
  onChange,
  labels,
  schedules,
  fallbackName,
}: ScheduleFilterPanelProps) {
  const kindValues = values.filter(isKindFilterValue);
  const personValues = values.filter(isPersonFilterValue);
  const people = useMemo(
    () => collectPersonOptions(schedules.filter((s) => matchesKindFilter(s, values)), values, fallbackName),
    [schedules, values, fallbackName],
  );

  return (
    // 담당자가 많은 기관에서도 화면 밖으로 넘치지 않게 팝오버 안에서 스크롤한다
    <div style={{ minWidth: 240, maxHeight: 'min(70vh, 560px)', overflowY: 'auto' }}>
      <VStack gap={4}>
        <VStack gap={1}>
          <CheckboxList
            label="담당자"
            value={personValues}
            onChange={(next) => onChange([...next, ...kindValues])}
          >
            <CheckboxListItem label="나" value={MY_SCHEDULES_FILTER} />
            {people.map((person) => (
              <CheckboxListItem
                key={person.key}
                label={person.name}
                value={personFilterValue(person.key)}
                endContent={
                  <Text type="supporting" color="secondary" hasTabularNumbers>
                    {person.total > 0 ? `완료 ${person.done}/${person.total}` : '이달 없음'}
                  </Text>
                }
              />
            ))}
          </CheckboxList>
          {people.length === 0 && (
            <Text type="supporting" color="secondary">
              이 달에는 담당자를 정한 일정이 없습니다
            </Text>
          )}
        </VStack>
        <CheckboxList
          label="일정 구분"
          value={kindValues}
          onChange={(next) => onChange([...personValues, ...next])}
        >
          {labels.map((label) => (
            <CheckboxListItem key={label.id} label={label.name} value={labelFilterValue(label.id)} />
          ))}
          <CheckboxListItem label="구분 없음" value={NO_LABEL_FILTER} />
        </CheckboxList>
        {values.length > 0 && (
          <Button label="필터 모두 해제" variant="ghost" size="sm" onClick={() => onChange([])} />
        )}
      </VStack>
    </div>
  );
}
