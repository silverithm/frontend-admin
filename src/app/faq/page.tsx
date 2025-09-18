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
            question: "케어브이는 무료로 사용할 수 있나요?",
            answer: "네, 케어브이는 10명 이하 소규모 팀의 경우 기본 기능을 완전 무료로 사용할 수 있습니다. 10명 이상의 팀이나 고급 기능(엑셀 다운로드 등)이 필요한 경우 합리적인 가격의 프리미엄 플랜을 이용하실 수 있습니다.",
            category: "pricing"
        },
        {
            question: "모바일에서도 사용할 수 있나요?",
            answer: "물론입니다! iOS와 Android 전용 앱을 제공하며, 앱스토어와 구글 플레이에서 '케어브이' 또는 'CareV'로 검색하여 다운로드할 수 있습니다. 모바일 웹브라우저에서도 완벽하게 동작하므로 앱 설치 없이도 사용 가능합니다.",
            category: "service"
        },
        {
            question: "근무표는 얼마나 미리 작성할 수 있나요?",
            answer: "최대 3개월 후까지 근무표를 미리 작성할 수 있습니다. 월간, 주간, 일간 단위로 유연하게 작성 가능하며, 작성한 근무표는 언제든지 수정할 수 있습니다. 과거 근무표는 2년간 보관되어 언제든 조회 가능합니다.",
            category: "schedule"
        },
        {
            question: "휴무 신청은 어떻게 하나요?",
            answer: "직원은 모바일 앱이나 웹에서 '휴무 신청' 메뉴를 통해 간단히 신청할 수 있습니다. 연차, 반차, 병가, 경조사 등 다양한 휴무 유형을 선택할 수 있으며, 관리자가 승인하면 자동으로 근무표에 반영됩니다. 팀 캘린더에서 동료들의 휴무 일정도 확인 가능합니다.",
            category: "vacation"
        },
        {
            question: "직원들이 자신의 근무표만 볼 수 있도록 설정할 수 있나요?",
            answer: "네, 권한 관리 기능을 통해 설정 가능합니다. 기본적으로 직원은 자신의 근무표와 팀 전체 휴무 현황을 볼 수 있지만, 필요에 따라 다른 직원의 상세 근무 정보를 볼 수 없도록 제한할 수 있습니다. 관리자는 모든 정보에 접근 가능합니다.",
            category: "service"
        },
        {
            question: "근무 교대는 어떻게 처리하나요?",
            answer: "직원 간 근무 교대 요청 기능을 제공합니다. A직원이 B직원에게 교대 요청을 보내고, B직원이 수락하면 관리자에게 승인 요청이 갑니다. 관리자 승인 후 자동으로 근무표가 변경되며, 모든 과정이 기록으로 남아 투명하게 관리됩니다.",
            category: "schedule"
        },
        {
            question: "엑셀 파일로 다운로드할 수 있나요?",
            answer: "프리미엄 플랜 이용 시 근무표를 엑셀, CSV, PDF 형식으로 다운로드할 수 있습니다. 월간/주간/일간 단위로 선택 가능하며, 직원별/부서별로 필터링하여 다운로드할 수도 있습니다. 다운로드한 파일은 바로 인쇄하거나 보고서 작성에 활용 가능합니다.",
            category: "service"
        },
        {
            question: "초과근무 관리도 가능한가요?",
            answer: "네, 초과근무 시간을 자동으로 계산하고 관리할 수 있습니다. 주 52시간 근무제를 자동으로 체크하며, 초과근무 수당 계산을 위한 리포트도 제공합니다. 야간근무, 휴일근무 등 특수 근무도 구분하여 관리 가능합니다.",
            category: "schedule"
        },
        {
            question: "팀원이 늘어나면 요금이 어떻게 되나요?",
            answer: "10명까지는 무료이며, 11명부터는 인원수에 따라 요금이 책정됩니다. 정확한 요금은 홈페이지의 요금제 페이지에서 계산기를 통해 확인할 수 있습니다. 연간 결제 시 20% 할인 혜택도 제공합니다. 비영리단체나 소상공인에게는 추가 할인이 있습니다.",
            category: "pricing"
        },
        {
            question: "연차 관리 기능이 있나요?",
            answer: "네, 완벽한 연차 관리 시스템을 제공합니다. 입사일 기준 연차 자동 계산, 월차 관리, 연차 사용 내역 추적, 잔여 연차 실시간 확인이 가능합니다. 연차 촉진 알림 기능으로 미사용 연차가 소멸되지 않도록 관리할 수 있습니다.",
            category: "vacation"
        },
        {
            question: "공휴일은 자동으로 반영되나요?",
            answer: "네, 대한민국 공휴일과 대체공휴일이 자동으로 반영됩니다. 회사별 창립기념일 등 자체 휴일도 추가할 수 있으며, 공휴일 근무자 설정과 대체휴무 관리도 지원합니다.",
            category: "schedule"
        },
        {
            question: "데이터는 안전하게 보관되나요?",
            answer: "모든 데이터는 클라우드에 암호화되어 안전하게 저장됩니다. 매일 자동 백업되며, SSL 보안 프로토콜을 사용하여 모든 통신이 암호화됩니다.",
            category: "tech"
        },
        {
            question: "알림은 어떤 방식으로 받나요?",
            answer: "앱 푸시 알림, 이메일, 카카오톡 알림(준비 중) 등 다양한 방식을 지원합니다. 알림 종류별로 수신 방법을 개별 설정할 수 있으며, 방해 금지 시간대 설정도 가능합니다.",
            category: "tech"
        },
        {
            question: "기존 엑셀 근무표를 가져올 수 있나요?",
            answer: "네, 엑셀 파일 임포트 기능을 제공합니다. 케어브이에서 제공하는 템플릿에 맞춰 작성하시면 쉽게 가져올 수 있으며, 가져온 후 자동으로 케어브이 형식으로 변환됩니다. 고객센터에서 데이터 이전 지원도 해드립니다.",
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