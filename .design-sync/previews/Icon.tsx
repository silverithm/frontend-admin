import { Icon, HStack, VStack, Text } from '@astryxdesign/core';

export const Semantic = () => (
  <HStack gap={3} vAlign="center" wrap="wrap">
    <Icon icon="calendar" size="md" />
    <Icon icon="clock" size="md" />
    <Icon icon="search" size="md" />
    <Icon icon="check" size="md" />
    <Icon icon="close" size="md" />
    <Icon icon="menu" size="md" />
    <Icon icon="funnel" size="md" />
    <Icon icon="copy" size="md" />
  </HStack>
);

export const Sizes = () => (
  <HStack gap={3} vAlign="center">
    <Icon icon="calendar" size="xsm" />
    <Icon icon="calendar" size="sm" />
    <Icon icon="calendar" size="md" />
    <Icon icon="calendar" size="lg" />
  </HStack>
);

export const Colors = () => (
  <VStack gap={2} align="start">
    <HStack gap={2} vAlign="center">
      <Icon icon="success" size="md" color="success" />
      <Text type="supporting">승인됨</Text>
    </HStack>
    <HStack gap={2} vAlign="center">
      <Icon icon="warning" size="md" color="warning" />
      <Text type="supporting">마감 임박</Text>
    </HStack>
    <HStack gap={2} vAlign="center">
      <Icon icon="error" size="md" color="error" />
      <Text type="supporting">반려됨</Text>
    </HStack>
    <HStack gap={2} vAlign="center">
      <Icon icon="info" size="md" color="accent" />
      <Text type="supporting">안내</Text>
    </HStack>
  </VStack>
);
