'use client';

import { useState, useCallback } from 'react';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { Button } from '@astryxdesign/core/Button';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Icon } from '@astryxdesign/core/Icon';

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
  const iconName = type === 'danger' ? 'error' : type === 'warning' ? 'warning' : 'info';
  const iconColor = type === 'danger' ? 'error' : type === 'warning' ? 'warning' : 'accent';
  const confirmVariant = type === 'danger' ? 'destructive' : 'primary';

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      purpose="form"
      width={440}
    >
      <Layout
        header={
          <DialogHeader title={title} onOpenChange={(open) => { if (!open) onCancel(); }} />
        }
        content={
          <LayoutContent>
            <VStack gap={3} hAlign="center">
              <Icon icon={iconName} size="lg" color={iconColor} />
              <div style={{ whiteSpace: 'pre-line', textAlign: 'center' }}>
                <Text type="body" color="secondary">{message}</Text>
              </div>
            </VStack>
          </LayoutContent>
        }
        footer={
          <LayoutFooter hasDivider>
            <HStack gap={2} hAlign="end">
              <Button label={cancelText} variant="ghost" onClick={onCancel} />
              <Button label={confirmText} variant={confirmVariant} onClick={onConfirm} />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
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
