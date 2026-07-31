'use client';

import { Text } from '@astryxdesign/core/Text';
import { Link } from '@astryxdesign/core/Link';
import { Icon } from '@astryxdesign/core/Icon';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { IconExternalLink } from '@tabler/icons-react';
import { EXTERNAL_LINKS } from '@/lib/externalLinks';

/**
 * 연계기관 바로가기 — 관리자·직원 사이드바 공용.
 *
 * 사이드바 메뉴는 Button(onClick)이지만 여기는 외부 주소라 실제 앵커여야 한다
 * (새 탭·가운데 클릭·주소 복사가 되어야 하므로). 그래서 Link를 쓰되 폭·정렬·
 * hover를 메뉴 버튼과 같게 맞춰 시각적으로 한 덩어리로 보이게 한다.
 * isExternalLink 대신 target="_blank"를 쓰는 이유: isExternalLink는 라벨 뒤에 외부
 * 아이콘을 덧붙이는데 좁은 사이드바에서 줄바꿈돼 항목이 두 줄이 된다. rel의
 * noopener noreferrer는 target="_blank"만으로도 Astryx가 자동으로 붙여준다.
 */
export default function ExternalLinksNav() {
  return (
    <VStack gap={0} align="stretch">
      <div style={{ padding: 'var(--spacing-1) var(--spacing-3)' }}>
        <Text as="p" type="supporting" weight="semibold" color="secondary">연계기관</Text>
      </div>
      {EXTERNAL_LINKS.map((link) => (
        <Link
          key={link.url}
          href={link.url}
          target="_blank"
          isStandalone
          color="secondary"
          tooltip={link.description}
          className="carev-sidenav-extlink"
        >
          <HStack gap={2} vAlign="center">
            <Icon icon={IconExternalLink} size="sm" color="secondary" />
            <Text type="body" color="secondary">{link.name}</Text>
          </HStack>
        </Link>
      ))}
    </VStack>
  );
}
