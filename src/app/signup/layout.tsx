import { Metadata } from 'next'
import { OG_IMAGES } from '@/lib/seo'

export const metadata: Metadata = {
  title: '회원가입 — 30일 무료 체험',
  description:
    '주간보호센터·장기요양기관 관리자라면 기관 정보만 입력하면 바로 시작할 수 있습니다. 결제 수단 등록 없이 30일 무료 체험, 근무표·휴무 관리·전자결재를 모두 사용해 보세요.',
  keywords:
    '케어브이 회원가입, 요양기관 근무표 프로그램 가입, 주간보호센터 프로그램 무료체험, 장기요양기관 관리 프로그램 신청',
  openGraph: {
    title: '회원가입 — 30일 무료 체험 | 케어브이',
    description:
      '결제 수단 등록 없이 30일 무료 체험. 근무표·휴무 관리·전자결재를 모두 사용해 보세요.',
    url: 'https://carev.kr/signup',
    images: OG_IMAGES,
  },
  alternates: {
    canonical: '/signup',
  },
}

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}