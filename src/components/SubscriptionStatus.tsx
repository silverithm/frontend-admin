'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { SubscriptionResponseDTO, SubscriptionType, SubscriptionStatus as Status } from '@/types/subscription';
import { subscriptionService } from '@/services/subscription';
import { useAlert } from '@/components/Alert';

const dotStyle = (color: string): React.CSSProperties => ({
  display: 'inline-block',
  width: 8,
  height: 8,
  borderRadius: 'var(--radius-full)',
  backgroundColor: color,
  flexShrink: 0,
});

const StatusDot = ({ color, pulse = false }: { color: string; pulse?: boolean }) => (
  <span className={pulse ? 'carev-substatus-dot-pulse' : undefined} style={dotStyle(color)} />
);

export default function SubscriptionStatus() {
  const router = useRouter();
  const { showAlert, AlertContainer } = useAlert();
  const [subscription, setSubscription] = useState<SubscriptionResponseDTO | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    try {
      const data = await subscriptionService.getMySubscription();
      setSubscription(data);
    } catch (err) {
      console.error('구독 정보 조회 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = () => {
    // 체험 모드에서는 결제 페이지로 보내지 않고 정식 가입으로 유도한다
    if (localStorage.getItem('isDemoMode') === 'true') {
      showAlert({
        type: 'info',
        title: '체험 모드 안내',
        message: '체험 모드에서는 결제를 진행할 수 없습니다. 정식 가입 후 이용해주세요.',
      });
      router.push('/signup');
      return;
    }
    router.push('/payment');
  };

  if (loading) {
    return (
      <Badge
        variant="neutral"
        icon={<StatusDot color='var(--color-icon-disabled)' pulse />}
        label="구독 확인 중..."
      />
    );
  }

  if (!subscription) {
    return (
      <>
        <AlertContainer />
        <Button
          variant="destructive"
          size="sm"
          icon={<StatusDot color='var(--color-on-accent)' pulse />}
          label="구독 필요"
          onClick={handlePayment}
        />
      </>
    );
  }

  const needsPayment = subscriptionService.needsPayment(subscription);
  const daysRemaining = subscriptionService.getDaysRemaining(subscription);

  if (needsPayment) {
    return (
      <>
        <AlertContainer />
        <Button
          variant="destructive"
          size="sm"
          icon={<StatusDot color='var(--color-on-accent)' pulse />}
          label={subscription.planName === SubscriptionType.FREE ? '무료 체험 종료' : '구독 만료'}
          onClick={handlePayment}
        />
      </>
    );
  }

  if (subscription.planName === SubscriptionType.FREE && subscription.status === Status.ACTIVE) {
    return (
      <>
        <AlertContainer />
        <Button
          variant="secondary"
          size="sm"
          icon={<StatusDot color='var(--color-warning)' />}
          label={`무료 체험 ${daysRemaining}일 남음`}
          onClick={handlePayment}
        />
      </>
    );
  }

  if (subscription.planName === SubscriptionType.BASIC && subscription.status === Status.ACTIVE) {
    return (
      <Badge
        variant="teal"
        icon={<StatusDot color='var(--color-icon-teal)' />}
        label="Basic 플랜 활성"
      />
    );
  }

  return (
    <Badge
      variant="neutral"
      icon={<StatusDot color='var(--color-icon-secondary)' />}
      label="구독 상태 확인 필요"
    />
  );
}
