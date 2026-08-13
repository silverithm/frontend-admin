import { Heading, VStack } from '@astryxdesign/core';

export const Levels = () => (
  <VStack gap={2} align="start" width={420}>
    <Heading level={1}>케어브이 관리자</Heading>
    <Heading level={2}>이번 달 근무표</Heading>
    <Heading level={3}>휴무 신청 현황</Heading>
    <Heading level={4}>오늘 일정</Heading>
    <Heading level={5}>담당 업무</Heading>
    <Heading level={6}>비고</Heading>
  </VStack>
);

export const DisplayTypes = () => (
  <VStack gap={2} align="start" width={420}>
    <Heading level={1} type="display-1">주간보호센터 근무 관리</Heading>
    <Heading level={2} type="display-2">한 화면에서 끝내는 근무표</Heading>
    <Heading level={3} type="display-3">일정과 휴무를 같이 봅니다</Heading>
  </VStack>
);
