import { Link, VStack, HStack, Text } from '@astryxdesign/core';

export const Basic = () => (
  <VStack gap={2} align="start">
    <Link href="#">월간일정 전체보기</Link>
    <Link href="#">휴무 신청 내역</Link>
    <Link href="#">전자결재 문서함</Link>
  </VStack>
);

export const InSentence = () => (
  <div style={{ width: 380 }}>
    <Text type="body">
      이번 달 휴무 신청은 8월 25일에 마감됩니다. 자세한 내용은 <Link href="#">공지사항</Link>에서 확인하세요.
    </Text>
  </div>
);

export const External = () => (
  <HStack gap={3}>
    <Link href="https://silverithm.site" target="_blank">케어브이 홈페이지</Link>
    <Link href="#">이용 가이드</Link>
  </HStack>
);
