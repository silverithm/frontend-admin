import { Badge, HStack, VStack, Text } from '@astryxdesign/core';

export const Statuses = () => (
  <HStack gap={2} vAlign="center" wrap="wrap">
    <Badge variant="teal" label="승인" />
    <Badge variant="orange" label="대기" />
    <Badge variant="error" label="반려" />
    <Badge variant="neutral" label="임시저장" />
    <Badge variant="blue" label="연차" />
    <Badge variant="green" label="반차" />
    <Badge variant="purple" label="대체휴무" />
  </HStack>
);

export const InContext = () => (
  <VStack gap={2} align="start" width={320}>
    <HStack gap={2} vAlign="center">
      <Text type="body" weight="medium">8월 근무표 확정 요청</Text>
      <Badge variant="orange" label="대기" />
    </HStack>
    <HStack gap={2} vAlign="center">
      <Text type="body" weight="medium">차량 운행일지</Text>
      <Badge variant="teal" label="승인" />
    </HStack>
    <HStack gap={2} vAlign="center">
      <Text type="body" weight="medium">비품 구매 요청</Text>
      <Badge variant="error" label="반려" />
    </HStack>
  </VStack>
);

export const Counts = () => (
  <HStack gap={2} vAlign="center">
    <Badge variant="error" label="3" />
    <Badge variant="error" label="12" />
    <Badge variant="error" label="99+" />
  </HStack>
);
