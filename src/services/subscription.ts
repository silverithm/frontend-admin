import { SubscriptionResponseDTO, SubscriptionRequestDTO, SubscriptionStatus } from '@/types/subscription';
import { PaymentFailurePage } from '@/types/payment';

export const subscriptionService = {
  // 구독 정보 조회
  async getMySubscription(): Promise<SubscriptionResponseDTO> {
    const token = localStorage.getItem('authToken');
    
    const response = await fetch('/api/v1/subscriptions', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      // 에러 응답의 내용을 확인
      let errorMessage = 'Failed to fetch subscription';
      let errorData: any = {};
      
      try {
        errorData = await response.json();
        // 백엔드의 GlobalExceptionHandler가 반환하는 error 필드 사용
        if (errorData.error) {
          errorMessage = errorData.error;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch {
        // JSON 파싱 실패 시 기본 메시지 사용
        errorMessage = `HTTP ${response.status} error`;
      }
      
      const error = new Error(errorMessage);
      (error as any).status = response.status;
      (error as any).data = errorData;
      throw error;
    }

    return response.json();
  },

  // 구독 생성 또는 업데이트
  async createOrUpdateSubscription(data: SubscriptionRequestDTO): Promise<SubscriptionResponseDTO> {
    const token = localStorage.getItem('authToken');
    
    const response = await fetch('/api/v1/subscriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      let errorMessage = 'Failed to create subscription';
      let errorData: any = {};
      
      try {
        errorData = await response.json();
        if (errorData.error) {
          errorMessage = errorData.error;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch {
        errorMessage = `HTTP ${response.status} error`;
      }
      
      const error = new Error(errorMessage);
      (error as any).status = response.status;
      (error as any).data = errorData;
      throw error;
    }

    return response.json();
  },

  // 구독 취소
  async cancelSubscription(): Promise<SubscriptionResponseDTO> {
    const token = localStorage.getItem('authToken');
    
    const response = await fetch('/api/v1/subscriptions/cancel', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      let errorMessage = 'Failed to cancel subscription';
      let errorData: any = {};
      
      try {
        errorData = await response.json();
        if (errorData.error) {
          errorMessage = errorData.error;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch {
        errorMessage = `HTTP ${response.status} error`;
      }
      
      const error = new Error(errorMessage);
      (error as any).status = response.status;
      (error as any).data = errorData;
      throw error;
    }

    return response.json();
  },

  // 구독 활성화
  async activateSubscription(): Promise<SubscriptionResponseDTO> {
    const token = localStorage.getItem('authToken');
    
    const response = await fetch('/api/v1/subscriptions/activate', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      let errorMessage = 'Failed to activate subscription';
      let errorData: any = {};
      
      try {
        errorData = await response.json();
        if (errorData.error) {
          errorMessage = errorData.error;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch {
        errorMessage = `HTTP ${response.status} error`;
      }
      
      const error = new Error(errorMessage);
      (error as any).status = response.status;
      (error as any).data = errorData;
      throw error;
    }

    return response.json();
  },

  // 무료 구독 생성
  async createFreeSubscription(): Promise<SubscriptionResponseDTO> {
    const token = localStorage.getItem('authToken');
    
    const response = await fetch('/api/v1/subscriptions/free', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      let errorMessage = 'Failed to create free subscription';
      let errorData: any = {};
      
      try {
        errorData = await response.json();
        if (errorData.error) {
          errorMessage = errorData.error;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch {
        errorMessage = `HTTP ${response.status} error`;
      }
      
      const error = new Error(errorMessage);
      (error as any).status = response.status;
      (error as any).data = errorData;
      throw error;
    }

    return response.json();
  },

  // 구독 상태 확인 헬퍼 함수들
  isActive(subscription: SubscriptionResponseDTO): boolean {
    return subscription.status === SubscriptionStatus.ACTIVE;
  },

  isCanceled(subscription: SubscriptionResponseDTO): boolean {
    return subscription.status === SubscriptionStatus.CANCELLED;
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
           this.isPaidSubscriptionExpired(subscription) ||
           subscription.status === SubscriptionStatus.EXPIRED ||
           subscription.status === SubscriptionStatus.INACTIVE;
  },

  isPaidSubscriptionExpired(subscription: SubscriptionResponseDTO): boolean {
    // 유료 구독의 경우 endDate 직접 확인
    if (subscription.planName !== 'FREE') {
      const endDate = new Date(subscription.endDate);
      return endDate < new Date();
    }
    return false;
  },

  getDaysRemaining(subscription: SubscriptionResponseDTO): number {
    const endDate = new Date(subscription.endDate);
    const today = new Date();
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  },

  // 무료 체험 사용 여부 확인
  hasUsedFreeSubscription(subscription: SubscriptionResponseDTO | null): boolean {
    return subscription ? subscription.hasUsedFreeSubscription : false;
  },

  // 무료 체험을 사용할 수 있는지 확인
  canUseFreeSubscription(subscription: SubscriptionResponseDTO | null): boolean {
    return !this.hasUsedFreeSubscription(subscription);
  },

  // 결제 실패 정보 조회
  async getMyPaymentFailures(page: number = 0, size: number = 10): Promise<PaymentFailurePage> {
    const token = localStorage.getItem('authToken');
    
    const response = await fetch(`/api/v1/subscriptions/payment-failures?page=${page}&size=${size}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      let errorMessage = 'Failed to fetch payment failures';
      let errorData: any = {};
      
      try {
        errorData = await response.json();
        if (errorData.error) {
          errorMessage = errorData.error;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch {
        errorMessage = `HTTP ${response.status} error`;
      }
      
      const error = new Error(errorMessage);
      (error as any).status = response.status;
      (error as any).data = errorData;
      throw error;
    }

    return response.json();
  }
};