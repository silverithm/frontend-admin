// 공용 SEO 상수/헬퍼.
// Next.js는 하위 layout이 openGraph를 선언하면 상위의 openGraph를 통째로 대체한다.
// (images가 상속되지 않으므로 각 layout에서 이 상수를 명시적으로 펼쳐 써야 한다.)

export const SITE_URL = 'https://carev.kr';

export const OG_IMAGE = {
  url: `${SITE_URL}/images/og-carev.png`,
  width: 1200,
  height: 630,
  alt: '케어브이 - 주간보호센터·장기요양기관 운영 플랫폼 (근무조정·월간일정·전자결재·공지·채팅)',
  type: 'image/png',
} as const;

export const OG_IMAGES = [OG_IMAGE];

/**
 * BreadcrumbList 구조화 데이터.
 * 검색 결과에 "케어브이 > 블로그 > 글제목" 형태의 경로가 노출되어 클릭률을 높인다.
 * 홈은 항상 첫 항목으로 붙이므로 호출부는 하위 경로만 넘긴다.
 */
export function buildBreadcrumbJsonLd(
  trail: Array<{ name: string; path: string }>
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '홈', item: SITE_URL },
      ...trail.map((entry, index) => ({
        '@type': 'ListItem',
        position: index + 2,
        name: entry.name,
        item: `${SITE_URL}${entry.path}`,
      })),
    ],
  };
}

/** JSON-LD를 <script>로 심을 때 쓰는 props. XSS 방지를 위해 </script> 시퀀스를 이스케이프한다. */
export function jsonLdScriptProps(data: unknown) {
  return {
    type: 'application/ld+json',
    dangerouslySetInnerHTML: {
      __html: JSON.stringify(data).replace(/</g, '\\u003c'),
    },
  } as const;
}
