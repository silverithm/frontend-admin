import { ClickableCard, VStack, HStack, Text, Badge } from '@astryxdesign/core';

export const Basic = () => (
  <div style={{ width: 320 }}>
    <ClickableCard label="8월 근무표 열기" onClick={() => {}}>
      <VStack gap={0.5} align="start">
        <Text type="body" weight="bold">8월 근무표</Text>
        <Text type="supporting" color="secondary">등록 24건 · 마지막 수정 8월 12일</Text>
      </VStack>
    </ClickableCard>
  </div>
);

export const List = () => (
  <VStack gap={2} width={340}>
    <ClickableCard label="연차 신청 열기" onClick={() => {}}>
      <HStack hAlign="between" vAlign="center" width="100%">
        <Text type="body" weight="medium">연차 신청 — 김영희</Text>
        <Badge variant="orange" label="대기" />
      </HStack>
      <Text type="supporting" color="secondary">8월 21일(목) 하루</Text>
    </ClickableCard>
    <ClickableCard label="차량 운행일지 열기" onClick={() => {}}>
      <HStack hAlign="between" vAlign="center" width="100%">
        <Text type="body" weight="medium">차량 운행일지 — 이철수</Text>
        <Badge variant="teal" label="승인" />
      </HStack>
      <Text type="supporting" color="secondary">8월 12일 제출</Text>
    </ClickableCard>
  </VStack>
);
