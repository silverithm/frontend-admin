import { Divider, VStack, HStack, Text } from '@astryxdesign/core';

export const Horizontal = () => (
  <VStack gap={2} width={320} align="start">
    <Text type="body">요양보호사 김영희</Text>
    <Divider />
    <Text type="body">요양보호사 박민수</Text>
    <Divider />
    <Text type="body">사회복지사 이철수</Text>
  </VStack>
);

export const BetweenSections = () => (
  <VStack gap={3} width={320} align="start">
    <Text type="label" weight="semibold">오늘 일정</Text>
    <Text type="supporting">오전 10시 어르신 체조</Text>
    <Divider />
    <Text type="label" weight="semibold">오늘 휴무</Text>
    <Text type="supporting">요양보호사 김영희 · 연차</Text>
  </VStack>
);
