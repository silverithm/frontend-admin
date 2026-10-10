import { Metadata } from 'next'

export const metadata: Metadata = {
  title: '요금·환불 정책',
  description: '케어브이 Basic 플랜 요금, 정기결제 방식, 해지 방법, 청약철회와 환불 기준을 안내합니다.',
  alternates: {
    canonical: '/refund-policy',
  },
}

export default function RefundPolicyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
