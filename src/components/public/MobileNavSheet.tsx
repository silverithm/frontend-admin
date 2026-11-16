'use client';

// 휴대폰 상단 메뉴 시트 — ☰ 를 누르면 상단 바 아래로 전체 폭으로 펼쳐진다.
// Esc·바깥 누르기로 닫히고, 열리면 첫 링크로 포커스가 간다. 닫힐 때 ☰ 로 포커스를 돌려준다.
// 데스크톱(768px~)에서는 CSS(.carev-nav-mobile-menu)로 숨겨진다.

import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { spring } from '@/theme/springs';

export interface MobileNavLink {
  href: string;
  label: string;
}

export default function MobileNavSheet({
  id,
  open,
  links,
  onClose,
  toggleRef,
  children,
}: {
  id: string;
  open: boolean;
  links: ReadonlyArray<MobileNavLink>;
  onClose: () => void;
  /** ☰ 단추 — 바깥 누르기 판정에서 제외하고, 닫힐 때 포커스를 돌려준다 */
  toggleRef: React.RefObject<HTMLButtonElement | null>;
  /** 링크 아래 줄(체험하기·회원가입 등) */
  children?: React.ReactNode;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        toggleRef.current?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (sheetRef.current?.contains(target) || toggleRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open, onClose, toggleRef]);

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          id={id}
          ref={sheetRef}
          className="carev-m-sheet carev-nav-mobile-menu"
          initial={reduce ? false : { height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { height: 0, opacity: 0 }}
          transition={reduce ? { duration: 0 } : spring.nav}
          onAnimationStart={() => {
            // 열리는 첫 프레임에 첫 링크로 포커스 (스크롤 점프 없이)
            sheetRef.current?.querySelector<HTMLElement>('a')?.focus({ preventScroll: true });
          }}
        >
          <nav aria-label="전체 메뉴">
            {links.map((link) => (
              <a key={link.href} href={link.href} className="carev-m-link" onClick={onClose}>
                {link.label}
              </a>
            ))}
            {children}
          </nav>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
