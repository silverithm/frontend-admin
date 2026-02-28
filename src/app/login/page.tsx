'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { signin, memberSignin, findPassword } from '@/lib/apiService';
import { subscriptionService } from '@/services/subscription';
import { useAlert } from '@/components/Alert';
import { LoginType } from '@/types/auth';
import Image from 'next/image';

export default function LoginPage() {
  const router = useRouter();
  const { showAlert, AlertContainer } = useAlert();
  const [loginType, setLoginType] = useState<LoginType>('admin');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(false);
  const [showFindPassword, setShowFindPassword] = useState(false);
  const [findPasswordEmail, setFindPasswordEmail] = useState('');
  const [findPasswordLoading, setFindPasswordLoading] = useState(false);
  const [findPasswordMessage, setFindPasswordMessage] = useState('');
  const [findPasswordError, setFindPasswordError] = useState('');

  useEffect(() => {
    // 컴포넌트 마운트 시 저장된 이메일 불러오기
    try {
      const savedEmail = localStorage.getItem('rememberedEmail');
      const isRemembered = localStorage.getItem('rememberEmail') === 'true';
      const savedLoginType = localStorage.getItem('lastLoginType') as LoginType;

      if (savedEmail && isRemembered) {
        setFormData(prev => ({ ...prev, email: savedEmail }));
        setRememberEmail(true);
      }
      if (savedLoginType) {
        setLoginType(savedLoginType);
      }
    } catch (error) {
      console.error('localStorage 접근 오류:', error);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleRememberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setRememberEmail(checked);

    // 체크 해제 시 즉시 localStorage에서 삭제
    if (!checked) {
      try {
        localStorage.removeItem('rememberedEmail');
        localStorage.removeItem('rememberEmail');
      } catch (error) {
        console.error('localStorage 삭제 오류:', error);
      }
    }
  };

  const checkSubscriptionAndRedirect = async () => {
    try {
      // 구독 정보 확인
      const subscription = await subscriptionService.getMySubscription();

      // 활성 구독이 있으면 관리자 페이지로
      if (subscriptionService.isActive(subscription)) {
        router.push('/admin');
      } else {
        // 만료된 구독이 있으면 관리자 페이지로 (SubscriptionGuard가 처리)
        router.push('/admin');
      }
    } catch (error: any) {

      // 404 에러이고 "No subscription found" 메시지인 경우에만 구독이 없다고 판단
      if (error.status === 404 &&
          (error.message === 'No subscription found' ||
           error.data?.error === 'No subscription found')) {
        router.push('/subscription-check');
      } else if (error.status >= 500) {
        // 500 에러 시 에러 메시지 표시 후 랜딩페이지로
        showAlert({
          type: 'error',
          title: '서버 오류',
          message: '서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도하거나 고객센터에 문의해주세요.',
          duration: 7000
        });
        setTimeout(() => router.push('/'), 3000);
      } else {
        // 기타 오류 시 관리자 페이지로 (SubscriptionGuard가 처리)
        router.push('/admin');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // 로그인 타입 저장
      localStorage.setItem('lastLoginType', loginType);

      if (loginType === 'admin') {
        // 관리자 로그인 - Spring Boot 백엔드로 로그인 요청
        const result = await signin(formData.email, formData.password);
        localStorage.setItem('userRole', 'ROLE_ADMIN');
        localStorage.setItem('loginType', 'admin');

        // 아이디 기억하기 처리
        try {
          if (rememberEmail) {
            localStorage.setItem('rememberedEmail', formData.email);
            localStorage.setItem('rememberEmail', 'true');
          } else {
            localStorage.removeItem('rememberedEmail');
            localStorage.removeItem('rememberEmail');
          }
        } catch (error) {
          console.error('localStorage 저장 오류:', error);
        }

        // 로그인 성공 후 구독 상태 확인
        await checkSubscriptionAndRedirect();
      } else {
        // 직원 로그인
        const result = await memberSignin(formData.email, formData.password);

        // 아이디 기억하기 처리
        try {
          if (rememberEmail) {
            localStorage.setItem('rememberedEmail', formData.email);
            localStorage.setItem('rememberEmail', 'true');
          } else {
            localStorage.removeItem('rememberedEmail');
            localStorage.removeItem('rememberEmail');
          }
        } catch (error) {
          console.error('localStorage 저장 오류:', error);
        }

        // 직원도 관리자 페이지로 이동 (권한에 따라 UI가 다르게 표시됨)
        localStorage.setItem('loginType', 'employee');
        router.push('/admin');
      }
    } catch (error) {
      console.error('로그인 오류:', error);

      // 더 자세한 오류 메시지 표시
      if (error instanceof Error) {
        if (error.message.includes('400')) {
          setError('이메일 또는 비밀번호가 올바르지 않습니다.');
        } else if (error.message.includes('401')) {
          setError('인증에 실패했습니다. 이메일과 비밀번호를 확인해주세요.');
        } else if (error.message.includes('500')) {
          setError('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
        } else {
          setError(`로그인 오류: ${error.message}`);
        }
      } else {
        setError('알 수 없는 오류가 발생했습니다.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <AlertContainer />
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-900 via-blue-900 to-indigo-900 p-4 relative">
      {/* 뒤로가기 버튼 */}
      <button
        onClick={() => router.push('/')}
        className="absolute top-6 left-6 z-10 flex items-center space-x-2 px-4 py-2 bg-white/10 backdrop-blur-lg border border-blue-400/20 rounded-xl text-blue-100 hover:bg-white/20 hover:text-white transition-all duration-300 shadow-lg hover:scale-105"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        <span className="text-sm font-medium">메인으로</span>
      </button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 w-full max-w-md border border-blue-400/20"
      >
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4 pr-7">
            <Image
              src="/images/logo-text.png"
              alt="케어브이 로고"
              width={200}
              height={67}
              className="transition-transform duration-300 hover:scale-105"
            />
          </div>
        </div>

        {/* 로그인 타입 토글 */}
        <div className="mb-6">
          <div className="flex bg-white/5 rounded-lg p-1 border border-blue-300/20">
            <button
              type="button"
              onClick={() => setLoginType('admin')}
              className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
                loginType === 'admin'
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg'
                  : 'text-blue-200/70 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span>관리자</span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setLoginType('employee')}
              className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
                loginType === 'employee'
                  ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-lg'
                  : 'text-blue-200/70 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>직원</span>
              </div>
            </button>
          </div>
          <p className="text-center text-blue-200/50 text-xs mt-2">
            {loginType === 'admin'
              ? '센터 관리자 계정으로 로그인합니다'
              : '직원 계정으로 로그인합니다'}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-2">
            <label htmlFor="email" className="block text-sm font-medium text-blue-100 mb-1">
              이메일
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-blue-300/30 rounded-lg bg-white/10 text-white placeholder-blue-200/60 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 backdrop-blur-sm"
              placeholder="이메일 주소 입력"
              required
            />
          </div>

          <div className="mb-6 flex items-center">
            <label htmlFor="rememberEmail" className="flex items-center cursor-pointer group">
              <input
                type="checkbox"
                id="rememberEmail"
                checked={rememberEmail}
                onChange={handleRememberChange}
                className="w-5 h-5 text-blue-500 bg-white/10 border-2 border-blue-300/30 rounded focus:ring-2 focus:ring-blue-400 focus:ring-offset-0 focus:ring-offset-transparent checked:bg-blue-500 checked:border-blue-500 transition-all duration-200 cursor-pointer"
              />
              <span className="ml-2 text-sm text-blue-100 group-hover:text-white transition-colors">
                이메일 저장
              </span>
            </label>
          </div>

          <div className="mb-6">
            <label htmlFor="password" className="block text-sm font-medium text-blue-100 mb-1">
              비밀번호
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-blue-300/30 rounded-lg bg-white/10 text-white placeholder-blue-200/60 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 backdrop-blur-sm"
              placeholder="비밀번호 입력"
              required
            />
          </div>

          <div className="flex justify-end mb-4">
            <button
              type="button"
              onClick={() => setShowFindPassword(true)}
              className="text-sm text-blue-300 hover:text-white transition-colors"
            >
              비밀번호 찾기
            </button>
          </div>

          {error && (
            <div className="mb-4 p-2 bg-red-500/20 text-red-200 rounded-lg text-sm border border-red-400/30">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full font-semibold py-3 px-4 rounded-lg transition duration-300 flex justify-center shadow-xl ${
              loginType === 'admin'
                ? 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white'
                : 'bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white'
            }`}
          >
            {isLoading ? (
              <svg
                className="animate-spin h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            ) : (
              loginType === 'admin' ? '관리자 로그인' : '직원 로그인'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-blue-200/60">
            계정이 없으신가요?{' '}
            <a href="/signup" className="font-medium text-blue-300 hover:text-white hover:underline transition-colors">
              회원가입
            </a>
          </p>
        </div>
      </motion.div>

      {/* 비밀번호 찾기 모달 */}
      <AnimatePresence>
        {showFindPassword && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowFindPassword(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 w-full max-w-md border border-blue-400/20"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-2xl font-bold text-white mb-4">비밀번호 찾기</h2>
              <p className="text-blue-100/80 mb-6">
                가입 시 사용한 이메일 주소를 입력하시면<br />
                임시 비밀번호를 보내드립니다.
              </p>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setFindPasswordLoading(true);
                  setFindPasswordError('');
                  setFindPasswordMessage('');

                  try {
                    const response = await findPassword(findPasswordEmail);
                    setFindPasswordMessage('임시 비밀번호가 이메일로 전송되었습니다.');
                    setTimeout(() => {
                      setShowFindPassword(false);
                      setFindPasswordEmail('');
                      setFindPasswordMessage('');
                    }, 3000);
                  } catch (error) {
                    setFindPasswordError('이메일 전송에 실패했습니다. 다시 시도해주세요.');
                  } finally {
                    setFindPasswordLoading(false);
                  }
                }}
              >
                <div className="mb-4">
                  <label htmlFor="findPasswordEmail" className="block text-sm font-medium text-blue-100 mb-1">
                    이메일
                  </label>
                  <input
                    type="email"
                    id="findPasswordEmail"
                    value={findPasswordEmail}
                    onChange={(e) => setFindPasswordEmail(e.target.value)}
                    className="w-full px-4 py-2 border border-blue-300/30 rounded-lg bg-white/10 text-white placeholder-blue-200/60 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 backdrop-blur-sm"
                    placeholder="이메일 주소 입력"
                    required
                  />
                </div>

                {findPasswordError && (
                  <div className="mb-4 p-2 bg-red-500/20 text-red-200 rounded-lg text-sm border border-red-400/30">
                    {findPasswordError}
                  </div>
                )}

                {findPasswordMessage && (
                  <div className="mb-4 p-2 bg-green-500/20 text-green-200 rounded-lg text-sm border border-green-400/30">
                    {findPasswordMessage}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={findPasswordLoading}
                    className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-semibold py-3 px-4 rounded-lg transition duration-300 flex justify-center shadow-xl"
                  >
                    {findPasswordLoading ? (
                      <svg
                        className="animate-spin h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                    ) : (
                      '전송'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowFindPassword(false);
                      setFindPasswordEmail('');
                      setFindPasswordError('');
                      setFindPasswordMessage('');
                    }}
                    className="px-6 py-3 border border-blue-300/30 text-blue-100 hover:bg-white/10 rounded-lg transition duration-300"
                  >
                    취소
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </>
  );
}
