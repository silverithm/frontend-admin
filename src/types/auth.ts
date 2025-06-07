// 사용자 로그인 DTO
export interface UserSigninDTO {
  email: string;
  password: string;
}

// 토큰 정보
export interface TokenInfo {
  grantType: string;
  accessToken: string;
  accessTokenExpirationTime: number;
  refreshToken: string;
  refreshTokenExpirationTime: number;
}

// 구독 정보 (필요시 확장)
export interface SubscriptionResponseDTO {
  // 구독 관련 필드들 (백엔드에서 정의된 구조에 따라 확장)
  [key: string]: any;
}

// 위치 정보
export interface Location {
  // 위치 관련 필드들 (백엔드에서 정의된 구조에 따라 확장)
  [key: string]: any;
}

// 로그인 응답 DTO
export interface SigninResponseDTO {
  userId: number;
  userName: string;
  companyName: string;
  companyAddress: Location;
  companyAddressName: string;
  tokenInfo: TokenInfo;
  subscription: SubscriptionResponseDTO;
  customerKey: string;
}

// 사용자 역할
export enum UserRole {
  ADMIN = 'ADMIN',
  CAREGIVER = 'CAREGIVER',
  OFFICE = 'OFFICE'
}

// 사용자 데이터 DTO
export interface UserDataDTO {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  companyName: string;
  companyAddress: string;
}

// 비밀번호 찾기 응답
export interface FindPasswordResponse {
  password: string;
}

// 비밀번호 변경 요청
export interface PasswordChangeRequest {
  email: string;
  currentPassword: string;
  newPassword: string;
} 