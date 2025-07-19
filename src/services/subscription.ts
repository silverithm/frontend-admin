import { SubscriptionResponseDTO, SubscriptionRequestDTO, SubscriptionStatus } from '@/types/subscription';

export const subscriptionService = {
  // 구독 정보 조회
  async getMySubscription(): Promise<SubscriptionResponseDTO> {
    const token = localStorage.getItem('authToken');
    
    const response = await fetch('/api/subscription', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch subscription');
    }

    return response.json();
  },

  // 구독 생성 또는 업데이트
  async createOrUpdateSubscription(data: SubscriptionRequestDTO): Promise<SubscriptionResponseDTO> {
    const token = localStorage.getItem('authToken');
    
    const response = await fetch('/api/subscription', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Failed to create subscription');
    }

    return response.json();
  },

  // 구독 취소
  async cancelSubscription(): Promise<SubscriptionResponseDTO> {
    const token = localStorage.getItem('authToken');
    
    const response = await fetch('/api/subscription/cancel', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to cancel subscription');
    }

    return response.json();
  },

  // 구독 상태 확인 헬퍼 함수들
  isActive(subscription: SubscriptionResponseDTO): boolean {
    return subscription.status === SubscriptionStatus.ACTIVE;
  },

  isFreeTrialExpired(subscription: SubscriptionResponseDTO): boolean {
    if (subscription.planName === 'FREE' && subscription.status === SubscriptionStatus.EXPIRED) {
      return true;
    }
    
    // 무료 체험 종료일 체크
    if (subscription.planName === 'FREE') {
      const endDate = new Date(subscription.endDate);
      return endDate < new Date();
    }
    
    return false;
  },

  needsPayment(subscription: SubscriptionResponseDTO): boolean {
    return this.isFreeTrialExpired(subscription) || 
           subscription.status === SubscriptionStatus.EXPIRED ||
           subscription.status === SubscriptionStatus.INACTIVE;
  },

  getDaysRemaining(subscription: SubscriptionResponseDTO): number {
    const endDate = new Date(subscription.endDate);
    const today = new Date();
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  }
};