'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SubscriptionResponseDTO, SubscriptionType, SubscriptionStatus as Status } from '@/types/subscription';
import { subscriptionService } from '@/services/subscription';

export default function SubscriptionStatus() {
  const router = useRouter();
  const [subscription, setSubscription] = useState<SubscriptionResponseDTO | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    try {
      const data = await subscriptionService.getMySubscription();
      setSubscription(data);
    } catch (err) {
      console.error('구독 정보 조회 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = () => {
    router.push('/payment');
  };

  if (loading) {
    return (
      <div className="flex items-center space-x-2 px-3 py-2 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
        <div className="w-2 h-2 bg-gray-300 rounded-full animate-pulse"></div>
        <span className="text-white/70 text-sm">구독 확인 중...</span>
      </div>
    );
  }

  if (!subscription) {
    return (
      <button
        onClick={handlePayment}
        className="flex items-center space-x-2 px-3 py-2 bg-red-500/20 backdrop-blur-sm rounded-lg border border-red-400/30 hover:bg-red-500/30 transition-all duration-300"
      >
        <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
        <span className="text-red-100 text-sm font-medium">구독 필요</span>
      </button>
    );
  }

  const needsPayment = subscriptionService.needsPayment(subscription);
  const daysRemaining = subscriptionService.getDaysRemaining(subscription);

  if (needsPayment) {
    return (
      <button
        onClick={handlePayment}
        className="flex items-center space-x-2 px-3 py-2 bg-red-500/20 backdrop-blur-sm rounded-lg border border-red-400/30 hover:bg-red-500/30 transition-all duration-300"
      >
        <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
        <div className="flex flex-col">
          <span className="text-red-100 text-sm font-medium">
            {subscription.planName === SubscriptionType.FREE ? '무료 체험 종료' : '구독 만료'}
          </span>
          <span className="text-red-200/70 text-xs">월 9,900원으로 계속하기</span>
        </div>
      </button>
    );
  }

  if (subscription.planName === SubscriptionType.FREE && subscription.status === Status.ACTIVE) {
    return (
      <div className="flex items-center space-x-2 px-3 py-2 bg-yellow-500/20 backdrop-blur-sm rounded-lg border border-yellow-400/30">
        <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
        <div className="flex flex-col">
          <span className="text-yellow-100 text-sm font-medium">
            무료 체험 {daysRemaining}일 남음
          </span>
          <span className="text-yellow-200/70 text-xs">이후 월 9,900원</span>
        </div>
      </div>
    );
  }

  if (subscription.planName === SubscriptionType.BASIC && subscription.status === Status.ACTIVE) {
    return (
      <div className="flex items-center space-x-2 px-3 py-2 bg-green-500/20 backdrop-blur-sm rounded-lg border border-green-400/30">
        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
        <div className="flex flex-col">
          <span className="text-green-100 text-sm font-medium">
            Basic 플랜 활성
          </span>
          <span className="text-green-200/70 text-xs">월 9,900원</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2 px-3 py-2 bg-gray-500/20 backdrop-blur-sm rounded-lg border border-gray-400/30">
      <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
      <span className="text-gray-100 text-sm font-medium">구독 상태 확인 필요</span>
    </div>
  );
}