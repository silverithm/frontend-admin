'use client';

import NextLink from 'next/link';
import { Theme } from '@astryxdesign/core/theme';
import { LinkProvider } from '@astryxdesign/core/Link';
import { neutralTheme } from '@astryxdesign/theme-neutral/built';

/**
 * Astryx 디자인 시스템 루트 프로바이더.
 * 앱 전역에 Astryx 테마와 Next.js Link 연동을 제공한다.
 */
export function AstryxProvider({ children }: { children: React.ReactNode }) {
  return (
    <Theme theme={neutralTheme} mode="dark">
      <LinkProvider component={NextLink}>{children}</LinkProvider>
    </Theme>
  );
}
