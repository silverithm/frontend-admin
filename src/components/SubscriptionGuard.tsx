'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { SubscriptionResponseDTO } from '@/types/subscription';
import { subscriptionService } from '@/services/subscription';
import { useAlert } from './Alert';
import { Agentation } from 'agentation';
import { Loading } from '@/components/Loading';
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

const isProtectedPath = (pathname: string | null) =>
  !!pathname && PROTECTED_PATHS.some(path => pathname.startsWith(path));

export default function SubscriptionGuard({ children }: SubscriptionGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { showAlert, AlertContainer } = useAlert();
  const [subscription, setSubscription] = useState<SubscriptionResponseDTO | null>(null);
  // 보호 경로가 아니면 처음부터 로딩 상태가 아니어야 한다.
  // useEffect는 서버 렌더링에서 실행되지 않으므로, 초기값을 true로 두면
  // 홈/블로그/FAQ 등 공개 페이지의 SSR HTML이 스피너만 담긴 채 크롤러에 노출된다.
  const [loading, setLoading] = useState(() => isProtectedPath(pathname));
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    // 보호된 페이지(/admin)가 아니면 구독 확인하지 않음
    if (!isProtectedPath(pathname)) {
      setLoading(false);
      return;
    }

    setLoading(true);
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
        <Loading size="page" height="100vh" label="구독 상태를 확인하는 중..." />
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
          padding: 'var(--spacing-4)',
        }}
      >
        <AlertContainer />
        <Card width="100%" maxWidth={448} padding={6}>
          <div style={{ position: 'relative', paddingTop: 'var(--spacing-10)' }}>
            {/* 좌측 상단 뒤로가기 버튼 */}
            <div style={{ position: 'absolute', left: 0, top: 0 }}>
              <Button
                label="뒤로가기"
                variant="ghost"
                size="sm"
                icon={<span aria-hidden>←</span>}
                onClick={() => {
                  // 인증 관련 항목만 선택적 삭제 (rememberEmail 등 사용자 설정 유지)
                  ['authToken','refreshToken','tokenExpirationTime','userName','userEmail','userRole','userId','companyId','companyName','companyAddressName','companyCode','customerKey','organizationName','loginType','lastLoginType','userPosition','isDemoMode','demoStartedAt'].forEach(k => localStorage.removeItem(k));
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
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--color-background-red)',
                  border: '1px solid var(--color-border-red)',
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
                  backgroundColor: 'var(--color-background-teal)',
                  border: '1px solid var(--color-border-teal)',
                  borderRadius: 'var(--radius-element)',
                  padding: 'var(--spacing-4)',
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
                {/* 유료 구독 이력이 있으면(카드가 등록돼 있을 가능성) 등록된 카드로 바로 재결제 */}
                {subscription?.planName !== 'FREE' && (
                  <Button
                    label="등록된 카드로 바로 결제"
                    variant="primary"
                    size="lg"
                    isLoading={isRetrying}
                    isDisabled={isRetrying}
                    onClick={async () => {
                      setIsRetrying(true);
                      try {
                        await subscriptionService.retryPayment();
                        showAlert({ type: 'success', title: '결제 완료', message: '구독이 다시 활성화되었습니다.' });
                        setShowBlockModal(false);
                        setLoading(true);
                        checkSubscription();
                      } catch (error: any) {
                        showAlert({
                          type: 'error',
                          title: '재결제 실패',
                          message: `${error.message || '결제에 실패했습니다.'} 카드 등록부터 다시 시도하려면 결제하기를 눌러주세요.`,
                          duration: 7000,
                        });
                      } finally {
                        setIsRetrying(false);
                      }
                    }}
                  />
                )}
                <Button
                  label="결제하기"
                  variant={subscription?.planName !== 'FREE' ? 'secondary' : 'primary'}
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
                    ['authToken','refreshToken','tokenExpirationTime','userName','userEmail','userRole','userId','companyId','companyName','companyAddressName','companyCode','customerKey','organizationName','loginType','lastLoginType','userPosition','isDemoMode','demoStartedAt'].forEach(k => localStorage.removeItem(k));
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
