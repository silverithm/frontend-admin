'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { logout as apiLogout } from '@/lib/apiService';
import { useAlert } from '@/components/Alert';
import EmployeeCalendar from '@/components/EmployeeCalendar';
import EmployeeApproval from '@/components/EmployeeApproval';
import EmployeeNotice from '@/components/EmployeeNotice';
import ScheduleCalendar from '@/components/ScheduleCalendar';
import Image from 'next/image';

type TabType = 'calendar' | 'schedule' | 'approval' | 'notice';

export default function EmployeePage() {
  const router = useRouter();
  const { showAlert, AlertContainer } = useAlert();
  const [activeTab, setActiveTab] = useState<TabType>('calendar');
  const [userName, setUserName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;
    // 사용자 정보 로드
    const name = localStorage.getItem('userName') || '직원';
    const company = localStorage.getItem('companyName') || '';
    setUserName(name);
    setCompanyName(company);
  }, [isClient]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await apiLogout();
      router.push('/login');
    } catch (error) {
      console.error('로그아웃 오류:', error);
      showAlert({
        type: 'error',
        title: '로그아웃 실패',
        message: '로그아웃 중 오류가 발생했습니다.',
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  // 클라이언트 사이드가 아직 준비되지 않았을 때 로딩 화면 표시
  if (!isClient) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 via-blue-900 to-indigo-900">
        <div className="flex flex-col items-center space-y-6">
          <Image
            src="/images/logo.png"
            alt="케어브이 로고"
            width={160}
            height={53}
            className="mb-4"
          />
          <div className="flex items-center space-x-3">
            <svg
              className="animate-spin h-8 w-8 text-blue-400"
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
            <p className="text-lg text-blue-100 font-medium">
              페이지를 준비하는 중...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <AlertContainer />
      <div className="flex flex-col min-h-screen bg-gray-50">
        {/* 헤더 영역 - 관리자 페이지와 동일한 디자인 */}
        <header className="bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 shadow-2xl border-b border-blue-800/30 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <Image
                    src="/images/logo-text.png"
                    alt="케어브이 로고"
                    width={140}
                    height={47}
                    className="transition-transform duration-300 hover:scale-105"
                  />
                </div>
                <div>
                  <h1 className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-white via-blue-100 to-indigo-100 bg-clip-text text-transparent">
                    직원 포털
                  </h1>
                  {companyName && (
                    <p className="text-blue-200/90 text-sm font-medium mt-0.5 flex items-center">
                      <svg
                        className="w-3 h-3 mr-1.5 text-blue-300"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {companyName}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-3">
                {/* 사용자 정보 */}
                <div className="hidden sm:flex items-center px-4 py-2 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center mr-3">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-white font-medium">{userName}</span>
                </div>
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="group px-4 py-2.5 text-sm font-medium text-slate-700 bg-white/90 backdrop-blur-sm border border-white/30 rounded-xl shadow-lg hover:bg-red-50 hover:text-red-700 hover:border-red-200 hover:shadow-xl hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all duration-300"
                >
                  {isLoggingOut ? (
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <span className="flex items-center">
                      <svg
                        className="w-4 h-4 mr-2 group-hover:text-red-600 transition-colors"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                        />
                      </svg>
                      로그아웃
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* 탭 네비게이션 - 관리자 페이지와 동일한 스타일 */}
            <div className="mt-8 border-b border-white/10">
              <nav className="flex space-x-8">
                <button
                  onClick={() => setActiveTab('calendar')}
                  className={`relative py-4 px-2 font-semibold text-sm transition-all duration-300 ${
                    activeTab === 'calendar'
                      ? 'text-white border-b-2 border-blue-400 shadow-lg'
                      : 'text-blue-200/80 hover:text-white hover:border-b-2 hover:border-white/30'
                  }`}
                >
                  <span className="flex items-center">
                    <svg
                      className="w-4 h-4 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    휴무 달력
                  </span>
                  {activeTab === 'calendar' && (
                    <div className="absolute inset-x-0 -bottom-px h-0.5 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-full"></div>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('schedule')}
                  className={`relative py-4 px-2 font-semibold text-sm transition-all duration-300 ${
                    activeTab === 'schedule'
                      ? 'text-white border-b-2 border-blue-400 shadow-lg'
                      : 'text-blue-200/80 hover:text-white hover:border-b-2 hover:border-white/30'
                  }`}
                >
                  <span className="flex items-center">
                    <svg
                      className="w-4 h-4 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                      <circle cx="12" cy="16" r="1" fill="currentColor"/>
                    </svg>
                    일정
                  </span>
                  {activeTab === 'schedule' && (
                    <div className="absolute inset-x-0 -bottom-px h-0.5 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-full"></div>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('approval')}
                  className={`relative py-4 px-2 font-semibold text-sm transition-all duration-300 ${
                    activeTab === 'approval'
                      ? 'text-white border-b-2 border-blue-400 shadow-lg'
                      : 'text-blue-200/80 hover:text-white hover:border-b-2 hover:border-white/30'
                  }`}
                >
                  <span className="flex items-center">
                    <svg
                      className="w-4 h-4 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    전자결재
                  </span>
                  {activeTab === 'approval' && (
                    <div className="absolute inset-x-0 -bottom-px h-0.5 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-full"></div>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('notice')}
                  className={`relative py-4 px-2 font-semibold text-sm transition-all duration-300 ${
                    activeTab === 'notice'
                      ? 'text-white border-b-2 border-blue-400 shadow-lg'
                      : 'text-blue-200/80 hover:text-white hover:border-b-2 hover:border-white/30'
                  }`}
                >
                  <span className="flex items-center">
                    <svg
                      className="w-4 h-4 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                      />
                    </svg>
                    공지사항
                  </span>
                  {activeTab === 'notice' && (
                    <div className="absolute inset-x-0 -bottom-px h-0.5 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-full"></div>
                  )}
                </button>
              </nav>
            </div>
          </div>
        </header>

        {/* 메인 콘텐츠 */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <AnimatePresence mode="wait">
            {activeTab === 'calendar' && (
              <motion.div
                key="calendar"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <EmployeeCalendar />
              </motion.div>
            )}
            {activeTab === 'schedule' && (
              <motion.div
                key="schedule"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <ScheduleCalendar isAdmin={false} />
              </motion.div>
            )}
            {activeTab === 'approval' && (
              <motion.div
                key="approval"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <EmployeeApproval />
              </motion.div>
            )}
            {activeTab === 'notice' && (
              <motion.div
                key="notice"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <EmployeeNotice />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* 푸터 - 관리자 페이지 스타일 */}
        <footer className="bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 shadow-2xl border-t border-blue-800/30 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex items-center space-x-4">
                <Image
                  src="/images/logo-text.png"
                  alt="케어브이 로고"
                  width={100}
                  height={33}
                  className="opacity-80"
                />
                <p className="text-blue-200/60 text-sm">
                  &copy; 2025 케어브이. 모든 권리 보유.
                </p>
              </div>
              <div className="flex items-center space-x-4 text-sm">
                <a
                  href="https://plip.kr/pcc/d9017bf3-00dc-4f8f-b750-f7668e2b7bb7/privacy/1.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-300/80 hover:text-white transition-colors"
                >
                  개인정보처리방침
                </a>
                <span className="text-blue-400/50">|</span>
                <a
                  href="https://relic-baboon-412.notion.site/silverithm-13c766a8bb468082b91ddbd2dd6ce45d"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-300/80 hover:text-white transition-colors"
                >
                  이용약관
                </a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
