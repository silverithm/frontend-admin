'use client';

import { Text } from '@astryxdesign/core/Text';
import { Link } from '@astryxdesign/core/Link';
import { VStack } from '@astryxdesign/core/Stack';
import { EXTERNAL_LINKS } from '@/lib/externalLinks';

/**
 * 연계기관 바로가기 — 관리자·직원 사이드바 공용.
 * 업무 중 오가는 외부 사이트를 새 탭으로 연다 (Astryx Link의 isExternalLink가 rel 토큰을 붙인다).
 */
export default function ExternalLinksNav() {
  return (
    <div style={{ padding: 'var(--spacing-2) var(--spacing-3)' }}>
      <VStack gap={1} align="start">
        <Text as="p" type="supporting" weight="semibold" color="secondary">연계기관</Text>
        {EXTERNAL_LINKS.map((link) => (
          <Link
            key={link.url}
            href={link.url}
            isExternalLink
            isStandalone
            color="secondary"
            tooltip={link.description}
          >
            {link.name}
          </Link>
        ))}
      </VStack>
    </div>
  );
}
