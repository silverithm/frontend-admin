'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { loadTossPayments } from '@tosspayments/payment-sdk';
import { SubscriptionType, SubscriptionBillingType, SubscriptionRequestDTO } from '@/types/subscription';
import { subscriptionService } from '@/services/subscription';

// 토스페이먼츠 클라이언트 키
const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_PAYMENT_CLIENT_KEY;

export default function PaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [customerKey, setCustomerKey] = useState<string>('');
  const [userInfo, setUserInfo] = useState({
    name: '',
    email: ''
  });

  useEffect(() => {
    // localStorage에서 사용자 정보 가져오기
    const storedCustomerKey = localStorage.getItem('customerKey');
    const userName = localStorage.getItem('userName') || '';
    const userId = localStorage.getItem('userId') || '';
    
    // customerKey가 없으면 userId를 기반으로 생성
    const key = storedCustomerKey || `user_${userId}`;
    setCustomerKey(key);
    
    setUserInfo({
      name: userName,
      email: '' // 이메일 정보가 localStorage에 없으므로 빈 값으로 설정
    });
  }, []);

  // 결제 성공 처리
  useEffect(() => {
    const paymentKey = searchParams.get('paymentKey');
    const orderId = searchParams.get('orderId');
    const amount = searchParams.get('amount');

    if (paymentKey && orderId && amount) {
      handlePaymentSuccess(paymentKey, orderId, Number(amount));
    }
  }, [searchParams]);

  const handlePaymentSuccess = async (paymentKey: string, orderId: string, amount: number) => {
    try {
      setLoading(true);
      
      // 구독 생성 요청
      const subscriptionData: SubscriptionRequestDTO = {
        planName: SubscriptionType.BASIC,
        billingType: SubscriptionBillingType.MONTHLY,
        amount: 9900,
        customerKey: customerKey,
        authKey: paymentKey,
        orderName: 'Basic 플랜 월간 구독',
        customerEmail: userInfo.email,
        customerName: userInfo.name,
        taxFreeAmount: 0
      };

      await subscriptionService.createOrUpdateSubscription(subscriptionData);
      
      alert('결제가 완료되었습니다! Basic 플랜을 이용하실 수 있습니다.');
      router.push('/admin');
    } catch (error) {
      console.error('구독 생성 실패:', error);
      alert('결제는 완료되었으나 구독 활성화에 실패했습니다. 고객센터에 문의해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!customerKey) {
      alert('사용자 정보를 불러올 수 없습니다. 다시 로그인해주세요.');
      return;
    }

    if (!TOSS_CLIENT_KEY) {
      alert('결제 설정에 오류가 있습니다. 관리자에게 문의해주세요.');
      return;
    }

    try {
      setLoading(true);
      
      const tossPayments = await loadTossPayments(TOSS_CLIENT_KEY);
      const orderId = `order_${Date.now()}`;
      
      // 토스페이먼츠 결제 위젯 호출
      await tossPayments.requestPayment('카드', {
        amount: 9900,
        orderId: orderId,
        orderName: 'Basic 플랜 월간 구독',
        customerName: userInfo.name,
        successUrl: `${window.location.origin}/payment?success=true`,
        failUrl: `${window.location.origin}/payment?success=false`,
      });
    } catch (error) {
      console.error('결제 오류:', error);
      alert('결제 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 결제 실패 처리
  useEffect(() => {
    const success = searchParams.get('success');
    if (success === 'false') {
      alert('결제가 취소되었습니다.');
      router.push('/subscription-check');
    }
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <div className="bg-white shadow rounded-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Basic 플랜 결제</h1>
          
          <div className="mb-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <h2 className="text-lg font-semibold text-blue-900 mb-2">Basic 플랜</h2>
              <p className="text-3xl font-bold text-blue-900">₩9,900<span className="text-sm font-normal">/월</span></p>
            </div>
          </div>

          <div className="mb-6 space-y-3">
            <h3 className="font-medium text-gray-700">플랜 혜택</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start">
                <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                모든 휴가 관리 기능 이용
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                무제한 직원 등록
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                실시간 알림 기능
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                데이터 백업 및 복원
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                우선 고객 지원
              </li>
            </ul>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm text-gray-600 mb-4">
              • 매월 자동 결제됩니다<br />
              • 언제든지 구독을 취소할 수 있습니다<br />
              • 부가세 포함 가격입니다
            </p>
          </div>

          <button
            onClick={handlePayment}
            disabled={loading || !customerKey}
            className={`w-full py-3 px-4 rounded-md text-white font-medium transition-colors ${
              loading || !customerKey
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? '처리 중...' : '결제하기'}
          </button>

          <button
            onClick={() => router.push('/admin')}
            className="w-full mt-3 py-2 px-4 text-gray-600 hover:text-gray-800 text-sm"
          >
            관리자 페이지로 돌아가기
          </button>
        </div>

        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600">
            결제는 안전하게 토스페이먼츠를 통해 처리됩니다
          </p>
        </div>
      </div>
    </div>
  );
}