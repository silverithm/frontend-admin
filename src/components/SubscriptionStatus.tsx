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
      <div className="flex items-center space-x-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
        <div className="w-2 h-2 bg-gray-300 rounded-full animate-pulse"></div>
        <span className="text-gray-400 text-xs font-medium">구독 확인 중...</span>
      </div>
    );
  }

  if (!subscription) {
    return (
      <button
        onClick={handlePayment}
        className="flex items-center space-x-2 px-3 py-2 bg-red-50 rounded-lg border border-red-200 hover:bg-red-100 transition-all duration-200"
      >
        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
        <span className="text-red-700 text-xs font-semibold">구독 필요</span>
      </button>
    );
  }

  const needsPayment = subscriptionService.needsPayment(subscription);
  const daysRemaining = subscriptionService.getDaysRemaining(subscription);

  if (needsPayment) {
    return (
      <button
        onClick={handlePayment}
        className="flex items-center space-x-2 px-3 py-2 bg-red-50 rounded-lg border border-red-200 hover:bg-red-100 transition-all duration-200"
      >
        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
        <span className="text-red-700 text-xs font-semibold">
          {subscription.planName === SubscriptionType.FREE ? '무료 체험 종료' : '구독 만료'}
        </span>
      </button>
    );
  }

  if (subscription.planName === SubscriptionType.FREE && subscription.status === Status.ACTIVE) {
    return (
      <button
        onClick={handlePayment}
        className="flex items-center space-x-2 px-3 py-2 bg-amber-50 rounded-lg border border-amber-200 hover:bg-amber-100 transition-all duration-200 cursor-pointer"
      >
        <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
        <span className="text-amber-700 text-xs font-semibold">
          무료 체험 {daysRemaining}일 남음
        </span>
      </button>
    );
  }

  if (subscription.planName === SubscriptionType.BASIC && subscription.status === Status.ACTIVE) {
    return (
      <div className="flex items-center space-x-2 px-3 py-2 bg-teal-50 rounded-lg border border-teal-200">
        <div className="w-2 h-2 bg-teal-500 rounded-full"></div>
        <span className="text-teal-700 text-xs font-semibold">
          Basic 플랜 활성
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
      <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
      <span className="text-gray-600 text-xs font-medium">구독 상태 확인 필요</span>
    </div>
  );
}