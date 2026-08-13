import { SegmentedControl, SegmentedControlItem, Icon, VStack } from '@astryxdesign/core';

export const CalendarView = () => (
  <SegmentedControl value="both" onChange={() => {}} label="달력 표시 내용">
    <SegmentedControlItem value="both" label="일정+휴무" />
    <SegmentedControlItem value="schedule" label="일정" />
    <SegmentedControlItem value="vacation" label="휴무" />
  </SegmentedControl>
);

export const WithIcons = () => (
  <SegmentedControl value="calendar" onChange={() => {}} label="배차 보기 모드">
    <SegmentedControlItem value="calendar" label="달력" icon={<Icon icon="calendar" size="sm" />} />
    <SegmentedControlItem value="list" label="목록" icon={<Icon icon="menu" size="sm" />} />
  </SegmentedControl>
);

export const Sizes = () => (
  <VStack gap={3} align="start">
    <SegmentedControl value="a" onChange={() => {}} label="크기 sm" size="sm">
      <SegmentedControlItem value="a" label="전체" />
      <SegmentedControlItem value="b" label="내 업무" />
    </SegmentedControl>
    <SegmentedControl value="a" onChange={() => {}} label="크기 md">
      <SegmentedControlItem value="a" label="전체" />
      <SegmentedControlItem value="b" label="내 업무" />
    </SegmentedControl>
  </VStack>
);
