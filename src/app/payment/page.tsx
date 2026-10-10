'use client';

import React, {useEffect, useState, useCallback, Suspense} from 'react';
import {useRouter, useSearchParams} from 'next/navigation';
import {loadTossPayments} from '@tosspayments/payment-sdk';
import {
    SubscriptionType,
    SubscriptionBillingType,
    SubscriptionRequestDTO,
    SubscriptionResponseDTO,
    SubscriptionStatus,
} from '@/types/subscription';
import {subscriptionService} from '@/services/subscription';
import {useAlert} from '@/components/Alert';
import confetti from 'canvas-confetti';
import { Card } from '@astryxdesign/core/Card';
import { Button } from '@astryxdesign/core/Button';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { Banner } from '@astryxdesign/core/Banner';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Text, Heading } from '@astryxdesign/core/Text';
import { Icon } from '@astryxdesign/core/Icon';
import { Divider } from '@astryxdesign/core/Divider';
import { Loading } from '@/components/Loading';
import SiteFooter from '@/components/SiteFooter';
import { readAuthState, loginPathFor, type AuthState } from '@/lib/authState';
import { BUSINESS_INFO, LEGAL_LINKS } from '@/lib/businessInfo';
import { BASIC_PLAN, PLAN_FEATURES, formatKoreanDate, nextBillingDate } from '@/lib/pricing';

// 토스페이먼츠 클라이언트 키
const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_PAYMENT_CLIENT_KEY;

/**
 * 정기 구독 약관 (결제 화면에서 펼쳐 보는 요약본).
 * 예전 문구는 '특별한 해지 방법이 없다'(실제로는 구독 취소가 있다)거나, 상호가 '(주)실버리즘'으로
 * 사업자등록증과 달랐고, 환불 기준도 이용약관 제20조와 어긋났다. 요금·환불 정책 페이지와 같은 내용으로 맞춘다.
 */
const SUBSCRIPTION_TERMS: Array<{ title: string; body: string }> = [
    {
        title: '제1조 (목적)',
        body: `본 약관은 ${BUSINESS_INFO.companyName}(이하 "회사")가 제공하는 케어브이 서비스의 정기 구독 서비스(이하 "정기 구독 서비스")에 가입하고 결제한 회원(이하 "구독자")과 회사 사이의 권리, 의무 및 책임사항, 기타 필요한 사항을 규정하는 것을 목적으로 합니다.`,
    },
    {
        title: '제2조 (용어의 정의)',
        body: '본 약관에서 사용하는 주요 용어의 정의는 케어브이 서비스 이용약관(이하 "이용약관")을 따릅니다.',
    },
    {
        title: '제3조 (가입과 결제 방식)',
        body: `구독자는 결제 화면에서 결제 수단(카드)을 등록하고 결제하기 버튼을 눌러 정기 구독 서비스에 가입합니다. 가입과 동시에 첫 1개월 요금 ${BASIC_PLAN.chargeLabel}이 결제되며, 이후 해지하기 전까지 이용 기간이 끝날 때마다 등록한 결제 수단으로 다음 1개월 요금이 자동 결제되는 것에 동의합니다.`,
    },
    {
        title: '제4조 (구독 중 생성된 콘텐츠의 유효기간)',
        body: '구독자가 구독 중 생성한 콘텐츠의 유효기간은 구독기간 내에 한하며, 사용자의 구독 콘텐츠 이용 시 이를 고지합니다.',
    },
    {
        title: '제5조 (해지 방법)',
        body: '구독자는 언제든지 관리자 화면의 [기관 프로필] → 구독 정보에서 구독을 취소(해지)할 수 있습니다. 해지하면 다음 자동 결제가 이뤄지지 않으며, 이미 결제한 이용 기간이 끝날 때까지 서비스를 이용할 수 있습니다.',
    },
    {
        title: '제6조 (청약철회 및 환불)',
        body: `결제일로부터 7일 이내이고 서비스 이용 내역이 없으면 전액 환불합니다. 이용 내역이 있으면 이용약관 제20조에 따라 이용한 일수에 해당하는 금액을 뺀 나머지를 환불합니다. 환불은 고객센터(${BUSINESS_INFO.email}, ${BUSINESS_INFO.phone})로 신청하며, 결제한 수단으로 3영업일 안에 처리합니다.`,
    },
    {
        title: '제7조 (구독제 변경 및 중단)',
        body: '회사는 구독자의 구독 혜택을 유지하기 위해 합리적으로 운영을 지속할 의무가 있습니다.',
    },
    {
        title: '제8조 (구독 요금)',
        body: '정기 구독 서비스의 요금은 케어브이 홈페이지의 요금·환불 정책에 게재합니다. 구독 요금을 변경하는 경우 변경 전에 구독자에게 미리 알립니다.',
    },
];

