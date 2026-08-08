import { Metadata } from 'next'
import { FAQ_DATA } from '@/lib/faqData'
import { OG_IMAGES, SITE_URL, buildBreadcrumbJsonLd, jsonLdScriptProps } from '@/lib/seo'

export const metadata: Metadata = {
  title: '자주 묻는 질문',
  description: '케어브이 이용 요금, 가입 방법, 지원 시설 종류 등 요양기관 근무표 프로그램에 대해 가장 많이 묻는 질문을 모았습니다.',
  keywords: '케어브이 FAQ, 요양기관 근무표 질문, 주간보호센터 프로그램 문의, 장기요양기관 스케줄 관리, 근무표 프로그램 요금',
  openGraph: {
    title: '자주 묻는 질문 | 케어브이',
    description: '케어브이 이용 요금, 가입 방법, 지원 시설 종류 등 가장 많이 묻는 질문을 모았습니다.',
    url: `${SITE_URL}/faq`,
    type: 'website',
    images: OG_IMAGES,
  },
  alternates: {
    canonical: '/faq',
  },
}

// FAQPage 구조화 데이터는 실제 FAQ가 있는 이 경로에서만 노출한다.
// 질문/답변은 화면과 같은 소스(@/lib/faqData)에서 생성한다 — 구글 FAQPage 정책상
// 구조화 데이터와 페이지에 보이는 내용이 어긋나면 리치 결과가 무효 처리된다.
const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  '@id': `${SITE_URL}/faq#faq`,
  inLanguage: 'ko-KR',
  mainEntity: FAQ_DATA.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.answer,
    },
  })),
}

const breadcrumbJsonLd = buildBreadcrumbJsonLd([
  { name: '자주 묻는 질문', path: '/faq' },
])

export default function FaqLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <script {...jsonLdScriptProps(faqJsonLd)} />
      <script {...jsonLdScriptProps(breadcrumbJsonLd)} />
      {children}
    </>
  )
}
