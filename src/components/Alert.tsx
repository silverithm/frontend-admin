'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Banner } from '@astryxdesign/core/Banner';

// Astryx Dialog는 네이티브 <dialog> top layer를 사용하므로 z-index로는 알림을
// 다이얼로그 위에 올릴 수 없다. Popover API로 알림도 top layer에 올린다
// (나중에 열린 top layer 요소가 위에 그려짐).
function TopLayerPopover({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current as (HTMLDivElement & { showPopover?: () => void; hidePopover?: () => void }) | null;
    if (!el || typeof el.showPopover !== 'function') return;
    try {
      el.showPopover();
    } catch {
      /* 이미 열려있는 등의 경우 무시 */
    }
    return () => {
      try {
        el.hidePopover?.();
      } catch {
        /* noop */
      }
    };
  }, []);

  return (
    <div
      ref={ref}
      popover="manual"
      style={{
        // popover UA 기본 스타일(가운데 정렬, 테두리, 배경) 재정의
        position: 'fixed',
        inset: 'auto',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        margin: 0,
        border: 0,
        padding: '0 16px',
        background: 'transparent',
        overflow: 'visible',
        width: '100%',
        maxWidth: 448,
        zIndex: 10000,
      }}
    >
      {children}
    </div>
  );
}

export interface AlertConfig {
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  duration?: number;
  onClose?: () => void;
}

interface AlertProps extends AlertConfig {
  isVisible: boolean;
  onClose: () => void;
}

export function Alert({ type, title, message, duration = 5000, isVisible, onClose }: AlertProps) {
  useEffect(() => {
    if (isVisible && duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  return (
    <AnimatePresence>
      {isVisible && (
        <TopLayerPopover>
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.95 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            <Banner
              status={type}
              title={title ?? message}
              description={title ? message : undefined}
              isDismissable
              onDismiss={onClose}
            />
          </motion.div>
        </TopLayerPopover>
      )}
    </AnimatePresence>
  );
}

// Hook for managing alerts
export function useAlert() {
  const [alerts, setAlerts] = useState<(AlertConfig & { id: string; isVisible: boolean })[]>([]);

  const showAlert = (config: AlertConfig) => {
    const id = Math.random().toString(36).substr(2, 9);
    const alert = { ...config, id, isVisible: true };

    // 기존 알림 모두 닫고 새 알림만 표시 (팝업 중첩 방지)
    setAlerts(prev => {
      prev.forEach(a => {
        if (a.isVisible) {
          setTimeout(() => {
            setAlerts(p => p.filter(x => x.id !== a.id));
          }, 300);
        }
      });
      return [...prev.map(a => ({ ...a, isVisible: false })), alert];
    });

    return id;
  };

  const hideAlert = useCallback((id: string) => {
    setAlerts(prev => prev.map(alert =>
      alert.id === id ? { ...alert, isVisible: false } : alert
    ));

    // Remove from array after animation completes
    setTimeout(() => {
      setAlerts(prev => prev.filter(alert => alert.id !== id));
    }, 300);
  }, []);

  // 컴포넌트 타입을 렌더링마다 새로 만들면 부모가 리렌더링될 때마다
  // 알림이 언마운트→리마운트되며 등장 애니메이션이 무한 반복된다.
  // useCallback으로 alerts가 바뀔 때만 타입이 갱신되게 고정한다.
  const AlertContainer = useCallback(() => (
    <>
      {alerts.map(alert => (
        <Alert
          key={alert.id}
          type={alert.type}
          title={alert.title}
          message={alert.message}
          duration={alert.duration}
          isVisible={alert.isVisible}
          onClose={() => {
            hideAlert(alert.id);
            alert.onClose?.();
          }}
        />
      ))}
    </>
  ), [alerts, hideAlert]);

  return { showAlert, hideAlert, AlertContainer };
}