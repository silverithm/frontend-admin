'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@astryxdesign/core/Spinner';

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
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'linear-gradient(to bottom, #0f172a, #1e3a8a, #312e81)',
        }}
      >
        <Spinner size="lg" shade="onMedia" aria-label="Loading" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
