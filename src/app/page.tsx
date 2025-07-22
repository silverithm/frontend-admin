'use client';

import {useRouter} from 'next/navigation';
import Image from 'next/image';
import {motion} from 'framer-motion';
import Navbar from '@/components/Navbar';

export default function LandingPage() {
    const router = useRouter();

    // 디자인 이미지 배열
    const designImages = [
        '/images/design 1.png',
        '/images/desigin 2.png',
        '/images/desigin 3.png',
        '/images/design 4.png',
        '/images/design 5.png',
        '/images/design 6.png'
    ];

    const handleGoToLogin = (e?: React.MouseEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        try {
            router.push('/login');
        } catch (error) {
            window.location.href = '/login';
        }
    };


    // 앱 스토어 및 구글 플레이 스토어 링크
    const appStoreLink = "https://apps.apple.com/kr/app/%EC%BC%80%EC%96%B4%EB%B8%8C%EC%9D%B4/id6747028185";
    const googlePlayLink = "https://play.google.com/store/apps/details?id=com.silverithm.carev.app";

    return (
        <main className="min-h-screen bg-gradient-to-b from-slate-900 via-blue-900 to-indigo-900 text-white">
            <Navbar/>

            {/* 히어로 섹션 */}
            <section
                className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-4 pt-32 pb-10">
                {/* 배경 장식 */}
                <div className="absolute inset-0">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-indigo-600/20"></div>
                    <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl"></div>
                    <div
                        className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"></div>
                </div>

                <div className="container mx-auto text-center z-10 mb-16">
                    <motion.div
                        initial={{opacity: 0, y: 30}}
                        animate={{opacity: 1, y: 0}}
                        transition={{duration: 0.8, ease: "easeOut"}}
                        className="mb-6"
                    >
            <span
                className="inline-block px-4 py-2 bg-blue-500/20 backdrop-blur-sm rounded-full text-blue-200 text-sm font-medium border border-blue-400/30 mb-6">
              🚀 스마트한 휴무 관리의 시작
            </span>
                    </motion.div>

                    <motion.h1
                        initial={{opacity: 0, y: 30}}
                        animate={{opacity: 1, y: 0}}
                        transition={{duration: 0.8, delay: 0.1, ease: "easeOut"}}
                        className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-white via-blue-100 to-indigo-100 bg-clip-text text-transparent leading-tight"
                    >
                        케어브이로 시작하는<br/>
                        <span className="text-4xl md:text-6xl">효율적인 근무 관리</span>
                    </motion.h1>

                    <motion.p
                        initial={{opacity: 0, y: 30}}
                        animate={{opacity: 1, y: 0}}
                        transition={{duration: 0.8, delay: 0.2, ease: "easeOut"}}
                        className="text-xl md:text-2xl text-blue-100/90 mb-12 max-w-3xl mx-auto leading-relaxed"
                    >
                        요양보호사와 사무직 직원들의 휴무 관리를 혁신적으로 개선합니다.<br/>
                        복잡한 일정 관리를 단순하게, 승인 프로세스를 빠르게.
                    </motion.p>
                </div>

                {/* 사용자 유형 선택 섹션 */}
                <div className="container mx-auto z-10 grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full">
                    {/* 일반 사용자: 앱 다운로드 안내 */}
                    <motion.div
                        initial={{opacity: 0, scale: 0.9}}
                        animate={{opacity: 1, scale: 1}}
                        transition={{duration: 0.7, delay: 0.4, ease: "easeOut"}}
                        className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 flex flex-col items-center hover:bg-white/15 transition-all duration-300 border border-blue-400/20"
                    >
                        <div
                            className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center mb-6 shadow-xl">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none"
                                 viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round"
                                      d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                            </svg>
                        </div>
                        <h2 className="text-3xl font-bold text-white mb-4">앱으로 휴가 신청</h2>
                        <p className="text-blue-100/80 mb-8 text-center leading-relaxed">
                            개인 휴가 신청 및 일정 확인은<br/>모바일 앱에서 더욱 편리하게 이용하세요.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                            <a
                                href={appStoreLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-3 px-6 py-3 rounded-xl bg-slate-800/80 backdrop-blur-sm text-white font-semibold hover:bg-slate-700/90 hover:scale-105 transition-all duration-300 w-full sm:w-auto shadow-xl border border-blue-400/20"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor"
                                     viewBox="0 0 384 512">
                                    <path
                                        d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
                                </svg>
                                App Store
                            </a>
                            <a
                                href={googlePlayLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-3 px-6 py-3 rounded-xl bg-blue-600/80 backdrop-blur-sm text-white font-semibold hover:bg-blue-600/90 hover:scale-105 transition-all duration-300 w-full sm:w-auto shadow-xl border border-blue-400/20"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor"
                                     viewBox="0 0 512 512">
                                    <path
                                        d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6l-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-14.3 18-46.5-1.2-60.8zM104.6 499l280.8-161.2-60.1-60.1L104.6 499z"/>
                                </svg>
                                Google Play
                            </a>
                        </div>
                    </motion.div>

                    {/* 관리자: 페이지 이동 안내 */}
                    <motion.div
                        initial={{opacity: 0, scale: 0.9}}
                        animate={{opacity: 1, scale: 1}}
                        transition={{duration: 0.7, delay: 0.5, ease: "easeOut"}}
                        className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 flex flex-col items-center hover:bg-white/15 transition-all duration-300 border border-blue-400/20"
                    >
                        <div
                            className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center mb-6 shadow-xl">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none"
                                 viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round"
                                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                                <path strokeLinecap="round" strokeLinejoin="round"
                                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                            </svg>
                        </div>
                        <h2 className="text-3xl font-bold text-white mb-4">관리자 페이지</h2>
                        <p className="text-blue-100/80 mb-8 text-center leading-relaxed">
                            직원 휴무 일정 승인 및 전체 현황 관리는<br/> 관리자 페이지에서 진행해 주세요.
                        </p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={handleGoToLogin}
                                className="px-10 py-4 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold hover:from-blue-600 hover:to-indigo-600 hover:scale-105 transition-all duration-300 shadow-xl"
                            >
                                관리자 로그인
                            </button>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* 주요 기능 섹션 */}
            <section id="features" className="py-20 bg-slate-800/50 backdrop-blur-sm">
                <div className="container mx-auto px-4">
                    <motion.h2
                        initial={{opacity: 0, y: 20}}
                        whileInView={{opacity: 1, y: 0}}
                        viewport={{once: true}}
                        transition={{duration: 0.6}}
                        className="text-4xl md:text-5xl font-bold text-center mb-16 bg-gradient-to-r from-white via-blue-100 to-indigo-100 bg-clip-text text-transparent"
                    >
                        효율적인 휴무 관리 기능
                    </motion.h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                        {
                            [
                                {
                                    icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-blue-400"
                                               fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                                    </svg>,
                                    title: "한눈에 보는 일정",
                                    description: "캘린더 기반의 직관적인 인터페이스로 팀 전체의 휴무 현황을 쉽게 파악하고 관리합니다."
                                },
                                {
                                    icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-blue-400"
                                               fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 8h.01M12 12h.01M9 12h.01M12 9h.01M9 9h.01M15 9h.01M15 12h.01M15 15h.01M12 15h.01M9 15h.01"/>
                                    </svg>,
                                    title: "간편한 휴무 승인",
                                    description: "직원들의 휴무 요청을 실시간으로 확인하고, 몇 번의 클릭만으로 승인 또는 반려 처리가 가능합니다."
                                },
                                {
                                    icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-blue-400"
                                               fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                                    </svg>,
                                    title: "데이터 기반 관리",
                                    description: "직원별, 기간별 휴무 사용 현황을 데이터로 확인하여 인력 운영 계획 수립에 활용할 수 있습니다."
                                }
                            ].map((feature, index) => (
                                <motion.div
                                    key={index}
                                    initial={{opacity: 0, y: 20}}
                                    whileInView={{opacity: 1, y: 0}}
                                    viewport={{once: true}}
                                    transition={{duration: 0.5, delay: index * 0.1 + 0.2}}
                                    className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl hover:bg-white/15 transition-all duration-300 flex flex-col items-center text-center border border-blue-400/20"
                                >
                                    <div
                                        className="w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center mb-6 border border-blue-400/30">
                                        {feature.icon}
                                    </div>
                                    <h3 className="text-2xl font-semibold mb-4 text-white">{feature.title}</h3>
                                    <p className="text-blue-100/80 leading-relaxed">{feature.description}</p>
                                </motion.div>
                            ))
                        }
                    </div>
                </div>
            </section>

            {/* 디자인 이미지 섹션 */}
            <section className="py-20 bg-slate-900/50 backdrop-blur-sm">
                <div className="container mx-auto px-8 lg:px-16">
                    {/* 이미지 그리드 */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        {designImages.map((image, index) => (
                            <motion.div
                                key={index}
                                initial={{opacity: 0, y: 20}}
                                whileInView={{opacity: 1, y: 0}}
                                viewport={{once: true}}
                                transition={{duration: 0.5, delay: index * 0.1}}
                                className="aspect-[9/16] relative bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-2 border border-blue-400/20 overflow-hidden hover:scale-105 transition-transform duration-300"
                            >
                                <Image
                                    src={image}
                                    alt={`케어브이 디자인 ${index + 1}`}
                                    fill
                                    className="object-contain"
                                    priority
                                />
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* 사용 방법 섹션 */}
            <section id="process" className="py-20 bg-slate-800/50 backdrop-blur-sm">
                <div className="container mx-auto px-4">
                    <motion.h2
                        initial={{opacity: 0, y: 20}}
                        whileInView={{opacity: 1, y: 0}}
                        viewport={{once: true}}
                        transition={{duration: 0.6}}
                        className="text-4xl md:text-5xl font-bold text-center mb-16 bg-gradient-to-r from-white via-blue-100 to-indigo-100 bg-clip-text text-transparent"
                    >
                        케어브이 사용 방법
                    </motion.h2>

                    <div className="max-w-5xl mx-auto">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {[
                                {
                                    step: "1",
                                    role: "[관리자]",
                                    title: "웹사이트 가입",
                                    description: "근무표 관리자가 먼저 웹사이트에서 회사 정보를 등록하며 가입을 완료합니다.",
                                    icon: (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none"
                                             viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                                        </svg>
                                    ),
                                    color: "from-blue-400 to-indigo-500"
                                },
                                {
                                    step: "2",
                                    role: "[직원]",
                                    title: "앱 가입 요청",
                                    description: "직원은 앱에서 가입 시, 등록된 소속 회사를 선택하고 가입을 요청합니다.",
                                    icon: (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none"
                                             viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                  d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                                        </svg>
                                    ),
                                    color: "from-indigo-400 to-purple-500"
                                },
                                {
                                    step: "3",
                                    role: "[관리자]",
                                    title: "가입 승인",
                                    description: "관리자는 웹사이트에서(회원 관리) 직원의 가입 요청을 확인하고 승인합니다.",
                                    icon: (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none"
                                             viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                        </svg>
                                    ),
                                    color: "from-green-400 to-teal-500"
                                },
                                {
                                    step: "4",
                                    role: "[직원]",
                                    title: "앱 로그인",
                                    description: "관리자의 승인이 완료되면, 직원은 앱에 정상적으로 로그인할 수 있습니다.",
                                    icon: (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none"
                                             viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                  d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/>
                                        </svg>
                                    ),
                                    color: "from-purple-400 to-pink-500"
                                }
                            ].map((item, index) => (
                                <motion.div
                                    key={index}
                                    initial={{opacity: 0, y: 20}}
                                    whileInView={{opacity: 1, y: 0}}
                                    viewport={{once: true}}
                                    transition={{duration: 0.5, delay: index * 0.1}}
                                    className="relative"
                                >
                                    {/* 연결선 (마지막 아이템 제외) */}
                                    {index < 3 && (
                                        <div
                                            className="hidden lg:block absolute top-1/3 -right-3 w-6 h-0.5 bg-gradient-to-r from-blue-400/50 to-indigo-400/50"></div>
                                    )}

                                    <div
                                        className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 shadow-2xl hover:bg-white/15 transition-all duration-300 border border-blue-400/20 h-full">
                                        {/* 단계 번호 */}
                                        <div
                                            className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-4 shadow-xl mx-auto`}>
                                            <span className="text-2xl font-bold text-white">{item.step}</span>
                                        </div>

                                        {/* 아이콘 */}
                                        <div className="flex justify-center mb-4 text-blue-400">
                                            {item.icon}
                                        </div>

                                        {/* 역할 */}
                                        <div className="text-center mb-2">
                      <span
                          className={`text-sm font-medium px-3 py-1 rounded-full bg-gradient-to-r ${item.color} bg-opacity-20 text-white`}>
                        {item.role}
                      </span>
                                        </div>

                                        {/* 제목 */}
                                        <h3 className="text-xl font-semibold text-white text-center mb-3">{item.title}</h3>

                                        {/* 설명 */}
                                        <p className="text-blue-100/80 text-center text-sm leading-relaxed">{item.description}</p>
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        {/* 추가 안내 */}
                        <motion.div
                            initial={{opacity: 0, y: 20}}
                            whileInView={{opacity: 1, y: 0}}
                            viewport={{once: true}}
                            transition={{duration: 0.7, delay: 0.4}}
                            className="mt-12 text-center"
                        >
                            <p className="text-blue-100/80 text-lg">
                                ✨ 간단한 4단계로 케어브이 서비스 이용을 시작하세요!
                            </p>
                        </motion.div>
                    </div>

                    {/* 가입 절차 서브섹션 */}
                    <div className="mt-20">
                        <motion.h3
                            initial={{opacity: 0, y: 20}}
                            whileInView={{opacity: 1, y: 0}}
                            viewport={{once: true}}
                            transition={{duration: 0.6}}
                            className="text-3xl md:text-4xl font-bold text-center mb-12 text-white"
                        >
                            가입 절차
                        </motion.h3>

                        {/* 유튜브 영상 */}
                        <motion.div
                            initial={{opacity: 0, scale: 0.9}}
                            whileInView={{opacity: 1, scale: 1}}
                            viewport={{once: true}}
                            transition={{duration: 0.7}}
                            className="max-w-4xl mx-auto"
                        >
                            <div className="relative aspect-video bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl overflow-hidden border border-blue-400/20">
                                <iframe
                                    className="absolute inset-0 w-full h-full"
                                    src="https://www.youtube.com/embed/x2cJedS6vaU"
                                    title="케어브이 가입 및 승인 절차 안내"
                                    frameBorder="0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                    allowFullScreen
                                ></iframe>
                            </div>
                            <p className="text-center text-blue-100/80 mt-4 text-lg">
                                📹 케어브이 가입 및 승인 절차를 영상으로 확인해보세요
                            </p>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* 가격 정보 섹션 */}
            <section id="pricing" className="py-20 bg-slate-900/50 backdrop-blur-sm">
                <div className="container mx-auto px-4">
                    <motion.h2
                        initial={{opacity: 0, y: 20}}
                        whileInView={{opacity: 1, y: 0}}
                        viewport={{once: true}}
                        transition={{duration: 0.6}}
                        className="text-4xl md:text-5xl font-bold text-center mb-16 bg-gradient-to-r from-white via-blue-100 to-indigo-100 bg-clip-text text-transparent"
                    >
                        케어브이 가격 안내
                    </motion.h2>

                    <div className="max-w-4xl mx-auto">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* 무료 체험 카드 */}
                            <motion.div
                                initial={{opacity: 0, x: -20}}
                                whileInView={{opacity: 1, x: 0}}
                                viewport={{once: true}}
                                transition={{duration: 0.6, delay: 0.1}}
                                className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-blue-400/20 hover:bg-white/15 transition-all duration-300"
                            >
                                <div className="text-center">
                                    <div
                                        className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-xl">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white"
                                             fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round"
                                                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                        </svg>
                                    </div>
                                    <h3 className="text-2xl font-bold text-white mb-2">30일 무료 체험</h3>
                                    <div className="text-4xl font-bold text-green-400 mb-4">무료</div>
                                    <p className="text-blue-100/80 mb-6 leading-relaxed">
                                        케어브이의 모든 기능을 30일간 무료로 체험해보세요
                                    </p>
                                    <ul className="space-y-3 text-left text-blue-100/80 text-sm">
                                        <li className="flex items-center">
                                            <svg className="w-4 h-4 text-green-400 mr-3 flex-shrink-0"
                                                 fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd"
                                                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                      clipRule="evenodd"/>
                                            </svg>
                                            모든 휴가 관리 기능 이용
                                        </li>
                                        <li className="flex items-center">
                                            <svg className="w-4 h-4 text-green-400 mr-3 flex-shrink-0"
                                                 fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd"
                                                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                      clipRule="evenodd"/>
                                            </svg>
                                            직원 등록 및 관리
                                        </li>
                                        <li className="flex items-center">
                                            <svg className="w-4 h-4 text-green-400 mr-3 flex-shrink-0"
                                                 fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd"
                                                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                      clipRule="evenodd"/>
                                            </svg>
                                            실시간 알림 및 승인
                                        </li>
                                        <li className="flex items-center">
                                            <svg className="w-4 h-4 text-green-400 mr-3 flex-shrink-0"
                                                 fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd"
                                                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                      clipRule="evenodd"/>
                                            </svg>
                                            고객 지원
                                        </li>
                                    </ul>
                                </div>
                            </motion.div>

                            {/* 유료 구독 카드 */}
                            <motion.div
                                initial={{opacity: 0, x: 20}}
                                whileInView={{opacity: 1, x: 0}}
                                viewport={{once: true}}
                                transition={{duration: 0.6, delay: 0.2}}
                                className="bg-gradient-to-br from-blue-500/20 to-indigo-600/20 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border-2 border-blue-400/30 hover:border-blue-400/50 transition-all duration-300 relative"
                            >
                                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span
                      className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-4 py-2 rounded-full text-sm font-semibold shadow-lg">
                    추천 플랜
                  </span>
                                </div>
                                <div className="text-center mt-4">
                                    <div
                                        className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shadow-xl">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white"
                                             fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round"
                                                  d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>
                                        </svg>
                                    </div>
                                    <h3 className="text-2xl font-bold text-white mb-2">Basic 플랜</h3>
                                    <div className="flex items-center justify-center mb-4">
                                        <span className="text-4xl font-bold text-blue-300">₩9,900</span>
                                        <span className="text-blue-200/70 ml-2">/월</span>
                                    </div>
                                    <p className="text-blue-100/80 mb-6 leading-relaxed">
                                        무료 체험 이후 모든 기능을 계속 이용하세요
                                    </p>
                                    <ul className="space-y-3 text-left text-blue-100/80 text-sm">
                                        <li className="flex items-center">
                                            <svg className="w-4 h-4 text-blue-400 mr-3 flex-shrink-0"
                                                 fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd"
                                                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                      clipRule="evenodd"/>
                                            </svg>
                                            모든 휴가 관리 기능
                                        </li>
                                        <li className="flex items-center">
                                            <svg className="w-4 h-4 text-blue-400 mr-3 flex-shrink-0"
                                                 fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd"
                                                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                      clipRule="evenodd"/>
                                            </svg>
                                            무제한 직원 등록
                                        </li>
                                        <li className="flex items-center">
                                            <svg className="w-4 h-4 text-blue-400 mr-3 flex-shrink-0"
                                                 fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd"
                                                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                      clipRule="evenodd"/>
                                            </svg>
                                            실시간 알림 기능
                                        </li>
                                        <li className="flex items-center">
                                            <svg className="w-4 h-4 text-blue-400 mr-3 flex-shrink-0"
                                                 fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd"
                                                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                      clipRule="evenodd"/>
                                            </svg>
                                            우선 고객 지원
                                        </li>
                                    </ul>
                                </div>
                            </motion.div>
                        </div>
                        {/* 자동 갱신 안내 */}
                        <motion.div
                            initial={{opacity: 0, y: 20}}
                            whileInView={{opacity: 1, y: 0}}
                            viewport={{once: true}}
                            transition={{duration: 0.7, delay: 0.3}}
                            className="mt-12 text-center"
                        >
                            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-blue-400/20">
                                <p className="text-blue-100/80 text-sm leading-relaxed">
                                    구독 서비스는 요금제에 따라 매월 또는 매년 자동 갱신되며, 별도의 해지 조치가 없는 한 정해진 구독 요금이 청구됩니다.
                                </p>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* CTA 섹션 */}
            <section className="py-20 bg-gradient-to-r from-blue-600/30 to-indigo-600/30 backdrop-blur-sm">
                <div className="container mx-auto px-4 text-center">
                    <motion.h2
                        initial={{opacity: 0, y: 20}}
                        whileInView={{opacity: 1, y: 0}}
                        viewport={{once: true}}
                        transition={{duration: 0.7}}
                        className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-white via-blue-100 to-indigo-100 bg-clip-text text-transparent"
                    >
                        지금 바로 케어브이를 시작하세요
                    </motion.h2>
                    <motion.p
                        initial={{opacity: 0, y: 20}}
                        whileInView={{opacity: 1, y: 0}}
                        viewport={{once: true}}
                        transition={{duration: 0.7, delay: 0.1}}
                        className="text-xl text-blue-100/90 mb-10 max-w-2xl mx-auto leading-relaxed"
                    >
                        복잡한 휴무 관리는 이제 그만! 케어브이 관리자 페이지에서<br/>모든 것을 스마트하게 해결하세요.
                    </motion.p>
                    <motion.div
                        initial={{opacity: 0, scale: 0.8}}
                        whileInView={{opacity: 1, scale: 1}}
                        viewport={{once: true}}
                        transition={{duration: 0.7, delay: 0.2}}
                        className="flex flex-col items-center gap-4"
                    >
                        <button
                            onClick={handleGoToLogin}
                            className="px-12 py-4 rounded-xl bg-gradient-to-r from-white to-blue-50 text-blue-700 font-bold text-lg hover:from-blue-50 hover:to-white hover:scale-105 transition-all duration-300 shadow-2xl"
                        >
                            관리자 로그인
                        </button>
                    </motion.div>
                </div>
            </section>

            {/* 푸터 */}
            <footer id="contact"
                    className="bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 shadow-2xl border-t border-blue-800/30 backdrop-blur-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-6">
                        {/* 브랜드 섹션 */}
                        <div className="text-left flex flex-col h-full">
                            <div className="flex justify-start mb-4">
                                <Image
                                    src="/images/logo-text.png"
                                    alt="케어브이 로고"
                                    width={140}
                                    height={47}
                                    className="transition-transform duration-300 hover:scale-105"
                                />
                            </div>

                        </div>

                        {/* 회사 정보 섹션 */}
                        <div className="text-left flex flex-col h-full">
                            <h3 className="text-blue-100 font-semibold text-lg mb-3">회사 정보</h3>
                            <div className="space-y-2 text-sm text-blue-200/70 flex-grow">
                                <div className="flex flex-col sm:flex-row sm:justify-between">
                                    <p><span className="text-blue-300">회사명:</span> silverithm</p>
                                    <p><span className="text-blue-300">대표자:</span> 김준형</p>
                                </div>
                                <div className="flex flex-col sm:flex-row sm:justify-between">
                                    <p><span className="text-blue-300">사업자등록번호:</span> 107-21-26475</p>
                                    <p><span className="text-blue-300">주소:</span> 서울특별시 신림동 1547-10</p>
                                </div>
                            </div>
                        </div>

                        {/* 연락처 섹션 */}
                        <div className="text-left flex flex-col h-full">
                            <h3 className="text-blue-100 font-semibold text-lg mb-3">연락처</h3>
                            <div className="space-y-2 text-sm text-blue-200/70 flex-grow">
                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
                                    <span className="text-blue-300">이메일:</span>
                                    <a href="mailto:ggprgrkjh@naver.com" className="hover:text-white transition-colors">
                                        ggprgrkjh@naver.com
                                    </a>
                                </div>
                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
                                    <span className="text-blue-300">전화번호:</span>
                                    <a href="tel:010-4549-2094" className="hover:text-white transition-colors">
                                        010-4549-2094
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 저작권 및 링크 정보 */}
                    <div className="border-t border-blue-400/20 pt-6">
                        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                            <p className="text-blue-200/60 text-sm">
                                &copy; 2025 케어브이. 모든 권리 보유.
                            </p>
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
                </div>
            </footer>
        </main>
    );
}
