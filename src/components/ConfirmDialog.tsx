'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface ConfirmConfig {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'info' | 'warning' | 'danger';
}

interface ConfirmDialogProps extends ConfirmConfig {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title = '확인',
  message,
  confirmText = '확인',
  cancelText = '취소',
  type = 'info',
  isOpen,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const getStyles = () => {
    switch (type) {
      case 'danger':
        return {
          iconBg: 'bg-red-100',
          iconColor: 'text-red-600',
          confirmBg: 'bg-red-500 hover:bg-red-600',
          iconPath: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
        };
      case 'warning':
        return {
          iconBg: 'bg-amber-100',
          iconColor: 'text-amber-600',
          confirmBg: 'bg-amber-500 hover:bg-amber-600',
          iconPath: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
        };
      default:
        return {
          iconBg: 'bg-teal-100',
          iconColor: 'text-teal-600',
          confirmBg: 'bg-teal-500 hover:bg-teal-600',
          iconPath: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
        };
    }
  };

  const styles = getStyles();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={onCancel}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 400 }}
            className="bg-white rounded-2xl max-w-md w-full mx-4 shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 text-center">
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full ${styles.iconBg} mb-4`}>
                <svg
                  className={`w-6 h-6 ${styles.iconColor}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={styles.iconPath}
                  />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
              <p className="text-sm text-gray-500 whitespace-pre-line">{message}</p>
            </div>
            <div className="bg-gray-50 border-t border-gray-100 px-6 py-3 flex justify-end gap-2">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onCancel}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
              >
                {cancelText}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onConfirm}
                className={`px-4 py-2 text-white font-medium rounded-lg transition-colors ${styles.confirmBg}`}
              >
                {confirmText}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Hook for managing confirm dialogs
export function useConfirm() {
  const [state, setState] = useState<{
    isOpen: boolean;
    config: ConfirmConfig;
    resolve: ((value: boolean) => void) | null;
  }>({
    isOpen: false,
    config: { message: '' },
    resolve: null,
  });

  const confirm = useCallback((config: ConfirmConfig): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        isOpen: true,
        config,
        resolve,
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    state.resolve?.(true);
    setState((prev) => ({ ...prev, isOpen: false, resolve: null }));
  }, [state.resolve]);

  const handleCancel = useCallback(() => {
    state.resolve?.(false);
    setState((prev) => ({ ...prev, isOpen: false, resolve: null }));
  }, [state.resolve]);

  const ConfirmContainer = useCallback(
    () => (
      <ConfirmDialog
        {...state.config}
        isOpen={state.isOpen}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    ),
    [state.isOpen, state.config, handleConfirm, handleCancel]
  );

  return { confirm, ConfirmContainer };
}
