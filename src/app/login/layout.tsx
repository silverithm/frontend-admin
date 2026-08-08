import { Metadata } from 'next'
import { OG_IMAGES } from '@/lib/seo'

export const metadata: Metadata = {
  title: '로그인',
  description: '케어브이 로그인 - 요양기관 근무표 작성 서비스에 로그인하세요',
  openGraph: {
    title: '로그인 | 케어브이',
    description: '케어브이 로그인 - 요양기관 근무표 작성 서비스에 로그인하세요',
    url: 'https://carev.kr/login',
    images: OG_IMAGES,
  },
  // 로그인 화면은 검색 유입 가치가 없고, 색인되면 브랜드 검색에서 홈 대신 노출될 수 있다.
  // 링크는 따라가도록 follow는 유지한다.
  robots: { index: false, follow: true },
  alternates: {
    canonical: '/login',
  },
}

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}