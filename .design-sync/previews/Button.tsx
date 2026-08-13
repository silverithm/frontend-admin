import { Button, HStack, VStack, Icon } from '@astryxdesign/core';

export const Variants = () => (
  <HStack gap={2} vAlign="center">
    <Button label="저장" variant="primary" />
    <Button label="취소" variant="secondary" />
    <Button label="자세히" variant="ghost" />
    <Button label="삭제" variant="destructive" />
  </HStack>
);

export const Sizes = () => (
  <HStack gap={2} vAlign="center">
    <Button label="작게" variant="primary" size="sm" />
    <Button label="기본" variant="primary" size="md" />
    <Button label="크게" variant="primary" size="lg" />
  </HStack>
);

export const WithIcon = () => (
  <HStack gap={2} vAlign="center">
    <Button label="일정 추가" variant="primary" icon={<Icon icon="calendar" size="sm" />} />
    <Button label="검색" variant="secondary" icon={<Icon icon="search" size="sm" />} />
  </HStack>
);

export const States = () => (
  <HStack gap={2} vAlign="center">
    <Button label="결재 올리는 중" variant="primary" isLoading />
    <Button label="승인" variant="primary" isDisabled />
    <Button label="반려" variant="secondary" isDisabled />
  </HStack>
);

export const FullWidth = () => (
  <VStack gap={2} width={280}>
    <Button label="휴무 신청" variant="primary" style={{ width: '100%' }} />
    <Button label="닫기" variant="secondary" style={{ width: '100%' }} />
  </VStack>
);
