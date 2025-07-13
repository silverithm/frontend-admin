import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '케어브이',
  description: '케어브이 휴무 관리 시스템',
  openGraph: {
    title: '케어브이',
    description: '케어브이 휴무 관리 시스템',
    images: ['/images/logo.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: '케어브이',
    description: '케어브이 휴무 관리 시스템',
    images: ['/images/logo.png'],
  },
  icons: {
    icon: [
      { url: '/images/logo.png', type: 'image/png' },
    ],
    shortcut: '/images/logo.png',
    apple: '/images/logo.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className={inter.className}>{children}</body>
    </html>
  )
}