import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import SubscriptionGuard from '@/components/SubscriptionGuard'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '케어브이 - 주간보호센터, 장기요양기관 근무표 작성 서비스',
  description: '주간보호센터, 장기요양기관, 요양원 근무표 작성 서비스',
  keywords: '주간보호센터, 장기요양기관, 장기요양, 주간보호, 요양기관, 요양원, 요양병원, 요양보호사, 근무표, 휴무관리, 인력관리, 스케줄관리, 휴가신청, 근태관리, 노인장기요양, 노인요양, 재가요양, 방문요양, 요양시설, 데이케어센터',
  metadataBase: new URL('https://carev.kr'),
  openGraph: {
    title: '케어브이',
    description: '주간보호센터, 장기요양기관, 요양원 근무표 작성 서비스',
    url: 'https://carev.kr',
    siteName: '케어브이',
    images: [
      {
        url: '/images/carev-logo-text.png',
        width: 1200,
        height: 630,
        alt: '케어브이 - 주간보호센터, 장기요양기관 근무표 휴무관리 프로그램',
      }
    ],
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '케어브이',
    description: '주간보호센터, 장기요양기관, 요양원 근무표 작성 서비스',
    images: ['/images/carev-logo-text.png'],
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
    google: 'google-site-verification=your-google-verification-code', // Google Search Console에서 발급받은 코드로 교체 필요
    other: {
      'naver-site-verification': '58069dba17e679f9ee99b6e6cef839633dac960e',
    },
  },
  alternates: {
    canonical: 'https://carev.kr',
  },
  icons: {
    icon: [
      { url: '/images/carev-favicon.png', type: 'image/png', sizes: '32x32' },
      { url: '/images/carev-logo-text.png', type: 'image/png', sizes: '192x192' },
    ],
    shortcut: '/images/carev-favicon.png',
    apple: [
      { url: '/images/carev-favicon.png', sizes: '180x180' },
    ],
    other: [
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '16x16',
        url: '/images/carev-favicon.png',
      },
      {
        rel: 'icon',
        type: 'image/png', 
        sizes: '32x32',
        url: '/images/carev-favicon.png',
      },
      {
        rel: 'apple-touch-icon',
        sizes: '180x180',
        url: '/images/carev-favicon.png',
      },
    ],
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
    alternateName: ['CareV', '케어베이션'],
    url: 'https://carev.kr',
    logo: {
      '@type': 'ImageObject',
      '@id': 'https://carev.kr/#logo',
      url: 'https://carev.kr/images/carev-logo-text.png',
      contentUrl: 'https://carev.kr/images/carev-logo-text.png',
      width: 1200,
      height: 630,
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
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
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
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://carev.kr/search?q={search_term_string}'
      },
      'query-input': 'required name=search_term_string'
    },
    inLanguage: 'ko-KR'
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: '홈',
        item: 'https://carev.kr'
      }
    ]
  }

  return (
    <html lang="ko">
      <head>
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
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
        />
      </head>
      <body className={inter.className}>
        <SubscriptionGuard>
          {children}
        </SubscriptionGuard>
      </body>
    </html>
  )
}