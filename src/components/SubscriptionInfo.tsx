'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SubscriptionResponseDTO, SubscriptionType, SubscriptionBillingType, SubscriptionStatus } from '@/types/subscription';
import { subscriptionService } from '@/services/subscription';

export default function SubscriptionInfo() {
  const router = useRouter();
  const [subscription, setSubscription] = useState<SubscriptionResponseDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    try {
      setLoading(true);
      const data = await subscriptionService.getMySubscription();
      setSubscription(data);
    } catch (err) {
      setError('구독 정보를 불러올 수 없습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = () => {
    router.push('/payment');
  };

  const handleCancelSubscription = async () => {
    if (!confirm('정말로 구독을 취소하시겠습니까?')) {
      return;
    }

    try {
      setLoading(true);
      await subscriptionService.cancelSubscription();
      await fetchSubscription();
      alert('구독이 취소되었습니다.');
    } catch (err) {
      alert('구독 취소에 실패했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  const needsPayment = subscription && subscriptionService.needsPayment(subscription);
  const daysRemaining = subscription ? subscriptionService.getDaysRemaining(subscription) : 0;

  return (
    <div className="space-y-6">
      {/* 현재 구독 정보 카드 */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          구독 정보
        </h2>
        
        {subscription ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
                <p className="text-sm font-medium text-blue-700 mb-1">현재 플랜</p>
                <p className="text-xl font-bold text-blue-900">
                  {subscription.planName === SubscriptionType.FREE ? '무료 체험' : 
                   subscription.planName === SubscriptionType.BASIC ? 'Basic 플랜' : 
                   subscription.planName}
                </p>
              </div>
              
              <div className={`rounded-xl p-4 border ${
                subscription.status === SubscriptionStatus.ACTIVE ? 
                  'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200' : 
                subscription.status === SubscriptionStatus.EXPIRED ? 
                  'bg-gradient-to-r from-red-50 to-rose-50 border-red-200' : 
                  'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200'
              }`}>
                <p className={`text-sm font-medium mb-1 ${
                  subscription.status === SubscriptionStatus.ACTIVE ? 'text-green-700' : 
                  subscription.status === SubscriptionStatus.EXPIRED ? 'text-red-700' : 
                  'text-gray-700'
                }`}>상태</p>
                <p className={`text-xl font-bold ${
                  subscription.status === SubscriptionStatus.ACTIVE ? 'text-green-900' : 
                  subscription.status === SubscriptionStatus.EXPIRED ? 'text-red-900' : 
                  'text-gray-900'
                }`}>
                  {subscription.status === SubscriptionStatus.ACTIVE ? '활성' :
                   subscription.status === SubscriptionStatus.EXPIRED ? '만료됨' :
                   subscription.status === SubscriptionStatus.CANCELLED ? '취소됨' :
                   '비활성'}
                </p>
              </div>
              
              <div className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl p-4 border border-gray-200">
                <p className="text-sm font-medium text-gray-700 mb-1">시작일</p>
                <p className="text-xl font-bold text-gray-900">
                  {new Date(subscription.startDate).toLocaleDateString('ko-KR')}
                </p>
              </div>
              
              <div className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl p-4 border border-gray-200">
                <p className="text-sm font-medium text-gray-700 mb-1">종료일</p>
                <p className="text-xl font-bold text-gray-900">
                  {new Date(subscription.endDate).toLocaleDateString('ko-KR')}
                </p>
              </div>
            </div>

            {/* 무료 체험 중인 경우 */}
            {subscription.planName === SubscriptionType.FREE && 
             subscription.status === SubscriptionStatus.ACTIVE && (
              <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-blue-800 font-medium">
                  무료 체험 기간이 <span className="font-bold">{daysRemaining}일</span> 남았습니다.
                </p>
                <p className="text-sm text-blue-600 mt-1">
                  무료 체험이 종료되면 서비스 이용이 제한됩니다.
                </p>
              </div>
            )}

            {/* 결제가 필요한 경우 */}
            {needsPayment && (
              <div className="mt-6 p-4 bg-red-50 rounded-lg border border-red-200">
                <p className="text-red-800 font-medium">
                  {subscription.planName === SubscriptionType.FREE ? 
                    '무료 체험이 종료되었습니다.' : 
                    '구독이 만료되었습니다.'}
                </p>
                <p className="text-sm text-red-600 mt-1">
                  서비스를 계속 이용하려면 구독을 시작해주세요.
                </p>
                <button
                  onClick={handlePayment}
                  className="mt-4 w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Basic 플랜 시작하기 (₩9,900/월)
                </button>
              </div>
            )}

            {/* 유료 구독 중인 경우 */}
            {subscription.planName === SubscriptionType.BASIC && 
             subscription.status === SubscriptionStatus.ACTIVE && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-lg font-semibold text-gray-900">₩{subscription.amount.toLocaleString()}/월</p>
                    <p className="text-sm text-gray-600">매월 자동 결제</p>
                  </div>
                  <button
                    onClick={handleCancelSubscription}
                    className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 hover:text-red-700 transition-all duration-200"
                  >
                    구독 취소
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  구독을 취소하면 정기 결제가 중단되며, 종료일까지 서비스를 이용할 수 있습니다.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div>
            <p className="text-gray-600 mb-4">구독 정보가 없습니다.</p>
            <button
              onClick={handlePayment}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
            >
              Basic 플랜 시작하기 (₩9,900/월)
            </button>
          </div>
        )}
      </div>

      {/* Basic 플랜 정보 - 무료 체험 중이 아닐 때만 표시 */}
      {(!subscription || subscription.planName !== SubscriptionType.FREE) && (
        <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <div className="w-6 h-6 bg-green-100 rounded-lg flex items-center justify-center mr-2">
              <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            Basic 플랜 혜택
          </h3>
          <ul className="space-y-3 text-gray-700">
            <li className="flex items-start">
              <svg className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">모든 휴가 관리 기능 이용</span>
            </li>
            <li className="flex items-start">
              <svg className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">무제한 직원 등록</span>
            </li>
            <li className="flex items-start">
              <svg className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">실시간 알림 기능</span>
            </li>
            <li className="flex items-start">
              <svg className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">우선 고객 지원</span>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}