import { Text, VStack, HStack } from '@astryxdesign/core';

export const Types = () => (
  <VStack gap={2} align="start" width={420}>
    <Text type="display-1">주간보호센터 근무표</Text>
    <Text type="display-2">이번 달 출근 인원 24명</Text>
    <Text type="large">오늘 일정 3건이 등록돼 있습니다.</Text>
    <Text type="body">
      요양보호사 김영희 님이 8월 21일 하루 휴무를 신청했습니다. 같은 날 휴무 인원은 정원 3명 중 2명입니다.
    </Text>
    <Text type="label">담당자</Text>
    <Text type="supporting">저장하지 않고 나가면 입력한 내용이 사라집니다.</Text>
  </VStack>
);

export const Colors = () => (
  <VStack gap={1.5} align="start">
    <Text type="body" color="primary">기본 본문 — 근무표가 저장되었습니다</Text>
    <Text type="body" color="secondary">보조 설명 — 마지막 수정 8월 12일</Text>
    <Text type="body" color="accent">강조 — 오늘 휴무 2명</Text>
    <Text type="body" color="disabled">비활성 — 지난 달 자료는 수정할 수 없습니다</Text>
  </VStack>
);

export const Weights = () => (
  <VStack gap={1.5} align="start">
    <Text type="body" weight="normal">보통 — 요양보호사 김영희</Text>
    <Text type="body" weight="medium">중간 — 요양보호사 김영희</Text>
    <Text type="body" weight="semibold">약간 굵게 — 요양보호사 김영희</Text>
    <Text type="body" weight="bold">굵게 — 요양보호사 김영희</Text>
  </VStack>
);

export const Truncation = () => (
  <VStack gap={2} align="start" width={280}>
    <Text type="body" maxLines={1}>
      한 줄로 자릅니다 — 8월 21일 목요일 오후 2시 어르신 생신잔치 준비 및 프로그램실 정리
    </Text>
    <Text type="body" maxLines={2}>
      두 줄로 자릅니다 — 8월 21일 목요일 오후 2시 어르신 생신잔치 준비 및 프로그램실 정리, 담당 요양보호사 3명 배정 필요
    </Text>
  </VStack>
);

export const TabularNumbers = () => (
  <VStack gap={1} align="start">
    <HStack gap={4}>
      <Text type="body" hasTabularNumbers>출근 24명</Text>
      <Text type="body" hasTabularNumbers>휴무 2명</Text>
    </HStack>
    <HStack gap={4}>
      <Text type="body" hasTabularNumbers>출근 108명</Text>
      <Text type="body" hasTabularNumbers>휴무 11명</Text>
    </HStack>
  </VStack>
);
