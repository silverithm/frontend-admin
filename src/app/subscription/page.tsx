'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SubscriptionResponseDTO, SubscriptionType, SubscriptionBillingType, SubscriptionStatus } from '@/types/subscription';
import { subscriptionService } from '@/services/subscription';
import { useAlert } from '@/components/Alert';

export default function SubscriptionPage() {
  const router = useRouter();
  const { showAlert, AlertContainer } = useAlert();
  const [subscription, setSubscription] = useState<SubscriptionResponseDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);

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
    // 토스페이먼츠 결제 페이지로 이동
    router.push('/payment');
  };

  const handleCancelSubscription = async () => {
    try {
      setLoading(true);
      await subscriptionService.cancelSubscription();
      await fetchSubscription();
      setShowCancelModal(false);
      showAlert({
        type: 'success',
        title: '구독 취소 완료',
        message: '구독이 취소되었습니다.'
      });
    } catch (err) {
      showAlert({
        type: 'error',
        title: '구독 취소 실패',
        message: '구독 취소에 실패했습니다.'
      });
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  const needsPayment = subscription && subscriptionService.needsPayment(subscription);
  const daysRemaining = subscription ? subscriptionService.getDaysRemaining(subscription) : 0;

  return (
    <>
      <AlertContainer />
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">구독 관리</h1>

        {subscription ? (
          <div className="bg-white shadow rounded-lg p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-4">현재 구독 정보</h2>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">플랜:</span>
                  <span className="font-medium">
                    {subscription.planName === SubscriptionType.FREE ? '무료 체험' : 
                     subscription.planName === SubscriptionType.BASIC ? 'Basic 플랜' : 
                     subscription.planName}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">상태:</span>
                  <span className={`font-medium ${
                    subscription.status === SubscriptionStatus.ACTIVE ? 'text-green-600' : 
                    subscription.status === SubscriptionStatus.EXPIRED ? 'text-red-600' : 
                    'text-gray-600'
                  }`}>
                    {subscription.status === SubscriptionStatus.ACTIVE ? '활성' :
                     subscription.status === SubscriptionStatus.EXPIRED ? '만료됨' :
                     subscription.status === SubscriptionStatus.CANCELLED ? '취소됨' :
                     '비활성'}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">시작일:</span>
                  <span className="font-medium">
                    {new Date(subscription.startDate).toLocaleDateString('ko-KR')}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">종료일:</span>
                  <span className="font-medium">
                    {new Date(subscription.endDate).toLocaleDateString('ko-KR')}
                  </span>
                </div>
                
                {subscription.amount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">금액:</span>
                    <span className="font-medium">
                      ₩{subscription.amount.toLocaleString()}/월
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* 무료 체험 중인 경우 */}
            {subscription.planName === SubscriptionType.FREE && 
             subscription.status === SubscriptionStatus.ACTIVE && (
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <p className="text-blue-800">
                  무료 체험 기간이 <span className="font-bold">{daysRemaining}일</span> 남았습니다.
                </p>
                <p className="text-sm text-blue-600 mt-1">
                  무료 체험이 종료되면 서비스 이용이 제한됩니다.
                </p>
              </div>
            )}

            {/* 결제가 필요한 경우 */}
            {needsPayment && (
              <div className="mt-6 p-4 bg-red-50 rounded-lg">
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
              <div className="mt-6">
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="text-red-600 hover:text-red-700 text-sm"
                >
                  구독 취소
                </button>
                <p className="text-xs text-gray-500 mt-1">
                  구독을 취소해도 종료일까지 서비스를 이용할 수 있습니다.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg p-6">
            <p className="text-gray-600">구독 정보가 없습니다.</p>
            <button
              onClick={handlePayment}
              className="mt-4 w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
            >
              Basic 플랜 시작하기 (₩9,900/월)
            </button>
          </div>
        )}

        {/* 플랜 정보 */}
        <div className="mt-8 bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Basic 플랜</h2>
          <div className="space-y-2">
            <p className="text-3xl font-bold">₩9,900<span className="text-lg font-normal text-gray-600">/월</span></p>
            <ul className="mt-4 space-y-2 text-gray-600">
              <li className="flex items-center">
                <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                모든 기능 이용 가능
              </li>
              <li className="flex items-center">
                <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                무제한 사용자
              </li>
              <li className="flex items-center">
                <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                실시간 알림
              </li>
              <li className="flex items-center">
                <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                고객 지원
              </li>
            </ul>
          </div>
        </div>

        {/* 구독 취소 확인 모달 */}
        {showCancelModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mr-3">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L4.316 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">구독 취소</h3>
              </div>
              
              <p className="text-gray-600 mb-6">
                정말로 구독을 취소하시겠습니까?
                <br />
                구독을 취소하면 정기 결제가 중단되며, 종료일까지 서비스를 이용할 수 있습니다.
              </p>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleCancelSubscription}
                  disabled={loading}
                  className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                    loading
                      ? 'bg-gray-400 text-white cursor-not-allowed'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  {loading ? '처리 중...' : '구독 취소'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
    </>
  );
}