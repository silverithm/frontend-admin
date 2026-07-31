import { Metadata } from 'next'
import { OG_IMAGES } from '@/lib/seo'

export const metadata: Metadata = {
  title: {
    default: '블로그',
    // 개별 글 제목에도 브랜드 접미사가 붙도록 이 세그먼트에서 템플릿을 다시 선언한다.
    template: '%s | 케어브이',
  },
  description: '요양기관 근무표 작성 노하우, 휴무 관리 팁, 케어브이 기능 업데이트 소식을 전합니다.',
  keywords: '요양기관 블로그, 근무표 작성법, 휴무관리 노하우, 주간보호센터 운영, 장기요양기관 소식, 케어브이 업데이트',
  openGraph: {
    title: '블로그 | 케어브이',
    description: '요양기관 근무표 작성 노하우, 휴무 관리 팁, 케어브이 기능 업데이트 소식을 전합니다.',
    url: 'https://carev.kr/blog',
    type: 'website',
    images: OG_IMAGES,
  },
  alternates: {
    canonical: '/blog',
  },
}

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
