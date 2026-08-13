import { TextArea, VStack } from '@astryxdesign/core';

export const Basic = () => (
  <div style={{ width: 380 }}>
    <TextArea
      label="공지 내용"
      value={'8월 근무표가 확정되었습니다.\n변경이 필요하면 8월 25일까지 알려주세요.'}
      onChange={() => {}}
    />
  </div>
);

export const States = () => (
  <VStack gap={3} width={380}>
    <TextArea label="휴무 사유" value="" placeholder="사유를 입력하세요" isRequired onChange={() => {}} />
    <TextArea label="반려 사유" value="인원이 부족합니다" isDisabled onChange={() => {}} />
  </VStack>
);
