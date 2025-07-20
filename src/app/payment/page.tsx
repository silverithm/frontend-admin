'use client';

import {useEffect, useState} from 'react';
import {useRouter, useSearchParams} from 'next/navigation';
import {loadTossPayments} from '@tosspayments/payment-sdk';
import {SubscriptionType, SubscriptionBillingType, SubscriptionRequestDTO} from '@/types/subscription';
import {subscriptionService} from '@/services/subscription';
import {useAlert} from '@/components/Alert';

// 토스페이먼츠 클라이언트 키
const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_PAYMENT_CLIENT_KEY;

export default function PaymentPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { showAlert, AlertContainer } = useAlert();
    const [loading, setLoading] = useState(false);
    const [customerKey, setCustomerKey] = useState<string>('');
    const [userInfo, setUserInfo] = useState({
        name: '',
        email: ''
    });
    const [agreementChecked, setAgreementChecked] = useState(false);
    const [showTerms, setShowTerms] = useState(false);

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

            showAlert({
              type: 'success',
              title: '결제 완료',
              message: '결제가 완료되었습니다! Basic 플랜을 이용하실 수 있습니다.'
            });
            router.push('/admin');
        } catch (error) {
            console.error('구독 생성 실패:', error);
            showAlert({
              type: 'warning',
              title: '구독 활성화 실패',
              message: '결제는 완료되었으나 구독 활성화에 실패했습니다. 고객센터에 문의해주세요.'
            });
        } finally {
            setLoading(false);
        }
    };

    const handlePayment = async () => {
        if (!customerKey) {
            showAlert({
              type: 'error',
              title: '사용자 정보 오류',
              message: '사용자 정보를 불러올 수 없습니다. 다시 로그인해주세요.'
            });
            return;
        }

        if (!agreementChecked) {
            showAlert({
              type: 'warning',
              title: '약관 동의 필수',
              message: '정기 구독 서비스 이용약관에 동의해주세요.'
            });
            return;
        }

        if (!TOSS_CLIENT_KEY) {
            showAlert({
              type: 'error',
              title: '결제 설정 오류',
              message: '결제 설정에 오류가 있습니다. 관리자에게 문의해주세요.'
            });
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
            showAlert({
              type: 'error',
              title: '결제 오류',
              message: '결제 중 오류가 발생했습니다.'
            });
        } finally {
            setLoading(false);
        }
    };

    // 결제 실패 처리
    useEffect(() => {
        const success = searchParams.get('success');
        if (success === 'false') {
            showAlert({
              type: 'info',
              title: '결제 취소',
              message: '결제가 취소되었습니다.'
            });
            router.push('/subscription-check');
        }
    }, [searchParams, router]);

    return (
        <>
            <AlertContainer />
            <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md mx-auto">
                <div className="bg-white shadow rounded-lg p-6">
                    <h1 className="text-2xl font-bold text-gray-900 mb-6">Basic 플랜 결제</h1>

                    <div className="mb-6">
                        <div className="bg-blue-50 rounded-lg p-4">
                            <h2 className="text-lg font-semibold text-blue-900 mb-2">Basic 플랜</h2>
                            <p className="text-3xl font-bold text-blue-900">₩9,900<span
                                className="text-sm font-normal">/월</span></p>
                        </div>
                    </div>

                    <div className="mb-6 space-y-3">
                        <h3 className="font-medium text-gray-700">플랜 혜택</h3>
                        <ul className="space-y-2 text-sm text-gray-600">
                            <li className="flex items-start">
                                <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" fill="currentColor"
                                     viewBox="0 0 20 20">
                                    <path fillRule="evenodd"
                                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                          clipRule="evenodd"/>
                                </svg>
                                모든 휴가 관리 기능 이용
                            </li>
                            <li className="flex items-start">
                                <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" fill="currentColor"
                                     viewBox="0 0 20 20">
                                    <path fillRule="evenodd"
                                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                          clipRule="evenodd"/>
                                </svg>
                                무제한 직원 등록
                            </li>
                            <li className="flex items-start">
                                <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" fill="currentColor"
                                     viewBox="0 0 20 20">
                                    <path fillRule="evenodd"
                                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                          clipRule="evenodd"/>
                                </svg>
                                실시간 알림 기능
                            </li>
                            <li className="flex items-start">
                                <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" fill="currentColor"
                                     viewBox="0 0 20 20">
                                    <path fillRule="evenodd"
                                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                          clipRule="evenodd"/>
                                </svg>
                                우선 고객 지원
                            </li>
                        </ul>
                    </div>

                    <div className="border-t pt-4">
                        <p className="text-sm text-gray-600 mb-4">
                            구독 서비스는 요금제에 따라 매월 또는 매년 자동 갱신되며, 별도의 해지 조치가 없는 한 정해진 구독 요금이 청구됩니다.
                        </p>
                    </div>

                    {/* 약관 동의 */}
                    <div className="border-t pt-4 mb-4">
                        <div className="flex items-start space-x-2">
                            <input
                                type="checkbox"
                                id="agreement"
                                checked={agreementChecked}
                                onChange={(e) => setAgreementChecked(e.target.checked)}
                                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <label htmlFor="agreement" className="text-sm text-gray-700">
                                <span className="font-medium">정기 구독 서비스 이용약관</span>에 동의합니다 
                                <button
                                    type="button"
                                    onClick={() => setShowTerms(!showTerms)}
                                    className="text-blue-600 hover:text-blue-700 ml-1 underline"
                                >
                                    (약관 보기)
                                </button>
                            </label>
                        </div>

                        {/* 약관 내용 */}
                        {showTerms && (
                            <div className="mt-4 p-4 bg-gray-50 rounded-lg max-h-64 overflow-y-auto text-sm text-gray-700">
                                <h4 className="font-semibold mb-2">정기 구독 서비스 이용약관</h4>
                                
                                <div className="space-y-3">
                                    <div>
                                        <h5 className="font-medium">제1조 (목적)</h5>
                                        <p>본 약관은 실버리즘(이하 &quot;회사&quot;)가 제공하는 서비스의 이용과 관련하여 일정 기간 서비스 이용을 보장하는 회사의 정기 구독 서비스(이하 &quot;정기 구독 서비스&quot;)에 가입 및 결제한 회원(이하 &quot;구독자&quot;) 사이의 권리, 의무 및 책임사항, 기타 필요한 사항을 규정하는 것을 목적으로 합니다.</p>
                                    </div>

                                    <div>
                                        <h5 className="font-medium">제2조 (용어의 정의)</h5>
                                        <p>본 약관에서 사용하는 주요 용어의 정의는 실버리즘 서비스 이용약관을 따릅니다.</p>
                                    </div>

                                    <div>
                                        <h5 className="font-medium">제3조 (정기 구독 서비스 가입과 결제방식)</h5>
                                        <p>회원은 정기 구독 서비스에 가입하기 위하여 사이트 내 버튼을 클릭하여 정기 구독 서비스 가입 화면인 &quot;요금제 – 결제 페이지&quot;(이하 &quot;요금제 안내 화면&quot;)에서 가입할 수 있습니다. 회원은 계약기간을 선택하고 가입하기 버튼을 클릭함으로써 회사와 구독 계약을 체결하게 되며, 구독자는 구매 시점에 제시된 가격으로 구독자에게 계약기간 동안의 구독료를 청구하도록 허용합니다.</p>
                                    </div>

                                    <div>
                                        <h5 className="font-medium">제4조 (구독중 생성된 콘텐츠의 유효기간)</h5>
                                        <p>구독자가 구독 중 생성한 콘텐츠의 유효기간은 구독기간 내에 한하며, 사용자의 구독 콘텐츠 이용 시 이를 고지합니다.</p>
                                    </div>

                                    <div>
                                        <h5 className="font-medium">제5조 (정기 구독 서비스 해지 방법)</h5>
                                        <p>구독자는 특별한 구독 해지 방법이 있지 아니하고, 구매한 구독기간 만큼 구독서비스를 제공받을 수 있습니다.</p>
                                    </div>

                                    <div>
                                        <h5 className="font-medium">제6조 (구독 철회 및 환불)</h5>
                                        <p>구독자는 구독 시작일 이후 정기 구독 서비스를 1회라도 사용했거나 구독 시작일 이후 7일이 지난 경우 구독을 철회할 수 없습니다. (구독 환불은 고객센터, 취소는 홈페이지 내 구독 관리 페이지에서 가능합니다.)</p>
                                    </div>

                                    <div>
                                        <h5 className="font-medium">제7조 (구독제 변경 및 중단)</h5>
                                        <p>회사는 구독자의 구독 혜택을 유지하기 위해 합리적으로 운영을 지속할 의무가 있습니다.</p>
                                    </div>

                                    <div>
                                        <h5 className="font-medium">제8조 (구독 요금)</h5>
                                        <p>&quot;정기 구독 서비스&quot;의 월 이용요금의 구체적인 내용은 (주)실버리즘 홈페이지 내 게재하며, 구독 요금은 회사의 요금정책에 따라 변경될 수 있습니다.</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handlePayment}
                        disabled={loading || !customerKey || !agreementChecked}
                        className={`w-full py-3 px-4 rounded-md text-white font-medium transition-colors ${
                            loading || !customerKey || !agreementChecked
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
        </>
    );
}