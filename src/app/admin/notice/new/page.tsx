'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { IconBell } from '@tabler/icons-react';
import { Card } from '@astryxdesign/core/Card';
import { Button } from '@astryxdesign/core/Button';
import { TextInput } from '@astryxdesign/core/TextInput';
import { TextArea } from '@astryxdesign/core/TextArea';
import { Selector } from '@astryxdesign/core/Selector';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { Icon } from '@astryxdesign/core/Icon';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { createNotice } from '@/lib/apiService';
import { NoticePriority } from '@/types/notice';
import { useAlert } from '@/components/Alert';

export default function NewNoticePage() {
  const router = useRouter();
  const { showAlert, AlertContainer } = useAlert();

  // 관리자만 접근 가능
  useEffect(() => {
    const loginType = localStorage.getItem('loginType');
    if (loginType !== 'admin') {
      router.replace('/employee');
    }
  }, [router]);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<NoticePriority>('NORMAL');
  const [isPinned, setIsPinned] = useState(false);
  const [sendPushNotification, setSendPushNotification] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 등록 핸들러
  const handleSubmit = async () => {
    if (!title.trim()) {
      showAlert({ type: 'warning', title: '입력 필요', message: '제목을 입력해주세요.' });
      return;
    }
    if (!content.trim()) {
      showAlert({ type: 'warning', title: '입력 필요', message: '내용을 입력해주세요.' });
      return;
    }

    setIsSubmitting(true);
    try {
      await createNotice({
        title: title.trim(),
        content: content.trim(),
        priority,
        isPinned,
        sendPushNotification,
      });

      showAlert({
        type: 'success',
        title: '등록 완료',
        message: sendPushNotification
          ? '공지사항이 등록되었습니다. 직원들에게 알림이 발송됩니다.'
          : '공지사항이 등록되었습니다.'
      });

      // 목록으로 돌아가기
      setTimeout(() => {
        router.push('/admin?tab=notice');
      }, 1000);
    } catch (error) {
      console.error('공지사항 등록 실패:', error);
      showAlert({ type: 'error', title: '등록 실패', message: '공지사항 등록에 실패했습니다.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <AlertContainer />
      <div style={{ minHeight: '100vh', background: 'var(--color-background-muted)' }}>
        {/* 헤더 */}
        <div
          style={{
            background: 'var(--color-background-card)',
            borderBottom: '1px solid var(--color-border)',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <div
            style={{
              maxWidth: 896,
              margin: '0 auto',
              padding: '16px 24px',
            }}
          >
            <HStack hAlign="between" vAlign="center" gap={4}>
              <HStack gap={2} vAlign="center">
                <Button
                  label="뒤로 가기"
                  variant="ghost"
                  size="sm"
                  isIconOnly
                  icon={<Icon icon="chevronLeft" size="md" />}
                  onClick={() => router.back()}
                />
                <Text type="large" weight="bold">새 공지사항 작성</Text>
              </HStack>
              <Button
                label="등록하기"
                variant="primary"
                size="md"
                icon={<Icon icon="check" size="sm" />}
                isLoading={isSubmitting}
                isDisabled={isSubmitting}
                onClick={handleSubmit}
              />
            </HStack>
          </div>
        </div>

        {/* 본문 */}
        <div
          style={{
            maxWidth: 896,
            margin: '0 auto',
            padding: '32px 24px',
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <VStack gap={6}>
              {/* 기본 정보 */}
              <Card padding={6}>
                <VStack gap={4}>
                  <Text type="large" weight="semibold">기본 정보</Text>

                  {/* 제목 */}
                  <TextInput
                    label="제목"
                    type="text"
                    value={title}
                    onChange={(value) => setTitle(value)}
                    placeholder="공지사항 제목을 입력하세요"
                    isRequired
                  />

                  {/* 내용 */}
                  <TextArea
                    label="내용"
                    value={content}
                    onChange={(value) => setContent(value)}
                    placeholder="공지사항 내용을 입력하세요"
                    rows={12}
                    isRequired
                  />

                  {/* 우선순위 & 상단고정 */}
                  <HStack gap={4} vAlign="end">
                    <div style={{ flex: 1 }}>
                      <Selector
                        label="우선순위"
                        options={[
                          { value: 'HIGH', label: '긴급' },
                          { value: 'NORMAL', label: '일반' },
                          { value: 'LOW', label: '낮음' },
                        ]}
                        value={priority}
                        onChange={(value) => setPriority(value as NoticePriority)}
                      />
                    </div>
                    <div style={{ flex: 1, paddingBottom: 8 }}>
                      <CheckboxInput
                        label="상단 고정"
                        value={isPinned}
                        onChange={(checked) => setIsPinned(checked)}
                      />
                    </div>
                  </HStack>
                </VStack>
              </Card>

              {/* 알림 설정 */}
              <Card variant="blue" padding={6}>
                <CheckboxInput
                  label="직원들에게 푸시 알림 발송"
                  description="등록 시 모든 직원에게 알림이 발송됩니다."
                  labelIcon={IconBell}
                  value={sendPushNotification}
                  onChange={(checked) => setSendPushNotification(checked)}
                />
              </Card>
            </VStack>
          </motion.div>
        </div>
      </div>
    </>
  );
}
