import type { Metadata, Viewport } from 'next'
import { Figtree } from 'next/font/google'
import './globals.css'
import SubscriptionGuard from '@/components/SubscriptionGuard'
import { jsonLdScriptProps } from '@/lib/seo'
import { AstryxProvider } from './AstryxProvider'

/**
 * 브랜드 서체.
 *
 * 테마 토큰(--font-family-body/heading)이 'Figtree'를 첫 순위로 지정하는데 정작 로드하는 곳이
 * 없어서, Astryx Theme 래퍼 안의 모든 글자가 시스템 폰트로 대체되고 있었다. (그동안 받아오던
 * Inter는 Theme 래퍼의 font-family에 밀려 한 글자도 쓰이지 않았다.)
 * variable로 넘겨 토큰 스택과 이름이 어긋나지 않게 한다. 한글은 Figtree에 없으므로 스택 뒤쪽
 * 시스템 폰트가 그대로 받는다 — 바뀌는 것은 숫자·영문뿐이다.
 */
const figtree = Figtree({ subsets: ['latin'], display: 'swap', variable: '--font-figtree' })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#10B981',
}

export const metadata: Metadata = {
  title: {
    default: '케어브이 - 주간보호센터·장기요양기관 근무표, 전자결재, 운영 관리',
    template: '%s | 케어브이',
  },
  description:
    '주간보호센터·요양원·재가노인복지센터의 근무표와 휴무 관리, 전자결재(공문·결재선·서명), 월간일정, 공지·채팅, 요양 커뮤니티까지 하나로. 결제 수단 없이 30일 무료 체험.',
  // 검색엔진은 keywords를 순위에 쓰지 않는다. 수십 개를 나열하면 얻는 것 없이
  // 키워드 스터핑 신호만 남으므로, 실제로 이 사이트가 답하는 주제만 남긴다.
  keywords: [
    '주간보호센터 근무표',
    '장기요양기관 근무표',
    '요양원 근무표',
    '요양기관 인력관리',
    '요양보호사 휴무관리',
    '요양기관 전자결재',
    '주간보호센터 프로그램',
    '장기요양기관 운영 관리',
    '재가노인복지센터 관리',
    '요양기관 커뮤니티',
  ].join(', '),
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
    title: '케어브이 - 주간보호센터·장기요양기관 근무표, 전자결재, 운영 관리',
    description:
      '근무표·휴무 관리부터 전자결재(공문·결재선), 월간일정, 공지·채팅, 요양 커뮤니티까지. 장기요양기관 운영을 하나로.',
    url: 'https://carev.kr',
    siteName: '케어브이',
    images: [
      {
        url: 'https://carev.kr/images/og-carev.png',
        width: 1200,
        height: 630,
        alt: '케어브이 - 장기요양기관 근무표·휴무관리·전자결재·월간일정 운영 플랫폼',
        type: 'image/png',
      }
    ],
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '케어브이',
    description:
      '근무표·휴무 관리부터 전자결재, 월간일정, 요양 커뮤니티까지. 장기요양기관 운영을 하나로.',
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
    types: {
      // 피드 자동 발견 — 네이버 서치어드바이저 RSS 제출과 피드 리더 구독에 쓰인다.
      'application/rss+xml': [{ url: '/rss.xml', title: '케어브이 블로그' }],
    },
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
    alternateName: ['CareV'],
    legalName: '주식회사 실버리즘',
    url: 'https://carev.kr',
    // 구글 로고 가이드는 정사각형을 권장한다 — 워드마크(2048×1000)를 넣으면
    // 지식패널·검색 결과에서 잘리거나 무시된다. 워드마크는 image 필드가 계속 쓴다.
    logo: {
      '@type': 'ImageObject',
      '@id': 'https://carev.kr/#logo',
      url: 'https://carev.kr/images/logo.png',
      contentUrl: 'https://carev.kr/images/logo.png',
      width: 1024,
      height: 1024,
      caption: '케어브이 로고',
      representativeOfPage: true,
      inLanguage: 'ko-KR'
    },
    image: 'https://carev.kr/images/carev-logo-text.png',
    description: '주간보호센터, 장기요양기관을 위한 근무표·전자결재·운영 관리 플랫폼',
    foundingDate: '2024',
    areaServed: {
      '@type': 'Country',
      name: '대한민국'
    },
    serviceType: ['주간보호센터 관리', '장기요양기관 관리', '근무표 작성', '휴무 관리', '전자결재', '월간일정 관리', '요양기관 커뮤니티'],
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
    }
  }

  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': 'https://carev.kr/#website',
    name: '케어브이',
    alternateName: 'CareV',
    url: 'https://carev.kr',
    description: '주간보호센터, 장기요양기관을 위한 근무표·전자결재·운영 관리 플랫폼',
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
    description: '주간보호센터, 장기요양기관, 요양원, 재가노인복지센터를 위한 근무표·휴무관리·전자결재·월간일정·커뮤니티 통합 운영 솔루션',
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
      // /subscription은 로그인 전용(noindex)이라 크롤러가 가격을 검증할 수 없다.
      // 가격이 공개 노출된 홈으로 연결한다.
      url: 'https://carev.kr',
      availability: 'https://schema.org/InStock'
    },
    featureList: [
      '요양기관 근무표 작성 및 자동 배정',
      '휴무 신청과 승인 관리',
      '월간 일정·담당자·할 일 및 수행완료 진행도 관리',
      '전자결재 — 표준 기안문(공문) 양식, 다단계 결재선, 서명·직인 자동 날인',
      '공지사항과 실시간 채팅',
      '케어브이 커뮤니티 — 요양 뉴스·게시판·자료실',
      '직원용 iOS·Android 앱'
    ],
    audience: {
      '@type': 'BusinessAudience',
      audienceType: '주간보호센터, 장기요양기관, 요양원, 재가노인복지센터'
    }
  }

  return (
    <html lang="ko">
      <body className={figtree.variable}>
        {/* 구조화 데이터 — head 중복 렌더를 피하기 위해 body에서 한 번만 출력 */}
        <script {...jsonLdScriptProps(jsonLd)} />
        <script {...jsonLdScriptProps(websiteJsonLd)} />
        <script {...jsonLdScriptProps(softwareJsonLd)} />
        <AstryxProvider>
          <SubscriptionGuard>
            {children}
          </SubscriptionGuard>
        </AstryxProvider>
      </body>
    </html>
  )
}