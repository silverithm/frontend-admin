import { Metadata } from 'next'
import { OG_IMAGES, SITE_URL, buildBreadcrumbJsonLd, jsonLdScriptProps } from '@/lib/seo'

export const metadata: Metadata = {
  title: '이용 가이드',
  description: '가입부터 직원 등록, 근무표 작성, 휴무 승인, 전자결재까지 케어브이 사용법을 관리자·직원 입장별로 단계마다 안내합니다.',
  keywords: '케어브이 사용법, 요양기관 근무표 작성 방법, 주간보호센터 스케줄 관리 가이드, 휴무 승인 절차, 장기요양기관 인력관리',
  openGraph: {
    title: '이용 가이드 | 케어브이',
    description: '가입부터 직원 등록, 근무표 작성, 휴무 승인까지 케어브이 사용법을 단계별로 안내합니다.',
    url: `${SITE_URL}/guide`,
    type: 'article',
    images: OG_IMAGES,
  },
  alternates: {
    canonical: '/guide',
  },
}

const breadcrumbJsonLd = buildBreadcrumbJsonLd([
  { name: '이용 가이드', path: '/guide' },
])

export default function GuideLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <script {...jsonLdScriptProps(breadcrumbJsonLd)} />
      {children}
    </>
  )
}
