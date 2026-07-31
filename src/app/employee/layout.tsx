'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loading } from '@/components/Loading';

export default function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 인증 상태 확인
    const checkAuth = () => {
      const token = localStorage.getItem('authToken');
      const loginType = localStorage.getItem('loginType');

      if (!token) {
        router.push('/login');
        return;
      }

      // 관리자가 직원 페이지에 접근하려는 경우
      if (loginType === 'admin') {
        router.push('/admin');
        return;
      }

      setIsAuthenticated(true);
      setIsLoading(false);
    };

    checkAuth();
  }, [router]);

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--carev-page-gradient)' }}>
        <Loading size="page" height="100vh" label="화면을 준비하는 중..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
