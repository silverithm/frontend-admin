'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loading } from '@/components/Loading';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const loginType = localStorage.getItem('loginType');

    if (!token) {
      router.push('/login');
      return;
    }

    // 직원이 admin 경로에 접근하면 employee 페이지로 리다이렉트
    if (loginType === 'employee') {
      router.push('/employee');
      return;
    }

    setIsAuthenticated(true);
    setIsLoading(false);
  }, [router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-background-muted)' }}>
        <Loading size="page" height="100vh" label="관리자 화면을 준비하는 중..." />
      </div>
    );
  }

  return <>{children}</>;
}
