import { SubscriptionResponseDTO } from './subscription';

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

// 위치 정보
export interface Location {
  // 위치 관련 필드들 (백엔드에서 정의된 구조에 따라 확장)
  [key: string]: any;
}

// 로그인 응답 DTO (companyId 추가)
export interface SigninResponseDTO {
  userId: number;
  userName: string;
  companyId?: number; // companyId 추가
  companyName: string;
  companyAddress: Location;
  companyAddressName: string;
  tokenInfo: TokenInfo;
  subscription: SubscriptionResponseDTO;
  customerKey: string;
}

// 사용자 역할 (백엔드와 일치하도록 수정)
export enum UserRole {
  ROLE_ADMIN = 'ROLE_ADMIN',
  ROLE_CLIENT = 'ROLE_CLIENT'
}

// 사용자 데이터 DTO (백엔드 UserDataDTO와 일치)
export interface UserDataDTO {
  name: string;
  email: string;
  password: string;
  role: string; // 백엔드에서 문자열로 받으므로 string으로 변경
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