/*
 * 로그인 전 카드 등록.
 * 로그인하지 않은 방문자(심사 담당자 포함)도 토스 카드 등록창을 열 수 있다. 등록창에는 이 탭에서만
 * 쓰는 임시 customerKey를 넘기고, 돌아온 authKey는 결제하지 않은 채 sessionStorage에 잠시 맡겨 둔다.
 * 관리자로 로그인해 이 화면으로 돌아오면 그 카드로 결제를 마친다. 실제 결제는 서버가 authKey로
 * 빌링키를 발급받을 때 일어나므로 로그인 전에는 돈이 나가지 않는다.
 * 서버는 빌링키와 짝인 customerKey를 계정에 함께 저장한다(api-server fd7f1e4) — 그래야 다음 달
 * 자동결제가 같은 키로 나간다. 그 배포 전에는 이 흐름을 열면 안 된다.
 */
const PENDING_BILLING_STORAGE_KEY = 'carev:pendingBillingAuth';
const GUEST_CUSTOMER_KEY_STORAGE_KEY = 'carev:guestBillingCustomerKey';
/** 맡겨 둔 카드 등록 결과를 쓸 수 있는 시간. 넘으면 카드를 다시 등록하게 한다. */
const PENDING_BILLING_TTL_MS = 30 * 60 * 1000;

interface PendingBillingAuth {
    authKey: string;
    customerKey: string;
    savedAt: number;
}

function guestCustomerKey(): string {
    let key = sessionStorage.getItem(GUEST_CUSTOMER_KEY_STORAGE_KEY);
    if (!key) {
        key = `guest_${crypto.randomUUID()}`;
        sessionStorage.setItem(GUEST_CUSTOMER_KEY_STORAGE_KEY, key);
    }
    return key;
}

function readPendingBilling(): PendingBillingAuth | null {
    try {
        const raw = sessionStorage.getItem(PENDING_BILLING_STORAGE_KEY);
        if (!raw) return null;
        const pending = JSON.parse(raw) as PendingBillingAuth;
        if (!pending.authKey || !pending.customerKey || Date.now() - pending.savedAt > PENDING_BILLING_TTL_MS) {
            sessionStorage.removeItem(PENDING_BILLING_STORAGE_KEY);
            return null;
        }
        return pending;
    } catch {
        return null;
    }
}

function savePendingBilling(pending: PendingBillingAuth): void {
    try {
        sessionStorage.setItem(PENDING_BILLING_STORAGE_KEY, JSON.stringify(pending));
    } catch {
        // 저장할 수 없으면 로그인 뒤 카드를 다시 등록하게 된다
    }
}

function clearPendingBilling(): void {
    try {
        sessionStorage.removeItem(PENDING_BILLING_STORAGE_KEY);
        sessionStorage.removeItem(GUEST_CUSTOMER_KEY_STORAGE_KEY);
    } catch {
        // 무시
    }
}

