import { Avatar, HStack, VStack, Text } from '@astryxdesign/core';

export const Names = () => (
  <HStack gap={2} vAlign="center">
    <Avatar name="김영희" />
    <Avatar name="박민수" />
    <Avatar name="이철수" />
    <Avatar name="정하나" />
  </HStack>
);

export const Sizes = () => (
  <HStack gap={2} vAlign="center">
    <Avatar name="김영희" size="xsmall" />
    <Avatar name="김영희" size="small" />
    <Avatar name="김영희" />
    <Avatar name="김영희" size="large" />
  </HStack>
);

export const InList = () => (
  <VStack gap={2} align="start" width={280}>
    <HStack gap={2} vAlign="center">
      <Avatar name="김영희" size="small" />
      <VStack gap={0} align="start">
        <Text type="body" weight="medium">김영희</Text>
        <Text type="supporting">요양보호사</Text>
      </VStack>
    </HStack>
    <HStack gap={2} vAlign="center">
      <Avatar name="이철수" size="small" />
      <VStack gap={0} align="start">
        <Text type="body" weight="medium">이철수</Text>
        <Text type="supporting">사회복지사</Text>
      </VStack>
    </HStack>
  </VStack>
);
