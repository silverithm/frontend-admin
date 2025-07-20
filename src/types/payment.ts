import { SubscriptionType, SubscriptionBillingType } from './subscription';

export enum PaymentFailureReason {
  CARD_EXPIRED = 'CARD_EXPIRED',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  CARD_DECLINED = 'CARD_DECLINED',
  INVALID_CARD = 'INVALID_CARD',
  NETWORK_ERROR = 'NETWORK_ERROR',
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  OTHER = 'OTHER'
}

export interface PaymentFailureResponseDTO {
  id: number;
  subscriptionId: number;
  failureReason: PaymentFailureReason;
  failureReasonDescription: string;
  failureMessage: string;
  attemptedAmount: number;
  subscriptionType: SubscriptionType;
  billingType: SubscriptionBillingType;
  failedAt: string;
}

export interface PaymentFailurePage {
  content: PaymentFailureResponseDTO[];
  pageable: {
    pageNumber: number;
    pageSize: number;
    sort: {
      empty: boolean;
      sorted: boolean;
      unsorted: boolean;
    };
    offset: number;
    paged: boolean;
    unpaged: boolean;
  };
  last: boolean;
  totalPages: number;
  totalElements: number;
  size: number;
  number: number;
  sort: {
    empty: boolean;
    sorted: boolean;
    unsorted: boolean;
  };
  first: boolean;
  numberOfElements: number;
  empty: boolean;
}