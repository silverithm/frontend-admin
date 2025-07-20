'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { SubscriptionResponseDTO } from '@/types/subscription';
import { subscriptionService } from '@/services/subscription';

interface SubscriptionGuardProps {
  children: React.ReactNode;
}

// 구독 확인이 필요한 페이지들 (admin 경로만)
const PROTECTED_PATHS = [
  '/admin'
];

export default function SubscriptionGuard({ children }: SubscriptionGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [subscription, setSubscription] = useState<SubscriptionResponseDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBlockModal, setShowBlockModal] = useState(false);

  useEffect(() => {
    // 보호된 페이지(/admin)가 아니면 구독 확인하지 않음
    if (!PROTECTED_PATHS.some(path => pathname.startsWith(path))) {
      setLoading(false);
      return;
    }

    checkSubscription();
  }, [pathname]);

  const checkSubscription = async () => {
    try {
      const token = localStorage.getItem('authToken');
      
      // 로그인하지 않은 경우
      if (!token) {
        router.push('/login');
        return;
      }

      const data = await subscriptionService.getMySubscription();
      setSubscription(data);

      // 구독이 필요한 경우 (만료된 경우)
      if (subscriptionService.needsPayment(data)) {
        setShowBlockModal(true);
      }
    } catch (error: any) {
      console.error('구독 확인 실패:', error);
      
      // 404 에러이고 "No subscription found" 메시지인 경우에만 구독이 없다고 판단
      if (error.status === 404 && error.message.includes('No subscription found')) {
        router.push('/subscription-check');
        return;
      }
      
      // 기타 API 오류 시 일단 통과시킴 (백엔드 연결 문제 등)
      // 서버 연결 실패, 500 에러 등의 경우 사용자가 서비스를 이용할 수 있도록 함
    } finally {
      setLoading(false);
    }
  };

  const handleGoToSubscription = () => {
    router.push('/subscription');
  };

  // 로딩 중
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">로딩 중...</div>
      </div>
    );
  }

  // 무료 체험 종료 모달
  if (showBlockModal) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {subscription?.planName === 'FREE' ? '무료 체험이 종료되었습니다' : '구독이 만료되었습니다'}
            </h2>
            
            <p className="text-gray-600 mb-6">
              서비스를 계속 이용하시려면 Basic 플랜을 구독해주세요.
            </p>

            <div className="bg-blue-50 rounded-lg p-4 mb-6">
              <p className="text-lg font-semibold text-blue-900">Basic 플랜</p>
              <p className="text-2xl font-bold text-blue-900">₩9,900<span className="text-sm font-normal">/월</span></p>
            </div>

            <button
              onClick={handleGoToSubscription}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 transition-colors font-medium"
            >
              구독하러 가기
            </button>

            <button
              onClick={() => {
                localStorage.clear();
                router.push('/login');
              }}
              className="w-full mt-3 text-gray-600 hover:text-gray-800 text-sm"
            >
              로그아웃
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}