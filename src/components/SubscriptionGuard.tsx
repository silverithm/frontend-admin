'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { SubscriptionResponseDTO } from '@/types/subscription';
import { subscriptionService } from '@/services/subscription';
import { useAlert } from './Alert';
import { Agentation } from 'agentation';
import { Spinner } from '@astryxdesign/core/Spinner';
import { Card } from '@astryxdesign/core/Card';
import { Button } from '@astryxdesign/core/Button';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/Stack';
import { Icon } from '@astryxdesign/core/Icon';

interface SubscriptionGuardProps {
  children: React.ReactNode;
}

// 구독 확인이 필요한 페이지들 (admin 경로만)
const PROTECTED_PATHS = [
  '/admin'
];

export default function SubscriptionGuard({ children }: SubscriptionGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { showAlert, AlertContainer } = useAlert();
  const [subscription, setSubscription] = useState<SubscriptionResponseDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBlockModal, setShowBlockModal] = useState(false);

  useEffect(() => {
    // 보호된 페이지(/admin)가 아니면 구독 확인하지 않음
    if (!PROTECTED_PATHS.some(path => pathname.startsWith(path))) {
      setLoading(false);
      return;
    }

    checkSubscription();
  }, [pathname]);

  const checkSubscription = async () => {
    try {
      const token = localStorage.getItem('authToken');

      // 로그인하지 않은 경우
      if (!token) {
        router.push('/login');
        return;
      }

      const data = await subscriptionService.getMySubscription();
      setSubscription(data);

      // 구독이 필요한 경우 (만료된 경우)
      if (subscriptionService.needsPayment(data)) {
        setShowBlockModal(true);
      }
    } catch (error: any) {
      console.error('구독 확인 실패:', error);

      // 404 에러이고 "No subscription found" 메시지인 경우에만 구독이 없다고 판단
      // 백엔드 GlobalExceptionHandler의 error 필드 확인
      if (error.status === 404 &&
          (error.message === 'No subscription found' ||
           error.data?.error === 'No subscription found')) {
        router.push('/subscription-check');
        return;
      }

      // 500 에러 시 서버 오류 알림 후 랜딩페이지로
      if (error.status >= 500) {
        showAlert({
          type: 'error',
          title: '서버 오류',
          message: '서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도하거나 고객센터에 문의해주세요.',
          duration: 7000
        });
        setTimeout(() => router.push('/'), 3000);
        return;
      }

      // 기타 API 오류 시 일단 통과시킴 (백엔드 연결 문제 등)
    } finally {
      setLoading(false);
    }
  };


  // 로딩 중
  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: 'var(--color-background-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Spinner size="md" label="로딩 중..." />
      </div>
    );
  }

  // 무료 체험 종료 모달
  if (showBlockModal) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: 'var(--color-background-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}
      >
        <Card width="100%" maxWidth={448} padding={6}>
          <div style={{ position: 'relative', paddingTop: 40 }}>
            {/* 좌측 상단 뒤로가기 버튼 */}
            <div style={{ position: 'absolute', left: 0, top: 0 }}>
              <Button
                label="뒤로가기"
                variant="ghost"
                size="sm"
                icon={<span aria-hidden>←</span>}
                onClick={() => {
                  // 인증 관련 항목만 선택적 삭제 (rememberEmail 등 사용자 설정 유지)
                  ['authToken','refreshToken','tokenExpirationTime','userName','userEmail','userRole','userId','companyId','companyName','companyAddressName','companyCode','customerKey','organizationName','loginType','lastLoginType','userPosition'].forEach(k => localStorage.removeItem(k));
                  window.location.href = 'https://carev.kr';
                }}
              />
            </div>

            <VStack gap={4} hAlign="center">
              {/* 경고 아이콘 */}
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 9999,
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon icon="warning" color="error" size="md" />
              </div>

              <Text type="display-3" weight="bold" justify="center">
                {subscription?.planName === 'FREE' ? '무료 체험이 종료되었습니다' : '구독이 만료되었습니다'}
              </Text>

              <Text type="body" color="secondary" justify="center">
                서비스를 계속 이용하시려면 Basic 플랜을 구독해주세요.
              </Text>

              {/* Basic 플랜 안내 박스 */}
              <div
                style={{
                  width: '100%',
                  backgroundColor: '#e6fcf5',
                  border: '1px solid #96f2d7',
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                <VStack gap={1} hAlign="center">
                  <Text type="large" weight="semibold" color="accent">Basic 플랜</Text>
                  <Text type="display-3" weight="bold" color="accent">
                    ₩9,900<Text type="supporting" weight="normal" color="accent">/월</Text>
                  </Text>
                  <Text type="supporting" color="accent">모든 기능을 이용하실 수 있습니다</Text>
                </VStack>
              </div>

              {/* 액션 버튼 (VStack 기본 cross-axis stretch로 전체 너비) */}
              <VStack gap={3} width="100%">
                <Button
                  label="결제하기"
                  variant="primary"
                  size="lg"
                  onClick={() => {
                    setShowBlockModal(false);
                    router.push('/payment');
                  }}
                />

                <Button
                  label="로그아웃"
                  variant="ghost"
                  size="md"
                  onClick={() => {
                    // 인증 관련 항목만 선택적 삭제 (rememberEmail 등 사용자 설정 유지)
                    ['authToken','refreshToken','tokenExpirationTime','userName','userEmail','userRole','userId','companyId','companyName','companyAddressName','companyCode','customerKey','organizationName','loginType','lastLoginType','userPosition'].forEach(k => localStorage.removeItem(k));
                    window.location.href = 'https://carev.kr';
                  }}
                />
              </VStack>
            </VStack>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <>
      <AlertContainer />
      {children}
      {process.env.NODE_ENV === 'development' && <Agentation />}
    </>
  );
}
