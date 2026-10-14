'use client';

/**
 * 인쇄 전용 사본 — body 바로 아래(portal)에 그리고, 인쇄할 때 body의 다른 자식은 모두 숨긴다.
 * 관리자 화면의 스크롤 영역 안에서는 긴 문서가 잘려 나오기 때문이다. 화면에서는 보이지 않는다.
 */
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './labRecords.module.css';

export default function RecordsPrintPortal({ children, landscape = false }: { children: ReactNode; landscape?: boolean }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setHost(document.body);
  }, []);
  if (!host) return null;
  return createPortal(
    // 포털은 Astryx 테마 바깥에 놓이므로, 토큰이 닿도록 테마 속성을 직접 단다
    <div className={styles.printRoot} data-lab-print-root="" data-astryx-theme="neutral">
      <style>{`
        @page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 15mm; }
        @media print {
          body > *:not([data-lab-print-root]) { display: none !important; }
          html, body { background: var(--color-background-card) !important; height: auto !important; overflow: visible !important; }
        }
      `}</style>
      {children}
    </div>,
    host,
  );
}
