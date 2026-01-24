'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-900 via-blue-900 to-indigo-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-400"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
