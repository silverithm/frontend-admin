'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-500"></div>
      </div>
    );
  }

  return <>{children}</>;
}
