import React from 'react';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { Button } from '@astryxdesign/core/Button';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Icon } from '@astryxdesign/core/Icon';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  message: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, onConfirm, message }) => {
  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      purpose="form"
      width={440}
    >
      <Layout
        header={
          <DialogHeader title="알림" onOpenChange={(open) => { if (!open) onClose(); }} />
        }
        content={
          <LayoutContent>
            <VStack gap={3} hAlign="center">
              <Icon icon="info" size="lg" color="accent" />
              <div style={{ whiteSpace: 'pre-line', textAlign: 'center' }}>
                <Text type="body" color="secondary">{message}</Text>
              </div>
            </VStack>
          </LayoutContent>
        }
        footer={
          <LayoutFooter hasDivider>
            <HStack gap={2} hAlign="end">
              <Button label="아니오" variant="ghost" onClick={onClose} />
              <Button label="예" variant="primary" onClick={onConfirm} />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  );
};

export default Modal;
