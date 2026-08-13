import { Switch, VStack } from '@astryxdesign/core';

export const Basic = () => (
  <VStack gap={3} width={320}>
    <Switch label="휴무 입력 마감일 사용" value onChange={() => {}} labelPosition="start" labelSpacing="spread" />
    <Switch label="다음 달 휴무만 신청받기" value={false} onChange={() => {}} labelPosition="start" labelSpacing="spread" />
    <Switch label="주말 배차 운행" value={false} isDisabled onChange={() => {}} labelPosition="start" labelSpacing="spread" />
  </VStack>
);

export const Inline = () => (
  <VStack gap={2} align="start">
    <Switch label="알림 받기" value onChange={() => {}} />
    <Switch label="이메일로도 받기" value={false} onChange={() => {}} />
  </VStack>
);
