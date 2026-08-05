'use client';

import { useState, useEffect } from 'react';
import { Text } from '@astryxdesign/core/Text';
import { Link } from '@astryxdesign/core/Link';
import { Icon } from '@astryxdesign/core/Icon';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { IconExternalLink, IconHome } from '@tabler/icons-react';
import { EXTERNAL_LINKS } from '@/lib/externalLinks';
import { getCompanyHomepage } from '@/lib/apiService';

/**
 * 기관이 등록한 홈페이지 주소. 기관 프로필에서 저장할 때 localStorage에 함께 넣고,
 * 같은 탭에서도 즉시 반영되도록 커스텀 이벤트를 듣는다(storage 이벤트는 다른 탭에서만 온다).
 */
function useCompanyHomepage(): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const read = () => {
      try {
        setUrl(localStorage.getItem('companyHomepageUrl') || null);
      } catch {
        setUrl(null);
      }
    };
    read();
    window.addEventListener('carev:company-homepage-changed', read);
    window.addEventListener('storage', read);

    // 로그인 응답에는 없는 값이라 서버에서 한 번 받아 캐시한다.
    // 실패해도 바로가기만 안 보일 뿐이라 화면을 방해하지 않는다.
    let alive = true;
    getCompanyHomepage()
      .then((data) => {
        if (!alive) return;
        const fetched: string | null = data?.homepageUrl ?? null;
        if (fetched) {
          localStorage.setItem('companyHomepageUrl', fetched);
        } else {
          localStorage.removeItem('companyHomepageUrl');
        }
        setUrl(fetched);
      })
      .catch(() => {
        // 조회 실패 시 캐시된 값을 그대로 쓴다
      });

    return () => {
      alive = false;
      window.removeEventListener('carev:company-homepage-changed', read);
      window.removeEventListener('storage', read);
    };
  }, []);

  return url;
}

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
  const companyHomepage = useCompanyHomepage();

  return (
    <VStack gap={0} align="stretch">
      {/* 우리 기관 홈페이지 — 등록했을 때만, 연계기관 위에 */}
      {companyHomepage && (
        <>
          <div style={{ padding: 'var(--spacing-1) var(--spacing-3)' }}>
            <Text as="p" type="supporting" weight="semibold" color="secondary">우리 기관</Text>
          </div>
          <Link
            href={companyHomepage}
            target="_blank"
            isStandalone
            color="secondary"
            tooltip={companyHomepage}
            className="carev-sidenav-extlink"
          >
            <HStack gap={2} vAlign="center">
              <Icon icon={IconHome} size="sm" color="secondary" />
              <Text type="body" color="secondary">기관 홈페이지</Text>
            </HStack>
          </Link>
        </>
      )}

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
