'use client';

import { motion } from 'framer-motion';
import { Dialog } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { Button } from '@astryxdesign/core/Button';
import { Text } from '@astryxdesign/core/Text';
import { Heading } from '@astryxdesign/core/Heading';
import { Icon } from '@astryxdesign/core/Icon';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Center } from '@astryxdesign/core/Center';
import { duration, easeStandard } from '@/theme/motion';

interface InquirySubmittedDialogProps {
  isOpen: boolean;
  /** "문의가 접수되었습니다" 등 */
  title: string;
  description: string;
  /** 다시 작성하기 — 폼으로 되돌아간다 */
  onWriteAgain: () => void;
}

/**
 * 문의 접수 완료 알림.
 *
 * 폼 자리를 배너로 바꾸는 방식은 화면이 조용히 교체돼 접수됐다는 느낌이 약했다.
 * 화면 위에 모달로 띄우고, 체크 표시가 그려지는 동작으로 완료를 분명히 알린다.
 */
export default function InquirySubmittedDialog({
  isOpen,
  title,
  description,
  onWriteAgain,
}: InquirySubmittedDialogProps) {
  return (
    <Dialog isOpen={isOpen} onOpenChange={(open) => { if (!open) onWriteAgain(); }} purpose="info" width={400}>
      <Layout
        // 기본값 fill이면 작은 알림이 다이얼로그 높이만큼 늘어난다
        height="auto"
        content={
          <LayoutContent>
            <Center axis="both" width="100%">
              <VStack gap={4} hAlign="center">
                {/* 원이 퍼지고 체크가 튀어 오른다 */}
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: duration.mediumMax, ease: easeStandard }}
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--color-background-teal)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <motion.div
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: duration.fast, duration: duration.medium, ease: easeStandard }}
                    style={{ display: 'flex', color: 'var(--color-text-teal)' }}
                  >
                    <Icon icon="check" size="lg" color="inherit" />
                  </motion.div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: duration.fastMax, duration: duration.medium, ease: easeStandard }}
                >
                  <VStack gap={2} hAlign="center">
                    <Heading level={2} type="display-3" justify="center" textWrap="balance">
                      {title}
                    </Heading>
                    <Text type="body" color="secondary" justify="center" textWrap="balance">
                      {description}
                    </Text>
                  </VStack>
                </motion.div>
              </VStack>
            </Center>
          </LayoutContent>
        }
        footer={
          <LayoutFooter hasDivider>
            <HStack gap={2} hAlign="center" wrap="wrap">
              <Button label="다시 작성하기" variant="secondary" onClick={onWriteAgain} />
              <Button label="홈으로" variant="primary" href="/" />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  );
}
