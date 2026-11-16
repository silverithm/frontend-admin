'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { TopNav, TopNavHeading, TopNavItem } from '@astryxdesign/core/TopNav';
import { Button } from '@astryxdesign/core/Button';
import { HStack } from '@astryxdesign/core/Stack';
import { startDemo } from '@/lib/apiService';
import { useAlert } from '@/components/Alert';
import MobileNavSheet from '@/components/public/MobileNavSheet';
import '@/styles/public.css';

const navLinks = [
  { href: '/#features', label: '주요 기능' },
  { href: '/#process', label: '사용 방법' },
  { href: '/#pricing', label: '가격' },
  { href: '/plaza', label: '커뮤니티' },
  { href: '/partners', label: '제휴·광고' },
  { href: '/contact', label: '문의하기' },
];

/**
 * 공개 페이지 공통 상단 네비게이션.
 * Astryx TopNav 기반. 앵커 링크는 데스크톱에서만 노출하고(carev-nav-desktop),
 * 모바일에서는 CTA만 남긴다.
 */
const Navbar: React.FC = () => {
  const router = useRouter();
  const { showAlert, AlertContainer } = useAlert();
  // 로그인 상태 반영 — SSR/첫 렌더에서는 비로그인으로 두고 마운트 후 확인 (하이드레이션 안전)
  const [loggedIn, setLoggedIn] = useState(false);
  const [workspacePath, setWorkspacePath] = useState('/admin');
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  // 휴대폰 메뉴 시트
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const handleStartDemo = async () => {
    setIsDemoLoading(true);
    try {
      // 이미 체험 중인 세션이면 재시작 없이 이어서 진입
      if (localStorage.getItem('isDemoMode') === 'true' && localStorage.getItem('authToken')) {
        router.push('/admin');
        return;
      }
      await startDemo();
      router.push('/admin');
    } catch (error: unknown) {
      if ((error as { status?: number })?.status === 429) {
        showAlert({
          type: 'warning',
          title: '체험 요청이 많습니다',
          message: '체험 요청이 많습니다. 잠시 후 다시 시도해주세요.',
        });
      } else {
        showAlert({
          type: 'error',
          title: '체험 시작 실패',
          message: '일시적인 오류입니다. 잠시 후 다시 시도하거나 정식 회원가입을 이용해주세요.',
        });
      }
    } finally {
      setIsDemoLoading(false);
    }
  };

  useEffect(() => {
    const hasToken = !!localStorage.getItem('authToken');
    // 체험판도 authToken을 남기지만 "내 계정"이 아니다. 체험 세션을 로그인으로 보면
    // 체험을 한 번 눌렀다 나온 방문자에게 계속 "내 케어브이"만 보여 가입·로그인 길이 막힌다.
    const isDemo = localStorage.getItem('isDemoMode') === 'true';
    setLoggedIn(hasToken && !isDemo);
    if (hasToken && !isDemo) {
      setWorkspacePath(localStorage.getItem('loginType') === 'employee' ? '/employee' : '/admin');
    }
  }, []);

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'var(--color-background-surface)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <TopNav
        label="주 메뉴"
        heading={
          <TopNavHeading
            heading="케어브이"
            headingHref="/"
            // 로그인 화면과 같은 풀컬러 마크 — logo.png는 둘레 여백이 커서 28px로 두면 10px짜리 잎처럼 보여, 여백을 잘라낸 logo-mark.png를 쓴다
            logo={
              <Image
                src="/images/logo-mark.png"
                alt=""
                width={28}
                height={28}
                priority
              />
            }
          />
        }
        startContent={
          <span className="carev-nav-desktop" style={{ gap: 'var(--spacing-1)' }}>
            {navLinks.map((link) => (
              <TopNavItem key={link.href} label={link.label} href={link.href} />
            ))}
          </span>
        }
        endContent={
          <HStack gap={2} vAlign="center" className="carev-nav-end">
            {loggedIn ? (
              <Button label="내 케어브이" variant="primary" size="sm" href={workspacePath} />
            ) : (
              <>
                {/* 체험하기·회원가입은 데스크톱 상단에만 — 휴대폰에서는 메뉴 시트 안에 있다 */}
                <span className="carev-nav-desktop" style={{ gap: 'var(--spacing-2)', alignItems: 'center' }}>
                  <Button label="체험하기" variant="secondary" size="sm" isLoading={isDemoLoading} onClick={handleStartDemo} />
                  <Button label="회원가입" variant="ghost" size="sm" href="/signup" />
                </span>
                <Button label="로그인" variant="primary" size="sm" href="/login" />
              </>
            )}
            <button
              ref={toggleRef}
              type="button"
              className="carev-m-toggle carev-nav-mobile-toggle"
              aria-label={menuOpen ? '메뉴 닫기' : '메뉴 열기'}
              aria-expanded={menuOpen}
              aria-controls="carev-mobile-menu"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
              </svg>
            </button>
          </HStack>
        }
      />
      <MobileNavSheet id="carev-mobile-menu" open={menuOpen} links={navLinks} onClose={closeMenu} toggleRef={toggleRef}>
        {!loggedIn && (
          <div className="carev-m-actions">
            <Button
              label="체험하기"
              variant="secondary"
              isLoading={isDemoLoading}
              onClick={() => {
                closeMenu();
                handleStartDemo();
              }}
            />
            <Button label="회원가입" variant="ghost" href="/signup" onClick={closeMenu} />
          </div>
        )}
      </MobileNavSheet>
      <AlertContainer />
    </div>
  );
};

export default Navbar;
