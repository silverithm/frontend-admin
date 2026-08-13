import { Banner, Button, VStack } from '@astryxdesign/core';

export const Statuses = () => (
  <VStack gap={2} width={460}>
    <Banner status="info" title="이번 달 휴무 신청은 8월 25일에 마감됩니다" />
    <Banner status="success" title="근무표가 저장되었습니다" description="직원 앱에도 바로 반영됩니다." />
    <Banner status="warning" title="휴무 정원이 찼습니다" description="8월 21일은 이미 3명이 신청했습니다." />
    <Banner status="error" title="근무표를 불러오지 못했습니다" description="잠시 후 다시 시도해 주세요." />
  </VStack>
);

export const WithAction = () => (
  <VStack gap={2} width={460}>
    <Banner
      status="error"
      title="직원 목록을 불러오지 못했습니다"
      endContent={<Button label="다시 시도" variant="secondary" size="sm" />}
    />
    <Banner
      status="warning"
      title="배차 설정이 필요합니다"
      description="노선과 담당 직원을 먼저 등록해 주세요."
      endContent={<Button label="설정하러 가기" variant="primary" size="sm" />}
    />
  </VStack>
);

export const Dismissable = () => (
  <div style={{ width: 460 }}>
    <Banner status="info" title="새 공지가 등록되었습니다" description="광장에서 확인할 수 있습니다." isDismissable />
  </div>
);
