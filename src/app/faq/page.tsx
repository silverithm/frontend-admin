'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import Navbar from '@/components/Navbar';

interface FAQItem {
    question: string;
    answer: string;
    category: string;
}

export default function FAQPage() {
    const [activeIndex, setActiveIndex] = useState<number | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string>('all');

    const categories = [
        { id: 'all', name: '전체' },
        { id: 'service', name: '서비스 이용' },
        { id: 'schedule', name: '근무표 관리' },
        { id: 'vacation', name: '휴무 관리' },
        { id: 'pricing', name: '요금제' },
        { id: 'tech', name: '기술 지원' },
    ];

    const faqData: FAQItem[] = [
        {
            question: "모바일에서도 사용할 수 있나요?",
            answer: "물론입니다! iOS와 Android 전용 앱을 제공하며, 앱스토어와 구글 플레이에서 '케어브이'로 검색하여 다운로드할 수 있습니다. 모바일 웹브라우저에서도 완벽하게 동작하므로 앱 설치 없이도 사용 가능합니다.",
            category: "service"
        },
        {
            question: "근무표는 얼마나 미리 작성할 수 있나요?",
            answer: "최대 3개월 후까지 근무표를 미리 작성할 수 있습니다. 월간, 주간, 일간 단위로 유연하게 작성 가능하며, 작성한 근무표는 언제든지 수정할 수 있습니다. 과거 근무표는 2년간 보관되어 언제든 조회 가능합니다.",
            category: "schedule"
        },
        {
            question: "휴무 신청은 어떻게 하나요?",
            answer: "직원은 모바일 앱이나 웹에서 '휴무 신청' 메뉴를 통해 간단히 신청할 수 있습니다. 연차, 반차 등 다양한 휴무 유형을 선택할 수 있으며, 관리자가 승인하면 자동으로 근무표에 반영됩니다. 팀 캘린더에서 동료들의 휴무 일정도 확인 가능합니다.",
            category: "vacation"
        },
        {
            question: "데이터는 안전하게 보관되나요?",
            answer: "모든 데이터는 클라우드에 암호화되어 안전하게 저장됩니다. 매일 자동 백업되며, SSL 보안 프로토콜을 사용하여 모든 통신이 암호화됩니다.",
            category: "tech"
        },
        {
            question: "무료 체험 기간이 있나요?",
            answer: "프리미엄 기능은 30일 무료 체험이 가능합니다. 신용카드 등록 없이 바로 시작할 수 있으며, 체험 기간 종료 후 자동 결제되지 않으니 안심하고 사용해보세요.",
            category: "pricing"
        },
        {
            question: "고객 지원은 어떻게 받나요?",
            answer: "평일 09:00-18:00 실시간 채팅 상담을 제공하며, ggprgrkjh@naver.com로 이메일 문의도 가능합니다. 프리미엄 고객에게는 전담 매니저와 우선 지원 서비스를 제공합니다. 자세한 사용 가이드와 동영상 튜토리얼도 준비되어 있습니다.",
            category: "service"
        }
    ];

    const filteredFAQ = selectedCategory === 'all'
        ? faqData
        : faqData.filter(item => item.category === selectedCategory);

    return (
        <main className="min-h-screen bg-gradient-to-b from-slate-900 via-blue-900 to-indigo-900 text-white">
            <Navbar />

            {/* 헤더 섹션 */}
            <section className="relative pt-32 pb-16 px-4">
                <div className="container mx-auto max-w-6xl">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="text-center mb-12"
                    >
                        <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-white via-blue-100 to-indigo-100 bg-clip-text text-transparent">
                            자주 묻는 질문
                        </h1>
                        <p className="text-xl text-blue-100/90 max-w-3xl mx-auto">
                            케어브이 사용에 대한 궁금증을 해결해드립니다
                        </p>
                    </motion.div>

                    {/* 카테고리 필터 */}
                    <div className="flex flex-wrap justify-center gap-3">
                        {categories.map((category) => (
                            <button
                                key={category.id}
                                onClick={() => setSelectedCategory(category.id)}
                                className={`px-4 py-2 rounded-full font-medium transition-all duration-300 ${
                                    selectedCategory === category.id
                                        ? 'bg-blue-600 text-white shadow-lg'
                                        : 'bg-white/10 text-blue-200 hover:bg-white/20'
                                }`}
                            >
                                {category.name}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            {/* FAQ 리스트 */}
            <section className="py-16 px-4">
                <div className="container mx-auto max-w-4xl">
                    <div className="space-y-4">
                        {filteredFAQ.map((item, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: index * 0.05 }}
                            >
                                <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-blue-400/20 overflow-hidden">
                                    <button
                                        className="w-full px-6 py-5 text-left flex items-center justify-between hover:bg-white/5 transition-colors"
                                        onClick={() => setActiveIndex(activeIndex === index ? null : index)}
                                    >
                                        <div className="flex-1">
                                            <h3 className="text-lg font-semibold text-white pr-4">
                                                {item.question}
                                            </h3>
                                        </div>
                                        <svg
                                            className={`w-6 h-6 text-blue-300 transform transition-transform ${
                                                activeIndex === index ? 'rotate-180' : ''
                                            }`}
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M19 9l-7 7-7-7"
                                            />
                                        </svg>
                                    </button>
                                    {activeIndex === index && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            transition={{ duration: 0.3 }}
                                            className="px-6 pb-5"
                                        >
                                            <p className="text-blue-100/80 leading-relaxed">
                                                {item.answer}
                                            </p>
                                        </motion.div>
                                    )}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA 섹션 */}
            <section className="py-20 px-4">
                <div className="container mx-auto max-w-4xl text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-12"
                    >
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">
                            더 궁금하신 점이 있으신가요?
                        </h2>
                        <p className="text-xl mb-8 text-blue-100">
                            고객센터에서 친절하게 답변해드립니다
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <a href="mailto:ggprgrkjh@naver.com" className="px-8 py-4 bg-white text-blue-600 font-bold rounded-full hover:shadow-lg transform hover:scale-105 transition-all duration-300">
                                이메일 문의하기
                            </a>
                            <a href="https://open.kakao.com/o/gvK6Okag" target="_blank" rel="noopener noreferrer" className="px-8 py-4 bg-white/20 text-white font-bold rounded-full hover:bg-white/30 transition-all duration-300">
                                카카오톡 실시간 상담
                            </a>
                        </div>
                    </motion.div>
                </div>
            </section>
        </main>
    );
}