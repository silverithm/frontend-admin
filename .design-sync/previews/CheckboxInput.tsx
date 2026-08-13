import { CheckboxInput, VStack } from '@astryxdesign/core';

export const Basic = () => (
  <VStack gap={2} align="start">
    <CheckboxInput label="직원 앱에 알림 보내기" value onChange={() => {}} />
    <CheckboxInput label="종일 일정" value={false} onChange={() => {}} />
    <CheckboxInput label="다음 달 휴무만 신청받기" value={false} isDisabled onChange={() => {}} />
  </VStack>
);

export const TaskList = () => (
  <VStack gap={2} align="start" width={300}>
    <CheckboxInput label="프로그램실 정리 — 김영희" value onChange={() => {}} />
    <CheckboxInput label="간식 준비 — 박민수" value onChange={() => {}} />
    <CheckboxInput label="차량 점검 — 이철수" value={false} onChange={() => {}} />
  </VStack>
);
