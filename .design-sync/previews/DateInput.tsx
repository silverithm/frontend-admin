import { DateInput, VStack } from '@astryxdesign/core';

export const Basic = () => (
  <div style={{ width: 280 }}>
    <DateInput label="휴무 날짜" value="2026-08-21" onChange={() => {}} />
  </div>
);

export const States = () => (
  <VStack gap={3} width={280}>
    <DateInput label="시작일" value="2026-08-01" onChange={() => {}} />
    <DateInput label="마감일" value="" onChange={() => {}} />
    <DateInput label="확정일" value="2026-07-31" isDisabled onChange={() => {}} />
  </VStack>
);
