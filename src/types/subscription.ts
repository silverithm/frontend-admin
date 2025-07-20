// 구독 플랜 타입
export enum SubscriptionType {
  BASIC = 'BASIC',
  ENTERPRISE = 'ENTERPRISE',
  FREE = 'FREE'
}

// 구독 결제 주기
export enum SubscriptionBillingType {
  FREE = 'FREE',
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY'
}

// 구독 상태
export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
  INACTIVE = 'INACTIVE'
}

// 구독 응답 DTO
export interface SubscriptionResponseDTO {
  id: number;
  planName: SubscriptionType;
  billingType: SubscriptionBillingType;
  startDate: string;
  endDate: string;
  status: SubscriptionStatus;
  amount: number;
  hasUsedFreeSubscription: boolean;
}

// 구독 요청 DTO
export interface SubscriptionRequestDTO {
  planName: SubscriptionType;
  billingType: SubscriptionBillingType;
  amount: number;
  customerKey: string;
  authKey: string;
  orderName: string;
  customerEmail: string;
  customerName: string;
  taxFreeAmount: number;
}

// 토스페이먼츠 결제 요청 인터페이스
export interface PaymentRequestDTO {
  amount: number;
  orderId: string;
  orderName: string;
  successUrl: string;
  failUrl: string;
  customerEmail: string;
  customerName: string;
  customerMobilePhone?: string;
}

// 토스페이먼츠 결제 성공 응답
export interface PaymentSuccessResponse {
  paymentKey: string;
  orderId: string;
  amount: number;
}