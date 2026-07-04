'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@astryxdesign/core/Spinner';

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
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f9fafb',
        }}
      >
        <Spinner size="lg" aria-label="Loading" />
      </div>
    );
  }

  return <>{children}</>;
}
