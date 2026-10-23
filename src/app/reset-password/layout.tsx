import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '비밀번호 재설정',
  // 개인 링크가 담긴 화면 — 색인하지 않는다
  robots: { index: false, follow: false },
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
