import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import SubscriptionGuard from '@/components/SubscriptionGuard'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '케어브이 - 주간보호센터, 장기요양기관 근무표',
  description: '근무표 작성, 이제 5분이면 끝! 복잡한 일정 관리를 간단하게 해결하세요.',
  keywords: '주간보호센터, 장기요양기관, 장기요양, 주간보호, 요양기관, 요양원, 요양병원, 요양보호사, 근무표, 휴무관리, 인력관리, 스케줄관리, 휴가신청, 근태관리, 노인장기요양, 노인요양, 재가요양, 방문요양, 요양시설, 데이케어센터',
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
        url: 'https://carev.kr/images/carev-logo-text.png',
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
    images: ['https://carev.kr/images/carev-logo-text.png'],
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
    google: 'google-site-verification=your-google-verification-code',
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
        {/* 서버사이드 메타 태그 - 크롤러를 위한 정적 태그들 */}
        <title>케어브이</title>
        <meta name="description" content="근무표 작성, 이제 5분이면 끝! 복잡한 일정 관리를 간단하게 해결하세요." />
        <meta name="keywords" content="주간보호센터, 장기요양기관, 장기요양, 주간보호, 요양기관, 요양원, 요양병원, 요양보호사, 근무표, 휴무관리, 인력관리, 스케줄관리, 휴가신청, 근태관리, 노인장기요양, 노인요양, 재가요양, 방문요양, 요양시설, 데이케어센터" />
        <meta name="author" content="케어브이" />
        <meta name="robots" content="index, follow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        
        {/* Open Graph 메타 태그 */}
        <meta property="og:title" content="케어브이" />
        <meta property="og:description" content="근무표 작성, 이제 5분이면 끝! 복잡한 일정 관리를 간단하게 해결하세요." />
        <meta property="og:url" content="https://carev.kr" />
        <meta property="og:site_name" content="케어브이" />
        <meta property="og:image" content="https://carev.kr/images/carev-logo-text.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="케어브이 - 주간보호센터, 장기요양기관 근무표 휴무관리 프로그램" />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="ko_KR" />
        
        {/* Twitter Card 메타 태그 */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="케어브이" />
        <meta name="twitter:description" content="근무표 작성, 이제 5분이면 끝! 복잡한 일정 관리를 간단하게 해결하세요." />
        <meta name="twitter:image" content="https://carev.kr/images/carev-logo-text.png" />
        <meta name="twitter:creator" content="@carev_kr" />
        
        {/* 카카오톡 미리보기를 위한 추가 메타태그 */}
        <meta property="og:image:secure_url" content="https://carev.kr/images/carev-logo-text.png" />
        <meta property="og:image:type" content="image/png" />
        <meta property="article:author" content="케어브이" />
        <meta property="article:publisher" content="케어브이" />
        <meta name="application-name" content="케어브이" />
        
        {/* 카카오톡 전용 추가 설정 */}
        <meta property="og:rich_attachment" content="true" />
        <meta name="format-detection" content="telephone=no" />
        
        {/* 모바일 앱 연동을 위한 메타태그 */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="케어브이" />
        
        {/* 검색엔진 최적화를 위한 추가 태그 */}
        <meta name="subject" content="휴무관리 서비스" />
        <meta name="classification" content="Business" />
        <meta name="category" content="휴무관리,근무표,장기요양,주간보호" />
        <meta name="coverage" content="Worldwide" />
        <meta name="distribution" content="Global" />
        <meta name="rating" content="General" />
        <meta name="revisit-after" content="7 days" />
        
        {/* 소셜 미디어 최적화 */}
        <meta property="fb:app_id" content="케어브이" />
        <meta name="pinterest-rich-pin" content="true" />
        
        {/* 추가 메타 태그 */}
        <meta name="theme-color" content="#10B981" />
        <meta name="msapplication-TileColor" content="#10B981" />
        <link rel="canonical" href="https://carev.kr" />
        
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