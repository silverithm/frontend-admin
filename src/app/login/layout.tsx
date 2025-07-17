import { Metadata } from 'next'

export const metadata: Metadata = {
  title: '로그인 | 케어브이',
  description: '케어브이 로그인 - 요양기관 근무표 작성 서비스에 로그인하세요',
  openGraph: {
    title: '로그인 | 케어브이',
    description: '케어브이 로그인 - 요양기관 근무표 작성 서비스에 로그인하세요',
    url: 'https://carev.kr/login',
  },
  alternates: {
    canonical: 'https://carev.kr/login',
  },
}

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}