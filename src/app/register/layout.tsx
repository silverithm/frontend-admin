import { Metadata } from 'next'

export const metadata: Metadata = {
  title: '등록 | 케어브이',
  description: '케어브이 서비스 등록 - 요양기관 정보를 등록하세요',
  openGraph: {
    title: '등록 | 케어브이',
    description: '케어브이 서비스 등록 - 요양기관 정보를 등록하세요',
    url: 'https://carev.kr/register',
  },
  alternates: {
    canonical: 'https://carev.kr/register',
  },
}

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}