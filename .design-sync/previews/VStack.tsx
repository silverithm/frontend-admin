import { VStack, Card, Text } from '@astryxdesign/core';

export const Gaps = () => (
  <VStack gap={4} align="start">
    <VStack gap={1} align="start">
      <Text type="label" weight="semibold">gap 1</Text>
      <Card padding={2} width={200}><Text type="supporting">오늘 일정</Text></Card>
      <Card padding={2} width={200}><Text type="supporting">오늘 휴무</Text></Card>
    </VStack>
    <VStack gap={4} align="start">
      <Text type="label" weight="semibold">gap 4</Text>
      <Card padding={2} width={200}><Text type="supporting">오늘 일정</Text></Card>
      <Card padding={2} width={200}><Text type="supporting">오늘 휴무</Text></Card>
    </VStack>
  </VStack>
);

export const Alignment = () => (
  <VStack gap={3} width={280}>
    <VStack gap={1} align="start" width="100%">
      <Text type="supporting">align start</Text>
      <Card padding={2}><Text type="supporting">왼쪽</Text></Card>
    </VStack>
    <VStack gap={1} align="center" width="100%">
      <Text type="supporting">align center</Text>
      <Card padding={2}><Text type="supporting">가운데</Text></Card>
    </VStack>
    <VStack gap={1} align="end" width="100%">
      <Text type="supporting">align end</Text>
      <Card padding={2}><Text type="supporting">오른쪽</Text></Card>
    </VStack>
  </VStack>
);
