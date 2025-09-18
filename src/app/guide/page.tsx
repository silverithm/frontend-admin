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
                            케어브이 완벽 가이드
                        </h1>
                        <p className="text-xl text-blue-100/90 max-w-3xl mx-auto">
                            관리자와 직원 모두를 위한 상세한 사용 설명서
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
                            👨‍💼 관리자 가이드
                        </button>
                        <button
                            onClick={() => setActiveTab('employee')}
                            className={`px-6 py-3 rounded-full font-medium transition-all ${
                                activeTab === 'employee'
                                    ? 'bg-blue-600 text-white shadow-lg'
                                    : 'bg-white/10 text-blue-200 hover:bg-white/20'
                            }`}
                        >
                            👥 직원 가이드
                        </button>
                    </div>
                </div>
            </section>

            {/* 관리자 가이드 */}
            {activeTab === 'admin' && (
                <section className="py-16 px-4">
                    <div className="container mx-auto max-w-6xl">
                        {/* 초기 설정 */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6 }}
                            className="mb-16"
                        >
                            <h2 className="text-3xl font-bold mb-8 text-center">🚀 관리자 초기 설정</h2>

                            <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-blue-400/20">
                                <div className="space-y-8">
                                    <div>
                                        <h3 className="text-xl font-bold mb-4 text-blue-300">1. 회원가입 및 기관 등록</h3>
                                        <ol className="space-y-3 text-blue-100/80 ml-4">
                                            <li>• carev.kr에 접속하여 "무료로 시작하기" 클릭</li>
                                            <li>• 이메일과 비밀번호로 관리자 계정 생성</li>
                                            <li>• 기관 정보 입력 (기관명, 주소, 연락처)</li>
                                            <li>• 서비스 유형 선택 (요양원, 주간보호센터, 재가센터 등)</li>
                                        </ol>
                                    </div>

                                    <div>
                                        <h3 className="text-xl font-bold mb-4 text-blue-300">2. 부서 및 직급 설정</h3>
                                        <ol className="space-y-3 text-blue-100/80 ml-4">
                                            <li>• 설정 → 조직 관리 메뉴 접속</li>
                                            <li>• 부서 추가: 요양팀, 간호팀, 사무팀 등</li>
                                            <li>• 직급 설정: 팀장, 주임, 직원 등</li>
                                        </ol>
                                    </div>

                                    <div>
                                        <h3 className="text-xl font-bold mb-4 text-blue-300">3. 근무 유형 설정</h3>
                                        <ol className="space-y-3 text-blue-100/80 ml-4">
                                            <li>• 근무 시간 템플릿 생성 (주간, 야간, 휴일)</li>
                                            <li>• 시간대별 설정: 09:00-18:00, 18:00-09:00 등</li>
                                            <li>• 휴게 시간 설정</li>
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
                            <h2 className="text-3xl font-bold mb-8 text-center">👥 직원 관리</h2>

                            <div className="grid md:grid-cols-2 gap-8">
                                <div className="bg-gradient-to-br from-blue-600/20 to-indigo-600/20 backdrop-blur-lg rounded-2xl p-6 border border-blue-400/20">
                                    <h3 className="text-xl font-bold mb-4 text-blue-300">직원 초대하기</h3>
                                    <ol className="space-y-2 text-blue-100/80">
                                        <li>1. 직원 관리 → "직원 초대" 클릭</li>
                                        <li>2. 이메일 주소 입력 또는 초대 링크 생성</li>
                                        <li>3. 부서, 직급, 입사일 설정</li>
                                        <li>4. 권한 설정 (일반/팀장/관리자)</li>
                                        <li>5. 초대 메일 발송 또는 링크 공유</li>
                                    </ol>
                                </div>

                                <div className="bg-gradient-to-br from-indigo-600/20 to-purple-600/20 backdrop-blur-lg rounded-2xl p-6 border border-indigo-400/20">
                                    <h3 className="text-xl font-bold mb-4 text-indigo-300">직원 정보 관리</h3>
                                    <ol className="space-y-2 text-indigo-100/80">
                                        <li>1. 연차 설정: 입사일 기준 자동 계산</li>
                                        <li>2. 연락처 및 비상연락처 등록</li>
                                        <li>5. 프로필 사진 및 메모 추가</li>
                                    </ol>
                                </div>
                            </div>
                        </motion.div>

                        {/* 근무표 작성 */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6 }}
                            className="mb-16"
                        >
                            <h2 className="text-3xl font-bold mb-8 text-center">📅 근무표 작성 실전</h2>

                            <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 backdrop-blur-lg rounded-3xl p-8 border border-purple-400/20">
                                <div className="grid md:grid-cols-2 gap-8">
                                    <div>
                                        <h3 className="text-xl font-bold mb-4 text-purple-300">기본 작성법</h3>
                                        <ol className="space-y-3 text-purple-100/80">
                                            <li className="flex items-start">
                                                <span className="text-green-400 mr-2">✓</span>
                                                <span>근무표 → 새 근무표 작성</span>
                                            </li>
                                            <li className="flex items-start">
                                                <span className="text-green-400 mr-2">✓</span>
                                                <span>월 선택 후 템플릿 불러오기</span>
                                            </li>
                                            <li className="flex items-start">
                                                <span className="text-green-400 mr-2">✓</span>
                                                <span>드래그로 근무 시간 지정</span>
                                            </li>
                                            <li className="flex items-start">
                                                <span className="text-green-400 mr-2">✓</span>
                                                <span>우클릭으로 근무 유형 변경</span>
                                            </li>
                                            <li className="flex items-start">
                                                <span className="text-green-400 mr-2">✓</span>
                                                <span>자동 검증 후 저장</span>
                                            </li>
                                        </ol>
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold mb-4 text-purple-300">고급 기능</h3>
                                        <ol className="space-y-3 text-purple-100/80">
                                            <li className="flex items-start">
                                                <span className="text-yellow-400 mr-2">⚡</span>
                                                <span>패턴 복사: Ctrl+C / Ctrl+V</span>
                                            </li>
                                            <li className="flex items-start">
                                                <span className="text-yellow-400 mr-2">⚡</span>
                                                <span>일괄 적용: Shift + 드래그</span>
                                            </li>
                                            <li className="flex items-start">
                                                <span className="text-yellow-400 mr-2">⚡</span>
                                                <span>충돌 감지: 빨간색 표시</span>
                                            </li>
                                            <li className="flex items-start">
                                                <span className="text-yellow-400 mr-2">⚡</span>
                                                <span>엑셀 임포트/익스포트</span>
                                            </li>
                                        </ol>
                                    </div>
                                </div>

                                <div className="mt-6 p-4 bg-yellow-500/10 rounded-xl border border-yellow-400/30">
                                    <p className="text-yellow-200">
                                        💡 <strong>Pro Tip:</strong> 매달 15일에 다음 달 근무표를 작성하면 직원들이 충분한 시간을 갖고 일정을 조율할 수 있습니다.
                                    </p>
                                </div>
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
                            <h2 className="text-3xl font-bold mb-8 text-center">🏖️ 휴무 승인 프로세스</h2>

                            <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-blue-400/20">
                                <div className="space-y-6">
                                    <div className="flex items-center space-x-4">
                                        <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-xl font-bold">1</div>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-lg text-blue-300">휴무 신청 알림 확인</h4>
                                            <p className="text-blue-100/70">푸시 알림 또는 대시보드에서 신청 내역 확인</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center space-x-4">
                                        <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-xl font-bold">2</div>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-lg text-blue-300">인력 현황 자동 체크</h4>
                                            <p className="text-blue-100/70">해당 날짜의 근무 인원 현황 확인</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center space-x-4">
                                        <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-xl font-bold">3</div>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-lg text-blue-300">승인/반려 결정</h4>
                                            <p className="text-blue-100/70">승인 시 자동으로 근무표 반영, 반려 시 사유 입력</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center space-x-4">
                                        <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-xl font-bold">4</div>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-lg text-blue-300">직원 알림 발송</h4>
                                            <p className="text-blue-100/70">처리 결과가 직원에게 실시간 전달</p>
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
                            <h2 className="text-3xl font-bold mb-8 text-center">📱 앱 설치 및 시작하기</h2>

                            <div className="grid md:grid-cols-2 gap-8">
                                <div className="bg-gradient-to-br from-blue-600/20 to-indigo-600/20 backdrop-blur-lg rounded-2xl p-6 border border-blue-400/20">
                                    <h3 className="text-xl font-bold mb-4 text-blue-300">앱 다운로드</h3>
                                    <ol className="space-y-3 text-blue-100/80">
                                        <li>1. 앱스토어/플레이스토어에서 "케어브이" 검색</li>
                                        <li>2. 케어브이 앱 다운로드 및 설치</li>
                                        <li>3. 관리자가 보낸 초대 링크 클릭</li>
                                        <li>4. 이메일과 비밀번호 설정</li>
                                        <li>5. 프로필 정보 입력 완료</li>
                                    </ol>
                                    <div className="mt-4">
                                        <Link href="https://apps.apple.com/kr/app/케어브이/id6747028185" className="text-blue-400 hover:text-blue-300">
                                            iOS 다운로드 →
                                        </Link>
                                    </div>
                                </div>

                                <div className="bg-gradient-to-br from-green-600/20 to-teal-600/20 backdrop-blur-lg rounded-2xl p-6 border border-green-400/20">
                                    <h3 className="text-xl font-bold mb-4 text-green-300">첫 로그인</h3>
                                    <ol className="space-y-3 text-green-100/80">
                                        <li>1. 앱 실행 후 "로그인" 선택</li>
                                        <li>2. 등록한 이메일과 비밀번호 입력</li>
                                        <li>3. 푸시 알림 허용 (중요!)</li>
                                        <li>4. 생체 인증 설정 (선택사항)</li>
                                        <li>5. 대시보드 확인</li>
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
                            <h2 className="text-3xl font-bold mb-8 text-center">📅 내 근무 확인하기</h2>

                            <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-blue-400/20">
                                <div className="grid md:grid-cols-3 gap-6">
                                    <div>
                                        <h4 className="font-bold text-lg mb-3 text-blue-300">오늘의 근무</h4>
                                        <ul className="space-y-2 text-blue-100/80 text-sm">
                                            <li>• 홈 화면 상단에 표시</li>
                                            <li>• 근무 시작/종료 시간</li>
                                            <li>• 휴게 시간 확인</li>
                                            <li>• 같은 시간 근무자 확인</li>
                                        </ul>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-lg mb-3 text-indigo-300">주간 근무표</h4>
                                        <ul className="space-y-2 text-indigo-100/80 text-sm">
                                            <li>• 좌우 스와이프로 주 이동</li>
                                            <li>• 일주일 근무 패턴 확인</li>
                                            <li>• 휴무일 표시</li>
                                            <li>• 초과근무 시간 계산</li>
                                        </ul>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-lg mb-3 text-purple-300">월간 캘린더</h4>
                                        <ul className="space-y-2 text-purple-100/80 text-sm">
                                            <li>• 캘린더 뷰로 한눈에 확인</li>
                                            <li>• 색상별 근무 유형 구분</li>
                                            <li>• 공휴일 자동 표시</li>
                                            <li>• 월 근무 시간 합계</li>
                                        </ul>
                                    </div>
                                </div>
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
                            <h2 className="text-3xl font-bold mb-8 text-center">🏖️ 휴무 신청하기</h2>

                            <div className="bg-gradient-to-r from-indigo-600/20 to-purple-600/20 backdrop-blur-lg rounded-3xl p-8 border border-indigo-400/20">
                                <div className="grid md:grid-cols-2 gap-8">
                                    <div>
                                        <h3 className="text-xl font-bold mb-4 text-indigo-300">신청 방법</h3>
                                        <ol className="space-y-3 text-indigo-100/80">
                                            <li>
                                                <strong>Step 1:</strong> 하단 메뉴 "휴무 신청" 탭
                                            </li>
                                            <li>
                                                <strong>Step 2:</strong> 휴무 유형 선택
                                                <ul className="ml-4 mt-1 text-sm">
                                                    <li>- 연차 (종일)</li>
                                                    <li>- 반차 (오전/오후)</li>
                                                    <li>- 병가</li>
                                                    <li>- 경조사</li>
                                                </ul>
                                            </li>
                                            <li>
                                                <strong>Step 3:</strong> 날짜 선택 (캘린더에서 터치)
                                            </li>
                                            <li>
                                                <strong>Step 4:</strong> 사유 입력 (간단히)
                                            </li>
                                            <li>
                                                <strong>Step 5:</strong> "신청하기" 버튼 클릭
                                            </li>
                                        </ol>
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold mb-4 text-purple-300">신청 상태 확인</h3>
                                        <div className="space-y-4">
                                            <div className="p-3 bg-white/5 rounded-lg">
                                                <span className="inline-block px-2 py-1 bg-yellow-500/20 text-yellow-300 rounded text-sm mb-2">대기중</span>
                                                <p className="text-sm text-gray-300">관리자 검토 중</p>
                                            </div>
                                            <div className="p-3 bg-white/5 rounded-lg">
                                                <span className="inline-block px-2 py-1 bg-green-500/20 text-green-300 rounded text-sm mb-2">승인</span>
                                                <p className="text-sm text-gray-300">휴무 확정, 근무표 반영</p>
                                            </div>
                                            <div className="p-3 bg-white/5 rounded-lg">
                                                <span className="inline-block px-2 py-1 bg-red-500/20 text-red-300 rounded text-sm mb-2">반려</span>
                                                <p className="text-sm text-gray-300">반려 사유 확인 후 재신청</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-6 p-4 bg-blue-500/10 rounded-xl border border-blue-400/30">
                                    <p className="text-blue-200">
                                        ℹ️ <strong>잔여 연차:</strong> 내 정보 → 연차 관리에서 잔여 연차와 사용 내역을 확인할 수 있습니다.
                                    </p>
                                </div>
                            </div>
                        </motion.div>

                        {/* 근무 교대 */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6 }}
                            className="mb-16"
                        >
                            <h2 className="text-3xl font-bold mb-8 text-center">🔄 근무 교대 요청</h2>

                            <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-blue-400/20">
                                <div className="grid md:grid-cols-2 gap-8">
                                    <div>
                                        <h3 className="text-xl font-bold mb-4 text-blue-300">교대 요청하기</h3>
                                        <ol className="space-y-2 text-blue-100/80">
                                            <li>1. 근무표에서 교대할 날짜 선택</li>
                                            <li>2. "교대 요청" 버튼 클릭</li>
                                            <li>3. 교대 가능한 동료 목록 확인</li>
                                            <li>4. 동료 선택 후 요청 메시지 작성</li>
                                            <li>5. 동료 수락 → 관리자 승인 대기</li>
                                        </ol>
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold mb-4 text-green-300">교대 요청 받았을 때</h3>
                                        <ol className="space-y-2 text-green-100/80">
                                            <li>1. 푸시 알림으로 요청 확인</li>
                                            <li>2. 요청 내용과 날짜 확인</li>
                                            <li>3. 내 일정 확인 후 결정</li>
                                            <li>4. 수락/거절 선택</li>
                                            <li>5. 수락 시 관리자에게 자동 전달</li>
                                        </ol>
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                        {/* 유용한 팁 */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6 }}
                            className="mb-16"
                        >
                            <h2 className="text-3xl font-bold mb-8 text-center">💡 알아두면 유용한 기능</h2>

                            <div className="grid md:grid-cols-3 gap-6">
                                <div className="bg-gradient-to-br from-yellow-600/20 to-orange-600/20 backdrop-blur-lg rounded-xl p-6 border border-yellow-400/20">
                                    <h4 className="font-bold text-lg mb-3 text-yellow-300">알림 설정</h4>
                                    <ul className="space-y-2 text-yellow-100/80 text-sm">
                                        <li>• 근무 시작 1시간 전 알림</li>
                                        <li>• 근무 변경 즉시 알림</li>
                                        <li>• 휴무 승인 알림</li>
                                        <li>• 공지사항 알림</li>
                                    </ul>
                                </div>
                                <div className="bg-gradient-to-br from-green-600/20 to-teal-600/20 backdrop-blur-lg rounded-xl p-6 border border-green-400/20">
                                    <h4 className="font-bold text-lg mb-3 text-green-300">위젯 활용</h4>
                                    <ul className="space-y-2 text-green-100/80 text-sm">
                                        <li>• 홈 화면에 위젯 추가</li>
                                        <li>• 오늘 근무 바로 확인</li>
                                        <li>• 다음 근무 미리보기</li>
                                        <li>• 앱 실행 없이 확인</li>
                                    </ul>
                                </div>
                                <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 backdrop-blur-lg rounded-xl p-6 border border-purple-400/20">
                                    <h4 className="font-bold text-lg mb-3 text-purple-300">다크 모드</h4>
                                    <ul className="space-y-2 text-purple-100/80 text-sm">
                                        <li>• 설정 → 디스플레이</li>
                                        <li>• 야간 근무 시 편안함</li>
                                        <li>• 배터리 절약 효과</li>
                                        <li>• 시스템 설정 연동</li>
                                    </ul>
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
                                href="https://open.kakao.com/o/gvK6Okag"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-8 py-4 bg-white/20 text-white font-bold rounded-full hover:bg-white/30 transition-all duration-300"
                            >
                                카카오톡 실시간 상담
                            </a>
                        </div>
                    </motion.div>
                </div>
            </section>
        </main>
    );
}