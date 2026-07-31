import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import SubscriptionGuard from '@/components/SubscriptionGuard'
import { AstryxProvider } from './AstryxProvider'

const inter = Inter({ subsets: ['latin'] })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#10B981',
}

export const metadata: Metadata = {
  title: {
    default: '케어브이 - 주간보호센터, 장기요양기관 근무표',
    template: '%s | 케어브이',
  },
  description: '근무표 작성, 이제 5분이면 끝! 복잡한 일정 관리를 간단하게 해결하세요.',
  keywords: '주간보호센터, 장기요양기관, 장기요양, 주간보호, 요양기관, 요양원, 요양병원, 요양보호사, 사회복지사, 근무표, 휴무관리, 인력관리, 스케줄관리, 휴가신청, 근태관리, 노인장기요양, 노인요양, 재가요양, 방문요양, 요양시설, 데이케어센터, 재가노인복지센터, 노인복지관, 치매안심센터, 실버케어, 노인돌봄, 장기요양보험, 요양보호사자격증, 사회복지시설, 노인복지시설, 재가급여, 시설급여, 복지용구, 간호조무사, 물리치료사, 작업치료사',
  authors: [{ name: '케어브이' }],
  creator: '케어브이',
  publisher: '케어브이',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://carev.kr'),
  openGraph: {
    title: '케어브이 - 주간보호센터, 장기요양기관 근무표',
    description: '근무표 작성, 이제 5분이면 끝! 복잡한 일정 관리를 간단하게 해결하세요.',
    url: 'https://carev.kr',
    siteName: '케어브이',
    images: [
      {
        url: 'https://carev.kr/images/og-carev.png',
        width: 1200,
        height: 630,
        alt: '케어브이 - 주간보호센터, 장기요양기관 근무표 휴무관리 프로그램',
        type: 'image/png',
      }
    ],
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '케어브이',
    description: '근무표 작성, 이제 5분이면 끝! 복잡한 일정 관리를 간단하게 해결하세요.',
    images: ['https://carev.kr/images/og-carev.png'],
    creator: '@carev_kr',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    // Google Search Console (URL 접두어 속성 https://carev.kr/) HTML 태그 인증값.
    // 소유권 확인 후에도 태그를 제거하면 인증이 해제되므로 유지할 것.
    google:
      process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ||
      'qIpL5P0E2iuj6-dd_R5MBmZQqriX73Qv-5KX9XxVlTI',
    other: {
      'naver-site-verification': '58069dba17e679f9ee99b6e6cef839633dac960e',
    },
  },
  alternates: {
    // 하위 페이지는 각자의 layout에서 canonical을 덮어쓴다.
    canonical: '/',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': 'https://carev.kr/#organization',
    name: '케어브이',
    alternateName: ['CareV', '케어브이'],
    url: 'https://carev.kr',
    logo: {
      '@type': 'ImageObject',
      '@id': 'https://carev.kr/#logo',
      url: 'https://carev.kr/images/carev-logo-text.png',
      contentUrl: 'https://carev.kr/images/carev-logo-text.png',
      width: 2048,
      height: 1000,
      caption: '케어브이 로고',
      representativeOfPage: true,
      inLanguage: 'ko-KR'
    },
    image: 'https://carev.kr/images/carev-logo-text.png',
    description: '주간보호센터, 장기요양기관, 요양원 근무표 작성 서비스',
    foundingDate: '2024',
    areaServed: {
      '@type': 'Country',
      name: '대한민국'
    },
    serviceType: ['주간보호센터 관리', '장기요양기관 관리', '근무표 작성', '휴무 관리'],
    telephone: '010-4549-2094',
    email: 'ggprgrkjh2@gmail.com',
    address: {
      '@type': 'PostalAddress',
      streetAddress: '신림동 1547-10',
      addressLocality: '관악구',
      addressRegion: '서울특별시',
      postalCode: '08706',
      addressCountry: 'KR'
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      telephone: '010-4549-2094',
      email: 'ggprgrkjh2@gmail.com',
      areaServed: 'KR',
      availableLanguage: 'Korean'
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': 'https://carev.kr'
    }
  }

  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': 'https://carev.kr/#website',
    name: '케어브이',
    alternateName: 'CareV',
    url: 'https://carev.kr',
    description: '주간보호센터, 장기요양기관, 요양원 근무표 작성 서비스',
    publisher: {
      '@id': 'https://carev.kr/#organization'
    },
    inLanguage: 'ko-KR'
  }

  const softwareJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': 'https://carev.kr/#software',
    name: '케어브이',
    alternateName: 'CareV',
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: '근무표·인력관리',
    operatingSystem: 'Web, iOS, Android',
    url: 'https://carev.kr',
    description: '주간보호센터, 장기요양기관, 요양원, 재가노인복지센터를 위한 근무표 작성 및 휴무관리 솔루션',
    inLanguage: 'ko-KR',
    image: 'https://carev.kr/images/og-carev.png',
    publisher: {
      '@id': 'https://carev.kr/#organization'
    },
    offers: {
      '@type': 'Offer',
      price: '9900',
      priceCurrency: 'KRW',
      category: '월 구독',
      url: 'https://carev.kr/subscription',
      availability: 'https://schema.org/InStock'
    },
    featureList: [
      '요양기관 근무표 작성 및 자동 배정',
      '휴무 신청과 승인 관리',
      '월간 일정 및 수행완료 진행도 관리',
      '전자결재',
      '직원 실시간 소통'
    ],
    audience: {
      '@type': 'BusinessAudience',
      audienceType: '주간보호센터, 장기요양기관, 요양원, 재가노인복지센터'
    }
  }

  return (
    <html lang="ko">
      <body className={inter.className}>
        {/* 구조화 데이터 — head 중복 렌더를 피하기 위해 body에서 한 번만 출력 */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }}
        />
        <AstryxProvider>
          <SubscriptionGuard>
            {children}
          </SubscriptionGuard>
        </AstryxProvider>
      </body>
    </html>
  )
}