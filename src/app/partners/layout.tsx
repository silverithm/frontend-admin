import { Metadata } from 'next'
import { OG_IMAGES } from '@/lib/seo'

export const metadata: Metadata = {
  title: '제휴·광고',
  description: '케어브이와 함께하는 주간보호센터, 재활 프로그램, 요양기관을 소개합니다. 기관 광고 문의도 이곳에서 남기실 수 있습니다.',
  keywords: '케어브이 제휴, 요양기관 광고, 주간보호센터 홍보, 어르신 재활 프로그램, 장기요양기관 제휴',
  openGraph: {
    title: '제휴·광고 | 케어브이',
    description: '케어브이와 함께하는 기관을 소개합니다. 기관 광고 문의를 남겨주세요.',
    url: 'https://carev.kr/partners',
    type: 'website',
    images: OG_IMAGES,
  },
  alternates: {
    canonical: '/partners',
  },
}

export default function PartnersLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
