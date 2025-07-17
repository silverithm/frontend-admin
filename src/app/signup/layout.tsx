import { Metadata } from 'next'

export const metadata: Metadata = {
  title: '회원가입 | 케어브이',
  description: '케어브이 회원가입 - 요양기관 근무표 작성 서비스를 시작하세요',
  openGraph: {
    title: '회원가입 | 케어브이',
    description: '케어브이 회원가입 - 요양기관 근무표 작성 서비스를 시작하세요',
    url: 'https://carev.kr/signup',
  },
  alternates: {
    canonical: 'https://carev.kr/signup',
  },
}

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}