import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '케어브이',
  description: '요양기관,주간보호 근무표 작성 서비스',
  openGraph: {
    title: '케어브이',
    description: '요양기관, 주관보호 근무표 작성 서비스',
    images: ['/images/carev-logo-text.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: '케어브이',
    description: '요양기관, 주관보호 근무표 작성 서비스',
    images: ['/images/carev-logo-text.png'],
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
  return (
    <html lang="ko">ㄴ
      <body className={inter.className}>{children}</body>
    </html>
  )
}