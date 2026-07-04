'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { IconShieldCheck } from '@tabler/icons-react';
import { Card } from '@astryxdesign/core/Card';
import { Button } from '@astryxdesign/core/Button';
import { Text } from '@astryxdesign/core/Text';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Spinner } from '@astryxdesign/core/Spinner';
import { Icon } from '@astryxdesign/core/Icon';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { SubscriptionResponseDTO, SubscriptionStatus, SubscriptionType } from '@/types/subscription';
import { subscriptionService } from '@/services/subscription';

const PAGE_GRADIENT = 'linear-gradient(180deg, #0f1115 0%, #16181d 55%, #0f1115 100%)';

export default function SubscriptionCheckPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionResponseDTO | null>(null);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [creatingFree, setCreatingFree] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      router.push('/login');
      return;
    }

    checkSubscription();
  }, [router]);

  const checkSubscription = async () => {
    try {
      setLoading(true);
      const data = await subscriptionService.getMySubscription();
      setSubscription(data);
      setHasSubscription(true);

      // 구독이 있고 활성 상태라면 관리자 페이지로 이동
      if (subscriptionService.isActive(data)) {
        router.push('/admin');
      }
    } catch (err: any) {
      console.error('구독 확인 실패:', err);

      // 404 에러이고 "No subscription found" 메시지인 경우에만 구독이 없다고 판단
      if (err.status === 404 &&
          (err.message === 'No subscription found' ||
           err.data?.error === 'No subscription found')) {
        setHasSubscription(false);
      } else {
        // 서버 오류인 경우 에러 메시지 표시
        if (err.status >= 500) {
          setError('서버 오류');
        } else {
          setError('구독 정보 확인 실패');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFreeSubscription = async () => {
    try {
      setCreatingFree(true);
      setError('');

      const newSubscription = await subscriptionService.createFreeSubscription();
      setSubscription(newSubscription);
      setHasSubscription(true);

      // 무료 구독 생성 성공 후 관리자 페이지로 이동
      router.push('/admin');
    } catch (err) {
      setError('무료 구독 생성에 실패했습니다. 다시 시도해주세요.');
      console.error('무료 구독 생성 오류:', err);
    } finally {
      setCreatingFree(false);
    }
  };

  const handleGoToPayment = () => {
    router.push('/payment');
  };

  // 만료된 구독이 있는 경우
  const isExpiredSubscription = subscription && subscriptionService.needsPayment(subscription);

  // 무료 체험을 한 번이라도 사용한 경우 (무료로 시작하기 버튼 숨김 용도)
  const hasUsedFreeTrial = subscriptionService.hasUsedFreeSubscription(subscription);
  const canUseFreeSubscription = subscriptionService.canUseFreeSubscription(subscription);

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: PAGE_GRADIENT,
          color: '#ffffff',
        }}
      >
        <Spinner size="lg" shade="onMedia" label="구독 정보를 확인하는 중..." />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: PAGE_GRADIENT }}>
      {/* 헤더 */}
      <header style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.2)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 16px' }}>
          <HStack hAlign="center">
            <Image
              src="/images/logo-text.png"
              alt="케어브이 로고"
              width={140}
              height={47}
              priority
            />
          </HStack>
        </div>
      </header>

      <main
        style={{
          maxWidth: 896,
          margin: '0 auto',
          padding: '64px 16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* 에러 발생 시 표시 */}
        {error && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
          >
            <Card width="100%" maxWidth={640} padding={6}>
              <VStack gap={4}>
                {/* 경고 아이콘 */}
                <HStack hAlign="center">
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 'var(--radius-container)',
                      backgroundColor: 'var(--color-background-red)',
                      border: '1px solid #fecaca',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon icon="warning" color="error" size="lg" />
                  </div>
                </HStack>

                <Text type="display-3" weight="bold" justify="center">
                  구독 정보 확인에 실패했습니다
                </Text>
                <Text type="body" color="secondary" justify="center">
                  {error === '서버 오류'
                    ? '서버에 일시적인 문제가 발생했습니다.'
                    : '구독 정보를 불러올 수 없습니다.'}
                  <br />
                  잠시 후 다시 시도하거나 고객센터에 문의해주세요.
                </Text>

                <HStack gap={3} hAlign="center" wrap="wrap">
                  <Button
                    label="다시 시도"
                    variant="secondary"
                    size="md"
                    onClick={() => window.location.reload()}
                  />
                  <Button
                    label="메인으로 돌아가기"
                    variant="primary"
                    size="md"
                    onClick={() => router.push('/')}
                  />
                </HStack>

                <div style={{ borderTop: '1px solid #f1f3f5', paddingTop: 'var(--spacing-4)' }}>
                  <Text type="supporting" justify="center">
                    문의: ggprgrkjh@naver.com | 고객센터: 1234-5678
                  </Text>
                </div>
              </VStack>
            </Card>
          </motion.div>
        )}

        {/* 만료된 구독이 있는 경우 */}
        {!error && isExpiredSubscription && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
          >
            <Card width="100%" maxWidth={640} padding={6}>
              <VStack gap={4}>
                {/* 경고 아이콘 */}
                <HStack hAlign="center">
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 'var(--radius-container)',
                      backgroundColor: 'var(--color-background-red)',
                      border: '1px solid #fecaca',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon icon="warning" color="error" size="lg" />
                  </div>
                </HStack>

                <Text type="display-3" weight="bold" justify="center">
                  구독을 확인해주세요
                </Text>
                <Text type="body" color="secondary" justify="center">
                  현재 구독이 만료되었습니다. 서비스를 계속 이용하시려면 구독을 갱신해주세요.
                </Text>

                {/* 현재 구독 상태 */}
                <div
                  style={{
                    backgroundColor: 'var(--color-background-muted)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-element)',
                    padding: 'var(--spacing-4)',
                  }}
                >
                  <VStack gap={3}>
                    <Text type="large" weight="semibold">현재 구독 상태</Text>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: 'var(--spacing-4)',
                      }}
                    >
                      <VStack gap={1}>
                        <Text type="supporting" color="secondary">
                          플랜: <Text type="supporting" color="primary" weight="medium">{subscription?.planName}</Text>
                        </Text>
                        <HStack gap={1} vAlign="center">
                          <Text type="supporting" color="secondary">상태:</Text>
                          <Badge variant="error" label="만료됨" />
                        </HStack>
                      </VStack>
                      <VStack gap={1}>
                        <Text type="supporting" color="secondary">
                          시작일: <Text type="supporting" color="primary" weight="medium">{subscription?.startDate ? new Date(subscription.startDate).toLocaleDateString() : '-'}</Text>
                        </Text>
                        <Text type="supporting" color="secondary">
                          종료일: <Text type="supporting" color="primary" weight="medium">{subscription?.endDate ? new Date(subscription.endDate).toLocaleDateString() : '-'}</Text>
                        </Text>
                      </VStack>
                    </div>
                  </VStack>
                </div>

                <Button
                  label="구독 갱신하기"
                  variant="primary"
                  size="lg"
                  onClick={handleGoToPayment}
                />
              </VStack>
            </Card>
          </motion.div>
        )}

        {/* 구독이 없는 경우 */}
        {!error && !hasSubscription && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            style={{ width: '100%' }}
          >
            <VStack gap={6}>
              <VStack gap={3}>
                <div style={{ color: 'var(--color-background-muted)' }}>
                  <Text type="display-2" weight="bold" justify="center" color="inherit">
                    {!canUseFreeSubscription ? '구독 플랜을 선택해주세요' : '케어브이에 오신 것을 환영합니다!'}
                  </Text>
                </div>
                <div style={{ color: 'rgba(219, 234, 254, 0.9)' }}>
                  <Text type="large" justify="center" color="inherit">
                    {hasUsedFreeTrial
                      ? '효율적인 휴무 관리를 시작하기 위해 구독 플랜을 선택해주세요.'
                      : !canUseFreeSubscription
                        ? '무료 체험 기간이 종료되었습니다. 서비스를 계속 이용하시려면 Basic 플랜을 구독해주세요.'
                        : '효율적인 휴무 관리를 시작하기 위해 구독 플랜을 선택해주세요.'
                    }
                  </Text>
                </div>
              </VStack>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                  gap: 'var(--spacing-8)',
                  alignItems: 'stretch',
                }}
              >
                {/* 무료 체험 카드 - 항상 표시 */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                  style={{ display: 'flex' }}
                >
                  <Card width="100%" padding={6}>
                    <VStack gap={4} height="100%">
                      <HStack hAlign="center">
                        <div
                          style={{
                            width: 64,
                            height: 64,
                            borderRadius: 'var(--radius-container)',
                            backgroundColor: 'var(--color-background-teal)',
                            border: '1px solid #96f2d7',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Icon icon="clock" color="success" size="lg" />
                        </div>
                      </HStack>

                      <Text type="display-3" weight="bold" justify="center">30일 무료 체험</Text>
                      <Text type="display-2" weight="bold" color="accent" justify="center">무료</Text>
                      <Text type="body" color="secondary" justify="center">
                        케어브이의 모든 기능을 30일간 무료로 체험해보세요
                      </Text>

                      <VStack gap={2}>
                        {['모든 휴가 관리 기능', '직원 등록 및 관리', '실시간 알림 및 승인'].map((feature) => (
                          <HStack key={feature} gap={2} vAlign="center">
                            <Icon icon="check" color="success" size="sm" />
                            <Text type="body" color="secondary">{feature}</Text>
                          </HStack>
                        ))}
                      </VStack>

                      <Button
                        label={creatingFree
                          ? '시작하는 중...'
                          : !canUseFreeSubscription
                            ? '이미 무료 체험을 사용했습니다'
                            : '무료로 시작하기'}
                        variant="primary"
                        size="lg"
                        isLoading={creatingFree}
                        isDisabled={creatingFree || !canUseFreeSubscription}
                        onClick={handleCreateFreeSubscription}
                      />
                    </VStack>
                  </Card>
                </motion.div>

                {/* 유료 구독 카드 */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  style={{ display: 'flex' }}
                >
                  <Card width="100%" padding={6}>
                    <VStack gap={4} height="100%">
                      <HStack hAlign="center">
                        <Badge variant="info" label="추천 플랜" />
                      </HStack>

                      <HStack hAlign="center">
                        <div
                          style={{
                            width: 64,
                            height: 64,
                            borderRadius: 'var(--radius-container)',
                            backgroundColor: 'var(--color-background-blue)',
                            border: '1px solid #a5d8ff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Icon icon={IconShieldCheck} color="accent" size="lg" />
                        </div>
                      </HStack>

                      <Text type="display-3" weight="bold" justify="center">Basic 플랜</Text>
                      <HStack gap={1} hAlign="center" vAlign="end">
                        <Text type="display-2" weight="bold" color="accent">₩9,900</Text>
                        <Text type="body" color="secondary">/월</Text>
                      </HStack>
                      <Text type="body" color="secondary" justify="center">
                        {!canUseFreeSubscription
                          ? '지속적인 서비스 이용을 위해 Basic 플랜을 구독하세요'
                          : '무료 체험 없이 바로 모든 기능을 이용하거나, 30일 무료 체험 후 자동으로 시작하세요'
                        }
                      </Text>

                      <VStack gap={2}>
                        {['모든 휴가 관리 기능', '무제한 직원 등록', '우선 고객 지원'].map((feature) => (
                          <HStack key={feature} gap={2} vAlign="center">
                            <Icon icon="check" color="accent" size="sm" />
                            <Text type="body" color="secondary">{feature}</Text>
                          </HStack>
                        ))}
                      </VStack>

                      <Button
                        label="결제하기"
                        variant="primary"
                        size="lg"
                        onClick={handleGoToPayment}
                      />
                    </VStack>
                  </Card>
                </motion.div>
              </div>

              {error && (
                <Banner status="error" title={error} />
              )}
            </VStack>
          </motion.div>
        )}
      </main>
    </div>
  );
}
