import { TextInput, VStack } from '@astryxdesign/core';

export const Basic = () => (
  <VStack gap={3} width={320}>
    <TextInput label="이름" value="김영희" onChange={() => {}} />
    <TextInput label="이메일" type="email" value="" placeholder="name@carev.kr" onChange={() => {}} />
    <TextInput label="비밀번호" type="password" value="carev1234" onChange={() => {}} />
  </VStack>
);

export const WithClear = () => (
  <VStack gap={3} width={320}>
    <TextInput label="직원 검색" value="김영" placeholder="이름으로 찾기" hasClear onChange={() => {}} />
    <TextInput label="공지 제목" value="8월 근무표 안내" hasClear onChange={() => {}} />
  </VStack>
);

export const States = () => (
  <VStack gap={3} width={320}>
    <TextInput label="필수 입력" value="" isRequired placeholder="반드시 입력하세요" onChange={() => {}} />
    <TextInput
      label="이메일"
      value="carev.kr"
      status={{ type: 'error', message: '이메일 형식이 아닙니다' }}
      onChange={() => {}}
    />
    <TextInput label="기관 코드" value="CAREV-0001" isDisabled onChange={() => {}} />
  </VStack>
);
