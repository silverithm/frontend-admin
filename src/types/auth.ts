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
  companyCode?: string;
  tokenInfo: TokenInfo;
  subscription: SubscriptionResponseDTO;
  customerKey: string;
}

// 사용자 역할 (백엔드와 일치하도록 수정)
export enum UserRole {
  ROLE_ADMIN = 'ROLE_ADMIN',
  ROLE_CLIENT = 'ROLE_CLIENT',
  ROLE_EMPLOYEE = 'ROLE_EMPLOYEE'  // 직원 역할 추가
}

// 로그인 타입
export type LoginType = 'admin' | 'employee';

// 기능별 세부 권한
export type Permission =
  | 'NOTICE_MANAGE'       // 공지사항 관리
  | 'SCHEDULE_MANAGE'     // 일정 관리
  | 'SCHEDULE_DISPATCH'   // 배차 관리
  | 'APPROVAL_MANAGE'     // 결재 관리 (승인/거절)
  | 'APPROVAL_TEMPLATE'   // 결재 양식 관리
  | 'WORK_MANAGE'         // 근무조정 관리
  | 'MEMBER_VIEW'         // 회원 조회
  | 'MEMBER_MANAGE'       // 회원 승인/거절/상태변경
  | 'SENIOR_MANAGE';      // 어르신 관리

export const PERMISSION_LABELS: Record<Permission, string> = {
  NOTICE_MANAGE: '공지사항 관리',
  SCHEDULE_MANAGE: '일정 관리',
  SCHEDULE_DISPATCH: '배차 관리',
  APPROVAL_MANAGE: '결재 관리',
  APPROVAL_TEMPLATE: '결재 양식 관리',
  WORK_MANAGE: '근무조정 관리',
  MEMBER_VIEW: '회원 조회',
  MEMBER_MANAGE: '회원 관리',
  SENIOR_MANAGE: '어르신 관리',
};

export const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  NOTICE_MANAGE: '공지사항 작성, 수정, 삭제',
  SCHEDULE_MANAGE: '월간 일정 생성 및 관리',
  SCHEDULE_DISPATCH: '차량 배차 설정 및 관리',
  APPROVAL_MANAGE: '전자결재 승인, 거절 처리',
  APPROVAL_TEMPLATE: '결재 양식 생성 및 관리',
  WORK_MANAGE: '근무조정 요청 승인 및 관리',
  MEMBER_VIEW: '회원 목록 조회',
  MEMBER_MANAGE: '회원 승인, 거절, 상태 변경',
  SENIOR_MANAGE: '어르신 정보 등록 및 관리',
};

export const ALL_PERMISSIONS: Permission[] = [
  'NOTICE_MANAGE',
  'SCHEDULE_MANAGE',
  'SCHEDULE_DISPATCH',
  'APPROVAL_MANAGE',
  'APPROVAL_TEMPLATE',
  'WORK_MANAGE',
  'MEMBER_VIEW',
  'MEMBER_MANAGE',
  'SENIOR_MANAGE',
];

// 직원 로그인 응답 DTO
export interface MemberSigninResponseDTO {
  memberId: number;
  memberName: string;
  memberEmail: string;
  companyId: number;
  companyName: string;
  role: string;
  permissions: Permission[];
  tokenInfo: TokenInfo;
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
