'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { SubscriptionResponseDTO, SubscriptionStatus, SubscriptionType } from '@/types/subscription';
import { subscriptionService } from '@/services/subscription';

export default function SubscriptionCheckPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionResponseDTO | null>(null);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [creatingFree, setCreatingFree] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      router.push('/login');
      return;
    }
    
    checkSubscription();
  }, [router]);

  const checkSubscription = async () => {
    try {
      setLoading(true);
      const data = await subscriptionService.getMySubscription();
      setSubscription(data);
      setHasSubscription(true);

      // 구독이 있고 활성 상태라면 관리자 페이지로 이동
      if (subscriptionService.isActive(data)) {
        router.push('/admin');
      }
    } catch (err: any) {
      // 404 에러이고 "No subscription found" 메시지인 경우에만 구독이 없다고 판단
      if (err.status === 404 && err.message.includes('No subscription found')) {
        setHasSubscription(false);
      } else {
        // 서버 오류인 경우 에러 메시지 표시
        setError('구독 정보를 확인하는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
        console.error('Subscription check error:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFreeSubscription = async () => {
    try {
      setCreatingFree(true);
      setError('');
      
      const newSubscription = await subscriptionService.createFreeSubscription();
      setSubscription(newSubscription);
      setHasSubscription(true);
      
      // 무료 구독 생성 성공 후 관리자 페이지로 이동
      router.push('/admin');
    } catch (err) {
      setError('무료 구독 생성에 실패했습니다. 다시 시도해주세요.');
      console.error('Free subscription creation error:', err);
    } finally {
      setCreatingFree(false);
    }
  };

  const handleGoToPayment = () => {
    router.push('/payment');
  };

  // 만료된 구독이 있는 경우
  const isExpiredSubscription = subscription && subscriptionService.needsPayment(subscription);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">구독 정보를 확인하는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-blue-900 to-indigo-900 text-white">
      {/* 헤더 */}
      <header className="bg-slate-900/50 backdrop-blur-sm border-b border-blue-800/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-center">
            <Image
              src="/images/logo-text.png"
              alt="케어브이 로고"
              width={140}
              height={47}
              className="transition-transform duration-300 hover:scale-105"
            />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-16">
        {/* 만료된 구독이 있는 경우 */}
        {isExpiredSubscription && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <div className="bg-red-500/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-red-400/20 mb-8">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center shadow-xl">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L4.316 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              
              <h1 className="text-3xl font-bold text-white mb-4">구독을 확인해주세요</h1>
              <p className="text-red-200/80 mb-6 text-lg leading-relaxed">
                현재 구독이 만료되었습니다. 서비스를 계속 이용하시려면 구독을 갱신해주세요.
              </p>

              {/* 현재 구독 상태 */}
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 mb-8">
                <h3 className="text-lg font-semibold text-white mb-4">현재 구독 상태</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="text-left">
                    <p className="text-blue-200/70">플랜: <span className="text-white font-medium">{subscription?.planName}</span></p>
                    <p className="text-blue-200/70">상태: <span className="text-red-400 font-medium">만료됨</span></p>
                  </div>
                  <div className="text-left">
                    <p className="text-blue-200/70">시작일: <span className="text-white font-medium">{subscription?.startDate ? new Date(subscription.startDate).toLocaleDateString() : '-'}</span></p>
                    <p className="text-blue-200/70">종료일: <span className="text-white font-medium">{subscription?.endDate ? new Date(subscription.endDate).toLocaleDateString() : '-'}</span></p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleGoToPayment}
                className="px-8 py-4 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-indigo-600 hover:scale-105 transition-all duration-300 shadow-xl"
              >
                구독 갱신하기 (월 9,900원)
              </button>
            </div>
          </motion.div>
        )}

        {/* 구독이 없는 경우 */}
        {!hasSubscription && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <div className="mb-12">
              <h1 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-white via-blue-100 to-indigo-100 bg-clip-text text-transparent">
                케어브이에 오신 것을 환영합니다!
              </h1>
              <p className="text-xl text-blue-100/90 leading-relaxed max-w-2xl mx-auto">
                효율적인 휴무 관리를 시작하기 위해 구독 플랜을 선택해주세요.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* 무료 체험 카드 */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-blue-400/20 hover:bg-white/15 transition-all duration-300"
              >
                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-xl">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                
                <h3 className="text-2xl font-bold text-white mb-4">30일 무료 체험</h3>
                <div className="text-4xl font-bold text-green-400 mb-4">무료</div>
                <p className="text-blue-100/80 mb-6 leading-relaxed">
                  케어브이의 모든 기능을 30일간 무료로 체험해보세요
                </p>
                
                <ul className="space-y-3 text-left text-blue-100/80 text-sm mb-8">
                  <li className="flex items-center">
                    <svg className="w-4 h-4 text-green-400 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    모든 휴가 관리 기능
                  </li>
                  <li className="flex items-center">
                    <svg className="w-4 h-4 text-green-400 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    직원 등록 및 관리
                  </li>
                  <li className="flex items-center">
                    <svg className="w-4 h-4 text-green-400 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    실시간 알림 및 승인
                  </li>
                </ul>

                <button
                  onClick={handleCreateFreeSubscription}
                  disabled={creatingFree}
                  className={`w-full py-3 px-6 rounded-xl font-semibold transition-all duration-300 shadow-xl ${
                    creatingFree
                      ? 'bg-gray-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 hover:scale-105'
                  } text-white`}
                >
                  {creatingFree ? '시작하는 중...' : '무료로 시작하기'}
                </button>
              </motion.div>

              {/* 유료 구독 카드 */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="bg-gradient-to-br from-blue-500/20 to-indigo-600/20 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border-2 border-blue-400/30 hover:border-blue-400/50 transition-all duration-300 relative"
              >
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-4 py-2 rounded-full text-sm font-semibold shadow-lg">
                    추천 플랜
                  </span>
                </div>
                
                <div className="mt-4">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shadow-xl">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                  </div>
                  
                  <h3 className="text-2xl font-bold text-white mb-4">Basic 플랜</h3>
                  <div className="flex items-center justify-center mb-4">
                    <span className="text-4xl font-bold text-blue-300">₩9,900</span>
                    <span className="text-blue-200/70 ml-2">/월</span>
                  </div>
                  <p className="text-blue-100/80 mb-6 leading-relaxed">
                    무료 체험 없이 바로 모든 기능을 이용하세요
                  </p>
                  
                  <ul className="space-y-3 text-left text-blue-100/80 text-sm mb-8">
                    <li className="flex items-center">
                      <svg className="w-4 h-4 text-blue-400 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      모든 휴가 관리 기능
                    </li>
                    <li className="flex items-center">
                      <svg className="w-4 h-4 text-blue-400 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      무제한 직원 등록
                    </li>
                    <li className="flex items-center">
                      <svg className="w-4 h-4 text-blue-400 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      우선 고객 지원
                    </li>
                  </ul>

                  <button
                    onClick={handleGoToPayment}
                    className="w-full py-3 px-6 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-indigo-600 hover:scale-105 transition-all duration-300 shadow-xl"
                  >
                    결제하기
                  </button>
                </div>
              </motion.div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-8 p-4 bg-red-500/20 backdrop-blur-sm rounded-lg border border-red-400/30"
              >
                <p className="text-red-200">{error}</p>
              </motion.div>
            )}
          </motion.div>
        )}
      </main>
    </div>
  );
}