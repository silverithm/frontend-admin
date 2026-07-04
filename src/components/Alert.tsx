'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Banner } from '@astryxdesign/core/Banner';

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
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -50, scale: 0.95 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          style={{
            position: 'fixed',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100,
            width: '100%',
            maxWidth: 448,
            padding: '0 16px',
          }}
        >
          <Banner
            status={type}
            title={title ?? message}
            description={title ? message : undefined}
            isDismissable
            onDismiss={onClose}
          />
        </motion.div>
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

  const hideAlert = (id: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === id ? { ...alert, isVisible: false } : alert
    ));
    
    // Remove from array after animation completes
    setTimeout(() => {
      setAlerts(prev => prev.filter(alert => alert.id !== id));
    }, 300);
  };

  const AlertContainer = () => (
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
  );

  return { showAlert, hideAlert, AlertContainer };
}