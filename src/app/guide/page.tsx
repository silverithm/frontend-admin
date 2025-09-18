'use client';

import { motion } from 'framer-motion';
import Navbar from '@/components/Navbar';
import Link from 'next/link';
import { useState } from 'react';

export default function GuidePage() {
    const [activeTab, setActiveTab] = useState('admin');

    return (
        <main className="min-h-screen bg-gradient-to-b from-slate-900 via-blue-900 to-indigo-900 text-white">
            <Navbar />

            {/* 히어로 섹션 */}
            <section className="relative pt-32 pb-16 px-4">
                <div className="container mx-auto max-w-6xl">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="text-center mb-12"
                    >
                        <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-white via-blue-100 to-indigo-100 bg-clip-text text-transparent">
                            케어브이 사용 가이드
                        </h1>
                        <p className="text-xl text-blue-100/90 max-w-3xl mx-auto">
                            장기요양기관 관리자와 직원을 위한 간단한 사용 방법
                        </p>
                    </motion.div>

                    {/* 탭 선택 */}
                    <div className="flex justify-center gap-4 mb-12">
                        <button
                            onClick={() => setActiveTab('admin')}
                            className={`px-6 py-3 rounded-full font-medium transition-all ${
                                activeTab === 'admin'
                                    ? 'bg-blue-600 text-white shadow-lg'
                                    : 'bg-white/10 text-blue-200 hover:bg-white/20'
                            }`}
                        >
                            관리자 가이드
                        </button>
                        <button
                            onClick={() => setActiveTab('employee')}
                            className={`px-6 py-3 rounded-full font-medium transition-all ${
                                activeTab === 'employee'
                                    ? 'bg-blue-600 text-white shadow-lg'
                                    : 'bg-white/10 text-blue-200 hover:bg-white/20'
                            }`}
                        >
                            직원 가이드
                        </button>
                    </div>
                </div>
            </section>

            {/* 관리자 가이드 */}
            {activeTab === 'admin' && (
                <section className="py-16 px-4">
                    <div className="container mx-auto max-w-6xl">
                        {/* 시작하기 */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6 }}
                            className="mb-16"
                        >
                            <h2 className="text-3xl font-bold mb-8 text-center">🚀 관리자 시작하기</h2>

                            <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-blue-400/20">
                                <div className="space-y-8">
                                    <div>
                                        <h3 className="text-xl font-bold mb-4 text-blue-300">1. 회원가입</h3>
                                        <ol className="space-y-3 text-blue-100/80 ml-4">
                                            <li>• carev.kr에 접속하여 관리자 로그인 클릭</li>
                                            <li>• 이메일과 비밀번호로 계정 생성</li>
                                            <li>• 기관 정보 입력 (기관명, 주소, 연락처)</li>
                                            <li>• 30일 무료 체험 시작</li>
                                        </ol>
                                    </div>

                                    <div>
                                        <h3 className="text-xl font-bold mb-4 text-blue-300">2. 직원 초대</h3>
                                        <ol className="space-y-3 text-blue-100/80 ml-4">
                                            <li>• 직원에게 앱 다운로드 안내</li>
                                            <li>• 직원이 앱에서 가입 신청</li>
                                            <li>• 관리자 페이지에서 승인 처리</li>
                                        </ol>
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                        {/* 직원 관리 */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6 }}
                            className="mb-16"
                        >
                            <h2 className="text-3xl font-bold mb-8 text-center">👥 직원 가입 승인</h2>

                            <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-blue-400/20">
                                <ol className="space-y-4 text-blue-100/80">
                                    <li className="flex items-start">
                                        <span className="text-green-400 mr-3 mt-1">✓</span>
                                        <span>직원이 앱에서 가입 신청하면 관리자 페이지에 알림 표시</span>
                                    </li>
                                    <li className="flex items-start">
                                        <span className="text-green-400 mr-3 mt-1">✓</span>
                                        <span>가입 요청 목록에서 직원 정보 확인</span>
                                    </li>
                                    <li className="flex items-start">
                                        <span className="text-green-400 mr-3 mt-1">✓</span>
                                        <span>승인 버튼 클릭으로 간단하게 처리</span>
                                    </li>
                                    <li className="flex items-start">
                                        <span className="text-green-400 mr-3 mt-1">✓</span>
                                        <span>승인된 직원은 즉시 앱 사용 가능</span>
                                    </li>
                                </ol>
                            </div>
                        </motion.div>

                        {/* 근무표 관리 */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6 }}
                            className="mb-16"
                        >
                            <h2 className="text-3xl font-bold mb-8 text-center">📅 근무표 관리</h2>

                            <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 backdrop-blur-lg rounded-3xl p-8 border border-purple-400/20">
                                <h3 className="text-xl font-bold mb-4 text-purple-300">근무표 작성 방법</h3>
                                <ol className="space-y-3 text-purple-100/80">
                                    <li className="flex items-start">
                                        <span className="text-green-400 mr-2">1.</span>
                                        <span>근무표 메뉴에서 새 근무표 작성</span>
                                    </li>
                                    <li className="flex items-start">
                                        <span className="text-green-400 mr-2">2.</span>
                                        <span>직원별 근무 일정 입력</span>
                                    </li>
                                    <li className="flex items-start">
                                        <span className="text-green-400 mr-2">3.</span>
                                        <span>휴무 날짜 설정</span>
                                    </li>
                                    <li className="flex items-start">
                                        <span className="text-green-400 mr-2">4.</span>
                                        <span>저장 후 직원에게 자동 알림</span>
                                    </li>
                                </ol>
                            </div>
                        </motion.div>

                        {/* 휴무 승인 */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6 }}
                            className="mb-16"
                        >
                            <h2 className="text-3xl font-bold mb-8 text-center">🏖️ 휴무 요청 관리</h2>

                            <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-blue-400/20">
                                <div className="space-y-6">
                                    <div className="flex items-center space-x-4">
                                        <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-xl font-bold">1</div>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-lg text-blue-300">휴무 신청 알림</h4>
                                            <p className="text-blue-100/70">직원이 휴무 신청 시 실시간 알림</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center space-x-4">
                                        <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-xl font-bold">2</div>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-lg text-blue-300">신청 내역 확인</h4>
                                            <p className="text-blue-100/70">날짜와 사유 확인</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center space-x-4">
                                        <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-xl font-bold">3</div>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-lg text-blue-300">승인/반려 처리</h4>
                                            <p className="text-blue-100/70">간단한 클릭으로 처리</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center space-x-4">
                                        <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-xl font-bold">4</div>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-lg text-blue-300">자동 알림</h4>
                                            <p className="text-blue-100/70">처리 결과 직원 앱으로 전달</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </section>
            )}

            {/* 직원 가이드 */}
            {activeTab === 'employee' && (
                <section className="py-16 px-4">
                    <div className="container mx-auto max-w-6xl">
                        {/* 앱 설치 및 로그인 */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6 }}
                            className="mb-16"
                        >
                            <h2 className="text-3xl font-bold mb-8 text-center">📱 앱 시작하기</h2>

                            <div className="grid md:grid-cols-2 gap-8">
                                <div className="bg-gradient-to-br from-blue-600/20 to-indigo-600/20 backdrop-blur-lg rounded-2xl p-6 border border-blue-400/20">
                                    <h3 className="text-xl font-bold mb-4 text-blue-300">앱 다운로드</h3>
                                    <ol className="space-y-3 text-blue-100/80">
                                        <li>1. 스토어에서 &ldquo;케어브이&rdquo; 검색</li>
                                        <li>2. 앱 다운로드 및 설치</li>
                                        <li>3. 소속 기관 선택</li>
                                        <li>4. 가입 요청 제출</li>
                                    </ol>
                                    <div className="mt-4">
                                        <Link href="https://apps.apple.com/kr/app/케어브이/id6747028185" className="text-blue-400 hover:text-blue-300">
                                            iOS 다운로드 →
                                        </Link>
                                    </div>
                                </div>

                                <div className="bg-gradient-to-br from-green-600/20 to-teal-600/20 backdrop-blur-lg rounded-2xl p-6 border border-green-400/20">
                                    <h3 className="text-xl font-bold mb-4 text-green-300">가입 승인 후</h3>
                                    <ol className="space-y-3 text-green-100/80">
                                        <li>1. 관리자 승인 완료 알림</li>
                                        <li>2. 앱 로그인</li>
                                        <li>3. 푸시 알림 허용</li>
                                        <li>4. 근무표 확인 시작</li>
                                    </ol>
                                    <div className="mt-4">
                                        <Link href="https://play.google.com/store/apps/details?id=com.silverithm.carev.app" className="text-green-400 hover:text-green-300">
                                            Android 다운로드 →
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                        {/* 근무 확인 */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6 }}
                            className="mb-16"
                        >
                            <h2 className="text-3xl font-bold mb-8 text-center">📅 근무표 확인</h2>

                            <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-blue-400/20">
                                <ol className="space-y-4 text-blue-100/80">
                                    <li className="flex items-start">
                                        <span className="text-green-400 mr-3 mt-1">1.</span>
                                        <span>앱 홈 화면에서 오늘의 근무 시간 확인</span>
                                    </li>
                                    <li className="flex items-start">
                                        <span className="text-green-400 mr-3 mt-1">2.</span>
                                        <span>주간/월간 근무 일정 조회</span>
                                    </li>
                                    <li className="flex items-start">
                                        <span className="text-green-400 mr-3 mt-1">3.</span>
                                        <span>휴무일 및 공휴일 확인</span>
                                    </li>
                                    <li className="flex items-start">
                                        <span className="text-green-400 mr-3 mt-1">4.</span>
                                        <span>동료들의 근무 일정 확인</span>
                                    </li>
                                </ol>
                            </div>
                        </motion.div>

                        {/* 휴무 신청 */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6 }}
                            className="mb-16"
                        >
                            <h2 className="text-3xl font-bold mb-8 text-center">🏖️ 휴무 신청</h2>

                            <div className="bg-gradient-to-r from-indigo-600/20 to-purple-600/20 backdrop-blur-lg rounded-3xl p-8 border border-indigo-400/20">
                                <div className="grid md:grid-cols-2 gap-8">
                                    <div>
                                        <h3 className="text-xl font-bold mb-4 text-indigo-300">신청 방법</h3>
                                        <ol className="space-y-3 text-indigo-100/80">
                                            <li>1. 앱에서 휴무 신청 메뉴 선택</li>
                                            <li>2. 휴무 유형 선택 (연차, 반차 등)</li>
                                            <li>3. 희망 날짜 선택</li>
                                            <li>4. 사유 입력</li>
                                            <li>5. 신청 제출</li>
                                        </ol>
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold mb-4 text-purple-300">처리 상태</h3>
                                        <div className="space-y-4">
                                            <div className="p-3 bg-white/5 rounded-lg">
                                                <span className="inline-block px-2 py-1 bg-yellow-500/20 text-yellow-300 rounded text-sm mb-2">대기중</span>
                                                <p className="text-sm text-gray-300">관리자 검토 중</p>
                                            </div>
                                            <div className="p-3 bg-white/5 rounded-lg">
                                                <span className="inline-block px-2 py-1 bg-green-500/20 text-green-300 rounded text-sm mb-2">승인</span>
                                                <p className="text-sm text-gray-300">휴무 확정</p>
                                            </div>
                                            <div className="p-3 bg-white/5 rounded-lg">
                                                <span className="inline-block px-2 py-1 bg-red-500/20 text-red-300 rounded text-sm mb-2">반려</span>
                                                <p className="text-sm text-gray-300">사유 확인 후 재신청</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                    </div>
                </section>
            )}

            {/* 문의 섹션 */}
            <section className="py-20 px-4 bg-slate-800/50">
                <div className="container mx-auto max-w-4xl text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-12"
                    >
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">
                            더 궁금한 점이 있으신가요?
                        </h2>
                        <p className="text-xl mb-8 text-blue-100">
                            케어브이 전문가가 직접 도와드립니다
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Link href="/faq">
                                <button className="px-8 py-4 bg-white text-blue-600 font-bold rounded-full hover:shadow-lg transform hover:scale-105 transition-all duration-300">
                                    자주 묻는 질문
                                </button>
                            </Link>
                            <a
                                href="mailto:ggprgrkjh@naver.com"
                                className="px-8 py-4 bg-white/20 text-white font-bold rounded-full hover:bg-white/30 transition-all duration-300"
                            >
                                이메일 문의
                            </a>
                        </div>
                    </motion.div>
                </div>
            </section>
        </main>
    );
}