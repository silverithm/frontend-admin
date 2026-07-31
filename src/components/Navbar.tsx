'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { TopNav, TopNavHeading, TopNavItem } from '@astryxdesign/core/TopNav';
import { Button } from '@astryxdesign/core/Button';
import { HStack } from '@astryxdesign/core/Stack';
import { startDemo } from '@/lib/apiService';
import { useAlert } from '@/components/Alert';

const navLinks = [
  { href: '/#features', label: '주요 기능' },
  { href: '/#process', label: '사용 방법' },
  { href: '/#pricing', label: '가격' },
  { href: '/plaza', label: '광장' },
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
    setLoggedIn(hasToken);
    if (hasToken) {
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
            logo={
              <Image
                src="/images/logo.png"
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
          loggedIn ? (
            <Button label="내 케어브이" variant="primary" size="sm" onClick={() => router.push(workspacePath)} />
          ) : (
            <HStack gap={2} vAlign="center">
              <Button label="체험하기" variant="secondary" size="sm" isLoading={isDemoLoading} onClick={handleStartDemo} />
              <Button label="회원가입" variant="ghost" size="sm" onClick={() => router.push('/signup')} />
              <Button label="로그인" variant="primary" size="sm" onClick={() => router.push('/login')} />
            </HStack>
          )
        }
      />
      <AlertContainer />
    </div>
  );
};

export default Navbar;
