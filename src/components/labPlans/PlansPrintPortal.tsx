'use client';

/**
 * 인쇄본 공용 틀 — body 바로 아래(portal)에 그리고, 인쇄할 때는 다른 화면을 숨긴다. 화면에서는 보이지 않는다.
 * printKey가 올라갈 때마다 인쇄를 한 번 시작한다(포털이 그려진 다음 한 박자 뒤에 onReady).
 */
import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import styles from './labPlans.module.css';

interface Props {
  printKey: number;
  onReady: () => void;
  children: ReactNode;
}

export default function PlansPrintPortal({ printKey, onReady, children }: Props) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setHost(document.body);
  }, []);
  useEffect(() => {
    if (!host || printKey === 0) return undefined;
    const timer = setTimeout(onReady, 60);
    return () => clearTimeout(timer);
    // 인쇄는 printKey가 바뀔 때만 시작한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host, printKey]);
  if (!host || printKey === 0) return null;
  return createPortal(
    <div className={styles.printRoot} data-lab-print-root="" data-astryx-theme="neutral">
      <style>{`
        @page { size: A4 portrait; margin: 14mm; }
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
