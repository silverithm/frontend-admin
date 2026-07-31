'use client';

import React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { TopNav, TopNavHeading, TopNavItem } from '@astryxdesign/core/TopNav';
import { Button } from '@astryxdesign/core/Button';
import { HStack } from '@astryxdesign/core/Stack';

const navLinks = [
  { href: '/#features', label: '주요 기능' },
  { href: '/#process', label: '사용 방법' },
  { href: '/#pricing', label: '가격' },
  { href: '/contact', label: '문의하기' },
];

/**
 * 공개 페이지 공통 상단 네비게이션.
 * Astryx TopNav 기반. 앵커 링크는 데스크톱에서만 노출하고(carev-nav-desktop),
 * 모바일에서는 CTA만 남긴다.
 */
const Navbar: React.FC = () => {
  const router = useRouter();

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
          <HStack gap={2} vAlign="center">
            <Button label="회원가입" variant="ghost" size="sm" onClick={() => router.push('/signup')} />
            <Button label="로그인" variant="primary" size="sm" onClick={() => router.push('/login')} />
          </HStack>
        }
      />
    </div>
  );
};

export default Navbar;
