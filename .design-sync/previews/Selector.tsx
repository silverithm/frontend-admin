import { Selector, VStack } from '@astryxdesign/core';

const ROLES = [
  { value: 'caregiver', label: '요양보호사' },
  { value: 'social', label: '사회복지사' },
  { value: 'nurse', label: '간호사' },
  { value: 'driver', label: '운전원' },
];

export const Basic = () => (
  <div style={{ width: 280 }}>
    <Selector label="직종" options={ROLES} value="caregiver" onChange={() => {}} />
  </div>
);

export const Placeholder = () => (
  <VStack gap={3} width={280}>
    <Selector label="담당자" options={ROLES} value="" placeholder="담당자를 고르세요" onChange={() => {}} />
    <Selector label="휴무 종류" options={[
      { value: 'regular', label: '일반휴무' },
      { value: 'annual', label: '연차' },
      { value: 'half_am', label: '오전반차' },
    ]} value="annual" hasClear onChange={() => {}} />
  </VStack>
);
