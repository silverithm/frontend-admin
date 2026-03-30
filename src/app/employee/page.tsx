'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { logout as apiLogout } from '@/lib/apiService';
import { useAlert } from '@/components/Alert';
import EmployeeCalendar from '@/components/EmployeeCalendar';
import EmployeeApproval from '@/components/EmployeeApproval';
import NoticeManagement from '@/components/NoticeManagement';
import { ChatManagement } from '@/components/ChatManagement';
import ScheduleCalendar from '@/components/ScheduleCalendar';
import NoticeRollingBanner from '@/components/NoticeRollingBanner';
import { FloatingChat } from '@/components/FloatingChat/FloatingChat';
import AdminDashboard from '@/components/AdminDashboard';
import Image from 'next/image';

type MainTab = 'dashboard' | 'notice' | 'chat' | 'schedule' | 'approval' | 'work';

export default function EmployeePage() {
  const router = useRouter();
  const { showAlert, AlertContainer } = useAlert();
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('dashboard');
  const [userName, setUserName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [isClient, setIsClient] = useState(false);
  const [notification, setNotification] = useState<{
    show: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({ show: false, message: '', type: 'success' });

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;
    const name = localStorage.getItem('userName') || '직원';
    const company = localStorage.getItem('companyName') || '';
    setUserName(name);
    setCompanyName(company);
  }, [isClient]);

  const handleLogout = async () => {
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
    }
  };

  const showNotification = (message: string, type: 'success' | 'error' | 'info') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification(prev => ({ ...prev, show: false })), 3000);
  };

  if (!isClient) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-500 font-medium">로딩 중...</span>
        </div>
      </div>
    );
  }

  const TABS: { key: string; label: string; icon: string }[] = [
    { key: 'dashboard', label: '대시보드', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
    { key: 'notice', label: '공지사항', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
    { key: 'chat', label: '채팅', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
    { key: 'schedule', label: '월간일정', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { key: 'approval', label: '전자결재', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { key: 'work', label: '근무조정', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  ];

  return (
    <>
      <AlertContainer />
      <div className="flex min-h-screen bg-gray-50">
        {/* 사이드바 (데스크탑) */}
        <aside className="hidden lg:flex flex-col w-56 bg-white border-r border-gray-200 fixed inset-y-0 left-0 z-30">
          {/* 로고 */}
          <div className="flex items-center gap-3 px-6 h-16 border-b border-gray-100 flex-shrink-0">
            <Image src="/images/carev-favicon.png" alt="케어브이" width={32} height={32} className="rounded-lg" />
            <div>
              <h1 className="text-sm font-bold text-gray-900 leading-tight">케어브이</h1>
              {companyName && <p className="text-[11px] text-gray-400 leading-tight truncate max-w-[140px]">{companyName}</p>}
            </div>
          </div>

          {/* 네비게이션 */}
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">메뉴</p>
            {TABS.map((tab) => (
              <div key={tab.key}>
                <button
                  onClick={() => setActiveMainTab(tab.key as MainTab)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                    activeMainTab === tab.key
                      ? 'bg-teal-50 text-teal-700 shadow-sm'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <svg className={`w-[18px] h-[18px] flex-shrink-0 ${activeMainTab === tab.key ? 'text-teal-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d={tab.icon} />
                  </svg>
                  {tab.label}
                </button>
              </div>
            ))}
          </nav>

          {/* 사이드바 하단 */}
          <div className="border-t border-gray-100 py-3 space-y-1 flex-shrink-0">
            <div className="px-3 py-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-gradient-to-br from-teal-400 to-teal-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-900 truncate">{userName}</p>
                  <p className="text-[10px] text-gray-400">직원</p>
                </div>
              </div>
            </div>
            <button onClick={handleLogout} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              로그아웃
            </button>
          </div>
        </aside>

        {/* 모바일 헤더 (lg 미만) */}
        <header className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b border-gray-200 shadow-sm">
          <div className="flex items-center justify-between px-4 h-13">
            <div className="flex items-center gap-2">
              <Image src="/images/carev-favicon.png" alt="케어브이" width={26} height={26} className="rounded-lg" />
              <div>
                <span className="text-sm font-bold text-gray-900">케어브이</span>
                {companyName && <p className="text-[10px] text-gray-400 leading-tight truncate max-w-[120px]">{companyName}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleLogout} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              </button>
            </div>
          </div>
          <nav className="flex overflow-x-auto scrollbar-hide px-2 -mb-px">
            {TABS.map((tab) => (
              <button key={tab.key} onClick={() => setActiveMainTab(tab.key as MainTab)} className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${activeMainTab === tab.key ? 'text-teal-600 border-teal-500' : 'text-gray-500 border-transparent'}`}>
                {tab.label}
              </button>
            ))}
          </nav>
        </header>

        {/* 메인 콘텐츠 영역 */}
        <div className="flex-1 lg:ml-56 flex flex-col min-h-screen">
          {/* 공지사항 롤링 배너 */}
          <div className="mt-[88px] lg:mt-0">
            <NoticeRollingBanner
              onNoticeClick={() => setActiveMainTab('notice')}
              autoScrollInterval={5000}
              maxNotices={5}
            />
          </div>

          {/* 메인 콘텐츠 */}
          <main className="flex-grow w-full px-3 sm:px-4 lg:px-5 py-4 flex flex-col">
            {/* 알림 메시지 */}
            <AnimatePresence>
              {notification.show && (
                <motion.div
                  initial={{ opacity: 0, y: -12, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -12, scale: 0.95 }}
                  className={`mb-4 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-md ${
                    notification.type === 'success'
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : notification.type === 'error'
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}
                >
                  <span className="text-base">
                    {notification.type === 'success' ? '✓' : notification.type === 'error' ? '✕' : 'ℹ'}
                  </span>
                  <p className="text-xs font-medium flex-1">{notification.message}</p>
                  <button
                    onClick={() => setNotification({ ...notification, show: false })}
                    className="text-current opacity-40 hover:opacity-70 transition-opacity p-0.5"
                    aria-label="닫기"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 탭별 콘텐츠 */}
            <AnimatePresence mode="wait">
              {activeMainTab === 'dashboard' ? (
                <motion.div
                  key="dashboard"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2 }}
                  className="flex-1 flex flex-col"
                >
                  <AdminDashboard onTabChange={(tab) => setActiveMainTab(tab as MainTab)} isAdmin={false} />
                </motion.div>
              ) : activeMainTab === 'notice' ? (
                <motion.div
                  key="notice"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2 }}
                  className="flex-1 flex flex-col"
                >
                  <NoticeManagement isAdmin={false} />
                </motion.div>
              ) : activeMainTab === 'chat' ? (
                <motion.div
                  key="chat"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2 }}
                  className="flex-1 flex flex-col"
                >
                  <ChatManagement onNotification={showNotification} isAdmin={false} />
                </motion.div>
              ) : activeMainTab === 'schedule' ? (
                <motion.div
                  key="schedule"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="flex-1 flex flex-col"
                >
                  <ScheduleCalendar isAdmin={false} mode="schedule" onNotification={showNotification} />
                </motion.div>
              ) : activeMainTab === 'approval' ? (
                <motion.div
                  key="approval"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2 }}
                  className="flex-1 flex flex-col"
                >
                  <EmployeeApproval />
                </motion.div>
              ) : activeMainTab === 'work' ? (
                <motion.div
                  key="work"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2 }}
                  className="flex-1 flex flex-col"
                >
                  <EmployeeCalendar />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </main>

          {/* 푸터 */}
          <footer className="border-t border-gray-200 bg-gray-50">
            <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
                <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-3 text-xs text-gray-400">
                  <span>&copy; 2025 케어브이 (silverithm) 대표: 김준형</span>
                  <span className="hidden sm:inline text-gray-300">|</span>
                  <span>사업자등록번호: 107-21-26475</span>
                  <span className="hidden sm:inline text-gray-300">|</span>
                  <span>서울특별시 신림동 1547-10</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <a
                    href="https://plip.kr/pcc/d9017bf3-00dc-4f8f-b750-f7668e2b7bb7/privacy/1.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    개인정보처리방침
                  </a>
                  <span className="text-gray-300">|</span>
                  <a
                    href="https://relic-baboon-412.notion.site/silverithm-13c766a8bb468082b91ddbd2dd6ce45d"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    이용약관
                  </a>
                  <span className="text-gray-300">|</span>
                  <a href="mailto:ggprgrkjh@naver.com" className="text-gray-400 hover:text-gray-600 transition-colors">
                    ggprgrkjh@naver.com
                  </a>
                </div>
              </div>
            </div>
          </footer>
        </div>

        {/* 플로팅 채팅 위젯 */}
        <FloatingChat />
      </div>
    </>
  );
}
