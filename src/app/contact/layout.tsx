import { Metadata } from 'next'
import { OG_IMAGES, SITE_URL, buildBreadcrumbJsonLd, jsonLdScriptProps } from '@/lib/seo'

export const metadata: Metadata = {
  title: '문의하기',
  description: '케어브이 도입 상담, 기능 문의, 요금 안내를 남겨주세요. 주간보호센터·장기요양기관 담당자에게 안내해 드립니다.',
  keywords: '케어브이 문의, 요양기관 근무표 도입 상담, 주간보호센터 프로그램 문의, 장기요양기관 솔루션 상담',
  openGraph: {
    title: '문의하기 | 케어브이',
    description: '케어브이 도입 상담, 기능 문의, 요금 안내를 남겨주세요.',
    url: `${SITE_URL}/contact`,
    type: 'website',
    images: OG_IMAGES,
  },
  alternates: {
    canonical: '/contact',
  },
}

const contactJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ContactPage',
  '@id': `${SITE_URL}/contact#contact`,
  name: '케어브이 문의하기',
  description: '케어브이 도입 상담, 기능 문의, 요금 안내 창구',
  url: `${SITE_URL}/contact`,
  inLanguage: 'ko-KR',
  isPartOf: { '@id': `${SITE_URL}/#website` },
  mainEntity: { '@id': `${SITE_URL}/#organization` },
}

const breadcrumbJsonLd = buildBreadcrumbJsonLd([
  { name: '문의하기', path: '/contact' },
])

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <script {...jsonLdScriptProps(contactJsonLd)} />
      <script {...jsonLdScriptProps(breadcrumbJsonLd)} />
      {children}
    </>
  )
}
