import { Metadata } from 'next'
import { OG_IMAGES, SITE_URL, buildBreadcrumbJsonLd, jsonLdScriptProps } from '@/lib/seo'

// 이 layout이 없으면 /plaza가 루트 layout의 canonical('/')을 그대로 상속해
// 검색엔진이 홈의 중복 페이지로 판단하고 색인에서 제외한다. sitemap에 넣어도 소용이 없다.
export const metadata: Metadata = {
  // 루트 template('%s | 케어브이')이 브랜드를 붙이므로 여기서는 반복하지 않는다.
  title: '커뮤니티 — 요양 소식·게시판·자료실',
  description:
    '장기요양기관 종사자를 위한 공개 커뮤니티. 요양 뉴스와 제도 소식, 기관 운영 노하우를 나누는 게시판, 서식·자료실을 로그인 없이 둘러볼 수 있습니다.',
  keywords:
    '요양기관 커뮤니티, 장기요양 소식, 요양 뉴스, 요양보호사 커뮤니티, 주간보호센터 정보, 장기요양기관 게시판, 요양 서식 자료실, 사회복지사 커뮤니티',
  openGraph: {
    title: '케어브이 커뮤니티 — 요양 소식·게시판·자료실',
    description:
      '요양 뉴스와 제도 소식, 기관 운영 노하우 게시판, 서식 자료실. 장기요양기관 종사자를 위한 공개 커뮤니티입니다.',
    url: `${SITE_URL}/plaza`,
    type: 'website',
    images: OG_IMAGES,
  },
  alternates: {
    canonical: '/plaza',
  },
}

const collectionJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  '@id': `${SITE_URL}/plaza#collection`,
  name: '케어브이 커뮤니티',
  description: '장기요양기관 종사자를 위한 요양 소식·게시판·자료실 공개 커뮤니티',
  url: `${SITE_URL}/plaza`,
  inLanguage: 'ko-KR',
  isPartOf: { '@id': `${SITE_URL}/#website` },
  publisher: { '@id': `${SITE_URL}/#organization` },
}

const breadcrumbJsonLd = buildBreadcrumbJsonLd([
  { name: '커뮤니티', path: '/plaza' },
])

export default function PlazaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <script {...jsonLdScriptProps(collectionJsonLd)} />
      <script {...jsonLdScriptProps(breadcrumbJsonLd)} />
      {children}
    </>
  )
}
