'use client';

import NextLink from 'next/link';
import { MotionConfig } from 'framer-motion';
import { Theme } from '@astryxdesign/core/theme';
import { LinkProvider } from '@astryxdesign/core/Link';
import { neutralTheme } from '@/theme/carev/neutral';

/**
 * Astryx 디자인 시스템 루트 프로바이더.
 * 앱 전역에 Astryx 테마와 Next.js Link 연동을 제공한다.
 * MotionConfig reducedMotion="user" — OS의 '동작 줄이기' 설정을 존중한다(Astryx 모션 원칙).
 */
export function AstryxProvider({ children }: { children: React.ReactNode }) {
  return (
    <Theme theme={neutralTheme} mode="light">
      <MotionConfig reducedMotion="user">
        <LinkProvider component={NextLink}>{children}</LinkProvider>
      </MotionConfig>
    </Theme>
  );
}
