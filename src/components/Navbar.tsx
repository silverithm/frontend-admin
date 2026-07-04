'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMenu, FiX } from 'react-icons/fi';
import { Button } from '@astryxdesign/core/Button';
import { Icon } from '@astryxdesign/core/Icon';

const navLinkStyle: React.CSSProperties = {
  color: '#c3fae8',
  fontWeight: 'var(--font-weight-medium)',
  textDecoration: 'none',
  transition: 'color 200ms ease',
};

const Navbar: React.FC = () => {
  const router = useRouter();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { href: '#features', label: '주요 기능' },
    { href: '#process', label: '사용 방법' },
    { href: '#pricing', label: '가격' },
    { href: '#contact', label: '문의하기' },
  ];

  return (
    <nav
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        transition: 'all 300ms ease',
        background: isScrolled ? 'rgba(15, 23, 42, 0.95)' : 'transparent',
        backdropFilter: isScrolled ? 'blur(12px)' : undefined,
        boxShadow: isScrolled ? '0 4px 24px rgba(0,0,0,0.2)' : undefined,
        borderBottom: isScrolled ? '1px solid rgba(15, 118, 110, 0.3)' : undefined,
      }}
    >
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          {/* 로고 */}
          <Link href="/" style={{ display: 'flex', alignItems: 'center' }}>
            <Image
              src="/images/logo-text.png"
              alt="케어브이 로고"
              width={120}
              height={40}
            />
          </Link>

          {/* 데스크톱 네비게이션 */}
          <div className="carev-nav-desktop" style={{ alignItems: 'center', gap: 'var(--spacing-8)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-6)' }}>
              {navLinks.map((link) => (
                <a key={link.href} href={link.href} style={navLinkStyle}>
                  {link.label}
                </a>
              ))}
            </div>

            {/* CTA 버튼들 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)' }}>
              <Button label="회원가입" variant="ghost" onClick={() => router.push('/signup')} />
              <Button label="로그인" variant="primary" onClick={() => router.push('/login')} />
            </div>
          </div>

          {/* 모바일 메뉴 버튼 */}
          <button
            className="carev-nav-mobile-toggle"
            aria-label="메뉴 열기"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c3fae8' }}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <Icon icon={isMobileMenuOpen ? FiX : FiMenu} size="lg" />
          </button>
        </div>
      </div>

      {/* 모바일 메뉴 */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            className="carev-nav-mobile-menu"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            style={{
              overflow: 'hidden',
              background: 'rgba(15, 23, 42, 0.95)',
              backdropFilter: 'blur(12px)',
              borderBottom: '1px solid rgba(15, 118, 110, 0.3)',
            }}
          >
            <div style={{ padding: 'var(--spacing-4)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  style={{ ...navLinkStyle, display: 'block', padding: '8px 0' }}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              <div style={{ paddingTop: 'var(--spacing-4)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)', borderTop: '1px solid rgba(15, 118, 110, 0.3)' }}>
                <Button
                  label="회원가입"
                  variant="ghost"
                  onClick={() => {
                    router.push('/signup');
                    setIsMobileMenuOpen(false);
                  }}
                />
                <Button
                  label="로그인"
                  variant="primary"
                  onClick={() => {
                    router.push('/login');
                    setIsMobileMenuOpen(false);
                  }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