function PaymentPageContent() {
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
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);
    const [userInfoLoaded, setUserInfoLoaded] = useState(false);
    // 누가 보고 있는지 — 마운트 전(null)에는 결제 버튼 영역을 그리지 않는다
    const [authState, setAuthState] = useState<AuthState | null>(null);
    // 관리자가 이미 유료 구독 중이면 다시 결제하지 않게 막는다 (서버는 중복 결제를 막지 않는다)
    const [currentSubscription, setCurrentSubscription] = useState<SubscriptionResponseDTO | null>(null);
    const [subscriptionChecked, setSubscriptionChecked] = useState(false);
    // 로그인 전에 등록해 둔 카드 (아직 결제 안 됨)
    const [pendingBilling, setPendingBilling] = useState<PendingBillingAuth | null>(null);

    /*
     * 이 화면은 로그인 여부와 상관없이 열린다. 요금제의 결제 버튼과 PG 심사 담당자가
     * 로그인 없이 들어와도 상품·금액·정기결제 조건·환불 정책을 볼 수 있어야 하기 때문이다.
     * 예전에는 비로그인으로 들어오면 "결제자 정보가 누락되었습니다"만 뜨고 버튼이 잠겨
     * 다음으로 갈 길이 없었다. 카드 등록창은 누구나 열 수 있고, 결제 완료만 관리자 로그인 뒤에 한다.
     * 직원·체험 계정도 카드는 등록할 수 있지만 결제는 기관 관리자 계정으로 로그인해야 끝난다.
     */
    useEffect(() => {
        const state = readAuthState();
        setAuthState(state);
        setPendingBilling(readPendingBilling());
        if (state !== 'admin') {
            setSubscriptionChecked(true);
            return;
        }
        subscriptionService
            .getMySubscription()
            .then(setCurrentSubscription)
            .catch(() => setCurrentSubscription(null)) // 404 = 아직 구독 없음 → 결제 가능
            .finally(() => setSubscriptionChecked(true));
    }, []);

    useEffect(() => {
        // localStorage에서 사용자 정보 가져오기
        const storedCustomerKey = localStorage.getItem('customerKey');
        const userName = localStorage.getItem('userName') || '';
        const userEmail = localStorage.getItem('userEmail') || '';
        const userId = localStorage.getItem('userId') || '';

        // customerKey가 없으면 userId를 기반으로 생성
        const key = storedCustomerKey || `user_${userId}`;
        setCustomerKey(key);

        setUserInfo({
            name: userName,
            email: userEmail || '' // 이메일이 없으면 빈 문자열로 설정
        });

        // 사용자 정보 로딩 완료 표시
        setUserInfoLoaded(true);

        // 디버깅: 로드된 사용자 정보 확인
        console.log('Payment page - loaded user info:', {
            userName,
            userEmail,
            userId,
            customerKey: key
        });

    }, []);

    // billingCustomerKey: 카드 등록창에 넘겼던 customerKey. 로그인 전에 등록했다면 임시 키라
    // 계정의 customerKey와 다르다 — 빌링키 발급은 반드시 등록 때 키로 해야 한다.
    const handleBillingSuccess = useCallback(async (authKey: string, billingCustomerKey: string) => {
        try {
            setLoading(true);

            // 사용자 정보 유효성 검사
            if (!userInfo.email || !userInfo.name || !billingCustomerKey) {
                showAlert({
                    type: 'error',
                    title: '사용자 정보 오류',
                    message: '사용자 정보가 불완전합니다. 페이지를 새로고침 후 다시 시도해주세요.'
                });
                return;
            }

            // 보안: authKey를 변수에서 즉시 제거 (메모리에서 빠른 해제)
            const subscriptionData: SubscriptionRequestDTO = {
                planName: SubscriptionType.BASIC,
                billingType: SubscriptionBillingType.MONTHLY,
                amount: BASIC_PLAN.monthlyAmount,
                customerKey: billingCustomerKey,
                authKey: authKey,
                orderName: BASIC_PLAN.orderName,
                customerEmail: userInfo.email,
                customerName: userInfo.name,
                taxFreeAmount: 0
            };

            // authKey 사용 후 즉시 변수 초기화 (보안)
            authKey = '';

            try {
                await subscriptionService.createOrUpdateSubscription(subscriptionData);
            } finally {
                // authKey는 한 번 쓰면 끝이다 — 성공·실패와 상관없이 맡겨 둔 카드 등록 결과를 버린다
                clearPendingBilling();
                setPendingBilling(null);
            }

            // 폭죽 애니메이션 실행
            const duration = 3000;
            const end = Date.now() + duration;

            const colors = ['#FFD700', '#FF69B4', '#00CED1', '#FFA500', '#98FB98'];

            (function frame() {
                confetti({
                    particleCount: 2,
                    angle: 60,
                    spread: 55,
                    origin: { x: 0 },
                    colors: colors
                });
                confetti({
                    particleCount: 2,
                    angle: 120,
                    spread: 55,
                    origin: { x: 1 },
                    colors: colors
                });

                if (Date.now() < end) {
                    requestAnimationFrame(frame);
                }
            }());

            // 추가 폭죽 효과
            setTimeout(() => {
                confetti({
                    particleCount: 100,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: colors
                });
            }, 500);

            showAlert({
              type: 'success',
              title: '🎉 결제 완료! 🎉',
              message: '축하합니다! 결제가 성공적으로 완료되었습니다.\nBasic 플랜을 이용하실 수 있습니다.'
            });

            // 3초 후 리다이렉트
            setTimeout(() => {
                router.push('/admin');
            }, 3000);
        } catch (error: any) {
            // 에러 메시지 파싱
            let errorMessage = '구독 활성화에 실패했습니다. 고객센터에 문의해주세요.';
            let errorTitle = '구독 활성화 실패';

            try {
                if (error?.message) {
                    const errorString = error.message;

                    // 내부 시스템 에러 필터링 (사용자에게 노출하지 않음)
                    const internalErrors = [
                        'User not found with email',
                        'Internal server error',
                        'Database connection',
                        'Null pointer',
                        'Authentication failed',
                        'Token expired',
                        'Unauthorized access'
                    ];

                    const isInternalError = internalErrors.some(pattern =>
                        errorString.toLowerCase().includes(pattern.toLowerCase())
                    );

                    // 내부 에러인 경우 결제 관련 에러만 추출
                    if (isInternalError) {
                        // 결제 실패 관련 JSON만 추출
                        const paymentErrorMatch = errorString.match(/결제 실패[^{]*({[^}]*code[^}]*})/);
                        if (paymentErrorMatch) {
                            const paymentErrorData = JSON.parse(paymentErrorMatch[1]);
                            if (paymentErrorData.message) {
                                errorMessage = paymentErrorData.message;

                                // 결제 에러 코드에 따른 제목 및 메시지 설정
                                switch (paymentErrorData.code) {
                                    case 'REJECT_ACCOUNT_PAYMENT':
                                        errorTitle = '결제 실패 - 잔액 부족';
                                        errorMessage = paymentErrorData.message + '\n\n다른 결제 수단을 이용해 주세요.';
                                        break;
                                    case 'REJECT_CARD_PAYMENT':
                                        errorTitle = '결제 실패 - 카드 오류';
                                        errorMessage = paymentErrorData.message + '\n\n카드 정보를 확인하거나 다른 카드를 이용해 주세요.';
                                        break;
                                    case 'NOT_FOUND_BILLING':
                                        errorTitle = '결제 실패 - 빌링 정보 오류';
                                        errorMessage = paymentErrorData.message + '\n\n페이지를 새로고침 후 다시 시도해 주세요.';
                                        break;
                                    default:
                                        errorTitle = '결제 실패';
                                        errorMessage = paymentErrorData.message;
                                }
                            }
                        }
                        // 내부 에러이지만 결제 정보가 없는 경우 기본 메시지 사용하고 진행
                    }
                    // 내부 에러가 아닌 경우 또는 결제 정보 추출 후 일반 JSON 파싱
                    else if (errorString.includes('{') && errorString.includes('}')) {
                        const jsonMatch = errorString.match(/{.*}/);
                        if (jsonMatch) {
                            const errorData = JSON.parse(jsonMatch[0]);
                            if (errorData.message) {
                                errorMessage = errorData.message;

                                // 에러 코드에 따른 제목 및 메시지 설정
                                switch (errorData.code) {
                                    case 'REJECT_ACCOUNT_PAYMENT':
                                        errorTitle = '결제 실패 - 잔액 부족';
                                        errorMessage = errorData.message + '\n\n다른 결제 수단을 이용해 주세요.';
                                        break;
                                    case 'REJECT_CARD_PAYMENT':
                                        errorTitle = '결제 실패 - 카드 오류';
                                        errorMessage = errorData.message + '\n\n카드 정보를 확인하거나 다른 카드를 이용해 주세요.';
                                        break;
                                    case 'INVALID_REQUEST':
                                        errorTitle = '결제 실패 - 요청 오류';
                                        errorMessage = errorData.message + '\n\n잠시 후 다시 시도해 주세요.';
                                        break;
                                    case 'NOT_FOUND_BILLING':
                                        errorTitle = '결제 실패 - 빌링 정보 오류';
                                        errorMessage = errorData.message + '\n\n페이지를 새로고침 후 다시 시도해 주세요.';
                                        break;
                                    case 'INVALID_CARD_COMPANY':
                                        errorTitle = '결제 실패 - 지원하지 않는 카드';
                                        break;
                                    case 'INVALID_CARD_NUMBER':
                                        errorTitle = '결제 실패 - 잘못된 카드번호';
                                        break;
                                    case 'INVALID_EXPIRED_YEAR':
                                    case 'INVALID_EXPIRED_MONTH':
                                        errorTitle = '결제 실패 - 카드 유효기간 오류';
                                        break;
                                    case 'INVALID_BIRTH':
                                        errorTitle = '결제 실패 - 생년월일 오류';
                                        break;
                                    case 'INVALID_PASSWORD':
                                        errorTitle = '결제 실패 - 비밀번호 오류';
                                        break;
                                    case 'REJECT_CARD_COMPANY':
                                        errorTitle = '결제 실패 - 카드사 거절';
                                        break;
                                    case 'FAILED_PAYMENT_INTERNAL_SYSTEM_PROCESSING':
                                        errorTitle = '결제 실패 - 시스템 오류';
                                        break;
                                    case 'FAILED_INTERNAL_SYSTEM_PROCESSING':
                                        errorTitle = '결제 실패 - 내부 시스템 오류';
                                        break;
                                    case 'UNAUTHORIZED_REQUEST':
                                        errorTitle = '결제 실패 - 인증 오류';
                                        break;
                                    default:
                                        errorTitle = '결제 실패';
                                }
                            }
                        }
                    }
                    // 일반 문자열 에러 메시지
                    else if (errorString.length > 0) {
                        errorMessage = errorString;
                    }
                }
            } catch (parseError) {
                console.error('에러 메시지 파싱 실패:', parseError);
                // 파싱 실패 시 기본 메시지 유지
            }

            console.error('구독 생성 실패:', {
                title: errorTitle,
                message: errorMessage,
                originalError: error?.message
            });

            showAlert({
              type: 'error',
              title: errorTitle,
              message: errorMessage
            });
        } finally {
            setLoading(false);
        }
    }, [userInfo.email, userInfo.name, showAlert, router]);

    // 빌링 인증 성공 처리
    useEffect(() => {
        // 사용자 정보·로그인 상태를 알기 전에는 대기
        if (!userInfoLoaded || authState === null) {
            return;
        }

        const authKey = searchParams.get('authKey');
        const customerKeyParam = searchParams.get('customerKey');

        if (authKey && customerKeyParam && !isProcessingPayment) {
            // 보안 검증: authKey 형식 확인 (TossPayments authKey는 특정 패턴을 가짐)
            if (!authKey.match(/^[A-Za-z0-9_-]+$/)) {
                console.error('유효하지 않은 authKey 형식');
                showAlert({
                    type: 'error',
                    title: '결제 오류',
                    message: '결제 정보가 유효하지 않습니다.'
                });
                return;
            }

            // 처리 중 플래그 설정 (중복 실행 방지)
            setIsProcessingPayment(true);

            // 보안: 즉시 URL에서 민감한 정보 제거
            const url = new URL(window.location.href);
            url.searchParams.delete('authKey');
            url.searchParams.delete('customerKey');
            window.history.replaceState({}, '', url.toString());

            if (authState !== 'admin') {
                // 로그인 전 카드 등록 — 결제하지 않고 맡겨 둔 뒤 관리자 로그인을 안내한다
                const pending = { authKey, customerKey: customerKeyParam, savedAt: Date.now() };
                savePendingBilling(pending);
                setPendingBilling(pending);
                setIsProcessingPayment(false);
                showAlert({
                    type: 'success',
                    title: '카드 등록 완료',
                    message: '아직 결제되지 않았습니다. 관리자 계정으로 로그인하면 이 카드로 결제가 완료됩니다.',
                });
                return;
            }

            handleBillingSuccess(authKey, customerKeyParam).finally(() => {
                setIsProcessingPayment(false);
            });
        }
    }, [searchParams, handleBillingSuccess, showAlert, userInfoLoaded, isProcessingPayment, authState]);

    const handlePayment = async () => {
        const isAdmin = authState === 'admin';

        if (isAdmin && !customerKey) {
            showAlert({
              type: 'error',
              title: '사용자 정보 오류',
              message: '사용자 정보를 불러올 수 없습니다. 다시 로그인해주세요.'
            });
            return;
        }

        if (isAdmin && !userInfo.email) {
            showAlert({
              type: 'error',
              title: '이메일 정보 누락',
              message: '이메일 정보가 필요합니다. 다시 로그인해주세요.'
            });
            router.push(loginPathFor('/payment'));
            return;
        }

        if (!agreementChecked) {
            showAlert({
              type: 'warning',
              title: '약관 동의 필수',
              message: '정기결제 내용과 이용약관·환불 정책에 동의해주세요.'
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

            // 토스페이먼츠 빌링 인증 위젯 호출 (구독 결제용)
            // 로그인 전이면 이 탭 전용 임시 customerKey로 카드를 등록한다 (위 '로그인 전 카드 등록' 참고)
            await tossPayments.requestBillingAuth('카드', {
                customerKey: isAdmin ? customerKey : guestCustomerKey(),
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
        if (authState === null) return;
        const success = searchParams.get('success');
        if (success === 'false') {
            showAlert({
              type: 'info',
              title: '결제 취소',
              message: '결제가 취소되었습니다.'
            });
            if (authState === 'admin') {
                router.push('/subscription-check');
            } else {
                // 로그인 전이면 구독 확인 화면이 로그인으로 튕겨 낸다 — 이 화면에 남겨 다시 시도하게 한다
                const url = new URL(window.location.href);
                ['success', 'code', 'message'].forEach((param) => url.searchParams.delete(param));
                window.history.replaceState({}, '', url.toString());
            }
        }
    }, [searchParams, router, showAlert, authState]);

    // 이미 결제한 이용 기간이 남아 있는 유료 구독 — 다시 결제하면 한 달 요금이 또 나간다
    const hasPaidPeriodLeft =
        !!currentSubscription &&
        currentSubscription.planName === SubscriptionType.BASIC &&
        (currentSubscription.status === SubscriptionStatus.ACTIVE ||
            currentSubscription.status === SubscriptionStatus.CANCELLED) &&
        new Date(currentSubscription.endDate).getTime() > Date.now();
    // 카드 등록창을 열 수 있는 상태 — 로그인 여부와 상관없다. 이미 이용 중이거나 등록해 둔 카드가 있으면 닫는다
    const canPay = authState !== null && subscriptionChecked && !hasPaidPeriodLeft && !pendingBilling;
    const missingPayerInfo = authState === 'admin' && userInfoLoaded && (!userInfo.name || !userInfo.email);
    const billingDate = nextBillingDate();

    const billingTerms: Array<{ label: string; value: React.ReactNode }> = [
        { label: '상품', value: `${BASIC_PLAN.name} (케어브이 전 기능 이용권)` },
        { label: '결제 금액', value: BASIC_PLAN.amountLabel },
        { label: '결제 방식', value: '카드 등록 후 매월 자동 결제 (정기결제)' },
        {
            label: '첫 결제',
            value: authState === 'admin'
                ? '카드 등록 즉시 첫 달 요금 결제'
                : '카드 등록 후 관리자 계정으로 로그인하면 첫 달 요금 결제',
        },
        { label: '다음 결제일', value: `${formatKoreanDate(billingDate)} (이후 매월 같은 날)` },
        { label: '해지', value: '기관 프로필 → 구독 정보에서 언제든 해지, 해지해도 결제한 기간까지 이용' },
        {
            label: '환불',
            value: (
                <a href={LEGAL_LINKS.refund} style={{ color: 'var(--color-text-accent)' }}>
                    7일 이내 미이용 시 전액 환불 · 요금·환불 정책 보기
                </a>
            ),
        },
    ];

    // 이미 이용 중인 관리자에게 맡겨 둔 카드가 있으면 결제하지 않고 버린다 (이중 결제 방지)
    useEffect(() => {
        if (authState === 'admin' && hasPaidPeriodLeft && pendingBilling) {
            clearPendingBilling();
            setPendingBilling(null);
        }
    }, [authState, hasPaidPeriodLeft, pendingBilling]);

    const signupForPaymentPath = `/signup?redirect=${encodeURIComponent('/payment')}`;
    const completePendingBilling = () => {
        if (pendingBilling) void handleBillingSuccess(pendingBilling.authKey, pendingBilling.customerKey);
    };
    const discardPendingBilling = () => {
        clearPendingBilling();
        setPendingBilling(null);
    };

    const backAction =
        authState === 'admin' || authState === 'demo'
            ? { label: '관리자 페이지로 돌아가기', href: '/admin' }
            : authState === 'employee'
              ? { label: '직원 화면으로 돌아가기', href: '/employee' }
              : { label: '요금제로 돌아가기', href: '/#pricing' };

    return (
        <>
            <AlertContainer />
            <div style={{ minHeight: '100vh', background: 'var(--color-background-muted)' }}>
                <div style={{ maxWidth: 520, margin: '0 auto', padding: 'var(--spacing-12) var(--spacing-4)' }}>
                    <VStack gap={4}>
                        <Card width="100%" padding={6}>
                            <VStack gap={6}>
                                <Heading level={1}>{BASIC_PLAN.name} 결제</Heading>

                                {/* 방문자 상태별 안내 — 결제하려면 무엇을 해야 하는지 먼저 알려준다 */}
                                {authState !== null && authState !== 'admin' && pendingBilling && (
                                    <Banner
                                        status="success"
                                        title="카드 등록이 끝났습니다 — 아직 결제되지 않았습니다"
                                        description="기관 관리자 계정으로 로그인하면 이 카드로 첫 달 요금이 결제됩니다. 계정이 없으면 회원가입 후 로그인해주세요."
                                    />
                                )}
                                {authState === 'admin' && pendingBilling && !hasPaidPeriodLeft && (
                                    <Banner
                                        status="info"
                                        title="로그인 전에 등록한 카드로 결제를 마칩니다"
                                        description={`아래 버튼을 누르면 ${userInfo.email || '이'} 계정으로 ${BASIC_PLAN.name} 첫 달 요금 ${BASIC_PLAN.chargeLabel}이 결제되고, 이후 매월 자동 결제됩니다.`}
                                    />
                                )}
                                {authState === 'guest' && !pendingBilling && (
                                    <Banner
                                        status="info"
                                        title="로그인하지 않아도 카드 등록까지 진행할 수 있습니다"
                                        description="결제는 카드를 등록한 뒤 기관 관리자 계정으로 로그인하면 완료됩니다. 계정이 없으면 회원가입 후 30일 무료 체험부터 시작할 수도 있습니다."
                                    />
                                )}
                                {authState === 'employee' && !pendingBilling && (
                                    <Banner
                                        status="info"
                                        title="결제는 기관 관리자 계정으로 완료됩니다"
                                        description="카드를 등록한 뒤 관리자 계정으로 로그인해야 결제가 끝납니다. 직원 계정으로는 결제되지 않습니다."
                                    />
                                )}
                                {authState === 'demo' && !pendingBilling && (
                                    <Banner
                                        status="info"
                                        title="체험 계정으로는 결제가 완료되지 않습니다"
                                        description="카드를 등록한 뒤 정식으로 가입한 관리자 계정으로 로그인하면 결제가 끝납니다."
                                    />
                                )}
                                {authState === 'admin' && hasPaidPeriodLeft && currentSubscription && (
                                    <Banner
                                        status="success"
                                        title={
                                            currentSubscription.status === SubscriptionStatus.CANCELLED
                                                ? '해지 예약된 Basic 플랜이 남아 있습니다'
                                                : '이미 Basic 플랜을 이용 중입니다'
                                        }
                                        description={
                                            currentSubscription.status === SubscriptionStatus.CANCELLED
                                                ? `${formatKoreanDate(new Date(currentSubscription.endDate))}까지 이용할 수 있습니다. 계속 쓰시려면 구독 관리에서 다시 활성화해주세요 — 새로 결제할 필요는 없습니다.`
                                                : `다음 자동 결제일은 ${formatKoreanDate(new Date(currentSubscription.endDate))}입니다. 다시 결제할 필요가 없습니다.`
                                        }
                                    />
                                )}

                                {/* 결제자 정보 — 로그인한 관리자에게만 의미가 있다 */}
                                {authState === 'admin' && (
                                    <div style={{ width: '100%', background: 'var(--color-background-muted)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-container)', padding: 'var(--spacing-4)' }}>
                                        <VStack gap={2}>
                                            <Text type="label">결제자 정보</Text>
                                            <VStack gap={1}>
                                                <HStack gap={1}>
                                                    <Text type="body" weight="medium">이름:</Text>
                                                    <Text type="body" color="secondary">{userInfo.name || '정보 없음'}</Text>
                                                </HStack>
                                                <HStack gap={1}>
                                                    <Text type="body" weight="medium">이메일:</Text>
                                                    <Text type="body" color="secondary">{userInfo.email || '정보 없음'}</Text>
                                                </HStack>
                                            </VStack>
                                            {missingPayerInfo && (
                                                <Banner
                                                    status="error"
                                                    title="결제자 정보가 누락되었습니다. 다시 로그인해주세요."
                                                />
                                            )}
                                        </VStack>
                                    </div>
                                )}

                                {/* 플랜 가격 */}
                                <div style={{ width: '100%', background: 'var(--color-background-blue)', border: '1px solid var(--color-border-blue)', borderRadius: 'var(--radius-container)', padding: 'var(--spacing-4)' }}>
                                    <VStack gap={1}>
                                        <Text type="large" weight="semibold">{BASIC_PLAN.name}</Text>
                                        <HStack gap={1} vAlign="end">
                                            <Text type="display-2" weight="bold">{BASIC_PLAN.priceLabel}</Text>
                                            <Text type="supporting">/월 (부가세 포함)</Text>
                                        </HStack>
                                    </VStack>
                                </div>

                                {/* 정기결제 조건 — 카드 등록 전에 금액·주기·결제일·해지·환불을 모두 보여준다 */}
                                <VStack gap={3}>
                                    <Text type="label">정기결제 안내</Text>
                                    <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: 'var(--spacing-4)', rowGap: 'var(--spacing-2)' }}>
                                        {billingTerms.map((term) => (
                                            <React.Fragment key={term.label}>
                                                <dt><Text type="body" weight="medium">{term.label}</Text></dt>
                                                <dd style={{ margin: 0 }}><Text type="body" color="secondary">{term.value}</Text></dd>
                                            </React.Fragment>
                                        ))}
                                    </dl>
                                </VStack>

                                {/* 플랜 혜택 */}
                                <VStack gap={3}>
                                    <Text type="label">플랜 혜택</Text>
                                    <VStack gap={2}>
                                        {PLAN_FEATURES.map((feature) => (
                                            <HStack key={feature} gap={2} vAlign="start">
                                                <Icon icon="check" color="success" size="sm" />
                                                <Text type="body" color="secondary">{feature}</Text>
                                            </HStack>
                                        ))}
                                    </VStack>
                                </VStack>

                                <Divider />

                                {/* 약관 동의 — 결제할 수 있는 관리자만 체크한다. 약관 내용은 누구나 펼쳐 볼 수 있다 */}
                                <VStack gap={3}>
                                    {canPay ? (
                                        <HStack gap={1} vAlign="center" wrap="wrap">
                                            <CheckboxInput
                                                label={`위 정기결제 내용(${BASIC_PLAN.amountLabel} 자동 결제)과 이용약관·환불 정책에 동의합니다`}
                                                value={agreementChecked}
                                                onChange={(checked) => setAgreementChecked(checked)}
                                                size="sm"
                                            />
                                            <Button
                                                label="(약관 보기)"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setShowTerms(!showTerms)}
                                            />
                                        </HStack>
                                    ) : (
                                        <HStack>
                                            <Button
                                                label={showTerms ? '정기 구독 약관 접기' : '정기 구독 약관 보기'}
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setShowTerms(!showTerms)}
                                            />
                                        </HStack>
                                    )}

                                    {/* 약관 내용 */}
                                    {showTerms && (
                                        <div style={{ maxHeight: 256, overflowY: 'auto' }}>
                                            <div style={{ width: '100%', background: 'var(--color-background-muted)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-container)', padding: 'var(--spacing-4)' }}>
                                                <VStack gap={3}>
                                                    <Text type="label">정기 구독 서비스 이용약관</Text>
                                                    <VStack gap={3}>
                                                        {SUBSCRIPTION_TERMS.map((article) => (
                                                            <VStack key={article.title} gap={1}>
                                                                <Text type="body" weight="medium">{article.title}</Text>
                                                                <Text type="body" color="secondary">{article.body}</Text>
                                                            </VStack>
                                                        ))}
                                                    </VStack>
                                                </VStack>
                                            </div>
                                        </div>
                                    )}
                                </VStack>

                                <VStack gap={3}>
                                    {authState === null || (authState === 'admin' && !subscriptionChecked) ? (
                                        <Button label="결제 정보를 확인하는 중..." variant="primary" size="lg" isLoading isDisabled />
                                    ) : authState === 'admin' ? (
                                        hasPaidPeriodLeft ? (
                                            <Button
                                                label="구독 관리로 이동"
                                                variant="primary"
                                                size="lg"
                                                onClick={() => router.push('/subscription')}
                                            />
                                        ) : missingPayerInfo ? (
                                            <Button
                                                label="다시 로그인하기"
                                                variant="primary"
                                                size="lg"
                                                onClick={() => router.push(loginPathFor('/payment'))}
                                            />
                                        ) : pendingBilling ? (
                                            <>
                                                <Button
                                                    label={loading ? '처리 중...' : `${BASIC_PLAN.priceLabel} 결제 완료하기`}
                                                    variant="primary"
                                                    size="lg"
                                                    onClick={completePendingBilling}
                                                    isLoading={loading}
                                                    isDisabled={loading}
                                                />
                                                <Button
                                                    label="다른 카드로 다시 등록하기"
                                                    variant="secondary"
                                                    size="lg"
                                                    onClick={discardPendingBilling}
                                                    isDisabled={loading}
                                                />
                                            </>
                                        ) : (
                                            <Button
                                                label={loading ? '처리 중...' : `${BASIC_PLAN.priceLabel} 결제하기`}
                                                variant="primary"
                                                size="lg"
                                                onClick={handlePayment}
                                                isLoading={loading}
                                                isDisabled={loading || !customerKey || !agreementChecked}
                                            />
                                        )
                                    ) : pendingBilling ? (
                                        <>
                                            <Button
                                                label="관리자 계정으로 로그인하고 결제 완료"
                                                variant="primary"
                                                size="lg"
                                                onClick={() => router.push(loginPathFor('/payment'))}
                                            />
                                            <Button
                                                label="계정이 없으면 회원가입"
                                                variant="secondary"
                                                size="lg"
                                                onClick={() => router.push(signupForPaymentPath)}
                                            />
                                            <Button
                                                label="카드 다시 등록하기"
                                                variant="ghost"
                                                onClick={discardPendingBilling}
                                            />
                                        </>
                                    ) : (
                                        <>
                                            {/* 로그인 전에도 카드 등록창은 열린다 — 결제 완료만 관리자 로그인 뒤 */}
                                            <Button
                                                label={loading ? '처리 중...' : `${BASIC_PLAN.priceLabel} 결제하기`}
                                                variant="primary"
                                                size="lg"
                                                onClick={handlePayment}
                                                isLoading={loading}
                                                isDisabled={loading || !agreementChecked}
                                            />
                                            <Button
                                                label={
                                                    authState === 'demo'
                                                        ? '정식 회원가입하기'
                                                        : authState === 'employee'
                                                          ? '관리자 계정으로 먼저 로그인'
                                                          : '먼저 로그인하기'
                                                }
                                                variant="secondary"
                                                size="lg"
                                                onClick={() =>
                                                    router.push(authState === 'demo' ? signupForPaymentPath : loginPathFor('/payment'))
                                                }
                                            />
                                        </>
                                    )}
                                    <Button
                                        label={backAction.label}
                                        variant="ghost"
                                        onClick={() => router.push(backAction.href)}
                                    />
                                </VStack>
                            </VStack>
                        </Card>

                        <HStack hAlign="center">
                            <Text type="supporting">
                                결제는 안전하게 토스페이먼츠를 통해 처리됩니다
                            </Text>
                        </HStack>
                    </VStack>
                </div>
                <div style={{ background: 'var(--color-background-surface)' }}>
                    <SiteFooter />
                </div>
            </div>
        </>
    );
}

// useSearchParams()는 Suspense 경계가 필요하다 (정적 프리렌더 시 CSR bailout).
export default function PaymentPage() {
    return (
        <Suspense fallback={<Loading size="page" height="100vh" label="결제 화면을 준비하는 중..." />}>
            <PaymentPageContent />
        </Suspense>
    );
}
