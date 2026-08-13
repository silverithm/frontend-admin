import { EmptyState, Icon, Button, VStack } from '@astryxdesign/core';

export const Basic = () => (
  <div style={{ width: 420 }}>
    <EmptyState
      icon={<Icon icon="calendar" size="lg" color="tertiary" />}
      title="8월 21일 일정이 없습니다"
      description="이 날짜에 등록된 일정이 아직 없습니다."
    />
  </div>
);

export const WithAction = () => (
  <div style={{ width: 420 }}>
    <EmptyState
      icon={<Icon icon="calendar" size="lg" color="tertiary" />}
      title="등록된 일정이 없습니다"
      description="첫 일정을 만들어 이번 달 근무표를 시작해 보세요."
      actions={<Button label="일정 추가" variant="primary" size="sm" />}
    />
  </div>
);

export const Compact = () => (
  <VStack gap={3} width={260}>
    <EmptyState isCompact icon={<Icon icon="search" size="lg" color="tertiary" />} title="검색 결과가 없습니다" />
    <EmptyState isCompact title="대화방이 없습니다" description="직원을 누르면 1:1 대화가 열립니다." />
  </VStack>
);
