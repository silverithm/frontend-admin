import { IconButton, Icon, HStack } from '@astryxdesign/core';

export const Variants = () => (
  <HStack gap={2} vAlign="center">
    <IconButton label="닫기" variant="primary" icon={<Icon icon="close" size="sm" />} />
    <IconButton label="검색" variant="secondary" icon={<Icon icon="search" size="sm" />} />
    <IconButton label="더 보기" variant="ghost" icon={<Icon icon="moreHorizontal" size="sm" />} />
  </HStack>
);

export const Sizes = () => (
  <HStack gap={2} vAlign="center">
    <IconButton label="이전 달" size="sm" variant="secondary" icon={<Icon icon="chevronLeft" size="sm" />} />
    <IconButton label="이전 달" size="md" variant="secondary" icon={<Icon icon="chevronLeft" size="md" />} />
    <IconButton label="이전 달" size="lg" variant="secondary" icon={<Icon icon="chevronLeft" size="md" />} />
  </HStack>
);

export const MonthNav = () => (
  <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-inner)', width: 'fit-content' }}>
    <IconButton label="이전 달" variant="ghost" size="sm" icon={<Icon icon="chevronLeft" size="md" />} />
    <IconButton label="다음 달" variant="ghost" size="sm" icon={<Icon icon="chevronRight" size="md" />} />
  </div>
);
