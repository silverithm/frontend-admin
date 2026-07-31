import { Metadata } from 'next'
import { OG_IMAGES } from '@/lib/seo'

export const metadata: Metadata = {
  title: '자주 묻는 질문',
  description: '케어브이 이용 요금, 가입 방법, 지원 시설 종류 등 요양기관 근무표 프로그램에 대해 가장 많이 묻는 질문을 모았습니다.',
  keywords: '케어브이 FAQ, 요양기관 근무표 질문, 주간보호센터 프로그램 문의, 장기요양기관 스케줄 관리, 근무표 프로그램 요금',
  openGraph: {
    title: '자주 묻는 질문 | 케어브이',
    description: '케어브이 이용 요금, 가입 방법, 지원 시설 종류 등 가장 많이 묻는 질문을 모았습니다.',
    url: 'https://carev.kr/faq',
    type: 'website',
    images: OG_IMAGES,
  },
  alternates: {
    canonical: '/faq',
  },
}

// FAQPage 구조화 데이터는 실제 FAQ가 있는 이 경로에서만 노출한다.
const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  '@id': 'https://carev.kr/faq#faq',
  mainEntity: [
    {
      '@type': 'Question',
      name: '케어브이는 어떤 요양시설에서 사용할 수 있나요?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '주간보호센터, 장기요양기관, 요양원, 요양병원, 재가노인복지센터, 노인복지관, 치매안심센터 등 모든 노인복지시설에서 사용 가능합니다.'
      }
    },
    {
      '@type': 'Question',
      name: '요양보호사와 사회복지사 모두 사용할 수 있나요?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '네, 요양보호사, 사회복지사, 간호조무사, 물리치료사, 작업치료사 등 모든 직원이 사용할 수 있습니다.'
      }
    },
    {
      '@type': 'Question',
      name: '장기요양보험 시설에서도 사용 가능한가요?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '네, 장기요양보험 지정 시설급여 및 재가급여 기관 모두에서 사용 가능합니다.'
      }
    }
  ]
}

export default function FaqLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      {children}
    </>
  )
}
