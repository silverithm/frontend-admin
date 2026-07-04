'use client';

import React from 'react';
import {useRouter} from 'next/navigation';
import Image from 'next/image';
import {motion} from 'framer-motion';
import {Button} from '@astryxdesign/core/Button';
import Navbar from '@/components/Navbar';

// 그라데이션 클립 텍스트(마케팅 히어로/섹션 제목 전용 bespoke 스타일)
const gradientText: React.CSSProperties = {
    backgroundImage: 'linear-gradient(to right, #ffffff, #dbeafe, #e0e7ff)',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    color: 'transparent',
};

// 유리질감 카드 (bg-white/10 backdrop-blur rounded-2xl shadow-2xl border)
const glassCard: React.CSSProperties = {
    background: 'rgba(255,255,255,0.1)',
    backdropFilter: 'blur(16px)',
    borderRadius: 16,
    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
    border: '1px solid rgba(96,165,250,0.2)',
};

const containerStyle = (px: number = 16, maxWidth: number = 1200): React.CSSProperties => ({
    width: '100%',
    maxWidth,
    marginLeft: 'auto',
    marginRight: 'auto',
    paddingLeft: px,
    paddingRight: px,
});

const sectionHeading: React.CSSProperties = {
    ...gradientText,
    textAlign: 'center',
    fontWeight: 700,
    fontSize: 'clamp(2.25rem, 5vw, 3rem)',
    lineHeight: 1.1,
    marginBottom: 64,
};

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

    const handleGoToLogin = (e?: React.MouseEvent, loginType: 'admin' | 'employee' = 'admin') => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        try {
            // 로그인 타입을 localStorage에 저장하여 로그인 페이지에서 사용
            localStorage.setItem('lastLoginType', loginType);
            router.push('/login');
        } catch (error) {
            window.location.href = '/login';
        }
    };


    // 앱 스토어 및 구글 플레이 스토어 링크
    const appStoreLink = "https://apps.apple.com/kr/app/%EC%BC%80%EC%96%B4%EB%B8%8C%EC%9D%B4/id6747028185";
    const googlePlayLink = "https://play.google.com/store/apps/details?id=com.silverithm.carev.app";

    return (
        <main style={{
            minHeight: '100vh',
            backgroundImage: 'linear-gradient(to bottom, #0f172a, #1e3a8a, #312e81)',
            color: '#ffffff',
        }}>
            <Navbar/>

            {/* 히어로 섹션 */}
            <section style={{
                position: 'relative',
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                padding: '128px 16px 40px',
            }}>
                {/* 배경 장식 */}
                <div style={{position: 'absolute', inset: 0}}>
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundImage: 'linear-gradient(to right, rgba(37,99,235,0.2), rgba(79,70,229,0.2))',
                    }}></div>
                    <div style={{
                        position: 'absolute',
                        top: '25%',
                        left: '25%',
                        width: 288,
                        height: 288,
                        background: 'rgba(59,130,246,0.1)',
                        borderRadius: 9999,
                        filter: 'blur(64px)',
                    }}></div>
                    <div style={{
                        position: 'absolute',
                        bottom: '25%',
                        right: '25%',
                        width: 384,
                        height: 384,
                        background: 'rgba(99,102,241,0.1)',
                        borderRadius: 9999,
                        filter: 'blur(64px)',
                    }}></div>
                </div>

                <div style={{...containerStyle(16), textAlign: 'center', position: 'relative', zIndex: 10, marginBottom: 64}}>
                    <motion.div
                        initial={{opacity: 0, y: 30}}
                        animate={{opacity: 1, y: 0}}
                        transition={{duration: 0.8, ease: "easeOut"}}
                        style={{marginBottom: 24}}
                    >
            <span
                style={{
                    display: 'inline-block',
                    padding: '8px 16px',
                    background: 'rgba(59,130,246,0.2)',
                    backdropFilter: 'blur(4px)',
                    borderRadius: 9999,
                    color: '#bfdbfe',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    border: '1px solid rgba(96,165,250,0.3)',
                    marginBottom: 24,
                }}>
              🚀 스마트한 휴무 관리의 시작
            </span>
                    </motion.div>

                    <motion.h1
                        initial={{opacity: 0, y: 30}}
                        animate={{opacity: 1, y: 0}}
                        transition={{duration: 0.8, delay: 0.1, ease: "easeOut"}}
                        style={{
                            ...gradientText,
                            fontSize: 'clamp(3rem, 6vw, 4.5rem)',
                            fontWeight: 700,
                            marginBottom: 24,
                            lineHeight: 1.1,
                        }}
                    >
                        장기요양기관을 위한<br/>
                        <span style={{fontSize: 'clamp(2.25rem, 5vw, 3.75rem)'}}>스마트 근무 관리 솔루션</span>
                    </motion.h1>

                    <motion.p
                        initial={{opacity: 0, y: 30}}
                        animate={{opacity: 1, y: 0}}
                        transition={{duration: 0.8, delay: 0.2, ease: "easeOut"}}
                        style={{
                            fontSize: 'clamp(1.25rem, 3vw, 1.5rem)',
                            color: 'rgba(219,234,254,0.9)',
                            marginBottom: 48,
                            maxWidth: 768,
                            marginLeft: 'auto',
                            marginRight: 'auto',
                            lineHeight: 1.625,
                        }}
                    >
                        요양보호사, 사회복지사, 간호조무사 등 장기요양기관 전 직원의 휴무 관리를 혁신적으로 개선합니다.<br/>
                        주간보호센터, 요양원, 재가노인복지센터의 복잡한 일정 관리를 단순하게.
                    </motion.p>
                </div>

                {/* 사용자 유형 선택 섹션 */}
                <div style={{
                    ...containerStyle(0, 896),
                    position: 'relative',
                    zIndex: 10,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: 32,
                }}>
                    {/* 일반 사용자: 앱 다운로드 안내 */}
                    <motion.div
                        initial={{opacity: 0, scale: 0.9}}
                        animate={{opacity: 1, scale: 1}}
                        transition={{duration: 0.7, delay: 0.4, ease: "easeOut"}}
                        style={{
                            ...glassCard,
                            padding: 32,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                        }}
                    >
                        <div style={{
                            width: 80,
                            height: 80,
                            borderRadius: 16,
                            backgroundImage: 'linear-gradient(to bottom right, #60a5fa, #6366f1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: 24,
                            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
                        }}>
                            <svg xmlns="http://www.w3.org/2000/svg" style={{width: 40, height: 40, color: '#ffffff'}}
                                 fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round"
                                      d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                            </svg>
                        </div>
                        <h2 style={{fontSize: '1.875rem', fontWeight: 700, color: '#ffffff', marginBottom: 16}}>관리자 및 직원 전용 앱</h2>
                        <p style={{color: 'rgba(219,234,254,0.8)', marginBottom: 32, textAlign: 'center', lineHeight: 1.625}}>
                            요양보호사, 사회복지사, 간호조무사 등<br/>모든 직원이 휴무 신청을 편리하게 이용하세요.
                        </p>
                        <div style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 16,
                            width: '100%',
                            justifyContent: 'center',
                        }}>
                            <a
                                href={appStoreLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    display: 'flex',
                                    flex: '1 1 180px',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 12,
                                    padding: '12px 24px',
                                    borderRadius: 12,
                                    background: 'rgba(30,41,59,0.8)',
                                    backdropFilter: 'blur(4px)',
                                    color: '#ffffff',
                                    fontWeight: 600,
                                    textDecoration: 'none',
                                    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
                                    border: '1px solid rgba(96,165,250,0.2)',
                                }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" style={{width: 20, height: 20}} fill="currentColor"
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
                                style={{
                                    display: 'flex',
                                    flex: '1 1 180px',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 12,
                                    padding: '12px 24px',
                                    borderRadius: 12,
                                    background: 'rgba(37,99,235,0.8)',
                                    backdropFilter: 'blur(4px)',
                                    color: '#ffffff',
                                    fontWeight: 600,
                                    textDecoration: 'none',
                                    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
                                    border: '1px solid rgba(96,165,250,0.2)',
                                }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" style={{width: 20, height: 20}} fill="currentColor"
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
                        style={{
                            ...glassCard,
                            padding: 32,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                        }}
                    >
                        <div style={{
                            width: 80,
                            height: 80,
                            borderRadius: 16,
                            backgroundImage: 'linear-gradient(to bottom right, #818cf8, #a855f7)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: 24,
                            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
                        }}>
                            <svg xmlns="http://www.w3.org/2000/svg" style={{width: 40, height: 40, color: '#ffffff'}}
                                 fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round"
                                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                                <path strokeLinecap="round" strokeLinejoin="round"
                                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                            </svg>
                        </div>
                        <h2 style={{fontSize: '1.875rem', fontWeight: 700, color: '#ffffff', marginBottom: 16}}>관리자 페이지</h2>
                        <p style={{color: 'rgba(219,234,254,0.8)', marginBottom: 32, textAlign: 'center', lineHeight: 1.625}}>
                            장기요양기관 관리자를 위한 웹 기능을 제공합니다.<br/>요양보호사, 사회복지사 등 전 직원의 근무표와 휴무를 효율적으로 관리하세요.
                        </p>
                        <div style={{display: 'flex', flexDirection: 'column', gap: 12, width: '100%'}}>
                            <Button
                                label="관리자 로그인"
                                variant="primary"
                                size="lg"
                                onClick={(e) => handleGoToLogin(e, 'admin')}
                            />
                            <Button
                                label="직원 로그인"
                                variant="secondary"
                                size="lg"
                                onClick={(e) => handleGoToLogin(e, 'employee')}
                            />
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* 주요 기능 섹션 */}
            <section id="features" style={{padding: '80px 0', background: 'rgba(30,41,59,0.5)', backdropFilter: 'blur(4px)'}}>
                <div style={containerStyle(16)}>
                    <motion.h2
                        initial={{opacity: 0, y: 20}}
                        whileInView={{opacity: 1, y: 0}}
                        viewport={{once: true}}
                        transition={{duration: 0.6}}
                        style={sectionHeading}
                    >
                        효율적인 휴무 관리 기능
                    </motion.h2>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                        gap: 40,
                    }}>
                        {
                            [
                                {
                                    icon: <svg xmlns="http://www.w3.org/2000/svg" style={{width: 48, height: 48, color: '#60a5fa'}}
                                               fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                                    </svg>,
                                    title: "장기요양기관 맞춤 일정 관리",
                                    description: "요양보호사, 사회복지사, 간호조무사, 물리치료사 등 전 직원의 휴무 현황을 캘린더로 한눈에 파악하고 관리합니다."
                                },
                                {
                                    icon: <svg xmlns="http://www.w3.org/2000/svg" style={{width: 48, height: 48, color: '#60a5fa'}}
                                               fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 8h.01M12 12h.01M9 12h.01M12 9h.01M9 9h.01M15 9h.01M15 12h.01M15 15h.01M12 15h.01M9 15h.01"/>
                                    </svg>,
                                    title: "시설급여·재가급여 통합 관리",
                                    description: "주간보호센터, 요양원, 재가노인복지센터 등 모든 장기요양기관의 휴무 요청을 실시간으로 확인하고 승인 처리합니다."
                                },
                                {
                                    icon: <svg xmlns="http://www.w3.org/2000/svg" style={{width: 48, height: 48, color: '#60a5fa'}}
                                               fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                                    </svg>,
                                    title: "장기요양 인력 기준 충족",
                                    description: "요양보호사, 사회복지사 배치 기준 충족 여부를 실시간으로 확인하여 장기요양기관 평가에 완벽 대비합니다."
                                }
                            ].map((feature, index) => (
                                <motion.div
                                    key={index}
                                    initial={{opacity: 0, y: 20}}
                                    whileInView={{opacity: 1, y: 0}}
                                    viewport={{once: true}}
                                    transition={{duration: 0.5, delay: index * 0.1 + 0.2}}
                                    style={{
                                        ...glassCard,
                                        padding: 32,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        textAlign: 'center',
                                    }}
                                >
                                    <div style={{
                                        width: 96,
                                        height: 96,
                                        borderRadius: 16,
                                        backgroundImage: 'linear-gradient(to bottom right, rgba(59,130,246,0.2), rgba(99,102,241,0.2))',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        marginBottom: 24,
                                        border: '1px solid rgba(96,165,250,0.3)',
                                    }}>
                                        {feature.icon}
                                    </div>
                                    <h3 style={{fontSize: '1.5rem', fontWeight: 600, marginBottom: 16, color: '#ffffff'}}>{feature.title}</h3>
                                    <p style={{color: 'rgba(219,234,254,0.8)', lineHeight: 1.625}}>{feature.description}</p>
                                </motion.div>
                            ))
                        }
                    </div>
                </div>
            </section>

            {/* 콘텐츠 허브 섹션 */}
            <section style={{padding: '80px 0', background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)'}}>
                <div style={containerStyle(16)}>
                    <motion.div
                        initial={{opacity: 0, y: 20}}
                        whileInView={{opacity: 1, y: 0}}
                        transition={{duration: 0.6}}
                        viewport={{once: true}}
                        style={{textAlign: 'center', marginBottom: 48}}
                    >
                        <h2 style={{fontSize: '2.25rem', fontWeight: 700, marginBottom: 16}}>케어브이 더 알아보기</h2>
                        <p style={{fontSize: '1.25rem', color: 'rgba(219,234,254,0.8)'}}>최신 소식과 유용한 정보를 확인하세요</p>
                    </motion.div>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                        gap: 32,
                        maxWidth: 1152,
                        marginLeft: 'auto',
                        marginRight: 'auto',
                    }}>
                        {/* 블로그 카드 */}
                        <motion.a
                            href="/blog"
                            initial={{opacity: 0, y: 30}}
                            whileInView={{opacity: 1, y: 0}}
                            transition={{duration: 0.5, delay: 0.1}}
                            viewport={{once: true}}
                            style={{
                                backgroundImage: 'linear-gradient(to bottom right, rgba(37,99,235,0.2), rgba(79,70,229,0.2))',
                                backdropFilter: 'blur(16px)',
                                borderRadius: 16,
                                padding: 32,
                                border: '1px solid rgba(96,165,250,0.2)',
                                textDecoration: 'none',
                                display: 'block',
                            }}
                        >
                            <div style={{
                                width: 64,
                                height: 64,
                                background: 'rgba(59,130,246,0.2)',
                                borderRadius: 9999,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: 24,
                            }}>
                                <svg style={{width: 32, height: 32, color: '#93c5fd'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                                </svg>
                            </div>
                            <h3 style={{fontSize: '1.5rem', fontWeight: 700, marginBottom: 12, color: '#ffffff'}}>블로그</h3>
                            <p style={{color: 'rgba(219,234,254,0.7)', marginBottom: 16}}>케어브이의 새로운 기능과 업데이트, 근무표 관리 노하우를 확인하세요.</p>
                            <span style={{color: '#60a5fa', fontWeight: 500, display: 'inline-flex', alignItems: 'center'}}>
                                자세히 보기
                                <svg style={{width: 16, height: 16, marginLeft: 8}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </span>
                        </motion.a>

                        {/* FAQ 카드 */}
                        <motion.a
                            href="/faq"
                            initial={{opacity: 0, y: 30}}
                            whileInView={{opacity: 1, y: 0}}
                            transition={{duration: 0.5, delay: 0.2}}
                            viewport={{once: true}}
                            style={{
                                backgroundImage: 'linear-gradient(to bottom right, rgba(79,70,229,0.2), rgba(147,51,234,0.2))',
                                backdropFilter: 'blur(16px)',
                                borderRadius: 16,
                                padding: 32,
                                border: '1px solid rgba(129,140,248,0.2)',
                                textDecoration: 'none',
                                display: 'block',
                            }}
                        >
                            <div style={{
                                width: 64,
                                height: 64,
                                background: 'rgba(99,102,241,0.2)',
                                borderRadius: 9999,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: 24,
                            }}>
                                <svg style={{width: 32, height: 32, color: '#a5b4fc'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <h3 style={{fontSize: '1.5rem', fontWeight: 700, marginBottom: 12, color: '#ffffff'}}>자주 묻는 질문</h3>
                            <p style={{color: 'rgba(224,231,255,0.7)', marginBottom: 16}}>케어브이 사용에 대한 궁금증을 빠르게 해결하세요.</p>
                            <span style={{color: '#818cf8', fontWeight: 500, display: 'inline-flex', alignItems: 'center'}}>
                                자세히 보기
                                <svg style={{width: 16, height: 16, marginLeft: 8}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </span>
                        </motion.a>

                        {/* 가이드 카드 */}
                        <motion.a
                            href="/guide"
                            initial={{opacity: 0, y: 30}}
                            whileInView={{opacity: 1, y: 0}}
                            transition={{duration: 0.5, delay: 0.3}}
                            viewport={{once: true}}
                            style={{
                                backgroundImage: 'linear-gradient(to bottom right, rgba(147,51,234,0.2), rgba(219,39,119,0.2))',
                                backdropFilter: 'blur(16px)',
                                borderRadius: 16,
                                padding: 32,
                                border: '1px solid rgba(192,132,252,0.2)',
                                textDecoration: 'none',
                                display: 'block',
                            }}
                        >
                            <div style={{
                                width: 64,
                                height: 64,
                                background: 'rgba(168,85,247,0.2)',
                                borderRadius: 9999,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: 24,
                            }}>
                                <svg style={{width: 32, height: 32, color: '#d8b4fe'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                            </div>
                            <h3 style={{fontSize: '1.5rem', fontWeight: 700, marginBottom: 12, color: '#ffffff'}}>사용 가이드</h3>
                            <p style={{color: 'rgba(243,232,255,0.7)', marginBottom: 16}}>케어브이의 모든 기능을 단계별로 쉽게 배워보세요.</p>
                            <span style={{color: '#c084fc', fontWeight: 500, display: 'inline-flex', alignItems: 'center'}}>
                                자세히 보기
                                <svg style={{width: 16, height: 16, marginLeft: 8}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </span>
                        </motion.a>
                    </div>
                </div>
            </section>

            {/* 디자인 이미지 섹션 */}
            <section style={{padding: '80px 0', background: 'rgba(30,41,59,0.5)', backdropFilter: 'blur(4px)'}}>
                <div style={containerStyle(32, 1280)}>
                    {/* 이미지 그리드 */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                        gap: 16,
                    }}>
                        {designImages.map((image, index) => (
                            <motion.div
                                key={index}
                                initial={{opacity: 0, y: 20}}
                                whileInView={{opacity: 1, y: 0}}
                                viewport={{once: true}}
                                transition={{duration: 0.5, delay: index * 0.1}}
                                whileHover={{scale: 1.05}}
                                style={{
                                    aspectRatio: '9 / 16',
                                    position: 'relative',
                                    background: 'rgba(255,255,255,0.1)',
                                    backdropFilter: 'blur(16px)',
                                    borderRadius: 12,
                                    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                                    padding: 8,
                                    border: '1px solid rgba(96,165,250,0.2)',
                                    overflow: 'hidden',
                                }}
                            >
                                <Image
                                    src={image}
                                    alt={`케어브이 디자인 ${index + 1}`}
                                    fill
                                    style={{objectFit: 'contain'}}
                                    priority
                                />
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* 사용 방법 섹션 */}
            <section id="process" style={{padding: '80px 0', background: 'rgba(30,41,59,0.5)', backdropFilter: 'blur(4px)'}}>
                <div style={containerStyle(16)}>
                    <motion.h2
                        initial={{opacity: 0, y: 20}}
                        whileInView={{opacity: 1, y: 0}}
                        viewport={{once: true}}
                        transition={{duration: 0.6}}
                        style={sectionHeading}
                    >
                        케어브이 사용 방법
                    </motion.h2>

                    <div style={{maxWidth: 1024, marginLeft: 'auto', marginRight: 'auto'}}>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                            gap: 24,
                        }}>
                            {[
                                {
                                    step: "1",
                                    role: "[관리자]",
                                    title: "웹사이트 가입",
                                    description: "장기요양기관 시설장 또는 사무장이 먼저 기관 정보를 등록하며 가입을 완료합니다.",
                                    icon: (
                                        <svg xmlns="http://www.w3.org/2000/svg" style={{width: 32, height: 32}} fill="none"
                                             viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                                        </svg>
                                    ),
                                    color: "linear-gradient(to bottom right, #60a5fa, #6366f1)"
                                },
                                {
                                    step: "2",
                                    role: "[직원]",
                                    title: "앱 가입 요청",
                                    description: "요양보호사, 사회복지사 등 직원이 앱에서 소속 기관으로 회원가입을 요청합니다.",
                                    icon: (
                                        <svg xmlns="http://www.w3.org/2000/svg" style={{width: 32, height: 32}} fill="none"
                                             viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                  d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                                        </svg>
                                    ),
                                    color: "linear-gradient(to bottom right, #818cf8, #a855f7)"
                                },
                                {
                                    step: "3",
                                    role: "[관리자]",
                                    title: "가입 승인",
                                    description: "관리자는 요양보호사, 사회복지사 등 직원의 가입 요청을 확인하고 승인합니다.",
                                    icon: (
                                        <svg xmlns="http://www.w3.org/2000/svg" style={{width: 32, height: 32}} fill="none"
                                             viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                        </svg>
                                    ),
                                    color: "linear-gradient(to bottom right, #4ade80, #14b8a6)"
                                },
                                {
                                    step: "4",
                                    role: "[직원]",
                                    title: "앱 로그인",
                                    description: "승인 완료 후 요양보호사, 사회복지사 등 모든 직원이 앱에 로그인할 수 있습니다.",
                                    icon: (
                                        <svg xmlns="http://www.w3.org/2000/svg" style={{width: 32, height: 32}} fill="none"
                                             viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                  d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/>
                                        </svg>
                                    ),
                                    color: "linear-gradient(to bottom right, #c084fc, #ec4899)"
                                }
                            ].map((item, index) => (
                                <motion.div
                                    key={index}
                                    initial={{opacity: 0, y: 20}}
                                    whileInView={{opacity: 1, y: 0}}
                                    viewport={{once: true}}
                                    transition={{duration: 0.5, delay: index * 0.1}}
                                    style={{position: 'relative'}}
                                >
                                    {/* 연결선 (마지막 아이템 제외) */}
                                    {index < 3 && (
                                        <div
                                            className="carev-landing-step-connector"
                                            style={{
                                                position: 'absolute',
                                                top: '33%',
                                                right: -12,
                                                width: 24,
                                                height: 2,
                                                backgroundImage: 'linear-gradient(to right, rgba(96,165,250,0.5), rgba(129,140,248,0.5))',
                                            }}></div>
                                    )}

                                    <div style={{
                                        ...glassCard,
                                        padding: 24,
                                        height: '100%',
                                    }}>
                                        {/* 단계 번호 */}
                                        <div style={{
                                            width: 64,
                                            height: 64,
                                            borderRadius: 16,
                                            backgroundImage: item.color,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            marginBottom: 16,
                                            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
                                            marginLeft: 'auto',
                                            marginRight: 'auto',
                                        }}>
                                            <span style={{fontSize: '1.5rem', fontWeight: 700, color: '#ffffff'}}>{item.step}</span>
                                        </div>

                                        {/* 아이콘 */}
                                        <div style={{display: 'flex', justifyContent: 'center', marginBottom: 16, color: '#60a5fa'}}>
                                            {item.icon}
                                        </div>

                                        {/* 역할 */}
                                        <div style={{textAlign: 'center', marginBottom: 8}}>
                      <span style={{
                          fontSize: '0.875rem',
                          fontWeight: 500,
                          padding: '4px 12px',
                          borderRadius: 9999,
                          backgroundImage: item.color,
                          color: '#ffffff',
                      }}>
                        {item.role}
                      </span>
                                        </div>

                                        {/* 제목 */}
                                        <h3 style={{fontSize: '1.25rem', fontWeight: 600, color: '#ffffff', textAlign: 'center', marginBottom: 12}}>{item.title}</h3>

                                        {/* 설명 */}
                                        <p style={{color: 'rgba(219,234,254,0.8)', textAlign: 'center', fontSize: '0.875rem', lineHeight: 1.625}}>{item.description}</p>
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
                            style={{marginTop: 48, textAlign: 'center'}}
                        >
                            <p style={{color: 'rgba(219,234,254,0.8)', fontSize: '1.125rem'}}>
                                ✨ 간단한 4단계로 케어브이 서비스 이용을 시작하세요!
                            </p>
                        </motion.div>
                    </div>

                    {/* 사용 영상 서브섹션 */}
                    <div style={{marginTop: 40}}>
                        {/* 유튜브 영상 */}
                        <motion.div
                            initial={{opacity: 0, scale: 0.9}}
                            whileInView={{opacity: 1, scale: 1}}
                            viewport={{once: true}}
                            transition={{duration: 0.7}}
                            style={{maxWidth: 896, marginLeft: 'auto', marginRight: 'auto'}}
                        >
                            <div style={{
                                position: 'relative',
                                aspectRatio: '16 / 9',
                                background: 'rgba(255,255,255,0.1)',
                                backdropFilter: 'blur(16px)',
                                borderRadius: 16,
                                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                                overflow: 'hidden',
                                border: '1px solid rgba(96,165,250,0.2)',
                            }}>
                                <iframe
                                    style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}}
                                    src="https://www.youtube.com/embed/x2cJedS6vaU"
                                    title="케어브이 가입 및 승인 절차 안내"
                                    frameBorder="0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                    allowFullScreen
                                ></iframe>
                            </div>
                            <p style={{textAlign: 'center', color: 'rgba(219,234,254,0.8)', marginTop: 16, fontSize: '1.125rem'}}>
                                📹 케어브이 사용방법을 영상으로 확인해보세요
                            </p>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* 가격 정보 섹션 */}
            <section id="pricing" style={{padding: '80px 0', background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)'}}>
                <div style={containerStyle(16)}>
                    <motion.h2
                        initial={{opacity: 0, y: 20}}
                        whileInView={{opacity: 1, y: 0}}
                        viewport={{once: true}}
                        transition={{duration: 0.6}}
                        style={sectionHeading}
                    >
                        케어브이 가격 안내
                    </motion.h2>

                    <div style={{maxWidth: 896, marginLeft: 'auto', marginRight: 'auto'}}>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                            gap: 32,
                        }}>
                            {/* 무료 체험 카드 */}
                            <motion.div
                                initial={{opacity: 0, x: -20}}
                                whileInView={{opacity: 1, x: 0}}
                                viewport={{once: true}}
                                transition={{duration: 0.6, delay: 0.1}}
                                style={{...glassCard, padding: 32}}
                            >
                                <div style={{textAlign: 'center'}}>
                                    <div style={{
                                        width: 80,
                                        height: 80,
                                        marginLeft: 'auto',
                                        marginRight: 'auto',
                                        marginBottom: 24,
                                        borderRadius: 16,
                                        backgroundImage: 'linear-gradient(to bottom right, #4ade80, #10b981)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
                                    }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" style={{width: 40, height: 40, color: '#ffffff'}}
                                             fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round"
                                                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                        </svg>
                                    </div>
                                    <h3 style={{fontSize: '1.5rem', fontWeight: 700, color: '#ffffff', marginBottom: 8}}>30일 무료 체험</h3>
                                    <div style={{fontSize: '2.25rem', fontWeight: 700, color: '#4ade80', marginBottom: 16}}>무료</div>
                                    <p style={{color: 'rgba(219,234,254,0.8)', marginBottom: 24, lineHeight: 1.625}}>
                                        케어브이의 모든 기능을 30일간 무료로 체험해보세요
                                    </p>
                                    <ul style={{listStyle: 'none', padding: 0, margin: 0, textAlign: 'left', color: 'rgba(219,234,254,0.8)', fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: 12}}>
                                        <li style={{display: 'flex', alignItems: 'center'}}>
                                            <svg style={{width: 16, height: 16, color: '#4ade80', marginRight: 12, flexShrink: 0}}
                                                 fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd"
                                                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                      clipRule="evenodd"/>
                                            </svg>
                                            모든 휴가 관리 기능 이용
                                        </li>
                                        <li style={{display: 'flex', alignItems: 'center'}}>
                                            <svg style={{width: 16, height: 16, color: '#4ade80', marginRight: 12, flexShrink: 0}}
                                                 fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd"
                                                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                      clipRule="evenodd"/>
                                            </svg>
                                            직원 등록 및 관리
                                        </li>
                                        <li style={{display: 'flex', alignItems: 'center'}}>
                                            <svg style={{width: 16, height: 16, color: '#4ade80', marginRight: 12, flexShrink: 0}}
                                                 fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd"
                                                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                      clipRule="evenodd"/>
                                            </svg>
                                            실시간 알림 및 승인
                                        </li>
                                        <li style={{display: 'flex', alignItems: 'center'}}>
                                            <svg style={{width: 16, height: 16, color: '#4ade80', marginRight: 12, flexShrink: 0}}
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
                                style={{
                                    backgroundImage: 'linear-gradient(to bottom right, rgba(59,130,246,0.2), rgba(79,70,229,0.2))',
                                    backdropFilter: 'blur(16px)',
                                    borderRadius: 16,
                                    padding: 32,
                                    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                                    border: '2px solid rgba(96,165,250,0.3)',
                                    position: 'relative',
                                }}
                            >
                                <div style={{position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)'}}>
                  <span style={{
                      backgroundImage: 'linear-gradient(to right, #3b82f6, #6366f1)',
                      color: '#ffffff',
                      padding: '8px 16px',
                      borderRadius: 9999,
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      boxShadow: '0 10px 15px -3px rgba(0,0,0,0.2)',
                      whiteSpace: 'nowrap',
                  }}>
                    추천 플랜
                  </span>
                                </div>
                                <div style={{textAlign: 'center', marginTop: 16}}>
                                    <div style={{
                                        width: 80,
                                        height: 80,
                                        marginLeft: 'auto',
                                        marginRight: 'auto',
                                        marginBottom: 24,
                                        borderRadius: 16,
                                        backgroundImage: 'linear-gradient(to bottom right, #60a5fa, #6366f1)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
                                    }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" style={{width: 40, height: 40, color: '#ffffff'}}
                                             fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round"
                                                  d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>
                                        </svg>
                                    </div>
                                    <h3 style={{fontSize: '1.5rem', fontWeight: 700, color: '#ffffff', marginBottom: 8}}>Basic 플랜</h3>
                                    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16}}>
                                        <span style={{fontSize: '2.25rem', fontWeight: 700, color: '#93c5fd'}}>₩9,900</span>
                                        <span style={{color: 'rgba(191,219,254,0.7)', marginLeft: 8}}>/월</span>
                                    </div>
                                    <p style={{color: 'rgba(219,234,254,0.8)', marginBottom: 24, lineHeight: 1.625}}>
                                        무료 체험 이후 모든 기능을 계속 이용하세요
                                    </p>
                                    <ul style={{listStyle: 'none', padding: 0, margin: 0, textAlign: 'left', color: 'rgba(219,234,254,0.8)', fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: 12}}>
                                        <li style={{display: 'flex', alignItems: 'center'}}>
                                            <svg style={{width: 16, height: 16, color: '#60a5fa', marginRight: 12, flexShrink: 0}}
                                                 fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd"
                                                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                      clipRule="evenodd"/>
                                            </svg>
                                            모든 휴가 관리 기능
                                        </li>
                                        <li style={{display: 'flex', alignItems: 'center'}}>
                                            <svg style={{width: 16, height: 16, color: '#60a5fa', marginRight: 12, flexShrink: 0}}
                                                 fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd"
                                                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                      clipRule="evenodd"/>
                                            </svg>
                                            무제한 직원 등록
                                        </li>
                                        <li style={{display: 'flex', alignItems: 'center'}}>
                                            <svg style={{width: 16, height: 16, color: '#60a5fa', marginRight: 12, flexShrink: 0}}
                                                 fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd"
                                                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                      clipRule="evenodd"/>
                                            </svg>
                                            실시간 알림 기능
                                        </li>
                                        <li style={{display: 'flex', alignItems: 'center'}}>
                                            <svg style={{width: 16, height: 16, color: '#60a5fa', marginRight: 12, flexShrink: 0}}
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
                            style={{marginTop: 48, textAlign: 'center'}}
                        >
                            <div style={{
                                background: 'rgba(255,255,255,0.1)',
                                backdropFilter: 'blur(16px)',
                                borderRadius: 16,
                                padding: 24,
                                border: '1px solid rgba(96,165,250,0.2)',
                            }}>
                                <p style={{color: 'rgba(219,234,254,0.8)', fontSize: '0.875rem', lineHeight: 1.625}}>
                                    구독 서비스는 요금제에 따라 매월 또는 매년 자동 갱신되며, 별도의 해지 조치가 없는 한 정해진 구독 요금이 청구됩니다.
                                </p>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* CTA 섹션 */}
            <section style={{
                padding: '80px 0',
                backgroundImage: 'linear-gradient(to right, rgba(37,99,235,0.3), rgba(79,70,229,0.3))',
                backdropFilter: 'blur(4px)',
            }}>
                <div style={{...containerStyle(16), textAlign: 'center'}}>
                    <motion.h2
                        initial={{opacity: 0, y: 20}}
                        whileInView={{opacity: 1, y: 0}}
                        viewport={{once: true}}
                        transition={{duration: 0.7}}
                        style={{
                            ...gradientText,
                            fontSize: 'clamp(2.25rem, 5vw, 3rem)',
                            fontWeight: 700,
                            marginBottom: 24,
                            lineHeight: 1.1,
                        }}
                    >
                        지금 바로 케어브이를 시작하세요
                    </motion.h2>
                    <motion.p
                        initial={{opacity: 0, y: 20}}
                        whileInView={{opacity: 1, y: 0}}
                        viewport={{once: true}}
                        transition={{duration: 0.7, delay: 0.1}}
                        style={{
                            fontSize: '1.25rem',
                            color: 'rgba(219,234,254,0.9)',
                            marginBottom: 40,
                            maxWidth: 672,
                            marginLeft: 'auto',
                            marginRight: 'auto',
                            lineHeight: 1.625,
                        }}
                    >
                        복잡한 휴무 관리는 이제 그만! 케어브이 관리자 페이지에서<br/>모든 것을 스마트하게 해결하세요.
                    </motion.p>
                    <motion.div
                        initial={{opacity: 0, scale: 0.8}}
                        whileInView={{opacity: 1, scale: 1}}
                        viewport={{once: true}}
                        transition={{duration: 0.7, delay: 0.2}}
                        style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 16,
                        }}
                    >
                        <Button
                            label="관리자 로그인"
                            variant="primary"
                            size="lg"
                            onClick={(e) => handleGoToLogin(e, 'admin')}
                        />
                        <Button
                            label="직원 로그인"
                            variant="secondary"
                            size="lg"
                            onClick={(e) => handleGoToLogin(e, 'employee')}
                        />
                    </motion.div>
                </div>
            </section>

            {/* 푸터 */}
            <footer id="contact" style={{
                backgroundImage: 'linear-gradient(to right, #0f172a, #1e3a8a, #312e81)',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                borderTop: '1px solid rgba(30,64,175,0.3)',
                backdropFilter: 'blur(4px)',
            }}>
                <div style={{maxWidth: 1280, marginLeft: 'auto', marginRight: 'auto', padding: '32px 16px'}}>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                        gap: 32,
                        marginBottom: 24,
                    }}>
                        {/* 브랜드 섹션 */}
                        <div style={{textAlign: 'left', display: 'flex', flexDirection: 'column', height: '100%'}}>
                            <div style={{display: 'flex', justifyContent: 'flex-start', marginBottom: 16}}>
                                <Image
                                    src="/images/logo-text.png"
                                    alt="케어브이 로고"
                                    width={140}
                                    height={47}
                                />
                            </div>

                        </div>

                        {/* 회사 정보 섹션 */}
                        <div style={{textAlign: 'left', display: 'flex', flexDirection: 'column', height: '100%'}}>
                            <h3 style={{color: '#dbeafe', fontWeight: 600, fontSize: '1.125rem', marginBottom: 12}}>회사 정보</h3>
                            <div style={{display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.875rem', color: 'rgba(191,219,254,0.7)', flexGrow: 1}}>
                                <div style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 4}}>
                                    <p><span style={{color: '#93c5fd'}}>회사명:</span> silverithm</p>
                                    <p><span style={{color: '#93c5fd'}}>대표자:</span> 김준형</p>
                                </div>
                                <div style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 4}}>
                                    <p><span style={{color: '#93c5fd'}}>사업자등록번호:</span> 107-21-26475</p>
                                    <p><span style={{color: '#93c5fd'}}>주소:</span> 서울특별시 신림동 1547-10</p>
                                </div>
                            </div>
                        </div>

                        {/* 연락처 섹션 */}
                        <div style={{textAlign: 'left', display: 'flex', flexDirection: 'column', height: '100%'}}>
                            <h3 style={{color: '#dbeafe', fontWeight: 600, fontSize: '1.125rem', marginBottom: 12}}>연락처</h3>
                            <div style={{display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.875rem', color: 'rgba(191,219,254,0.7)', flexGrow: 1}}>
                                <div style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 4}}>
                                    <span style={{color: '#93c5fd'}}>이메일:</span>
                                    <a href="mailto:ggprgrkjh@naver.com" style={{color: 'rgba(191,219,254,0.7)', textDecoration: 'none'}}>
                                        ggprgrkjh@naver.com
                                    </a>
                                </div>
                                <div style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 4}}>
                                    <span style={{color: '#93c5fd'}}>전화번호:</span>
                                    <a href="tel:010-4549-2094" style={{color: 'rgba(191,219,254,0.7)', textDecoration: 'none'}}>
                                        010-4549-2094
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 저작권 및 링크 정보 */}
                    <div style={{borderTop: '1px solid rgba(96,165,250,0.2)', paddingTop: 24}}>
                        <div style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 16,
                        }}>
                            <p style={{color: 'rgba(191,219,254,0.6)', fontSize: '0.875rem'}}>
                                &copy; 2025 케어브이. 모든 권리 보유.
                            </p>
                            <div style={{display: 'flex', alignItems: 'center', gap: 16, fontSize: '0.875rem'}}>
                                <a
                                    href="https://plip.kr/pcc/d9017bf3-00dc-4f8f-b750-f7668e2b7bb7/privacy/1.html"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{color: 'rgba(147,197,253,0.8)', textDecoration: 'none'}}
                                >
                                    개인정보처리방침
                                </a>
                                <span style={{color: 'rgba(96,165,250,0.5)'}}>|</span>
                                <a
                                    href="https://relic-baboon-412.notion.site/silverithm-13c766a8bb468082b91ddbd2dd6ce45d"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{color: 'rgba(147,197,253,0.8)', textDecoration: 'none'}}
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
