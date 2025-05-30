'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion } from 'framer-motion';

export default function LandingPage() {
  const router = useRouter();

  const handleGoToAdminPage = () => {
    router.push('/admin');
  };

  // 앱 스토어/플레이 스토어 링크 (실제 링크로 교체 필요)
  const appStoreLink = "#"; // 예시: "https://apps.apple.com/app/your-app"
  const googlePlayLink = "#"; // 예시: "https://play.google.com/store/apps/details?id=your.package.name"

  return (
    <main className="min-h-screen bg-white text-gray-800">
      {/* 히어로 섹션 */}
      <section className="relative min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-100 via-blue-50 to-white overflow-hidden px-4 pt-20 pb-10">
        <div className="absolute inset-0 bg-blue-500 opacity-5 pattern-dots pattern-size-4"></div>
        
        <div className="container mx-auto text-center z-10 mb-16">
          <motion.h1 
            initial={{ opacity: 0, y: 30 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-5xl md:text-7xl font-extrabold text-blue-900 mb-6 leading-tight"
          >
            케어베케이션
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 30 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            className="text-xl md:text-2xl text-gray-700 mb-12 max-w-3xl mx-auto"
          >
            요양보호사 및 사무직 직원들의 휴무 관리를 앱과 웹에서<br />
            더욱 간편하고 효율적으로 경험하세요.
          </motion.p>
        </div>

        {/* 사용자 유형 선택 섹션 */}
        <div className="container mx-auto z-10 grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full">
          {/* 일반 사용자: 앱 다운로드 안내 */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} 
            animate={{ opacity: 1, scale: 1 }} 
            transition={{ duration: 0.7, delay: 0.4, ease: "easeOut" }}
            className="bg-white rounded-xl shadow-xl p-8 flex flex-col items-center hover:shadow-2xl transition-shadow duration-300"
          >
            <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center mb-6 shadow-md">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-blue-800 mb-4">앱으로 휴가 신청</h2>
            <p className="text-gray-600 mb-8 text-center">
              개인 휴가 신청 및 일정 확인은<br />모바일 앱에서 더욱 편리하게 이용하세요.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
              <a 
                href={appStoreLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-black text-white font-semibold hover:bg-gray-800 transition duration-300 w-full sm:w-auto shadow-md"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="currentColor" viewBox="0 0 384 512"><path d="M325.7 209.7c0-28.4-22.8-51.4-51.1-51.4h-3.2c-24.8 0-46.8 16.8-52.6 40.2h-5.5c-5.8-23.4-27.8-40.2-52.6-40.2h-3.2c-28.3 0-51.1 23-51.1 51.4 0 22.4 14.5 41.6 34.9 48.3-1.2 10.2-1.7 20.8-1.7 31.5 0 46.5 20.2 88.9 54.1 119.3 33.5 30.1 78.8 47.3 127.5 47.3h.2c48.7 0 93.9-17.2 127.5-47.3 33.9-30.4 54.1-72.8 54.1-119.3 0-10.7-.5-21.3-1.7-31.5 20.4-6.7 34.9-25.9 34.9-48.3zm-95.9-11.7c0-16.8-13.6-30.4-30.4-30.4s-30.4 13.6-30.4 30.4c0 16.8 13.6 30.4 30.4 30.4s30.4-13.6 30.4-30.4zm-158.8 0c0-16.8-13.6-30.4-30.4-30.4S97 181.2 97 198c0 16.8 13.6 30.4 30.4 30.4s30.4-13.6 30.4-30.4zM320 375.7c-25.9 23.2-59.3 36.9-96 36.9s-70.1-13.7-96-36.9c-1.8-1.6-3.5-3.3-5.2-5.1-7.6-8.3-13.9-17.7-18.6-27.9-3.7-7.9-6.8-16.2-9.1-24.7-5.7-20.7-8.7-42.4-8.7-64.9 0-20.4 2.6-40.2 7.6-58.9 2.9-10.9 6.9-21.4 11.7-31.1 7.9-16.1 18.8-30.2 31.8-41.5s28.3-20 44.6-25.5c1.8-.6 3.7-1.2 5.5-1.7 20.8-6.2 43.1-9.6 66.2-9.6s45.4 3.4 66.2 9.6c1.8.5 3.7 1.1 5.5 1.7 16.3 5.5 31.6 14.2 44.6 25.5s23.9 25.4 31.8 41.5c4.8 9.7 8.8 20.2 11.7 31.1 5 18.7 7.6 38.5 7.6 58.9 0 22.5-3 44.2-8.7 64.9-2.3 8.5-5.4 16.8-9.1 24.7-4.8 10.2-11.1 19.6-18.6 27.9-1.7 1.8-3.4 3.5-5.2 5.1z"/></svg>
                App Store
              </a>
              <a 
                href={googlePlayLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-green-500 text-white font-semibold hover:bg-green-600 transition duration-300 w-full sm:w-auto shadow-md"
              >
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="currentColor" viewBox="0 0 512 512"><path d="M429.6 288.7c20.4-10.4 34.1-30.1 34.1-53.2 0-32.8-26.6-59.4-59.4-59.4s-59.4 26.6-59.4 59.4c0 23.1 13.7 42.8 34.1 53.2-56.3 14.8-96.2 66.8-96.2 127.9 0 73.1 59.4 132.5 132.5 132.5s132.5-59.4 132.5-132.5c0-61.2-39.9-113.2-96.2-127.9zm-96.2-59.4c0-16.3 13.2-29.5 29.5-29.5s29.5 13.2 29.5 29.5-13.2 29.5-29.5 29.5-29.5-13.2-29.5-29.5zM144.2 176.1c1.7-8.7 2.9-17.6 3.5-26.6 0-1.6.1-3.3.1-4.9 0-2.8-.1-5.6-.3-8.4-.2-3.8-.5-7.6-1-11.4-.6-5.4-1.6-10.8-2.8-16-.3-1.2-.5-2.4-.8-3.6-1.2-5.1-2.8-10.1-4.6-14.9-2.5-6.6-5.6-12.9-9.1-18.8-6.8-11.4-15.3-21.5-25.1-29.8C90.1 27.2 73.3 16 53.9 16 24.2 16 0 40.2 0 69.9c0 20.4 11.3 38.2 28.3 47.9-1.7 8.6-2.8 17.5-3.3 26.5-.6 9.9-.8 20-.8 30.1 0 22.3 2.6 43.9 7.5 64.2 1.7 7.2 3.8 14.1 6.2 20.8 5.7 15.8 13.9 30.2 24.1 42.5 15.8 19.2 36.2 34.8 59.3 45.3 2.5 1.1 5.1 2.2 7.7 3.2 21.2 8.4 44.3 12.9 68.2 12.9 7.8 0 15.5-.4 23.1-1.3 12.7-1.4 25-3.9 36.6-7.4 8.9-2.7 17.5-5.9 25.7-9.7 2.7-1.2 5.3-2.5 7.9-3.9 1.3-.7 2.6-1.4 3.9-2.1 11.5-6.3 22-14.1 31.2-23.2 2.7-2.7 5.3-5.5 7.7-8.3 3.8-4.4 7.3-9.1 10.4-13.9 1.3-2 2.6-4.1 3.8-6.2 3.3-5.8 6.2-11.9 8.6-18.2.8-2.1 1.6-4.2 2.3-6.3 3.3-9.5 5.8-19.4 7.4-29.6 1.1-6.8 1.8-13.8 2-20.8.1-2.3.1-4.6.1-6.9.1-3.1 0-6.2-.1-9.3-.1-4.3-.4-8.6-.8-12.9-.5-5.3-1.3-10.6-2.3-15.7-.2-1.1-.5-2.2-.7-3.3-1.1-5.1-2.5-10-4.1-14.8-2.2-6.6-4.9-12.8-8.1-18.6-6.3-11.4-14.3-21.4-23.6-29.7-14.3-12.7-31-22.4-49.2-28.4-1.2-.4-2.4-.8-3.6-1.1-16.9-5.1-34.9-7.9-53.4-7.9-11.4 0-22.6.9-33.4 2.7-11.8 1.9-23.2 4.8-33.8 8.5-4.7 1.6-9.3 3.5-13.7 5.6-1.1.5-2.2 1-3.3 1.5zM140.9 222c-3.1-10.9-4.8-22.3-4.8-34 0-6.4.6-12.7 1.7-18.9 1.7-9.6 4.5-18.8 8.1-27.4 6.1-14.4 15-27.2 26-37.7 5.6-5.4 11.7-10.1 18.1-14.1 1.5-.9 3-1.8 4.5-2.6 11.7-6.4 24.2-9.8 37-9.8 9.3 0 18.4 1.7 27.1 5.1 10.1 3.9 19.5 9.4 27.8 16.3 11.3 9.4 20.4 21.2 26.7 34.7 4.1 8.7 7.1 18.2 8.9 28.1 1.3 7.2 2 14.7 2 22.2 0 14.4-2.1 28.4-6.1 41.4-6.1 20-17.7 37.3-33.1 49.8-13.4 10.8-29.3 18.1-46.5 21.2-4.8.9-9.7 1.3-14.6 1.3-13.9 0-27.4-3.1-39.8-8.9-16.1-7.6-29.7-19.2-40.1-33.8-7.1-9.9-12.6-21.2-16.2-33.5zM165.3 106.3c-9.2 10.3-16.3 22.4-20.8 35.7-2.9 8.5-4.4 17.4-4.4 26.4 0 10.9 1.9 21.5 5.5 31.4 5.4 15.2 14.1 28.6 25.4 39.5 11.3 10.9 24.8 19.2 39.8 24.3 13.1 4.3 26.9 6.5 40.9 6.5 12.7 0 25.2-1.8 37.1-5.2 15.1-4.3 28.8-11.4 40.4-20.7 9.7-7.8 17.8-17.4 23.9-28.4 4.8-8.6 8-18.2 9.6-28.2 1-6.4 1.5-13 1.5-19.6 0-11.1-1.9-21.9-5.6-31.9-5.7-15.5-14.6-29.2-26.2-40.4-11.6-11.2-25.6-19.8-41.1-25.2-13.5-4.6-27.8-7-42.6-7-13.4 0-26.5 1.9-38.8 5.6-14.4 4.2-27.6 10.8-38.9 19.3z"/></svg>
                Google Play
              </a>
            </div>
          </motion.div>

          {/* 관리자: 페이지 이동 안내 */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} 
            animate={{ opacity: 1, scale: 1 }} 
            transition={{ duration: 0.7, delay: 0.5, ease: "easeOut" }}
            className="bg-white rounded-xl shadow-xl p-8 flex flex-col items-center hover:shadow-2xl transition-shadow duration-300"
          >
            <div className="w-20 h-20 rounded-full bg-teal-500 flex items-center justify-center mb-6 shadow-md">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-teal-700 mb-4">관리자 페이지</h2>
            <p className="text-gray-600 mb-8 text-center">
              직원 휴무 일정 승인 및 전체 현황 관리는<br /> 관리자 페이지에서 진행해 주세요.
            </p>
            <button 
              onClick={handleGoToAdminPage}
              className="px-10 py-4 rounded-lg bg-teal-600 text-white font-semibold hover:bg-teal-700 transition duration-300 shadow-md"
            >
              관리자 페이지로 이동
            </button>
          </motion.div>
        </div>
      </section>

      {/* 주요 기능 (관리자 중심) */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-16 text-gray-800">효율적인 휴무 관리 기능</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {
              [
                {
                  icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
                  title: "한눈에 보는 일정",
                  description: "캘린더 기반의 직관적인 인터페이스로 팀 전체의 휴무 현황을 쉽게 파악하고 관리합니다."
                },
                {
                  icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 8h.01M12 12h.01M9 12h.01M12 9h.01M9 9h.01M15 9h.01M15 12h.01M15 15h.01M12 15h.01M9 15h.01" /></svg>,
                  title: "간편한 휴무 승인",
                  description: "직원들의 휴무 요청을 실시간으로 확인하고, 몇 번의 클릭만으로 승인 또는 반려 처리가 가능합니다."
                },
                {
                  icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>,
                  title: "데이터 기반 관리",
                  description: "직원별, 기간별 휴무 사용 현황을 데이터로 확인하여 인력 운영 계획 수립에 활용할 수 있습니다."
                }
              ].map((feature, index) => (
                <motion.div 
                  key={index}
                  initial={{ opacity: 0, y: 20 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  transition={{ duration: 0.5, delay: index * 0.1 + 0.6, ease: "easeOut" }}
                  className="bg-white rounded-xl p-8 shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col items-center text-center"
                >
                  <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mb-6">
                    {feature.icon}
                  </div>
                  <h3 className="text-2xl font-semibold mb-3 text-gray-800">{feature.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{feature.description}</p>
                </motion.div>
              ))
            }
          </div>
        </div>
      </section>

      {/* CTA (Call To Action) 섹션 - 관리자 대상 */}
      <section className="py-20 bg-blue-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="text-4xl font-bold mb-6"
          >
            지금 바로 케어베케이션을 시작하세요
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
            className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto"
          >
            복잡한 휴무 관리는 이제 그만! 케어베케이션 관리자 페이지에서<br />모든 것을 스마트하게 해결하세요.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }} 
            animate={{ opacity: 1, scale: 1 }} 
            transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
          >
            <button 
              onClick={handleGoToAdminPage}
              className="px-12 py-4 rounded-lg bg-white text-blue-600 font-bold text-lg hover:bg-blue-50 transition duration-300 shadow-lg"
            >
              관리자 페이지로 이동하기
            </button>
          </motion.div>
        </div>
      </section>

      {/* 푸터 */}
      <footer className="py-10 bg-gray-900 text-white">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-6 md:mb-0 text-center md:text-left">
              <h3 className="text-2xl font-bold">케어베케이션</h3>
              <p className="text-gray-400 mt-1">효율적인 휴무 관리를 위한 최고의 솔루션</p>
            </div>
            <div className="text-center md:text-right">
              <p className="text-gray-400">&copy; {new Date().getFullYear()} 케어베케이션. 모든 권리 보유.</p>
              {/* <p className="text-gray-500 text-sm mt-1">
                <a href="#" className="hover:text-white">개인정보처리방침</a> | <a href="#" className="hover:text-white">이용약관</a>
              </p> */}
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
