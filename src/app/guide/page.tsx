'use client';

import { motion } from 'framer-motion';
import Navbar from '@/components/Navbar';
import Link from 'next/link';
import { useState } from 'react';
import { Card } from '@astryxdesign/core/Card';
import { Button } from '@astryxdesign/core/Button';
import { Text } from '@astryxdesign/core/Text';
import { Heading } from '@astryxdesign/core/Heading';
import { Icon } from '@astryxdesign/core/Icon';
import { Badge } from '@astryxdesign/core/Badge';

const heroBackground =
    'linear-gradient(to bottom, #0f172a 0%, #1e3a8a 55%, #312e81 100%)';

const panelStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.1)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    borderRadius: 24,
    border: '1px solid rgba(96,165,250,0.2)',
    color: '#ffffff',
};

const numberCircleStyle: React.CSSProperties = {
    width: 48,
    height: 48,
    flexShrink: 0,
    borderRadius: '9999px',
    background: '#2563eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    fontWeight: 700,
    color: '#ffffff',
};

export default function GuidePage() {
    const [activeTab, setActiveTab] = useState('admin');

    return (
        <main style={{ minHeight: '100vh', background: heroBackground, color: '#ffffff' }}>
            <Navbar />

            {/* 히어로 섹션 */}
            <section style={{ position: 'relative', padding: '128px 16px 64px' }}>
                <div style={{ maxWidth: 1152, margin: '0 auto' }}>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        style={{ textAlign: 'center', marginBottom: 48 }}
                    >
                        <Heading
                            level={1}
                            type="display-1"
                            color="inherit"
                            justify="center"
                            style={{ marginBottom: 24 }}
                        >
                            케어브이 사용 가이드
                        </Heading>
                        <Text
                            type="large"
                            color="inherit"
                            justify="center"
                            style={{ display: 'block', maxWidth: 768, margin: '0 auto', color: 'rgba(219,234,254,0.9)' }}
                        >
                            장기요양기관 관리자와 직원을 위한 간단한 사용 방법
                        </Text>
                    </motion.div>

                    {/* 탭 선택 */}
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 48 }}>
                        <Button
                            label="관리자 가이드"
                            size="lg"
                            variant={activeTab === 'admin' ? 'primary' : 'secondary'}
                            onClick={() => setActiveTab('admin')}
                        />
                        <Button
                            label="직원 가이드"
                            size="lg"
                            variant={activeTab === 'employee' ? 'primary' : 'secondary'}
                            onClick={() => setActiveTab('employee')}
                        />
                    </div>
                </div>
            </section>

            {/* 관리자 가이드 */}
            {activeTab === 'admin' && (
                <section style={{ padding: '64px 16px' }}>
                    <div style={{ maxWidth: 1152, margin: '0 auto' }}>
                        {/* 시작하기 */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6 }}
                            style={{ marginBottom: 64 }}
                        >
                            <Heading level={2} color="inherit" justify="center" style={{ marginBottom: 32 }}>
                                🚀 관리자 시작하기
                            </Heading>

                            <Card padding={8} style={panelStyle}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                                    <div>
                                        <Heading level={3} color="inherit" style={{ marginBottom: 16, color: '#93c5fd' }}>
                                            1. 회원가입
                                        </Heading>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginLeft: 16, color: 'rgba(219,234,254,0.8)' }}>
                                            <Text color="inherit">• carev.kr에 접속하여 관리자 로그인 클릭</Text>
                                            <Text color="inherit">• 이메일과 비밀번호로 계정 생성</Text>
                                            <Text color="inherit">• 기관 정보 입력 (기관명, 주소, 연락처)</Text>
                                            <Text color="inherit">• 30일 무료 체험 시작</Text>
                                        </div>
                                    </div>

                                    <div>
                                        <Heading level={3} color="inherit" style={{ marginBottom: 16, color: '#93c5fd' }}>
                                            2. 직원 초대
                                        </Heading>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginLeft: 16, color: 'rgba(219,234,254,0.8)' }}>
                                            <Text color="inherit">• 직원에게 앱 다운로드 안내</Text>
                                            <Text color="inherit">• 직원이 앱에서 가입 신청</Text>
                                            <Text color="inherit">• 관리자 페이지에서 승인 처리</Text>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>

                        {/* 직원 관리 */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6 }}
                            style={{ marginBottom: 64 }}
                        >
                            <Heading level={2} color="inherit" justify="center" style={{ marginBottom: 32 }}>
                                👥 직원 가입 승인
                            </Heading>

                            <Card padding={8} style={panelStyle}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, color: 'rgba(219,234,254,0.8)' }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                        <span style={{ marginTop: 2 }}><Icon icon="check" color="success" /></span>
                                        <Text color="inherit">직원이 앱에서 가입 신청하면 관리자 페이지에 알림 표시</Text>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                        <span style={{ marginTop: 2 }}><Icon icon="check" color="success" /></span>
                                        <Text color="inherit">가입 요청 목록에서 직원 정보 확인</Text>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                        <span style={{ marginTop: 2 }}><Icon icon="check" color="success" /></span>
                                        <Text color="inherit">승인 버튼 클릭으로 간단하게 처리</Text>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                        <span style={{ marginTop: 2 }}><Icon icon="check" color="success" /></span>
                                        <Text color="inherit">승인된 직원은 즉시 앱 사용 가능</Text>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>

                        {/* 근무표 관리 */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6 }}
                            style={{ marginBottom: 64 }}
                        >
                            <Heading level={2} color="inherit" justify="center" style={{ marginBottom: 32 }}>
                                📅 근무표 관리
                            </Heading>

                            <Card
                                padding={8}
                                style={{
                                    ...panelStyle,
                                    background: 'linear-gradient(to right, rgba(147,51,234,0.2), rgba(219,39,119,0.2))',
                                    border: '1px solid rgba(192,132,252,0.2)',
                                }}
                            >
                                <Heading level={3} color="inherit" style={{ marginBottom: 16, color: '#d8b4fe' }}>
                                    근무표 작성 방법
                                </Heading>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, color: 'rgba(243,232,255,0.8)' }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                        <Text color="inherit" style={{ color: '#4ade80' }}>1.</Text>
                                        <Text color="inherit">근무표 메뉴에서 새 근무표 작성</Text>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                        <Text color="inherit" style={{ color: '#4ade80' }}>2.</Text>
                                        <Text color="inherit">직원별 근무 일정 입력</Text>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                        <Text color="inherit" style={{ color: '#4ade80' }}>3.</Text>
                                        <Text color="inherit">휴무 날짜 설정</Text>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                        <Text color="inherit" style={{ color: '#4ade80' }}>4.</Text>
                                        <Text color="inherit">저장 후 직원에게 자동 알림</Text>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>

                        {/* 휴무 승인 */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6 }}
                            style={{ marginBottom: 64 }}
                        >
                            <Heading level={2} color="inherit" justify="center" style={{ marginBottom: 32 }}>
                                🏖️ 휴무 요청 관리
                            </Heading>

                            <Card padding={8} style={panelStyle}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                        <div style={numberCircleStyle}>1</div>
                                        <div style={{ flex: 1 }}>
                                            <Heading level={4} color="inherit" style={{ color: '#93c5fd' }}>휴무 신청 알림</Heading>
                                            <Text color="inherit" style={{ color: 'rgba(219,234,254,0.7)' }}>직원이 휴무 신청 시 실시간 알림</Text>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                        <div style={numberCircleStyle}>2</div>
                                        <div style={{ flex: 1 }}>
                                            <Heading level={4} color="inherit" style={{ color: '#93c5fd' }}>신청 내역 확인</Heading>
                                            <Text color="inherit" style={{ color: 'rgba(219,234,254,0.7)' }}>날짜와 사유 확인</Text>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                        <div style={numberCircleStyle}>3</div>
                                        <div style={{ flex: 1 }}>
                                            <Heading level={4} color="inherit" style={{ color: '#93c5fd' }}>승인/반려 처리</Heading>
                                            <Text color="inherit" style={{ color: 'rgba(219,234,254,0.7)' }}>간단한 클릭으로 처리</Text>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                        <div style={numberCircleStyle}>4</div>
                                        <div style={{ flex: 1 }}>
                                            <Heading level={4} color="inherit" style={{ color: '#93c5fd' }}>자동 알림</Heading>
                                            <Text color="inherit" style={{ color: 'rgba(219,234,254,0.7)' }}>처리 결과 직원 앱으로 전달</Text>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>
                    </div>
                </section>
            )}

            {/* 직원 가이드 */}
            {activeTab === 'employee' && (
                <section style={{ padding: '64px 16px' }}>
                    <div style={{ maxWidth: 1152, margin: '0 auto' }}>
                        {/* 앱 설치 및 로그인 */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6 }}
                            style={{ marginBottom: 64 }}
                        >
                            <Heading level={2} color="inherit" justify="center" style={{ marginBottom: 32 }}>
                                📱 앱 시작하기
                            </Heading>

                            <div className="carev-guide-grid-2" style={{ gap: 32 }}>
                                <Card
                                    padding={6}
                                    style={{
                                        ...panelStyle,
                                        borderRadius: 16,
                                        background: 'linear-gradient(to bottom right, rgba(37,99,235,0.2), rgba(79,70,229,0.2))',
                                    }}
                                >
                                    <Heading level={3} color="inherit" style={{ marginBottom: 16, color: '#93c5fd' }}>
                                        앱 다운로드
                                    </Heading>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, color: 'rgba(219,234,254,0.8)' }}>
                                        <Text color="inherit">1. 스토어에서 &ldquo;케어브이&rdquo; 검색</Text>
                                        <Text color="inherit">2. 앱 다운로드 및 설치</Text>
                                        <Text color="inherit">3. 소속 기관 선택</Text>
                                        <Text color="inherit">4. 가입 요청 제출</Text>
                                    </div>
                                    <div style={{ marginTop: 16 }}>
                                        <Link href="https://apps.apple.com/kr/app/케어브이/id6747028185" style={{ color: '#60a5fa', textDecoration: 'none' }}>
                                            iOS 다운로드 →
                                        </Link>
                                    </div>
                                </Card>

                                <Card
                                    padding={6}
                                    style={{
                                        ...panelStyle,
                                        borderRadius: 16,
                                        background: 'linear-gradient(to bottom right, rgba(22,163,74,0.2), rgba(13,148,136,0.2))',
                                        border: '1px solid rgba(74,222,128,0.2)',
                                    }}
                                >
                                    <Heading level={3} color="inherit" style={{ marginBottom: 16, color: '#86efac' }}>
                                        가입 승인 후
                                    </Heading>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, color: 'rgba(220,252,231,0.8)' }}>
                                        <Text color="inherit">1. 관리자 승인 완료 알림</Text>
                                        <Text color="inherit">2. 앱 로그인</Text>
                                        <Text color="inherit">3. 푸시 알림 허용</Text>
                                        <Text color="inherit">4. 근무표 확인 시작</Text>
                                    </div>
                                    <div style={{ marginTop: 16 }}>
                                        <Link href="https://play.google.com/store/apps/details?id=com.silverithm.carev.app" style={{ color: '#4ade80', textDecoration: 'none' }}>
                                            Android 다운로드 →
                                        </Link>
                                    </div>
                                </Card>
                            </div>
                        </motion.div>

                        {/* 근무 확인 */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6 }}
                            style={{ marginBottom: 64 }}
                        >
                            <Heading level={2} color="inherit" justify="center" style={{ marginBottom: 32 }}>
                                📅 근무표 확인
                            </Heading>

                            <Card padding={8} style={panelStyle}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, color: 'rgba(219,234,254,0.8)' }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                        <Text color="inherit" style={{ marginTop: 2, color: '#4ade80' }}>1.</Text>
                                        <Text color="inherit">앱 홈 화면에서 오늘의 근무 시간 확인</Text>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                        <Text color="inherit" style={{ marginTop: 2, color: '#4ade80' }}>2.</Text>
                                        <Text color="inherit">주간/월간 근무 일정 조회</Text>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                        <Text color="inherit" style={{ marginTop: 2, color: '#4ade80' }}>3.</Text>
                                        <Text color="inherit">휴무일 및 공휴일 확인</Text>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                        <Text color="inherit" style={{ marginTop: 2, color: '#4ade80' }}>4.</Text>
                                        <Text color="inherit">동료들의 근무 일정 확인</Text>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>

                        {/* 휴무 신청 */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6 }}
                            style={{ marginBottom: 64 }}
                        >
                            <Heading level={2} color="inherit" justify="center" style={{ marginBottom: 32 }}>
                                🏖️ 휴무 신청
                            </Heading>

                            <Card
                                padding={8}
                                style={{
                                    ...panelStyle,
                                    background: 'linear-gradient(to right, rgba(79,70,229,0.2), rgba(147,51,234,0.2))',
                                    border: '1px solid rgba(129,140,248,0.2)',
                                }}
                            >
                                <div className="carev-guide-grid-2" style={{ gap: 32 }}>
                                    <div>
                                        <Heading level={3} color="inherit" style={{ marginBottom: 16, color: '#a5b4fc' }}>
                                            신청 방법
                                        </Heading>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, color: 'rgba(224,231,255,0.8)' }}>
                                            <Text color="inherit">1. 앱에서 휴무 신청 메뉴 선택</Text>
                                            <Text color="inherit">2. 휴무 유형 선택 (연차, 반차 등)</Text>
                                            <Text color="inherit">3. 희망 날짜 선택</Text>
                                            <Text color="inherit">4. 사유 입력</Text>
                                            <Text color="inherit">5. 신청 제출</Text>
                                        </div>
                                    </div>
                                    <div>
                                        <Heading level={3} color="inherit" style={{ marginBottom: 16, color: '#d8b4fe' }}>
                                            처리 상태
                                        </Heading>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                            <div style={{ padding: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 8 }}>
                                                <div style={{ marginBottom: 8 }}>
                                                    <Badge variant="yellow" label="대기중" />
                                                </div>
                                                <Text color="inherit" style={{ color: '#d1d5db' }}>관리자 검토 중</Text>
                                            </div>
                                            <div style={{ padding: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 8 }}>
                                                <div style={{ marginBottom: 8 }}>
                                                    <Badge variant="green" label="승인" />
                                                </div>
                                                <Text color="inherit" style={{ color: '#d1d5db' }}>휴무 확정</Text>
                                            </div>
                                            <div style={{ padding: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 8 }}>
                                                <div style={{ marginBottom: 8 }}>
                                                    <Badge variant="red" label="반려" />
                                                </div>
                                                <Text color="inherit" style={{ color: '#d1d5db' }}>사유 확인 후 재신청</Text>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>

                    </div>
                </section>
            )}

            {/* 문의 섹션 */}
            <section style={{ padding: '80px 16px', background: 'rgba(30,41,59,0.5)' }}>
                <div style={{ maxWidth: 896, margin: '0 auto', textAlign: 'center' }}>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        style={{
                            background: 'linear-gradient(to right, #2563eb, #4f46e5)',
                            borderRadius: 24,
                            padding: 48,
                        }}
                    >
                        <Heading level={2} color="inherit" justify="center" style={{ marginBottom: 16 }}>
                            더 궁금한 점이 있으신가요?
                        </Heading>
                        <Text
                            type="large"
                            color="inherit"
                            justify="center"
                            style={{ display: 'block', marginBottom: 32, color: '#dbeafe' }}
                        >
                            케어브이 전문가가 직접 도와드립니다
                        </Text>
                        <div className="carev-guide-cta-actions">
                            <Link href="/faq">
                                <Button label="자주 묻는 질문" variant="secondary" size="lg" />
                            </Link>
                            <a href="mailto:ggprgrkjh@naver.com" style={{ textDecoration: 'none' }}>
                                <Button label="이메일 문의" variant="ghost" size="lg" />
                            </a>
                        </div>
                    </motion.div>
                </div>
            </section>
        </main>
    );
}
