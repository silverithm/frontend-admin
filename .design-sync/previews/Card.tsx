import { Card, VStack, HStack, Text, Heading, Badge, Button, Divider } from '@astryxdesign/core';

export const Basic = () => (
  <Card padding={4} maxWidth={320}>
    <VStack gap={2} align="start">
      <Heading level={3}>이번 달 근무표</Heading>
      <Text type="supporting">8월 1일부터 8월 31일까지 · 등록 24건</Text>
    </VStack>
  </Card>
);

export const Variants = () => (
  <HStack gap={3} wrap="wrap">
    <Card padding={3} width={180} variant="default">
      <Text type="label" weight="semibold">기본</Text>
    </Card>
    <Card padding={3} width={180} variant="muted">
      <Text type="label" weight="semibold">보조 정보</Text>
    </Card>
    <Card padding={3} width={180} variant="teal">
      <Text type="label" weight="semibold">브랜드 강조</Text>
    </Card>
    <Card padding={3} width={180} variant="red">
      <Text type="label" weight="semibold">주의</Text>
    </Card>
  </HStack>
);

export const WithActions = () => (
  <Card padding={4} maxWidth={360}>
    <VStack gap={3} align="start">
      <HStack hAlign="between" vAlign="center" width="100%">
        <Heading level={4}>연차 신청</Heading>
        <Badge variant="orange" label="대기" />
      </HStack>
      <Text type="body">요양보호사 김영희 · 8월 21일(목) 하루</Text>
      <Text type="supporting">같은 날 휴무 2명 · 정원 3명</Text>
      <Divider />
      <HStack gap={2}>
        <Button label="승인" variant="primary" size="sm" />
        <Button label="반려" variant="secondary" size="sm" />
      </HStack>
    </VStack>
  </Card>
);

export const Padding = () => (
  <HStack gap={3} vAlign="start">
    <Card padding={0} width={140}>
      <div style={{ padding: 'var(--spacing-2)' }}>
        <Text type="supporting">padding 0</Text>
      </div>
    </Card>
    <Card padding={3} width={140}>
      <Text type="supporting">padding 3</Text>
    </Card>
    <Card padding={6} width={140}>
      <Text type="supporting">padding 6</Text>
    </Card>
  </HStack>
);
