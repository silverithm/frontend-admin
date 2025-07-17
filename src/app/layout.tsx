import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

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
    google: '', // Google Search Console 인증 코드 추가 필요
    other: {
      'naver-site-verification': '58069dba17e679f9ee99b6e6cef839633dac960e',
    },
  },
  alternates: {
    canonical: 'https://carev.kr',
  },
  icons: {
    icon: [
      { url: '/images/carev-favicon.png', type: 'image/png' },
    ],
    shortcut: '/images/carev-favicon.png',
    apple: '/images/carev-favicon.png',
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
    name: '케어브이',
    url: 'https://carev.kr',
    logo: 'https://carev.kr/images/carev-logo-text.png',
    description: '주간보호센터, 장기요양기관, 요양원 근무표 작성 서비스',
    sameAs: [],
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '',
      contactType: 'customer service',
      areaServed: 'KR',
      availableLanguage: 'Korean'
    }
  }

  return (
    <html lang="ko">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  )
}