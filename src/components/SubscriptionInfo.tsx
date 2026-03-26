'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SubscriptionResponseDTO, SubscriptionType, SubscriptionBillingType, SubscriptionStatus } from '@/types/subscription';
import { PaymentFailureResponseDTO, PaymentFailureReason } from '@/types/payment';
import { subscriptionService } from '@/services/subscription';
import { useAlert } from './Alert';

export default function SubscriptionInfo() {
  const router = useRouter();
  const { showAlert, AlertContainer } = useAlert();
  const [subscription, setSubscription] = useState<SubscriptionResponseDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentFailures, setPaymentFailures] = useState<PaymentFailureResponseDTO[]>([]);
  const [loadingPaymentFailures, setLoadingPaymentFailures] = useState(false);
  const [showPaymentFailures, setShowPaymentFailures] = useState(false);
  const [activating, setActivating] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showActivateModal, setShowActivateModal] = useState(false);

  useEffect(() => {
    fetchSubscription();
    fetchPaymentFailures();
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

  const fetchPaymentFailures = async () => {
    try {
      setLoadingPaymentFailures(true);
      const data = await subscriptionService.getMyPaymentFailures(0, 3); // 최근 3개만
      setPaymentFailures(data.content);
    } catch (err) {
      console.error('결제 실패 정보 조회 실패:', err);
      // 결제 실패 정보는 선택적이므로 에러를 무시
    } finally {
      setLoadingPaymentFailures(false);
    }
  };

  const handlePayment = () => {
    router.push('/payment');
  };

  const getFailureReasonText = (failure: PaymentFailureResponseDTO): string => {
    // failureReasonDescription이 있으면 그것을 사용 (예: "잔액 부족")
    if (failure.failureReasonDescription && failure.failureReasonDescription.trim() !== '') {
      return failure.failureReasonDescription;
    }
    
    // 없으면 enum 기반 기본 메시지
    switch (failure.failureReason) {
      case PaymentFailureReason.CARD_EXPIRED:
        return '카드 유효기간 만료';
      case PaymentFailureReason.INSUFFICIENT_FUNDS:
        return '잔액 부족';
      case PaymentFailureReason.CARD_DECLINED:
        return '카드사 승인 거절';
      case PaymentFailureReason.INVALID_CARD:
        return '유효하지 않은 카드';
      case PaymentFailureReason.NETWORK_ERROR:
        return '네트워크 오류';
      case PaymentFailureReason.SYSTEM_ERROR:
        return '시스템 오류';
      case PaymentFailureReason.OTHER:
        return '결제 실패';
      default:
        return '결제 실패';
    }
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

  const handleActivateSubscription = async () => {
    try {
      setActivating(true);
      await subscriptionService.activateSubscription();
      await fetchSubscription();
      setShowActivateModal(false);
      showAlert({
        type: 'success',
        title: '구독 활성화 완료',
        message: '구독이 다시 활성화되었습니다. 정기 결제가 재개됩니다.'
      });
    } catch (err) {
      showAlert({
        type: 'error',
        title: '구독 활성화 실패',
        message: '구독 활성화에 실패했습니다.'
      });
      console.error(err);
    } finally {
      setActivating(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-100 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-100 rounded w-1/2 mb-2"></div>
          <div className="h-4 bg-gray-100 rounded w-1/3"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="text-red-700">{error}</div>
      </div>
    );
  }

  const needsPayment = subscription && subscriptionService.needsPayment(subscription);
  const daysRemaining = subscription ? subscriptionService.getDaysRemaining(subscription) : 0;

  return (
    <>
      <AlertContainer />
      <div className="space-y-4">
      {/* 현재 구독 정보 카드 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
          <div className="w-8 h-8 bg-teal-50 rounded-lg flex items-center justify-center mr-3">
            <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          구독 정보
        </h2>
        
        {subscription ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-teal-50 rounded-xl p-4 border border-teal-200">
                <p className="text-sm font-medium text-teal-700 mb-1">현재 플랜</p>
                <p className="text-xl font-bold text-teal-900">
                  {subscription.planName === SubscriptionType.FREE ? '무료 체험' :
                   subscription.planName === SubscriptionType.BASIC ? 'Basic 플랜' :
                   subscription.planName}
                </p>
              </div>

              <div className={`rounded-xl p-4 border ${
                subscription.status === SubscriptionStatus.ACTIVE ?
                  'bg-teal-50 border-teal-200' :
                subscription.status === SubscriptionStatus.EXPIRED ?
                  'bg-red-50 border-red-200' :
                subscription.status === SubscriptionStatus.CANCELLED ?
                  'bg-amber-50 border-amber-200' :
                  'bg-gray-50 border-gray-200'
              }`}>
                <p className={`text-sm font-medium mb-1 ${
                  subscription.status === SubscriptionStatus.ACTIVE ? 'text-teal-700' :
                  subscription.status === SubscriptionStatus.EXPIRED ? 'text-red-700' :
                  subscription.status === SubscriptionStatus.CANCELLED ? 'text-amber-700' :
                  'text-gray-500'
                }`}>상태</p>
                <p className={`text-xl font-bold ${
                  subscription.status === SubscriptionStatus.ACTIVE ? 'text-teal-900' :
                  subscription.status === SubscriptionStatus.EXPIRED ? 'text-red-900' :
                  subscription.status === SubscriptionStatus.CANCELLED ? 'text-amber-900' :
                  'text-gray-900'
                }`}>
                  {subscription.status === SubscriptionStatus.ACTIVE ? '활성' :
                   subscription.status === SubscriptionStatus.EXPIRED ? '만료됨' :
                   subscription.status === SubscriptionStatus.CANCELLED ? '취소됨' :
                   '비활성'}
                </p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <p className="text-sm font-medium text-gray-500 mb-1">시작일</p>
                <p className="text-xl font-bold text-gray-900">
                  {new Date(subscription.startDate).toLocaleDateString('ko-KR')}
                </p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <p className="text-sm font-medium text-gray-500 mb-1">종료일</p>
                <p className="text-xl font-bold text-gray-900">
                  {new Date(subscription.endDate).toLocaleDateString('ko-KR')}
                </p>
              </div>
            </div>

            {/* 무료 체험 중인 경우 */}
            {subscription.planName === SubscriptionType.FREE &&
             subscription.status === SubscriptionStatus.ACTIVE && (
              <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-200">
                <p className="text-amber-800 font-medium">
                  무료 체험 기간이 <span className="font-bold">{daysRemaining}일</span> 남았습니다.
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  무료 체험이 종료되면 서비스 이용이 제한됩니다.
                </p>
                <button
                  onClick={handlePayment}
                  className="mt-4 w-full bg-teal-500 text-white py-2 px-4 rounded-lg font-medium hover:bg-teal-600 transition-colors"
                >
                  지금 Basic 플랜 시작하기 (₩9,900/월)
                </button>
              </div>
            )}

            {/* 결제가 필요한 경우 */}
            {needsPayment && (
              <div className="mt-6 p-4 bg-red-50 rounded-xl border border-red-200">
                <p className="text-red-700 font-medium">
                  {subscription.planName === SubscriptionType.FREE ?
                    '무료 체험이 종료되었습니다.' :
                    '구독이 만료되었습니다.'}
                </p>
                <p className="text-sm text-red-600 mt-1">
                  서비스를 계속 이용하려면 구독을 시작해주세요.
                </p>
                <button
                  onClick={handlePayment}
                  className="mt-4 w-full bg-teal-500 text-white py-2 px-4 rounded-lg font-medium hover:bg-teal-600 transition-colors"
                >
                  Basic 플랜 시작하기 (₩9,900/월)
                </button>
              </div>
            )}

            {/* 취소된 구독에 대한 안내 문구 */}
            {subscriptionService.isCanceled(subscription) && (
              <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-sm text-amber-800 mb-2">
                  구독이 취소되었지만 <strong>{new Date(subscription.endDate).toLocaleDateString('ko-KR')}</strong>까지 서비스를 계속 이용하실 수 있습니다.
                </p>
                <p className="text-sm text-amber-700">
                  구독을 다시 활성화하면 정기 결제일마다 자동으로 결제가 재개됩니다.
                </p>
                <button
                  onClick={() => setShowActivateModal(true)}
                  disabled={activating}
                  className={`mt-3 w-full px-4 py-2 rounded-lg font-medium transition-colors ${
                    activating
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-teal-500 text-white hover:bg-teal-600'
                  }`}
                >
                  구독 활성화
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
                    <p className="text-sm text-gray-500">매월 자동 결제</p>
                  </div>
                  <button
                    onClick={() => setShowCancelModal(true)}
                    className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
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
            <p className="text-gray-500 mb-4">구독 정보가 없습니다.</p>
            <button
              onClick={handlePayment}
              className="w-full bg-teal-500 text-white py-2 px-4 rounded-lg font-medium hover:bg-teal-600 transition-colors"
            >
              Basic 플랜 시작하기 (₩9,900/월)
            </button>
          </div>
        )}
      </div>

      {/* Basic 플랜 정보 - 무료 체험 중이 아닐 때만 표시 */}
      {(!subscription || subscription.planName !== SubscriptionType.FREE) && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <div className="w-6 h-6 bg-teal-50 rounded-lg flex items-center justify-center mr-2">
              <svg className="w-4 h-4 text-teal-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            Basic 플랜 혜택
          </h3>
          <ul className="space-y-3 text-gray-700">
            <li className="flex items-start">
              <svg className="w-5 h-5 text-teal-500 mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">모든 휴가 관리 기능 이용</span>
            </li>
            <li className="flex items-start">
              <svg className="w-5 h-5 text-teal-500 mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">무제한 직원 등록</span>
            </li>
            <li className="flex items-start">
              <svg className="w-5 h-5 text-teal-500 mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">실시간 알림 기능</span>
            </li>
            <li className="flex items-start">
              <svg className="w-5 h-5 text-teal-500 mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">우선 고객 지원</span>
            </li>
          </ul>
        </div>
      )}

      {/* 결제 실패 정보 섹션 */}
      {paymentFailures.length > 0 && (
        <div className="bg-red-50 rounded-xl border border-red-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-red-900 flex items-center">
              <div className="w-6 h-6 bg-red-100 rounded-lg flex items-center justify-center mr-2">
                <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L4.316 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              결제 실패 ({paymentFailures.length}건)
            </h3>
            <button
              onClick={() => setShowPaymentFailures(!showPaymentFailures)}
              className="px-4 py-2 text-sm font-medium text-red-700 bg-red-100 border border-red-200 rounded-lg hover:bg-red-200 transition-colors flex items-center"
            >
              {showPaymentFailures ? (
                <>
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                  </svg>
                  숨기기
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                  상세 보기
                </>
              )}
            </button>
          </div>
          
          {showPaymentFailures && (
            <>
              <div className="space-y-3">
                {paymentFailures.map((failure) => (
                <div key={failure.id} className="bg-white rounded-lg p-4 border border-red-200">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium text-red-900">
                        {getFailureReasonText(failure)}
                      </p>
                      <p className="text-xs text-red-600">
                        {new Date(failure.failedAt).toLocaleDateString('ko-KR')} • {failure.subscriptionType} 플랜
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-red-900">
                        ₩{failure.attemptedAmount.toLocaleString()}
                      </p>
                      <button
                        onClick={handlePayment}
                        className="mt-1 px-3 py-1 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors text-xs font-medium"
                      >
                        재결제
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              </div>
              
              <div className="mt-4 space-y-3">
                <div className="p-3 bg-white rounded-lg border border-red-200">
                  <p className="text-sm text-red-700">
                    결제 실패가 반복될 경우 카드 정보를 확인하거나 다른 결제 방법을 이용해 주세요.
                  </p>
                </div>

                {paymentFailures.length >= 3 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-start">
                      <svg className="w-5 h-5 text-amber-600 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-amber-800 mb-1">중요 안내</p>
                        <p className="text-sm text-amber-700">
                          결제 실패가 <span className="font-semibold">3회 이상</span> 발생하면 정기 결제가 자동으로 비활성화됩니다.
                          서비스 중단을 방지하려면 결제 방법을 확인하고 즉시 재결제해 주세요.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* 구독 취소 확인 모달 */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 border border-gray-200">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center mr-3">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L4.316 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">구독 취소</h3>
            </div>

            <p className="text-gray-500 mb-6">
              정말로 구독을 취소하시겠습니까?
              <br />
              구독을 취소하면 정기 결제가 중단되며, 종료일까지 서비스를 이용할 수 있습니다.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors font-medium"
              >
                취소
              </button>
              <button
                onClick={handleCancelSubscription}
                disabled={loading}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                  loading
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                {loading ? '처리 중...' : '구독 취소'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 구독 활성화 확인 모달 */}
      {showActivateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 border border-gray-200">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-teal-50 rounded-full flex items-center justify-center mr-3">
                <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">구독 활성화</h3>
            </div>

            <p className="text-gray-500 mb-6">
              구독을 다시 활성화하시겠습니까?
              <br />
              활성화하면 정기 결제일마다 자동으로 결제가 재개됩니다.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowActivateModal(false)}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors font-medium"
              >
                취소
              </button>
              <button
                onClick={handleActivateSubscription}
                disabled={activating}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                  activating
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-teal-500 text-white hover:bg-teal-600'
                }`}
              >
                {activating ? '활성화 중...' : '구독 활성화'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}