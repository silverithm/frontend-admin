'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SubscriptionResponseDTO, SubscriptionType, SubscriptionBillingType, SubscriptionStatus } from '@/types/subscription';
import { subscriptionService } from '@/services/subscription';
import { useAlert } from '@/components/Alert';
import { Card } from '@astryxdesign/core/Card';
import { Button } from '@astryxdesign/core/Button';
import { Text } from '@astryxdesign/core/Text';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Icon } from '@astryxdesign/core/Icon';
import { Spinner } from '@astryxdesign/core/Spinner';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';

const BASIC_FEATURES = ['모든 기능 이용 가능', '무제한 사용자', '실시간 알림', '고객 지원'];

export default function SubscriptionPage() {
  const router = useRouter();
  const { showAlert, AlertContainer } = useAlert();
  const [subscription, setSubscription] = useState<SubscriptionResponseDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    try {
      setLoading(true);
      const data = await subscriptionService.getMySubscription();
      setSubscription(data);
    } catch (err) {
      setError('구독 정보를 불러올 수 없습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = () => {
    // 토스페이먼츠 결제 페이지로 이동
    router.push('/payment');
  };

  const handleCancelSubscription = async () => {
    try {
      setLoading(true);
      await subscriptionService.cancelSubscription();
      await fetchSubscription();
      setShowCancelModal(false);
      showAlert({
        type: 'success',
        title: '구독 취소 완료',
        message: '구독이 취소되었습니다.'
      });
    } catch (err) {
      showAlert({
        type: 'error',
        title: '구독 취소 실패',
        message: '구독 취소에 실패했습니다.'
      });
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Spinner size="md" label="로딩 중..." />
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}
      >
        <div style={{ width: '100%', maxWidth: 420 }}>
          <Banner status="error" title={error} />
        </div>
      </div>
    );
  }

  const needsPayment = subscription && subscriptionService.needsPayment(subscription);
  const daysRemaining = subscription ? subscriptionService.getDaysRemaining(subscription) : 0;

  const statusVariant =
    subscription?.status === SubscriptionStatus.ACTIVE
      ? 'success'
      : subscription?.status === SubscriptionStatus.EXPIRED
        ? 'error'
        : 'neutral';
  const statusLabel =
    subscription?.status === SubscriptionStatus.ACTIVE
      ? '활성'
      : subscription?.status === SubscriptionStatus.EXPIRED
        ? '만료됨'
        : subscription?.status === SubscriptionStatus.CANCELLED
          ? '취소됨'
          : '비활성';

  return (
    <>
      <AlertContainer />
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: 'var(--color-background-muted)',
          padding: '48px 16px',
        }}
      >
        <div style={{ maxWidth: 768, margin: '0 auto' }}>
          <VStack gap={6}>
            <Text type="display-2" weight="bold">구독 관리</Text>

            {subscription ? (
              <Card padding={6}>
                <VStack gap={5}>
                  <VStack gap={4}>
                    <Text type="large" weight="semibold">현재 구독 정보</Text>

                    <VStack gap={3}>
                      <HStack hAlign="between" vAlign="center">
                        <Text color="secondary">플랜</Text>
                        <Text weight="medium">
                          {subscription.planName === SubscriptionType.FREE ? '무료 체험' :
                           subscription.planName === SubscriptionType.BASIC ? 'Basic 플랜' :
                           subscription.planName}
                        </Text>
                      </HStack>

                      <HStack hAlign="between" vAlign="center">
                        <Text color="secondary">상태</Text>
                        <Badge variant={statusVariant} label={statusLabel} />
                      </HStack>

                      <HStack hAlign="between" vAlign="center">
                        <Text color="secondary">시작일</Text>
                        <Text weight="medium">
                          {new Date(subscription.startDate).toLocaleDateString('ko-KR')}
                        </Text>
                      </HStack>

                      <HStack hAlign="between" vAlign="center">
                        <Text color="secondary">종료일</Text>
                        <Text weight="medium">
                          {new Date(subscription.endDate).toLocaleDateString('ko-KR')}
                        </Text>
                      </HStack>

                      {subscription.amount > 0 && (
                        <HStack hAlign="between" vAlign="center">
                          <Text color="secondary">금액</Text>
                          <Text weight="medium">
                            ₩{subscription.amount.toLocaleString()}/월
                          </Text>
                        </HStack>
                      )}
                    </VStack>
                  </VStack>

                  {/* 무료 체험 중인 경우 */}
                  {subscription.planName === SubscriptionType.FREE &&
                   subscription.status === SubscriptionStatus.ACTIVE && (
                    <Banner
                      status="info"
                      title={`무료 체험 기간이 ${daysRemaining}일 남았습니다.`}
                      description="무료 체험이 종료되면 서비스 이용이 제한됩니다."
                    />
                  )}

                  {/* 결제가 필요한 경우 */}
                  {needsPayment && (
                    <VStack gap={3}>
                      <Banner
                        status="error"
                        title={subscription.planName === SubscriptionType.FREE ?
                          '무료 체험이 종료되었습니다.' :
                          '구독이 만료되었습니다.'}
                        description="서비스를 계속 이용하려면 구독을 시작해주세요."
                      />
                      <Button
                        label="Basic 플랜 시작하기 (₩9,900/월)"
                        variant="primary"
                        size="lg"
                        onClick={handlePayment}
                      />
                    </VStack>
                  )}

                  {/* 유료 구독 중인 경우 */}
                  {subscription.planName === SubscriptionType.BASIC &&
                   subscription.status === SubscriptionStatus.ACTIVE && (
                    <VStack gap={1} hAlign="start">
                      <Button
                        label="구독 취소"
                        variant="destructive"
                        size="sm"
                        onClick={() => setShowCancelModal(true)}
                      />
                      <Text type="supporting">
                        구독을 취소해도 종료일까지 서비스를 이용할 수 있습니다.
                      </Text>
                    </VStack>
                  )}
                </VStack>
              </Card>
            ) : (
              <Card padding={6}>
                <VStack gap={4}>
                  <Text color="secondary">구독 정보가 없습니다.</Text>
                  <Button
                    label="Basic 플랜 시작하기 (₩9,900/월)"
                    variant="primary"
                    size="lg"
                    onClick={handlePayment}
                  />
                </VStack>
              </Card>
            )}

            {/* 플랜 정보 */}
            <Card padding={6}>
              <VStack gap={4}>
                <Text type="large" weight="semibold">Basic 플랜</Text>

                <HStack gap={1} vAlign="end">
                  <Text type="display-2" weight="bold">₩9,900</Text>
                  <Text type="body" color="secondary">/월</Text>
                </HStack>

                <VStack gap={2}>
                  {BASIC_FEATURES.map((feature) => (
                    <HStack key={feature} gap={2} vAlign="center">
                      <Icon icon="check" color="success" size="sm" />
                      <Text color="secondary">{feature}</Text>
                    </HStack>
                  ))}
                </VStack>
              </VStack>
            </Card>
          </VStack>
        </div>
      </div>

      {/* 구독 취소 확인 모달 */}
      <Dialog
        isOpen={showCancelModal}
        onOpenChange={(open) => { if (!open) setShowCancelModal(false); }}
        purpose="required"
        width={440}
      >
        <Layout
          header={
            <DialogHeader
              title="구독 취소"
              onOpenChange={(open) => { if (!open) setShowCancelModal(false); }}
            />
          }
          content={
            <LayoutContent>
              <VStack gap={4}>
                <Text color="secondary">
                  정말로 구독을 취소하시겠습니까? 구독을 취소하면 정기 결제가 중단되며, 종료일까지 서비스를 이용할 수 있습니다.
                </Text>
              </VStack>
            </LayoutContent>
          }
          footer={
            <LayoutFooter hasDivider>
              <HStack gap={2} hAlign="end">
                <Button
                  label="취소"
                  variant="ghost"
                  onClick={() => setShowCancelModal(false)}
                />
                <Button
                  label="구독 취소"
                  variant="destructive"
                  isLoading={loading}
                  onClick={handleCancelSubscription}
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>
    </>
  );
}
