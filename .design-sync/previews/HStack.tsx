import { HStack, VStack, Card, Text, Button } from '@astryxdesign/core';

export const Gaps = () => (
  <VStack gap={3} align="start">
    <HStack gap={1}>
      <Card padding={2}><Text type="supporting">gap 1</Text></Card>
      <Card padding={2}><Text type="supporting">gap 1</Text></Card>
    </HStack>
    <HStack gap={4}>
      <Card padding={2}><Text type="supporting">gap 4</Text></Card>
      <Card padding={2}><Text type="supporting">gap 4</Text></Card>
    </HStack>
  </VStack>
);

export const SpaceBetween = () => (
  <div style={{ width: 380 }}>
    <HStack hAlign="between" vAlign="center" width="100%">
      <Text type="body" weight="medium">8월 근무표</Text>
      <Button label="전체보기" variant="ghost" size="sm" />
    </HStack>
  </div>
);

export const Wrap = () => (
  <div style={{ width: 320 }}>
    <HStack gap={2} wrap="wrap">
      <Card padding={2}><Text type="supporting">요양보호사</Text></Card>
      <Card padding={2}><Text type="supporting">사회복지사</Text></Card>
      <Card padding={2}><Text type="supporting">간호사</Text></Card>
      <Card padding={2}><Text type="supporting">운전원</Text></Card>
      <Card padding={2}><Text type="supporting">조리원</Text></Card>
    </HStack>
  </div>
);
