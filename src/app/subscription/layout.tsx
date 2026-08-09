import { Metadata } from 'next'

// 로그인 후에만 의미 있는 계정 화면 — 홈 title/description/canonical을 그대로 상속하면
// 검색엔진에 홈과 중복 문서로 보인다. 자체 메타를 주고 색인은 명시적으로 막는다.
// (next.config.ts의 X-Robots-Tag noindex와 일관됨)
export const metadata: Metadata = {
  title: '내 구독 관리',
  description: '케어브이 구독 상태 확인, 결제 정보 관리, 구독 해지를 위한 계정 페이지입니다.',
  robots: { index: false, follow: false },
  alternates: {
    canonical: '/subscription',
  },
}

export default function SubscriptionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
