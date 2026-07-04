'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SubscriptionResponseDTO, SubscriptionType, SubscriptionBillingType, SubscriptionStatus } from '@/types/subscription';
import { PaymentFailureResponseDTO, PaymentFailureReason } from '@/types/payment';
import { subscriptionService } from '@/services/subscription';
import { useAlert } from './Alert';
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

export default function SubscriptionInfo() {
  const router = useRouter();
  const { showAlert, AlertContainer } = useAlert();
  const [subscription, setSubscription] = useState<SubscriptionResponseDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentFailures, setPaymentFailures] = useState<PaymentFailureResponseDTO[]>([]);
  const [loadingPaymentFailures, setLoadingPaymentFailures] = useState(false);
  const [showPaymentFailures, setShowPaymentFailures] = useState(false);
  const [activating, setActivating] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showActivateModal, setShowActivateModal] = useState(false);

  useEffect(() => {
    fetchSubscription();
    fetchPaymentFailures();
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

  const fetchPaymentFailures = async () => {
    try {
      setLoadingPaymentFailures(true);
      const data = await subscriptionService.getMyPaymentFailures(0, 3); // 최근 3개만
      setPaymentFailures(data.content);
    } catch (err) {
      console.error('결제 실패 정보 조회 실패:', err);
      // 결제 실패 정보는 선택적이므로 에러를 무시
    } finally {
      setLoadingPaymentFailures(false);
    }
  };

  const handlePayment = () => {
    router.push('/payment');
  };

  const getFailureReasonText = (failure: PaymentFailureResponseDTO): string => {
    // failureReasonDescription이 있으면 그것을 사용 (예: "잔액 부족")
    if (failure.failureReasonDescription && failure.failureReasonDescription.trim() !== '') {
      return failure.failureReasonDescription;
    }

    // 없으면 enum 기반 기본 메시지
    switch (failure.failureReason) {
      case PaymentFailureReason.CARD_EXPIRED:
        return '카드 유효기간 만료';
      case PaymentFailureReason.INSUFFICIENT_FUNDS:
        return '잔액 부족';
      case PaymentFailureReason.CARD_DECLINED:
        return '카드사 승인 거절';
      case PaymentFailureReason.INVALID_CARD:
        return '유효하지 않은 카드';
      case PaymentFailureReason.NETWORK_ERROR:
        return '네트워크 오류';
      case PaymentFailureReason.SYSTEM_ERROR:
        return '시스템 오류';
      case PaymentFailureReason.OTHER:
        return '결제 실패';
      default:
        return '결제 실패';
    }
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

  const handleActivateSubscription = async () => {
    try {
      setActivating(true);
      await subscriptionService.activateSubscription();
      await fetchSubscription();
      setShowActivateModal(false);
      showAlert({
        type: 'success',
        title: '구독 활성화 완료',
        message: '구독이 다시 활성화되었습니다. 정기 결제가 재개됩니다.'
      });
    } catch (err) {
      showAlert({
        type: 'error',
        title: '구독 활성화 실패',
        message: '구독 활성화에 실패했습니다.'
      });
      console.error(err);
    } finally {
      setActivating(false);
    }
  };

  if (loading) {
    return (
      <Card padding={5}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
          <Spinner size="md" label="로딩 중..." />
        </div>
      </Card>
    );
  }

  if (error) {
    return <Banner status="error" title={error} />;
  }

  const needsPayment = subscription && subscriptionService.needsPayment(subscription);
  const daysRemaining = subscription ? subscriptionService.getDaysRemaining(subscription) : 0;

  const statusVariant =
    subscription?.status === SubscriptionStatus.ACTIVE
      ? 'success'
      : subscription?.status === SubscriptionStatus.EXPIRED
        ? 'error'
        : subscription?.status === SubscriptionStatus.CANCELLED
          ? 'warning'
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
      <VStack gap={4}>
        {/* 현재 구독 정보 카드 */}
        <Card padding={5}>
          <VStack gap={5}>
            <Text type="large" weight="semibold">구독 정보</Text>

            {subscription ? (
              <VStack gap={4}>
                <VStack gap={3}>
                  <HStack hAlign="between" vAlign="center">
                    <Text color="secondary">현재 플랜</Text>
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
                </VStack>

                {/* 무료 체험 중인 경우 */}
                {subscription.planName === SubscriptionType.FREE &&
                 subscription.status === SubscriptionStatus.ACTIVE && (
                  <VStack gap={3}>
                    <Banner
                      status="warning"
                      title={`무료 체험 기간이 ${daysRemaining}일 남았습니다.`}
                      description="무료 체험이 종료되면 서비스 이용이 제한됩니다."
                    />
                    <Button
                      label="지금 Basic 플랜 시작하기 (₩9,900/월)"
                      variant="primary"
                      size="lg"
                      onClick={handlePayment}
                    />
                  </VStack>
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

                {/* 취소된 구독에 대한 안내 문구 */}
                {subscriptionService.isCanceled(subscription) && (
                  <VStack gap={3}>
                    <Banner
                      status="warning"
                      title={`구독이 취소되었지만 ${new Date(subscription.endDate).toLocaleDateString('ko-KR')}까지 서비스를 계속 이용하실 수 있습니다.`}
                      description="구독을 다시 활성화하면 정기 결제일마다 자동으로 결제가 재개됩니다."
                    />
                    <Button
                      label="구독 활성화"
                      variant="primary"
                      size="lg"
                      isDisabled={activating}
                      onClick={() => setShowActivateModal(true)}
                    />
                  </VStack>
                )}

                {/* 유료 구독 중인 경우 */}
                {subscription.planName === SubscriptionType.BASIC &&
                 subscription.status === SubscriptionStatus.ACTIVE && (
                  <VStack gap={2}>
                    <HStack hAlign="between" vAlign="center">
                      <VStack gap={0.5}>
                        <Text type="large" weight="semibold">₩{subscription.amount.toLocaleString()}/월</Text>
                        <Text type="supporting">매월 자동 결제</Text>
                      </VStack>
                      <Button
                        label="구독 취소"
                        variant="destructive"
                        size="sm"
                        onClick={() => setShowCancelModal(true)}
                      />
                    </HStack>
                    <Text type="supporting">
                      구독을 취소하면 정기 결제가 중단되며, 종료일까지 서비스를 이용할 수 있습니다.
                    </Text>
                  </VStack>
                )}
              </VStack>
            ) : (
              <VStack gap={4}>
                <Text color="secondary">구독 정보가 없습니다.</Text>
                <Button
                  label="Basic 플랜 시작하기 (₩9,900/월)"
                  variant="primary"
                  size="lg"
                  onClick={handlePayment}
                />
              </VStack>
            )}
          </VStack>
        </Card>

        {/* Basic 플랜 정보 - 무료 체험 중이 아닐 때만 표시 */}
        {(!subscription || subscription.planName !== SubscriptionType.FREE) && (
          <Card padding={5}>
            <VStack gap={4}>
              <Text type="large" weight="semibold">Basic 플랜 혜택</Text>
              <VStack gap={3}>
                <HStack gap={2} vAlign="center">
                  <Icon icon="check" color="success" size="sm" />
                  <Text weight="medium">모든 휴가 관리 기능 이용</Text>
                </HStack>
                <HStack gap={2} vAlign="center">
                  <Icon icon="check" color="success" size="sm" />
                  <Text weight="medium">무제한 직원 등록</Text>
                </HStack>
                <HStack gap={2} vAlign="center">
                  <Icon icon="check" color="success" size="sm" />
                  <Text weight="medium">실시간 알림 기능</Text>
                </HStack>
                <HStack gap={2} vAlign="center">
                  <Icon icon="check" color="success" size="sm" />
                  <Text weight="medium">우선 고객 지원</Text>
                </HStack>
              </VStack>
            </VStack>
          </Card>
        )}

        {/* 결제 실패 정보 섹션 */}
        {paymentFailures.length > 0 && (
          <Card padding={5} variant="red">
            <VStack gap={4}>
              <HStack hAlign="between" vAlign="center">
                <HStack gap={2} vAlign="center">
                  <Icon icon="warning" color="error" size="sm" />
                  <Text weight="semibold" color="primary">
                    결제 실패 ({paymentFailures.length}건)
                  </Text>
                </HStack>
                <Button
                  label={showPaymentFailures ? '숨기기' : '상세 보기'}
                  variant="secondary"
                  size="sm"
                  icon={
                    <span
                      aria-hidden
                      style={{
                        display: 'inline-flex',
                        transform: showPaymentFailures ? 'rotate(180deg)' : undefined,
                      }}
                    >
                      <Icon icon="chevronDown" size="sm" />
                    </span>
                  }
                  onClick={() => setShowPaymentFailures(!showPaymentFailures)}
                />
              </HStack>

              {showPaymentFailures && (
                <VStack gap={3}>
                  <VStack gap={3}>
                    {paymentFailures.map((failure) => (
                      <Card key={failure.id} padding={4}>
                        <HStack hAlign="between" vAlign="start">
                          <VStack gap={0.5}>
                            <Text weight="medium">
                              {getFailureReasonText(failure)}
                            </Text>
                            <Text type="supporting">
                              {new Date(failure.failedAt).toLocaleDateString('ko-KR')} • {failure.subscriptionType} 플랜
                            </Text>
                          </VStack>
                          <VStack gap={1} hAlign="end">
                            <Text weight="semibold">
                              ₩{failure.attemptedAmount.toLocaleString()}
                            </Text>
                            <Button
                              label="재결제"
                              variant="primary"
                              size="sm"
                              onClick={handlePayment}
                            />
                          </VStack>
                        </HStack>
                      </Card>
                    ))}
                  </VStack>

                  <Banner
                    status="info"
                    title="결제 실패가 반복될 경우 카드 정보를 확인하거나 다른 결제 방법을 이용해 주세요."
                  />

                  {paymentFailures.length >= 3 && (
                    <Banner
                      status="warning"
                      title="중요 안내"
                      description="결제 실패가 3회 이상 발생하면 정기 결제가 자동으로 비활성화됩니다. 서비스 중단을 방지하려면 결제 방법을 확인하고 즉시 재결제해 주세요."
                    />
                  )}
                </VStack>
              )}
            </VStack>
          </Card>
        )}
      </VStack>

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

      {/* 구독 활성화 확인 모달 */}
      <Dialog
        isOpen={showActivateModal}
        onOpenChange={(open) => { if (!open) setShowActivateModal(false); }}
        purpose="required"
        width={440}
      >
        <Layout
          header={
            <DialogHeader
              title="구독 활성화"
              onOpenChange={(open) => { if (!open) setShowActivateModal(false); }}
            />
          }
          content={
            <LayoutContent>
              <VStack gap={4}>
                <Text color="secondary">
                  구독을 다시 활성화하시겠습니까? 활성화하면 정기 결제일마다 자동으로 결제가 재개됩니다.
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
                  onClick={() => setShowActivateModal(false)}
                />
                <Button
                  label="구독 활성화"
                  variant="primary"
                  isLoading={activating}
                  onClick={handleActivateSubscription}
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>
    </>
  );
}
