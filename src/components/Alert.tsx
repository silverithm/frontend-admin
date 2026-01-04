'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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

  const getAlertStyles = () => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-green-500/10 border-green-400/30',
          icon: 'text-green-600',
          title: 'text-green-900',
          message: 'text-green-800',
          iconPath: "M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
        };
      case 'error':
        return {
          bg: 'bg-red-500/10 border-red-400/30',
          icon: 'text-red-600',
          title: 'text-red-900',
          message: 'text-red-800',
          iconPath: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L4.316 16.5c-.77.833.192 2.5 1.732 2.5z"
        };
      case 'warning':
        return {
          bg: 'bg-yellow-500/10 border-yellow-400/30',
          icon: 'text-yellow-600',
          title: 'text-yellow-900',
          message: 'text-yellow-800',
          iconPath: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L4.316 16.5c-.77.833.192 2.5 1.732 2.5z"
        };
      case 'info':
        return {
          bg: 'bg-blue-500/10 border-blue-400/30',
          icon: 'text-blue-600',
          title: 'text-blue-900',
          message: 'text-blue-800',
          iconPath: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        };
    }
  };

  const styles = getAlertStyles();

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -50, scale: 0.95 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-[100] max-w-md w-full mx-4 p-4 rounded-lg border backdrop-blur-sm shadow-lg ${styles.bg}`}
        >
          <div className="flex items-start">
            <div className={`flex-shrink-0 ${styles.icon} mr-3`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={styles.iconPath} />
              </svg>
            </div>
            
            <div className="flex-1 min-w-0">
              {title && (
                <h3 className={`text-sm font-medium ${styles.title} mb-1`}>
                  {title}
                </h3>
              )}
              <p className={`text-sm ${styles.message}`}>
                {message}
              </p>
            </div>
            
            <button
              onClick={onClose}
              className={`flex-shrink-0 ml-3 ${styles.icon} hover:opacity-70 transition-opacity`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
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
    
    setAlerts(prev => [...prev, alert]);
    
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