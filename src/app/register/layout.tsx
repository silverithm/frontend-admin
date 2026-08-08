import { Metadata } from 'next'
import { OG_IMAGES } from '@/lib/seo'

export const metadata: Metadata = {
  title: '등록',
  description: '케어브이 서비스 등록 - 요양기관 정보를 등록하세요',
  openGraph: {
    title: '등록 | 케어브이',
    description: '케어브이 서비스 등록 - 요양기관 정보를 등록하세요',
    url: 'https://carev.kr/register',
    images: OG_IMAGES,
  },
  // 가입 절차 중간 단계 화면 — 검색 결과에 단독 노출될 이유가 없다.
  robots: { index: false, follow: true },
  alternates: {
    canonical: '/register',
  },
}

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}