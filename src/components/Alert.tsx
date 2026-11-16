'use client';

import { useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Banner } from '@astryxdesign/core/Banner';
import { duration as motionDuration } from '@/theme/motion';
import { toast } from 'sonner';
import { raiseToaster } from '@/components/CarevToaster';

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
        padding: '0 var(--spacing-4)',
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
            transition={{ duration: motionDuration.mediumMin, ease: 'easeOut' }}
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
/**
 * 앱 알림 — sonner(CarevToaster)로 띄운다(2026-11-16). 부르는 쪽(showAlert·AlertContainer)은 그대로 둔다.
 *
 * 예전에는 새 알림이 앞 알림을 지워 한 번에 하나만 떴다. 이제 최대 3개까지 쌓이고(마우스를 올리면 펼침),
 * 밀어서 닫을 수 있다. AlertContainer는 화면마다 그려 두던 자리라 이제 아무것도 그리지 않는다 —
 * 알림은 앱 전체에 하나 있는 CarevToaster에 뜬다.
 */
export function useAlert() {
  const showAlert = useCallback((config: AlertConfig) => {
    raiseToaster();
    const show = config.type === 'success' ? toast.success
      : config.type === 'error' ? toast.error
      : config.type === 'warning' ? toast.warning
      : toast.info;
    const id = show(config.title || config.message, {
      description: config.title ? config.message : undefined,
      duration: config.duration ?? 5000,
      onDismiss: config.onClose ? () => config.onClose?.() : undefined,
      onAutoClose: config.onClose ? () => config.onClose?.() : undefined,
    });
    return String(id);
  }, []);

  const hideAlert = useCallback((id: string) => {
    toast.dismiss(id);
  }, []);

  // 화면마다 그리던 자리 — 이제 비어 있다(알림은 CarevToaster 하나에 뜬다). 타입은 고정해 둔다.
  const AlertContainer = useCallback(() => null, []);

  return { showAlert, hideAlert, AlertContainer };
}
